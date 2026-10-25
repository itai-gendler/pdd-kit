import { afterEach, describe, expect, it, vi } from 'vitest'
import { runList } from '../src/commands/list.js'

function entry(slug: string, title: string) {
  return {
    slug,
    title,
    summary: `${title}.`,
    report: `${slug}.json`,
    digest: 'a'.repeat(64),
    logo: null,
    cover: null
  }
}

function serving(index: unknown, urls: string[] = []): typeof globalThis.fetch {
  return vi.fn(async (url: string) => {
    urls.push(String(url))
    return Response.json(index)
  }) as unknown as typeof globalThis.fetch
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('list', () => {
  it('prints every published Blueprint by its pull name, sorted', async () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((message: string) => { lines.push(message) })
    const urls: string[] = []
    const fetch = serving({
      reportVersion: '20',
      commit: 'a'.repeat(40),
      blueprints: [entry('url-shortener', 'URL Shortener'), entry('kanban-board', 'Kanban Board')]
    }, urls)

    expect(await runList({ fetch, env: {} })).toBe(0)
    expect(urls).toEqual(['https://github.com/itai-gendler/pdd-kit/releases/download/blueprints-v20/index.json'])
    expect(lines.slice(0, 2)).toEqual(['kanban-board   Kanban Board', 'url-shortener  URL Shortener'])
    expect(lines.join('\n')).toContain('pdd-kit blueprint pull <name>')
  })

  it('says so when nothing is published yet', async () => {
    const lines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((message: string) => { lines.push(message) })
    const fetch = serving({ reportVersion: '20', commit: 'a'.repeat(40), blueprints: [] })

    expect(await runList({ fetch, env: {} })).toBe(0)
    expect(lines).toEqual(['No Blueprints are published yet.'])
  })

  it('fails when the index cannot be read', async () => {
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((message: string) => { errors.push(message) })
    const fetch = vi.fn(async () => new Response('', { status: 500 })) as unknown as typeof globalThis.fetch

    expect(await runList({ fetch, env: {} })).toBe(1)
    expect(errors[0]).toBe('The Blueprint download failed with status 500.')
  })

  it('refuses a repository that is not an owner/repo pair', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetch = vi.fn() as unknown as typeof globalThis.fetch

    expect(await runList({ fetch, env: { PDD_KIT_BLUEPRINT_REPOSITORY: 'nope' } })).toBe(2)
    expect(fetch).not.toHaveBeenCalled()
  })
})
