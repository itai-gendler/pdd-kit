import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileReport } from '../src/commands/export.js'
import { loadModel } from '../src/core/model.js'
import type { ProductReport } from '../src/core/portable.js'
import { compareReports, diffWords, phraseText, type ListChange, type StepsChange, type TextChange } from '../src/report-compare.js'

const BASE = compileReport(loadModel(join(__dirname, 'fixtures', 'fixture-shop')), '2026-10-15')
const copy = (): ProductReport => structuredClone(BASE)
const resourceCount = Object.values(BASE.counts).reduce((sum, count) => sum + count, 0)

describe('compareReports', () => {
  it('finds nothing between a report and itself, whatever its generation metadata', () => {
    const later = copy()
    later.generatedAt = '2027-01-01'
    later.generator = { name: 'pdd-kit', version: '99.0.0' }
    /* Collection order is not identity: a reordered collection changes nothing. */
    later.model.capabilities.reverse()
    const comparison = compareReports(BASE, later)
    expect(comparison.changes).toEqual([])
    expect(comparison.counts).toEqual({ added: 0, modified: 0, removed: 0 })
    expect(comparison.unchanged).toBe(resourceCount + 1)
  })

  it('identifies resources by kind and id, so a changed id is a removal and an addition', () => {
    const after = copy()
    after.model.capabilities.find(item => item.id === 'track-order')!.id = 'follow-order'
    const changes = compareReports(BASE, after).changes.filter(change => change.kind === 'capability')
    expect(changes.map(change => [change.key, change.status])).toEqual([
      ['capability:follow-order', 'added'],
      ['capability:track-order', 'removed']
    ])
  })

  it('reports added, modified and removed resources with counts per kind', () => {
    const after = copy()
    after.model.capabilities = after.model.capabilities.filter(item => item.id !== 'merge-orders')
    after.model.capabilityScenarios = after.model.capabilityScenarios.filter(item => item.capabilityId !== 'merge-orders')
    after.model.capabilities.push({ ...structuredClone(after.model.capabilities[0]!), id: 'archive-order', title: 'Archive order' })
    const order = after.model.entities.find(item => item.id === 'order')!
    order.states.push({ name: 'Archived', content: 'Kept for the record and hidden from lists.' })
    order.informationKept.push({ name: 'When archived', description: 'When it left the lists' })

    const comparison = compareReports(BASE, after)
    expect(comparison.counts).toEqual({ added: 1, modified: 1, removed: 2 })
    expect(comparison.byKind).toEqual({
      entity: { added: 0, modified: 1, removed: 0 },
      capability: { added: 1, modified: 0, removed: 1 },
      'capability-scenario': { added: 0, modified: 0, removed: 1 }
    })
    const entity = comparison.changes.find(change => change.key === 'entity:order')!
    expect(entity.fields.map(field => field.field)).toEqual(['informationKept', 'states'])
    expect(entity.phrases.map(phraseText)).toEqual([
      'Order gains the State Archived',
      'Order gains the fact When archived'
    ])
    const removedScenario = comparison.changes.find(change => change.kind === 'capability-scenario')!
    expect(removedScenario).toMatchObject({ status: 'removed', parent: { kind: 'capability', id: 'merge-orders', removed: true } })
    expect(phraseText(removedScenario.phrases[0]!)).toBe('Capability Scenario Merge duplicate orders was removed from Order merging')
  })

  it('says whom an added Capability serves, from its Scenarios', () => {
    const after = copy()
    after.model.capabilities.push({ ...structuredClone(after.model.capabilities[0]!), id: 'archive-order', title: 'Archive order' })
    after.model.capabilityScenarios.push({ ...structuredClone(after.model.capabilityScenarios[0]!), id: 'archive-an-order', capabilityId: 'archive-order', actorIds: ['store-admin'] })
    const change = compareReports(BASE, after).changes.find(item => item.key === 'capability:archive-order')!
    expect(phraseText(change.phrases[0]!)).toBe('New Capability Archive order, for Store admin')
  })

  it('lines Scenario Steps up like a diff and diffs prose word by word', () => {
    const after = copy()
    const scenario = after.model.capabilityScenarios.find(item => item.id === 'complete-checkout')!
    const steps = scenario.steps
    steps.splice(2, 0, { ...structuredClone(steps[2]!), text: 'The shopper picks a delivery slot', entities: [] })
    steps[4]!.text = 'The payment gateway is asked to charge the discounted total'
    steps[5]!.entities = []
    scenario.outcome = 'The order is stored as pending, awaiting settlement, and a receipt is emailed.'

    const change = compareReports(BASE, after).changes.find(item => item.key === 'capability-scenario:complete-checkout')!
    const aligned = (change.fields.find(field => field.shape === 'steps') as StepsChange).steps
    expect(aligned.map(step => [step.status, step.beforeIndex, step.afterIndex])).toEqual([
      ['same', 1, 1],
      ['same', 2, 2],
      ['added', null, 3],
      ['same', 3, 4],
      ['modified', 4, 5],
      ['modified', 5, 6]
    ])
    expect(aligned[4]!.text.filter(segment => segment.op !== 'same').map(segment => [segment.op, segment.text.trim()]))
      .toEqual([['added', 'discounted']])
    expect(aligned[5]!.details.map(detail => detail.label)).toEqual(['Entity effects'])

    const outcome = change.fields.find(field => field.field === 'outcome') as TextChange
    expect(outcome.segments.filter(segment => segment.op === 'same').map(segment => segment.text).join('')).toContain('The order is stored as pending, awaiting settlement, and a')
    expect(change.phrases.map(phraseText)).toEqual([
      'Complete checkout adds 1 Step and changes 2 Steps and its outcome in Checkout'
    ])
  })

  it('reads prose as it reads, not as it is wrapped', () => {
    const before = copy()
    const after = copy()
    const capability = (report: ProductReport) => report.model.capabilities.find(item => item.id === 'track-order')!
    capability(before).description = 'A shopper follows an order\nfrom checkout to delivery.\n\n- by email\n- on the site'
    capability(after).description = 'A shopper follows an order from checkout\nto delivery.\n\n- by email\n- on the site'
    expect(compareReports(before, after).changes).toEqual([])
    capability(after).description = 'A shopper follows an order from checkout\nto its delivery.\n\n- by email\n- on the site'
    const text = compareReports(before, after).changes[0]!.fields[0] as TextChange
    expect(text.after).toBe('A shopper follows an order from checkout to its delivery.\n\n- by email\n- on the site')
    expect(text.segments.filter(segment => segment.op !== 'same').map(segment => [segment.op, segment.text.trim()])).toEqual([['added', 'its']])
  })

  it('keeps code blocks, indented code and hard breaks as written', () => {
    const before = copy()
    const after = copy()
    const capability = (report: ProductReport) => report.model.capabilities.find(item => item.id === 'track-order')!
    capability(before).description = 'Run it:\n\n```\na = 1\nb = 2\n```'
    capability(after).description = 'Run it:\n\n```\na = 1 b = 2\n```'
    const text = compareReports(before, after).changes[0]!.fields[0] as TextChange
    expect(text.before).toBe('Run it:\n\n```\na = 1\nb = 2\n```')
    capability(before).description = 'First line  \nsecond line\n\n    indented\n    code'
    capability(after).description = 'First line second line\n\n    indented code'
    expect(compareReports(before, after).changes[0]!.fields[0]).toMatchObject({ before: 'First line  \nsecond line\n\n    indented\n    code' })
  })

  it('tells a Rule making no authorization claim from one forbidding everyone', () => {
    const before = copy()
    const after = copy()
    const rule = (report: ProductReport) => report.model.businessRules.find(item => item.id === 'refunds-need-an-operator')!
    rule(before).permits = null
    rule(after).permits = []
    const field = (from: ProductReport, to: ProductReport) => compareReports(from, to).changes.find(item => item.key === 'rule:refunds-need-an-operator')!.fields
    expect(field(before, after)).toMatchObject([{ shape: 'value', field: 'permits', before: 'No authorization claim', after: 'Forbidden to everyone' }])
    expect(field(after, before)).toMatchObject([{ shape: 'value', field: 'permits', before: 'Forbidden to everyone', after: 'No authorization claim' }])
  })

  it('names a configured grant by the Entity whose configuration picks who may', () => {
    const after = copy()
    after.model.businessRules.find(item => item.id === 'refunds-need-an-operator')!.permits!
      .push({ actorIds: [], related: [], self: false, when: [], unattended: false, configuredByEntityId: 'order' })
    const permits = compareReports(BASE, after).changes.find(item => item.key === 'rule:refunds-need-an-operator')!.fields[0] as ListChange
    expect(permits.added.map(item => item.label)).toEqual(['whoever Order configures'])
  })

  it('tells apart Rule targets that differ only in the facts they select', () => {
    const before = copy()
    const rule = before.model.businessRules.find(item => item.id === 'orders-are-never-deleted')!
    const target = (facts: string[]) => ({ type: 'entity', entityId: 'order', effect: 'changes', from: null, to: null, facts, contexts: [] }) as unknown as typeof rule.appliesTo[number]
    rule.appliesTo.push(target(['Subtotal']), target(['Total charged']))
    const after = structuredClone(before)
    after.model.businessRules.find(item => item.id === 'orders-are-never-deleted')!.appliesTo.pop()
    const targets = compareReports(before, after).changes.find(item => item.key === 'rule:orders-are-never-deleted')!.fields[0] as ListChange
    expect(targets.removed.map(item => item.label)).toEqual(['Order changes · Total charged'])
  })

  it('reads Steps too many to line up as replaced between their unchanged ends', () => {
    const before = copy()
    const scenario = (report: ProductReport) => report.model.capabilityScenarios.find(item => item.id === 'complete-checkout')!
    const template = scenario(before).steps[0]!
    scenario(before).steps = Array.from({ length: 600 }, (_, index) => ({ ...structuredClone(template), text: `Step number ${index}`, entities: [] }))
    const after = structuredClone(before)
    scenario(after).steps[300]!.text = 'A rewritten step'
    const steps = (compareReports(before, after).changes.find(item => item.key === 'capability-scenario:complete-checkout')!.fields
      .find(field => field.shape === 'steps') as StepsChange).steps
    expect(steps.filter(step => step.status !== 'same').map(step => [step.status, step.beforeIndex, step.afterIndex])).toEqual([
      ['removed', 301, null], ['added', null, 301]
    ])
    expect(steps).toHaveLength(601)
  })

  it('says what changed about a list member kept under the same name', () => {
    const after = copy()
    const entity = after.model.entities.find(item => (item.states?.length ?? 0) > 0)!
    const state = entity.states![0]!
    state.content = `${state.content} Now final.`.trim()
    const states = compareReports(BASE, after).changes.find(change => change.key === `entity:${entity.id}`)!.fields.find(field => field.field === 'states') as ListChange
    expect(states.changed).toHaveLength(1)
    expect(states.changed[0]!.details.map(detail => [detail.shape, detail.label])).toEqual([['text', 'Content']])
  })

  it('reads a new Step before a rewritten one as an insertion, not as two rewrites', () => {
    const after = copy()
    const steps = after.model.capabilityScenarios.find(item => item.id === 'complete-checkout')!.steps
    const last = steps.length - 1
    steps.splice(last, 0, { ...structuredClone(steps[last]!), text: 'The shopper is offered gift wrapping', entities: [] })
    steps[last + 1]!.text = steps[last + 1]!.text.replace('and the cart is emptied', 'and the cart is cleared')
    const change = compareReports(BASE, after).changes.find(item => item.key === 'capability-scenario:complete-checkout')!
    const aligned = (change.fields.find(field => field.shape === 'steps') as StepsChange).steps
    expect(aligned.slice(-2).map(step => [step.status, step.beforeIndex, step.afterIndex])).toEqual([
      ['added', null, last + 1],
      ['modified', last + 1, last + 2]
    ])
    expect(aligned.at(-1)!.text.filter(segment => segment.op !== 'same').map(segment => [segment.op, segment.text])).toEqual([
      ['removed', 'emptied'], ['added', 'cleared']
    ])
  })

  it('says what a Business Rule now applies to', () => {
    const after = copy()
    after.model.businessRules.find(rule => rule.id === 'orders-are-never-deleted')!.appliesTo.push({ type: 'capability', id: 'merge-orders', contexts: [] })
    const change = compareReports(BASE, after).changes.find(item => item.key === 'rule:orders-are-never-deleted')!
    expect(phraseText(change.phrases[0]!)).toBe('Rule Orders are never deleted now also applies to Order merging')
    expect((change.fields[0] as ListChange).added.map(item => `${item.ref?.kind}:${item.ref?.id}`)).toEqual(['capability:merge-orders'])
  })

  it('reports Coverage, limitations, References and taxonomies on the Product', () => {
    const after = copy()
    after.limitations = [...after.limitations, 'Returns are not modelled yet.']
    after.coverage.unmapped = [...after.coverage.unmapped, { description: 'Returns', paths: ['src/returns'] }]
    after.references = [...after.references, { kind: 'doc', role: 'context', target: 'https://example.com/returns', title: 'Returns policy' }]
    after.model.taxonomies.scenarioKinds = after.model.taxonomies.scenarioKinds.slice(1)
    const product = compareReports(BASE, after).changes.find(change => change.kind === 'product')!
    expect(product.status).toBe('modified')
    expect(product.fields.map(field => field.label)).toEqual(['Scenario kinds', 'Limitations', 'Unmapped', 'References'])
  })

  it('says when an authored order changes', () => {
    const after = copy()
    after.model.entities.find(item => item.id === 'order')!.states.reverse()
    const change = compareReports(BASE, after).changes.find(item => item.key === 'entity:order')!
    expect(change.fields).toMatchObject([{ field: 'states', reordered: true, added: [], removed: [] }])
  })

  it('reads a model created after the baseline as all additions, and one deleted since as all removals', () => {
    const created = compareReports(null, BASE)
    expect(created).toMatchObject({ before: false, after: true, counts: { added: resourceCount + 1, modified: 0, removed: 0 } })
    const deleted = compareReports(BASE, null)
    expect(deleted).toMatchObject({ before: true, after: false, counts: { added: 0, modified: 0, removed: resourceCount + 1 } })
    expect(compareReports(null, null).changes).toEqual([])
  })

  it('is deterministic', () => {
    const after = copy()
    after.model.entities.find(item => item.id === 'order')!.description = 'Something a shopper buys, once paid.'
    expect(JSON.stringify(compareReports(BASE, after))).toBe(JSON.stringify(compareReports(structuredClone(BASE), structuredClone(after))))
  })
})

