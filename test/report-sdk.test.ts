import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as sdk from '../src/report.js'
import { reportDigest } from '../src/report-digest.js'
import { compileReport } from '../src/commands/export.js'
import { expandProductReport } from '../src/commands/open.js'
import { loadModel } from '../src/core/model.js'
import { resolveModelRoot } from '../src/core/model-root.js'
import type { ProductReport, ReportReference } from '../src/core/portable.js'

const packageJson = JSON.parse(
  await readFile(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
) as { exports?: Record<string, unknown>, dependencies?: Record<string, string> }

describe('report SDK entry point', () => {
  it('is exposed as the ./report, ./report/digest and ./report/selectors subpath exports', async () => {
    expect(packageJson.exports?.['./report']).toEqual({
      types: './dist/report.d.ts',
      default: './dist/report.js'
    })
    expect(packageJson.exports?.['./report/digest']).toEqual({
      types: './dist/report-digest.d.ts',
      default: './dist/report-digest.js'
    })
    /* The Step selector alone, so a browser bundle takes it without the report schemas. */
    expect(packageJson.exports?.['./report/selectors']).toEqual({
      types: './dist/report-selectors.d.ts',
      default: './dist/report-selectors.js'
    })
    const selectors = await import('../src/report-selectors.js')
    expect(Object.keys(selectors).sort()).toEqual(['operationPlaces', 'permissionTargetSelectsOperation', 'reportVariationMembership'])
  })

  it('exports the schema, semantic validator, portable projection, and digest', () => {
    expect(sdk.REPORT_SCHEMA_VERSION).toBe('20.0.0')
    for (const name of [
      'ReportScenarioStepEntitySchema',
      'ReportEntityFactSchema',
      'ReportGrantSchema',
      'ReportGrantConditionSchema',
      'ProductReportSchema',
      'ReportReferenceSchema',
      'ReportUnmappedAreaSchema',
      'ReportSupportingSectionSchema',
      'ReportInterfaceSchema',
      'INTERFACE_TYPES',
      'ReportContextSchema',
      'ReportCapabilitySchema',
      'ReportCapabilityScenarioSchema',
      'ReportScreenSchema',
      'ReportScreenEntitySchema',
      'ReportJourneyScenarioSchema',
      'ReportScenarioRouteSchema',
      'ReportScenarioStepContextSchema',
      'ReportScenarioStepSchema',
      'ReportBusinessRuleTargetSchema',
      'validateProductReport',
      'validateBlueprintReport',
      'parseProductReport',
      'projectPortableReport',
      'canonicalReportJson'
    ]) {
      expect(sdk, `missing export ${name}`).toHaveProperty(name)
    }
    /* One report shape is current, so no export carries a version in its name. */
    expect(Object.keys(sdk).filter(name => /^ProductReportV\d/.test(name))).toEqual([])
    expect(sdk.INTERFACE_TYPES).toEqual([
      'web', 'mobile-app', 'desktop-app', 'cli', 'api', 'webhook', 'messaging', 'voice', 'device', 'agent'
    ])
  })

  it('never pulls the CLI or Node built-ins into the library graph', async () => {
    const seen = new Set<string>()
    const external = new Set<string>()
    const entry = fileURLToPath(new URL('../src/report.ts', import.meta.url))

    async function walk(file: string): Promise<void> {
      if (seen.has(file)) return
      seen.add(file)
      const source = await readFile(file, 'utf8')
      for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
        const specifier = match[1]!
        if (!specifier.startsWith('.')) {
          external.add(specifier)
          continue
        }
        await walk(fileURLToPath(new URL(specifier.replace(/\.js$/, '.ts'), `file://${file}`)))
      }
    }
    await walk(entry)

    expect([...external].sort()).toEqual(['zod'])
    expect([...seen].some(file => file.includes('/commands/'))).toBe(false)
    for (const specifier of external) expect(packageJson.dependencies).toHaveProperty(specifier)
  })

  it('computes a key-order-independent digest', () => {
    const digest = reportDigest({ b: 1, a: [{ d: 2, c: 3 }] })
    expect(reportDigest({ a: [{ c: 3, d: 2 }], b: 1 })).toBe(digest)
    expect(sdk.canonicalReportJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}')
  })
})

