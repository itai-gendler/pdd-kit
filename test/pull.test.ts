import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildProject } from '../src/commands/export.js'
import { runPull } from '../src/commands/pull.js'
import { projectPortableReport } from '../src/core/portable.js'
import { reportDigest } from '../src/core/report-digest.js'
import { MODEL_README } from '../src/core/model-readme.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')
const temporaryDirectories: string[] = []

let report: Record<string, unknown>
let logo: Buffer
const cover = readFileSync(join(__dirname, '../blueprints/kanban-board/product-model/product/cover.webp'))

function temporary(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function initialize(cwd: string): void {
  execFileSync('git', ['init', '--initial-branch=main'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.email', 'fixture@example.com'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['add', '.'], { cwd, stdio: 'pipe' })
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd, stdio: 'pipe' })
}

const RELEASE = 'https://github.com/itai-gendler/pdd-kit/releases/download/blueprints-v20/'

function indexFor(overrides: Record<string, unknown> = {}, digest = reportDigest(report)) {
  return {
    reportVersion: '20',
    commit: 'a'.repeat(40),
    blueprints: [{
      slug: 'fixture-shop',
      title: 'Fixture Shop',
      summary: 'A fixture.',
      report: 'fixture-shop.json',
      digest,
      logo: 'fixture-shop.logo.svg',
      cover: 'fixture-shop.cover.webp',
      ...overrides
    }]
  }
}

/** A fake release: file name → response factory. Unknown files answer 404. */
function release(
  files: Record<string, () => Response> = {},
  urls: string[] = []
): typeof globalThis.fetch {
  const defaults: Record<string, () => Response> = {
    'index.json': () => Response.json(indexFor()),
    'fixture-shop.json': () => new Response(JSON.stringify(report)),
    'fixture-shop.logo.svg': () => new Response(logo),
    'fixture-shop.cover.webp': () => new Response(cover)
  }
  return vi.fn(async (url: string) => {
    urls.push(String(url))
    const file = decodeURIComponent(String(url).split('/').pop()!)
    const answer = { ...defaults, ...files }[file]
    return answer ? answer() : new Response('Not Found', { status: 404 })
  }) as unknown as typeof globalThis.fetch
}

beforeAll(() => {
  const source = temporary('pdd-kit-pull-source-')
  cpSync(FIXTURE, source, { recursive: true })
  initialize(source)
  report = projectPortableReport(buildProject(source).report) as unknown as Record<string, unknown>
  logo = readFileSync(join(source, 'product-model', 'product', 'logo.svg'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(() => {
  let directory = temporaryDirectories.pop()
  while (directory) {
    rmSync(directory, { recursive: true, force: true })
    directory = temporaryDirectories.pop()
  }
})

describe('pull', () => {
  it('pulls anonymously from the Blueprint release and expands the model', async () => {
    const target = temporary('pdd-kit-pull-target-')
    const urls: string[] = []
    let headers: Record<string, string> = {}
    const fetch = release({}, urls)
    const wrapped = vi.fn(async (url: string, init: RequestInit) => {
      if (String(url).endsWith('/fixture-shop.json')) headers = init.headers as Record<string, string>
      return fetch(url, init)
    }) as unknown as typeof globalThis.fetch

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch: wrapped, env: {} })).toBe(0)

    expect(urls).toEqual([
      `${RELEASE}index.json`,
      `${RELEASE}fixture-shop.json`,
      `${RELEASE}fixture-shop.logo.svg`,
      `${RELEASE}fixture-shop.cover.webp`
    ])
    // No credential is read, sent, or required.
    expect(headers.authorization).toBeUndefined()
    expect(headers['user-agent']).toMatch(/^pdd-kit\//)
    expect(existsSync(join(target, 'product-model/product/product.md'))).toBe(true)
    expect(existsSync(join(
      target,
      'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md'
    ))).toBe(true)
    expect(readFileSync(join(target, 'product-model/product/logo.svg'))).toEqual(logo)
    expect(readFileSync(join(target, 'product-model/product/cover.webp'))).toEqual(cover)
  })

  it('skips a missing or invalid cover, and asks for none without a logo', async () => {
    const missing = temporary('pdd-kit-pull-no-cover-')
    const fetchMissing = release({ 'fixture-shop.cover.webp': () => new Response('', { status: 404 }) })
    expect(await runPull(missing, 'fixture-shop', { force: false }, { fetch: fetchMissing, env: {} })).toBe(0)
    expect(existsSync(join(missing, 'product-model/product/logo.svg'))).toBe(true)
    expect(existsSync(join(missing, 'product-model/product/cover.webp'))).toBe(false)

    const invalid = temporary('pdd-kit-pull-bad-cover-')
    const fetchInvalid = release({ 'fixture-shop.cover.webp': () => new Response('<svg/>') })
    expect(await runPull(invalid, 'fixture-shop', { force: false }, { fetch: fetchInvalid, env: {} })).toBe(0)
    expect(existsSync(join(invalid, 'product-model/product/cover.webp'))).toBe(false)

    const urls: string[] = []
    const noLogo = temporary('pdd-kit-pull-cover-without-logo-')
    const fetchNoLogo = release({ 'fixture-shop.logo.svg': () => new Response('', { status: 404 }) }, urls)
    expect(await runPull(noLogo, 'fixture-shop', { force: false }, { fetch: fetchNoLogo, env: {} })).toBe(0)
    expect(urls.some(url => url.endsWith('.cover.webp'))).toBe(false)
  })

  it('does not require a logo', async () => {
    const target = temporary('pdd-kit-pull-no-logo-')
    const urls: string[] = []
    const fetch = release({ 'index.json': () => Response.json(indexFor({ logo: null, cover: null })) }, urls)

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(0)
    expect(urls.some(url => url.endsWith('.svg'))).toBe(false)
    expect(existsSync(join(target, 'product-model/product.md'))).toBe(true)
    expect(existsSync(join(target, 'product-model/product'))).toBe(false)
  })

  it('writes a model README telling an agent to build the product', async () => {
    const target = temporary('pdd-kit-pull-readme-')

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch: release(), env: {} })).toBe(0)

    const readme = readFileSync(join(target, 'product-model', 'README.md'), 'utf8')
    expect(readme).toBe(MODEL_README)
    expect(readme).toContain('**To implement it**')
    expect(readme).toContain('do not run the check unless asked')
    expect(existsSync(join(target, 'AGENTS.md'))).toBe(false)
  })

  it('pulls from the repository PDD_KIT_BLUEPRINT_REPOSITORY names', async () => {
    const target = temporary('pdd-kit-pull-fork-')
    const urls: string[] = []

    expect(await runPull(target, 'fixture-shop', { force: false }, {
      fetch: release({}, urls),
      env: { PDD_KIT_BLUEPRINT_REPOSITORY: 'someone/fork' }
    })).toBe(0)
    expect(urls[0]).toBe('https://github.com/someone/fork/releases/download/blueprints-v20/index.json')
  })

  it('refuses a repository that is not an owner/repo pair', async () => {
    const target = temporary('pdd-kit-pull-bad-repo-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetch = vi.fn() as unknown as typeof globalThis.fetch

    expect(await runPull(target, 'fixture-shop', { force: false }, {
      fetch,
      env: { PDD_KIT_BLUEPRINT_REPOSITORY: 'https://example.com/x' }
    })).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('names an unknown Blueprint and points at list', async () => {
    const target = temporary('pdd-kit-pull-unknown-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((message: string) => { errors.push(message) })

    expect(await runPull(target, 'not-published', { force: false }, { fetch: release(), env: {} })).toBe(1)
    expect(errors[0]).toContain('No Blueprint is named not-published')
    expect(errors[0]).toContain('blueprint list')
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('says when the repository publishes no Blueprints for this report version', async () => {
    const target = temporary('pdd-kit-pull-no-release-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((message: string) => { errors.push(message) })
    const fetch = release({ 'index.json': () => new Response('Not Found', { status: 404 }) })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(errors[0]).toBe('itai-gendler/pdd-kit publishes no Blueprints for Product Report version 20.')
  })

  it('refuses an index for another report version, in one sentence', async () => {
    const target = temporary('pdd-kit-pull-index-version-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })
    const fetch = release({ 'index.json': () => Response.json({ ...indexFor(), reportVersion: '11' }) })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(errors[0]).toBe('The Blueprint index lists Product Report version 11; this CLI reads version 20 only.')
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('refuses an index that does not have the expected shape', async () => {
    const target = temporary('pdd-kit-pull-bad-index-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })
    const fetch = release({ 'index.json': () => Response.json(indexFor({ report: '../escape.json' })) })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(errors[0]).toBe('The Blueprint index does not have the expected shape.')
  })

  it('refuses a report whose digest does not match the index', async () => {
    const target = temporary('pdd-kit-pull-digest-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetch = release({ 'index.json': () => Response.json(indexFor({}, 'a'.repeat(64))) })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('names the schema version of a report it cannot read, in one sentence', async () => {
    const target = temporary('pdd-kit-pull-old-report-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })
    const stale = { ...report, schemaVersion: '12.0.0' }
    const fetch = release({
      'index.json': () => Response.json(indexFor({}, reportDigest(stale))),
      'fixture-shop.json': () => new Response(JSON.stringify(stale))
    })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(errors[0]).toBe('This is a Product Report of schema version 12.0.0; only 20.0.0 is accepted, and there is no compatibility reader. Export it again with a current pdd-kit.')
  })

  it('refuses a report published for a different Blueprint', async () => {
    const target = temporary('pdd-kit-pull-mismatch-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const other = { ...report, id: 'something-else' }
    const fetch = release({
      'index.json': () => Response.json(indexFor({}, reportDigest(other))),
      'fixture-shop.json': () => new Response(JSON.stringify(other))
    })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('refuses a download redirected away from HTTPS', async () => {
    const target = temporary('pdd-kit-pull-redirect-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })
    const fetch = vi.fn(async () => {
      const response = Response.json(indexFor())
      Object.defineProperty(response, 'url', { value: 'http://elsewhere.example.com/index.json' })
      return response
    }) as unknown as typeof globalThis.fetch

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(errors[0]).toContain('away from HTTPS')
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('refuses a body over the 8 MiB safety limit', async () => {
    const target = temporary('pdd-kit-pull-oversized-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetch = release({
      'fixture-shop.json': () => new Response(JSON.stringify(report), {
        headers: { 'content-length': String(9 * 1024 * 1024) }
      })
    })

    expect(await runPull(target, 'fixture-shop', { force: false }, { fetch, env: {} })).toBe(1)
    expect(existsSync(join(target, 'product-model'))).toBe(false)
  })

  it('rejects a name that is not a canonical slug', async () => {
    const target = temporary('pdd-kit-pull-name-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetch = vi.fn() as unknown as typeof globalThis.fetch

    expect(await runPull(target, 'Not A Slug', { force: false }, { fetch, env: {} })).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })
})