describe('diffWords', () => {
  it('rejoins to the before text word for word and to the after text exactly', () => {
    const before = 'The page is a bookmark with its title, any note and tags.'
    const after = 'The page is a bookmark in the library with its title, any note and tags, and a collection.'
    const segments = diffWords(before, after)
    const words = (text: string) => text.split(/\s+/).filter(Boolean)
    expect(words(segments.filter(segment => segment.op !== 'added').map(segment => segment.text).join(''))).toEqual(words(before))
    expect(segments.filter(segment => segment.op !== 'removed').map(segment => segment.text).join('')).toBe(after)
  })

  it('keeps a word that moved to the end of the sentence', () => {
    expect(diffWords('or Unsorted when none was chosen', 'or the suggested one, or Unsorted'))
      .toEqual([{ op: 'same', text: 'or ' }, { op: 'added', text: 'the suggested one, or ' }, { op: 'same', text: 'Unsorted' }, { op: 'removed', text: ' when none was chosen' }])
  })

  it('says replaced rather than computing an enormous table', () => {
    const before = Array.from({ length: 800 }, (_, index) => `a${index}`).join(' ')
    const after = Array.from({ length: 800 }, (_, index) => `b${index}`).join(' ')
    expect(diffWords(before, after).map(segment => segment.op)).toEqual(['removed', 'added'])
  })
})
