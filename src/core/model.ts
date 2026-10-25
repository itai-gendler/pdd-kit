import { AssignmentUnitSchema, VariationFactSchema, type VariationAlternative, type VariationFact, type VariationSet } from './variations.js'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parse } from 'yaml'
import type { CompactEntryPoint, Context, ResourceAsset, ResourceReference } from './frontmatter.js'
import type { MarkdownDoc } from './markdown.js'
import { CoverageDocumentSchema, type CoverageDocument } from './coverage.js'
import {
  assetsField,
  availabilityField,
  contextField,
  contextValue,
  entryPointsField,
  referencesField,
  rejectUnknownKeys,
  splitFrontmatter,
  stringField,
  stringListField,
  uniqueStringListField
} from './frontmatter.js'
import { counterpartKey, interfaceOf, isId, qualify } from './ids.js'
import { readProductCover, readProductLogo } from './logo-file.js'
import {
  bulletList, decisionPoints, namedStates, parseMarkdown, section
} from './markdown.js'

export interface ResourceFile {
  id: string
  file: string
  /**
   * The resource's expanded namespace, whether or not it currently exists.
   * Assets sit beside `<type>.md`; children are typed subfolders.
   */
  directory: string
  doc: MarkdownDoc
  references: ResourceReference[]
  /**
   * Files found beside `<type>.md`, path-relative to the resource folder.
   *
   * Anything under `implementation/` describes this realization of the Product
   * and is workspace-profile only; everything else is authored intent and
   * travels with a published Blueprint.
   */
  assets: string[]
  /** Optional authored metadata over those files. Never sets class. */
  assetMeta: ResourceAsset[]
}

/** A named set of same-type alternatives, authored in `variations/`. */
export interface VariationResource extends ResourceFile, VariationSet {}

export interface InterfaceResource extends ResourceFile {
  type: string
  actors: string[]
  entryPoints: CompactEntryPoint[]
  /**
   * Language tags this Interface serves, narrowing the Product's. Empty means
   * the Product's list applies unchanged.
   */
  languages: string[]
}

export interface ExperienceResource extends ResourceFile {
  actors: string[]
  /** The one Interface that owns it, read from the path. Never authored. */
  interface: string
  access: string
  entryPoints: CompactEntryPoint[]
}

export interface DomainResource extends ResourceFile {
  colorSlot?: number
  boundary: string
}

export interface CapabilityResource extends ResourceFile {
  domain?: string
  availability: Context[]
}

/**
 * A named fact the Product keeps about a thing: `- **Name** — prose`.
 *
 * The name is what a Business Rule cites — a `facts` target or a `when`
 * condition — by exact match, the idiom `## States` already uses for an H3.
 * Nothing else cites one, and the fact stays untyped: addressable is what a
 * field-level Rule and a derivation need; typed is a data model.
 */
export interface EntityFact {
  name: string
  description: string
}

export const ENTITY_KINDS = ['person', 'system'] as const
export const ENTITY_ACTS = ['external', 'internal'] as const

/**
 * Both ends of a relation, reading source to target.
 *
 * One end is not a relationship: "a Source publishes many Items" leaves
 * unanswered whether an Item may come from two feeds, and that is a product
 * decision rather than a storage detail. `many-to-one` is deliberately absent —
 * declare that relationship from the other Entity, where it reads
 * `one-to-many`, so one `1:N` has exactly one encoding.
 */
export type EntityCardinality = 'one-to-one' | 'one-to-many' | 'many-to-many'

/**
 * An edge to another Entity. Declared on one side only; the inverse is derived.
 * `verb` is the product's own word for the relationship.
 */
export interface EntityRelation {
  entity: string
  verb: string
  cardinality: EntityCardinality
}

/**
 * A thing the Product keeps or reasons about — the people and systems that act
 * on it included.
 *
 * Entities name the Product's nouns where Capabilities name its verbs. The test
 * is identity, not storage: a thing an Actor would point at and call "this one",
 * which the Product can tell apart from another. There is one resource type for
 * things; "Actor" is the word for the subset that `acts`, and it names the role
 * such an Entity plays on a Step, an Interface, a Journey, or a grant.
 *
 * The Entity declares its states and nothing about the moves between them: the
 * lifecycle is composed from Scenario Steps.
 */
export interface EntityResource extends ResourceFile {
  domain?: string
  /** Named single-line facts the Product keeps about the thing. Never how it is stored. */
  informationKept: EntityFact[]
  /** `person` or `system`. Present exactly when `acts` is. */
  kind?: string
  /**
   * `external` or `internal`, relative to the Product boundary. Present when
   * the thing initiates, with a goal or privilege of its own, under an inbound
   * contract the Product must keep stable; absent for a thing that does not.
   */
  acts?: string
  /** The Product keeps exactly one: its own settings. A grant condition reads it from anywhere. */
  singleton: boolean
  relations: EntityRelation[]
  states: ReturnType<typeof namedStates>
}

/** Information disclosed and inputs collected are separate product claims. */
export interface ScreenEntity {
  entity: string
  shows: string[]
  collects: string[]
}

export interface ScreenResource extends ResourceFile {
  /** The Entities this view presents, with the facts on screen. */
  entities: ScreenEntity[]
  /**
   * The Interface or Experience whose folder holds it, read from the path.
   * Never authored. Availability, audience and sharing resolve against this.
   */
  containerId: string
  capabilities: string[]
  entryPoints: CompactEntryPoint[]
}

interface ScenarioResource extends ResourceFile {
  kind: string
  routes: ScenarioRoute[]
  steps: ScenarioStep[]
  trigger: string
  outcome: string
  edgeCases: string[]
  decisionPoints: ReturnType<typeof decisionPoints>
}

export interface CapabilityScenarioResource extends ScenarioResource {
  /** The Capability that owns it, read from the path. Never authored. */
  capability: string
}

export interface ScenarioRoute {
  id: string
  name: string
}

export type ScenarioStepKind = 'actor' | 'product' | 'condition'

export interface ScenarioStepContext extends Context {
  routeId: string
}

/**
 * What a Step does to one Entity.
 *
 * `changes` is the default and the ordinary case. `creates` and `removes` are
 * the boundaries of a thing's existence, which an Actor observes. `reads` is a
 * bare mention: it never counts as a change and never keeps an Entity from
 * being an orphan, and it exists because the alternative was a Step whose text
 * names a thing while the model says nothing.
 */
export type ScenarioStepEffect = 'creates' | 'changes' | 'removes' | 'reads'

export const SCENARIO_STEP_EFFECTS: ScenarioStepEffect[] = ['creates', 'changes', 'removes', 'reads']

/**
 * One entry of a Step's `entities` list.
 *
 * State keys follow the effect and are never inferred from a neighbouring Step:
 * `creates` takes `to`, `removes` takes `from`, `changes` takes both or neither
 * (neither is an information change — a rename), `reads` takes none.
 */
export interface ScenarioStepEntity {
  entity: string
  /**
   * Scenario-local instance alias, for two instances of one Entity in one
   * Scenario. Once an Entity is aliased anywhere in a Scenario, every mention
   * of it there is aliased.
   */
  as?: string
  /** Absent in the folder when it is the default `changes`. */
  effect?: ScenarioStepEffect
  from?: string
  to?: string
  /** Exhaustive named facts affected; empty for presence/state-only operations and removal. */
  facts: string[]
  /**
   * On a removal only: the other removal of this Step it goes with, named by
   * that entry's alias when it has one and by its Entity id otherwise. The
   * removal it goes with is what needs permission.
   */
  with?: string
}

export interface ScenarioStep {
  /**
   * What this Step does to the Product's Entities. Required on every Step, and
   * `[]` when it touches nothing: silence is impossible, and an omission is a
   * claim that can be reviewed, linted, and contradicted by code.
   *
   * A list because one observable act can move two things at once, and
   * splitting it to fit a singular field would turn an acceptance case into an
   * implementation trace.
   */
  entities: ScenarioStepEntity[]
  /**
   * Marks a Scenario nobody triggers — a schedule the Product owns, an expiry,
   * a retry. Valid only on the first Step and only when `kind` is `condition`.
   * Without it, unattended behavior had to be modelled as somebody else's
   * request or left with no acceptance coverage at all.
   */
  unattended?: boolean
  text: string
  kind: string
  actor?: string
  capability?: string
  contexts: ScenarioStepContext[]
}

