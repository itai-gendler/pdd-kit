/** Resource readings separate explanation, behavior, relationships and references. */
import type { AnyResourceView, ReportWorkspace } from './reportWorkspace'
import { counterpartsOf, isScenarioKind } from './reportWorkspace'
import { structureChildren } from './collectionChildren'
import { resourceConnectionRows } from './resourceConnections'
import { attachedRules } from './topologyTargets'

export type PageBlockId =
  | 'lead'
  | 'facts'
  | 'audience'
  | 'contexts'
  | 'detail'
  | 'counterparts'
  | 'selection'
  | 'alternatives'
  | 'variation-choice'
  | 'connections'
  | 'structure'
  | 'rule-scope'
  | 'rules'
  | 'supporting'
  | 'references'

export type PageTabId = 'overview' | 'changes' | 'applies-to' | 'alternatives' | 'delivery' | 'scenarios' | 'lifecycle' | 'rules' | 'connections' | 'references'

export interface PageTab {
  id: PageTabId
  label: string
  count?: number
  blocks: PageBlockId[]
}

/* Whether ReportResourceBody would render anything. */
export function hasAuthoredBody(resource: AnyResourceView): boolean {
  if (isScenarioKind(resource.kind)) return true
  if (resource.kind === 'screen' || resource.kind === 'entity' || resource.kind === 'journey') return true
  if (resource.kind === 'rule') return Boolean(resource.rationale || resource.intent || resource.permits !== null)
  if (resource.intent) return true
  return resource.kind === 'capability'
}

export function childrenOf(workspace: ReportWorkspace, resource: AnyResourceView): AnyResourceView[] {
  if (resource.kind === 'capability') return workspace.scenariosByCapability.get(resource.id) ?? []
  if (resource.kind === 'journey') return workspace.scenariosByJourney.get(resource.id) ?? []
  return []
}

/**
 * A Scenario is read inside its parent: its address shares the parent's readings, References included.
 * `changed` says how many changes a comparison holds for a resource, its Scenarios included; while
 * comparing, a resource with any reads them on a Changes tab after its Overview.
 */
export function tabsFor(workspace: ReportWorkspace, requestedResource: AnyResourceView, changed?: (key: string) => number): PageTab[] {
  const resource = parentOf(workspace, requestedResource) ?? requestedResource
  const overviewBlocks: PageBlockId[] = ['lead', 'facts']
  if ((resource.kind === 'interface' || resource.kind === 'experience') && resource.actorIds.length) overviewBlocks.push('audience')

  /* Only authored Capability Contexts belong in an Overview. */
  const hasOverviewContexts = resource.kind === 'capability' && resource.contexts.length > 0
  const hasEntryPoints = resource.kind === 'journey' && resource.entryPoints.length > 0
  if (hasOverviewContexts || hasEntryPoints) overviewBlocks.push('contexts')

  /* A set says how one is chosen; an alternative says how it is chosen. */
  if (resource.kind === 'variation') overviewBlocks.push('selection')
  if (resource.variation) overviewBlocks.push('variation-choice')

  if (hasAuthoredBody(resource)) overviewBlocks.push('detail')

  if (counterpartsOf(workspace, resource).length) overviewBlocks.push('counterparts')
  if (resource.supportingContent) overviewBlocks.push('supporting')

  const tabs: PageTab[] = [{
    id: 'overview',
    label: 'Overview',
    blocks: overviewBlocks
  }]

  const changes = changed?.(resource.key) ?? 0
  if (changes) tabs.push({ id: 'changes', label: 'Changes', count: changes, blocks: [] })

  /* A Variation's alternatives, each in its own words. */
  if (resource.kind === 'variation') tabs.push({ id: 'alternatives', label: 'Alternatives', count: resource.alternatives.length, blocks: ['alternatives'] })

  /* What a Rule governs: its own reading, beside its statement. */
  if (resource.kind === 'rule') tabs.push({ id: 'applies-to', label: 'Applies to', count: resource.appliesTo.length, blocks: ['rule-scope'] })

  /* Delivery: the place's own branch of the Interfaces tree — its Capabilities with the Scenarios that happen there, then what it holds. */
  if (structureChildren(workspace, resource).length) tabs.push({ id: 'delivery', label: 'Delivery', blocks: ['structure'] })

  const children = childrenOf(workspace, resource)
  if (resource.kind === 'capability' || resource.kind === 'journey') {
    tabs.push({ id: 'scenarios', label: 'Scenarios', count: children.length, blocks: [] })
  }
  if (resource.kind === 'entity' && resource.states.length) {
    tabs.push({ id: 'lifecycle', label: 'Lifecycle', blocks: [] })
  }
  /* The Rules that name it, each saying how: its own reading, so a reader who asks "what constrains this?" finds it by name. */
  const rules = attachedRules(workspace, resource)
  if (rules.length) tabs.push({ id: 'rules', label: 'Business Rules', count: rules.length, blocks: ['rules'] })
  if (resourceConnectionRows(workspace, resource).length) {
    tabs.push({ id: 'connections', label: 'Connections', blocks: ['connections'] })
  }
  if (resource.references.length) {
    tabs.push({ id: 'references', label: 'References', count: resource.references.length, blocks: ['references'] })
  }

  return tabs
}

/** The parent of a Scenario — the page a Scenario is read inside. */
export function parentOf(workspace: ReportWorkspace, resource: AnyResourceView): AnyResourceView | null {
  if (!isScenarioKind(resource.kind)) return null
  const scenario = resource as { scenarioType: string, capabilityId: string, journeyId: string }
  const key = scenario.scenarioType === 'capability'
    ? `capability:${scenario.capabilityId}`
    : `journey:${scenario.journeyId}`
  return workspace.byKey.get(key) ?? null
}
