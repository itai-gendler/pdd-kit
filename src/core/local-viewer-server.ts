import { spawn } from 'node:child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { lstatSync, readFileSync, watch, watchFile, unwatchFile, type FSWatcher, type Stats } from 'node:fs'
import { basename, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import type { ProductReport } from './portable.js'
import { failureIssue, issuesAsRequest, type ModelIssue } from './model-issues.js'
import { MAX_PRODUCT_LOGO_BYTES, validateProductLogo } from '../logo.js'
import { localCodePreview } from './local-code-preview.js'
import { localMarkdownPreview } from './local-markdown-preview.js'
import { ghStarClient, type GithubStarClient, type GithubStarState } from './github-star.js'
import { viewerPreferencesRoute } from './viewer-preferences.js'
import { cliCommand } from './invocation.js'
import { GitVersionError, type GitHistory } from './git-history.js'

const LOOPBACK_HOST = '127.0.0.1'
const REPORT_PATH = '/_pdd-kit/report.json'
const STATUS_PATH = '/_pdd-kit/status.json'
const GIT_CONTEXT_PATH = '/_pdd-kit/git/context.json'
const GIT_VERSIONS_PATH = '/_pdd-kit/git/versions.json'
const GIT_MODEL_PATH = '/_pdd-kit/git/model.json'
const EVENTS_PATH = '/_pdd-kit/events'
const HEALTH_PATH = '/_pdd-kit/health'
const LOGO_PATH = '/_pdd-kit/logo.svg'
const ASSET_PREFIX = '/_pdd-kit/file/'
const CODE_PATH = '/_pdd-kit/code'
const GITHUB_STAR_PATH = '/_pdd-kit/github-star'
const PREFERENCES_PATH = '/_pdd-kit/preferences'
const VIEWER_ROOT = fileURLToPath(new URL('./viewer/', import.meta.url))
const BRAND_ROOT = resolve(createRequire(import.meta.url).resolve('pdd-toolkit/package.json'), '../layers/nuxt/theme/public/brand')

/** 25 MB. A product asset is a mockup or a capture, never a build output. */
const MAX_ASSET_BYTES = 25 * 1024 * 1024

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

/**
 * What the repository mount will serve.
 *
 * Reference targets are repository-relative, so the viewer has to reach outside
 * its own bundle to render a mockup or a capture. The allowlist is the guard:
 * inert product material only, never source, never an executable, never a
 * format that scripts when opened. Everything else 404s whether or not it
 * exists, so the mount cannot be used to enumerate a repository.
 * Declared code References use a separate escaped, read-only source preview.
 */
const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp'
}

export interface LocalViewer {
  server: Server
  url: string
  port: number
  /** Compile immediately. Primarily useful to deterministic tests and recovery controls. */
  refresh: () => void
  /** Whether a report is on screen, and otherwise why not. */
  status: () => { ready: boolean, state: LocalViewerState, error?: string }
  /**
   * Attach a model after the server is up. A viewer started before
   * `product-model/` exists waits with a message; binding gives it what to
   * compile and watch, and the open page comes alive on the next event.
   */
  bind: (binding: LocalViewerBinding) => void
  close: () => Promise<void>
}

/** Everything about one model: what to compile, and where to watch and read. */
export type LocalViewerBinding = Pick<LocalViewerOptions,
  'compile' | 'initialReport' | 'watchRoot' | 'gitIndexFile' | 'logoFile' | 'assetRoot' | 'history'>
const BINDING_KEYS = ['compile', 'initialReport', 'watchRoot', 'gitIndexFile', 'logoFile', 'assetRoot', 'history'] as const

/* How often refs are asked whether they moved: a fetch, a commit or a checkout elsewhere touches no watched file. */
const REF_POLL_MS = 1000

/**
 * What one compile produced: a report when the compiler accepted the model,
 * and every issue either way. A plain report means a build with no issues.
 */
export interface LocalViewerBuild {
  report?: ProductReport
  issues: ModelIssue[]
}