export interface JourneyScenarioResource extends ScenarioResource {
  /** The Journey that owns it, read from the path. Never authored. */
  journey: string
  result: string
}

export interface JourneyResource extends ResourceFile {
  actors: string[]
  goal: string
  successCriterion: string
}

export interface BusinessRuleResource extends ResourceFile {
  appliesTo: BusinessRuleTarget[]
  /**
   * Absent: the Rule makes no authorization claim. `[]`: the selected operation
   * is forbidden to everyone. Otherwise the grants, any one of which permits it.
   */
  permits?: BusinessRuleGrant[]
  rationale: string
}

/**
 * A target selects; a grant conditions. `effect`, `from` and `to` select Steps
 * by the keys their `entities` entry already carries; `facts` names the facts
 * the Rule governs; `contexts` scopes it to places that present the Entity.
 */
export interface BusinessRuleEntityTarget {
  type: 'entity'
  id: string
  effect?: ScenarioStepEffect
  from?: string
  to?: string
  facts: string[]
  contexts: Context[]
}

export const GRANT_OPERATORS = ['over', 'under', 'at-least', 'at-most', 'is', 'is-not', 'present', 'absent'] as const
export type GrantOperator = typeof GRANT_OPERATORS[number]

/** A threshold is a scalar, or the fact that holds it: `{ entity, fact }`. */
export type GrantValue = string | number | boolean | { entity: string, fact: string }

/**
 * One `when` condition. Either a fact with exactly one operator — on the
 * targeted Entity, or on `entity` — or the instance's own `state`.
 */
export interface GrantCondition {
  entity?: string
  fact?: string
  state?: string
  operator?: GrantOperator
  value?: GrantValue
}

/** One hop of a `related` path: the verb walked and the Entity it arrives at. */
export interface RelatedSegment {
  verb: string
  entity: string
}

/**
 * One grant. Keys within it are AND; grants within a Rule are OR. Every grant
 * names a who — at least one of `actors`, `related`, `self`, `unattended`,
 * `configuredBy` — and `when` narrows it.
 */
export interface BusinessRuleGrant {
  actors: string[]
  related: RelatedSegment[]
  self?: true
  when: GrantCondition[]
  unattended?: true
  configuredBy?: string
}

export type BusinessRuleResourceTargetType =
  | 'capability'
  | 'capability-scenario'
  | 'journey'
  | 'journey-scenario'

export interface BusinessRuleResourceTarget {
  type: BusinessRuleResourceTargetType
  id: string
  contexts: Context[]
}

export interface BusinessRuleContextTarget {
  type: 'context'
  context: Context
}

export type BusinessRuleTarget = BusinessRuleResourceTarget | BusinessRuleContextTarget | BusinessRuleEntityTarget

export interface ScenarioKind {
  id: string
  name: string
  description: string
  colorSlot?: number
}

export interface ProductAuthor {
  name: string
  url?: string
}

export interface PddModel {
  root: string
  config: { schema: number, sddPaths: string[], lintVerbs: string[] }
  product: {
    id: string
    summary?: string
    category?: string
    tags: string[]
    authors: ProductAuthor[]
    license?: string
    limitations: string[]
    /** Language tags the Product serves. Interfaces may narrow the list. */
    languages: string[]
    doc: MarkdownDoc
    references: ResourceReference[]
  }
  scenarioKinds: ScenarioKind[]
  coverage: CoverageDocument
  interfaces: InterfaceResource[]
  experiences: ExperienceResource[]
  screens: ScreenResource[]
  domains: DomainResource[]
  entities: EntityResource[]
  capabilities: CapabilityResource[]
  capabilityScenarios: CapabilityScenarioResource[]
  businessRules: BusinessRuleResource[]
  journeys: JourneyResource[]
  journeyScenarios: JourneyScenarioResource[]
  variations: VariationResource[]
  issues: string[]
  notices: string[]
}

/**
 * Every semantic resource collection on the model, keyed by its own name.
 *
 * The key union is derived from `PddModel` rather than written out, so adding an
 * resource kind to the model leaves this record incomplete and fails the build.
 * That is not defensive typing for its own sake: Entity was added as a kind
 * without it, and four separate "for every resource" checks — id shape, duplicate
 * ids, asset metadata, and reference targets — silently skipped Entities,
 * because each was a hand-written list nothing forced anyone to revisit.
 */
export type ResourceCollectionName = {
  [K in keyof PddModel]-?: PddModel[K] extends ResourceFile[] ? K : never
}[keyof PddModel]

export function resourceCollections(model: PddModel): Record<ResourceCollectionName, ResourceFile[]> {
  return {
    interfaces: model.interfaces,
    experiences: model.experiences,
    screens: model.screens,
    domains: model.domains,
    entities: model.entities,
    capabilities: model.capabilities,
    capabilityScenarios: model.capabilityScenarios,
    businessRules: model.businessRules,
    journeys: model.journeys,
    journeyScenarios: model.journeyScenarios,
    variations: model.variations
  }
}

/** Every semantic resource in the model, in collection order. */
export function allResources(model: PddModel): ResourceFile[] {
  return Object.values(resourceCollections(model)).flat()
}

const ENTITY_CARDINALITIES = new Set<string>(['one-to-one', 'one-to-many', 'many-to-many'])

export const FOLDER = 'product-model'

/** The one folder-format version this release reads and writes. */
export const FOLDER_SCHEMA = 11

/**
 * The two channels a model load reports into.
 *
 * `issues` are states no correct model passes through and fail `lint`.
 * `notices` are advisory: the model is loadable and the finding describes a
 * shape an author is expected to reach in more than one step.
 */
export interface LoadFindings {
  issues: string[]
  notices: string[]
}

/** One compact or expanded resource: its id segment, namespace, and Markdown file. */
export interface ResourceLocation {
  id: string
  /** `<collection>/<id>/`, including for a compact resource where it does not exist. */
  directory: string
  file: string
  expanded: boolean
}

/**
 * The compact files and expanded folders of one collection, in id order.
 *
 * `<id>.md` is canonical while a resource has no owned children or assets.
 * `<id>/<type>.md` is required once it needs that namespace. The logical id is
 * identical in both forms, and the two forms may never coexist.
 *
 * Anything unexpected is reported rather than skipped. A dropped entry used to
 * vanish with no finding, so a misplaced file looked exactly like one that was
 * never written.
 */
function listResources(
  parent: string,
  type: string,
  findings: LoadFindings,
  collection: string,
  childDirectories: string[] = []
): ResourceLocation[] {
  if (!existsSync(parent)) return []
  const found: ResourceLocation[] = []
  const compact = new Map<string, string>()
  const expanded = new Map<string, string>()

  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) {
        findings.issues.push(`${collection}/${entry.name}: expected <id>.md or <id>/${type}.md`)
        continue
      }
      compact.set(entry.name.slice(0, -3), join(parent, entry.name))
      continue
    }
    if (entry.isDirectory()) {
      expanded.set(entry.name, join(parent, entry.name))
      continue
    }
    findings.issues.push(`${collection}/${entry.name}: expected a regular resource file or directory`)
  }

  const ids = new Set([...compact.keys(), ...expanded.keys()])
  for (const id of [...ids].sort((a, b) => a.localeCompare(b, 'en'))) {
    const compactFile = compact.get(id)
    const directory = expanded.get(id) ?? join(parent, id)
    const expandedFile = join(directory, `${type}.md`)
    const hasExpandedFile = existsSync(expandedFile)

    if (compactFile && expanded.has(id)) {
      findings.issues.push(
        hasExpandedFile
          ? `${collection}/${id}: both ${id}.md and ${id}/${type}.md exist; keep exactly one resource shape`
          : `${collection}/${id}.md cannot also have ${collection}/${id}/; move it to ${collection}/${id}/${type}.md before adding children or assets`
      )
      found.push({ id, directory, file: compactFile, expanded: false })
      continue
    }

    if (compactFile) {
      found.push({ id, directory, file: compactFile, expanded: false })
      continue
    }

    if (!hasExpandedFile) {
      findings.issues.push(`${collection}/${id}/ is missing ${type}.md`)
      continue
    }

    let ownsContent = false
    for (const child of readdirSync(directory, { withFileTypes: true })) {
      if (child.name === '.DS_Store' || child.name === `${type}.md`) continue
      if (child.isFile()) {
        ownsContent = true
        continue
      }
      if (child.isDirectory() && (child.name === 'implementation' || childDirectories.includes(child.name))) {
        const contents = readdirSync(join(directory, child.name), { withFileTypes: true })
          .filter(item => item.name !== '.DS_Store')
        if (contents.length) ownsContent = true
        continue
      }
      if (child.isDirectory() && type === 'screen' && child.name === 'screens') {
        findings.issues.push(`${collection}/${id}/screens/: Screens never nest; fold each child into ${id} (its facts into entities, its Steps onto ${id}) or place it beside ${id} when it has a subject of its own`)
        continue
      }
      if (child.isDirectory()) {
        findings.issues.push(`${collection}/${id}/${child.name}/ is not a recognized child directory`)
        continue
      }
      findings.issues.push(`${collection}/${id}/${child.name}: assets must be regular files`)
    }

    if (!ownsContent) {
      // Advisory, not an error: an author reaches the expanded shape in two
      // steps. Report expansion derives shape from owned children, so the round
      // trip normalizes this folder back to the compact form the rule requires.
      findings.notices.push(
        `${collection}/${id}/ has no assets or child resources; use ${collection}/${id}.md`
      )
    }
    found.push({ id, directory, file: expandedFile, expanded: true })
  }
  return found
}