describe('projectPortableReport', () => {
  const FIXTURE = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'fixture-shop')
  let repo: string
  let report: ProductReport

  const allReferences = (value: ProductReport): ReportReference[] => [
    ...value.references,
    ...Object.values(value.model).flatMap(entry =>
      Array.isArray(entry) ? entry.flatMap(item => item.references ?? []) : [])
  ]

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'pdd-kit-portable-'))
    cpSync(FIXTURE, repo, { recursive: true })
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
    git('init', '--initial-branch=main')
    git('config', 'user.email', 'fixture@example.com')
    git('config', 'user.name', 'Fixture')
    git('add', '.')
    git('commit', '-m', 'fixture')
    const { modelRoot } = resolveModelRoot(repo)
    report = compileReport(loadModel(modelRoot), '2026-01-01')
  })

  afterAll(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  it.each([undefined, null, 'undo', {}, [1], ['Undo'], ['undo-action'], ['undo\n']].map(verbs => ({ verbs })))(
    'rejects an invalid report verb list: $verbs', ({ verbs }) => {
      expect(sdk.ProductReportSchema.safeParse({ ...report, lintVerbs: verbs }).success).toBe(false)
    }
  )

  it('rejects duplicate report verbs', () => {
    expect(sdk.validateProductReport({ ...report, lintVerbs: ['undo', 'undo'] }))
      .toContain('product: lintVerbs contains duplicate "undo"')
  })

  it('compiles a workspace profile with implementation navigation', () => {
    expect(report.referenceProfile).toBe('workspace')
    expect(report.lintVerbs).toEqual(['reconcile'])
    expect(allReferences(report).some(reference => reference.kind === 'code')).toBe(true)
    expect(report.coverage).toEqual({
      scope: 'Customer shopping, checkout and staff order management.',
      exclusions: [],
      method: 'Hand-authored golden fixture for the toy shop.',
      unmapped: [],
      limitations: [],
      covered: [{ description: 'Customer shopping, checkout and staff order management.', paths: ['src/'] }],
    })
    expect(report.supportingSections).toEqual([{
      heading: 'Teaching note',
      content: 'This supporting section exercises lossless Product Report expansion.'
    }])
    expect(report.model.capabilityScenarios.find(item => item.id === 'complete-checkout')?.supportingSections)
      .toEqual([{
        heading: 'Recovery note',
        content: 'Payment recovery remains supporting context rather than another structured field.'
      }])
    expect(report.model.journeys[0]!.supportingSections).toEqual([{
      heading: 'Teaching note',
      content: 'The goal composition deliberately crosses catalog and ordering behavior.'
    }])
    expect(report.model.journeyScenarios.find(item => item.id === 'browse-and-complete-checkout')?.supportingSections)
      .toEqual([{
        heading: 'Handoff note',
        content: 'The report must preserve this supporting context after the structured Outcome.'
      }])
  })

  it('accepts direct Interface availability when no Experiences divide an Interface', () => {
    const direct = structuredClone(report)
    // The mobile catalog preview exists only as a Variation alternative; flattening drops it.
    direct.model.variations = direct.model.variations.filter(set => set.id !== 'mobile-storefront')
    direct.counts.variations = direct.model.variations.length
    for (const capability of direct.model.capabilities) capability.availability = capability.availability.filter(context => context.placeId !== 'customer-mobile::catalog-preview')
    for (const scenario of direct.model.capabilityScenarios) {
      scenario.routes = scenario.routes.filter(route => route.id !== 'preview')
      for (const step of scenario.steps) step.contexts = step.contexts.filter(context => context.routeId !== 'preview')
    }
    direct.model.experiences = []
    direct.counts.experiences = 0
    for (const collection of [
      direct.model.capabilities,
      direct.model.businessRules
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
    for (const screen of direct.model.screens) {
      const parts = screen.id.split('::')
      directScreenIds.set(screen.id, [parts[0], parts.at(-1)].join('::'))
    }
    for (const scenario of [...direct.model.capabilityScenarios, ...direct.model.journeyScenarios]) {
      for (const step of scenario.steps) {
        for (const context of step.contexts) {
          context.placeId = directScreenIds.get(context.placeId) || context.placeId.split('::')[0]!
        }
      }
    }
    for (const screen of direct.model.screens) {
      screen.id = directScreenIds.get(screen.id)!
    }
    for (const variation of direct.model.variations.filter(item => item.of === 'screen')) {
      for (const alternative of variation.alternatives) alternative.resourceId = directScreenIds.get(alternative.resourceId)!
    }

    expect(sdk.validateProductReport(direct)).toEqual([])
    expect(() => sdk.parseProductReport(direct)).not.toThrow()
  })

  it('keeps failure-only Capabilities out of the Journey primary set', () => {
    const withFailure = structuredClone(report)
    withFailure.model.journeyScenarios.push({
      id: 'checkout-needs-operator-help',
      journeyId: 'browse-and-buy',
      title: 'Checkout needs operator help',
      kindId: 'edge',
      actorIds: ['shopper', 'store-admin'],
      result: 'not-achieved',
      routes: [{ id: 'web-to-admin', name: 'Web to administration' }],
      steps: [
        {
          text: 'The shopper attempts checkout',
          kind: 'actor',
          actorId: 'shopper',
          capabilityId: 'place-order',
          entities: [],
          unattended: false,
          contexts: [{
            routeId: 'web-to-admin',
            placeId: 'customer-web::storefront::product-record'
          }]
        },
        {
          text: 'The store admin reviews the blocked attempt',
          kind: 'actor',
          actorId: 'store-admin',
          capabilityId: 'confirm-order',
          entities: [],
          unattended: false,
          contexts: [{
            routeId: 'web-to-admin',
            placeId: 'admin-web::order-detail'
          }]
        }
      ],
      trigger: 'A shopper attempts checkout and needs operator help.',
      decisionPoints: [],
      outcome: 'The Journey goal is not achieved and the blocked attempt is ready for review.',
      edgeCases: [],
      intent: '',
      supportingSections: [],
      references: []
    })
    for (const screenId of ['customer-web::storefront::product-record', 'admin-web::order-detail']) {
      withFailure.model.screens.find(screen => screen.id === screenId)!.journeyScenarioIds.push('checkout-needs-operator-help')
    }
    withFailure.counts.journeyScenarios += 1
    // Manual confirmation is an achieved alternative, so Order confirmation is primary, not failure-only.
    withFailure.model.journeys[0]!.failureOnlyCapabilityIds = ['cancel-order']

    expect(withFailure.model.journeys[0]!.capabilityIds).toEqual(['browse-catalog', 'confirm-order', 'place-order', 'settle-payment'])
    expect(sdk.validateProductReport(withFailure)).toEqual([])
  })

  it('keeps only HTTP(S) intent and context references', () => {
    const enriched = structuredClone(report)
    enriched.model.entities[0]!.references = [
      { kind: 'code', role: 'intent', target: 'src/routes/storefront.ts' },
      { kind: 'doc', role: 'context', target: 'docs/local.md' },
      { kind: 'doc', role: 'context', target: 'https://example.com/handbook', title: 'Handbook' },
      { kind: 'prd', role: 'intent', target: 'https://example.com/checkout-prd', title: 'Checkout PRD' },
      { kind: 'visual', role: 'implementation', target: 'https://example.com/current.png' },
      { kind: 'proposal', role: 'intent', target: 'https://example.com/proposal' }
    ]

    const portable = sdk.projectPortableReport(enriched)
    expect(portable.referenceProfile).toBe('portable')
    expect(portable.model.entities[0]!.references).toEqual([
      { kind: 'doc', role: 'context', target: 'https://example.com/handbook', title: 'Handbook' },
      { kind: 'prd', role: 'intent', target: 'https://example.com/checkout-prd', title: 'Checkout PRD' },
      { kind: 'proposal', role: 'intent', target: 'https://example.com/proposal' }
    ])
    expect(allReferences(portable).every(reference =>
      reference.kind !== 'code'
      && reference.role !== 'implementation'
      && /^https?:\/\//.test(reference.target)
    )).toBe(true)
    expect(JSON.stringify(portable)).not.toContain('src/services/payments.ts')
  })

  it('drops repository Screen entry points and Coverage paths, retaining area descriptions', () => {
    const enriched = structuredClone(report)
    enriched.model.screens[0]!.entryPoints = [
      { type: 'relative', path: 'src/routes/storefront.ts' },
      { type: 'windows', path: String.raw`src\routes\storefront.ts` },
      { type: 'absolute', path: '/Users/owner/project/src/routes/storefront.ts' },
      { type: 'file-url', path: 'file:///Users/owner/project/src/routes/storefront.ts' },
      { type: 'route', path: '/checkout' },
      { type: 'url', path: 'https://example.com/checkout' },
      { type: 'mobile', path: 'fixture-shop://checkout' },
      { type: 'cli', path: 'shop checkout' }
    ]

    const portable = sdk.projectPortableReport(enriched)
    expect(portable.model.screens[0]!.entryPoints).toEqual([
      { type: 'route', path: '/checkout' },
      { type: 'url', path: 'https://example.com/checkout' },
      { type: 'mobile', path: 'fixture-shop://checkout' },
      { type: 'cli', path: 'shop checkout' }
    ])
    expect(portable.coverage).toEqual({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] })
  })

  it('rejects portable reports that still expose workspace references', () => {
    const base = sdk.projectPortableReport(report)
    const cases: ReportReference[] = [
      { kind: 'code', role: 'intent', target: 'src/routes/storefront.ts' },
      { kind: 'doc', role: 'implementation', target: 'https://example.com/live-doc' },
      { kind: 'visual', role: 'context', target: 'docs/local.png' }
    ]
    for (const reference of cases) {
      const tampered = structuredClone(base)
      tampered.model.entities[0]!.references = [reference]
      expect(sdk.validateProductReport(tampered).join('\n')).toContain(
        `portable report still exposes reference "${reference.target}"`
      )
    }

    const withCoveredAreas = structuredClone(base)
    withCoveredAreas.coverage.scope = 'The storefront.'
    withCoveredAreas.coverage.covered = [{ description: 'Shopping code', paths: ['src/'] }]
    expect(sdk.validateProductReport(withCoveredAreas)).toContain(
      'referenceProfile is portable but coverage.covered describes the origin repository\'s code'
    )
  })

  it('rejects duplicate targets on one resource', () => {
    const duplicate = structuredClone(report)
    duplicate.model.entities[0]!.references = [
      { kind: 'doc', role: 'context', target: 'https://example.com/same' },
      { kind: 'visual', role: 'intent', target: 'https://example.com/same' }
    ]
    expect(sdk.validateProductReport(duplicate).join('\n')).toContain('duplicate reference target')
  })

  it('rejects duplicate IDs in set-valued report relations', () => {
    const duplicate = structuredClone(report)
    duplicate.model.interfaces[0]!.actorIds.push(duplicate.model.interfaces[0]!.actorIds[0]!)
    duplicate.model.screens[0]!.capabilityIds.push(duplicate.model.screens[0]!.capabilityIds[0]!)
    const issues = sdk.validateProductReport(duplicate).join('\n')
    expect(issues).toContain('actorIds contains duplicate')
    expect(issues).toContain('capabilityIds contains duplicate')
  })

  it('keeps supporting Markdown structural and rejects opaque or conflicting shapes', () => {
    const conflicting = structuredClone(report)
    conflicting.model.journeys[0]!.supportingSections = [{
      heading: 'Goal',
      content: 'This would collide with the structured Goal.'
    }]
    expect(sdk.ProductReportSchema.safeParse(conflicting).success).toBe(true)
    expect(sdk.validateProductReport(conflicting).join('\n')).toContain(
      'supporting section "Goal" conflicts with a structured section'
    )

    const nestedHeading = structuredClone(report)
    nestedHeading.model.entities[0]!.supportingSections = [{
      heading: 'Notes',
      content: '## Injected structure'
    }]
    expect(sdk.ProductReportSchema.safeParse(nestedHeading).success).toBe(false)

    const paddedHeading = structuredClone(report)
    paddedHeading.model.journeys[0]!.supportingSections = [{
      heading: ' Goal ',
      content: 'Whitespace must not bypass a structured-heading collision.'
    }]
    expect(sdk.ProductReportSchema.safeParse(paddedHeading).success).toBe(false)

    const nestedIntent = structuredClone(report)
    nestedIntent.intent = '# Injected title'
    expect(sdk.ProductReportSchema.safeParse(nestedIntent).success).toBe(false)

    const nestedRationale = structuredClone(report)
    nestedRationale.model.businessRules[0]!.rationale = '# Injected Rule title'
    expect(sdk.ProductReportSchema.safeParse(nestedRationale).success).toBe(false)

    const opaque = structuredClone(report) as Record<string, any>
    opaque.supportingContent = '## Legacy opaque content'
    expect(sdk.ProductReportSchema.safeParse(opaque).success).toBe(false)
  })

  it('reports a Journey with no achieved Scenario through semantic validation', () => {
    const missing = structuredClone(report)
    missing.model.journeyScenarios = []
    missing.counts.journeyScenarios = 0
    missing.model.journeys[0]!.capabilityIds = []
    missing.model.journeys[0]!.failureOnlyCapabilityIds = []
    missing.model.journeys[0]!.domainIds = []
    for (const screen of missing.model.screens) screen.journeyScenarioIds = []
    for (const rule of missing.model.businessRules) {
      rule.appliesTo = rule.appliesTo.filter(target => target.type !== 'journey-scenario')
    }

    expect(sdk.ProductReportSchema.safeParse(missing).success).toBe(true)
    expect(sdk.validateProductReport(missing)).toContain(
      'journey "browse-and-buy": needs at least one achieved Journey Scenario'
    )
  })

  it('uses a strict reference record and rejects removed fields', () => {
    const unknown = structuredClone(report) as Record<string, any>
    unknown.model.entities[0].references = [{
      kind: 'doc', role: 'context', target: 'https://example.com', verified: true
    }]
    expect(sdk.ProductReportSchema.safeParse(unknown).success).toBe(false)

    const legacy = structuredClone(report) as Record<string, any>
    legacy.model.entities[0].codeRefs = []
    expect(sdk.ProductReportSchema.safeParse(legacy).success).toBe(false)

    const legacyJourney = structuredClone(report) as Record<string, any>
    legacyJourney.model.journeyScenarios[0].flow = []
    legacyJourney.model.journeyScenarios[0].routes = []
    expect(sdk.ProductReportSchema.safeParse(legacyJourney).success).toBe(false)
  })

  it('is non-mutating, idempotent, and produces a valid report', () => {
    const before = JSON.stringify(report)
    const once = sdk.projectPortableReport(report)
    expect(JSON.stringify(report)).toBe(before)
    expect(sdk.projectPortableReport(once)).toEqual(once)
    expect(sdk.validateProductReport(once)).toEqual([])
    expect(() => sdk.parseProductReport(JSON.parse(JSON.stringify(once)))).not.toThrow()
  })

  it('validates the stricter public Blueprint metadata profile', () => {
    expect(sdk.validateBlueprintReport(report)).toEqual([])
    expect(sdk.validateBlueprintReport({
      ...report,
      category: null,
      tags: [],
      authors: [],
      license: null
    })).toEqual([
      'category is required for a public Blueprint',
      'at least one tag is required for a public Blueprint',
      'at least one author is required for a public Blueprint',
      'license is required for a public Blueprint'
    ])
  })

  it('enforces route, Rule-target, Experience-cover, and complete-model relationships', () => {
    const incompleteRoute = structuredClone(report)
    const scenario = incompleteRoute.model.journeyScenarios.find(item => item.id === 'browse-and-complete-checkout')!
    scenario.steps.find(step => step.capabilityId === 'place-order')!.contexts.pop()
    expect(sdk.validateProductReport(incompleteRoute).join('\n')).toContain(
      'contexts must assign every declared route or be empty'
    )

    const narrowedRule = structuredClone(report)
    // The fixture's Rules all target Entities now; give this one a behavioural
    // target to narrow, as the folder test does.
    const narrowedTarget = narrowedRule.model.businessRules.find(rule => rule.id === 'payment-before-confirmation')!
    narrowedTarget.appliesTo = [
      { type: 'capability', id: 'place-order', contexts: [{ placeId: 'admin-web' }] },
      { type: 'journey', id: 'browse-and-buy', contexts: [] }
    ]
    expect(sdk.validateProductReport(narrowedRule).join('\n')).toContain(
      'Context place "admin-web" is outside target "capability:place-order"'
    )

    const uncoveredActor = structuredClone(report)
    uncoveredActor.model.interfaces.find(item => item.id === 'customer-web')!.actorIds.push('store-admin')
    expect(sdk.validateProductReport(uncoveredActor).join('\n')).toContain(
      'interface "customer-web": actor "store-admin" needs at least one Experience context'
    )

    const emptyModel = structuredClone(report)
    emptyModel.model.capabilities = []
    emptyModel.counts.capabilities = 0
    expect(sdk.validateProductReport(emptyModel)).toContain('the model needs at least one capability')
  })

  it('requires Capability coverage in every declared Context despite known model gaps', () => {
    const incomplete = structuredClone(report)
    for (const scenario of incomplete.model.capabilityScenarios.filter(item => item.capabilityId === 'place-order')) {
      scenario.routes = scenario.routes.filter(route => route.id !== 'mobile')
      for (const step of scenario.steps) step.contexts = step.contexts.filter(context => context.routeId !== 'mobile')
    }
    incomplete.model.screens = incomplete.model.screens
      .filter(screen => !screen.id.startsWith('customer-mobile::'))
    incomplete.coverage.unmapped = [{ description: 'Subscription purchase code.', paths: ['src/subscriptions/'] }]
    expect(sdk.validateProductReport(incomplete)).toContain(
      'capability "place-order": availability Context place "customer-mobile::storefront" needs Capability Scenario coverage'
    )
    // Coverage binds every report, so publication checks add only publication metadata.
    expect(sdk.validateBlueprintReport(incomplete).filter((issue: string) => issue.includes('Capability Scenario coverage'))).toEqual([])
  })

  it('keeps Coverage independent from References', () => {
    const withoutReferences = structuredClone(report)
    withoutReferences.references = []
    for (const entry of Object.values(withoutReferences.model)) {
      if (Array.isArray(entry)) {
        for (const item of entry) if ('references' in item) item.references = []
      }
    }
    expect(sdk.validateProductReport(withoutReferences)).toEqual([])
    expect(withoutReferences.coverage).toEqual(report.coverage)
  })

  /*
   * The report is expanded straight into an authored folder, so an Entity edge
   * the folder rules reject must not survive the wire — it would produce a
   * `product-model/` that fails `lint` the moment it lands. None of these were
   * checked when the Entity collection shipped.
   */
  it('resolves every Entity edge the folder rules resolve', () => {
    const cart = (value: ProductReport) => value.model.entities.find(item => item.id === 'cart')!

    const cases: Array<[string, (value: ProductReport) => void]> = [
      ['relation references missing entity "ghost"', (value) => {
        value.model.entities[0]!.relations.push({ entityId: 'ghost', verb: 'holds', cardinality: 'many-to-many' })
      }],
      ['references missing entity "ghost"', (value) => {
        value.model.screens[0]!.entities = [{ entityId: 'ghost', shows: [], collects: [] }]
      }],
      ['no step changes it, no Screen presents it, nothing names it as an actor, no Rule reads it, and no Variation chooses by it', (value) => {
        const entity = cart(value)
        for (const screen of value.model.screens) {
          screen.entities = screen.entities.filter(entry => entry.entityId !== entity.id)
        }
        for (const scenario of [...value.model.capabilityScenarios, ...value.model.journeyScenarios]) {
          for (const step of scenario.steps) {
            step.entities = step.entities.filter(entry => entry.entityId !== entity.id)
          }
        }
      }],
      ['needs information kept, states, or acts', (value) => {
        const entity = cart(value)
        entity.informationKept = []
        entity.states = []
      }],
      ['kind and acts are present together or not at all', (value) => {
        value.model.entities.find(item => item.id === 'shopper')!.kind = null
      }],
      ['"order" does not act', (value) => {
        value.model.interfaces[0]!.actorIds = ['order']
      }],
      ['informationKept contains duplicate "Delivery address"', (value) => {
        const shopper = value.model.entities.find(item => item.id === 'shopper')!
        shopper.informationKept.push({ ...shopper.informationKept[0]! })
      }]
    ]

    for (const [expected, mutate] of cases) {
      const tampered = structuredClone(report)
      mutate(tampered)
      expect(sdk.validateProductReport(tampered).join('\n')).toContain(expected)
    }
  })

  it.each(['capabilityScenarios', 'journeyScenarios'] as const)('rejects undeclared Entity titles in %s before expansion', collection => {
    const tampered = structuredClone(report)
    const step = tampered.model[collection][0]!.steps[0]!
    const entity = tampered.model.entities.find(entity => entity.id !== step.actorId
      && !step.entities.some(entry => entry.entityId === entity.id))!
    step.text += ` beside the ${entity.title}`
    const message = `text names "${entity.title}" and "entities" does not declare it`
    expect(sdk.validateProductReport(tampered).join('\n')).toContain(message)
    expect(() => sdk.parseProductReport(sdk.projectPortableReport(tampered))).toThrow(message)
  })

  it('checks what a Scenario step claims against the Entity it names', () => {
    const moveOf = (value: ProductReport) => {
      for (const scenario of [...value.model.capabilityScenarios, ...value.model.journeyScenarios]) {
        for (const step of scenario.steps) {
          const entry = step.entities.find(item => item.from !== null && item.to !== null)
          if (entry) return { step, entry }
        }
      }
      throw new Error('the fixture needs one step entry that moves an Entity between states')
    }

    const missing = structuredClone(report)
    moveOf(missing).entry.entityId = 'ghost'
    expect(sdk.validateProductReport(missing).join('\n')).toContain('references missing entity "ghost"')

    const unknownState = structuredClone(report)
    moveOf(unknownState).entry.to = 'Nowhere'
    expect(sdk.validateProductReport(unknownState).join('\n')).toContain('is not a state of entity')

    /* State keys follow the effect: a read carries none, a creation has no
       origin, a removal leaves nothing anywhere. */
    const read = structuredClone(report)
    moveOf(read).entry.effect = 'reads'
    expect(sdk.validateProductReport(read).join('\n')).toContain('a "reads" entry carries no state')

    const created = structuredClone(report)
    moveOf(created).entry.effect = 'creates'
    expect(sdk.validateProductReport(created).join('\n')).toContain('a "creates" entry has no "from"')

    const removed = structuredClone(report)
    moveOf(removed).entry.effect = 'removes'
    expect(sdk.validateProductReport(removed).join('\n')).toContain('a "removes" entry has no "to"')

    /* One Step states one thing about one instance. */
    const twice = structuredClone(report)
    const { step, entry } = moveOf(twice)
    step.entities.push({ ...entry })
    expect(sdk.validateProductReport(twice).join('\n')).toContain('entities contains duplicate')

    /* Mentions of one Entity keep one alias mode, and a later Step resumes the
       same instance from the state the earlier Step produced. */
    const aliases = structuredClone(report)
    const merge = aliases.model.capabilityScenarios.find(item => item.id === 'merge-duplicate-orders')!
    merge.steps[1]!.entities.find(item => item.as === 'duplicate')!.as = null
    expect(sdk.validateProductReport(aliases).join('\n')).toContain(
      '"order" is aliased elsewhere in this Scenario; once an Entity is aliased, every mention of it is'
    )

    const chained = structuredClone(report)
    const refund = chained.model.capabilityScenarios.find(item => item.id === 'refund-a-confirmed-order')!
    const firstOrder = refund.steps[0]!.entities.find(item => item.entityId === 'order')!
    firstOrder.effect = 'changes'
    firstOrder.from = 'Pending'
    firstOrder.to = 'Confirmed'
    refund.steps[1]!.entities.find(item => item.entityId === 'order')!.from = 'Pending'
    expect(sdk.validateProductReport(chained).join('\n')).toContain(
      '"order" was left in "Confirmed" by an earlier Step, not "Pending"; if these are different instances, give them aliases'
    )

    /* Attribution on a Product Step still does not make it an Actor Step. */
    const attributedOnly = structuredClone(report)
    const attributedScenario = attributedOnly.model.capabilityScenarios.find(item => item.id === 'refund-a-confirmed-order')!
    attributedScenario.steps.find(item => item.kind === 'actor')!.kind = 'product'
    expect(sdk.validateProductReport(attributedOnly).join('\n')).toContain(
      'needs at least one actor Step, or an unattended first condition Step'
    )

    /* A Journey Step that changes a thing names the Capability that owns the change. */
    const unowned = structuredClone(report)
    const journeyStep = unowned.model.journeyScenarios[0]!.steps.find(item => item.entities.some(entry => entry.effect !== 'reads'))!
    journeyStep.capabilityId = null
    expect(sdk.validateProductReport(unowned).join('\n')).toContain('needs a capabilityId')
  })

  /*
   * Grants resolve on the wire exactly as they do in the folder: every id,
   * every path, every fact — and never a claim that a grant is satisfied.
   */
  it('resolves a permission Rule the way the folder does', () => {
    const rule = (value: ProductReport, id: string) => value.model.businessRules.find(item => item.id === id)!

    const behavioural = structuredClone(report)
    rule(behavioural, 'payment-before-confirmation').appliesTo = [
      { type: 'capability', id: 'place-order', contexts: [] },
      { type: 'journey', id: 'browse-and-buy', contexts: [] }
    ]
    rule(behavioural, 'payment-before-confirmation').permits = [{
      actorIds: ['store-admin'], related: [], self: false, when: [], unattended: false, configuredByEntityId: null
    }]
    expect(sdk.validateProductReport(behavioural).join('\n')).toContain('permits needs Entity targets only')

    const badPath = structuredClone(report)
    rule(badPath, 'a-refund-is-visible-to-its-shopper').permits![0]!.related = [{ verb: 'belongs to', entityId: 'order' }]
    expect(sdk.validateProductReport(badPath).join('\n')).toContain('"belongs to" joins "refund" and "order" in neither direction')

    const nobody = structuredClone(report)
    rule(nobody, 'margin-is-for-operators').permits![0]!.actorIds = []
    expect(sdk.validateProductReport(nobody).join('\n')).toContain('grant 1: names nobody')

    const noSuchFact = structuredClone(report)
    rule(noSuchFact, 'refunds-need-an-operator').permits![0]!.when[0]!.fact = 'Weight'
    expect(sdk.validateProductReport(noSuchFact).join('\n')).toContain('"Weight" is not a fact of entity "order"')

    const manyInstances = structuredClone(report)
    rule(manyInstances, 'refunds-need-an-operator').permits![0]!.when.push({
      entityId: 'catalog-product', fact: 'Price', operator: 'present', value: true, state: null
    })
    expect(sdk.validateProductReport(manyInstances).join('\n')).toContain('reads "catalog-product", which is not the acting Entity')
    manyInstances.model.entities.find(entity => entity.id === 'catalog-product')!.singleton = true
    expect(sdk.validateProductReport(manyInstances).join('\n')).not.toContain('reads "catalog-product"')

    // The report refuses what the folder refuses: a singleton that acts, or on a relation's many end.
    const singletons = structuredClone(report)
    const admin = singletons.model.entities.find(entity => entity.id === 'store-admin')!
    admin.singleton = true
    singletons.model.entities.find(entity => entity.id === 'order')!.relations.push({ entityId: 'store-settings', verb: 'is priced by', cardinality: 'many-to-many' })
    const singletonIssues = sdk.validateProductReport(singletons).join('\n')
    expect(singletonIssues).toContain('entity "store-admin": an Entity that acts is never singleton')
    expect(singletonIssues).toContain('relation "is priced by store-settings" is many-to-many, but "store-settings" is singleton')

    const closed = structuredClone(report)
    expect(rule(closed, 'orders-are-never-deleted').permits).toEqual([])
    expect(rule(closed, 'payment-before-confirmation').permits).toBeNull()
  })

  it('applies permission Rules to the Steps and Screens they govern', () => {
    const rule = (value: ProductReport, id: string) => value.model.businessRules.find(item => item.id === id)!

    const forbidden = structuredClone(report)
    rule(forbidden, 'orders-are-never-deleted').appliesTo = [{
      type: 'entity', entityId: 'order', effect: 'changes', from: 'Confirmed', to: 'Refunded', facts: [], contexts: []
    }]
    expect(sdk.validateProductReport(forbidden).join('\n')).toContain(
      'moves "order" from Confirmed to Refunded, which rule "orders-are-never-deleted" forbids to everyone'
    )
    expect(() => sdk.parseProductReport(forbidden)).toThrow('forbids to everyone')

    // Matching Rules AND: one Rule without a possible grant is enough to reject the Step.
    const noGrant = structuredClone(report)
    rule(noGrant, 'refunds-need-an-operator').permits = [{
      actorIds: ['payment-gateway'], related: [], self: false, when: [], unattended: false, configuredByEntityId: null
    }]
    expect(sdk.validateProductReport(noGrant).join('\n')).toContain(
      'actor "store-admin" moves "order" from Confirmed to Refunded, and no grant of rule "refunds-need-an-operator" can permit it'
    )

    const noSchedule = structuredClone(report)
    const broad = rule(noSchedule, 'who-may-change-an-order')
    broad.permits = broad.permits!.filter(grant => !grant.unattended)
    expect(sdk.validateProductReport(noSchedule).join('\n')).toContain(
      'moves "order" from Pending to Cancelled unattended, and rule "who-may-change-an-order" has no "unattended" grant for it'
    )

    // A Context selector governs only Steps beneath that place.
    const elsewhere = structuredClone(report)
    rule(elsewhere, 'orders-are-never-deleted').appliesTo = [{
      type: 'entity',
      entityId: 'order',
      effect: 'changes',
      from: 'Confirmed',
      to: 'Refunded',
      facts: [],
      contexts: [{ placeId: 'customer-web::storefront::order-status' }]
    }]
    expect(sdk.validateProductReport(elsewhere).some(issue =>
      issue.includes('rule "orders-are-never-deleted" forbids to everyone'))).toBe(false)

    const here = structuredClone(elsewhere)
    const target = rule(here, 'orders-are-never-deleted').appliesTo[0]!
    if (target.type !== 'entity') throw new Error('test requires one Entity target')
    target.contexts = [{ placeId: 'admin-web::order-detail' }]
    expect(sdk.validateProductReport(here).join('\n')).toContain(
      'moves "order" from Confirmed to Refunded, which rule "orders-are-never-deleted" forbids to everyone'
    )

    const unreadable = structuredClone(report)
    rule(unreadable, 'margin-is-for-operators').permits = []
    expect(sdk.validateProductReport(unreadable).join('\n')).toContain(
      'screen "admin-web::order-detail": presents "order" facts "Margin", which rule "margin-is-for-operators" forbids anyone to read'
    )
  })

  it('accepts the relations the folder accepts, and refuses a derived cardinality', () => {
    // Two Entities relating at each other are usually one relationship written
    // twice, and sometimes two genuinely different ones. Nothing here can tell
    // those apart, so the folder grades it a warning and the wire — which has
    // only errors — refuses nothing the folder accepts.
    const facing = structuredClone(report)
    const [first, second] = facing.model.entities
    first!.relations = [{ entityId: second!.id, verb: 'holds', cardinality: 'one-to-many' }]
    second!.relations = [{ entityId: first!.id, verb: 'belongs to', cardinality: 'many-to-many' }]
    expect(sdk.validateProductReport(facing).filter(issue => /relation/.test(issue))).toEqual([])

    const backwards = structuredClone(report) as unknown as {
      model: { entities: Array<{ relations: Array<{ cardinality: string }> }> }
    }
    backwards.model.entities[0]!.relations = [{ cardinality: 'many-to-one' } as never]
    expect(sdk.ProductReportSchema.safeParse(backwards).success).toBe(false)
  })

  it('holds a Domain to the Boundary the folder requires', () => {
    // The wire form carried no Boundary at all, so a Domain that validated here
    // expanded into a folder `lint` refuses for missing `## Boundary`.
    const missing = structuredClone(report) as unknown as { model: { domains: Array<Record<string, unknown>> } }
    delete missing.model.domains[0]!.boundary
    expect(sdk.ProductReportSchema.safeParse(missing).success).toBe(false)

    const inclusionOnly = structuredClone(report)
    inclusionOnly.model.domains[0]!.boundary = 'Everything about orders.'
    expect(sdk.validateProductReport(inclusionOnly).join('\n'))
      .toContain('boundary must state what the Domain does not own')
  })

  it('holds an Experience to the one Interface its id names', () => {
    // `interfaceIds` is a second encoding of containment, and expansion files
    // an Experience by its id — so a report could validate under one Interface
    // and expand under another.
    const elsewhere = structuredClone(report)
    const experience = elsewhere.model.experiences[0]!
    const otherInterface = elsewhere.model.interfaces.find(item => !experience.id.startsWith(`${item.id}::`))!
    experience.interfaceIds = [otherInterface.id]
    expect(sdk.validateProductReport(elsewhere).join('\n')).toContain('interfaceIds must be exactly')

    const both = structuredClone(report)
    both.model.experiences[0]!.interfaceIds.push(otherInterface.id)
    expect(sdk.validateProductReport(both).join('\n')).toContain('interfaceIds must be exactly')
  })

  it('keeps an unattended trigger on the first Step, and a condition', () => {
    const later = structuredClone(report)
    const scenario = later.model.capabilityScenarios.find(item => item.steps.length > 1)!
    scenario.steps[1]!.unattended = true
    expect(sdk.validateProductReport(later).join('\n'))
      .toContain('step 2: "unattended" is valid only on the first Step')

    const notACondition = structuredClone(report)
    const first = notACondition.model.capabilityScenarios.find(item => item.steps[0]?.kind !== 'condition')!
    first.steps[0]!.unattended = true
    expect(sdk.validateProductReport(notACondition).join('\n'))
      .toContain('an unattended trigger must be a condition Step')
  })

  it('checks an Interface entry-point key on the wire, which it never did', () => {
    const other = report.model.interfaces[1]!.id

    const own = structuredClone(report)
    own.model.interfaces[0]!.entryPoints.push({ type: own.model.interfaces[0]!.id, path: '/x' })
    expect(sdk.validateProductReport(own).join('\n')).toContain('entry point key')

    const unknown = structuredClone(report)
    unknown.model.interfaces[0]!.entryPoints.push({ type: 'nonsense', path: '/x' })
    expect(sdk.validateProductReport(unknown).join('\n')).toContain('entry point key')

    // A surface reached from another surface is exactly what the key is for.
    const reachedFrom = structuredClone(report)
    reachedFrom.model.interfaces[0]!.entryPoints.push({ type: other, path: 'shop report' })
    expect(sdk.validateProductReport(reachedFrom).filter(issue => /entry point/.test(issue))).toEqual([])
  })

  it('rejects an older Product Report without normalization, in one sentence', () => {
    const older = structuredClone(report) as Record<string, any>
    older.schemaVersion = '17.0.0'
    expect(sdk.ProductReportSchema.safeParse(older).success).toBe(false)
    expect(() => sdk.parseProductReport(older)).toThrow(
      `This is a Product Report of schema version 17.0.0; only ${sdk.REPORT_SCHEMA_VERSION} is accepted`
    )
    // Any other shape failure names the first offending path, never Zod's issue array.
    const shapeless = structuredClone(report) as Record<string, any>
    shapeless.model.entities[0].acts = 'sideways'
    expect(() => sdk.parseProductReport(shapeless)).toThrow(/^This is not a valid Product Report: at model\.entities\.0\.acts, /)
  })

  it('refuses an empty grant condition value on the wire', () => {
    const empty = structuredClone(report)
    const rule = empty.model.businessRules.find(item => item.id === 'refunds-need-an-operator')!
    rule.permits![0]!.when[0]!.value = ''
    expect(sdk.ProductReportSchema.safeParse(empty).success).toBe(false)
  })
})

