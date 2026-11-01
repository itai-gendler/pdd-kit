import { execFileSync } from 'node:child_process'
import { request } from 'node:http'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createGitHistory } from '../src/core/git-history.js'
import { startLocalViewer, type LocalViewer, type LocalViewerBuild, type LocalViewerStatus } from '../src/core/local-viewer-server.js'
import type { GithubStarClient } from '../src/core/github-star.js'
import type { ProductReport } from '../src/core/portable.js'
import { compileReport } from '../src/commands/export.js'
import { loadModel } from '../src/core/model.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')

interface ResponseResult {
  body: string
  headers: Record<string, string | string[] | undefined>
  status: number
}

const ASYNC_TIMEOUT_MS = 4500
const WATCH_TEST_TIMEOUT_MS = 15_000
const WATCH_SETTLE_MS = 100

function get(url: string, path = '/', host?: string): Promise<ResponseResult> {
  const origin = new URL(url)
  return new Promise((resolve, reject) => {
    const outgoing = request({
      hostname: origin.hostname,
      port: origin.port,
      path,
      method: 'GET',
      headers: host ? { host } : undefined
    }, (incoming) => {
      const chunks: Buffer[] = []
      incoming.on('data', chunk => chunks.push(Buffer.from(chunk)))
      incoming.on('end', () => resolve({
        status: incoming.statusCode ?? 0,
        headers: incoming.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }))
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

function eventAfter(
  url: string,
  eventName: string,
  trigger: () => void,
  timeoutMs = ASYNC_TIMEOUT_MS
): Promise<string> {
  const origin = new URL(url)
  return new Promise((resolve, reject) => {
    let triggerTimer: ReturnType<typeof setTimeout> | undefined
    const timeout = setTimeout(() => {
      if (triggerTimer) clearTimeout(triggerTimer)
      reject(new Error(`Timed out waiting for ${eventName}`))
    }, timeoutMs)
    const outgoing = request({
      hostname: origin.hostname,
      port: origin.port,
      path: '/_pdd-kit/events',
      method: 'GET'
    }, (incoming) => {
      let body = ''
      let triggered = false
      let armed = false
      incoming.setEncoding('utf8')
      incoming.on('data', (chunk) => {
        body += chunk
        if (!triggered && body.includes(': connected\n\n')) {
          triggered = true
          triggerTimer = setTimeout(() => {
            body = ''
            armed = true
            try {
              trigger()
            } catch (error) {
              clearTimeout(timeout)
              reject(error)
            }
          }, WATCH_SETTLE_MS)
        }
        if (!armed || !body.includes(`event: ${eventName}\n`)) return
        clearTimeout(timeout)
        if (triggerTimer) clearTimeout(triggerTimer)
        incoming.destroy()
        resolve(body)
      })
    })
    outgoing.on('error', (error) => {
      clearTimeout(timeout)
      if (triggerTimer) clearTimeout(triggerTimer)
      reject(error)
    })
    outgoing.end()
  })
}

async function eventually<T>(
  read: () => Promise<T>,
  matches: (value: T) => boolean,
  timeoutMs = ASYNC_TIMEOUT_MS
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await read()
    if (matches(value)) return value
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw new Error('Timed out waiting for the local report to update.')
}

const viewers: LocalViewer[] = []
const directories: string[] = []

afterEach(async () => {
  await Promise.all(viewers.splice(0).map(viewer => viewer.close()))
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function staticViewer(): string {
  const directory = mkdtempSync(join(tmpdir(), 'pdd-kit-viewer-'))
  directories.push(directory)
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Local Product Model</title>')
  writeFileSync(join(directory, 'app.js'), 'globalThis.pddKit = true')
  writeFileSync(join(directory, 'site.webmanifest'), '{"name":"pdd-kit"}')
  return directory
}

function report(): ProductReport {
  return { id: 'fixture-shop', title: 'Fixture Shop' } as ProductReport
}

const logo = (color = '#80552b') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${color}"/></svg>`

describe('local Product Report server', () => {
  it('does not expose Git history or comparison endpoints', async () => {
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report })
    viewers.push(viewer)
    for (const path of ['history', 'history/defaults', 'history/diff?base=head&target=working', 'state?state=head', 'review/file?base=head&target=working&path=README.md']) {
      expect((await get(viewer.url, `/_pdd-kit/${path}`)).status).toBe(404)
    }
    expect((await get(viewer.url, '/_pdd-kit/report.json')).status).toBe(200)
    /* Git routes exist only for a model in Git. */
    for (const path of ['git/context.json', 'git/versions.json', 'git/model.json?version=head']) {
      expect((await get(viewer.url, `/_pdd-kit/${path}`)).status).toBe(404)
    }
  })

  it('serves the model\'s Git history and says when a ref moves', async () => {
    const repository = mkdtempSync(join(tmpdir(), 'pdd-kit-history-'))
    directories.push(repository)
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repository, stdio: 'pipe', encoding: 'utf8' }).trim()
    git('init', '--quiet', '--initial-branch=main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'Test')
    git('config', 'commit.gpgsign', 'false')
    cpSync(FIXTURE, repository, { recursive: true })
    git('add', '-A')
    git('commit', '--quiet', '-m', 'Map the shop')
    const commit = git('rev-parse', 'HEAD')

    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: report,
      assetRoot: repository,
      history: createGitHistory(repository, repository)
    })
    viewers.push(viewer)

    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/git/context.json')).body)).toMatchObject({ branch: 'main', head: { commit } })
    git('branch', 'release')
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/git/versions.json?q=rel')).body).versions).toMatchObject([{ id: 'branch:refs/heads/release' }])
    const model = JSON.parse((await get(viewer.url, '/_pdd-kit/git/model.json?version=head')).body)
    expect(model).toMatchObject({ state: 'ready', version: { commit } })
    expect(model.report.title).toBeTruthy()
    const missing = await get(viewer.url, '/_pdd-kit/git/model.json?version=branch:refs/heads/gone')
    expect(missing.status).toBe(404)
    expect(JSON.parse(missing.body)).toEqual({ message: 'gone no longer exists.' })

    /* A branch made elsewhere touches no watched file; the ref check notices it. */
    const moved = eventAfter(viewer.url, 'git', () => git('checkout', '--quiet', '-b', 'feature'), 6000)
    expect(await moved).toContain('event: git')
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/git/context.json')).body)).toMatchObject({ branch: 'feature' })

    /* A ref that moves without changing where the reader stands still says so: it may be the picked base. */
    const elsewhere = eventAfter(viewer.url, 'git', () => git('branch', 'elsewhere'), 6000)
    expect(await elsewhere).toContain('event: git')
  }, WATCH_TEST_TIMEOUT_MS)

  it('serves the static application and caches the compiled report', async () => {
    let compileCount = 0
    const root = staticViewer()
    const logoFile = join(root, 'logo.svg')
    writeFileSync(logoFile, logo())
    const viewer = await startLocalViewer({
      viewerRoot: root,
      logoFile,
      compile: () => {
        compileCount += 1
        return report()
      }
    })
    viewers.push(viewer)

    const page = await get(viewer.url)
    expect(page.status).toBe(200)
    expect(page.body).toContain('Local Product Model')
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(page.headers['cache-control']).toBe('no-store')
    expect(page.headers['content-security-policy']).toContain("default-src 'none'")

    const first = await get(viewer.url, '/_pdd-kit/report.json')
    const second = await get(viewer.url, '/_pdd-kit/report.json')
    expect(first.status).toBe(200)
    expect(JSON.parse(first.body)).toMatchObject({ id: 'fixture-shop' })
    expect(second.status).toBe(200)
    expect(compileCount).toBe(1)

    const health = await get(viewer.url, '/_pdd-kit/health')
    expect(health.status).toBe(200)
    expect(JSON.parse(health.body)).toEqual({ ok: true })

    const productLogo = await get(viewer.url, '/_pdd-kit/logo.svg')
    expect(productLogo.status).toBe(200)
    expect(productLogo.headers['content-type']).toBe('image/svg+xml; charset=utf-8')
    expect(productLogo.headers['content-security-policy']).toContain("script-src 'none'")
    expect(productLogo.headers['content-security-policy']).toContain('sandbox')
    expect(productLogo.body).toContain('<svg')

    const manifest = await get(viewer.url, '/site.webmanifest')
    expect(manifest.status).toBe(200)
    expect(manifest.headers['content-type']).toBe('application/manifest+json; charset=utf-8')
  })

  it('serves the shared packaged brand without duplicating it in the static viewer', async () => {
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report })
    viewers.push(viewer)
    const icon = await get(viewer.url, '/brand/icons/favicon.svg')
    expect(icon.status).toBe(200)
    expect(icon.headers['content-type']).toBe('image/svg+xml')
    expect(icon.body).toBe(readFileSync(new URL('../layers/nuxt/theme/public/brand/icons/favicon.svg', import.meta.url), 'utf8'))
    for (const path of ['/brand/missing.svg', '/brand/%2e%2e%2fnuxt.config.ts', '/brand/%ZZ']) {
      expect((await get(viewer.url, path)).status).toBe(404)
    }
  })

  it.each(['product.md', 'coverage.md'])('watches %s and announces a new report over server-sent events', { timeout: WATCH_TEST_TIMEOUT_MS }, async (filename) => {
    const model = mkdtempSync(join(tmpdir(), 'pdd-kit-model-'))
    directories.push(model)
    const product = join(model, filename)
    writeFileSync(product, 'First title')

    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      watchRoot: model,
      debounceMs: 10,
      compile: () => ({ ...report(), title: readFileSync(product, 'utf8') })
    })
    viewers.push(viewer)

    const [event, updated] = await Promise.all([
      eventAfter(
        viewer.url,
        'report',
        () => writeFileSync(product, 'Updated title'),
        WATCH_TEST_TIMEOUT_MS - 500
      ),
      eventually(
        () => get(viewer.url, '/_pdd-kit/report.json'),
        response => JSON.parse(response.body).title === 'Updated title',
        WATCH_TEST_TIMEOUT_MS - 500
      )
    ])

    expect(JSON.parse(updated.body).title).toBe('Updated title')
    expect(event).toMatch(/"revision":\d+/)
  })

  it('recovers when the retired Coverage file is removed and reports its return', { timeout: WATCH_TEST_TIMEOUT_MS * 2 }, async () => {
    const root = mkdtempSync(join(tmpdir(), 'pdd-kit-retired-coverage-'))
    directories.push(root)
    cpSync(FIXTURE, root, { recursive: true })
    const legacy = join(root, 'product-model', 'coverage.json')
    writeFileSync(legacy, '{}')
    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      watchRoot: join(root, 'product-model'),
      debounceMs: 10,
      compile: () => {
        const model = loadModel(root)
        if (model.issues.length) throw new Error(model.issues.join('\n'))
        return compileReport(model, '2026-09-21')
      }
    })
    viewers.push(viewer)
    expect(viewer.status().error).toContain('coverage.json is not supported')
    await eventAfter(viewer.url, 'report', () => rmSync(legacy), WATCH_TEST_TIMEOUT_MS - 500)
    expect(viewer.status()).toEqual({ ready: true, state: 'ready', error: undefined })
    await eventAfter(viewer.url, 'status', () => writeFileSync(legacy, '{}'), WATCH_TEST_TIMEOUT_MS - 500)
    expect(viewer.status().error).toContain('coverage.json is not supported')
  })

  it('announces a valid logo edit even when the semantic report is unchanged', { timeout: WATCH_TEST_TIMEOUT_MS }, async () => {
    const model = mkdtempSync(join(tmpdir(), 'pdd-kit-logo-model-'))
    directories.push(model)
    const logoFile = join(model, 'logo.svg')
    writeFileSync(logoFile, logo())

    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      watchRoot: model,
      logoFile,
      debounceMs: 10,
      compile: report
    })
    viewers.push(viewer)

    const event = eventAfter(
      viewer.url,
      'report',
      () => writeFileSync(logoFile, logo('#b8965c')),
      WATCH_TEST_TIMEOUT_MS - 500
    )
    expect(await event).toContain('event: report')
    expect((await get(viewer.url, '/_pdd-kit/logo.svg')).body).toContain('#b8965c')
  })

  it('keeps the last valid report while an edit has compile errors, then recovers', async () => {
    let invalid = false
    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: () => {
        if (invalid) throw new Error('Lint failed: missing actor')
        return report()
      }
    })
    viewers.push(viewer)

    invalid = true
    viewer.refresh()
    const stale = await get(viewer.url, '/_pdd-kit/report.json')
    expect(stale.status).toBe(200)
    expect(stale.headers['x-pdd-kit-report-state']).toBe('stale')
    expect(JSON.parse(stale.body).title).toBe('Fixture Shop')

    const recovery = eventAfter(viewer.url, 'report', () => {
      invalid = false
      viewer.refresh()
    })
    expect(await recovery).toContain('event: report')
    expect((await get(viewer.url, '/_pdd-kit/report.json')).headers['x-pdd-kit-report-state']).toBe('ready')
  })

  it('rejects non-loopback Host headers, traversal, and unsupported methods', async () => {
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report })
    viewers.push(viewer)

    expect((await get(viewer.url, '/', 'example.com')).status).toBe(403)
    expect((await get(viewer.url, '/%2e%2e%2foutside.txt')).status).toBe(404)

    const response = await fetch(viewer.url, { method: 'POST' })
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')

    // A request target that is not a URL is answered, never a crash.
    expect((await get(viewer.url, '//')).status).toBe(400)
    expect((await get(viewer.url)).status).toBe(200)
  })

  it('keeps display preferences in a file that only the report itself can change', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'pdd-kit-preferences-'))
    directories.push(directory)
    const preferencesFile = join(directory, 'pdd-kit', 'viewer-preferences.json')
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report, preferencesFile })
    viewers.push(viewer)
    const path = `${viewer.url}/_pdd-kit/preferences`
    const put = (body: unknown, headers: Record<string, string> = { origin: viewer.url, 'content-type': 'application/json' }) =>
      fetch(path, { method: 'PUT', headers, body: JSON.stringify(body) })

    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/preferences')).body)).toEqual({})

    const saved = await put({ 'pdd-kit:columns': { entity: 3 } })
    expect(saved.status).toBe(200)
    expect((await put({ 'pdd-kit:tooltips': 'off' })).status).toBe(200)
    expect((await put({ 'pdd-kit:changes': false })).status).toBe(200)
    expect((await put({ 'pdd-kit:changes': 'off' })).status).toBe(400)
    const expected = { 'pdd-kit:columns': { entity: 3 }, 'pdd-kit:tooltips': 'off', 'pdd-kit:changes': false }
    expect(JSON.parse(readFileSync(preferencesFile, 'utf8'))).toEqual(expected)
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/preferences')).body)).toEqual(expected)

    // Another page in the same browser cannot write the reader's file.
    for (const origin of [undefined, 'https://example.com', 'null']) {
      const headers: Record<string, string> = { 'content-type': 'application/json', ...(origin ? { origin } : {}) }
      expect((await put({ 'pdd-kit:tooltips': 'on' }, headers)).status).toBe(403)
    }
    // Only known keys, in known shapes, as JSON, and small.
    expect((await put({ 'pdd-kit:anything': 1 })).status).toBe(400)
    expect((await put({ 'pdd-kit:columns': { entity: 9 } })).status).toBe(400)
    expect((await put(['pdd-kit:tooltips'])).status).toBe(400)
    expect((await put({ 'pdd-kit:tooltips': 'on' }, { origin: viewer.url, 'content-type': 'text/plain' })).status).toBe(415)
    expect((await put({ 'pdd-kit:columns': Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`k${index}`, 1])) })).status).toBe(413)
    expect(JSON.parse(readFileSync(preferencesFile, 'utf8'))).toEqual(expected)

    // A file edited by hand keeps only what this version accepts.
    writeFileSync(preferencesFile, JSON.stringify({ ...expected, 'pdd-kit:resource-expanded': 'yes', other: true }))
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/preferences')).body)).toEqual(expected)
  })

  it('leaves preferences to the browser when no file is given', async () => {
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report })
    viewers.push(viewer)
    expect((await get(viewer.url, '/_pdd-kit/preferences')).status).toBe(404)
  })

  it('reports, adds and removes the GitHub star only from the report itself', async () => {
    let starred = false
    let fail = false
    const githubStar: GithubStarClient = {
      state: async () => starred ? 'starred' : 'not-starred',
      star: async () => {
        if (fail) throw new Error('offline')
        starred = true
      },
      unstar: async () => {
        if (fail) throw new Error('offline')
        starred = false
      }
    }
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report, githubStar })
    viewers.push(viewer)
    const path = `${viewer.url}/_pdd-kit/github-star`

    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/github-star')).body)).toEqual({ state: 'not-starred' })

    // Another page in the same browser cannot star on the reader's behalf.
    for (const headers of [{}, { origin: 'https://example.com' }, { origin: 'null' }] as Record<string, string>[]) {
      expect((await fetch(path, { method: 'POST', headers })).status).toBe(403)
    }
    expect(starred).toBe(false)

    fail = true
    expect((await fetch(path, { method: 'POST', headers: { origin: viewer.url } })).status).toBe(502)
    expect(starred).toBe(false)

    fail = false
    const accepted = await fetch(path, { method: 'POST', headers: { origin: viewer.url } })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toEqual({ state: 'starred' })
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/github-star')).body)).toEqual({ state: 'starred' })

    // Nor can it unstar.
    for (const headers of [{}, { origin: 'https://example.com' }, { origin: 'null' }] as Record<string, string>[]) {
      expect((await fetch(path, { method: 'DELETE', headers })).status).toBe(403)
    }
    expect(starred).toBe(true)

    fail = true
    expect((await fetch(path, { method: 'DELETE', headers: { origin: viewer.url } })).status).toBe(502)
    expect(starred).toBe(true)

    fail = false
    const removed = await fetch(path, { method: 'DELETE', headers: { origin: viewer.url } })
    expect(removed.status).toBe(200)
    expect(await removed.json()).toEqual({ state: 'not-starred' })
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/github-star')).body)).toEqual({ state: 'not-starred' })

    const unsupported = await fetch(path, { method: 'PUT', headers: { origin: viewer.url } })
    expect(unsupported.status).toBe(405)
    expect(unsupported.headers.get('allow')).toBe('GET, HEAD, POST, DELETE')
  })

  it('reports the GitHub star as unavailable when gh cannot answer', async () => {
    const githubStar: GithubStarClient = {
      state: async () => { throw new Error('gh exploded') },
      star: async () => {},
      unstar: async () => {}
    }
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report, githubStar })
    viewers.push(viewer)
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/github-star')).body)).toEqual({ state: 'unavailable' })
  })

  it('drops the previous model on rebind, even when the new one does not compile', async () => {
    const repository = mkdtempSync(join(tmpdir(), 'pdd-kit-rebind-'))
    directories.push(repository)
    writeFileSync(join(repository, 'notes.md'), '# Notes')
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report, assetRoot: repository })
    viewers.push(viewer)
    expect((await get(viewer.url, '/_pdd-kit/report.json')).status).toBe(200)
    expect((await get(viewer.url, '/_pdd-kit/file/notes.md')).status).toBe(200)

    viewer.bind({ compile: () => { throw new Error('Lint failed: missing actor') } })
    const rebound = await get(viewer.url, '/_pdd-kit/report.json')
    expect(rebound.status).toBe(422)
    expect(JSON.parse(rebound.body)).toEqual({ message: 'Lint failed: missing actor' })
    // An omitted asset root is cleared, not inherited from the old binding.
    expect((await get(viewer.url, '/_pdd-kit/file/notes.md')).status).toBe(404)
  })

  it('serves repository assets from the mount, and refuses everything else', async () => {
    const repository = mkdtempSync(join(tmpdir(), 'pdd-kit-repo-'))
    directories.push(repository)
    mkdirSync(join(repository, 'docs'), { recursive: true })
    writeFileSync(join(repository, 'docs', 'mockup.png'), Buffer.from('89504e470d0a1a0a', 'hex'))
    writeFileSync(join(repository, 'docs', 'notes.md'), '# Notes')
    writeFileSync(join(repository, 'secrets.env'), 'TOKEN=nope')
    writeFileSync(join(repository, 'app.ts'), 'export const x = 1')

    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: report,
      assetRoot: repository
    })
    viewers.push(viewer)

    const png = await get(viewer.url, '/_pdd-kit/file/docs/mockup.png')
    expect(png.status).toBe(200)
    expect(png.headers['content-type']).toBe('image/png')

    const markdown = await get(viewer.url, '/_pdd-kit/file/docs/notes.md')
    expect(markdown.status).toBe(200)
    expect(markdown.headers['content-type']).toContain('application/json')
    expect(JSON.parse(markdown.body)).toMatchObject({ kind: 'markdown', document: { nodes: [['h1', { id: 'notes' }, 'Notes']] } })
    expect((await get(viewer.url, '/_pdd-kit/file/docs/notes.md?raw=1')).body).toBe('# Notes')

    // Not on the allowlist: refused whether or not it exists, so the mount
    // cannot be used to probe for files.
    expect((await get(viewer.url, '/_pdd-kit/file/secrets.env')).status).toBe(404)
    expect((await get(viewer.url, '/_pdd-kit/file/app.ts')).status).toBe(404)
    expect((await get(viewer.url, '/_pdd-kit/file/docs/absent.png')).status).toBe(404)

    // Traversal, encoded traversal, and absolute paths stay inside the root.
    expect((await get(viewer.url, '/_pdd-kit/file/../../etc/passwd')).status).toBe(404)
    expect((await get(viewer.url, '/_pdd-kit/file/%2e%2e%2f%2e%2e%2fetc%2fpasswd')).status).toBe(404)
    expect((await get(viewer.url, '/_pdd-kit/file//etc/passwd')).status).toBe(404)
  })

  it('rejects an SVG asset that is not inert', async () => {
    const repository = mkdtempSync(join(tmpdir(), 'pdd-kit-repo-'))
    directories.push(repository)
    writeFileSync(join(repository, 'safe.svg'), logo())
    writeFileSync(
      join(repository, 'active.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><script>alert(1)</script></svg>'
    )

    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: report,
      assetRoot: repository
    })
    viewers.push(viewer)

    expect((await get(viewer.url, '/_pdd-kit/file/safe.svg')).status).toBe(200)
    expect((await get(viewer.url, '/_pdd-kit/file/active.svg')).status).toBe(422)
  })

  it('serves no repository asset when no asset root is configured', async () => {
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: report })
    viewers.push(viewer)
    expect((await get(viewer.url, '/_pdd-kit/file/package.json')).status).toBe(404)
  })

  it('starts with no model, says so, and comes alive when one is bound', { timeout: WATCH_TEST_TIMEOUT_MS }, async () => {
    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      waitingMessage: 'No Product Model yet. Waiting for product-model/ to be created.'
    })
    viewers.push(viewer)

    expect(viewer.status()).toEqual({ ready: false, state: 'waiting', error: 'No Product Model yet. Waiting for product-model/ to be created.' })
    const waiting = await get(viewer.url, '/_pdd-kit/report.json')
    expect(waiting.status).toBe(422)
    expect(JSON.parse(waiting.body).message).toContain('Waiting for product-model/')
    expect((await get(viewer.url)).status).toBe(200)

    const model = mkdtempSync(join(tmpdir(), 'pdd-kit-late-model-'))
    directories.push(model)
    const product = join(model, 'product.md')
    writeFileSync(product, 'Bound title')
    const bound = await eventAfter(viewer.url, 'report', () => {
      viewer.bind({
        watchRoot: model,
        compile: () => ({ ...report(), title: readFileSync(product, 'utf8') })
      })
    })
    expect(bound).toContain('event: report')
    expect(viewer.status().ready).toBe(true)
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/report.json')).body).title).toBe('Bound title')

    // The binding's watcher is live: a later save recompiles as usual.
    const edited = eventAfter(viewer.url, 'report', () => writeFileSync(product, 'Edited after binding'), WATCH_TEST_TIMEOUT_MS - 500)
    expect(await edited).toContain('event: report')
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/report.json')).body).title).toBe('Edited after binding')
  })

  it('serves a report that builds with errors beside it, keeps it when the model stops building, and says so', async () => {
    let outcome: LocalViewerBuild = {
      report: report(),
      issues: [{ severity: 'error', message: 'README.md is missing', file: 'README.md' }]
    }
    const viewer = await startLocalViewer({ viewerRoot: staticViewer(), compile: () => outcome })
    viewers.push(viewer)

    const degraded = await get(viewer.url, '/_pdd-kit/report.json')
    expect(degraded.status).toBe(200)
    expect(degraded.headers['x-pdd-kit-report-state']).toBe('degraded')
    const first = JSON.parse((await get(viewer.url, '/_pdd-kit/status.json')).body) as LocalViewerStatus
    expect(first).toMatchObject({ state: 'degraded', issues: outcome.issues })
    expect(first.builtAt).toEqual(expect.any(Number))
    expect(first.request).toContain('- README.md is missing')

    const broken = { severity: 'error' as const, message: 'References missing domain "orderng"', file: 'capabilities/place-order/capability.md' }
    const status = eventAfter(viewer.url, 'status', () => {
      outcome = { issues: [broken] }
      viewer.refresh()
    })
    expect(await status).toContain('"state":"stale"')
    const stale = await get(viewer.url, '/_pdd-kit/report.json')
    expect(stale.status).toBe(200)
    expect(stale.headers['x-pdd-kit-report-state']).toBe('stale')
    const second = JSON.parse((await get(viewer.url, '/_pdd-kit/status.json')).body) as LocalViewerStatus
    expect(second).toMatchObject({ state: 'stale', issues: [broken], builtAt: first.builtAt })
  })

  it('has nothing to serve when the first build is refused', async () => {
    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: () => ({ issues: [{ severity: 'error', message: 'References missing domain "orderng"' }] })
    })
    viewers.push(viewer)
    const response = await get(viewer.url, '/_pdd-kit/report.json')
    expect(response.status).toBe(422)
    expect(response.headers['x-pdd-kit-report-state']).toBe('blocked')
    expect(JSON.parse((await get(viewer.url, '/_pdd-kit/status.json')).body)).toMatchObject({ state: 'blocked', builtAt: null })
  })

  it('returns a safe compile error without stopping the viewer', async () => {
    const viewer = await startLocalViewer({
      viewerRoot: staticViewer(),
      compile: () => { throw new Error('Lint failed: missing actor') }
    })
    viewers.push(viewer)

    const response = await get(viewer.url, '/_pdd-kit/report.json')
    expect(response.status).toBe(422)
    expect(JSON.parse(response.body)).toEqual({ message: 'Lint failed: missing actor' })
    expect((await get(viewer.url)).status).toBe(200)
  })

})