/** Every file beside `<type>.md`, plus everything under `implementation/`. */
function listAssets(directory: string, ownFile: string): string[] {
  const found: string[] = []
  if (!existsSync(directory)) return found
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === ownFile) continue
    if (entry.isFile()) found.push(entry.name)
    else if (entry.name === 'implementation') {
      for (const child of readdirSync(join(directory, 'implementation'), { withFileTypes: true })) {
        if (child.isFile() && child.name !== '.DS_Store') found.push(`implementation/${child.name}`)
      }
    }
  }
  return found.sort()
}

function readResource(
  location: Pick<ResourceLocation, 'file' | 'directory' | 'expanded'>,
  allowedKeys: string[],
  issues: string[]
): {
  data: Record<string, unknown>
  doc: MarkdownDoc
  references: ResourceReference[]
  directory: string
  assets: string[]
  assetMeta: ResourceAsset[]
} {
  const { file, directory, expanded } = location
  const source = readFileSync(file, 'utf8')
  const { data, body } = splitFrontmatter(source, issues, file)
  rejectUnknownKeys(data, [...allowedKeys, 'references', 'assets'], issues, file)
  const doc = parseMarkdown(body)
  return {
    data,
    doc,
    references: referencesField(data, issues, file),
    directory,
    assets: expanded ? listAssets(directory, basename(file)) : [],
    assetMeta: assetsField(data, issues, file)
  }
}

function readScenarioSections(doc: MarkdownDoc, issues: string[], file: string) {
  return {
    trigger: section(doc, 'Trigger') || '',
    outcome: section(doc, 'Outcome') || '',
    edgeCases: bulletList(section(doc, 'Edge cases') || ''),
    decisionPoints: decisionPoints(section(doc, 'Decision points') || '', issues, file)
  }
}

function scenarioRoutesField(
  data: Record<string, unknown>,
  issues: string[],
  label: string
): ScenarioRoute[] {
  const value = data.routes
  if (value === undefined || value === null) return []
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${label}: "routes" must be a mapping from route id to route name`)
    return []
  }
  const routes: ScenarioRoute[] = []
  for (const [id, rawName] of Object.entries(value as Record<string, unknown>)) {
    const name = stringField({ name: rawName }, 'name', issues, `${label}: route "${id}"`)
    routes.push({ id, name: name || '' })
  }
  return routes
}

function scenarioStepsField(
  data: Record<string, unknown>,
  issues: string[],
  label: string,
  allowCapability: boolean
): ScenarioStep[] {
  const value = data.steps
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    issues.push(`${label}: "steps" must be a list`)
    return []
  }
  const steps: ScenarioStep[] = []
  for (const [index, raw] of value.entries()) {
    const itemLabel = `${label}: step ${index + 1}`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      issues.push(`${itemLabel} must be a mapping`)
      continue
    }
    const item = raw as Record<string, unknown>
    /*
     * `entity`, `state`, `changes` and `reads` were earlier spellings of what a
     * Step does to a thing and are now entries of `entities`. They would
     * otherwise fall through as unknown keys, which says what is wrong and not
     * what to write instead.
     */
    const RETIRED_STEP_KEYS = ['entity', 'state', 'changes', 'reads']
    for (const retired of RETIRED_STEP_KEYS) {
      if (item[retired] !== undefined) {
        issues.push(`${itemLabel}: "${retired}" is now an entry of "entities"`)
      }
    }
    rejectUnknownKeys(
      item,
      ['text', 'kind', 'actor', 'entities', 'contexts', 'unattended', ...RETIRED_STEP_KEYS, ...(allowCapability ? ['capability'] : [])],
      issues,
      itemLabel
    )
    /* Required, and `[]` is a claim: silence is what made 91% of Steps say
       nothing about the things they touched. */
    if (item.entities === undefined || item.entities === null) {
      issues.push(`${itemLabel}: needs "entities" — what this Step does to the Product's things, or [] when it touches nothing`)
    }
    const entities = stepEntities(item.entities, issues, itemLabel)
    const contexts: ScenarioStepContext[] = []
    if (item.contexts !== undefined && item.contexts !== null) {
      if (typeof item.contexts !== 'object' || Array.isArray(item.contexts)) {
        issues.push(`${itemLabel}: "contexts" must map route ids to Context objects`)
      } else {
        for (const [routeId, rawContext] of Object.entries(item.contexts as Record<string, unknown>)) {
          const context = contextValue(rawContext, issues, `${itemLabel}: route "${routeId}"`)
          if (context) contexts.push({ routeId, ...context })
        }
      }
    }
    const unattended = item.unattended
    if (unattended !== undefined && typeof unattended !== 'boolean') {
      issues.push(`${itemLabel}: "unattended" must be true or false`)
    }
    steps.push({
      text: stringField(item, 'text', issues, itemLabel) || '',
      kind: stringField(item, 'kind', issues, itemLabel) || '',
      actor: stringField(item, 'actor', issues, itemLabel),
      entities,
      capability: allowCapability ? stringField(item, 'capability', issues, itemLabel) : undefined,
      unattended: unattended === true ? true : undefined,
      contexts
    })
  }
  return steps
}

/**
 * One Step's `entities` list, parsed but not resolved.
 *
 * Shape only: whether the ids exist, whether a state is one the Entity has,
 * and whether the Steps chain are model-wide questions `lint` answers once the
 * whole model is loaded.
 */
