/**
 * Compare two Product Reports, resource by resource.
 *
 * Identity is a resource's kind and id, nothing else: an id that changes is a
 * removal and an addition, because two differently named resources are never
 * guessed to be the same thing. A file that moves without changing its id
 * changes nothing, because the report never carries file paths.
 *
 * Fields are compared as the report states them, after compilation, so a
 * difference is one a reader of the report could see. Generation metadata —
 * the date, the generator, the derived counts — is never a change.
 *
 * Browser-safe: no Node built-ins and no schema library, so a host can
 * compare in the page as the current model recompiles.
 */
import type { ProductReport, ReportScenarioStep } from './portable.js'

export type ComparedKind =
  | 'product'
  | 'entity'
  | 'interface'
  | 'experience'
  | 'screen'
  | 'domain'
  | 'capability'
  | 'capability-scenario'
  | 'journey'
  | 'journey-scenario'
  | 'rule'
  | 'variation'

export type ChangeStatus = 'added' | 'modified' | 'removed'

/** A resource named inside a change: its title when either side has it, its id otherwise. */
export interface ComparedRef {
  kind: ComparedKind
  id: string
  title: string
  /** Present only in the baseline: there is nothing to open. */
  removed?: boolean
}

/** One run of a word-level text difference. */
export interface TextSegment {
  op: 'same' | 'added' | 'removed'
  text: string
}

/** One member of a list field, identified the way the field identifies it. */
export interface ComparedItem {
  key: string
  label: string
  ref?: ComparedRef
  value: unknown
}

export interface TextChange {
  shape: 'text'
  field: string
  label: string
  before: string | null
  after: string | null
  segments: TextSegment[]
}

export interface ValueChange {
  shape: 'value'
  field: string
  label: string
  before: string | null
  after: string | null
  beforeRef?: ComparedRef
  afterRef?: ComparedRef
}

export interface ListChange {
  shape: 'list'
  field: string
  label: string
  added: ComparedItem[]
  removed: ComparedItem[]
  /** Members kept under the same name whose content changed, and what about them did. */
  changed: Array<{ before: ComparedItem, after: ComparedItem, details: FieldChange[] }>
  /** Same members, different order — said only for lists whose order is authored. */
  reordered: boolean
}

export interface StepChange {
  status: 'same' | ChangeStatus
  /** 1-based positions; null on the side the Step is absent from. */
  beforeIndex: number | null
  afterIndex: number | null
  before: ReportStep | null
  after: ReportStep | null
  text: TextSegment[]
  /** What else about a kept or rewritten Step changed. */
  details: FieldChange[]
}

export interface StepsChange {
  shape: 'steps'
  field: 'steps'
  label: string
  steps: StepChange[]
}

export type FieldChange = TextChange | ValueChange | ListChange | StepsChange

/** One phrase of a change brief: plain words and the resources they name. */
export type PhrasePart = { text: string } | { ref: ComparedRef }
export type Phrase = PhrasePart[]

export interface ResourceChange {
  /** `kind:id`, the key the report viewer opens resources by. */
  key: string
  kind: ComparedKind
  id: string
  title: string
  status: ChangeStatus
  /** The Capability or Journey a Scenario is read inside. */
  parent?: ComparedRef
  /** Empty for additions and removals: the whole resource is new or gone. */
  fields: FieldChange[]
  /** Product-language statements of the change, the first of which leads. */
  phrases: Phrase[]
}

export interface ChangeCounts {
  added: number
  modified: number
  removed: number
}

export interface ReportComparison {
  /** Whether each side has a Product Model at all. */
  before: boolean
  after: boolean
  changes: ResourceChange[]
  counts: ChangeCounts
  byKind: Partial<Record<ComparedKind, ChangeCounts>>
  /** Resources present on both sides and identical. */
  unchanged: number
}

type Model = ProductReport['model']
type ReportStep = ReportScenarioStep
type AnyRecord = Record<string, unknown> & { id: string }

/** Kinds in the order the report rail reads them, each with its collection. */
export const COMPARED_KINDS: ReadonlyArray<{ kind: Exclude<ComparedKind, 'product'>, collection: keyof Model, label: string }> = [
  { kind: 'entity', collection: 'entities', label: 'Entity' },
  { kind: 'interface', collection: 'interfaces', label: 'Interface' },
  { kind: 'experience', collection: 'experiences', label: 'Experience' },
  { kind: 'screen', collection: 'screens', label: 'Screen' },
  { kind: 'domain', collection: 'domains', label: 'Domain' },
  { kind: 'capability', collection: 'capabilities', label: 'Capability' },
  { kind: 'capability-scenario', collection: 'capabilityScenarios', label: 'Capability Scenario' },
  { kind: 'journey', collection: 'journeys', label: 'Journey' },
  { kind: 'journey-scenario', collection: 'journeyScenarios', label: 'Journey Scenario' },
  { kind: 'rule', collection: 'businessRules', label: 'Business Rule' },
  { kind: 'variation', collection: 'variations', label: 'Variation' }
]

const KIND_ORDER: ComparedKind[] = ['product', ...COMPARED_KINDS.map(item => item.kind)]
const KIND_LABEL: Record<ComparedKind, string> = {
  product: 'Product',
  ...Object.fromEntries(COMPARED_KINDS.map(item => [item.kind, item.label])) as Record<Exclude<ComparedKind, 'product'>, string>
}
const STATUS_ORDER: Record<ChangeStatus, number> = { added: 0, modified: 1, removed: 2 }

export function comparedKindLabel(kind: ComparedKind): string {
  return KIND_LABEL[kind]
}

/* ------------------------------------------------------------------ */
/* Field vocabulary                                                     */
/* ------------------------------------------------------------------ */