describe('a removal that goes with another, on the wire', () => {
  const FIXTURE = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'fixture-shop')
  let root: string
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'pdd-kit-with-'))
    cpSync(FIXTURE, root, { recursive: true })
    /* A refund that holds its follow-ups, so two refunds removed in one Step
       have a declared direction: the follow-up goes with the refund. */
    const refund = join(root, 'product-model/entities/refund.md')
    writeFileSync(refund, readFileSync(refund, 'utf8').replace('domain: ordering\n', 'domain: ordering\nrelations:\n  - entity: refund\n    verb: is followed by\n    cardinality: one-to-many\n'))
    const file = join(root, 'product-model/capabilities/place-order/scenarios/complete-checkout.md')
    writeFileSync(file, readFileSync(file, 'utf8').replace(
      '      - { entity: cart, effect: removes }\n',
      '      - { entity: cart, effect: removes }\n      - { entity: refund, as: original, effect: removes, from: Requested }\n      - { entity: refund, as: follow-up, effect: removes, from: Requested, with: original }\n'
    ))
  })
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  function goingWith(report: ProductReport) {
    return report.model.capabilityScenarios
      .flatMap(scenario => scenario.steps.flatMap(step => step.entities))
      .filter(entry => entry.with !== null)
  }

  it('resolves the reference to the record it goes with, and every other record carries null', () => {
    const report = compileReport(loadModel(root), '2026-01-01')
    expect(goingWith(report)).toEqual([expect.objectContaining({ entityId: 'refund', as: 'follow-up', effect: 'removes', with: { entityId: 'refund', as: 'original' } })])
    expect(sdk.validateProductReport(report)).toEqual([])
  })

  it('refuses a "with" naming no removal of the step', () => {
    const report = compileReport(loadModel(root), '2026-01-01')
    const [entry] = goingWith(report)
    entry!.with = { entityId: 'order', as: null }
    expect(sdk.validateProductReport(report).join('\n')).toContain('must name another record of this step with the same effect')
  })

  it('refuses a "with" toward an Entity that declares no holding relation', () => {
    const report = compileReport(loadModel(root), '2026-01-01')
    const refund = report.model.entities.find(entity => entity.id === 'refund')!
    refund.relations = refund.relations.map(relation => ({ ...relation, cardinality: 'many-to-many' }))
    expect(sdk.validateProductReport(report).join('\n')).toContain('"refund" goes with "refund", but "refund" declares no one-to-many or one-to-one relation to "refund"')
  })

  it('round-trips through open: the folder names the same record the report resolved', () => {
    const report = compileReport(loadModel(root), '2026-01-01')
    const target = mkdtempSync(join(tmpdir(), 'pdd-kit-with-open-'))
    try {
      expandProductReport(target, report, false)
      const again = compileReport(loadModel(target), '2026-01-01')
      expect(goingWith(again).map(entry => [entry.entityId, entry.as, entry.with])).toEqual(goingWith(report).map(entry => [entry.entityId, entry.as, entry.with]))
    } finally {
      rmSync(target, { recursive: true, force: true })
    }
  })

  it('refuses two records of a step with one reference', () => {
    const report = compileReport(loadModel(root), '2026-01-01')
    const [entry] = goingWith(report)
    entry!.as = 'cart'
    expect(sdk.validateProductReport(report).join('\n')).toContain('entity references contains duplicate "cart"')
  })
})

describe('a Journey on the wire', () => {
  const FIXTURE = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'fixture-shop')

  it('refuses an achieved Journey Scenario that carries no one Journey Actor through two Capabilities, as lint does', () => {
    const report = compileReport(loadModel(FIXTURE), '2026-01-01')
    expect(sdk.validateProductReport(report)).toEqual([])
    const scenario = report.model.journeyScenarios.find(item => item.result === 'achieved')!
    const capabilities = [...new Set(scenario.steps.flatMap(step => step.capabilityId ? [step.capabilityId] : []))]
    expect(capabilities.length).toBeGreaterThanOrEqual(2)
    // Every Step after the first Capability's is no longer the Journey Actor's.
    for (const step of scenario.steps) {
      if (step.capabilityId && step.capabilityId !== capabilities[0] && step.kind !== 'actor') step.actorId = null
    }
    for (const step of scenario.steps) {
      if (step.capabilityId && step.capabilityId !== capabilities[0] && step.kind === 'actor') {
        step.kind = 'product'
        step.actorId = null
      }
    }
    expect(sdk.validateProductReport(report).join('\n')).toContain('an achieved Journey Scenario must carry one Journey Actor through at least two Capabilities')
  })
})