function stepEntities(raw: unknown, issues: string[], label: string): ScenarioStepEntity[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    issues.push(`${label}: "entities" must be a list`)
    return []
  }
  const entries: ScenarioStepEntity[] = []
  const seen = new Set<string>()
  for (const [index, entry] of raw.entries()) {
    const entryLabel = `${label}: entity ${index + 1}`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      issues.push(`${entryLabel} must be a mapping`)
      continue
    }
    const item = entry as Record<string, unknown>
    rejectUnknownKeys(item, ['entity', 'as', 'effect', 'from', 'to', 'facts', 'with'], issues, entryLabel)
    const entity = stringField(item, 'entity', issues, entryLabel) || ''
    if (!entity) {
      issues.push(`${entryLabel}: needs an "entity"`)
      continue
    }
    const alias = stringField(item, 'as', issues, entryLabel)
    if (alias !== undefined && !isId(alias)) {
      issues.push(`${entryLabel}: "as" must be a lowercase kebab-case alias`)
    }
    /* One Step states one thing about one instance; two entries for it are two
       authorities that can disagree, exactly as a facing relation is. */
    const key = `${entity}\0${alias ?? ''}`
    if (seen.has(key)) {
      issues.push(`${entryLabel}: "${entity}${alias ? ` (${alias})` : ''}" already appears in this Step`)
      continue
    }
    seen.add(key)
    const effect = stringField(item, 'effect', issues, entryLabel)
    if (effect !== undefined && !SCENARIO_STEP_EFFECTS.includes(effect as ScenarioStepEffect)) {
      issues.push(`${entryLabel}: effect "${effect}" must be ${SCENARIO_STEP_EFFECTS.join('|')}`)
      continue
    }
    const resolved = (effect ?? 'changes') as ScenarioStepEffect
    const from = stringField(item, 'from', issues, entryLabel)
    const to = stringField(item, 'to', issues, entryLabel)
    /* State keys follow the effect. A creation starts nowhere, a removal leaves
       nothing in a state, a read says nothing about state, and a change either
       moves — both keys — or alters information — neither. */
    if (resolved === 'reads' && (from !== undefined || to !== undefined)) {
      issues.push(`${entryLabel}: a "reads" entry carries no "from" or "to"`)
      continue
    }
    if (resolved === 'creates' && from !== undefined) {
      issues.push(`${entryLabel}: a "creates" entry has no "from"; a creation starts nowhere`)
      continue
    }
    if (resolved === 'removes' && to !== undefined) {
      issues.push(`${entryLabel}: a "removes" entry has no "to"; nothing is left in a state after it ends`)
      continue
    }
    if (resolved === 'changes' && (from === undefined) !== (to === undefined)) {
      issues.push(`${entryLabel}: a "changes" entry carries both "from" and "to", or neither`)
      continue
    }
    const facts = uniqueStringListField(item, 'facts', issues, entryLabel)
    if (resolved === 'removes') {
      if (item.facts !== undefined) issues.push(`${entryLabel}: a "removes" entry carries no "facts"`)
    } else if (!Array.isArray(item.facts)) {
      issues.push(`${entryLabel}: "facts" is required as a list, including [] when no named facts are affected`)
    }
    let goesWith = stringField(item, 'with', issues, entryLabel)
    if (goesWith !== undefined && resolved !== 'removes' && resolved !== 'creates') {
      // The entry stays, without the misplaced key, so later checks see the Step as written.
      issues.push(`${entryLabel}: "with" belongs on a "creates" or "removes" entry; only a creation or a removal goes with another`)
      goesWith = undefined
    }
    entries.push({ entity, as: alias, effect: effect as ScenarioStepEffect | undefined, from, to, facts, ...(goesWith !== undefined ? { with: goesWith } : {}) })
  }
  /* A creation or removal goes with another of the same effect in this same
     Step, named the way the Step names it: by alias when the entry has one, by
     Entity id otherwise. */
  const referenceOf = (entry: ScenarioStepEntity) => entry.as ?? entry.entity
  /* One reference names one entry, or a `with` would mean one entry to the
     parser and another to the exporter. */
  const byReference = new Map<string, ScenarioStepEntity>()
  for (const entry of entries) {
    const reference = referenceOf(entry)
    if (byReference.has(reference)) {
      issues.push(`${label}: two entries are named "${reference}"; give each its own "as" so every entry of a Step has one name`)
      continue
    }
    byReference.set(reference, entry)
  }
  for (const entry of entries) {
    if (entry.with === undefined) continue
    const target = byReference.get(entry.with)
    const effect = entry.effect ?? 'changes'
    if (!target || target === entry || (target.effect ?? 'changes') !== effect) {
      issues.push(`${label}: "${referenceOf(entry)}" goes "with" "${entry.with}", which names no other "${effect}" entry of this Step`)
      delete entry.with
    }
  }
  for (const entry of entries) {
    const visited = new Set<ScenarioStepEntity>()
    let current: ScenarioStepEntity | undefined = entry
    while (current?.with !== undefined && !visited.has(current)) {
      visited.add(current)
      current = byReference.get(current.with)
    }
    if (current && visited.has(current)) {
      issues.push(`${label}: "with" on "${referenceOf(entry)}" returns to where it started; one entry must be what the others go with`)
      break
    }
  }
  return entries
}

/** Screen entries use named disclosures and inputs; a bare id claims presence only. */
function screenEntitiesField(data: Record<string, unknown>, issues: string[], label: string): ScreenEntity[] {
  const value = data.entities
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    issues.push(`${label}: "entities" must be a list`)
    return []
  }
  const entries: ScreenEntity[] = []
  const seen = new Set<string>()
  for (const [index, raw] of value.entries()) {
    const entryLabel = `${label}: entity ${index + 1}`
    let entry: ScreenEntity | undefined
    if (typeof raw === 'string') {
      entry = { entity: raw, shows: [], collects: [] }
    } else if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const item = raw as Record<string, unknown>
      rejectUnknownKeys(item, ['entity', 'shows', 'collects'], issues, entryLabel)
      const entity = stringField(item, 'entity', issues, entryLabel) || ''
      if (!entity) {
        issues.push(`${entryLabel}: needs an "entity"`)
        continue
      }
      const shows = uniqueStringListField(item, 'shows', issues, entryLabel)
      const collects = uniqueStringListField(item, 'collects', issues, entryLabel)
      for (const key of ['shows', 'collects'] as const) {
        if (item[key] !== undefined && (!Array.isArray(item[key]) || !(item[key] as unknown[]).length)) {
          issues.push(`${entryLabel}: "${key}" must be a non-empty list when present`)
        }
      }
      if (!shows.length && !collects.length) issues.push(`${entryLabel}: needs shows or collects; write an Entity with no named facts as its bare id`)
      entry = { entity, shows, collects }
    } else {
      issues.push(`${entryLabel}: must be an Entity id or { entity, shows?, collects? }`)
      continue
    }
    if (seen.has(entry.entity)) {
      issues.push(`${entryLabel}: "${entry.entity}" already appears in this Screen's entities`)
      continue
    }
    seen.add(entry.entity)
    entries.push(entry)
  }
  return entries
}

function parsedContextField(
  raw: unknown,
  issues: string[],
  label: string,
  allowedExtra: string[] = []
): Context | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    issues.push(`${label}: context target must be a mapping`)
    return undefined
  }
  const item = raw as Record<string, unknown>
  rejectUnknownKeys(item, ['context', ...allowedExtra], issues, label)
  return contextField(item, 'context', issues, label)
}

function businessRuleTargetsField(
  data: Record<string, unknown>,
  issues: string[],
  label: string
): BusinessRuleTarget[] {
  const value = data.appliesTo
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) {
    issues.push(`${label}: "appliesTo" must be a list`)
    return []
  }
  const targets: BusinessRuleTarget[] = []
  for (const [index, raw] of value.entries()) {
    const targetLabel = `${label}: appliesTo item ${index + 1}`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      issues.push(`${targetLabel} must be a mapping`)
      continue
    }
    const target = raw as Record<string, unknown>
    const type = stringField(target, 'type', issues, targetLabel) || ''
    if (type === 'context') {
      rejectUnknownKeys(target, ['type', 'context'], issues, targetLabel)
      const parsed = parsedContextField(target, issues, targetLabel, ['type'])
      if (parsed) targets.push({ type: 'context', context: parsed })
      continue
    }
    if (type === 'entity') {
      rejectUnknownKeys(target, ['type', 'id', 'effect', 'from', 'to', 'facts', 'contexts'], issues, targetLabel)
      const effect = stringField(target, 'effect', issues, targetLabel)
      if (effect !== undefined && !SCENARIO_STEP_EFFECTS.includes(effect as ScenarioStepEffect)) {
        issues.push(`${targetLabel}: effect "${effect}" must be ${SCENARIO_STEP_EFFECTS.join('|')}`)
      }
      const from = stringField(target, 'from', issues, targetLabel)
      const to = stringField(target, 'to', issues, targetLabel)
      /* A target selects Steps by the keys their entry carries, so it takes only
         the state keys that effect can have. */
      if (from !== undefined && (effect === 'creates' || effect === 'reads')) {
        issues.push(`${targetLabel}: "from" selects nothing on a "${effect}" target; a ${effect === 'creates' ? 'creation starts nowhere' : 'read carries no state'}`)
      }
      if (to !== undefined && (effect === 'removes' || effect === 'reads')) {
        issues.push(`${targetLabel}: "to" selects nothing on a "${effect}" target`)
      }
      targets.push({
        type: 'entity',
        id: stringField(target, 'id', issues, targetLabel) || '',
        effect: effect as ScenarioStepEffect | undefined,
        from,
        to,
        facts: uniqueStringListField(target, 'facts', issues, targetLabel),
        contexts: targetContextsField(target, issues, targetLabel)
      })
      continue
    }
    rejectUnknownKeys(target, ['type', 'id', 'contexts'], issues, targetLabel)
    targets.push({
      type: type as BusinessRuleResourceTargetType,
      id: stringField(target, 'id', issues, targetLabel) || '',
      contexts: targetContextsField(target, issues, targetLabel)
    })
  }
  return targets
}

