/**
 * The report's reading of a comparison between two authored models.
 *
 * The comparison itself is `pdd-toolkit/report/compare`: deterministic, tested
 * outside Vue, the same for every host. This file only decides how the report
 * draws it — which rows wear a mark and how changes group.
 */
import type { InjectionKey, Ref } from 'vue'
import type { ProductReport } from 'pdd-toolkit/report'
import { compareReports, type ChangeCounts, type ChangeStatus, type ComparedKind, type ComparedRef, type ReportComparison, type ResourceChange, type ValueChange } from 'pdd-toolkit/report/compare'
import type { AnyResourceView, ReportResourceKind, ReportWorkspace } from './reportWorkspace'
import { projectReportWorkspace } from './reportWorkspace'
import { collectionKindFor, resourceAncestors, resourceDomains } from './reportDestinations'

/** One side of a comparison, as the reader names it. */
export interface ComparisonSide {
  label: string
  /** The commit or version, short: `2c01812`. */
  revision?: string
  /** One line about it, such as its commit subject. */
  detail?: string
}

/** A version a reader can measure a scope from: a branch, a tag or a commit. `kind` picks its mark; the host names it. */
export interface ComparisonVersion {
  id: string
  kind: 'head' | 'branch-base' | 'branch' | 'tag' | 'commit'
  label: string
  revision?: string
  detail?: string
  /** ISO date, for commits and the refs pointing at them. */
  date?: string
  /** Short facts set apart from the name: `Default`. */
  badges?: string[]
}

/** What a scope can be measured from, picked in a short menu beside it. */
export interface ComparisonBase {
  /** The id of the version the scope is measured from now. */
  selected: string
  /** Branches and tags, the default branch first; `more` when the search should narrow them. */
  search: (query: string) => Promise<{ versions: ComparisonVersion[], more: boolean }>
  /** Offered after branches and tags, such as the commit that created the model. */
  extra: ComparisonVersion[]
  choose: (id: string) => void
}

/**
 * Which changes Changes shows: a few named scopes, never a diff builder. The
 * other side is always the report on screen. A scope's label names what it is
 * measured from, `Since origin/main`, and one scope may let the reader pick it.
 */
export interface ComparisonChoices {
  /** `count` is how many changes the scope holds, when the host knows it without switching. */
  scopes: Array<{ id: string, label: string, description: string, disabled?: boolean, count?: number, base?: ComparisonBase }>
  scope: string
  setScope: (id: string) => void
}

/** What a host hands the report to compare against. */
export interface ReportComparisonInput {
  /** The baseline report; null when the baseline holds no Product Model. */
  before: ProductReport | null
  /** Names the baseline wherever the comparison is on screen: `HEAD (main)`, `main`, `the merge base of main`. */
  baseline: ComparisonSide
  /** What the current side includes, in plain words: `Working tree · 1 staged, 2 unstaged`. */
  scope?: string
  /** Set when the baseline cannot be read: the report then says so instead of comparing. */
  unavailable?: { title: string, description: string }
  /** Set while the host reads a newly chosen version: nothing is compared until it arrives. */
  pending?: boolean
  /** What the reader can switch the comparison to. Absent, the comparison is fixed. */
  choices?: ComparisonChoices
}

export interface ComparisonContext {
  input: ReportComparisonInput
  comparison: ReportComparison
  /** The baseline projected like the current report, for removed resources' readings. */
  before: ReportWorkspace | null
  byKey: Map<string, ResourceChange>
  /** Scenario changes by the key of the Capability or Journey they are read inside. */
  children: Map<string, ResourceChange[]>
  /** Change counts per rail collection: a Screen counts under Interfaces, a Scenario under its parent's collection. */
  collections: Partial<Record<ReportResourceKind, ChangeCounts>>
  /** Resources whose Domain changed, by the Domain they moved into and the one they left. */
  moves: Map<string, { into: ResourceChange[], out: ResourceChange[] }>
}

export const REPORT_COMPARISON: InjectionKey<Ref<ComparisonContext | null>> = Symbol('pdd-kit:report-comparison')

/**
 * The comparison a host offers and whether the reader shows it. Off, nothing
 * is compared or marked, and `REPORT_COMPARISON` is null; the header's chip
 * still offers to turn it back on.
 */
export const REPORT_COMPARISON_SWITCH: InjectionKey<{ input: Ref<ReportComparisonInput | null>, enabled: Ref<boolean> }> = Symbol('pdd-kit:report-comparison-switch')

