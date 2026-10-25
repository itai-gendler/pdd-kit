import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildProject } from '../src/commands/export.js'
import { runOpen } from '../src/commands/open.js'
import { lsFiles } from '../src/core/git.js'
import { loadModel } from '../src/core/model.js'
import { MODEL_README } from '../src/core/model-readme.js'
import { projectPortableReport, type ProductReport } from '../src/core/portable.js'
import { lintModel } from '../src/commands/lint.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'pipe' })
}

function initialize(cwd: string): void {
  git(cwd, 'init', '--initial-branch=main')
  git(cwd, 'config', 'user.email', 'fixture@example.com')
  git(cwd, 'config', 'user.name', 'Fixture')
  git(cwd, 'remote', 'add', 'origin', 'https://github.com/example/fixture-shop.git')
  git(cwd, 'add', '.')
  git(cwd, 'commit', '--allow-empty', '-m', 'fixture')
}

function withoutRepositoryEvidence(report: ProductReport): Record<string, any> {
  const portable = projectPortableReport(report)
  return {
    ...portable,
    generatedAt: '<date>',
    generator: { ...portable.generator, version: '<version>' },
    coverage: '<repository-specific>'
  }
}

let source: string
let target: string

beforeAll(() => {
  source = mkdtempSync(join(tmpdir(), 'pdd-kit-open-source-'))
  target = mkdtempSync(join(tmpdir(), 'pdd-kit-open-target-'))
  cpSync(FIXTURE, source, { recursive: true })
  initialize(source)
  initialize(target)
})

afterAll(() => {
  rmSync(source, { recursive: true, force: true })
  rmSync(target, { recursive: true, force: true })
})