function targetContextsField(target: Record<string, unknown>, issues: string[], label: string): Context[] {
  const rawContexts = target.contexts
  const contexts: Context[] = []
  if (rawContexts === undefined || rawContexts === null) return contexts
  if (!Array.isArray(rawContexts) || rawContexts.length === 0) {
    issues.push(`${label}: "contexts" must be a non-empty list when present`)
    return contexts
  }
  for (const [contextIndex, rawContext] of rawContexts.entries()) {
    const parsed = contextValue(rawContext, issues, `${label}: context ${contextIndex + 1}`)
    if (parsed) contexts.push(parsed)
  }
  return contexts
}

/** A `self` or `unattended` key: present and `true`, or absent. Nothing else. */
function literalTrue(data: Record<string, unknown>, key: string, issues: string[], label: string): true | undefined {
  const value = data[key]
  if (value === undefined || value === null) return undefined
  if (value !== true) {
    issues.push(`${label}: "${key}" is either true or absent`)
    return undefined
  }
  return true
}

function relatedPathField(raw: unknown, issues: string[], label: string): RelatedSegment[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    issues.push(`${label}: "related" must be a list of { verb, entity } segments`)
    return []
  }
  /* The zero-hop path has one spelling, and it is not an empty list. */
  if (!raw.length) {
    issues.push(`${label}: "related" is empty; the instance itself is "self: true"`)
    return []
  }
  const segments: RelatedSegment[] = []
  for (const [index, entry] of raw.entries()) {
    const segmentLabel = `${label}: related segment ${index + 1}`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      issues.push(`${segmentLabel} must be a { verb, entity } mapping`)
      continue
    }
    const item = entry as Record<string, unknown>
    rejectUnknownKeys(item, ['verb', 'entity'], issues, segmentLabel)
    const verb = stringField(item, 'verb', issues, segmentLabel) || ''
    const entity = stringField(item, 'entity', issues, segmentLabel) || ''
    if (!verb) issues.push(`${segmentLabel}: needs a "verb"`)
    if (!entity) issues.push(`${segmentLabel}: needs an "entity"`)
    if (verb && entity) segments.push({ verb, entity })
  }
  return segments
}

function grantConditionsField(raw: unknown, issues: string[], label: string): GrantCondition[] {
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw)) {
    issues.push(`${label}: "when" must be a list of conditions`)
    return []
  }
  const conditions: GrantCondition[] = []
  for (const [index, entry] of raw.entries()) {
    const conditionLabel = `${label}: condition ${index + 1}`
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      issues.push(`${conditionLabel} must be a mapping`)
      continue
    }
    const item = entry as Record<string, unknown>
    rejectUnknownKeys(item, ['entity', 'fact', 'state', ...GRANT_OPERATORS], issues, conditionLabel)
    const entity = stringField(item, 'entity', issues, conditionLabel)
    const fact = stringField(item, 'fact', issues, conditionLabel)
    const state = stringField(item, 'state', issues, conditionLabel)
    const operators = GRANT_OPERATORS.filter(operator => item[operator] !== undefined)
    if (state !== undefined) {
      /* Another Entity's instance has no path from this one, so a state
         condition is always about the targeted thing and carries nothing else. */
      if (entity !== undefined || fact !== undefined || operators.length) {
        issues.push(`${conditionLabel}: a "state" condition carries nothing else`)
        continue
      }
      conditions.push({ state })
      continue
    }
    if (fact === undefined) {
      issues.push(`${conditionLabel}: needs a "fact" with one operator, or a "state"`)
      continue
    }
    if (operators.length !== 1) {
      issues.push(`${conditionLabel}: needs exactly one operator of ${GRANT_OPERATORS.join('|')}`)
      continue
    }
    const operator = operators[0]!
    const rawValue = item[operator]
    let value: GrantValue | undefined
    if (operator === 'present' || operator === 'absent') {
      if (rawValue !== true) {
        issues.push(`${conditionLabel}: "${operator}" takes true`)
        continue
      }
      value = true
    } else if (typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      value = rawValue
    } else if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
      /* A threshold someone sets is a fact, named like every other fact the
         model cites, so `lint` can check it exists and which instance holds it. */
      const holder = rawValue as Record<string, unknown>
      rejectUnknownKeys(holder, ['entity', 'fact'], issues, `${conditionLabel}: "${operator}"`)
      const holderEntity = stringField(holder, 'entity', issues, `${conditionLabel}: "${operator}"`)
      const holderFact = stringField(holder, 'fact', issues, `${conditionLabel}: "${operator}"`)
      if (!holderEntity || !holderFact) {
        issues.push(`${conditionLabel}: "${operator}" needs a scalar or { entity: <entity-id>, fact: <fact name> }`)
        continue
      }
      value = { entity: holderEntity, fact: holderFact }
    } else {
      issues.push(`${conditionLabel}: "${operator}" needs a scalar or { entity: <entity-id>, fact: <fact name> }`)
      continue
    }
    conditions.push({ entity, fact, operator, value })
  }
  return conditions
}

/**
 * A Rule's `permits`: absent, `[]`, or grants. Shape only — whether an actor
 * acts, a path resolves, or a fact exists are model-wide questions for `lint`.
 */
function businessRulePermitsField(
  data: Record<string, unknown>,
  issues: string[],
  label: string
): BusinessRuleGrant[] | undefined {
  const value = data.permits
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) {
    issues.push(`${label}: "permits" must be a list of grants, or [] to forbid the operation to everyone`)
    return undefined
  }
  const grants: BusinessRuleGrant[] = []
  for (const [index, raw] of value.entries()) {
    const grantLabel = `${label}: grant ${index + 1}`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      issues.push(`${grantLabel} must be a mapping`)
      continue
    }
    const item = raw as Record<string, unknown>
    rejectUnknownKeys(item, ['actors', 'related', 'self', 'when', 'unattended', 'configuredBy'], issues, grantLabel)
    const grant: BusinessRuleGrant = {
      actors: uniqueStringListField(item, 'actors', issues, grantLabel),
      related: relatedPathField(item.related, issues, grantLabel),
      self: literalTrue(item, 'self', issues, grantLabel),
      when: grantConditionsField(item.when, issues, grantLabel),
      unattended: literalTrue(item, 'unattended', issues, grantLabel),
      configuredBy: stringField(item, 'configuredBy', issues, grantLabel)
    }
    /* "Anyone" already has an encoding — list every Entity that acts — and a
       grant with no who is indistinguishable from a forgotten one. */
    if (!grant.actors.length && !grant.related.length && !grant.self && !grant.unattended && !grant.configuredBy) {
      issues.push(`${grantLabel}: names nobody; a grant needs at least one of actors, related, self, unattended, configuredBy`)
    }
    grants.push(grant)
  }
  return grants
}

const FACT_PATTERN = /^\*\*(.+?)\*\*\s+—\s+(\S.*)$/

/**
 * `## Information kept`, one named fact per bullet.
 *
 * The name is what a Rule cites, so it is parsed rather than read out of
 * English, and the separator is one thing — an em dash — so that two authors
 * cannot spell one fact two ways.
 */
function entityFacts(body: string | undefined, issues: string[], file: string): EntityFact[] {
  const facts: EntityFact[] = []
  if (body === undefined) return facts
  const seen = new Set<string>()
  for (const line of bulletList(body)) {
    const match = FACT_PATTERN.exec(line)
    if (!match) {
      issues.push(`${file}: fact "${line}" must read "**Name** — prose"`)
      continue
    }
    const name = match[1]!.trim()
    if (seen.has(name)) {
      issues.push(`${file}: duplicate fact "${name}"`)
      continue
    }
    seen.add(name)
    facts.push({ name, description: match[2]!.trim() })
  }
  return facts
}