export const CHANGE_META: Record<ChangeStatus, { label: string, glyph: string, icon: string, verb: string }> = {
  added: { label: 'Added', glyph: '+', icon: 'i-lucide-plus', verb: 'added' },
  modified: { label: 'Modified', glyph: '~', icon: 'i-lucide-pencil-line', verb: 'modified' },
  removed: { label: 'Removed', glyph: '−', icon: 'i-lucide-minus', verb: 'removed' }
}
export const CHANGE_STATUSES: ChangeStatus[] = ['added', 'modified', 'removed']

/* In full up to 999, then as 1.2k; truncated, so the short form never claims more than there is. */
const compactCount = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1, roundingMode: 'trunc' })
export const compactChangeCount = (count: number): string => compactCount.format(count).toLowerCase()

/** A change read as the baseline had it, as the difference, or as the current model has it. */
export type ChangeReading = 'before' | 'changes' | 'after'

/** The comparison's kinds are the report's own; only the spelling of a Business Rule's is shared. */
export const viewerKind = (kind: ComparedKind): ReportResourceKind => kind as ReportResourceKind

export function buildComparisonContext(input: ReportComparisonInput, report: ProductReport): ComparisonContext {
  const comparison = input.unavailable || input.pending ? compareReports(report, report) : compareReports(input.before, report)
  const byKey = new Map(comparison.changes.map(change => [change.key, change]))
  const children = new Map<string, ResourceChange[]>()
  const collections: Partial<Record<ReportResourceKind, ChangeCounts>> = {}
  for (const change of comparison.changes) {
    if (change.parent) {
      const key = `${change.parent.kind}:${change.parent.id}`
      children.set(key, [...children.get(key) ?? [], change])
    }
    if (change.kind === 'product') continue
    const collection = collectionKindFor(viewerKind(change.kind))
    const counts = collections[collection] ??= { added: 0, modified: 0, removed: 0 }
    counts[change.status]++
  }
  const moves = new Map<string, { into: ResourceChange[], out: ResourceChange[] }>()
  for (const change of comparison.changes) {
    const move = domainMove(change)
    if (!move) continue
    for (const [ref, side] of [[move.to, 'into'], [move.from, 'out']] as const) {
      if (!ref) continue
      const entry = moves.get(`domain:${ref.id}`) ?? { into: [], out: [] }
      entry[side].push(change)
      moves.set(`domain:${ref.id}`, entry)
    }
  }
  return {
    input,
    comparison,
    before: input.before && !input.unavailable && !input.pending ? projectReportWorkspace(input.before) : null,
    byKey,
    children,
    collections,
    moves
  }
}

/** A change of the one Domain a resource is authored in: where it came from and where it went, either side possibly none. */
export function domainMove(change: ResourceChange): { from: ComparedRef | null, to: ComparedRef | null } | null {
  if (change.status !== 'modified') return null
  const field = change.fields.find((item): item is ValueChange => item.shape === 'value' && item.field === 'domainId')
  return field ? { from: field.beforeRef ?? null, to: field.afterRef ?? null } : null
}

/** One mark for a row: its own change, or a modification inside its Scenarios. */
export function changeMark(context: ComparisonContext | null, key: string): { status: ChangeStatus, label: string, title: string } | null {
  if (!context) return null
  const own = context.byKey.get(key)
  if (own) {
    const fields = own.fields.length
    return {
      status: own.status,
      label: own.status === 'modified' ? `${fields} ${fields === 1 ? 'field' : 'fields'}` : CHANGE_META[own.status].label,
      title: `${CHANGE_META[own.status].label} since ${context.input.baseline.label}`
    }
  }
  const children = context.children.get(key)
  if (children?.length) {
    return {
      status: 'modified',
      label: `${children.length} ${children.length === 1 ? 'Scenario' : 'Scenarios'}`,
      title: `Scenarios changed since ${context.input.baseline.label}`
    }
  }
  return null
}

/** The resource a change is read on: its own reading, or its parent's for a Scenario. Null for the Product, read on the Overview. */
export function readingKeyOf(change: ResourceChange): string | null {
  if (change.kind === 'product') return null
  if (change.parent) return `${change.parent.kind}:${change.parent.id}`
  return change.key
}

/** The resource as one side of the comparison shows it: current for additions and modifications, baseline for removals. */
export function changeResource(context: ComparisonContext, workspace: ReportWorkspace, change: ResourceChange): AnyResourceView | undefined {
  return change.status === 'removed' ? context.before?.byKey.get(change.key) : workspace.byKey.get(change.key)
}

export interface ChangeGroup {
  key: string
  title: string
  /** `domain` for a Domain group; null for the Product and the undomained. */
  kind: 'domain' | null
  domainId?: string
  changes: ResourceChange[]
}

