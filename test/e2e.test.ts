import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildProject } from '../src/commands/export.js'
import { loadModel } from '../src/core/model.js'
import { lintModel } from '../src/commands/lint.js'
import { lsFiles } from '../src/core/git.js'
import { ProductReportSchema } from '../src/core/portable.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')

function sh(cwd: string, command: string, ...args: string[]): void {
  execFileSync(command, args, { cwd, stdio: 'pipe' })
}

let repo: string

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'pdd-kit-e2e-'))
  cpSync(FIXTURE, repo, { recursive: true })
  sh(repo, 'git', 'init', '--initial-branch=main')
  sh(repo, 'git', 'config', 'user.email', 'fixture@example.com')
  sh(repo, 'git', 'config', 'user.name', 'Fixture')
  sh(repo, 'git', 'remote', 'add', 'origin', 'https://github.com/example/fixture-shop.git')
  sh(repo, 'git', 'add', '.')
  sh(repo, 'git', 'commit', '-m', 'fixture')
})

afterAll(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('end to end on a real git repo', () => {
  it('lints the fixture against real git ls-files', () => {
    const result = lintModel(loadModel(repo), lsFiles(repo))
    expect(result.errors).toEqual([])
  })

  it('builds a schema-valid source-free report deterministically', () => {
    const first = buildProject(repo)
    const output = JSON.parse(readFileSync(first.outputFile, 'utf8'))
    const parsed = ProductReportSchema.parse(output)
    expect(parsed.id).toBe('fixture-shop')
    expect(parsed).toMatchObject({
      schemaVersion: '20.0.0',
      summary: 'Browse a product catalog, buy products, and manage the resulting orders.',
      category: 'commerce',
      authors: [{ name: 'pdd-kit' }],
      license: 'MIT'
    })
    expect(parsed.counts).toEqual({
      interfaces: 6,
      experiences: 3,
      screens: 7,
      domains: 1,
      entities: 10,
      capabilities: 9,
      capabilityScenarios: 19,
      journeys: 2,
      journeyScenarios: 4,
      businessRules: 14,
      variations: 10
    })
    // `capabilityIds` comes from the achieved Scenarios, the manual-confirmation
    // alternative included; `cancel-order` appears only in the not-achieved one,
    // so it is failure-only.
    expect(parsed.model.journeys[0]).toMatchObject({
      capabilityIds: ['browse-catalog', 'confirm-order', 'place-order', 'settle-payment'],
      failureOnlyCapabilityIds: ['cancel-order']
    })
    // An Actor is an Entity that acts; the wire says which of the two it is.
    expect(parsed.model.entities.find(item => item.id === 'payment-gateway')).toMatchObject({ kind: 'system', acts: 'external' })
    expect(parsed.model.entities.find(item => item.id === 'order')).toMatchObject({ kind: null, acts: null })
    expect(parsed.model.entities.find(item => item.id === 'order')?.informationKept[0]).toEqual({
      name: 'Items ordered', description: 'the quantity ordered of each product'
    })
    expect(parsed.model.businessRules.find(rule => rule.id === 'who-may-change-an-order')?.permits?.[0]).toEqual({
      actorIds: [],
      related: [{ verb: 'owns', entityId: 'shopper' }],
      self: false,
      when: [{ entityId: null, fact: null, state: 'Pending', operator: null, value: null }],
      unattended: false,
      configuredByEntityId: null
    })
    const screen = parsed.model.screens.find(item => item.id === 'customer-web::storefront::product-record')
    expect(screen).toMatchObject({
      capabilityIds: ['browse-catalog', 'place-order'],
      capabilityScenarioIds: ['browse-catalog', 'complete-checkout', 'complete-checkout-without-review', 'decline-checkout-payment', 'sell-the-last-available-unit'],
      journeyScenarioIds: ['browse-and-complete-checkout', 'browse-and-complete-checkout-with-manual-confirmation', 'buy-and-follow-the-order', 'cancel-an-order-before-fulfilment']
    })
    // A Screen names the facts on screen; the wire carries them by Entity.
    expect(screen?.entities.find(entry => entry.entityId === 'catalog-product')?.shows).toEqual(
      expect.arrayContaining(['Price'])
    )
    expect(parsed.model.capabilities.find(item => item.id === 'place-order')?.availability).toEqual([
      { placeId: 'customer-mobile::storefront' },
      { placeId: 'customer-web::storefront' }
    ])
    expect(screen?.entryPoints.map(point => point.path)).toEqual(['/products/:id'])
    expect(screen?.references).toEqual([{
      kind: 'visual',
      role: 'intent',
      target: 'https://example.com/designs/product-record',
      title: 'Product record visual reference'
    }])

    // Export produces a Blueprint with only portable references. The fixture's
    // model carries code references, but none survive the projection.
    expect(parsed.referenceProfile).toBe('portable')
    const references = [parsed.references, ...Object.values(parsed.model).map(entry =>
      Array.isArray(entry) ? entry.flatMap(item => item.references ?? []) : []
    )].flat()
    expect(references.some(reference => reference.kind === 'code')).toBe(false)
    expect(references.some(reference => reference.role === 'implementation')).toBe(false)
    expect(parsed.coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
    expect(parsed.model.businessRules.find(rule => rule.id === 'payment-before-confirmation')?.appliesTo)
      .toContainEqual({ type: 'entity', entityId: 'order', effect: 'changes', from: null, to: 'Confirmed', facts: [], contexts: [] })
    expect(parsed.model.capabilityScenarios.find(scenario => scenario.id === 'complete-checkout')?.decisionPoints)
      .toHaveLength(1)
    expect(parsed.model.journeyScenarios[0]!.steps.map(step => [step.text, step.capabilityId])).toEqual([
      ['The shopper finds and selects an available product', 'browse-catalog'],
      ['The shopper submits checkout', 'place-order'],
      ['The Product confirms the paid order', 'settle-payment']
    ])
    expect(JSON.stringify(parsed)).not.toContain('github.com/example/fixture-shop')

    const second = buildProject(repo)
    expect(JSON.stringify(second.report)).toBe(JSON.stringify(first.report))
  })

  it('builds a planned model tied to no code, with empty coverage and no status', () => {
    const isolated = mkdtempSync(join(tmpdir(), 'pdd-kit-e2e-planned-'))
    try {
      cpSync(FIXTURE, isolated, { recursive: true })
      writeFileSync(
        join(isolated, 'product-model/coverage.md'),
        `---
scope: ""
exclusions: []
method: ""
covered: []
unmapped: []
limitations: []
---

# Coverage
`
      )
      sh(isolated, 'git', 'init', '--initial-branch=main')
      sh(isolated, 'git', 'config', 'user.email', 'fixture@example.com')
      sh(isolated, 'git', 'config', 'user.name', 'Fixture')
      sh(isolated, 'git', 'remote', 'add', 'origin', 'https://github.com/example/fixture-shop.git')
      sh(isolated, 'git', 'add', '.')
      sh(isolated, 'git', 'commit', '-m', 'fixture')
      const { coverage } = buildProject(isolated).report
      expect(coverage).not.toHaveProperty('status')
      expect(coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
    } finally {
      rmSync(isolated, { recursive: true, force: true })
    }
  })

  it('build remains source-free and works with a dirty tracked worktree', () => {
    sh(repo, 'bash', '-c', 'echo "// dirty" >> src/models/order.ts')
    expect(buildProject(repo).report.id).toBe('fixture-shop')
    sh(repo, 'git', 'checkout', '--', 'src/models/order.ts')
  })

  it('build validates untracked authored product-model files without requiring publish provenance', () => {
    const untracked = join(repo, 'product-model/business-rules/uncommitted.md')
    mkdirSync(dirname(untracked), { recursive: true })
    writeFileSync(untracked, `---
appliesTo:
  - type: capability
    id: place-order
  - type: journey
    id: browse-and-buy
---

# Uncommitted rule

A model resource that does not exist at HEAD.
`)
    expect(buildProject(repo).report.model.businessRules.some(rule => rule.id === 'uncommitted')).toBe(true)
    unlinkSync(untracked)
  })

  it('refuses to overwrite a generated-output symlink', () => {
    const external = mkdtempSync(join(tmpdir(), 'pdd-kit-external-'))
    const target = join(external, 'do-not-overwrite.json')
    const output = join(repo, 'product-model/build/report.json')
    writeFileSync(target, 'keep me\n')
    rmSync(output, { force: true })
    symlinkSync(target, output)

    try {
      expect(() => buildProject(repo)).toThrow(/symbolic link/)
      expect(readFileSync(target, 'utf8')).toBe('keep me\n')
    } finally {
      rmSync(output, { force: true })
      rmSync(external, { recursive: true, force: true })
    }
  })

  it('refuses to traverse a generated-output directory symlink', () => {
    const external = mkdtempSync(join(tmpdir(), 'pdd-kit-external-dir-'))
    const buildDir = join(repo, 'product-model/build')
    rmSync(buildDir, { recursive: true, force: true })
    symlinkSync(external, buildDir)
    sh(repo, 'git', 'add', '--force', 'product-model/build')
    sh(repo, 'git', 'commit', '-m', 'track malicious generated-output symlink')

    try {
      expect(() => buildProject(repo)).toThrow(/symbolic link/)
      expect(() => readFileSync(join(external, 'report.json'), 'utf8')).toThrow()
    } finally {
      rmSync(buildDir, { recursive: true, force: true })
      rmSync(external, { recursive: true, force: true })
    }
  })
})