/**
 * Where the viewer stands.
 *
 * `degraded` serves the current report with errors beside it; `stale` serves
 * the last report that built because the current model does not; `blocked`
 * has nothing to serve yet.
 */
export type LocalViewerState = 'waiting' | 'ready' | 'degraded' | 'stale' | 'blocked'

/** The problems the page shows, served at `status.json` and on every change. */
export interface LocalViewerStatus {
  state: LocalViewerState
  revision: number
  issues: ModelIssue[]
  /** When the served report compiled, in epoch milliseconds. */
  builtAt: number | null
  /** The errors as a request ready to paste into an agent. */
  request: string | null
}

export interface LocalViewerOptions {
  port?: number
  /** Absent until a model is bound: the viewer then serves the waiting message. */
  compile?: () => ProductReport | LocalViewerBuild
  /** What `report.json` and the stream say while no model is bound. */
  waitingMessage?: string
  initialReport?: ProductReport
  watchRoot?: string
  /** Git's resolved index path, including a linked worktree's private index. */
  gitIndexFile?: string
  debounceMs?: number
  viewerRoot?: string
  logoFile?: string
  /**
   * Repository root for the read-only asset mount.
   *
   * Reference targets resolve repository-relative, and product assets live
   * beside the resource they describe, so the viewer serves from the repository
   * rather than only from `product-model/`. Omit it and the mount is off.
   */
  assetRoot?: string
  /** Stars or unstars pdd-kit on the reader's behalf. Defaults to the reader's own `gh` sign-in. */
  githubStar?: GithubStarClient
  /**
   * The model's Git history, which the report's Changes reads versions from.
   * Omit it and the viewer offers no Changes: a snapshot or a folder outside Git.
   */
  history?: GitHistory
  /**
   * The file that keeps the reader's display preferences across runs, whose
   * port changes. Omit it and the report keeps them in the browser alone.
   */
  preferencesFile?: string
}

interface ReportSnapshot {
  report?: ProductReport
  error?: string
  revision: number
  state: LocalViewerState
}

type ReportEvent = { type: 'report', revision: number } | { type: 'git', revision: number } | ({ type: 'status' } & LocalViewerStatus)

const isBuild = (value: ProductReport | LocalViewerBuild): value is LocalViewerBuild =>
  Array.isArray((value as LocalViewerBuild).issues) && !('schemaVersion' in value)

/**
 * Compile once per source edit and retain the last valid result.
 *
 * Editors commonly save with a rename followed by several writes. Debouncing
 * keeps those intermediate states out of the UI, while retaining the last good
 * report means one temporarily invalid file never blanks the whole viewer.
 */
class LocalReportStore {
  private report?: ProductReport
  private serialized?: string
  private error?: string
  private issues: ModelIssue[] = []
  private builtAt: number | null = null
  private gitContext?: { key: string, body: unknown }
  private refs = ''
  private refPoll?: ReturnType<typeof setInterval>
  private statusKey = ''
  private revision = 0
  private timer?: ReturnType<typeof setTimeout>
  private watcher?: FSWatcher
  private indexWatcher?: (current: Stats, previous: Stats) => void
  private readonly listeners = new Set<(event: ReportEvent) => void>()

  constructor(private readonly options: LocalViewerOptions) {
    this.attach()
    if (options.initialReport) this.accept(options.initialReport, false)
    else this.refresh(false)
  }

  /**
   * Bind a model to a running viewer, or rebind one.
   *
   * A binding replaces the previous one whole: a field it omits is cleared, not
   * inherited, and the previous model's report is dropped, so a rebind that
   * fails to compile never serves the old model or authorizes its references.
   * The request handler reads the same options object, so the logo file and
   * asset root it serves follow the binding too.
   */
  bind(binding: LocalViewerBinding): void {
    this.detach()
    for (const key of BINDING_KEYS) (this.options as Record<string, unknown>)[key] = binding[key]
    this.report = undefined
    this.serialized = undefined
    this.error = undefined
    this.issues = []
    this.builtAt = null
    this.gitContext = undefined
    this.refs = ''
    this.attach()
    if (binding.initialReport) this.accept(binding.initialReport, true)
    else this.refresh(true)
  }