describe('open report', () => {
  it('opens into an empty repository while preserving authored model meaning', async () => {
    const original = buildProject(source)
    expect(await runOpen(target, original.outputFile, false)).toBe(0)
    git(target, 'add', '.')
    git(target, 'commit', '-m', 'open product model')

    const imported = loadModel(target)
    expect(imported.config.lintVerbs).toEqual(['reconcile'])
    const lint = lintModel(imported, lsFiles(target))
    expect(lint.ok).toBe(true)
    expect(lint.errors).toEqual([])
    expect(lint.warnings).toEqual([])
    expect(imported.journeys[0]).toMatchObject({
      id: 'browse-and-buy',
      goal: 'A shopper wants to purchase a suitable product.',
      successCriterion: 'A confirmed order exists for the selected product.'
    })
    expect(imported.interfaces.map(productInterface => [productInterface.id, productInterface.type]))
      .toEqual(expect.arrayContaining([
        ['customer-web', 'web'],
        ['customer-mobile', 'mobile-app'],
        ['operator-cli', 'cli']
      ]))
    expect(imported.journeyScenarios[0]!.steps.map(step => [step.text, step.capability])).toEqual([
      ['The shopper finds and selects an available product', 'browse-catalog'],
      ['The shopper submits checkout', 'place-order'],
      ['The Product confirms the paid order', 'settle-payment']
    ])
    expect(imported.experiences.flatMap(experience => experience.entryPoints))
      .toEqual(expect.arrayContaining([{ type: 'customer-web', path: '/' }]))
    // The Screen exists once per Interface: same purpose, two places, and the id
    // carries which is which.
    expect(imported.screens.map(screen => screen.id)).toEqual([
      'admin-web::order-detail',
      'customer-mobile::storefront::order-status',
      'customer-mobile::storefront::product-record',
      'customer-web::storefront::order-status',
      'customer-web::storefront::product-record',
      'customer-web::storefront::product-record-without-stock',
      'customer-web::catalog'
    ])
    // A Screen shared beside experiences/ comes back beside them, on the Interface.
    expect(imported.screens.find(screen => screen.id === 'customer-web::catalog')).toMatchObject({
      containerId: 'customer-web',
      capabilities: ['browse-catalog']
    })
    expect(imported.screens.find(screen => screen.id === 'customer-web::storefront::product-record')).toMatchObject({
      containerId: 'customer-web::storefront',
      capabilities: ['browse-catalog', 'place-order']
    })
    expect(imported.screens.flatMap(screen => screen.entryPoints.map(point => point.path))).toEqual([
      '/admin/orders/:id',
      'fixture-shop://orders/:id',
      'fixture-shop://products/:id',
      '/orders/:id',
      '/products/:id',
      '/'
    ])

    const rebuilt = buildProject(target)
    expect(withoutRepositoryEvidence(rebuilt.report)).toEqual(withoutRepositoryEvidence(original.report))
    expect(rebuilt.report.coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
    expect(Object.values(rebuilt.report.model).flatMap(value =>
      Array.isArray(value) ? value.flatMap(item => item.references || []) : []
    ).every(reference =>
      reference.kind !== 'code'
      && reference.role !== 'implementation'
      && /^https?:\/\//.test(reference.target)
    )).toBe(true)
    expect(readFileSync(join(target, 'product-model/capabilities/place-order/capability.md'), 'utf8'))
      .toContain('availability:')
    expect(readFileSync(join(target, 'product-model/business-rules/payment-before-confirmation.md'), 'utf8'))
      .toContain('appliesTo:')
    expect(readFileSync(
      join(target, 'product-model/capabilities/place-order/scenarios/complete-checkout.md'),
      'utf8'
    )).toContain('## Decision points')
    expect(readFileSync(
      join(target, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md'),
      'utf8'
    )).toContain('## Handoff note')
    expect(readFileSync(
      join(target, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md'),
      'utf8'
    )).toContain('steps:')
    expect(readFileSync(
      join(target, 'product-model/journeys/browse-and-buy/scenarios/browse-and-complete-checkout.md'),
      'utf8'
    )).not.toContain('## Steps')
    expect(readFileSync(join(target, 'product-model/journeys/browse-and-buy/journey.md'), 'utf8'))
      .toContain('## Teaching note')
    expect(readFileSync(join(target, 'product-model/capabilities/place-order/scenarios/complete-checkout.md'), 'utf8'))
      .toContain('## Recovery note')
    expect(readFileSync(join(target, 'product-model/product.md'), 'utf8'))
      .toContain('## Teaching note')
    // A Screen comes back as relations only: the facts on screen travel by Entity.
    expect(readFileSync(join(target, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record.md'), 'utf8'))
      .toMatch(/  - entity: catalog-product\n    shows:/)
  })

  it('refuses a report whose Screen nests inside another Screen', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'pdd-kit-open-nested-'))
    initialize(fresh)
    try {
      const report = structuredClone(buildProject(source).report)
      const parent = report.model.screens.find(screen => screen.id === 'customer-web::storefront::product-record')!
      report.model.screens.push({
        ...structuredClone(parent),
        id: 'customer-web::storefront::product-record::reviews',
        title: 'Reviews',
        capabilityIds: [],
        capabilityScenarioIds: [],
        journeyScenarioIds: [],
        entryPoints: [],
        references: []
      })
      report.counts.screens += 1
      const file = join(fresh, 'nested.json')
      writeFileSync(file, JSON.stringify(report))
      expect(await runOpen(fresh, file, false)).toBe(1)
      expect(existsSync(join(fresh, 'product-model/interfaces/customer-web/experiences/storefront/screens/product-record/screens'))).toBe(false)
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('opens with empty Coverage, since the origin repository\'s code says nothing about this one', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'pdd-kit-open-unmapped-'))
    initialize(fresh)
    try {
      const report = structuredClone(buildProject(source).report)
      report.referenceProfile = 'workspace'
      report.coverage.scope = 'Shopping and disputes: **customer behavior**.'
      report.coverage.exclusions = [{ description: 'Staff payroll stays outside this model.', paths: ['src/payroll/'] }]
      report.coverage.unmapped = [{ description: 'Back-office dispute handling', paths: ['src/disputes/'] }]
      report.coverage.covered = [{ description: 'Shopping **behavior**.', paths: ['src/shop/'] }]
      report.coverage.limitations = [{ description: 'Dispute retry policy is uncertain.', paths: ['src/disputes/'] }]
      const file = join(fresh, 'partial.json')
      writeFileSync(file, JSON.stringify(report))

      expect(await runOpen(fresh, file, false)).toBe(0)
      const imported = loadModel(fresh)
      expect(imported.coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
      expect(buildProject(fresh).report.coverage).toEqual(imported.coverage)
      const markdown = readFileSync(join(fresh, 'product-model/coverage.md'), 'utf8')
      expect(markdown.trim().endsWith('# Coverage')).toBe(true)
      expect(markdown).not.toMatch(/^rationale:/m)
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('round-trips direct Interface availability without creating Experiences', async () => {
    const fresh = mkdtempSync(join(tmpdir(), 'pdd-kit-open-direct-'))
    initialize(fresh)
    try {
      const report = structuredClone(buildProject(source).report)
      // The mobile catalog preview exists only as a Variation alternative; flattening drops it.
      report.model.variations = report.model.variations.filter(set => set.id !== 'mobile-storefront')
      report.counts.variations = report.model.variations.length
      for (const capability of report.model.capabilities) capability.availability = capability.availability.filter(context => context.placeId !== 'customer-mobile::catalog-preview')
      for (const scenario of report.model.capabilityScenarios) {
        scenario.routes = scenario.routes.filter(route => route.id !== 'preview')
        for (const step of scenario.steps) step.contexts = step.contexts.filter(context => context.routeId !== 'preview')
      }
      report.model.experiences = []
      report.counts.experiences = 0
      for (const collection of [
        report.model.capabilities,
        report.model.businessRules
      ]) {
        for (const resource of collection) {
          if ('availability' in resource) {
            resource.availability = resource.availability.map(context => ({
              placeId: context.placeId.split('::')[0]!
            }))
          }
        }
      }
      const directScreenIds = new Map<string, string>()
      for (const screen of report.model.screens) {
        // interface::experience::screen -> interface::screen
        const parts = screen.id.split('::')
        directScreenIds.set(screen.id, [parts[0], parts.at(-1)].join('::'))
      }
      for (const scenario of [...report.model.capabilityScenarios, ...report.model.journeyScenarios]) {
        for (const step of scenario.steps) {
          for (const context of step.contexts) {
            context.placeId = directScreenIds.get(context.placeId) || context.placeId.split('::')[0]!
          }
        }
      }
      for (const screen of report.model.screens) {
        screen.id = directScreenIds.get(screen.id)!
      }
      for (const variation of report.model.variations.filter(item => item.of === 'screen')) {
        for (const alternative of variation.alternatives) alternative.resourceId = directScreenIds.get(alternative.resourceId)!
      }
      const file = join(fresh, 'direct-report.json')
      writeFileSync(file, JSON.stringify(report))

      expect(await runOpen(fresh, file, false)).toBe(0)
      const imported = loadModel(fresh)
      expect(imported.experiences).toEqual([])
      expect(imported.capabilities.flatMap(capability => capability.availability))
        .toEqual(expect.arrayContaining([{ place: 'customer-web' }, { place: 'customer-mobile' }]))
      expect(readFileSync(join(fresh, 'product-model/capabilities/place-order/capability.md'), 'utf8'))
        .not.toContain('::')
      expect(readFileSync(join(fresh, 'product-model/config.yaml'), 'utf8'))
        .toContain('schema: 11')

      const rebuilt = buildProject(fresh)
      expect(withoutRepositoryEvidence(rebuilt.report)).toEqual(withoutRepositoryEvidence(report))
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('writes the model README, because the model arrived from elsewhere', async () => {
    // A fresh repository: the suite's shared target already holds a model, and
    // `open` refuses a non-empty `product-model/` without --force.
    const fresh = mkdtempSync(join(tmpdir(), 'pdd-kit-open-readme-'))
    initialize(fresh)
    try {
      const original = buildProject(source)
      expect(await runOpen(fresh, original.outputFile, false)).toBe(0)

      const readme = readFileSync(join(fresh, 'product-model', 'README.md'), 'utf8')
      expect(readme).toBe(MODEL_README)
      expect(readme).toContain('recommend checking the code against the model')
      expect(readme).toContain('Capability Scenarios are acceptance tests')
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('writes nothing outside product-model/, including repository instructions', async () => {
    // The invariant in AGENTS.md "Installer standards" buys:
    // pdd-kit owns one directory, so repository instructions are untouched.
    const fresh = mkdtempSync(join(tmpdir(), 'pdd-kit-open-outside-'))
    initialize(fresh)
    try {
      const original = buildProject(source)
      writeFileSync(join(fresh, 'AGENTS.md'), '# House rules\n\nRun the linter.\n')
      writeFileSync(join(fresh, 'CLAUDE.md'), '# Claude rules\n\nPreserve this file.\n')
      writeFileSync(join(fresh, 'README.md'), '# Existing repository\n')
      expect(await runOpen(fresh, original.outputFile, false)).toBe(0)
      expect(await runOpen(fresh, original.outputFile, true)).toBe(0)

      expect(readFileSync(join(fresh, 'AGENTS.md'), 'utf8')).toBe('# House rules\n\nRun the linter.\n')
      expect(readFileSync(join(fresh, 'CLAUDE.md'), 'utf8')).toBe('# Claude rules\n\nPreserve this file.\n')
      expect(readFileSync(join(fresh, 'README.md'), 'utf8')).toBe('# Existing repository\n')

      // `product-model/` and — because the second open passed --force — its
      // timestamped backup. Nothing the repository owns for its own purposes.
      const owned = new Set(['.git', 'AGENTS.md', 'CLAUDE.md', 'README.md'])
      const created = readdirSync(fresh).filter(entry => !owned.has(entry))
      expect(created.every(entry => entry.startsWith('product-model'))).toBe(true)
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it('writes empty Coverage and adds no claim in the author\'s voice', async () => {
    // Coverage records which of a repository's code the model accounts for, and
    // no code here has been mapped yet, so an opened model starts with none.
    const opened = readFileSync(join(target, 'product-model/coverage.md'), 'utf8')
    expect(opened).not.toMatch(/^review:|^rationale:/m)
    expect(opened).toContain('\n# Coverage\n')
    expect(opened).not.toContain('Opened from a portable Product Report')
    expect(loadModel(target).coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
  })

  it('expands to a fixed point so a re-opened model is byte-identical', async () => {
    // A catalog Blueprint's committed model is itself an expanded report, so
    // `pull` re-expands it and the result has to match what is committed.
    const first = readFileSync(join(target, 'product-model/coverage.md'), 'utf8')

    const roundTrip = mkdtempSync(join(tmpdir(), 'pdd-kit-open-fixed-point-'))
    try {
      initialize(roundTrip)
      expect(await runOpen(roundTrip, buildProject(target).outputFile, false)).toBe(0)
      const second = readFileSync(join(roundTrip, 'product-model/coverage.md'), 'utf8')
      expect(second).toEqual(first)
    } finally {
      rmSync(roundTrip, { recursive: true, force: true })
    }
  })

  it('writes required classifications and omits absent optional fields', () => {
    const product = readFileSync(join(target, 'product-model/product.md'), 'utf8')
    expect(product).toContain('summary: Browse a product catalog, buy products, and manage the resulting orders.')
    expect(product).toContain('category: commerce')
    expect(product).not.toContain('icon:')
    expect(product).not.toContain('accent:')
    expect(product).toContain('license: MIT')

    const shopper = readFileSync(join(target, 'product-model/entities/shopper.md'), 'utf8')
    expect(shopper).toMatch(/^---\nkind: person\nacts: external\nrelations:\n/)
    expect(shopper).toContain('- **Delivery address** — ')
    const order = readFileSync(join(target, 'product-model/entities/order.md'), 'utf8')
    expect(order).not.toContain('kind:')
    expect(order).not.toContain('transitions:')

    expect(readFileSync(join(target, 'product-model/capabilities/place-order/capability.md'), 'utf8'))
      .toMatch(/^---\ndomain: ordering\navailability:/)

    // `permits: []` is a claim and survives; an absent `permits` stays absent.
    expect(readFileSync(join(target, 'product-model/business-rules/orders-are-never-deleted.md'), 'utf8'))
      .toContain('permits: []')
    expect(readFileSync(join(target, 'product-model/business-rules/payment-before-confirmation.md'), 'utf8'))
      .not.toContain('permits')
    expect(readFileSync(join(target, 'product-model/business-rules/refunds-need-an-operator.md'), 'utf8'))
      .toContain('configuredBy: store-settings')
    // Every Step carries `entities`, `[]` included.
    expect(readFileSync(join(target, 'product-model/capabilities/settle-payment/scenarios/reconcile-a-refund-settlement.md'), 'utf8'))
      .toContain('entities: []')
  })

  it('refuses to overwrite a non-empty product model without force', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const report = join(source, 'product-model/build/report.json')
    expect(await runOpen(target, report, false)).toBe(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('is not empty'))
    vi.restoreAllMocks()
  })

  it('rejects report fields that cannot be written as canonical resource Markdown', async () => {
    const rejectedTarget = mkdtempSync(join(tmpdir(), 'pdd-kit-open-invalid-markdown-'))
    const original = buildProject(source)
    const report = structuredClone(original.report)
    report.model.entities[0]!.title = 'Injected entity\n## Extra'
    const file = join(rejectedTarget, 'invalid.json')
    writeFileSync(file, JSON.stringify(report))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await runOpen(rejectedTarget, file, false)).toBe(1)
    expect(console.error).toHaveBeenCalled()
    expect(() => readFileSync(join(rejectedTarget, 'product-model/product.md'))).toThrow()

    vi.restoreAllMocks()
    rmSync(rejectedTarget, { recursive: true, force: true })
  })

  it('rejects a portable report that exposes a local reference before writing files', async () => {
    const rejectedTarget = mkdtempSync(join(tmpdir(), 'pdd-kit-open-invalid-reference-'))
    const original = buildProject(source)
    const report = structuredClone(original.report)
    report.model.entities[0]!.references = [
      { kind: 'doc', role: 'context', target: 'docs/private.md' }
    ]
    const file = join(rejectedTarget, 'invalid.json')
    writeFileSync(file, JSON.stringify(report))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await runOpen(rejectedTarget, file, false)).toBe(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('portable report still exposes reference'))
    expect(() => readFileSync(join(rejectedTarget, 'product-model/product.md'))).toThrow()

    vi.restoreAllMocks()
    rmSync(rejectedTarget, { recursive: true, force: true })
  })

  it('rejects historical Product Reports instead of migrating them', async () => {
    const legacyTarget = mkdtempSync(join(tmpdir(), 'pdd-kit-open-v9-'))
    initialize(legacyTarget)
    try {
      const report = structuredClone(buildProject(source).report) as Record<string, any>
      report.schemaVersion = '9.0.0'
      const file = join(legacyTarget, 'v9.json')
      writeFileSync(file, JSON.stringify(report))
      vi.spyOn(console, 'error').mockImplementation(() => undefined)

      expect(await runOpen(legacyTarget, file, false)).toBe(1)
      expect(console.error).toHaveBeenCalled()
      expect(() => readFileSync(join(legacyTarget, 'product-model/product.md'))).toThrow()
    } finally {
      vi.restoreAllMocks()
      rmSync(legacyTarget, { recursive: true, force: true })
    }
  })

  it('names a missing report file instead of printing the system error', async () => {
    const missingTarget = mkdtempSync(join(tmpdir(), 'pdd-kit-open-missing-'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const missing = join(missingTarget, 'nope.json')
    expect(await runOpen(missingTarget, missing, false)).toBe(1)
    expect(console.error).toHaveBeenCalledWith(`No report file at ${missing}.`)

    vi.restoreAllMocks()
    rmSync(missingTarget, { recursive: true, force: true })
  })

  it('directs a remote report URL to pull instead of accepting it', async () => {
    const rejectedTarget = mkdtempSync(join(tmpdir(), 'pdd-kit-open-remote-'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(await runOpen(
      rejectedTarget,
      'https://pdd-kit.dev/blueprints/acme/fixture-shop/report.json',
      false
    )).toBe(2)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('pdd-kit blueprint pull'))

    vi.restoreAllMocks()
    rmSync(rejectedTarget, { recursive: true, force: true })
  })
})
