import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileReport } from '../src/commands/export.js'
import { lintModel } from '../src/commands/lint.js'
import { expandProductReport } from '../src/commands/open.js'
import { loadModel, type PddModel } from '../src/core/model.js'
import { projectPortableReport, validateProductReport, type ProductReport } from '../src/core/portable.js'
import { validatePermissionBehavior, type PermissionGrant, type PermissionOperation } from '../src/core/permission-validation.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')
const SCENARIO = 'cancel-your-own-unpaid-order'
const RULE = 'who-may-change-an-order'
const TRACKED = [
  'README.md', 'src/routes/storefront.ts', 'src/routes/admin.ts',
  'src/services/catalog.ts', 'src/services/orders.ts', 'src/services/payments.ts',
  'src/models/product.ts', 'src/models/order.ts'
]
let repo: string
let original: PddModel
let report: ProductReport

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'pdd-kit-unattended-'))
  cpSync(FIXTURE, repo, { recursive: true })
  original = loadModel(repo)
  report = compileReport(original, '2026-01-01')
})

afterAll(() => rmSync(repo, { recursive: true, force: true }))

function mixedRun() {
  const folder = structuredClone(original)
  const portable = structuredClone(report)
  const scenario = folder.capabilityScenarios.find(item => item.id === SCENARIO)!
  const wire = portable.model.capabilityScenarios.find(item => item.id === SCENARIO)!
  const step = scenario.steps[2]!
  const wireStep = wire.steps[2]!
  delete step.actor
  step.unattended = true
  wireStep.actorId = null
  wireStep.unattended = true
  scenario.steps.push({
    text: 'The Product shows the shopper their refund', kind: 'product', actor: 'shopper',
    entities: [{ entity: 'refund', effect: 'reads', facts: [] }], contexts: structuredClone(step.contexts)
  })
  wire.steps.push({
    text: 'The Product shows the shopper their refund', kind: 'product', actorId: 'shopper',
    capabilityId: 'cancel-order', unattended: false,
    entities: [{ entityId: 'refund', as: null, effect: 'reads', from: null, to: null, facts: [], with: null }],
    contexts: structuredClone(wireStep.contexts)
  })
  return { folder, portable, scenario, wire, step, wireStep }
}

type Run = ReturnType<typeof mixedRun>
const cases: Array<{ name: string, mutate: (run: Run) => void, error: string }> = [
  {
    name: 'unmarked actorless governed operation',
    mutate: ({ step, wireStep }) => { delete step.unattended; wireStep.unattended = false },
    error: 'needs an actor'
  },
  {
    name: 'missing unattended grant',
    mutate: ({ folder, portable }) => {
      const rule = folder.businessRules.find(item => item.id === RULE)!
      rule.permits = rule.permits!.filter(grant => !grant.unattended)
      const wireRule = portable.model.businessRules.find(item => item.id === RULE)!
      wireRule.permits = wireRule.permits!.filter(grant => !grant.unattended)
    },
    error: 'has no "unattended" grant for it'
  },
  {
    name: 'explicit prohibition',
    mutate: ({ folder, portable }) => {
      folder.businessRules.find(item => item.id === RULE)!.permits = []
      portable.model.businessRules.find(item => item.id === RULE)!.permits = []
    },
    error: 'forbids to everyone'
  },
  {
    name: 'wrong known origin state',
    mutate: ({ folder, portable }) => {
      folder.businessRules.find(item => item.id === RULE)!.permits!.find(grant => grant.unattended)!.when = [{ state: 'Confirmed' }]
      portable.model.businessRules.find(item => item.id === RULE)!.permits!.find(grant => grant.unattended)!.when = [
        { state: 'Confirmed', entityId: null, fact: null, operator: null, value: null }
      ]
    },
    error: 'has no "unattended" grant for it'
  },
  {
    name: 'Product Step actor plus unattended',
    mutate: ({ step, wireStep }) => { step.actor = 'shopper'; wireStep.actorId = 'shopper' },
    error: 'an unattended Step names no actor'
  },
  {
    name: 'actor-kind Step plus unattended',
    mutate: ({ step, wireStep }) => { step.kind = 'actor'; wireStep.kind = 'actor' },
    error: 'a later "unattended" marker requires an actorless Product Step in an actor-led Scenario'
  },
  {
    name: 'later condition plus unattended',
    mutate: ({ step, wireStep }) => { step.kind = 'condition'; wireStep.kind = 'condition' },
    error: 'a later "unattended" marker requires an actorless Product Step in an actor-led Scenario'
  },
  {
    name: 'first flagged Product Step',
    mutate: ({ scenario, wire }) => {
      scenario.steps[0]!.kind = 'product'; scenario.steps[0]!.unattended = true
      wire.steps[0]!.kind = 'product'; wire.steps[0]!.unattended = true
    },
    error: 'an unattended trigger must be a condition Step'
  },
  {
    name: 'later marker without an actor Step',
    mutate: ({ scenario, wire }) => { scenario.steps[1]!.kind = 'product'; wire.steps[1]!.kind = 'product' },
    error: 'a later "unattended" marker requires an actorless Product Step in an actor-led Scenario'
  },
  ...(['actors', 'related', 'self'] as const).map(selector => ({
    name: `unattended grant AND ${selector}`,
    mutate: ({ folder, portable }: Run) => {
      const grant = folder.businessRules.find(item => item.id === RULE)!.permits!.find(item => item.unattended)!
      const wireGrant = portable.model.businessRules.find(item => item.id === RULE)!.permits!.find(item => item.unattended)!
      if (selector === 'actors') { grant.actors = ['shopper']; wireGrant.actorIds = ['shopper'] }
      if (selector === 'related') {
        grant.related = [{ verb: 'owns', entity: 'shopper' }]
        wireGrant.related = [{ verb: 'owns', entityId: 'shopper' }]
      }
      if (selector === 'self') { grant.self = true; wireGrant.self = true }
    },
    error: 'has no "unattended" grant for it'
  }))
]

