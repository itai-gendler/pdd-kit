import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileReport } from '../src/commands/export.js'
import { loadModel } from '../src/core/model.js'
import type { ProductReport } from '../src/core/portable.js'

const utility = (name: string) => import(`../layers/nuxt/report-viewer/app/utils/${name}.ts`)
const { projectReportWorkspace } = await utility('reportWorkspace')
const { buildComparisonContext, changeEntries } = await utility('reportComparison')

const BASE = compileReport(loadModel(join(__dirname, 'fixtures', 'fixture-shop')), '2026-10-15')
const copy = (): ProductReport => structuredClone(BASE)
function entries(before: ProductReport | null, after: ProductReport) {
  const context = buildComparisonContext({ before, baseline: { label: 'main' } }, after)
  return changeEntries(context, projectReportWorkspace(after), context.comparison.changes)
}
const all = (groups: any[]) => groups.flatMap(group => group.entries)

describe('changeEntries', () => {
  it('reads what is new with its container inside it', () => {
    const after = copy()
    const capability = after.model.capabilities[0]!
    after.model.capabilities.push({ ...structuredClone(capability), id: 'archive-order', title: 'Archive order' })
    const scenarios = after.model.capabilityScenarios.filter(item => item.capabilityId === capability.id)
    after.model.capabilityScenarios.push(...scenarios.map(item => ({ ...structuredClone(item), id: `archive-${item.id}`, capabilityId: 'archive-order' })))
    const rows = all(entries(BASE, after))
    const added = rows.find(entry => entry.key === 'capability:archive-order')
    expect(added.folded.map((change: any) => change.kind)).toEqual(scenarios.map(() => 'capability-scenario'))
    expect(added.changes).toHaveLength(scenarios.length + 1)
    expect(rows.some(entry => entry.key.startsWith('capability-scenario:archive-'))).toBe(false)
  })

  it('reads a Domain merged into another as one merge and one move', () => {
    const before = copy()
    const ordering = before.model.domains[0]!
    before.model.domains.push({ ...structuredClone(ordering), id: 'billing', name: 'Billing' })
    const moved = before.model.capabilities.filter(item => item.domainId === ordering.id).slice(0, 2).map(item => item.id)
    for (const item of before.model.capabilities) if (moved.includes(item.id)) item.domainId = 'billing'
    const groups = entries(before, copy())
    const home = groups.find((group: any) => group.domainId === ordering.id)!
    expect(home.entries.map((entry: any) => entry.type)).toEqual(['change', 'move'])
    expect(home.entries[0].mergedInto.map((ref: any) => ref.id)).toEqual([ordering.id])
    expect(home.entries[1]).toMatchObject({ from: { id: 'billing' }, to: { id: ordering.id } })
    expect(home.entries[1].changes.map((change: any) => change.id).sort()).toEqual([...moved].sort())
    expect(home.count).toBe(3)
  })

  it('reads References updated on several resources of one type as one row', () => {
    const after = copy()
    const capabilities = after.model.capabilities.filter(item => item.domainId === after.model.domains[0]!.id).slice(0, 2)
    for (const item of capabilities) item.references = [...item.references ?? [], { kind: 'doc', role: 'context', target: 'docs/notes.md' }]
    const rows = all(entries(BASE, after))
    const references = rows.filter(entry => entry.type === 'references')
    expect(references).toHaveLength(1)
    expect(references[0].changes.map((change: any) => change.id).sort()).toEqual(capabilities.map(item => item.id).sort())
  })
})