/**
 * Changes grouped by Domain, the report's one grouping axis. The Product leads;
 * a change reaching no Domain is grouped last; a change in several Domains is
 * listed under each, as collections list it.
 */
export function changeGroups(context: ComparisonContext, workspace: ReportWorkspace, changes: ResourceChange[]): ChangeGroup[] {
  const product: ChangeGroup = { key: 'product', title: 'Product', kind: null, changes: [] }
  const none: ChangeGroup = { key: '', title: 'No Domain', kind: null, changes: [] }
  const domains = new Map<string, ChangeGroup>()
  const domainTitle = (id: string) => workspace.domains.find(domain => domain.id === id)?.title
    ?? context.before?.domains.find(domain => domain.id === id)?.title ?? id
  for (const change of changes) {
    if (change.kind === 'product') { product.changes.push(change); continue }
    if (change.kind === 'domain') {
      const group = domains.get(change.id) ?? { key: `domain:${change.id}`, title: domainTitle(change.id), kind: 'domain' as const, domainId: change.id, changes: [] }
      group.changes.push(change)
      domains.set(change.id, group)
      continue
    }
    const resource = changeResource(context, workspace, change)
    const side = change.status === 'removed' ? context.before ?? workspace : workspace
    const ids = resource ? resourceDomains(side, resource).map(domain => domain.id) : []
    if (!ids.length) { none.changes.push(change); continue }
    for (const id of ids) {
      const group = domains.get(id) ?? { key: `domain:${id}`, title: domainTitle(id), kind: 'domain' as const, domainId: id, changes: [] }
      group.changes.push(change)
      domains.set(id, group)
    }
  }
  /* Domains in the order the current model authors them, then any only the baseline had. */
  const order = [...workspace.domains.map(domain => domain.id), ...(context.before?.domains.map(domain => domain.id) ?? [])]
  const sorted = [...domains.values()].sort((a, b) => order.indexOf(a.domainId!) - order.indexOf(b.domainId!))
  return [product, ...sorted, none].filter(group => group.changes.length)
}

/** One row of the Changes list. Every entry names the changes it stands for, so the counts see through it. */
export type ChangeEntry =
  /** A resource's own change, with the changes of what it contains when they are the same — a new Capability with its new Scenarios. */
  | { type: 'change', key: string, change: ResourceChange, changes: ResourceChange[], folded: ResourceChange[], moved?: { from: ComparedRef | null, to: ComparedRef | null }, mergedInto?: ComparedRef[] }
  /** Resources whose only change is the Domain they belong to, by where they came from and went. */
  | { type: 'move', key: string, from: ComparedRef | null, to: ComparedRef | null, changes: ResourceChange[] }
  /** Resources of one type whose only change is their References. */
  | { type: 'references', key: string, kind: ComparedKind, changes: ResourceChange[] }

export interface ChangeEntryGroup extends Omit<ChangeGroup, 'changes'> {
  entries: ChangeEntry[]
  /** The changes the group's entries stand for. */
  count: number
}

const referencesOnly = (change: ResourceChange) => change.status === 'modified' && change.kind !== 'product'
  && change.fields.length > 0 && change.fields.every(field => field.field === 'references')
const moveOnly = (change: ResourceChange) => change.fields.length === 1 && Boolean(domainMove(change))
const refKey = (ref: ComparedRef) => `${viewerKind(ref.kind)}:${ref.id}`

/**
 * Changes as the list reads them: grouped by Domain like `changeGroups`, with
 * three foldings that say what happened instead of repeating it. What a new or
 * removed resource contains, added or removed with it, reads inside it. A
 * Domain reorganisation reads as moves, one row per Domain left and joined,
 * and a removed Domain whose resources all went to one other is listed there
 * as merged into it. Two or more resources of one type whose only change is
 * their References read as one row.
 */