describe.each(['folder', 'portable'] as const)('%s unattended authority', format => {
  const errors = ({ folder, portable }: Run) => format === 'folder'
    ? lintModel(folder, TRACKED).errors
    : validateProductReport(portable)

  it('keeps Actor request, unattended continuation, and Actor result read in order', () => {
    expect(errors(mixedRun())).toEqual([])
  })

  it.each(cases)('rejects $name', ({ mutate, error }) => {
    const run = mixedRun()
    mutate(run)
    expect(errors(run).join('\n')).toContain(error)
  })

  it('preserves the existing wholly unattended Scenario', () => {
    expect(format === 'folder' ? lintModel(original, TRACKED).errors : validateProductReport(report)).toEqual([])
  })

  it('does not inherit unattended authority on a later actorless read', () => {
    const run = mixedRun()
    delete run.scenario.steps[3]!.actor
    run.wire.steps[3]!.actorId = null
    expect(errors(run).join('\n')).toContain('reads "refund", which rule "a-refund-is-visible-to-its-shopper" governs, so it needs an actor')
  })

  it('keeps configuredBy distinct from actor selectors', () => {
    const run = mixedRun()
    run.folder.businessRules.find(item => item.id === RULE)!.permits!.find(item => item.unattended)!.configuredBy = 'store-settings'
    run.portable.model.businessRules.find(item => item.id === RULE)!.permits!.find(item => item.unattended)!.configuredByEntityId = 'store-settings'
    expect(errors(run)).toEqual([])
  })
})

it('exports, projects, expands, and lints mixed authority without changing Step meaning', () => {
  const { folder, portable } = mixedRun()
  const exported = compileReport(folder, '2026-01-01')
  expect(exported).toEqual(portable)
  const target = mkdtempSync(join(tmpdir(), 'pdd-kit-unattended-open-'))
  try {
    expandProductReport(target, projectPortableReport(exported), false)
    const expanded = loadModel(target)
    expect(lintModel(expanded, []).errors).toEqual([])
    const roundTrip = compileReport(expanded, '2026-01-01')
    expect(roundTrip.model.capabilityScenarios).toEqual(exported.model.capabilityScenarios.map(scenario => ({
      ...scenario, references: scenario.references.filter(reference => reference.role !== 'implementation')
    })))
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})

describe('normalized permission authority', () => {
  const operation: PermissionOperation = {
    label: 'settlement', actorId: null, unattended: true, entityId: 'shopper', alias: null,
    effect: 'changes', from: 'Pending', to: 'Settled', facts: [], contextPlaces: [], goesWith: false
  }
  const grant: PermissionGrant = { actorIds: [], relatedActorId: null, self: false, unattended: true, stateConditions: ['Pending'] }
  const errors = (op: PermissionOperation, grants = [grant]) => validatePermissionBehavior({
    operations: [op], screens: [], rules: [{
      id: 'settlement-permission', grants,
      targets: [{ entityId: 'shopper', effect: 'changes', from: null, to: null, facts: [], contextPlaces: [] }]
    }]
  })

  it('permits an explicitly unattended settlement', () => expect(errors(operation)).toEqual([]))
  it('rejects contradictory actor and unattended authority before grants', () => {
    expect(errors({ ...operation, actorId: 'shopper' }).join('\n')).toContain('an unattended operation names no actor')
  })
  it.each([
    { ...grant, actorIds: ['shopper'] },
    { ...grant, relatedActorId: 'shopper' },
    { ...grant, self: true }
  ])('preserves AND for every actor selector with unattended', contradictory => {
    expect(errors(operation, [contradictory]).join('\n')).toContain('has no "unattended" grant for it')
  })
})