/** Load the strict schema 11 product-model/ folder, collecting parse issues. */
export function loadModel(cwd: string): PddModel {
  const root = join(cwd, FOLDER)
  const issues: string[] = []
  const notices: string[] = []
  const findings: LoadFindings = { issues, notices }
  if (!existsSync(root)) {
    issues.push(`${FOLDER}/ does not exist — use \`pdd-map\` for established code or \`pdd-ideate\` for a new product`)
  } else {
    if (!existsSync(join(root, 'README.md'))) issues.push('README.md is missing')

    const gitignoreFile = join(root, '.gitignore')
    if (!existsSync(gitignoreFile)) {
      issues.push('.gitignore is missing')
    } else {
      const patterns = new Set(
        readFileSync(gitignoreFile, 'utf8')
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'))
      )
      for (const generated of ['build/', 'cache/']) {
        if (!patterns.has(generated)) issues.push(`.gitignore must ignore ${generated}`)
      }
    }
  }

  if (existsSync(root)) {
    try {
      readProductLogo(cwd)
    } catch (error) {
      issues.push(`logo.svg: ${(error as Error).message}`)
    }
    try {
      readProductCover(cwd)
    } catch (error) {
      issues.push(`cover.webp: ${(error as Error).message}`)
    }
  }

  let config = { schema: FOLDER_SCHEMA, sddPaths: [] as string[], lintVerbs: [] as string[] }
  const configFile = join(root, 'config.yaml')
  if (existsSync(configFile)) {
    try {
      const raw = parse(readFileSync(configFile, 'utf8')) as Record<string, any> | null
      const keys = Object.keys(raw || {}).filter(key => key !== 'schema' && key !== 'sdd' && key !== 'lint')
      for (const key of keys) issues.push(`config.yaml: unknown key "${key}"`)
      if (raw?.sdd !== undefined && (typeof raw.sdd !== 'object' || raw.sdd === null || Array.isArray(raw.sdd))) {
        issues.push('config.yaml: "sdd" must be a mapping')
      } else if (raw?.sdd) {
        for (const key of Object.keys(raw.sdd).filter(key => key !== 'paths')) {
          issues.push(`config.yaml: sdd has unknown key "${key}"`)
        }
      }
      let lintVerbs: string[] = []
      if (raw?.lint !== undefined) {
        if (typeof raw.lint !== 'object' || raw.lint === null || Array.isArray(raw.lint)) {
          issues.push('config.yaml: "lint" must be a mapping')
        } else {
          for (const key of Object.keys(raw.lint).filter(key => key !== 'verbs')) {
            issues.push(`config.yaml: lint has unknown key "${key}"`)
          }
          const verbs = raw.lint.verbs
          if (verbs !== undefined) {
            if (!Array.isArray(verbs) || verbs.some(verb => typeof verb !== 'string' || !/^[a-z]+$/.test(verb))) {
              issues.push('config.yaml: lint "verbs" must be a list of lowercase alphabetic words')
            } else {
              lintVerbs = verbs
            }
          }
        }
      }
      config = {
        schema: Number(raw?.schema ?? 0),
        sddPaths: Array.isArray(raw?.sdd?.paths) ? raw.sdd.paths.map(String) : [],
        lintVerbs
      }
    } catch (error) {
      issues.push(`config.yaml failed to parse (${(error as Error).message})`)
    }
  } else if (existsSync(root)) {
    issues.push('config.yaml is missing')
  }
  if (config.schema !== FOLDER_SCHEMA) {
    issues.push(`config.yaml: schema ${config.schema} is not supported (expected ${FOLDER_SCHEMA})`)
  }

  let scenarioKinds: ScenarioKind[] = []
  const taxonomiesFile = join(root, 'taxonomies.yaml')
  if (existsSync(taxonomiesFile)) {
    try {
      const raw = parse(readFileSync(taxonomiesFile, 'utf8')) as Record<string, any> | null
      const kinds = raw?.scenarioKinds
      if (!Array.isArray(kinds)) issues.push('taxonomies.yaml must contain a scenarioKinds list')
      else {
        scenarioKinds = kinds.map((kind: Record<string, unknown>) => ({
          id: String(kind.id || ''),
          name: String(kind.name || ''),
          description: String(kind.description || ''),
          colorSlot: typeof kind.colorSlot === 'number' ? kind.colorSlot : undefined
        }))
      }
    } catch (error) {
      issues.push(`taxonomies.yaml failed to parse (${(error as Error).message})`)
    }
  } else if (existsSync(root)) {
    issues.push('taxonomies.yaml is missing')
  }

  let product: PddModel['product'] = {
    id: '', tags: [], authors: [], limitations: [], languages: [], doc: { title: '', lead: '', sections: [] }, references: []
  }
  const compactProductFile = join(root, 'product.md')
  const productDirectory = join(root, 'product')
  const expandedProductFile = join(productDirectory, 'product.md')
  const hasCompactProduct = existsSync(compactProductFile)
  const hasProductDirectory = existsSync(productDirectory)
  const hasExpandedProduct = existsSync(expandedProductFile)
  const productLogoFile = join(productDirectory, 'logo.svg')

  if (hasCompactProduct && hasProductDirectory) {
    issues.push(
      hasExpandedProduct
        ? 'product: both product.md and product/product.md exist; keep exactly one resource shape'
        : 'product.md cannot also have product/; move it to product/product.md before adding logo.svg'
    )
  }
  if (hasProductDirectory && !hasExpandedProduct && !hasCompactProduct) {
    issues.push('product/ is missing product.md')
  }
  if (hasExpandedProduct && !existsSync(productLogoFile)) {
    issues.push('product/ has no logo asset; use product.md')
  }
  if (hasProductDirectory) {
    for (const entry of readdirSync(productDirectory, { withFileTypes: true })) {
      if (['.DS_Store', 'product.md', 'logo.svg', 'cover.webp'].includes(entry.name)) continue
      issues.push(`product/${entry.name}: the Product folder may contain only product.md, logo.svg and cover.webp`)
    }
  }

  const productFile = hasCompactProduct ? compactProductFile : hasExpandedProduct ? expandedProductFile : undefined
  if (productFile) {
    const source = readFileSync(productFile, 'utf8')
    const { data, body } = splitFrontmatter(source, issues, 'product.md')
    rejectUnknownKeys(
      data,
      ['id', 'summary', 'category', 'tags', 'authors', 'license', 'limitations', 'languages', 'references'],
      issues,
      'product.md'
    )
    const rawAuthors = data.authors
    const authors: ProductAuthor[] = []
    if (rawAuthors !== undefined && rawAuthors !== null) {
      if (!Array.isArray(rawAuthors)) {
        issues.push('product.md: "authors" must be a list')
      } else {
        for (const [index, item] of rawAuthors.entries()) {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            issues.push(`product.md: author ${index + 1} must contain "name" and optional "url"`)
            continue
          }
          const author = item as Record<string, unknown>
          const unknown = Object.keys(author).filter(key => key !== 'name' && key !== 'url')
          if (unknown.length) issues.push(`product.md: author ${index + 1} has unknown field(s): ${unknown.join(', ')}`)
          if (typeof author.name !== 'string') {
            issues.push(`product.md: author ${index + 1} "name" must be a string`)
            continue
          }
          if (author.url !== undefined && typeof author.url !== 'string') {
            issues.push(`product.md: author ${index + 1} "url" must be a string`)
            continue
          }
          authors.push({ name: author.name, ...(author.url ? { url: author.url } : {}) })
        }
      }
    }
    product = {
      id: stringField(data, 'id', issues, 'product.md') || '',
      summary: stringField(data, 'summary', issues, 'product.md'),
      category: stringField(data, 'category', issues, 'product.md'),
      tags: uniqueStringListField(data, 'tags', issues, 'product.md'),
      authors,
      license: stringField(data, 'license', issues, 'product.md'),
      limitations: stringListField(data, 'limitations', issues, 'product.md'),
      languages: uniqueStringListField(data, 'languages', issues, 'product.md'),
      doc: parseMarkdown(body),
      references: referencesField(data, issues, 'product.md')
    }
  } else if (existsSync(root)) {
    issues.push('product.md is missing')
  }

  let coverage: CoverageDocument = {
    scope: '', exclusions: [], method: '', covered: [], unmapped: [], limitations: []
  }
  const coverageFile = join(root, 'coverage.md')
  if (existsSync(join(root, 'coverage.json'))) issues.push('coverage.json is not supported; use coverage.md (folder schema 10)')
  if (existsSync(coverageFile)) {
    const { data, body } = splitFrontmatter(readFileSync(coverageFile, 'utf8'), issues, 'coverage.md')
    if (body.trim() !== '# Coverage') issues.push('coverage.md: body must contain only "# Coverage"; put scope, reasons and limitations in frontmatter')
    const parsed = CoverageDocumentSchema.safeParse(data)
    if (parsed.success) coverage = parsed.data
    else for (const issue of parsed.error.issues) issues.push(`coverage.md: ${issue.path.join('.') || 'document'}: ${issue.message}`)
  } else if (existsSync(root)) {
    issues.push('coverage.md is missing')
  }

  /* There is no `actors/`. A folder that still has one is reported as the
     misplaced collection it is, with the move named. */
  if (existsSync(join(root, 'actors'))) {
    issues.push('actors/: there is no Actor resource type; move each file to entities/ and say how it acts with "kind" and "acts"')
  }

  /*
    The Interface → Experience → Screen hierarchy is walked, not listed. An
    Experience belongs to exactly one Interface and a Screen to exactly one parent, so the path is the parent
    relation and the id — one authority instead of two that can disagree, and
    reparenting becomes a `git mv` that reads correctly in a pull request.
  */
  const interfaces: InterfaceResource[] = []
  const experiences: ExperienceResource[] = []
  const screens: ScreenResource[] = []

  /*
    Screens never nest: a tab or a wizard stage is part of one Screen, so a
    Screen's parent is always the Interface or Experience whose folder holds it.
  */
  const readScreens = (parent: string, containerId: string, label: string) => {
    for (const location of listResources(join(parent, 'screens'), 'screen', findings, `${label}/screens`)) {
      const { data, doc, references, directory, assets, assetMeta } = readResource(
        location,
        ['entities', 'entryPoints'],
        issues
      )
      const id = qualify(containerId, location.id)
      screens.push({
        entities: screenEntitiesField(data, issues, location.file),
        id,
        file: location.file,
        doc,
        references,
        directory,
        assets,
        assetMeta,
        containerId,
        capabilities: [],
        entryPoints: entryPointsField(data, issues, location.file)
      })
    }
  }

  for (const productInterface of listResources(
    join(root, 'interfaces'),
    'interface',
    findings,
    'interfaces',
    ['experiences', 'screens']
  )) {
    const { data, doc, references, directory, assets, assetMeta } = readResource(
      productInterface,
      ['type', 'actors', 'entryPoints', 'languages'],
      issues
    )
    interfaces.push({
      id: productInterface.id,
      file: productInterface.file,
      doc,
      references,
      directory,
      assets,
      assetMeta,
      type: stringField(data, 'type', issues, productInterface.file) || '',
      actors: uniqueStringListField(data, 'actors', issues, productInterface.file),
      entryPoints: entryPointsField(data, issues, productInterface.file),
      languages: uniqueStringListField(data, 'languages', issues, productInterface.file)
    })

    const experienceLocations = listResources(
      join(productInterface.directory, 'experiences'),
      'experience',
      findings,
      `interfaces/${productInterface.id}/experiences`,
      ['screens']
    )

    for (const location of experienceLocations) {
      const experienceId = qualify(productInterface.id, location.id)
      const parsed = readResource(location, ['actors', 'access', 'entryPoints'], issues)
      experiences.push({
        id: experienceId,
        file: location.file,
        doc: parsed.doc,
        references: parsed.references,
        directory: parsed.directory,
        assets: parsed.assets,
        assetMeta: parsed.assetMeta,
        actors: uniqueStringListField(parsed.data, 'actors', issues, location.file),
        interface: productInterface.id,
        access: stringField(parsed.data, 'access', issues, location.file) || '',
        entryPoints: entryPointsField(parsed.data, issues, location.file)
      })
      readScreens(location.directory, experienceId, `interfaces/${productInterface.id}/experiences/${location.id}`)
    }

    // Screens beside experiences/ are shared across every Experience of this
    // Interface. A view common to several Experiences would otherwise have to be
    // duplicated into each of them.
    if (existsSync(join(productInterface.directory, 'screens'))) {
      readScreens(productInterface.directory, productInterface.id, `interfaces/${productInterface.id}`)
    }
  }

  const domains: DomainResource[] = listResources(join(root, 'domains'), 'domain', findings, 'domains')
    .map((location) => {
      const { id, file } = location
      const { data, doc, references, directory, assets, assetMeta } = readResource(location, ['colorSlot'], issues)
      return {
        id, file, doc, references, directory, assets, assetMeta,
        colorSlot: typeof data.colorSlot === 'number' ? data.colorSlot : undefined,
        boundary: section(doc, 'Boundary') || ''
      }
    })

  const entities: EntityResource[] = listResources(join(root, 'entities'), 'entity', findings, 'entities')
    .map((location) => {
      const { id, file } = location
      const { data, doc, references, directory, assets, assetMeta } =
        readResource(location, ['domain', 'kind', 'acts', 'singleton', 'relations', 'transitions'], issues)
      /* The lifecycle is composed from Steps. A list that restated it was the
         second authority the format removed, and the message names the first. */
      if (data.transitions !== undefined) {
        issues.push(`${file}: "transitions" is gone; a Step's "entities" entry says which state it moves the thing from and to`)
      }
      const informationKept = entityFacts(section(doc, 'Information kept'), issues, file)
      const states = namedStates(section(doc, 'States') || '', issues, file)
      const hasStates = section(doc, 'States') !== undefined

      const kind = stringField(data, 'kind', issues, file)
      const acts = stringField(data, 'acts', issues, file)
      if (acts !== undefined && !(ENTITY_ACTS as readonly string[]).includes(acts)) {
        issues.push(`${file}: acts "${acts}" must be external|internal`)
      }
      if (kind !== undefined && !(ENTITY_KINDS as readonly string[]).includes(kind)) {
        issues.push(`${file}: kind "${kind}" must be person|system`)
      }
      /* An Actor was always a person or a system; an Entity that acts without
         saying which would be a regression from the Actor it replaces. A thing
         that does not act says nothing, because "it's a thing" is the default. */
      if (acts !== undefined && kind === undefined) {
        issues.push(`${file}: an Entity that acts needs "kind": person|system`)
      }
      if (acts === undefined && kind !== undefined) {
        issues.push(`${file}: "kind" is only valid together with "acts"`)
      }
      /* One instance is a claim about settings, never about who acts: a role is
         as many people as hold it. Absence says nothing, so only `true` exists. */
      if (data.singleton !== undefined && data.singleton !== true) {
        issues.push(`${file}: "singleton" is true or absent`)
      }
      const singleton = data.singleton === true
      if (singleton && acts !== undefined) {
        issues.push(`${file}: an Entity that acts is never "singleton"; it is as many as act`)
      }

      // Identity, not storage: a thing may be worth naming for what the Product
      // keeps about it, for how it changes, or because it acts — but not for none.
      if (!informationKept.length && !hasStates && acts === undefined) {
        issues.push(`${file}: an Entity needs "## Information kept", "## States", or "acts"`)
      }

      const relations: EntityRelation[] = []
      const rawRelations = data.relations
      if (rawRelations !== undefined && rawRelations !== null) {
        if (!Array.isArray(rawRelations)) {
          issues.push(`${file}: "relations" must be a list`)
        } else {
          for (const [index, raw] of rawRelations.entries()) {
            const label = `${file}: relation ${index + 1}`
            if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
              issues.push(`${label} must be a mapping`)
              continue
            }
            const item = raw as Record<string, unknown>
            rejectUnknownKeys(item, ['entity', 'verb', 'cardinality'], issues, label)
            const entity = stringField(item, 'entity', issues, label) || ''
            const verb = stringField(item, 'verb', issues, label) || ''
            const cardinality = stringField(item, 'cardinality', issues, label) || ''
            if (!entity) issues.push(`${label}: needs an "entity"`)
            if (!verb) issues.push(`${label}: needs a "verb"`)
            if (cardinality === 'many-to-one') {
              // One 1:N, one encoding: the side that has one of the other declares it.
              issues.push(`${label}: "cardinality" is many-to-one; declare this relation on "${entity}", where it reads one-to-many`)
              continue
            }
            if (!ENTITY_CARDINALITIES.has(cardinality)) {
              issues.push(`${label}: "cardinality" must be one-to-one, one-to-many, or many-to-many`)
              continue
            }
            relations.push({ entity, verb, cardinality: cardinality as EntityCardinality })
          }
        }
      }

      /* Whether a state is reachable is a model-wide question — a Step may
         create straight into one — so `lint` asks it once the whole model is
         loaded rather than this parser asking it one Entity file at a time. */
      return {
        id, file, doc, references, directory, assets, assetMeta,
        domain: stringField(data, 'domain', issues, file),
        informationKept,
        kind,
        acts,
        singleton,
        relations,
        states
      }
    })

  const capabilities: CapabilityResource[] = []
  const capabilityScenarios: CapabilityScenarioResource[] = []
  for (const location of listResources(
    join(root, 'capabilities'),
    'capability',
    findings,
    'capabilities',
    ['scenarios']
  )) {
    const { data, doc, references, directory, assets, assetMeta } = readResource(location, ['domain', 'entities', 'availability'], issues)
    /* What a Capability changes is what its Steps say it changes. A list here
       restated that from the other side, and the message names the replacement. */
    if (data.entities !== undefined) {
      issues.push(`${location.file}: "entities" is gone from a Capability; each Step's "entities" says what it changes`)
    }
    capabilities.push({
      id: location.id,
      file: location.file,
      doc,
      references,
      directory,
      assets,
      assetMeta,
      domain: stringField(data, 'domain', issues, location.file),
      availability: availabilityField(data, issues, location.file)
    })
    for (const scenario of listResources(
      join(location.directory, 'scenarios'),
      'capability-scenario',
      findings,
      `capabilities/${location.id}/scenarios`
    )) {
      const parsed = readResource(scenario, ['kind', 'routes', 'steps'], issues)
      capabilityScenarios.push({
        id: scenario.id,
        file: scenario.file,
        doc: parsed.doc,
        references: parsed.references,
        directory: parsed.directory,
        assets: parsed.assets,
        assetMeta: parsed.assetMeta,
        kind: stringField(parsed.data, 'kind', issues, scenario.file) || '',
        capability: location.id,
        routes: scenarioRoutesField(parsed.data, issues, scenario.file),
        steps: scenarioStepsField(parsed.data, issues, scenario.file, false),
        ...readScenarioSections(parsed.doc, issues, scenario.file)
      })
    }
  }

  const journeys: JourneyResource[] = []
  const journeyScenarios: JourneyScenarioResource[] = []
  for (const location of listResources(
    join(root, 'journeys'),
    'journey',
    findings,
    'journeys',
    ['scenarios']
  )) {
    const { data, doc, references, directory, assets, assetMeta } = readResource(location, ['actors'], issues)
    journeys.push({
      id: location.id,
      file: location.file,
      doc,
      references,
      directory,
      assets,
      assetMeta,
      actors: uniqueStringListField(data, 'actors', issues, location.file),
      goal: section(doc, 'Goal') || '',
      successCriterion: section(doc, 'Success criterion') || ''
    })
    for (const scenario of listResources(
      join(location.directory, 'scenarios'),
      'journey-scenario',
      findings,
      `journeys/${location.id}/scenarios`
    )) {
      const parsed = readResource(scenario, ['kind', 'result', 'routes', 'steps'], issues)
      journeyScenarios.push({
        id: scenario.id,
        file: scenario.file,
        doc: parsed.doc,
        references: parsed.references,
        directory: parsed.directory,
        assets: parsed.assets,
        assetMeta: parsed.assetMeta,
        kind: stringField(parsed.data, 'kind', issues, scenario.file) || '',
        journey: location.id,
        result: stringField(parsed.data, 'result', issues, scenario.file) || '',
        routes: scenarioRoutesField(parsed.data, issues, scenario.file),
        steps: scenarioStepsField(parsed.data, issues, scenario.file, true),
        ...readScenarioSections(parsed.doc, issues, scenario.file)
      })
    }
  }

  const businessRules: BusinessRuleResource[] = listResources(
    join(root, 'business-rules'),
    'business-rule',
    findings,
    'business-rules'
  ).map((location) => {
    const { id, file } = location
    const { data, doc, references, directory, assets, assetMeta } = readResource(location, ['appliesTo', 'permits'], issues)
    return {
      id, file, doc, references, directory, assets, assetMeta,
      appliesTo: businessRuleTargetsField(data, issues, file),
      permits: businessRulePermitsField(data, issues, file),
      rationale: section(doc, 'Rationale') || ''
    }
  })

  const variations: VariationResource[] = listResources(
    join(root, 'variations'),
    'variation',
    findings,
    'variations'
  ).map((location) => {
    const { id, file } = location
    const { data, doc, references, directory, assets, assetMeta } = readResource(location, [
      'kind', 'of', 'takesEffect', 'stability', 'assignmentUnit', 'assignmentMethod', 'assignmentFact',
      'allocation', 'settings', 'discriminator', 'alternatives'
    ], issues)
    return { file, doc, references, directory, assets, assetMeta, ...variationSetFields(id, data, issues, file) }
  })

  // One authority: both Scenario kinds contribute the Capabilities exercised here.
  const screensById = new Map(screens.map(screen => [screen.id, screen]))
  for (const scenario of [...capabilityScenarios, ...journeyScenarios]) {
    for (const step of scenario.steps) {
      const capability = 'capability' in scenario ? scenario.capability : step.capability
      if (!capability) continue
      for (const context of Object.values(step.contexts)) {
        const screen = screensById.get(context.place)
        if (screen && !screen.capabilities.includes(capability)) screen.capabilities.push(capability)
      }
    }
  }
  for (const screen of screens) screen.capabilities.sort()

  return {
    root,
    config,
    product,
    scenarioKinds,
    coverage,
    interfaces,
    experiences,
    screens,
    domains,
    entities,
    capabilities,
    capabilityScenarios,
    businessRules,
    journeys,
    journeyScenarios,
    variations,
    issues,
    notices
  }
}

