import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { runView } from '../src/commands/view.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')
const snapshot = vi.hoisted(() => ({ root: '' }))

// A fetched revision without the network: the fixture stands in for the checkout.
vi.mock('../src/core/github-repository.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/core/github-repository.js')>(),
  fetchGithubSnapshot: () => ({ root: snapshot.root, commit: '0123456789abcdef', dispose: () => {} })
}))

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(snapshot.root, { recursive: true, force: true })
})

function revision(): string {
  snapshot.root = mkdtempSync(join(tmpdir(), 'pdd-kit-view-snapshot-'))
  cpSync(FIXTURE, snapshot.root, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: snapshot.root })
  execFileSync('git', ['add', '-A'], { cwd: snapshot.root })
  return snapshot.root
}

function captured() {
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((line: string) => { lines.push(line) })
  vi.spyOn(console, 'error').mockImplementation((line: string) => { lines.push(line) })
  return lines
}

it('opens a pull request whose model has lint errors, listing them beside the report', async () => {
  unlinkSync(join(revision(), 'product-model', 'README.md'))
  const lines = captured()
  const exit = runView(process.cwd(), { open: false, repository: 'example/fixture-shop', pr: 12 })
  await expect.poll(() => lines.join('\n'), { timeout: 15_000 }).toContain('Press Ctrl+C to stop.')
  const url = lines.join('\n').match(/http:\/\/127\.0\.0\.1:\d+/)![0]
  const response = await fetch(`${url}/_pdd-kit/report.json`)
  expect(response.status).toBe(200)
  expect(response.headers.get('x-pdd-kit-report-state')).toBe('degraded')
  expect(lines).toContain('The Product Model has lint errors; the report shows them beside the model.')
  process.emit('SIGTERM')
  expect(await exit).toBe(0)
})

it('stops on a pull request whose model does not build, since it never changes', async () => {
  const capability = join(revision(), 'product-model', 'capabilities', 'place-order', 'capability.md')
  writeFileSync(capability, readFileSync(capability, 'utf8').replace('domain: ordering', 'domain: orderng'))
  const lines = captured()
  expect(await runView(process.cwd(), { open: false, repository: 'example/fixture-shop', pr: 12 })).toBe(1)
  expect(lines.join('\n')).toMatch(/^The Product Model does not build:\n/m)
  expect(lines.join('\n')).not.toContain('Viewing ')
})