export function changeEntries(context: ComparisonContext, workspace: ReportWorkspace, changes: ResourceChange[]): ChangeEntryGroup[] {
  const present = new Map(changes.map(change => [change.key, change]))

  /* A new or removed resource folds into the outermost container that is new or removed with it. */
  const foldedInto = new Map<string, string>()
  for (const change of changes) {
    if (change.status === 'modified' || change.kind === 'product') continue
    const side = change.status === 'removed' ? context.before : workspace
    const resource = changeResource(context, workspace, change)
    const ancestors = change.parent ? [refKey(change.parent)] : resource && side ? resourceAncestors(side, resource).map(item => item.key) : []
    const root = ancestors.find(key => present.get(key)?.status === change.status)
    if (root) foldedInto.set(change.key, root)
  }
  const folded = new Map<string, ResourceChange[]>()
  for (const [child, root] of foldedInto) folded.set(root, [...folded.get(root) ?? [], present.get(child)!])

  /* A removed Domain whose resources moved on, to where. */
  const targets = new Map<string, Map<string, ComparedRef>>()
  for (const change of changes) {
    const move = domainMove(change)
    if (!move?.from || !move.to || present.get(`domain:${move.from.id}`)?.status !== 'removed') continue
    const into = targets.get(move.from.id) ?? new Map<string, ComparedRef>()
    into.set(move.to.id, move.to)
    targets.set(move.from.id, into)
  }

  const product: ChangeEntryGroup = { key: 'product', title: 'Product', kind: null, entries: [], count: 0 }
  const none: ChangeEntryGroup = { key: '', title: 'No Domain', kind: null, entries: [], count: 0 }
  const domains = new Map<string, ChangeEntryGroup>()
  const domainTitle = (id: string) => workspace.domains.find(domain => domain.id === id)?.title
    ?? context.before?.domains.find(domain => domain.id === id)?.title ?? id
  const groupFor = (id: string | null): ChangeEntryGroup => {
    if (!id) return none
    const group = domains.get(id) ?? { key: `domain:${id}`, title: domainTitle(id), kind: 'domain' as const, domainId: id, entries: [], count: 0 }
    domains.set(id, group)
    return group
  }
  const placesOf = (change: ResourceChange): string[] => {
    if (change.kind === 'domain') return [change.id]
    const resource = changeResource(context, workspace, change)
    const side = change.status === 'removed' ? context.before ?? workspace : workspace
    return resource ? resourceDomains(side, resource).map(domain => domain.id) : []
  }

  const moves = new Map<string, Extract<ChangeEntry, { type: 'move' }>>()
  const references = new Map<ChangeEntryGroup, Map<ComparedKind, ResourceChange[]>>()
  for (const change of changes) {
    if (foldedInto.has(change.key)) continue
    if (change.kind === 'product') {
      product.entries.push({ type: 'change', key: change.key, change, changes: [change], folded: [] })
      continue
    }
    if (moveOnly(change)) {
      const move = domainMove(change)!
      const key = `move:${move.from?.id ?? ''}>${move.to?.id ?? ''}`
      const entry = moves.get(key) ?? { type: 'move' as const, key, from: move.from, to: move.to, changes: [] }
      if (!entry.changes.length) groupFor(move.to?.id ?? null).entries.push(entry)
      entry.changes.push(change)
      moves.set(key, entry)
      continue
    }
    const places = placesOf(change)
    if (referencesOnly(change)) {
      for (const group of places.length ? places.map(groupFor) : [none]) {
        const byKind = references.get(group) ?? new Map<ComparedKind, ResourceChange[]>()
        byKind.set(change.kind, [...byKind.get(change.kind) ?? [], change])
        references.set(group, byKind)
      }
      continue
    }
    const into = change.kind === 'domain' ? [...targets.get(change.id)?.values() ?? []] : []
    const entry: ChangeEntry = {
      type: 'change', key: change.key, change,
      changes: [change, ...folded.get(change.key) ?? []],
      folded: folded.get(change.key) ?? [],
      ...(domainMove(change) ? { moved: domainMove(change)! } : {}),
      ...(into.length ? { mergedInto: into } : {})
    }
    /* Merged into one Domain, a removed Domain is read where its resources went. */
    const homes = into.length === 1 ? [into[0]!.id] : places
    for (const group of homes.length ? homes.map(groupFor) : [none]) group.entries.push(entry)
  }
  for (const [group, byKind] of references) {
    for (const [kind, list] of byKind) {
      if (list.length > 1) group.entries.push({ type: 'references', key: `references:${group.key}:${kind}`, kind, changes: list })
      else group.entries.push({ type: 'change', key: list[0]!.key, change: list[0]!, changes: list, folded: [] })
    }
  }

  /* Within a group: what happened to Domains first, then moves, then each resource, then References. */
  const rank = (entry: ChangeEntry) => entry.type === 'change' && entry.change.kind === 'domain' ? 0
    : entry.type === 'move' ? 1 : entry.type === 'references' ? 3 : 2
  const order = [...workspace.domains.map(domain => domain.id), ...(context.before?.domains.map(domain => domain.id) ?? [])]
  const sorted = [...domains.values()].sort((a, b) => order.indexOf(a.domainId!) - order.indexOf(b.domainId!))
  const groups = [product, ...sorted, none].filter(group => group.entries.length)
  for (const group of groups) {
    group.entries = group.entries.map((entry, index) => ({ entry, index }))
      .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index).map(({ entry }) => entry)
    group.count = group.entries.reduce((sum, entry) => sum + entry.changes.length, 0)
  }
  return groups
}