function factField(raw: unknown, issues: string[], label: string): VariationFact | null {
  if (raw === undefined || raw === null) return null
  const parsed = VariationFactSchema.safeParse(raw)
  if (!parsed.success) {
    issues.push(`${label} must be { entity: <id>, fact: <name> }`)
    return null
  }
  return parsed.data
}

function variationAlternativesField(data: Record<string, unknown>, issues: string[], label: string): VariationAlternative[] {
  const raw = data.alternatives
  if (raw === undefined || raw === null) {
    issues.push(`${label}: "alternatives" is required`)
    return []
  }
  if (!Array.isArray(raw)) {
    issues.push(`${label}: "alternatives" must be a list`)
    return []
  }
  return raw.flatMap((entry, index) => {
    const where = `${label}: alternatives[${index}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      issues.push(`${where} must be { id, selectedWhen, label? }`)
      return []
    }
    const item = entry as Record<string, unknown>
    rejectUnknownKeys(item, ['id', 'selectedWhen', 'label'], issues, where)
    const id = stringField(item, 'id', issues, where)
    const selectedWhen = stringField(item, 'selectedWhen', issues, where)
    if (!id) issues.push(`${where}: "id" is required`)
    if (selectedWhen === undefined) issues.push(`${where}: "selectedWhen" is required`)
    return id ? [{ id, selectedWhen: selectedWhen ?? '', label: stringField(item, 'label', issues, where) ?? null }] : []
  })
}

/** Reads a Variation's frontmatter; `lint` owns every rule beyond value shapes. */
function variationSetFields(id: string, data: Record<string, unknown>, issues: string[], label: string): VariationSet {
  const required = (key: string) => {
    const value = stringField(data, key, issues, label)
    if (value === undefined) issues.push(`${label}: "${key}" is required`)
    return value ?? ''
  }
  let assignmentUnit: VariationSet['assignmentUnit'] = null
  if (data.assignmentUnit !== undefined && data.assignmentUnit !== null) {
    const parsed = AssignmentUnitSchema.safeParse(data.assignmentUnit)
    if (parsed.success) assignmentUnit = parsed.data
    else issues.push(`${label}: assignmentUnit must be { entity: <id> } or { description: <text> }`)
  }
  let settings: VariationFact[] = []
  if (data.settings !== undefined && data.settings !== null) {
    if (!Array.isArray(data.settings) || data.settings.length === 0) issues.push(`${label}: settings must be a non-empty list of { entity, fact }`)
    else settings = data.settings.flatMap((raw, index) => factField(raw, issues, `${label}: settings[${index}]`) ?? [])
  }
  return {
    id,
    kind: required('kind'),
    of: required('of'),
    takesEffect: required('takesEffect'),
    stability: required('stability'),
    assignmentUnit,
    assignmentMethod: stringField(data, 'assignmentMethod', issues, label) ?? null,
    assignmentFact: factField(data.assignmentFact, issues, `${label}: assignmentFact`),
    allocation: stringField(data, 'allocation', issues, label) ?? null,
    settings,
    discriminator: factField(data.discriminator, issues, `${label}: discriminator`),
    alternatives: variationAlternativesField(data, issues, label)
  }
}