  private attach(): void {
    const options = this.options
    let forceNotify = false
    const schedule = (force = false) => {
      forceNotify ||= force
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => {
        const force = forceNotify
        forceNotify = false
        this.refresh(true, force)
      }, options.debounceMs ?? 180)
    }
    if (options.watchRoot) {
      this.watcher = watch(options.watchRoot, { recursive: true }, (_event, filename) => {
        if (!this.isModelSource(filename)) return
        schedule(this.isLogoSource(filename))
      })
      this.watcher.on('error', (error) => {
        const message = `File watching failed: ${error.message}. Restart ${cliCommand('view')} to follow edits again.`
        this.reject(message, [{ severity: 'error', message }])
      })
    }
    if (options.gitIndexFile) {
      // Git replaces its index atomically; stat polling follows replacements
      // and also handles an unborn repository whose index does not exist yet.
      this.indexWatcher = () => schedule()
      watchFile(options.gitIndexFile, { interval: 500, persistent: false }, this.indexWatcher)
    }
    if (options.history) {
      this.refs = options.history.revision()
      this.refPoll = setInterval(() => {
        const refs = this.options.history?.revision() ?? ''
        if (refs === this.refs) return
        this.refs = refs
        /* A picked base can move without changing where the reader stands, so a moved ref always says so. */
        this.refreshGit(true, true)
      }, REF_POLL_MS)
      this.refPoll.unref?.()
    }
  }

  private detach(): void {
    if (this.indexWatcher && this.options.gitIndexFile) {
      unwatchFile(this.options.gitIndexFile, this.indexWatcher)
    }
    this.indexWatcher = undefined
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.watcher?.close()
    this.watcher = undefined
    if (this.refPoll) clearInterval(this.refPoll)
    this.refPoll = undefined
  }

  history(): GitHistory | undefined {
    return this.options.history
  }

  /** Where the reader stands in Git, or undefined when this viewer has no history. */
  git(): unknown {
    if (this.options.history && !this.gitContext) this.refreshGit(false)
    return this.gitContext?.body
  }

  /**
   * Ask Git again where the reader stands. The stream says so only when
   * something the page would draw changed: a moved ref, a commit, a newly
   * staged file.
   */
  private refreshGit(notify: boolean, force = false): void {
    const history = this.options.history
    if (!history) { this.gitContext = undefined; return }
    let body: unknown
    try {
      body = history.context()
    } catch (error) {
      body = { error: (error as Error).message }
    }
    const key = JSON.stringify(body)
    if (key === this.gitContext?.key && !force) return
    this.gitContext = { key, body }
    if (!notify) return
    this.revision += 1
    this.emit({ type: 'git', revision: this.revision })
  }

  snapshot(): ReportSnapshot {
    return { report: this.report, error: this.error, revision: this.revision, state: this.state() }
  }

  private state(): LocalViewerState {
    if (!this.options.compile && !this.report) return 'waiting'
    if (this.error !== undefined) return this.report ? 'stale' : 'blocked'
    return this.issues.some(issue => issue.severity === 'error') ? 'degraded' : 'ready'
  }

  status(): LocalViewerStatus {
    return {
      state: this.state(),
      revision: this.revision,
      issues: this.issues,
      builtAt: this.report ? this.builtAt : null,
      request: this.issues.length && this.options.compile ? issuesAsRequest(this.issues) : null
    }
  }

  subscribe(listener: (event: ReportEvent) => void): () => void {
    this.listeners.add(listener)
    listener({ type: 'status', ...this.status() })
    return () => this.listeners.delete(listener)
  }

  refresh(notify = true, forceNotify = false): void {
    this.refreshGit(notify)
    const compile = this.options.compile
    if (!compile) {
      const message = this.options.waitingMessage ?? 'No Product Model is bound to this viewer yet.'
      this.reject(message, [{ severity: 'error', message }], notify)
      return
    }
    let build: LocalViewerBuild
    try {
      const outcome = compile()
      build = isBuild(outcome) ? outcome : { report: outcome, issues: [] }
    } catch (error) {
      const message = (error as Error).message
      this.reject(message, [failureIssue(message)], notify)
      return
    }
    if (build.report) this.accept(build.report, notify, forceNotify, build.issues)
    else {
      const errors = build.issues.filter(issue => issue.severity === 'error')
      this.reject(errors.map(issue => issue.file ? `${issue.file}: ${issue.message}` : issue.message).join('\n') || 'The Product Model could not be compiled.', build.issues, notify)
    }
  }

  close(): void {
    this.detach()
    this.listeners.clear()
  }

  private isModelSource(filename: string | Buffer | null): boolean {
    if (filename === null) return true
    const normalized = filename.toString().replaceAll('\\', '/')
    const top = normalized.split('/')[0]
    if (top === 'build' || top === 'cache') return false
    // macOS reports the watched directory's basename for some direct-child
    // changes when recursive mode is enabled, rather than the child filename.
    if (this.options.watchRoot && normalized === basename(this.options.watchRoot)) return true
    // Its presence is a lint error, so adding or removing the retired Coverage
    // file must refresh the report even when no Markdown changes.
    if (normalized === 'coverage.json') return true
    return /\.(?:md|ya?ml|svg)$/i.test(normalized)
  }

  private isLogoSource(filename: string | Buffer | null): boolean {
    if (filename === null) return true
    const normalized = filename.toString().replaceAll('\\', '/')
    return normalized === 'logo.svg'
      || normalized.endsWith('/logo.svg')
      || Boolean(this.options.watchRoot && normalized === basename(this.options.watchRoot))
  }

  private accept(report: ProductReport, notify: boolean, forceNotify = false, issues: ModelIssue[] = []): void {
    const serialized = JSON.stringify(report)
    const recovered = this.error !== undefined
    const changed = serialized !== this.serialized
    this.report = report
    this.serialized = serialized
    this.error = undefined
    this.issues = issues
    if (changed || recovered || this.builtAt === null) this.builtAt = Date.now()
    if (!notify) { this.statusKey = this.key(); return }
    if (changed || recovered || forceNotify) {
      this.revision += 1
      this.emit({ type: 'report', revision: this.revision })
    }
    this.announce()
  }

  private reject(message: string, issues: ModelIssue[], notify = true): void {
    this.error = message
    this.issues = issues
    if (!notify) { this.statusKey = this.key(); return }
    this.announce()
  }

  /** Say the status again only when what a reader would see changed. */
  private announce(): void {
    const key = this.key()
    if (key === this.statusKey) return
    this.statusKey = key
    this.revision += 1
    this.emit({ type: 'status', ...this.status() })
  }

  private key(): string {
    return JSON.stringify([this.state(), this.issues, this.report ? this.builtAt : null])
  }

  private emit(event: ReportEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

function securityHeaders(response: ServerResponse): void {
  response.setHeader('cache-control', 'no-store')
  response.setHeader(
    'content-security-policy',
    "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: http:; frame-src 'self'; manifest-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  )
  response.setHeader('cross-origin-resource-policy', 'same-origin')
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('x-frame-options', 'DENY')
}

function json(response: ServerResponse, status: number, value: unknown, head: boolean): void {
  const body = `${JSON.stringify(value)}\n`
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('content-length', Buffer.byteLength(body))
  response.end(head ? undefined : body)
}

function productLogo(response: ServerResponse, file: string | undefined, head: boolean): void {
  response.setHeader(
    'content-security-policy',
    "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'; sandbox"
  )
  if (!file) {
    json(response, 404, { message: 'This Product Model has no logo.' }, head)
    return
  }
  try {
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('The Product logo is not a regular file.')
    if (stat.size > MAX_PRODUCT_LOGO_BYTES) throw new Error('The Product logo is too large.')
    const body = readFileSync(file)
    const issues = validateProductLogo(body)
    if (issues.length) throw new Error(issues.join('; '))
    response.statusCode = 200
    response.setHeader('content-type', 'image/svg+xml; charset=utf-8')
    response.setHeader('content-length', body.byteLength)
    response.end(head ? undefined : body)
  } catch (error) {
    const message = (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'This Product Model has no logo.'
      : `The Product logo is invalid: ${(error as Error).message}`
    json(response, (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 422, { message }, head)
  }
}

function validHost(request: IncomingMessage, port: number): boolean {
  const host = request.headers.host?.toLowerCase()
  return host === `${LOOPBACK_HOST}:${port}` || host === `localhost:${port}`
}

/**
 * Whether a state-changing request comes from the report itself.
 *
 * The Host check stops DNS rebinding but not another page in the same browser
 * posting here; a browser always sends Origin on a cross-origin POST or
 * DELETE, so only the viewer's own origin may change anything.
 */
function sameOrigin(request: IncomingMessage, port: number): boolean {
  const origin = request.headers.origin?.toLowerCase()
  return origin === `http://${LOOPBACK_HOST}:${port}` || origin === `http://localhost:${port}`
}

/**
 * Read, add or remove the reader's star on pdd-kit.
 *
 * GET reports the state; POST stars and DELETE unstars. Neither takes input,
 * so the route can never touch anything but pdd-kit.
 */
function githubStar(
  request: IncomingMessage, response: ServerResponse, client: GithubStarClient, port: number, head: boolean
): void {
  if (request.method === 'POST' || request.method === 'DELETE') {
    if (!sameOrigin(request, port)) {
      json(response, 403, { message: 'Only the local report can star or unstar pdd-kit.' }, false)
      return
    }
    const starring = request.method === 'POST'
    const state: GithubStarState = starring ? 'starred' : 'not-starred'
    const failure = starring ? 'GitHub did not accept the star.' : 'GitHub did not remove the star.'
    void (starring ? client.star() : client.unstar()).then(
      () => { if (!response.destroyed) json(response, 200, { state }, false) },
      () => { if (!response.destroyed) json(response, 502, { message: failure }, false) }
    )
    return
  }
  void client.state().then(
    state => { if (!response.destroyed) json(response, 200, { state }, head) },
    () => { if (!response.destroyed) json(response, 200, { state: 'unavailable' }, head) }
  )
}

function staticFile(viewerRoot: string, pathname: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return undefined
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  const root = resolve(viewerRoot)
  const candidate = resolve(root, relative)
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined
  try {
    const stat = lstatSync(candidate)
    if (!stat.isFile() || stat.isSymbolicLink()) return undefined
  } catch {
    return undefined
  }
  return candidate
}

/**
 * Resolve one repository-relative asset request.
 *
 * Same traversal guard as the bundled viewer, plus an extension allowlist and a
 * size cap. Symlinks are refused so the mount cannot be pointed outside the
 * repository by something committed inside it.
 */
function assetFile(assetRoot: string, pathname: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname.slice(ASSET_PREFIX.length))
  } catch {
    return undefined
  }
  if (!decoded || decoded.startsWith('/')) return undefined
  const root = resolve(assetRoot)
  const candidate = resolve(root, decoded)
  if (!candidate.startsWith(`${root}${sep}`)) return undefined
  if (!(extname(candidate).toLowerCase() in ASSET_CONTENT_TYPES)) return undefined
  try {
    let part = root
    for (const segment of relative(root, candidate).split(sep)) {
      part = resolve(part, segment)
      if (lstatSync(part).isSymbolicLink()) return undefined
    }
    const stat = lstatSync(candidate)
    if (!stat.isFile() || stat.isSymbolicLink()) return undefined
    if (stat.size > MAX_ASSET_BYTES) return undefined
  } catch {
    return undefined
  }
  return candidate
}

function repositoryAsset(response: ServerResponse, file: string, head: boolean): void {
  const extension = extname(file).toLowerCase()
  const body = readFileSync(file)
  if (extension === '.svg') {
    const issues = validateProductLogo(body)
    if (issues.length) {
      json(response, 422, { message: `This SVG is not inert: ${issues.join('; ')}` }, head)
      return
    }
  }
  response.statusCode = 200
  if (extension === '.pdf') {
    response.setHeader('x-frame-options', 'SAMEORIGIN')
    response.setHeader('content-security-policy', "default-src 'none'; script-src 'none'; frame-ancestors 'self'")
  }
  response.setHeader('content-type', ASSET_CONTENT_TYPES[extension] ?? 'application/octet-stream')
  response.setHeader('content-length', body.byteLength)
  response.end(head ? undefined : body)
}

function referencePreview(
  request: IncomingMessage, response: ServerResponse, url: URL, head: boolean,
  preview: () => Promise<{ status: number, data: unknown }>
): void {
  // Direct browser visits open the same reader as references inside the report.
  if (request.headers.accept?.includes('text/html') && !request.headers.accept.includes('application/json')) {
    response.statusCode = 302
    response.setHeader('location', '/?f=' + encodeURIComponent(url.pathname + url.search + (url.pathname === CODE_PATH ? '#reference' : '')))
    response.end()
    return
  }
  void preview().then(result => {
    if (!response.destroyed) json(response, result.status, result.data, head)
  }).catch(() => {
    // Previews answer a missing or refused target with their own 404; a throw is
    // a server fault, and its raw text can carry absolute local paths.
    if (!response.destroyed) json(response, 500, { message: 'This reference could not be rendered.' }, head)
  })
}

/**
 * Serve Git's account of the model: where the reader stands, the versions
 * there are to compare, and one version's model. Every answer is read from
 * Git's objects; a version that does not resolve says why in its own words.
 */
function gitRoute(response: ServerResponse, store: LocalReportStore, pathname: string, url: URL, head: boolean): void {
  const history = store.history()
  if (!history) {
    json(response, 404, { message: 'This report is not in a Git repository.' }, head)
    return
  }
  try {
    if (pathname === GIT_CONTEXT_PATH) json(response, 200, store.git(), head)
    else if (pathname === GIT_VERSIONS_PATH) {
      json(response, 200, history.list(url.searchParams.get('q') ?? ''), head)
    } else {
      json(response, 200, history.model(url.searchParams.get('version') ?? ''), head)
    }
  } catch (error) {
    if (error instanceof GitVersionError) json(response, 404, { message: error.message }, head)
    else json(response, 500, { message: 'Git could not be read.' }, head)
  }
}

function requestHandler(
  options: LocalViewerOptions,
  store: LocalReportStore,
  streams: Set<ServerResponse>,
  port: number
) {
  const viewerRoot = options.viewerRoot ?? VIEWER_ROOT
  return (request: IncomingMessage, response: ServerResponse): void => {
    securityHeaders(response)
    const head = request.method === 'HEAD'
    if (!validHost(request, port)) {
      json(response, 403, { message: 'The local viewer accepts loopback requests only.' }, head)
      return
    }
    let url: URL
    try {
      url = new URL(request.url ?? '/', `http://${LOOPBACK_HOST}:${port}`)
    } catch {
      // A request target such as `//` is not a URL; answer it rather than crash.
      json(response, 400, { message: 'Bad request.' }, head)
      return
    }
    const pathname = url.pathname
    const methods = pathname === GITHUB_STAR_PATH
      ? ['GET', 'HEAD', 'POST', 'DELETE']
      : pathname === PREFERENCES_PATH ? ['GET', 'HEAD', 'PUT'] : ['GET', 'HEAD']
    if (!methods.includes(request.method ?? '')) {
      response.setHeader('allow', methods.join(', '))
      json(response, 405, { message: 'Method not allowed.' }, false)
      return
    }

    if (pathname === HEALTH_PATH) {
      json(response, 200, { ok: true }, head)
      return
    }
    if (pathname === REPORT_PATH) {
      const snapshot = store.snapshot()
      response.setHeader('x-pdd-kit-report-state', snapshot.state)
      if (!snapshot.report) json(response, 422, { message: snapshot.error }, head)
      else json(response, 200, snapshot.report, head)
      return
    }
    if (pathname === GIT_CONTEXT_PATH || pathname === GIT_VERSIONS_PATH || pathname === GIT_MODEL_PATH) {
      gitRoute(response, store, pathname, url, head)
      return
    }
    if (pathname === STATUS_PATH) {
      json(response, 200, store.status(), head)
      return
    }
    if (pathname === GITHUB_STAR_PATH) {
      githubStar(request, response, options.githubStar ?? ghStarClient, port, head)
      return
    }
    if (pathname === PREFERENCES_PATH) {
      viewerPreferencesRoute(request, response, options.preferencesFile, sameOrigin(request, port), head)
      return
    }
    if (pathname === LOGO_PATH) {
      productLogo(response, options.logoFile, head)
      return
    }
    if (pathname === CODE_PATH) {
      referencePreview(request, response, url, head, () => localCodePreview(store.snapshot().report, options.assetRoot, url.searchParams.get('target') ?? ''))
      return
    }
    if (pathname.startsWith(ASSET_PREFIX)) {
      const asset = options.assetRoot && assetFile(options.assetRoot, pathname)
      if (!asset) json(response, 404, { message: 'Not found.' }, head)
      else if (extname(asset).toLowerCase() === '.md' && url.searchParams.get('raw') !== '1') {
        referencePreview(request, response, url, head, () => localMarkdownPreview(options.assetRoot!, relative(options.assetRoot!, asset).split(sep).join('/')))
      }
      else repositoryAsset(response, asset, head)
      return
    }
    if (pathname === EVENTS_PATH) {
      if (head) {
        response.statusCode = 200
        response.setHeader('content-type', 'text/event-stream; charset=utf-8')
        response.end()
        return
      }
      response.statusCode = 200
      response.setHeader('content-type', 'text/event-stream; charset=utf-8')
      response.setHeader('connection', 'keep-alive')
      response.flushHeaders()
      response.write(': connected\n\n')
      streams.add(response)
      const unsubscribe = store.subscribe((event) => {
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
      })
      request.once('close', () => {
        unsubscribe()
        streams.delete(response)
      })
      return
    }

    const file = staticFile(viewerRoot, pathname)
      ?? (pathname.startsWith('/brand/') ? staticFile(BRAND_ROOT, pathname.slice('/brand/'.length)) : undefined)
    if (!file) {
      json(response, 404, { message: 'Not found.' }, head)
      return
    }
    const body = readFileSync(file)
    response.statusCode = 200
    response.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream')
    response.setHeader('content-length', body.byteLength)
    response.end(head ? undefined : body)
  }
}

export async function startLocalViewer(options: LocalViewerOptions): Promise<LocalViewer> {
  const requestedPort = options.port ?? 0
  const store = new LocalReportStore(options)
  const streams = new Set<ServerResponse>()
  return await new Promise((resolveViewer, reject) => {
    const server = createServer()
    const onStartError = (error: Error) => {
      store.close()
      reject(error)
    }
    server.once('error', onStartError)
    server.listen(requestedPort, LOOPBACK_HOST, () => {
      server.removeListener('error', onStartError)
      const address = server.address()
      if (!address || typeof address === 'string') {
        store.close()
        server.close()
        reject(new Error('The local viewer did not receive a TCP port.'))
        return
      }
      const port = address.port
      server.on('request', requestHandler(options, store, streams, port))
      resolveViewer({
        server,
        port,
        url: `http://${LOOPBACK_HOST}:${port}`,
        refresh: () => store.refresh(),
        status: () => {
          const snapshot = store.snapshot()
          return { ready: Boolean(snapshot.report), state: snapshot.state, error: snapshot.error }
        },
        bind: binding => store.bind(binding),
        close: () => new Promise<void>((resolveClose, rejectClose) => {
          store.close()
          for (const stream of streams) stream.end()
          streams.clear()
          server.close(error => error ? rejectClose(error) : resolveClose())
        })
      })
    })
  })
}

export function openBrowser(url: string): void {
  const command = process.platform === 'darwin'
    ? { file: 'open', args: [url] }
    : process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', url] }
      : { file: 'xdg-open', args: [url] }
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: 'ignore'
  })
  child.on('error', () => {})
  child.unref()
}