/** Fields compared per kind, in reading order. Anything unlisted that differs is still reported, after these. */
const FIELD_LABELS: Record<ComparedKind, Record<string, string>> = {
  product: {
    title: 'Name', summary: 'Summary', description: 'Description', category: 'Category', intent: 'Intent',
    authors: 'Authors', license: 'License', tags: 'Tags', languages: 'Languages', scenarioKinds: 'Scenario kinds',
    limitations: 'Limitations', coverageScope: 'Coverage scope', coverageMethod: 'Coverage method',
    covered: 'Covered', exclusions: 'Exclusions', unmapped: 'Unmapped', coverageLimitations: 'Coverage limitations',
    supportingSections: 'Supporting sections', references: 'References'
  },
  entity: {
    title: 'Title', description: 'Description', domainId: 'Domain', kind: 'Acts as', acts: 'Acts from', singleton: 'Settings instance',
    informationKept: 'Information kept', states: 'States', relations: 'Relations',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  interface: {
    title: 'Title', description: 'Description', type: 'Type', actorIds: 'Actors', entryPoints: 'Entry points', languages: 'Languages',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  experience: {
    title: 'Title', description: 'Description', accessMode: 'Access', actorIds: 'Actors', interfaceIds: 'Interfaces', entryPoints: 'Entry points',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  screen: {
    title: 'Title', description: 'Description', entities: 'Presents', capabilityIds: 'Capabilities',
    capabilityScenarioIds: 'Capability Scenarios', journeyScenarioIds: 'Journey Scenarios', entryPoints: 'Entry points',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  domain: {
    name: 'Name', description: 'Description', boundary: 'Boundary', colorSlot: 'Color',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  capability: {
    title: 'Title', description: 'Description', domainId: 'Domain', availability: 'Available in',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  'capability-scenario': {
    title: 'Title', capabilityId: 'Capability', kindId: 'Scenario kind', trigger: 'Trigger', routes: 'Routes', steps: 'Steps',
    actorIds: 'Actors', decisionPoints: 'Decision points', outcome: 'Outcome', edgeCases: 'Edge cases',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  journey: {
    title: 'Title', goal: 'Goal', successCriterion: 'Success criterion', actorIds: 'Actors', capabilityIds: 'Capabilities',
    failureOnlyCapabilityIds: 'Capabilities on failure only', domainIds: 'Domains',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  'journey-scenario': {
    title: 'Title', journeyId: 'Journey', kindId: 'Scenario kind', result: 'Result', trigger: 'Trigger', routes: 'Routes', steps: 'Steps',
    actorIds: 'Actors', decisionPoints: 'Decision points', outcome: 'Outcome', edgeCases: 'Edge cases',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  rule: {
    title: 'Title', statement: 'Statement', rationale: 'Rationale', appliesTo: 'Applies to', permits: 'Permits',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  },
  variation: {
    title: 'Title', description: 'Description', kind: 'Variation kind', of: 'Varies', takesEffect: 'Takes effect', stability: 'Stability',
    assignmentUnit: 'Assignment unit', assignmentMethod: 'Assignment method', assignmentFact: 'Assignment fact',
    allocation: 'Allocation', settings: 'Settings', discriminator: 'Discriminator', alternatives: 'Alternatives',
    intent: 'Intent', supportingSections: 'Supporting sections', references: 'References'
  }
}

/** Lists whose order is authored and read: a reorder is a change worth saying. */
const ORDERED_LISTS = new Set(['states', 'routes', 'decisionPoints', 'edgeCases', 'supportingSections', 'informationKept'])

/** Single-id fields and the kind they name. */
const ID_FIELDS: Record<string, ComparedKind> = {
  domainId: 'domain', capabilityId: 'capability', journeyId: 'journey'
}
/** Id-list fields and the kind each member names. */
const ID_LIST_FIELDS: Record<string, ComparedKind> = {
  actorIds: 'entity', capabilityIds: 'capability', failureOnlyCapabilityIds: 'capability', interfaceIds: 'interface',
  domainIds: 'domain', capabilityScenarioIds: 'capability-scenario', journeyScenarioIds: 'journey-scenario'
}

const VARIATION_MEMBER_KIND: Record<string, ComparedKind> = {
  interface: 'interface', experience: 'experience', screen: 'screen', entity: 'entity', capability: 'capability',
  'capability-scenario': 'capability-scenario', journey: 'journey', 'journey-scenario': 'journey-scenario', 'business-rule': 'rule'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Deterministic JSON: object keys sorted, so equal values compare equal. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b)

/* ------------------------------------------------------------------ */
/* Text                                                                 */
/* ------------------------------------------------------------------ */

/** Longest-common-subsequence tables beyond this many cells say "replaced" instead. */
const MAX_DIFF_CELLS = 250_000

/* A line that starts a block of its own — a list item, heading, quote or table row — is never joined to the one before. */
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|#|>|\|)/
/* A code fence opens or closes a block whose lines are kept exactly as written. */
const FENCE = /^\s*(?:```|~~~)/
/* Indented code, and a line ending in a hard break, keep their line breaks too. */
const INDENTED_CODE = /^(?: {4}|\t)/
const HARD_BREAK = /(?: {2,}|\\)$/

/**
 * Prose as it reads rather than as it is wrapped: lines inside a paragraph
 * are joined, so rewrapping a paragraph changes nothing and an edit never
 * breaks a sentence where the file happened to wrap it.
 */
export function reflow(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const prose = (line: string | undefined) => Boolean(line?.trim()) && !BLOCK_START.test(line!) && !FENCE.test(line!) && !INDENTED_CODE.test(line!)
  let result = ''
  let fenced = false
  lines.forEach((line, index) => {
    const previous = lines[index - 1]
    if (index === 0) result = line
    else if (!fenced && prose(line) && prose(previous) && !HARD_BREAK.test(previous!)) result = `${result.trimEnd()} ${line.trimStart()}`
    else result += `\n${line}`
    if (FENCE.test(line)) fenced = !fenced
  })
  return result
}

/* A word keeps its trailing space, so an edit reads as whole words, spaced as written. */
function tokens(text: string): string[] {
  return text.match(/^\s+|\S+\s*/g) ?? []
}

function pushSegment(segments: TextSegment[], op: TextSegment['op'], text: string): void {
  if (!text) return
  /* Removed words read beside kept ones; the after text's spacing must not run them together. */
  const previous = segments.at(-1)
  if (op === 'removed' && previous && previous.op !== 'removed' && /\S$/.test(previous.text) && /^\S/.test(text)) text = ` ${text}`
  const last = segments.at(-1)
  if (last && last.op === op) last.text += text
  else segments.push({ op, text })
}

/**
 * A word-level difference. Words are compared without the space after them,
 * so a word that moves to the end of a sentence is still the same word; kept
 * words are written as the current text spaces them.
 */
export function diffWords(before: string, after: string): TextSegment[] {
  if (before === after) return before ? [{ op: 'same', text: before }] : []
  const a = tokens(before)
  const b = tokens(after)
  const word = (token: string) => token.trimEnd()
  const segments: TextSegment[] = []
  /* Trim the shared head and tail first: most edits touch a few words. */
  let head = 0
  while (head < a.length && head < b.length && word(a[head]!) === word(b[head]!)) head++
  let tail = 0
  while (tail < a.length - head && tail < b.length - head && word(a[a.length - 1 - tail]!) === word(b[b.length - 1 - tail]!)) tail++
  const midA = a.slice(head, a.length - tail)
  const midB = b.slice(head, b.length - tail)
  pushSegment(segments, 'same', b.slice(0, head).join(''))
  if ((midA.length + 1) * (midB.length + 1) > MAX_DIFF_CELLS) {
    pushSegment(segments, 'removed', midA.join(''))
    pushSegment(segments, 'added', midB.join(''))
  } else {
    const n = midA.length
    const m = midB.length
    const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i]![j] = word(midA[i]!) === word(midB[j]!) ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (word(midA[i]!) === word(midB[j]!)) { pushSegment(segments, 'same', midB[j]!); i++; j++ }
      else if (table[i + 1]![j]! >= table[i]![j + 1]!) { pushSegment(segments, 'removed', midA[i]!); i++ }
      else { pushSegment(segments, 'added', midB[j]!); j++ }
    }
    while (i < n) pushSegment(segments, 'removed', midA[i++]!)
    while (j < m) pushSegment(segments, 'added', midB[j++]!)
  }
  pushSegment(segments, 'same', b.slice(b.length - tail).join(''))
  return segments
}

/* ------------------------------------------------------------------ */
/* Resolution                                                           */
/* ------------------------------------------------------------------ */

interface Side {
  report: ProductReport | null
  byKind: Map<ComparedKind, Map<string, AnyRecord>>
}

function side(report: ProductReport | null): Side {
  const byKind = new Map<ComparedKind, Map<string, AnyRecord>>()
  if (report) {
    for (const { kind, collection } of COMPARED_KINDS) {
      byKind.set(kind, new Map((report.model[collection] as AnyRecord[]).map(record => [record.id, record])))
    }
  }
  return { report, byKind }
}

const titleOf = (record: AnyRecord): string =>
  typeof record.title === 'string' ? record.title : typeof record.name === 'string' ? record.name : record.id

class Resolver {
  constructor(private readonly before: Side, private readonly after: Side) {}

  ref(kind: ComparedKind, id: string): ComparedRef {
    if (kind === 'product') {
      const report = this.after.report ?? this.before.report
      return { kind, id, title: report?.title ?? id, ...(!this.after.report ? { removed: true } : {}) }
    }
    const current = this.after.byKind.get(kind)?.get(id)
    if (current) return { kind, id, title: titleOf(current) }
    const previous = this.before.byKind.get(kind)?.get(id)
    return { kind, id, title: previous ? titleOf(previous) : id, removed: true }
  }

  /** A Context place: a Screen, an Experience or an Interface, most specific first. */
  place(id: string): ComparedRef {
    for (const kind of ['screen', 'experience', 'interface'] as const) {
      if (this.after.byKind.get(kind)?.has(id) || this.before.byKind.get(kind)?.has(id)) return this.ref(kind, id)
    }
    return { kind: 'interface', id, title: id }
  }

  fact(entityId: string, fact: string): string {
    return `${this.ref('entity', entityId).title} · ${fact}`
  }
}

/* ------------------------------------------------------------------ */
/* List members                                                         */
/* ------------------------------------------------------------------ */

function compact(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(compact).join(', ')
  if (isRecord(value)) {
    for (const key of ['title', 'name', 'heading', 'description']) {
      if (typeof value[key] === 'string') return value[key] as string
    }
    return Object.entries(value).filter(([, item]) => item !== null && item !== undefined && !(Array.isArray(item) && !item.length))
      .map(([key, item]) => `${key}: ${compact(item)}`).join('; ')
  }
  return String(value)
}

function contextsLabel(resolve: Resolver, contexts: unknown): string {
  return Array.isArray(contexts) && contexts.length
    ? ` in ${contexts.map(context => resolve.place(String((context as { placeId?: string }).placeId)).title).join(', ')}`
    : ''
}

function stateMove(from: unknown, to: unknown): string {
  if (from && to) return ` ${String(from)} → ${String(to)}`
  if (to) return ` → ${String(to)}`
  if (from) return ` from ${String(from)}`
  return ''
}

/** How one member of a list field is identified and named. */
function item(field: string, value: unknown, index: number, resolve: Resolver, owner: AnyRecord): ComparedItem {
  const idKind = ID_LIST_FIELDS[field]
  if (idKind && typeof value === 'string') {
    const ref = resolve.ref(idKind, value)
    return { key: value, label: ref.title, ref, value }
  }
  if (typeof value === 'string') return { key: value, label: value, value }
  const record = isRecord(value) ? value : {}
  switch (field) {
    case 'informationKept':
    case 'states':
      return { key: String(record.name), label: String(record.name), value }
    case 'relations': {
      const ref = resolve.ref('entity', String(record.entityId))
      return { key: `${record.entityId}\0${record.verb}`, label: `${record.verb} ${ref.title} (${record.cardinality})`, ref, value }
    }
    case 'entities': {
      const ref = resolve.ref('entity', String(record.entityId))
      const shows = Array.isArray(record.shows) && record.shows.length ? ` shows ${record.shows.join(', ')}` : ''
      const collects = Array.isArray(record.collects) && record.collects.length ? ` collects ${record.collects.join(', ')}` : ''
      return { key: String(record.entityId), label: `${ref.title}${shows}${collects}`, ref, value }
    }
    case 'availability': {
      const ref = resolve.place(String(record.placeId))
      return { key: String(record.placeId), label: ref.title, ref, value }
    }
    case 'entryPoints':
      return { key: `${record.type}\0${record.path}`, label: `${record.type} ${record.path}`, value }
    case 'references':
      return { key: `${record.kind}\0${record.role}\0${record.target}`, label: `${record.title ?? record.target} (${record.kind}, ${record.role})`, value }
    case 'supportingSections':
      return { key: String(record.heading), label: String(record.heading), value }
    case 'routes':
      return { key: String(record.id), label: String(record.name), value }
    case 'decisionPoints':
      return { key: String(record.title), label: String(record.title), value }
    case 'authors':
      return { key: String(record.name), label: String(record.name), value }
    case 'scenarioKinds':
      return { key: String(record.id), label: String(record.name), value }
    case 'covered':
    case 'exclusions':
    case 'unmapped':
    case 'coverageLimitations':
      return { key: String(record.description), label: `${record.description} (${(record.paths as string[] | undefined ?? []).join(', ')})`, value }
    case 'alternatives': {
      const kind = VARIATION_MEMBER_KIND[String(owner.of)] ?? 'capability'
      const ref = resolve.ref(kind, String(record.resourceId))
      return { key: String(record.resourceId), label: record.label ? `${record.label}: ${ref.title}` : ref.title, ref, value }
    }
    case 'appliesTo': {
      if (record.type === 'context') {
        const placeId = String((record.context as { placeId?: string } | undefined)?.placeId)
        const ref = resolve.place(placeId)
        return { key: `context\0${placeId}`, label: ref.title, ref, value }
      }
      if (record.type === 'entity') {
        const ref = resolve.ref('entity', String(record.entityId))
        const facts = Array.isArray(record.facts) && record.facts.length ? ` · ${record.facts.join(', ')}` : ''
        const effect = record.effect ? ` ${record.effect}` : ''
        return {
          /* Targets differing only in the facts they select are distinct, as lint counts them. */
          key: `entity\0${record.entityId}\0${record.effect}\0${record.from}\0${record.to}\0${Array.isArray(record.facts) ? record.facts.join(',') : ''}`,
          label: `${ref.title}${effect}${stateMove(record.from, record.to)}${facts}${contextsLabel(resolve, record.contexts)}`,
          ref, value
        }
      }
      const kind = record.type === 'business-rule' ? 'rule' : record.type as ComparedKind
      const ref = resolve.ref(kind, String(record.id))
      return { key: `${record.type}\0${record.id}`, label: `${ref.title}${contextsLabel(resolve, record.contexts)}`, ref, value }
    }
    case 'settings':
      return { key: `${record.entity}\0${record.fact}`, label: resolve.fact(String(record.entity), String(record.fact)), value }
    case 'permits':
      return { key: stable(value), label: grantLabel(resolve, record), value }
    case 'stepEntities': {
      const ref = resolve.ref('entity', String(record.entityId))
      const alias = record.as ? ` (${record.as})` : ''
      const facts = Array.isArray(record.facts) && record.facts.length ? ` · ${record.facts.join(', ')}` : ''
      return {
        key: `${record.entityId}\0${record.as}`,
        label: `${ref.title}${alias} ${record.effect}${stateMove(record.from, record.to)}${facts}`,
        ref, value
      }
    }
    case 'contexts': {
      const ref = resolve.place(String(record.placeId))
      return { key: `${record.routeId}\0${record.placeId}`, label: `${record.routeId}: ${ref.title}`, ref, value }
    }
    default:
      return { key: isRecord(value) || Array.isArray(value) ? stable(value) : `${index}`, label: compact(value), value }
  }
}

function grantLabel(resolve: Resolver, grant: Record<string, unknown>): string {
  /* Named the way the report names a grant: its Actors, or whoever an Entity's configuration picks. */
  const who: string[] = []
  if (Array.isArray(grant.actorIds) && grant.actorIds.length) who.push(grant.actorIds.map(id => resolve.ref('entity', String(id)).title).join(' or '))
  if (grant.configuredByEntityId) who.push(`whoever ${resolve.ref('entity', String(grant.configuredByEntityId)).title} configures`)
  if (grant.unattended) who.push('Unattended')
  const parts = [who.join(' and ') || 'Anyone']
  if (grant.self) parts.push('on themselves')
  if (Array.isArray(grant.related) && grant.related.length) {
    parts.push(grant.related.map(item => `who ${(item as { verb: string }).verb} ${resolve.ref('entity', (item as { entityId: string }).entityId).title}`).join(' and '))
  }
  if (Array.isArray(grant.when) && grant.when.length) {
    parts.push(`when ${grant.when.map(condition => compact(condition)).join(' and ')}`)
  }
  return parts.join(' ')
}

const permitsWords = (value: unknown) => value == null ? 'No authorization claim' : Array.isArray(value) && !value.length ? 'Forbidden to everyone' : 'Some grants'

const fieldLabel = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())

/** What about one kept list member changed: its prose word by word, anything else as before and after. */
function memberDetails(before: unknown, after: unknown): FieldChange[] {
  if (!isRecord(before) || !isRecord(after)) return []
  const changes: FieldChange[] = []
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key]
    const b = after[key]
    if (same(a ?? null, b ?? null)) continue
    if ((typeof a === 'string' || a == null) && (typeof b === 'string' || b == null)) {
      const was = a == null ? null : reflow(a)
      const now = b == null ? null : reflow(b)
      if (was !== now) changes.push({ shape: 'text', field: key, label: fieldLabel(key), before: was, after: now, segments: diffWords(was ?? '', now ?? '') })
    } else {
      changes.push({ shape: 'value', field: key, label: fieldLabel(key), before: a == null ? null : compact(a), after: b == null ? null : compact(b) })
    }
  }
  return changes
}

function listChange(field: string, label: string, before: unknown[], after: unknown[], resolve: Resolver, beforeOwner: AnyRecord, afterOwner: AnyRecord): ListChange | null {
  const left = before.map((value, index) => item(field, value, index, resolve, beforeOwner))
  const right = after.map((value, index) => item(field, value, index, resolve, afterOwner))
  const leftKeys = new Map(left.map(entry => [entry.key, entry]))
  const rightKeys = new Map(right.map(entry => [entry.key, entry]))
  const added = right.filter(entry => !leftKeys.has(entry.key))
  const removed = left.filter(entry => !rightKeys.has(entry.key))
  const changed = right.flatMap(entry => {
    const previous = leftKeys.get(entry.key)
    return previous && !same(previous.value, entry.value) ? [{ before: previous, after: entry, details: memberDetails(previous.value, entry.value) }] : []
  })
  const kept = (entries: ComparedItem[], other: Map<string, ComparedItem>) => entries.filter(entry => other.has(entry.key)).map(entry => entry.key)
  const reordered = ORDERED_LISTS.has(field) && kept(left, rightKeys).join('\0') !== kept(right, leftKeys).join('\0')
  if (!added.length && !removed.length && !changed.length && !reordered) return null
  return { shape: 'list', field, label, added, removed, changed, reordered }
}

/* ------------------------------------------------------------------ */
/* Steps                                                                */
/* ------------------------------------------------------------------ */

function stepDetails(before: ReportStep, after: ReportStep, resolve: Resolver, owner: AnyRecord): FieldChange[] {
  const details: FieldChange[] = []
  if (before.kind !== after.kind) details.push({ shape: 'value', field: 'kind', label: 'Step kind', before: before.kind, after: after.kind })
  if (before.actorId !== after.actorId) {
    details.push({
      shape: 'value', field: 'actorId', label: 'Who',
      before: before.actorId ? resolve.ref('entity', before.actorId).title : null,
      after: after.actorId ? resolve.ref('entity', after.actorId).title : null,
      ...(before.actorId ? { beforeRef: resolve.ref('entity', before.actorId) } : {}),
      ...(after.actorId ? { afterRef: resolve.ref('entity', after.actorId) } : {})
    })
  }
  if (before.capabilityId !== after.capabilityId) {
    details.push({
      shape: 'value', field: 'capabilityId', label: 'Capability',
      before: before.capabilityId ? resolve.ref('capability', before.capabilityId).title : null,
      after: after.capabilityId ? resolve.ref('capability', after.capabilityId).title : null,
      ...(before.capabilityId ? { beforeRef: resolve.ref('capability', before.capabilityId) } : {}),
      ...(after.capabilityId ? { afterRef: resolve.ref('capability', after.capabilityId) } : {})
    })
  }
  if (before.unattended !== after.unattended) {
    details.push({ shape: 'value', field: 'unattended', label: 'Unattended', before: before.unattended ? 'Yes' : 'No', after: after.unattended ? 'Yes' : 'No' })
  }
  const entities = listChange('stepEntities', 'Entity effects', before.entities, after.entities, resolve, owner, owner)
  if (entities) details.push(entities)
  const contexts = listChange('contexts', 'Where', before.contexts, after.contexts, resolve, owner, owner)
  if (contexts) details.push(contexts)
  return details
}

/** How much of two texts' wording they share, from 0 to 1. */
function similarity(a: string, b: string): number {
  const words = (value: string) => new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
  const left = words(a)
  const right = words(b)
  if (!left.size && !right.size) return 1
  let shared = 0
  for (const word of left) if (right.has(word)) shared++
  return shared / (left.size + right.size - shared)
}

/** A rewritten Step shares at least this much wording with what it replaced; less is a removal and an addition. */
const REWRITE_SIMILARITY = 0.3

/**
 * Line Steps up the way a code diff lines up lines: Steps with the same text
 * are kept, and between two kept Steps a removed and an added Step that share
 * most of their wording are read as one rewritten Step.
 */
function alignSteps(before: ReportStep[], after: ReportStep[], resolve: Resolver, owner: AnyRecord): StepChange[] {
  const n = before.length
  const m = after.length
  if (n * m > MAX_DIFF_CELLS) return replaceSteps(before, after, resolve, owner)
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] = before[i]!.text === after[j]!.text ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }
  const result: StepChange[] = []
  let removed: number[] = []
  let added: number[] = []
  const rewritten = (b: number, a: number): StepChange => ({
    status: 'modified', beforeIndex: b + 1, afterIndex: a + 1, before: before[b]!, after: after[a]!,
    text: diffWords(before[b]!.text, after[a]!.text), details: stepDetails(before[b]!, after[a]!, resolve, owner)
  })
  const dropped = (b: number): StepChange => ({ status: 'removed', beforeIndex: b + 1, afterIndex: null, before: before[b]!, after: null, text: [{ op: 'removed', text: before[b]!.text }], details: [] })
  const inserted = (a: number): StepChange => ({ status: 'added', beforeIndex: null, afterIndex: a + 1, before: null, after: after[a]!, text: [{ op: 'added', text: after[a]!.text }], details: [] })
  /* Within a gap, a removed and an added Step are one rewritten Step only when
     they share enough words, paired in order to share the most. */
  const flush = () => {
    const r = removed.length
    const n = added.length
    const score: number[][] = Array.from({ length: r + 1 }, () => new Array<number>(n + 1).fill(0))
    for (let i = r - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        const pair = similarity(before[removed[i]!]!.text, after[added[j]!]!.text)
        score[i]![j] = Math.max(score[i + 1]![j]!, score[i]![j + 1]!, pair >= REWRITE_SIMILARITY ? score[i + 1]![j + 1]! + pair : -1)
      }
    }
    let i = 0
    let j = 0
    while (i < r && j < n) {
      const pair = similarity(before[removed[i]!]!.text, after[added[j]!]!.text)
      if (pair >= REWRITE_SIMILARITY && score[i]![j] === score[i + 1]![j + 1]! + pair) { result.push(rewritten(removed[i]!, added[j]!)); i++; j++ }
      else if (score[i]![j] === score[i]![j + 1]) result.push(inserted(added[j++]!))
      else result.push(dropped(removed[i++]!))
    }
    while (i < r) result.push(dropped(removed[i++]!))
    while (j < n) result.push(inserted(added[j++]!))
    removed = []
    added = []
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i]!.text === after[j]!.text) {
      flush()
      const details = stepDetails(before[i]!, after[j]!, resolve, owner)
      result.push({
        status: details.length ? 'modified' : 'same', beforeIndex: i + 1, afterIndex: j + 1,
        before: before[i]!, after: after[j]!, text: [{ op: 'same', text: after[j]!.text }], details
      })
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) removed.push(i++)
    else added.push(j++)
  }
  while (i < n) removed.push(i++)
  while (j < m) added.push(j++)
  flush()
  return result
}

/**
 * Steps too many to line up: the unchanged ends are kept, and what lies
 * between reads as removed and then added, as a long prose edit reads as replaced.
 */
function replaceSteps(before: ReportStep[], after: ReportStep[], resolve: Resolver, owner: AnyRecord): StepChange[] {
  let head = 0
  while (head < before.length && head < after.length && before[head]!.text === after[head]!.text) head++
  let tail = 0
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail]!.text === after[after.length - 1 - tail]!.text) tail++
  const kept = (b: number, a: number): StepChange => {
    const details = stepDetails(before[b]!, after[a]!, resolve, owner)
    return { status: details.length ? 'modified' : 'same', beforeIndex: b + 1, afterIndex: a + 1, before: before[b]!, after: after[a]!, text: [{ op: 'same', text: after[a]!.text }], details }
  }
  const result: StepChange[] = []
  for (let index = 0; index < head; index++) result.push(kept(index, index))
  for (let b = head; b < before.length - tail; b++) result.push({ status: 'removed', beforeIndex: b + 1, afterIndex: null, before: before[b]!, after: null, text: [{ op: 'removed', text: before[b]!.text }], details: [] })
  for (let a = head; a < after.length - tail; a++) result.push({ status: 'added', beforeIndex: null, afterIndex: a + 1, before: null, after: after[a]!, text: [{ op: 'added', text: after[a]!.text }], details: [] })
  for (let index = tail; index > 0; index--) result.push(kept(before.length - index, after.length - index))
  return result
}

/* ------------------------------------------------------------------ */
/* Records                                                              */
/* ------------------------------------------------------------------ */

/** The Product as one record: its identity, intent, taxonomies and Coverage. */
function productRecord(report: ProductReport): AnyRecord {
  return {
    id: report.id,
    title: report.title,
    summary: report.summary,
    description: report.description,
    category: report.category,
    intent: report.intent,
    authors: report.authors,
    license: report.license,
    tags: report.tags,
    languages: report.languages,
    scenarioKinds: report.model.taxonomies.scenarioKinds,
    limitations: report.limitations,
    coverageScope: report.coverage.scope,
    coverageMethod: report.coverage.method,
    covered: report.coverage.covered,
    exclusions: report.coverage.exclusions,
    unmapped: report.coverage.unmapped,
    coverageLimitations: report.coverage.limitations,
    supportingSections: report.supportingSections,
    references: report.references
  }
}

function fieldChanges(kind: ComparedKind, before: AnyRecord, after: AnyRecord, resolve: Resolver): FieldChange[] {
  const labels = FIELD_LABELS[kind]
  const fields = [...new Set([...Object.keys(labels), ...Object.keys(before), ...Object.keys(after)])]
    .filter(field => field !== 'id')
  const changes: FieldChange[] = []
  for (const field of fields) {
    const a = before[field]
    const b = after[field]
    if (same(a ?? null, b ?? null)) continue
    const label = labels[field] ?? fieldLabel(field)
    if (field === 'steps' && Array.isArray(a) && Array.isArray(b)) {
      changes.push({ shape: 'steps', field: 'steps', label, steps: alignSteps(a as ReportStep[], b as ReportStep[], resolve, after) })
    } else if (Array.isArray(a) || Array.isArray(b)) {
      const change = listChange(field, label, Array.isArray(a) ? a : [], Array.isArray(b) ? b : [], resolve, before, after)
      if (change) changes.push(change)
      /* No authorization claim and forbidding everyone hold the same grants, none, and mean opposite things. */
      else if (field === 'permits') changes.push({ shape: 'value', field, label, before: permitsWords(a), after: permitsWords(b) })
    } else if ((typeof a === 'string' || a == null) && (typeof b === 'string' || b == null) && !ID_FIELDS[field]) {
      const before = a == null ? null : reflow(a)
      const after = b == null ? null : reflow(b)
      if (before === after) continue
      changes.push({ shape: 'text', field, label, before, after, segments: diffWords(before ?? '', after ?? '') })
    } else {
      const refKind = ID_FIELDS[field]
      const beforeRef = refKind && typeof a === 'string' ? resolve.ref(refKind, a) : undefined
      const afterRef = refKind && typeof b === 'string' ? resolve.ref(refKind, b) : undefined
      changes.push({
        shape: 'value', field, label,
        before: a == null ? null : beforeRef?.title ?? compact(a),
        after: b == null ? null : afterRef?.title ?? compact(b),
        ...(beforeRef ? { beforeRef } : {}),
        ...(afterRef ? { afterRef } : {})
      })
    }
  }
  return changes
}

/* ------------------------------------------------------------------ */
/* Phrases                                                              */
/* ------------------------------------------------------------------ */

const text = (value: string): PhrasePart => ({ text: value })

function joinRefs(refs: ComparedRef[], conjunction = 'and'): PhrasePart[] {
  const parts: PhrasePart[] = []
  refs.forEach((ref, index) => {
    if (index > 0) parts.push(text(index === refs.length - 1 ? ` ${conjunction} ` : ', '))
    parts.push({ ref })
  })
  return parts
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

const listOf = (fields: FieldChange[], field: string) => fields.find((change): change is ListChange => change.shape === 'list' && change.field === field)
const refsOf = (items: ComparedItem[]) => items.flatMap(entry => entry.ref ? [entry.ref] : [])

function scenarioActors(after: Side, capabilityId: string): string[] {
  const ids = new Set<string>()
  for (const scenario of after.byKind.get('capability-scenario')?.values() ?? []) {
    if (scenario.capabilityId === capabilityId) for (const id of scenario.actorIds as string[]) ids.add(id)
  }
  return [...ids].sort()
}

/** Fixed templates: each says only what the fields show, and the last resort names the fields. */
function phrases(change: Omit<ResourceChange, 'phrases'>, resolve: Resolver, after: Side): Phrase[] {
  const self: ComparedRef = { kind: change.kind, id: change.id, title: change.title, ...(change.status === 'removed' ? { removed: true } : {}) }
  const label = KIND_LABEL[change.kind]
  const of = change.parent ? [text(' in '), { ref: change.parent }] : []
  if (change.status === 'added') {
    if (change.kind === 'capability') {
      const actors = scenarioActors(after, change.id).map(id => resolve.ref('entity', id))
      if (actors.length) return [[text('New Capability '), { ref: self }, text(', for '), ...joinRefs(actors, 'and')]]
    }
    return [[text(`New ${label} `), { ref: self }, ...of]]
  }
  if (change.status === 'removed') return [[text(`${label} `), { ref: self }, text(' was removed'), ...(change.parent ? [text(' from '), { ref: change.parent }] : [])]]

  const result: Phrase[] = []
  const fields = change.fields
  for (const [field, noun] of [['states', 'State'], ['informationKept', 'fact']] as const) {
    const list = listOf(fields, field)
    if (!list) continue
    if (list.added.length) result.push([{ ref: self }, text(` gains the ${noun}${list.added.length > 1 ? 's' : ''} ${joinWords(list.added.map(entry => entry.label))}`)])
    if (list.removed.length) result.push([{ ref: self }, text(` loses the ${noun}${list.removed.length > 1 ? 's' : ''} ${joinWords(list.removed.map(entry => entry.label))}`)])
  }
  const applies = listOf(fields, 'appliesTo')
  if (applies?.added.length) result.push([text('Rule '), { ref: self }, text(' now also applies to '), ...joinRefs(refsOf(applies.added))])
  if (applies?.removed.length) result.push([text('Rule '), { ref: self }, text(' no longer applies to '), ...joinRefs(refsOf(applies.removed))])
  if (fields.some(field => field.field === 'permits')) result.push([text('Rule '), { ref: self }, text(' changes who it permits')])
  const actors = listOf(fields, 'actorIds')
  if (actors?.added.length) result.push([...joinRefs(refsOf(actors.added)), text(` now ${actors.added.length > 1 ? 'take' : 'takes'} part in `), { ref: self }])
  if (actors?.removed.length) result.push([...joinRefs(refsOf(actors.removed)), text(` no longer ${actors.removed.length > 1 ? 'take' : 'takes'} part in `), { ref: self }])
  const availability = listOf(fields, 'availability')
  if (availability?.added.length) result.push([{ ref: self }, text(' is now available in '), ...joinRefs(refsOf(availability.added))])
  if (availability?.removed.length) result.push([{ ref: self }, text(' is no longer available in '), ...joinRefs(refsOf(availability.removed))])
  const offers = listOf(fields, 'capabilityIds')
  if (change.kind === 'screen' && offers?.added.length) result.push([{ ref: self }, text(' now offers '), ...joinRefs(refsOf(offers.added))])
  if (change.kind === 'screen' && offers?.removed.length) result.push([{ ref: self }, text(' no longer offers '), ...joinRefs(refsOf(offers.removed))])
  if (change.kind === 'journey' && offers?.added.length) result.push([{ ref: self }, text(' now goes through '), ...joinRefs(refsOf(offers.added))])
  if (change.kind === 'journey' && offers?.removed.length) result.push([{ ref: self }, text(' no longer goes through '), ...joinRefs(refsOf(offers.removed))])
  for (const field of ['capabilityScenarioIds', 'journeyScenarioIds'] as const) {
    const hosted = listOf(fields, field)
    if (hosted?.added.length) result.push([{ ref: self }, text(' now hosts Steps of '), ...joinRefs(refsOf(hosted.added))])
    if (hosted?.removed.length) result.push([{ ref: self }, text(' no longer hosts Steps of '), ...joinRefs(refsOf(hosted.removed))])
  }
  const presents = listOf(fields, 'entities')
  if (presents?.added.length) result.push([{ ref: self }, text(' now presents '), ...joinRefs(refsOf(presents.added))])
  if (presents?.changed.length) result.push([{ ref: self }, text(' changes what it shows of '), ...joinRefs(refsOf(presents.changed.map(entry => entry.after)))])
  if (presents?.removed.length) result.push([{ ref: self }, text(' no longer presents '), ...joinRefs(refsOf(presents.removed))])
  /* What the resource itself does is one sentence, so a Scenario is named, and placed in its parent, once. */
  const steps = fields.find((field): field is StepsChange => field.shape === 'steps')
  const count = (status: ChangeStatus) => steps?.steps.filter(step => step.status === status).length ?? 0
  const stepsOf = (status: ChangeStatus) => count(status) ? [`${count(status)} Step${count(status) > 1 ? 's' : ''}`] : []
  const own = ['outcome', 'goal', 'successCriterion', 'statement', 'trigger', 'boundary']
    .flatMap(field => fields.find(item => item.field === field) ?? []).map(changed => changed.label.toLowerCase())
  const changes = [...stepsOf('modified'), ...(own.length ? [`its ${joinWords(own)}`] : [])]
  const doing = [
    ...(count('added') ? [`adds ${stepsOf('added')[0]}`] : []),
    ...(changes.length ? [`changes ${joinWords(changes)}`] : []),
    ...(count('removed') ? [`removes ${stepsOf('removed')[0]}`] : [])
  ]
  if (doing.length) result.push([{ ref: self }, text(` ${joinWords(doing)}`), ...of])
  if (!result.length) {
    result.push([{ ref: self }, text(` changes ${joinWords(fields.map(field => field.label.toLowerCase()))}`), ...of])
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Comparison                                                           */
/* ------------------------------------------------------------------ */

function parentOf(kind: ComparedKind, record: AnyRecord, resolve: Resolver): ComparedRef | undefined {
  if (kind === 'capability-scenario' && typeof record.capabilityId === 'string') return resolve.ref('capability', record.capabilityId)
  if (kind === 'journey-scenario' && typeof record.journeyId === 'string') return resolve.ref('journey', record.journeyId)
  return undefined
}

function zero(): ChangeCounts {
  return { added: 0, modified: 0, removed: 0 }
}

/**
 * Compare a baseline report with the current one. Either side may be absent:
 * a model created after the baseline is all additions, one deleted since is
 * all removals.
 */
export function compareReports(before: ProductReport | null, after: ProductReport | null): ReportComparison {
  const left = side(before)
  const right = side(after)
  const resolve = new Resolver(left, right)
  const drafts: Array<Omit<ResourceChange, 'phrases'>> = []
  let unchanged = 0

  if (before || after) {
    /* There is one Product: a changed id is still the same Product, renamed. */
    const id = (after ?? before)!.id
    const key = `product:${id}`
    if (before && after) {
      const fields = fieldChanges('product', productRecord(before), productRecord(after), resolve)
      if (before.id !== after.id) fields.unshift({ shape: 'value', field: 'id', label: 'Id', before: before.id, after: after.id })
      if (fields.length) drafts.push({ key, kind: 'product', id, title: after.title, status: 'modified', fields })
      else unchanged++
    } else {
      drafts.push({ key, kind: 'product', id, title: (after ?? before)!.title, status: after ? 'added' : 'removed', fields: [] })
    }
  }

  for (const { kind } of COMPARED_KINDS) {
    const previous = left.byKind.get(kind) ?? new Map<string, AnyRecord>()
    const current = right.byKind.get(kind) ?? new Map<string, AnyRecord>()
    for (const [id, record] of current) {
      const old = previous.get(id)
      const parent = parentOf(kind, record, resolve)
      const base = { key: `${kind}:${id}`, kind, id, title: titleOf(record), ...(parent ? { parent } : {}) }
      if (!old) { drafts.push({ ...base, status: 'added', fields: [] }); continue }
      const fields = fieldChanges(kind, old, record, resolve)
      if (fields.length) drafts.push({ ...base, status: 'modified', fields })
      else unchanged++
    }
    for (const [id, record] of previous) {
      if (current.has(id)) continue
      const parent = parentOf(kind, record, resolve)
      drafts.push({ key: `${kind}:${id}`, kind, id, title: titleOf(record), status: 'removed', fields: [], ...(parent ? { parent } : {}) })
    }
  }

  drafts.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
    || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    || a.title.localeCompare(b.title, 'en')
    || a.id.localeCompare(b.id, 'en'))

  const counts = zero()
  const byKind: Partial<Record<ComparedKind, ChangeCounts>> = {}
  const changes = drafts.map(draft => {
    counts[draft.status]++
    const kindCounts = byKind[draft.kind] ??= zero()
    kindCounts[draft.status]++
    return { ...draft, phrases: phrases(draft, resolve, right) }
  })
  return { before: Boolean(before), after: Boolean(after), changes, counts, byKind, unchanged }
}

/** Plain text of a phrase, for a title attribute, a search index or a test. */
export function phraseText(phrase: Phrase): string {
  return phrase.map(part => 'text' in part ? part.text : part.ref.title).join('')
}
