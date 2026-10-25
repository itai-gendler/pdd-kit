import {
  AssignmentUnitSchema, VariationFactSchema, variationIssues, variationEntityReferences,
  VARIATION_COLLECTION_OF, VARIATION_KINDS, VARIATION_MEMBER_TYPES, type VariationCollection, type VariationSet
} from './variations.js'
import * as z from 'zod'
import { reportVariationMembership } from './variation-membership.js'
import { undeclaredEntityMentions } from './entity-mentions.js'
import {
  conditionInstanceIssue, interfaceLanguageIssues, singletonRelationIssue, LANGUAGE_TAG_PATTERN, screenEntityIssues, screenReadIssues, unknownFactIssues
} from './model-checks.js'
import { parseCodeTarget } from './coderefs.js'
import { containsPlace, interfaceOf, parentPlace, placeIdentityIssues } from './ids.js'
import { containsStructuralHeading, statesAnExclusion } from './markdown.js'
import { INTERFACE_TYPES } from './interface-types.js'
import { CoverageAreaSchema, CoverageDocumentSchema } from './coverage.js'
import { operationPlaces, validatePermissionBehavior } from './permission-validation.js'

export const REPORT_SCHEMA_VERSION = '20.0.0'

const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
/**
 * A qualified Interface, Experience, or Screen id.
 *
 * Interfaces, Experiences and Screens repeat names across Interfaces on
 * purpose, so their ids carry the segments that tell them apart.
 */
const QualifiedIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:::[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
const ProductIdSchema = IdSchema.max(64)
const SingleLineTextSchema = z.string().min(1)
  .refine(value => value.trim().length > 0, 'Expected non-whitespace text')
  .refine(value => !/[\r\n]/.test(value), 'Expected a single line')

const RequiredMarkdownFragmentSchema = z.string().min(1)
  .refine(value => value.trim().length > 0, 'Expected non-whitespace text')
  .refine(value => !containsStructuralHeading(value), 'Markdown fragment must not contain H1 or H2 headings')

const MarkdownFragmentSchema = z.string()
  .refine(value => !containsStructuralHeading(value), 'Markdown fragment must not contain H1 or H2 headings')

function validHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    return Boolean(new URL(value).hostname)
  } catch {
    return false
  }
}

function validRepositoryTarget(value: string): boolean {
  const path = value.split(/[?#]/, 1)[0] || ''
  return Boolean(value.trim())
    && Boolean(path.trim())
    && !/^[a-z][a-z0-9+.-]*:/i.test(value)
    && !/^(?:[/\\]|~[/\\]|[a-z]:[/\\])/i.test(value)
    && !value.includes('\\')
    && !path.split('/').includes('..')
}

export const ReportReferenceSchema = z.strictObject({
  kind: z.enum(['code', 'prd', 'spec', 'proposal', 'doc', 'adr', 'visual', 'research']),
  role: z.enum(['intent', 'implementation', 'context']),
  target: SingleLineTextSchema,
  title: SingleLineTextSchema.optional()
}).superRefine((reference, context) => {
  if (reference.kind === 'code') {
    const issues: string[] = []
    if (!parseCodeTarget(reference.target, issues, 'reference')) {
      context.addIssue({ code: 'custom', path: ['target'], message: issues[0] || 'Invalid code reference target' })
    }
    return
  }
  if (!validHttpUrl(reference.target) && !validRepositoryTarget(reference.target)) {
    context.addIssue({
      code: 'custom',
      path: ['target'],
      message: 'Reference target must use HTTP(S) or a repository-relative path'
    })
  }
})

export const ReportSupportingSectionSchema = z.strictObject({
  heading: SingleLineTextSchema.refine(value => value === value.trim(), 'Expected no surrounding whitespace'),
  content: MarkdownFragmentSchema
})

const ResourceContentSchema = {
  intent: MarkdownFragmentSchema,
  supportingSections: z.array(ReportSupportingSectionSchema),
  references: z.array(ReportReferenceSchema)
}

export const TaxonomyEntrySchema = z.strictObject({
  id: IdSchema,
  name: SingleLineTextSchema,
  description: z.string(),
  colorSlot: z.number().int().optional()
})

const ReportResourceCountShape = {
  interfaces: z.number().int().min(0),
  experiences: z.number().int().min(0),
  screens: z.number().int().min(0),
  domains: z.number().int().min(0),
  entities: z.number().int().min(0),
  capabilities: z.number().int().min(0),
  capabilityScenarios: z.number().int().min(0),
  journeys: z.number().int().min(0),
  journeyScenarios: z.number().int().min(0),
  businessRules: z.number().int().min(0),
  variations: z.number().int().min(0)
}

export const ReportCountsSchema = z.strictObject(ReportResourceCountShape)

export const ReportAuthorSchema = z.strictObject({
  name: SingleLineTextSchema.max(120),
  url: z.string().refine(validHttpUrl, 'Author URL must use HTTP(S)').optional()
})

export const ReportGeneratorSchema = z.strictObject({
  name: z.string().min(1),
  version: z.string().min(1)
})

export const ReportEntryPointSchema = z.strictObject({
  type: SingleLineTextSchema,
  path: SingleLineTextSchema
})

export const ReportContextSchema = z.strictObject({
  placeId: QualifiedIdSchema
})

/** A language tag: `en`, `de-DE`, `pt-BR`. A closed vocabulary, never a name. */
export const LanguageTagSchema = z.string().regex(LANGUAGE_TAG_PATTERN)

export const ReportInterfaceSchema = z.strictObject({
  id: QualifiedIdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  type: z.enum(INTERFACE_TYPES),
  actorIds: z.array(IdSchema).min(1),
  entryPoints: z.array(ReportEntryPointSchema),
  /** Narrows the Product's languages; empty means the Product's list applies. */
  languages: z.array(LanguageTagSchema),
  ...ResourceContentSchema
})

export const ReportExperienceSchema = z.strictObject({
  id: QualifiedIdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  actorIds: z.array(IdSchema).min(1),
  interfaceIds: z.array(QualifiedIdSchema).min(1),
  accessMode: z.enum(['public', 'authenticated', 'restricted']),
  entryPoints: z.array(ReportEntryPointSchema),
  ...ResourceContentSchema
})

export const ReportDomainSchema = z.strictObject({
  id: IdSchema,
  name: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  /* The region the Domain owns, stated by what it does not. The folder requires
     a `## Boundary`, so a wire form that could omit it expanded to a folder
     `lint` refuses. */
  boundary: RequiredMarkdownFragmentSchema,
  colorSlot: z.number().int().optional(),
  ...ResourceContentSchema
})

export const ReportEntityStateSchema = z.strictObject({
  name: SingleLineTextSchema,
  content: RequiredMarkdownFragmentSchema
})

/**
 * A named fact the Product keeps about a thing. The name is what a Business
 * Rule cites, by exact match; the fact itself stays untyped.
 */
export const ReportEntityFactSchema = z.strictObject({
  name: SingleLineTextSchema,
  description: SingleLineTextSchema
})

/**
 * An edge to another Entity, declared on one side. The inverse is derived by
 * consumers rather than authored, so the two sides cannot disagree.
 *
 * `cardinality` states both ends, reading source to target. `many-to-one` is
 * deliberately absent: that relationship is declared from the other Entity,
 * where it reads `one-to-many`, so one `1:N` has exactly one encoding.
 */
export const ReportEntityRelationSchema = z.strictObject({
  entityId: IdSchema,
  verb: SingleLineTextSchema,
  cardinality: z.enum(['one-to-one', 'one-to-many', 'many-to-many'])
})

/**
 * A thing the Product keeps or reasons about — the people and systems that act
 * on it included. There is no `actors` collection: an Actor is an Entity whose
 * `acts` is non-null, and every actor reference in the report names one.
 *
 * Entity states are an authored lifecycle whose moves are composed from
 * Scenario steps; a Screen's `states` remain that view's own states, and the
 * two are never merged.
 */
export const ReportEntitySchema = z.strictObject({
  id: IdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  domainId: IdSchema.optional(),
  /** Non-null exactly when `acts` is. */
  kind: z.enum(['person', 'system']).nullable(),
  /** Which side of the Product boundary it acts from; null for a thing that does not act. */
  acts: z.enum(['external', 'internal']).nullable(),
  /** The Product keeps exactly one — its own settings — so a grant condition reads it from anywhere. */
  singleton: z.boolean(),
  /** What the Product keeps about the thing, by name. Never how it is stored. */
  informationKept: z.array(ReportEntityFactSchema),
  relations: z.array(ReportEntityRelationSchema),
  states: z.array(ReportEntityStateSchema),
  ...ResourceContentSchema
})

export const ReportCapabilitySchema = z.strictObject({
  id: IdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  domainId: IdSchema.optional(),
  availability: z.array(ReportContextSchema).min(1),
  ...ResourceContentSchema
})

/**
 * One Entity a Screen presents and the facts on screen, read or entered.
 * Both lists empty is a bare entry for an Entity with no named facts.
 * Inputs never imply disclosure or read permission.
 */
export const ReportScreenEntitySchema = z.strictObject({
  entityId: IdSchema,
  shows: z.array(SingleLineTextSchema),
  collects: z.array(SingleLineTextSchema)
})

/**
 * A Screen is relations only: what it shows, what it offers, where it is
 * entered. Its id carries its whole placement, and a parent may be a Screen.
 */
export const ReportScreenSchema = z.strictObject({
  id: QualifiedIdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  capabilityIds: z.array(IdSchema).min(1),
  entities: z.array(ReportScreenEntitySchema),
  capabilityScenarioIds: z.array(IdSchema),
  journeyScenarioIds: z.array(IdSchema),
  entryPoints: z.array(ReportEntryPointSchema),
  ...ResourceContentSchema
})

export const ReportJourneySchema = z.strictObject({
  id: IdSchema,
  title: SingleLineTextSchema,
  goal: RequiredMarkdownFragmentSchema,
  successCriterion: RequiredMarkdownFragmentSchema,
  actorIds: z.array(IdSchema).min(1),
  capabilityIds: z.array(IdSchema),
  failureOnlyCapabilityIds: z.array(IdSchema),
  domainIds: z.array(IdSchema),
  ...ResourceContentSchema
})

export const ReportDecisionPointSchema = z.strictObject({
  title: SingleLineTextSchema,
  question: RequiredMarkdownFragmentSchema,
  branches: z.array(z.strictObject({
    condition: SingleLineTextSchema,
    outcome: SingleLineTextSchema
  })).min(2)
})

export const ReportScenarioRouteSchema = z.strictObject({
  id: IdSchema,
  name: SingleLineTextSchema
})

export const ReportScenarioStepContextSchema = z.strictObject({
  routeId: IdSchema,
  placeId: QualifiedIdSchema
})

export const STEP_EFFECTS = ['creates', 'changes', 'removes', 'reads'] as const

/**
 * What one Step does to one Entity.
 *
 * `effect` is resolved rather than optional: the folder may omit the default,
 * the wire never does, so nothing downstream has to know which value that was.
 * `as` is a scenario-local instance alias; `from` and `to` follow the effect.
 */
export const ReportScenarioStepEntitySchema = z.strictObject({
  entityId: IdSchema,
  as: IdSchema.nullable(),
  effect: z.enum(STEP_EFFECTS),
  from: SingleLineTextSchema.nullable(),
  to: SingleLineTextSchema.nullable(),
  /** The exhaustive facts read, changed or initialized; empty on removal. */
  facts: z.array(SingleLineTextSchema),
  /** On a removal, the other removal of this step it goes with. */
  with: z.strictObject({ entityId: IdSchema, as: IdSchema.nullable() }).nullable()
})

export const ReportScenarioStepSchema = z.strictObject({
  text: SingleLineTextSchema,
  kind: z.enum(['actor', 'product', 'condition']),
  /** Who performs an actor Step, or who a Product or condition Step is attributable to. */
  actorId: IdSchema.nullable(),
  capabilityId: IdSchema.nullable(),
  /** What this Step does to the Product's Entities. Empty when it touches nothing. */
  entities: z.array(ReportScenarioStepEntitySchema),
  /** True only on a first condition Step that nobody triggers. */
  unattended: z.boolean(),
  contexts: z.array(ReportScenarioStepContextSchema)
})

const ReportScenarioContentShape = {
  title: SingleLineTextSchema,
  kindId: IdSchema,
  // Empty exactly when the Scenario is unattended: nobody triggers it, so it
  // derives no Actor. Every other Scenario still names at least one.
  actorIds: z.array(IdSchema),
  routes: z.array(ReportScenarioRouteSchema).min(1),
  steps: z.array(ReportScenarioStepSchema).min(1),
  trigger: RequiredMarkdownFragmentSchema,
  decisionPoints: z.array(ReportDecisionPointSchema),
  outcome: RequiredMarkdownFragmentSchema,
  edgeCases: z.array(SingleLineTextSchema),
  ...ResourceContentSchema
}

export const ReportCapabilityScenarioSchema = z.strictObject({
  id: IdSchema,
  capabilityId: IdSchema,
  ...ReportScenarioContentShape
})

export const ReportJourneyScenarioSchema = z.strictObject({
  id: IdSchema,
  journeyId: IdSchema,
  result: z.enum(['achieved', 'not-achieved']),
  ...ReportScenarioContentShape
})

const ReportBusinessRuleResourceTargetSchema = z.strictObject({
  type: z.enum(['capability', 'capability-scenario', 'journey', 'journey-scenario']),
  id: IdSchema,
  contexts: z.array(ReportContextSchema)
})

const ReportBusinessRuleContextTargetSchema = z.strictObject({
  type: z.literal('context'),
  context: ReportContextSchema
})

/**
 * A target selects; a grant conditions. `effect`, `from` and `to` select steps
 * by the keys their `entities` record carries; `facts` names the facts the
 * Rule governs; `contexts` scopes it to places that present the Entity.
 */
const ReportBusinessRuleEntityTargetSchema = z.strictObject({
  type: z.literal('entity'),
  entityId: IdSchema,
  effect: z.enum(STEP_EFFECTS).nullable(),
  from: SingleLineTextSchema.nullable(),
  to: SingleLineTextSchema.nullable(),
  facts: z.array(SingleLineTextSchema),
  contexts: z.array(ReportContextSchema)
})

export const ReportBusinessRuleTargetSchema = z.discriminatedUnion('type', [
  ReportBusinessRuleResourceTargetSchema,
  ReportBusinessRuleContextTargetSchema,
  ReportBusinessRuleEntityTargetSchema
])

export const GRANT_OPERATORS = ['over', 'under', 'at-least', 'at-most', 'is', 'is-not', 'present', 'absent'] as const

/** One `when` condition: a fact with one operator, or the instance's own state. */
export const ReportGrantConditionSchema = z.strictObject({
  entityId: IdSchema.nullable(),
  fact: SingleLineTextSchema.nullable(),
  state: SingleLineTextSchema.nullable(),
  operator: z.enum(GRANT_OPERATORS).nullable(),
  /* An empty string passed the wire and then failed in staging, as a folder
     condition with no operator value; the wire refuses it first. */
  value: z.union([
    z.string().min(1),
    z.number(),
    z.boolean(),
    z.strictObject({ entityId: IdSchema, fact: SingleLineTextSchema })
  ]).nullable()
})

/**
 * One grant. Keys within it are AND; grants within a Rule are OR; Rules that
 * select one operation are AND. Every grant names a who.
 */
export const ReportGrantSchema = z.strictObject({
  actorIds: z.array(IdSchema),
  related: z.array(z.strictObject({ verb: SingleLineTextSchema, entityId: IdSchema })),
  self: z.boolean(),
  when: z.array(ReportGrantConditionSchema),
  unattended: z.boolean(),
  configuredByEntityId: IdSchema.nullable()
})

export const ReportBusinessRuleSchema = z.strictObject({
  id: IdSchema,
  title: SingleLineTextSchema,
  statement: RequiredMarkdownFragmentSchema,
  rationale: MarkdownFragmentSchema,
  appliesTo: z.array(ReportBusinessRuleTargetSchema).min(1),
  /** Null: no authorization claim. Empty: forbidden to everyone. Otherwise the grants. */
  permits: z.array(ReportGrantSchema).nullable(),
  ...ResourceContentSchema
})

/** One alternative: a same-type resource and the condition that selects it. */
export const ReportVariationAlternativeSchema = z.strictObject({
  resourceId: QualifiedIdSchema,
  selectedWhen: RequiredMarkdownFragmentSchema,
  /** A Version's label; null on every other subtype. */
  label: SingleLineTextSchema.nullable()
})

/**
 * A named set of supported alternatives. Selection is written once: the
 * mechanism, `takesEffect` and `stability` describe the set, `selectedWhen` and
 * a Version's `label` describe one alternative. Fields outside the subtype are
 * null or empty.
 */
export const ReportVariationSchema = z.strictObject({
  id: IdSchema,
  title: SingleLineTextSchema,
  description: RequiredMarkdownFragmentSchema,
  kind: z.enum(VARIATION_KINDS),
  of: z.enum(VARIATION_MEMBER_TYPES),
  takesEffect: RequiredMarkdownFragmentSchema,
  stability: RequiredMarkdownFragmentSchema,
  assignmentUnit: AssignmentUnitSchema.nullable(),
  assignmentMethod: RequiredMarkdownFragmentSchema.nullable(),
  assignmentFact: VariationFactSchema.nullable(),
  allocation: RequiredMarkdownFragmentSchema.nullable(),
  settings: z.array(VariationFactSchema),
  discriminator: VariationFactSchema.nullable(),
  alternatives: z.array(ReportVariationAlternativeSchema).min(2),
  ...ResourceContentSchema
})

export const ReportUnmappedAreaSchema = CoverageAreaSchema
export const ReportCoverageSchema = CoverageDocumentSchema

export const ProductReportSchema = z.strictObject({
  schemaVersion: z.literal(REPORT_SCHEMA_VERSION),
  id: ProductIdSchema,
  title: SingleLineTextSchema.max(160),
  summary: SingleLineTextSchema.max(400),
  description: RequiredMarkdownFragmentSchema.max(2000),
  category: IdSchema.max(60).nullable(),
  authors: z.array(ReportAuthorSchema),
  license: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+-]*$/).max(80).nullable(),
  intent: MarkdownFragmentSchema,
  supportingSections: z.array(ReportSupportingSectionSchema),
  references: z.array(ReportReferenceSchema),
  referenceProfile: z.enum(['workspace', 'portable']),
  tags: z.array(z.string().min(1).max(48)).max(24),
  /** Language tags the Product serves. */
  languages: z.array(LanguageTagSchema),
  generatedAt: z.iso.date(),
  lintVerbs: z.array(z.string().regex(/^[a-z]+$/)),
  generator: ReportGeneratorSchema,
  counts: ReportCountsSchema,
  limitations: z.array(z.string()),
  model: z.strictObject({
    taxonomies: z.strictObject({
      scenarioKinds: z.array(TaxonomyEntrySchema)
    }),
    interfaces: z.array(ReportInterfaceSchema).min(1),
    experiences: z.array(ReportExperienceSchema),
    screens: z.array(ReportScreenSchema),
    domains: z.array(ReportDomainSchema),
    entities: z.array(ReportEntitySchema),
    capabilities: z.array(ReportCapabilitySchema),
    capabilityScenarios: z.array(ReportCapabilityScenarioSchema),
    journeys: z.array(ReportJourneySchema),
    journeyScenarios: z.array(ReportJourneyScenarioSchema),
    businessRules: z.array(ReportBusinessRuleSchema),
    variations: z.array(ReportVariationSchema)
  }),
  coverage: ReportCoverageSchema
})

export type ProductReport = z.infer<typeof ProductReportSchema>
export type ReportDecisionPoint = z.infer<typeof ReportDecisionPointSchema>
export type ReportScreenEntity = z.infer<typeof ReportScreenEntitySchema>
export type ReportCoverage = z.infer<typeof ReportCoverageSchema>
export type ReportCounts = z.infer<typeof ReportCountsSchema>
export type ReportAuthor = z.infer<typeof ReportAuthorSchema>
export type ReportInterface = z.infer<typeof ReportInterfaceSchema>
export type ReportExperience = z.infer<typeof ReportExperienceSchema>
export type ReportDomain = z.infer<typeof ReportDomainSchema>
export type ReportEntity = z.infer<typeof ReportEntitySchema>
export type ReportEntityState = z.infer<typeof ReportEntityStateSchema>
export type ReportEntityFact = z.infer<typeof ReportEntityFactSchema>
export type ReportEntityRelation = z.infer<typeof ReportEntityRelationSchema>
export type ReportCapability = z.infer<typeof ReportCapabilitySchema>
export type ReportContext = z.infer<typeof ReportContextSchema>
export type ReportScreen = z.infer<typeof ReportScreenSchema>
export type ReportJourney = z.infer<typeof ReportJourneySchema>
export type ReportCapabilityScenario = z.infer<typeof ReportCapabilityScenarioSchema>
export type ReportScenarioRoute = z.infer<typeof ReportScenarioRouteSchema>
export type ReportScenarioStepContext = z.infer<typeof ReportScenarioStepContextSchema>
export type ReportScenarioStep = z.infer<typeof ReportScenarioStepSchema>
export type ReportScenarioStepEntity = z.infer<typeof ReportScenarioStepEntitySchema>
export type ReportGrant = z.infer<typeof ReportGrantSchema>
export type ReportGrantCondition = z.infer<typeof ReportGrantConditionSchema>
export type ReportJourneyScenario = z.infer<typeof ReportJourneyScenarioSchema>
export type ReportBusinessRule = z.infer<typeof ReportBusinessRuleSchema>
export type ReportBusinessRuleTarget = z.infer<typeof ReportBusinessRuleTargetSchema>
export type ReportVariation = z.infer<typeof ReportVariationSchema>
export type ReportVariationAlternative = z.infer<typeof ReportVariationAlternativeSchema>
export type ReportReference = z.infer<typeof ReportReferenceSchema>
export type ReportSupportingSection = z.infer<typeof ReportSupportingSectionSchema>
export type ReportUnmappedArea = z.infer<typeof ReportUnmappedAreaSchema>

export type ReportModel = ProductReport['model']

/** One resource in the report, reduced to what every "for every resource" check needs. */
type ReportResource = { id: string, references: ReportReference[] }

/**
 * Every resource collection in a report, keyed by its own name.
 *
 * The key union is read off the schema rather than written out, so a new
 * collection in `ProductReportSchema` leaves this record incomplete and fails
 * the build. `taxonomies` is an object, not an array of resources, so it drops
 * out on its own. See the same reasoning in `resourceCollections` — Entity was
 * added to the report and its ids and References went unchecked for a release
 * because the lists that would have covered it were written by hand.
 */
export type ReportCollectionName = {
  [K in keyof ReportModel]-?: ReportModel[K] extends ReportResource[] ? K : never
}[keyof ReportModel]

export function reportResourceCollections(model: ReportModel): Record<ReportCollectionName, ReportResource[]> {
  return {
    interfaces: model.interfaces,
    experiences: model.experiences,
    screens: model.screens,
    domains: model.domains,
    entities: model.entities,
    capabilities: model.capabilities,
    capabilityScenarios: model.capabilityScenarios,
    journeys: model.journeys,
    journeyScenarios: model.journeyScenarios,
    businessRules: model.businessRules,
    variations: model.variations
  }
}

/** The wire record in the shape the shared Variation rules read. */
export function reportVariationSet(variation: ReportVariation): VariationSet {
  return {
    ...variation,
    alternatives: variation.alternatives.map(item => ({ id: item.resourceId, selectedWhen: item.selectedWhen, label: item.label }))
  }
}


export function reportVariationIssues(model: ReportModel): string[] {
  const members = Object.fromEntries(Object.values(VARIATION_COLLECTION_OF)
    .map(collection => [collection, new Set(model[collection].map(item => item.id))])) as Record<VariationCollection, Set<string>>
  return variationIssues(model.variations.map(reportVariationSet), {
    members,
    entities: model.entities,
    scenarioOwners: new Map([
      ...model.capabilityScenarios.map(item => [item.id, `capability:${item.capabilityId}`] as const),
      ...model.journeyScenarios.map(item => [item.id, `journey:${item.journeyId}`] as const)
    ])
  })
    .map(issue => `variation "${issue.id}": ${issue.message}`)
}

function duplicateIssues(label: string, ids: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates].sort().map(id => `${label}: duplicate id "${id}"`)
}

function requireUniqueValues(
  issues: string[],
  label: string,
  relation: string,
  values: string[]
): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) issues.push(`${label}: ${relation} contains duplicate "${value}"`)
    seen.add(value)
  }
}

function validateSupportingSections(
  issues: string[],
  label: string,
  sections: ReportSupportingSection[],
  reservedHeadings: string[]
): void {
  const reserved = new Set(reservedHeadings.map(heading => heading.toLowerCase()))
  for (const item of sections) {
    if (reserved.has(item.heading.trim().toLowerCase())) {
      issues.push(`${label}: supporting section "${item.heading}" conflicts with a structured section`)
    }
  }
}

function missingRelation(
  issues: string[],
  label: string,
  relation: string,
  ids: string[],
  available: Set<string>
): void {
  for (const id of ids) {
    if (!available.has(id)) issues.push(`${label}: references missing ${relation} "${id}"`)
  }
}

function validateContextPlace(
  issues: string[],
  label: string,
  context: ReportContext,
  placeIds: Set<string>
): string {
  if (!placeIds.has(context.placeId)) issues.push(`${label}: Context references missing place "${context.placeId}"`)
  return context.placeId
}

function validateAvailabilityPlaces(
  issues: string[],
  label: string,
  availability: ReportContext[],
  availabilityPlaceIds: Set<string>,
  placeIds: Set<string>
): Set<string> {
  const places = new Set<string>()
  for (const context of availability) {
    const place = validateContextPlace(issues, label, context, placeIds)
    if (places.has(place)) issues.push(`${label}: duplicate availability Context place "${place}"`)
    if (placeIds.has(place) && !availabilityPlaceIds.has(place)) {
      issues.push(`${label}: availability Context place "${place}" must name an undivided Interface or an Experience`)
    }
    if (availabilityPlaceIds.has(place)) places.add(place)
  }
  return places
}

function sameIds(actual: string[], expected: Iterable<string>): boolean {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
}

function requireEntryPointInterfaces(
  issues: string[],
  label: string,
  entryPoints: Array<{ type: string }>,
  interfaces: Set<string>
): void {
  for (const point of entryPoints) {
    if (!interfaces.has(point.type)) {
      issues.push(`${label}: entry point references undeclared interface "${point.type}"`)
    }
  }
}

/** Cross-resource and computed-field validation, shared with every report consumer. */
export function validateProductReport(report: ProductReport): string[] {
  const issues: string[] = []
  const { model } = report
  /* Member key → Variation id. A Rule in a Variation applies only under its set's conditions, never unconditionally. */
  const variationOf = reportVariationMembership(model)
  /* An Actor is an Entity that acts. Every actor reference resolves here. */
  const actorIds = new Set(model.entities.filter(item => item.acts !== null).map(item => item.id))
  const requireActing = (label: string, ids: string[]) => {
    for (const id of ids) {
      if (actorIds.has(id)) continue
      if (model.entities.some(item => item.id === id)) issues.push(`${label}: "${id}" does not act`)
      else issues.push(`${label}: references missing entity "${id}"`)
    }
  }
  const identityIssues = placeIdentityIssues([
    ...model.interfaces.map(item => ({ id: item.id, label: `Interface "${item.id}"` })),
    ...model.experiences.map(item => ({ id: item.id, label: `Experience "${item.id}"` })),
    ...model.screens.map(item => ({ id: item.id, label: `Screen "${item.id}"` }))
  ])
  // Contexts and Screen parents have no unambiguous meaning until this holds.
  if (identityIssues.length) return identityIssues
  const interfaceIds = new Set(model.interfaces.map(item => item.id))
  const interfacesById = new Map(model.interfaces.map(item => [item.id, item]))
  const experiencesById = new Map(model.experiences.map(item => [item.id, item]))
  const domainIds = new Set(model.domains.map(item => item.id))
  const capabilityIds = new Set(model.capabilities.map(item => item.id))
  const entityIds = new Set(model.entities.map(item => item.id))
  const singletonIds = new Set(model.entities.filter(entity => entity.singleton).map(entity => entity.id))
  const entitiesById = new Map(model.entities.map(item => [item.id, item]))
  const capabilitiesById = new Map(model.capabilities.map(item => [item.id, item]))
  const capabilityAvailability = new Map<string, Set<string>>()
  const journeyIds = new Set(model.journeys.map(item => item.id))
  const capabilityScenarioIds = new Set(model.capabilityScenarios.map(item => item.id))
  const journeyScenarioIds = new Set(model.journeyScenarios.map(item => item.id))
  const kindIds = new Set(model.taxonomies.scenarioKinds.map(item => item.id))
  const experienceScopedInterfaces = new Set(model.experiences.flatMap(experience => experience.interfaceIds))
  const availabilityPlaceIds = new Set<string>([
    ...model.interfaces.filter(item => !experienceScopedInterfaces.has(item.id)).map(item => item.id),
    ...model.experiences.map(item => item.id)
  ])
  const placeIds = new Set<string>([
    ...model.interfaces.map(item => item.id),
    ...model.experiences.map(item => item.id),
    ...model.screens.map(item => item.id)
  ])

  requireUniqueValues(issues, 'product', 'tags', report.tags)
  requireUniqueValues(issues, 'product', 'languages', report.languages)
  requireUniqueValues(issues, 'product', 'lintVerbs', report.lintVerbs)
  const productLanguages = new Set(report.languages)
  issues.push(...reportVariationIssues(model))
  for (const variation of model.variations) {
    validateSupportingSections(issues, `variation "${variation.id}"`, variation.supportingSections, ['Intent'])
  }
  validateSupportingSections(issues, 'product', report.supportingSections, ['Intent'])

  const collections: Array<[string, string[]]> = [
    ...Object.entries(reportResourceCollections(model))
      .map(([label, items]) => [label, items.map(item => item.id)] as [string, string[]]),
    ['scenarioKinds', model.taxonomies.scenarioKinds.map(item => item.id)]
  ]
  for (const [label, ids] of collections) issues.push(...duplicateIssues(label, ids))
  const capabilityScenarioFiles = new Map(model.capabilityScenarios.map(item => [item.id, `capability scenario "${item.id}"`]))
  for (const scenario of model.journeyScenarios) {
    const previous = capabilityScenarioFiles.get(scenario.id)
    if (previous) issues.push(`journey scenario "${scenario.id}": id already used by ${previous}`)
  }

  for (const domain of model.domains) {
    validateSupportingSections(issues, `domain "${domain.id}"`, domain.supportingSections, ['Intent', 'Boundary'])
    // A Boundary that only asserts inclusion is a label, not a region — the
    // same heuristic the folder applies, so the two cannot disagree.
    if (!statesAnExclusion(domain.boundary)) {
      issues.push(`domain "${domain.id}": boundary must state what the Domain does not own, not only what it covers`)
    }
  }

  const screensById = new Map(model.screens.map(screen => [screen.id, screen]))
  /* Screens never nest: a Screen's parent is its Interface or Experience. */
  const containerForScreen = (screen: ReportScreen): string => parentPlace(screen.id) || ''
  for (const screen of model.screens) {
    const parent = containerForScreen(screen)
    if (screensById.has(parent)) issues.push(`screen "${screen.id}": Screens never nest; its parent "${parent}" is a Screen`)
  }
  for (const productInterface of model.interfaces) {
    requireUniqueValues(issues, `interface "${productInterface.id}"`, 'actorIds', productInterface.actorIds)
    requireUniqueValues(issues, `interface "${productInterface.id}"`, 'languages', productInterface.languages)
    for (const issue of interfaceLanguageIssues(productInterface.languages, productLanguages, 'the Product')) {
      issues.push(`interface "${productInterface.id}": ${issue}`)
    }
    /* The folder has always checked this and the wire never did. A key is the
       Interface's own type, or another Interface's id for a surface a reader
       arrives from; its own id is refused because `type` already says it. */
    for (const point of productInterface.entryPoints) {
      if (point.type === productInterface.type) continue
      if (point.type === productInterface.id || !interfaceIds.has(point.type)) {
        issues.push(`interface "${productInterface.id}": entry point key "${point.type}" must be its type "${productInterface.type}" or another Interface's id`)
      }
    }
    validateSupportingSections(
      issues,
      `interface "${productInterface.id}"`,
      productInterface.supportingSections,
      ['Intent', 'Capability boundary']
    )
    requireActing(`interface "${productInterface.id}"`, productInterface.actorIds)
  }
  for (const experience of model.experiences) {
    requireUniqueValues(issues, `experience "${experience.id}"`, 'actorIds', experience.actorIds)
    requireUniqueValues(issues, `experience "${experience.id}"`, 'interfaceIds', experience.interfaceIds)
    /* An Experience sits inside exactly one Interface, and its qualified id
       already names which. Expansion files it by that id, so an `interfaceIds`
       that says anything else is a second encoding of containment that the
       folder can never carry — a report validating under one Interface and
       expanding under another. */
    const parentInterfaceId = interfaceOf(experience.id)
    if (experience.interfaceIds.length !== 1 || experience.interfaceIds[0] !== parentInterfaceId) {
      issues.push(
        `experience "${experience.id}": interfaceIds must be exactly ["${parentInterfaceId}"], the Interface its id names`
      )
    }
    validateSupportingSections(
      issues,
      `experience "${experience.id}"`,
      experience.supportingSections,
      ['Intent', 'Capability boundary']
    )
    requireActing(`experience "${experience.id}"`, experience.actorIds)
    missingRelation(issues, `experience "${experience.id}"`, 'interface', experience.interfaceIds, interfaceIds)
    for (const interfaceId of experience.interfaceIds) {
      const supportedActors = new Set(interfacesById.get(interfaceId)?.actorIds || [])
      for (const actorId of experience.actorIds) {
        if (!supportedActors.has(actorId)) {
          issues.push(`experience "${experience.id}": actor "${actorId}" is not supported by interface "${interfaceId}"`)
        }
      }
    }
    requireEntryPointInterfaces(
      issues,
      `experience "${experience.id}"`,
      experience.entryPoints,
      new Set(experience.interfaceIds)
    )
  }
  for (const productInterface of model.interfaces) {
    const experiences = model.experiences.filter(experience => experience.interfaceIds.includes(productInterface.id))
    if (!experiences.length) continue
    const coveredActors = new Set(experiences.flatMap(experience => experience.actorIds))
    for (const actorId of productInterface.actorIds) {
      if (!coveredActors.has(actorId)) {
        issues.push(`interface "${productInterface.id}": actor "${actorId}" needs at least one Experience context`)
      }
    }
    /* One access mode is one context; only alternatives of one Variation share it. */
    const setOf = (experience: { id: string }) => variationOf.get(`experiences:${experience.id}`)
    for (const [index, experience] of experiences.entries()) {
      const twin = experiences.slice(index + 1).find(
        other => other.accessMode === experience.accessMode
          && other.actorIds.some(actor => experience.actorIds.includes(actor))
          && (setOf(experience) === undefined || setOf(experience) !== setOf(other))
      )
      if (twin) {
        issues.push(`experience "${experience.id}": shares \`${experience.accessMode}\` access and an Actor with "${twin.id}"; one access mode is one context`)
      }
    }
  }
  for (const capability of model.capabilities) {
    validateSupportingSections(
      issues,
      `capability "${capability.id}"`,
      capability.supportingSections,
      ['Intent']
    )
    if (capability.domainId && !domainIds.has(capability.domainId)) {
      issues.push(`capability "${capability.id}": references missing domain "${capability.domainId}"`)
    }
    capabilityAvailability.set(
      capability.id,
      validateAvailabilityPlaces(
        issues,
        `capability "${capability.id}"`,
        capability.availability,
        availabilityPlaceIds,
        placeIds
      )
    )
  }
  const supportedActorsForContainer = (place: string): Set<string> | undefined => {
    const experience = experiencesById.get(place)
    if (experience) return new Set(experience.actorIds)
    const productInterface = interfacesById.get(place)
    return productInterface ? new Set(productInterface.actorIds) : undefined
  }

  /*
   * A Screen beside `experiences/` is shared: it is inside every Experience of
   * its Interface. Containment, Scenario coverage, and Step Contexts therefore
   * read a divided Interface as the set of its Experiences, and an undivided
   * Interface or an Experience as itself. The folder linter applies the same
   * reading.
   */
  const experienceIdsByInterface = new Map<string, string[]>()
  for (const experience of model.experiences) {
    for (const interfaceId of experience.interfaceIds) {
      const owned = experienceIdsByInterface.get(interfaceId) || []
      owned.push(experience.id)
      experienceIdsByInterface.set(interfaceId, owned)
    }
  }
  const isDividedInterface = (place: string) => (experienceIdsByInterface.get(place) || []).length > 0
  const availabilityPlacesOf = (containerId: string): string[] =>
    isDividedInterface(containerId) ? experienceIdsByInterface.get(containerId) || [] : [containerId]
  const insideEvery = (supported: Set<string>, containerId: string) =>
    availabilityPlacesOf(containerId).every(place => supported.has(place))

  const resolveScenarioContext = (label: string, placeId: string) => {
    const screen = screensById.get(placeId)
    if (screen) return { place: placeId, containerId: containerForScreen(screen), screen }
    const experience = experiencesById.get(placeId)
    if (experience) {
      return { place: placeId, containerId: placeId, screen: undefined }
    }
    if (interfacesById.has(placeId)) {
      if (experienceScopedInterfaces.has(placeId)) {
        issues.push(`${label}: Interface "${placeId}" is divided into Experiences, so the Context must name one of them, one of their Screens, or a Screen it shares`)
      }
      return { place: placeId, containerId: placeId, screen: undefined }
    }
    issues.push(`${label}: Context references missing place "${placeId}"`)
    return undefined
  }

  type ReportScenarioForValidation = ReportCapabilityScenario | ReportJourneyScenario
  const validateScenarioShape = (
    scenario: ReportScenarioForValidation,
    label: string,
    parentCapabilityId?: string,
    journeyActors?: Set<string>
  ) => {
    requireUniqueValues(issues, label, 'actorIds', scenario.actorIds)
    requireUniqueValues(issues, label, 'route ids', scenario.routes.map(route => route.id))
    const routeNames = new Set<string>()
    const routeIds = new Set(scenario.routes.map(route => route.id))
    const routeContextPlaces = new Map<string, string[]>(scenario.routes.map(route => [route.id, []]))
    for (const route of scenario.routes) {
      const normalized = route.name.trim().toLocaleLowerCase()
      if (routeNames.has(normalized)) issues.push(`${label}: duplicate route name "${route.name}"`)
      routeNames.add(normalized)
    }

    const derivedActors = new Set<string>()
    const allContextPlaces = new Set<string>()
    const allContainers = new Set<string>()
    const capabilitySteps: Array<{ capabilityId: string, contextPlaces: Set<string>, containers: Set<string> }> = []
    const screenIds = new Set<string>()
    const unattendedScenario = scenario.steps[0]?.unattended === true
    /* `unattended` is a trigger, not a step property: it says this Scenario is
       started by the Product's own schedule. Only the first Step can carry it,
       and a trigger nobody performs is a condition. The folder has always said
       so; a report that did not expanded into a folder `lint` refuses. */
    if (unattendedScenario && scenario.steps[0]?.kind !== 'condition') {
      issues.push(`${label}: an unattended trigger must be a condition Step`)
    }
    for (const [index, step] of scenario.steps.entries()) {
      if (index > 0 && step.unattended) {
        issues.push(`${label}: step ${index + 1}: "unattended" is valid only on the first Step`)
      }
    }
    /* Keep the same cross-Step invariants as the authored folder: an Entity is
       either bare or aliased throughout one Scenario, and each named instance
       resumes from the state the preceding Step left it in. */
    const instanceStates = new Map<string, string>()
    const aliasModes = new Map<string, 'bare' | 'aliased'>()
    for (const [index, step] of scenario.steps.entries()) {
      const stepLabel = `${label}: step ${index + 1}`
      /* An actor Step names who performs it; a Product or condition Step may
         name who it is attributable to. Either joins the Actor set. An
         unattended Scenario names nobody. */
      if (step.kind === 'actor' && !step.actorId) issues.push(`${stepLabel}: an actor Step needs one actorId`)
      if (step.actorId) {
        derivedActors.add(step.actorId)
        requireActing(stepLabel, [step.actorId])
        if (unattendedScenario) issues.push(`${stepLabel}: an unattended Scenario names no actor`)
      }
      if (parentCapabilityId && step.capabilityId !== parentCapabilityId) {
        issues.push(`${stepLabel}: capabilityId must equal parent capability "${parentCapabilityId}"`)
      }
      if (step.capabilityId) {
        capabilitySteps.push({ capabilityId: step.capabilityId, contextPlaces: new Set<string>(), containers: new Set<string>() })
        if (!capabilityIds.has(step.capabilityId)) {
          issues.push(`${stepLabel}: references missing capability "${step.capabilityId}"`)
        }
      }

      /*
       * What a Step claims about a thing is checked against that thing's own
       * states: every state named is one the Entity has, a creation says where
       * it starts and a removal where it ends when the Entity has states at
       * all, and one Step states one thing about one instance.
       */
      requireUniqueValues(issues, stepLabel, 'entities', step.entities.map(entry => `${entry.entityId}\u0000${entry.as ?? ''}`))
      // The folder names an entry by its alias, otherwise its Entity, so that name is unique too.
      requireUniqueValues(issues, stepLabel, 'entity references', step.entities.map(entry => entry.as ?? entry.entityId))
      if (!parentCapabilityId && !step.capabilityId && step.entities.some(entry => entry.effect !== 'reads')) {
        issues.push(`${stepLabel}: a Journey Step that creates, changes or removes an Entity needs a capabilityId`)
      }
      /* A removal goes with another removal of this Step whose Entity holds it —
         declares a one-to-many or one-to-one relation to it, itself included —
         and following `with` always ends at one that goes with nothing. */
      const recordKey = (entityId: string, as: string | null) => `${entityId}\u0000${as ?? ''}`
      const recordsOf = (effect: string) => new Map(step.entities
        .filter(entry => entry.effect === effect)
        .map(entry => [recordKey(entry.entityId, entry.as), entry]))
      for (const entry of step.entities) {
        if (entry.with === null) continue
        const removalRecords = recordsOf(entry.effect)
        const target = removalRecords.get(recordKey(entry.with.entityId, entry.with.as))
        if ((entry.effect !== 'removes' && entry.effect !== 'creates') || !target || target === entry) {
          issues.push(`${stepLabel}: "with" on "${entry.entityId}" must name another record of this step with the same effect, from a "creates" or "removes" record`)
          continue
        }
        const holds = (holder: string, held: string) => (entitiesById.get(holder)?.relations ?? [])
          .some(relation => relation.entityId === held && (relation.cardinality === 'one-to-many' || relation.cardinality === 'one-to-one'))
        if (!holds(target.entityId, entry.entityId)) {
          issues.push(`${stepLabel}: "${entry.entityId}" goes with "${target.entityId}", but "${target.entityId}" declares no one-to-many or one-to-one relation to "${entry.entityId}"`)
        }
        const visited = new Set<typeof entry>()
        let current: typeof entry | undefined = entry
        while (current?.with && !visited.has(current)) {
          visited.add(current)
          current = removalRecords.get(recordKey(current.with.entityId, current.with.as))
        }
        if (current && visited.has(current)) issues.push(`${stepLabel}: "with" on "${entry.entityId}" forms a cycle`)
      }
      for (const entry of step.entities) {
        const entity = entitiesById.get(entry.entityId)
        if (!entity) {
          issues.push(`${stepLabel}: references missing entity "${entry.entityId}"`)
          continue
        }
        const name = entry.as ? `${entry.entityId} (${entry.as})` : entry.entityId
        const mode = entry.as ? 'aliased' : 'bare'
        const priorMode = aliasModes.get(entry.entityId)
        if (priorMode && priorMode !== mode) {
          issues.push(`${stepLabel}: "${entry.entityId}" is ${priorMode === 'aliased' ? 'aliased' : 'bare'} elsewhere in this Scenario; once an Entity is aliased, every mention of it is`)
        }
        aliasModes.set(entry.entityId, mode)
        requireUniqueValues(issues, stepLabel, 'facts', entry.facts)
        if (entry.facts.length && entry.effect === 'removes') {
          issues.push(`${stepLabel}: a "removes" entry carries no facts`)
        }
        for (const issue of unknownFactIssues(entry.entityId, entry.facts, entity)) issues.push(`${stepLabel}: ${issue}`)
        if (entry.effect === 'reads' && (entry.from !== null || entry.to !== null)) {
          issues.push(`${stepLabel}: a "reads" entry carries no state`)
          continue
        }
        if (entry.effect === 'creates' && entry.from !== null) {
          issues.push(`${stepLabel}: a "creates" entry has no "from"`)
          continue
        }
        if (entry.effect === 'removes' && entry.to !== null) {
          issues.push(`${stepLabel}: a "removes" entry has no "to"`)
          continue
        }
        if (entry.effect === 'changes' && (entry.from === null) !== (entry.to === null)) {
          issues.push(`${stepLabel}: a "changes" entry carries both "from" and "to", or neither`)
          continue
        }
        const hasStates = entity.states.length > 0
        for (const value of [entry.from, entry.to]) {
          if (value === null) continue
          if (!hasStates) issues.push(`${stepLabel}: "${value}" names a state, and entity "${entry.entityId}" declares none`)
          else if (!entity.states.some(state => state.name === value)) {
            issues.push(`${stepLabel}: "${value}" is not a state of entity "${entry.entityId}"`)
          }
        }
        if (hasStates && entry.effect === 'creates' && entry.to === null) {
          issues.push(`${stepLabel}: creating "${name}" needs "to"`)
        }
        if (hasStates && entry.effect === 'removes' && entry.from === null) {
          issues.push(`${stepLabel}: removing "${name}" needs "from"`)
        }

        const instance = `${entry.entityId}\0${entry.as ?? ''}`
        const left = instanceStates.get(instance)
        if (entry.from !== null && left !== undefined && left !== entry.from) {
          issues.push(
            `${stepLabel}: "${name}" was left in "${left}" by an earlier Step, not "${entry.from}"; if these are different instances, give them aliases`
          )
        }
        if (entry.effect === 'removes') instanceStates.delete(instance)
        else if (entry.to !== null) instanceStates.set(instance, entry.to)
      }

      for (const entity of undeclaredEntityMentions(
        step.text, model.entities, step.entities.map(entry => entry.entityId), step.actorId
      )) {
        issues.push(`${stepLabel}: text names "${entity.title}" and "entities" does not declare it`)
      }

      requireUniqueValues(issues, stepLabel, 'routeIds', step.contexts.map(context => context.routeId))
      if (!step.contexts.length) continue
      const contextualizedRouteIds = new Set(step.contexts.map(context => context.routeId))
      if (!sameIds([...contextualizedRouteIds], routeIds)) {
        issues.push(`${stepLabel}: contexts must assign every declared route or be empty`)
      }
      for (const context of step.contexts) {
        const contextLabel = `${stepLabel}: route "${context.routeId}"`
        if (!routeIds.has(context.routeId)) issues.push(`${contextLabel}: references undeclared route`)
        routeContextPlaces.get(context.routeId)?.push(context.placeId)
        const resolved = resolveScenarioContext(contextLabel, context.placeId)
        if (!resolved) continue
        allContextPlaces.add(resolved.place)
        allContainers.add(resolved.containerId)
        if (resolved.screen) screenIds.add(resolved.screen.id)
        const capabilityStep = step.capabilityId ? capabilitySteps.at(-1) : undefined
        capabilityStep?.contextPlaces.add(resolved.place)
        capabilityStep?.containers.add(resolved.containerId)
        if (step.capabilityId) {
          const supported = capabilityAvailability.get(step.capabilityId) || new Set<string>()
          if (!insideEvery(supported, resolved.containerId)) {
            issues.push(`${contextLabel}: Context place "${resolved.place}" is outside capability "${step.capabilityId}"`)
          }
        }
        if (step.actorId) {
          const supported = supportedActorsForContainer(resolved.containerId) || new Set<string>()
          if (!supported.has(step.actorId)) {
            issues.push(`${contextLabel}: Context place does not support actor "${step.actorId}"`)
          }
        }
      }
    }
    if (!scenario.steps.some(step => step.kind === 'actor') && !unattendedScenario) {
      issues.push(`${label}: needs at least one actor Step, or an unattended first condition Step`)
    }
    if (!sameIds(scenario.actorIds, derivedActors)) {
      issues.push(`${label}: actorIds must equal the union of every step actorId`)
    }
    for (const route of scenario.routes) {
      if (!(routeContextPlaces.get(route.id) || []).length) issues.push(`${label}: route "${route.id}" must have a Context on at least one Step`)
    }
    const sequences = new Map<string, string>()
    for (const route of scenario.routes) {
      const sequence = (routeContextPlaces.get(route.id) || []).join('\n')
      if (!sequence) continue
      const twin = sequences.get(sequence)
      if (twin) issues.push(`${label}: route "${route.id}" repeats every Context place of route "${twin}"`)
      else sequences.set(sequence, route.id)
    }
    // An unattended Scenario derives no Actor, so this question has no answer
    // for it. Its Contexts say where an Actor observes the outcome.
    const isUnattended = scenario.steps[0]?.unattended === true
    const supportedSomewhere = new Set<string>()
    if (!isUnattended) {
      for (const container of allContainers) {
        const supported = supportedActorsForContainer(container) || new Set<string>()
        const participating = scenario.actorIds.filter(actorId => supported.has(actorId))
        if (!participating.length) issues.push(`${label}: Context place "${container}" permits none of the Scenario Actors`)
        for (const actorId of participating) supportedSomewhere.add(actorId)
      }
    }
    for (const actorId of scenario.actorIds) {
      if (actorIds.has(actorId) && !supportedSomewhere.has(actorId)) {
        issues.push(`${label}: actor "${actorId}" is not supported by any selected Context place`)
      }
    }
    if (journeyActors) {
      for (const route of scenario.routes) {
        const firstActorStep = scenario.steps.find(step =>
          step.kind === 'actor' && step.contexts.some(context => context.routeId === route.id)
        )
        if (!firstActorStep?.actorId || !journeyActors.has(firstActorStep.actorId)) {
          issues.push(`${label}: route "${route.id}" must begin its contextualized Actor Steps with a Journey Actor`)
        }
      }
    }
    return { allContextPlaces, allContainers, capabilitySteps, screenIds }
  }

  const capabilityScenariosById = new Map(model.capabilityScenarios.map(item => [item.id, item]))
  const capabilityScenarioContextPlaces = new Map<string, Set<string>>()
  const coveredCapabilityPlaces = new Map<string, Set<string>>()
  const capabilityScenarioScreens = new Map<string, Set<string>>()
  for (const scenario of model.capabilityScenarios) {
    const label = `capability scenario "${scenario.id}"`
    validateSupportingSections(
      issues,
      label,
      scenario.supportingSections,
      ['Intent', 'Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases', 'Goal', 'Success criterion']
    )
    if (!kindIds.has(scenario.kindId)) issues.push(`${label}: references missing scenario kind "${scenario.kindId}"`)
    if (!capabilityIds.has(scenario.capabilityId)) {
      issues.push(`${label}: references missing capability "${scenario.capabilityId}"`)
    }
    const { allContextPlaces, allContainers, screenIds } = validateScenarioShape(scenario, label, scenario.capabilityId)
    capabilityScenarioScreens.set(scenario.id, screenIds)
    capabilityScenarioContextPlaces.set(scenario.id, allContextPlaces)
    const covered = coveredCapabilityPlaces.get(scenario.capabilityId) || new Set<string>()
    for (const place of allContainers) for (const inside of availabilityPlacesOf(place)) covered.add(inside)
    coveredCapabilityPlaces.set(scenario.capabilityId, covered)
    const supported = capabilityAvailability.get(scenario.capabilityId) || new Set<string>()
    for (const place of allContainers) {
      if (!insideEvery(supported, place)) {
        issues.push(`${label}: Context place "${place}" is outside capability "${scenario.capabilityId}"`)
      }
    }
  }
  for (const capability of model.capabilities) {
    const covered = coveredCapabilityPlaces.get(capability.id) || new Set<string>()
    for (const place of capabilityAvailability.get(capability.id) || []) {
      if (!covered.has(place)) {
        issues.push(`capability "${capability.id}": availability Context place "${place}" needs Capability Scenario coverage`)
      }
    }
  }

  const journeysById = new Map(model.journeys.map(item => [item.id, item]))
  const journeyScenariosById = new Map(model.journeyScenarios.map(item => [item.id, item]))
  const journeyScenarioSteps = new Map<string, Array<{ capabilityId: string, contextPlaces: Set<string>, containers: Set<string> }>>()
  const journeyScenarioScreens = new Map<string, Set<string>>()
  for (const scenario of model.journeyScenarios) {
    const label = `journey scenario "${scenario.id}"`
    validateSupportingSections(
      issues,
      label,
      scenario.supportingSections,
      ['Intent', 'Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases', 'Goal', 'Success criterion']
    )
    const journey = journeysById.get(scenario.journeyId)
    if (!journey) issues.push(`${label}: references missing journey "${scenario.journeyId}"`)
    if (!kindIds.has(scenario.kindId)) issues.push(`${label}: references missing scenario kind "${scenario.kindId}"`)
    const journeyActorSet = new Set(journey?.actorIds || [])
    const { capabilitySteps, screenIds } = validateScenarioShape(scenario, label, undefined, journeyActorSet)
    journeyScenarioScreens.set(scenario.id, screenIds)
    if (journey && !scenario.actorIds.some(actorId => journeyActorSet.has(actorId))) {
      issues.push(`${label}: actorIds must include at least one actor from journey "${scenario.journeyId}"`)
    }
    if (!capabilitySteps.length) issues.push(`${label}: needs at least one Capability-bearing step`)
    journeyScenarioSteps.set(scenario.id, capabilitySteps)
    if (scenario.result === 'achieved' && new Set(capabilitySteps.map(item => item.capabilityId)).size < 2) {
      issues.push(`${label}: an achieved Journey Scenario needs at least two distinct Capabilities`)
    } else if (scenario.result === 'achieved' && journey) {
      /* As lint counts it: the Product carries one Journey Actor across, so only
         Steps that Actor performs or is attributed count, per Actor. A report
         lint would refuse is refused here too, so a release never publishes what
         `open` and `pull` then reject. */
      const carried = new Map<string, Set<string>>()
      for (const step of scenario.steps) {
        if (!step.capabilityId || !step.actorId || !journeyActorSet.has(step.actorId)) continue
        carried.set(step.actorId, (carried.get(step.actorId) || new Set()).add(step.capabilityId))
      }
      if (![...carried.values()].some(capabilities => capabilities.size >= 2)) {
        issues.push(`${label}: an achieved Journey Scenario must carry one Journey Actor through at least two Capabilities`)
      }
    }
  }

  for (const journey of model.journeys) {
    const label = `journey "${journey.id}"`
    requireUniqueValues(issues, label, 'actorIds', journey.actorIds)
    requireUniqueValues(issues, label, 'capabilityIds', journey.capabilityIds)
    requireUniqueValues(issues, label, 'failureOnlyCapabilityIds', journey.failureOnlyCapabilityIds)
    requireUniqueValues(issues, label, 'domainIds', journey.domainIds)
    validateSupportingSections(
      issues,
      label,
      journey.supportingSections,
      ['Intent', 'Goal', 'Success criterion', 'Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases']
    )
    requireActing(label, journey.actorIds)
    const scenarios = model.journeyScenarios.filter(scenario => scenario.journeyId === journey.id)
    const achieved = scenarios.filter(scenario => scenario.result === 'achieved')
    if (!achieved.length) issues.push(`${label}: needs at least one achieved Journey Scenario`)
    const achievedActors = new Set(achieved.flatMap(scenario => scenario.actorIds))
    for (const actorId of journey.actorIds) {
      if (!achievedActors.has(actorId)) issues.push(`${label}: actor "${actorId}" needs an achieved Journey Scenario`)
    }
    const achievedCapabilities = new Set(achieved.flatMap(scenario => scenario.steps.flatMap(item => item.capabilityId ? [item.capabilityId] : [])))
    const failedCapabilities = new Set(
      scenarios.filter(scenario => scenario.result === 'not-achieved')
        .flatMap(scenario => scenario.steps.flatMap(item => item.capabilityId ? [item.capabilityId] : []))
    )
    const failureOnly = new Set([...failedCapabilities].filter(capabilityId => !achievedCapabilities.has(capabilityId)))
    const domains = new Set(
      [...achievedCapabilities].map(capabilityId => model.capabilities.find(item => item.id === capabilityId)?.domainId).filter(Boolean) as string[]
    )
    missingRelation(issues, label, 'capability', journey.capabilityIds, capabilityIds)
    missingRelation(issues, label, 'failure-only capability', journey.failureOnlyCapabilityIds, capabilityIds)
    missingRelation(issues, label, 'domain', journey.domainIds, domainIds)
    if (!sameIds(journey.capabilityIds, achievedCapabilities)) issues.push(`${label}: capabilityIds must equal the achieved-step Capability union`)
    if (!sameIds(journey.failureOnlyCapabilityIds, failureOnly)) issues.push(`${label}: failureOnlyCapabilityIds must equal the failure-only Capability set`)
    if (!sameIds(journey.domainIds, domains)) issues.push(`${label}: domainIds must equal the Domains derived from achieved-step Capabilities`)
  }

  /* Every Step placed exactly on a Screen, by Screen id. */
  const stepsOnScreen = new Map<string, Array<{ label: string, step: ReportScenarioStep }>>()
  for (const scenario of [...model.capabilityScenarios, ...model.journeyScenarios]) {
    const scenarioLabel = 'capabilityId' in scenario ? `capability scenario "${scenario.id}"` : `journey scenario "${scenario.id}"`
    for (const [index, step] of scenario.steps.entries()) {
      for (const place of new Set(step.contexts.map(context => context.placeId))) {
        if (!screensById.has(place)) continue
        const placed = stepsOnScreen.get(place) || []
        placed.push({ label: `${scenarioLabel}: step ${index + 1}`, step })
        stepsOnScreen.set(place, placed)
      }
    }
  }

  for (const screen of model.screens) {
    const label = `screen "${screen.id}"`
    requireUniqueValues(issues, label, 'capabilityIds', screen.capabilityIds)
    requireUniqueValues(issues, label, 'capabilityScenarioIds', screen.capabilityScenarioIds)
    requireUniqueValues(issues, label, 'journeyScenarioIds', screen.journeyScenarioIds)
    requireUniqueValues(issues, label, 'entities', screen.entities.map(entry => entry.entityId))
    for (const entry of screen.entities) {
      const entity = entitiesById.get(entry.entityId)
      if (!entity) {
        issues.push(`${label}: references missing entity "${entry.entityId}"`)
        continue
      }
      requireUniqueValues(issues, label, `shows of "${entry.entityId}"`, entry.shows)
      requireUniqueValues(issues, label, `collects of "${entry.entityId}"`, entry.collects)
      for (const issue of screenEntityIssues(entry.entityId, entry, entity)) issues.push(`${label}: ${issue}`)
    }
    validateSupportingSections(
      issues,
      label,
      screen.supportingSections,
      ['Intent', 'Information presented', 'Available actions', 'View states', 'Capability boundary']
    )
    const containerId = containerForScreen(screen)
    if (!availabilityPlacesOf(containerId).every(place => availabilityPlaceIds.has(place))) {
      issues.push(`${label}: containing place "${containerId}" must be an Interface or an Experience`)
    }
    missingRelation(issues, label, 'capability', screen.capabilityIds, capabilityIds)
    missingRelation(issues, label, 'Capability Scenario', screen.capabilityScenarioIds, capabilityScenarioIds)
    missingRelation(issues, label, 'Journey Scenario', screen.journeyScenarioIds, journeyScenarioIds)
    requireEntryPointInterfaces(issues, label, screen.entryPoints, new Set([interfaceOf(containerId)]))
    for (const capabilityId of screen.capabilityIds) {
      const supported = capabilityAvailability.get(capabilityId)
      if (!supported) continue
      const missing = availabilityPlacesOf(containerId).filter(place => !supported.has(place))
      if (!missing.length) continue
      issues.push(isDividedInterface(containerId)
        ? `${label}: capability "${capabilityId}" must be available in every Experience of "${containerId}", which shares this Screen; missing "${missing.join('", "')}"`
        : `${label}: capability "${capabilityId}" is not available in containing place "${containerId}"`)
    }
    const expectedCapabilityScenarios = model.capabilityScenarios
      .filter(scenario => capabilityScenarioScreens.get(scenario.id)?.has(screen.id))
      .map(scenario => scenario.id)
    const expectedJourneyScenarios = model.journeyScenarios
      .filter(scenario => journeyScenarioScreens.get(scenario.id)?.has(screen.id))
      .map(scenario => scenario.id)
    if (!sameIds(screen.capabilityScenarioIds, expectedCapabilityScenarios)) {
      issues.push(`${label}: capabilityScenarioIds must equal the Scenario Step Screen backlinks`)
    }
    if (!sameIds(screen.journeyScenarioIds, expectedJourneyScenarios)) {
      issues.push(`${label}: journeyScenarioIds must equal the Scenario Step Screen backlinks`)
    }
    const placed = stepsOnScreen.get(screen.id) || []
    const expectedCapabilities = [...new Set(placed.flatMap(item => item.step.capabilityId ? [item.step.capabilityId] : []))]
    if (!sameIds(screen.capabilityIds, expectedCapabilities)) {
      issues.push(`${label}: capabilityIds must equal the Capabilities derived from placed Steps`)
    }
    const presented = new Map(screen.entities.map(entry => [entry.entityId, entry]))
    for (const { label: stepLabel, step } of placed) {
      for (const issue of screenReadIssues(screen.id, presented, step, actorIds)) issues.push(`${stepLabel}: ${issue}`)
    }
  }
  /*
   * Entity semantics, resolved exactly as Interface relations are. A report is
   * expanded straight into an authored folder, so an edge the folder rules
   * reject must not survive the wire — it would produce a `product-model/`
   * that fails `lint` the moment it lands.
   */
  const entityChanged = new Set<string>()
  for (const scenario of [...model.capabilityScenarios, ...model.journeyScenarios]) {
    for (const step of scenario.steps) {
      for (const entry of step.entities) {
        if (entry.effect !== 'reads') entityChanged.add(entry.entityId)
      }
    }
  }
  const entityPresentedOn = new Set(model.screens.flatMap(screen => screen.entities.map(entry => entry.entityId)))
  const namedAsActor = new Set<string>([
    ...[...model.capabilityScenarios, ...model.journeyScenarios].flatMap(scenario => scenario.actorIds),
    ...model.interfaces.flatMap(item => item.actorIds),
    ...model.experiences.flatMap(item => item.actorIds),
    ...model.journeys.flatMap(item => item.actorIds),
    ...model.businessRules.flatMap(rule => (rule.permits ?? []).flatMap(grant => [
      ...grant.actorIds,
      ...(grant.related.length ? [grant.related[grant.related.length - 1]!.entityId] : [])
    ]))
  ])
  const citedByVariation = new Set(model.variations.flatMap(variation => variationEntityReferences(variation)))
  const citedByRule = new Set<string>(model.businessRules.flatMap(rule => (rule.permits ?? []).flatMap(grant => [
    ...(grant.configuredByEntityId ? [grant.configuredByEntityId] : []),
    ...grant.when.flatMap(condition => [
      ...(condition.entityId ? [condition.entityId] : []),
      ...(typeof condition.value === 'object' && condition.value !== null ? [condition.value.entityId] : [])
    ])
  ])))
  for (const entity of model.entities) {
    const label = `entity "${entity.id}"`
    validateSupportingSections(issues, label, entity.supportingSections, ['Intent', 'Information kept', 'States'])
    if (!entity.informationKept.length && !entity.states.length && entity.acts === null) {
      issues.push(`${label}: needs information kept, states, or acts`)
    }
    if ((entity.acts === null) !== (entity.kind === null)) {
      issues.push(`${label}: kind and acts are present together or not at all`)
    }
    if (entity.singleton && entity.acts !== null) issues.push(`${label}: an Entity that acts is never singleton`)
    if (entity.domainId && !domainIds.has(entity.domainId)) {
      issues.push(`${label}: references missing domain "${entity.domainId}"`)
    }
    requireUniqueValues(issues, label, 'informationKept', entity.informationKept.map(fact => fact.name))

    const stateNames = new Set<string>()
    for (const state of entity.states) {
      if (stateNames.has(state.name)) issues.push(`${label}: duplicate state "${state.name}"`)
      stateNames.add(state.name)
    }

    // Declared on one side; only a repeated verb at the same target is wrong.
    const relationKeys = new Set<string>()
    for (const relation of entity.relations) {
      if (!entityIds.has(relation.entityId)) {
        issues.push(`${label}: relation references missing entity "${relation.entityId}"`)
      }
      const key = `${relation.entityId}\u0000${relation.verb}`
      if (relationKeys.has(key)) issues.push(`${label}: duplicate relation "${relation.verb} ${relation.entityId}"`)
      relationKeys.add(key)
      const singletonIssue = singletonRelationIssue({ from: entity.id, to: relation.entityId, cardinality: relation.cardinality }, singletonIds)
      if (singletonIssue) issues.push(`${label}: relation "${relation.verb} ${relation.entityId}" ${singletonIssue}`)

      /* A relation states both ends, so an Entity relating back is very often
         the same relationship written twice — but it can equally be a second,
         genuinely different relationship between one pair, which nothing here
         can tell apart. The folder grades that guess as a warning, and the wire
         refuses nothing the folder accepts, so it is not checked here. */
    }

    // A relation between Entities never satisfies this: vocabulary that only
    // points at itself is still vocabulary no behaviour uses. Acting does, and
    // so does a Rule reading a settings Entity.
    if (!entityChanged.has(entity.id) && !entityPresentedOn.has(entity.id)
      && !namedAsActor.has(entity.id) && !citedByRule.has(entity.id) && !citedByVariation.has(entity.id)) {
      issues.push(`${label}: no step changes it, no Screen presents it, nothing names it as an actor, no Rule reads it, and no Variation chooses by it`)
    }
  }

  /*
   * A `related` path starts at the Rule's one Entity target and walks declared
   * relations and their inverses, one unambiguous hop at a time, onto an
   * Entity that acts.
   */
  const relationEdges = model.entities.flatMap(entity => entity.relations.map(relation => ({
    from: entity.id, to: relation.entityId, cardinality: relation.cardinality
  })))
  const walkRelated = (start: string, segments: Array<{ verb: string, entityId: string }>, label: string): string | undefined => {
    let current = start
    for (const [index, segment] of segments.entries()) {
      const segmentLabel = `${label}: related segment ${index + 1}`
      if (!entityIds.has(segment.entityId)) {
        issues.push(`${segmentLabel}: references missing entity "${segment.entityId}"`)
        return undefined
      }
      if (segment.entityId === current) {
        issues.push(`${segmentLabel}: a self-relation has no direction to follow`)
        return undefined
      }
      const forward = (entitiesById.get(current)?.relations ?? [])
        .filter(relation => relation.verb === segment.verb && relation.entityId === segment.entityId).length
      const inverse = (entitiesById.get(segment.entityId)?.relations ?? [])
        .filter(relation => relation.verb === segment.verb && relation.entityId === current).length
      if (forward + inverse !== 1) {
        issues.push(`${segmentLabel}: "${segment.verb}" joins "${current}" and "${segment.entityId}" ${forward + inverse === 0 ? 'in neither direction' : 'more than once'}`)
        return undefined
      }
      current = segment.entityId
    }
    return current
  }

  for (const rule of model.businessRules) {
    const label = `business rule "${rule.id}"`
    validateSupportingSections(issues, label, rule.supportingSections, ['Intent', 'Rationale'])
    const seenTargets = new Set<string>()
    const capabilityTargets = new Set<string>()
    const journeyTargets = new Set<string>()
    const capabilityScenarioTargets: string[] = []
    const journeyScenarioTargets: string[] = []
    const directContextPlaces: string[] = []
    for (const [index, target] of rule.appliesTo.entries()) {
      const targetLabel = `${label}: appliesTo item ${index + 1}`
      if (target.type === 'context') {
        const place = validateContextPlace(issues, targetLabel, target.context, placeIds)
        const key = `context\0${place}`
        if (seenTargets.has(key)) issues.push(`${targetLabel}: duplicate Context target place "${place}"`)
        const overlapping = directContextPlaces.find(existing =>
          existing !== place && (containsPlace(existing, place) || containsPlace(place, existing))
        )
        if (overlapping) issues.push(`${targetLabel}: Context target place "${place}" is redundant with "${overlapping}"`)
        seenTargets.add(key)
        directContextPlaces.push(place)
        continue
      }
      if (target.type === 'entity') {
        const entity = entitiesById.get(target.entityId)
        if (!entity) issues.push(`${targetLabel}: references missing entity "${target.entityId}"`)
        const entityKey = `entity\0${target.entityId}\0${target.effect ?? ''}\0${target.from ?? ''}\0${target.to ?? ''}\0${target.facts.join(',')}`
        if (seenTargets.has(entityKey)) issues.push(`${targetLabel}: duplicate target "entity:${target.entityId}"`)
        seenTargets.add(entityKey)
        if (target.from !== null && (target.effect === 'creates' || target.effect === 'reads')) {
          issues.push(`${targetLabel}: "from" selects nothing on a "${target.effect}" target`)
        }
        if (target.to !== null && (target.effect === 'removes' || target.effect === 'reads')) {
          issues.push(`${targetLabel}: "to" selects nothing on a "${target.effect}" target`)
        }
        if (entity) {
          for (const value of [target.from, target.to]) {
            if (value !== null && !entity.states.some(state => state.name === value)) {
              issues.push(`${targetLabel}: "${value}" is not a state of entity "${target.entityId}"`)
            }
          }
          for (const issue of unknownFactIssues(target.entityId, target.facts, entity)) issues.push(`${targetLabel}: ${issue}`)
        }
        const presenting = model.screens.filter(screen => screen.entities.some(entry =>
          entry.entityId === target.entityId
          && (!target.facts.length || [...entry.shows, ...entry.collects].some(fact => target.facts.includes(fact)))
        )).map(screen => screen.id)
        const seenEntityPlaces: string[] = []
        for (const [contextIndex, context] of target.contexts.entries()) {
          const contextLabel = `${targetLabel}: Context ${contextIndex + 1}`
          const place = validateContextPlace(issues, contextLabel, context, placeIds)
          if (seenEntityPlaces.includes(place)) issues.push(`${contextLabel}: duplicate Context place "${place}"`)
          seenEntityPlaces.push(place)
          if (rule.permits === null && placeIds.has(place) && !presenting.some(screenId => screenId === place || containsPlace(place, screenId))) {
            issues.push(`${contextLabel}: Context place "${place}" presents entity "${target.entityId}" nowhere`)
          }
        }
        continue
      }
      const key = `${target.type}\0${target.id}`
      if (seenTargets.has(key)) issues.push(`${targetLabel}: duplicate target "${target.type}:${target.id}"`)
      seenTargets.add(key)
      let supported = new Set<string>()
      if (target.type === 'capability') {
        if (!capabilityIds.has(target.id)) issues.push(`${targetLabel}: references missing capability "${target.id}"`)
        capabilityTargets.add(target.id)
        supported = new Set(capabilityAvailability.get(target.id) || [])
        for (const screen of model.screens) {
          if (supported.has(containerForScreen(screen)) && screen.capabilityIds.includes(target.id)) supported.add(screen.id)
        }
      } else if (target.type === 'capability-scenario') {
        if (!capabilityScenarioIds.has(target.id)) issues.push(`${targetLabel}: references missing Capability Scenario "${target.id}"`)
        capabilityScenarioTargets.push(target.id)
        supported = capabilityScenarioContextPlaces.get(target.id) || supported
      } else if (target.type === 'journey') {
        if (!journeyIds.has(target.id)) issues.push(`${targetLabel}: references missing journey "${target.id}"`)
        journeyTargets.add(target.id)
        for (const scenario of model.journeyScenarios.filter(item => item.journeyId === target.id && item.result === 'achieved')) {
          for (const entry of journeyScenarioSteps.get(scenario.id) || []) {
            for (const place of entry.contextPlaces) supported.add(place)
          }
        }
      } else {
        if (!journeyScenarioIds.has(target.id)) issues.push(`${targetLabel}: references missing Journey Scenario "${target.id}"`)
        journeyScenarioTargets.push(target.id)
        for (const entry of journeyScenarioSteps.get(target.id) || []) {
          for (const place of entry.contextPlaces) supported.add(place)
        }
      }
      const seenContextPlaces: string[] = []
      for (const [contextIndex, context] of target.contexts.entries()) {
        const contextLabel = `${targetLabel}: Context ${contextIndex + 1}`
        const place = validateContextPlace(issues, contextLabel, context, placeIds)
        if (seenContextPlaces.includes(place)) issues.push(`${contextLabel}: duplicate Context place "${place}"`)
        const overlapping = seenContextPlaces.find(existing =>
          existing !== place && (containsPlace(existing, place) || containsPlace(place, existing))
        )
        if (overlapping) issues.push(`${contextLabel}: Context place "${place}" is redundant with "${overlapping}"`)
        seenContextPlaces.push(place)
        const sharedScreen = screensById.get(place)
        const insideTarget = supported.has(place)
          || [...supported].some(candidate => containsPlace(place, candidate))
          || (sharedScreen !== undefined && insideEvery(supported, containerForScreen(sharedScreen)))
        if (!insideTarget) {
          issues.push(`${contextLabel}: Context place "${place}" is outside target "${target.type}:${target.id}"`)
        }
      }
    }
    for (const scenarioId of capabilityScenarioTargets) {
      const capabilityId = capabilityScenariosById.get(scenarioId)?.capabilityId
      if (capabilityId && capabilityTargets.has(capabilityId)) {
        issues.push(`${label}: target "capability-scenario:${scenarioId}" is redundant with capability target "${capabilityId}"`)
      }
    }
    for (const scenarioId of journeyScenarioTargets) {
      const journeyId = journeyScenariosById.get(scenarioId)?.journeyId
      if (journeyId && journeyTargets.has(journeyId)) {
        issues.push(`${label}: target "journey-scenario:${scenarioId}" is redundant with journey target "${journeyId}"`)
      }
    }

    /* Grants resolve exactly as the folder's do: every id, every path, every fact. */
    if (rule.permits !== null) {
      const entityTargets = rule.appliesTo.filter(target => target.type === 'entity')
      if (entityTargets.length !== rule.appliesTo.length) {
        issues.push(`${label}: permits needs Entity targets only`)
      }
      const singleTarget = entityTargets.length === 1 ? entityTargets[0] : undefined
      const targetEntity = singleTarget && singleTarget.type === 'entity' ? entitiesById.get(singleTarget.entityId) : undefined
      for (const [grantIndex, grant] of rule.permits.entries()) {
        const grantLabel = `${label}: grant ${grantIndex + 1}`
        requireUniqueValues(issues, grantLabel, 'actorIds', grant.actorIds)
        requireActing(grantLabel, grant.actorIds)
        if (!grant.actorIds.length && !grant.related.length && !grant.self && !grant.unattended && grant.configuredByEntityId === null) {
          issues.push(`${grantLabel}: names nobody`)
        }
        if (grant.configuredByEntityId !== null && !entityIds.has(grant.configuredByEntityId)) {
          issues.push(`${grantLabel}: configuredByEntityId references missing entity "${grant.configuredByEntityId}"`)
        }
        if (grant.self) {
          for (const target of entityTargets) {
            if (target.type === 'entity' && entityIds.has(target.entityId) && !actorIds.has(target.entityId)) {
              issues.push(`${grantLabel}: self needs entity "${target.entityId}" to act`)
            }
          }
        }
        if (grant.related.length) {
          if (!singleTarget || singleTarget.type !== 'entity') {
            issues.push(`${grantLabel}: related needs exactly one Entity target`)
          } else {
            const endpoint = walkRelated(singleTarget.entityId, grant.related, grantLabel)
            if (endpoint !== undefined && !actorIds.has(endpoint)) issues.push(`${grantLabel}: related ends on "${endpoint}", which does not act`)
            if (endpoint !== undefined && grant.actorIds.length && !grant.actorIds.includes(endpoint)) {
              issues.push(`${grantLabel}: actorIds excludes "${endpoint}", where related ends`)
            }
          }
        }
        for (const [conditionIndex, condition] of grant.when.entries()) {
          const conditionLabel = `${grantLabel}: condition ${conditionIndex + 1}`
          if (condition.state !== null) {
            if (condition.fact !== null || condition.operator !== null || condition.entityId !== null || condition.value !== null) {
              issues.push(`${conditionLabel}: a state condition carries nothing else`)
              continue
            }
            if (!singleTarget || singleTarget.type !== 'entity') {
              issues.push(`${conditionLabel}: a state condition needs exactly one Entity target`)
              continue
            }
            if (singleTarget.effect === 'creates') issues.push(`${conditionLabel}: a state condition on a creates target`)
            if (targetEntity && !targetEntity.states.some(state => state.name === condition.state)) {
              issues.push(`${conditionLabel}: "${condition.state}" is not a state of entity "${singleTarget.entityId}"`)
            }
            continue
          }
          if (condition.fact === null || condition.operator === null) {
            issues.push(`${conditionLabel}: needs a fact with an operator, or a state`)
            continue
          }
          if ((condition.operator === 'present' || condition.operator === 'absent') !== (condition.value === true)
            && (condition.operator === 'present' || condition.operator === 'absent')) {
            issues.push(`${conditionLabel}: "${condition.operator}" takes true`)
          }
          let holder = targetEntity
          let holderId = singleTarget && singleTarget.type === 'entity' ? singleTarget.entityId : undefined
          if (condition.entityId !== null) {
            holder = entitiesById.get(condition.entityId)
            holderId = condition.entityId
            if (!holder) issues.push(`${conditionLabel}: references missing entity "${condition.entityId}"`)
          } else if (!singleTarget) {
            issues.push(`${conditionLabel}: a fact without entityId needs exactly one Entity target`)
            continue
          }
          if (holder && !holder.informationKept.some(item => item.name === condition.fact)) {
            issues.push(`${conditionLabel}: "${condition.fact}" is not a fact of entity "${holderId}"`)
          }
          if (holder && condition.entityId !== null) {
            const issue = conditionInstanceIssue({
              entityId: condition.entityId,
              actorIds: grant.actorIds,
              pathIds: grant.related.map(segment => segment.entityId),
              targetId: singleTarget?.type === 'entity' ? singleTarget.entityId : undefined,
              singletonIds,
              relations: relationEdges
            })
            if (issue) issues.push(`${conditionLabel}: ${issue}`)
          }
          if (typeof condition.value === 'object' && condition.value !== null) {
            const threshold = condition.value
            const thresholdHolder = entitiesById.get(threshold.entityId)
            if (!thresholdHolder) {
              issues.push(`${conditionLabel}: the threshold references missing entity "${threshold.entityId}"`)
            } else {
              for (const issue of unknownFactIssues(threshold.entityId, [threshold.fact], thresholdHolder)) issues.push(`${conditionLabel}: the threshold's ${issue}`)
              const targetId = singleTarget?.type === 'entity' ? singleTarget.entityId : undefined
              const issue = threshold.entityId === targetId ? undefined : conditionInstanceIssue({
                entityId: threshold.entityId,
                actorIds: grant.actorIds,
                pathIds: grant.related.map(segment => segment.entityId),
                targetId,
                singletonIds,
                relations: relationEdges
              })
              if (issue) issues.push(`${conditionLabel}: the threshold ${issue}`)
            }
          }
        }
      }
    }
  }

  /* A structurally valid permission Rule must also agree with every Step and
     Screen it selects. This is the same pure evaluator used by folder lint, so
     accepting a report cannot defer a contradiction until expansion. */
  issues.push(...validatePermissionBehavior({
    rules: model.businessRules
      .filter(rule => !variationOf.has(`businessRules:${rule.id}`) && rule.permits !== null
        && rule.appliesTo.length > 0
        && rule.appliesTo.every(target => target.type === 'entity'))
      .map(rule => ({
        id: rule.id,
        targets: rule.appliesTo.flatMap(target => target.type === 'entity' ? [{
          entityId: target.entityId,
          effect: target.effect,
          from: target.from,
          to: target.to,
          facts: target.facts,
          contextPlaces: target.contexts.map(context => context.placeId)
        }] : []),
        grants: (rule.permits ?? []).map(grant => ({
          actorIds: grant.actorIds,
          relatedActorId: grant.related.at(-1)?.entityId ?? null,
          self: grant.self,
          unattended: grant.unattended,
          stateConditions: grant.when.flatMap(condition => condition.state === null ? [] : [condition.state])
        }))
      })),
    operations: [...model.capabilityScenarios, ...model.journeyScenarios].flatMap(scenario => {
      const unattended = scenario.steps[0]?.unattended === true
      const scenarioLabel = 'capabilityId' in scenario
        ? `capability scenario "${scenario.id}"`
        : `journey scenario "${scenario.id}"`
      /* A Step without `contexts` is shared by all routes, so it happens inside
         the Scenario's places rather than in none of them. */
      const places = [...new Set(scenario.steps.flatMap(step => step.contexts.map(context => context.placeId)))]
      return scenario.steps.flatMap((step, index) => step.entities.map(entry => ({
        label: `${scenarioLabel}: step ${index + 1}`,
        actorId: step.actorId,
        unattended,
        entityId: entry.entityId,
        alias: entry.as,
        effect: entry.effect,
        from: entry.from,
        to: entry.to,
        facts: entry.facts,
        contextPlaces: operationPlaces(step.contexts.map(context => context.placeId), places),
        goesWith: entry.with !== null
      })))
    }),
    screens: model.screens.map(screen => {
      const containerId = containerForScreen(screen)
      return {
        label: `screen "${screen.id}"`,
        id: screen.id,
        containerId,
        entities: screen.entities,
        actorIds: [...(supportedActorsForContainer(containerId) ?? [])]
      }
    })
  }))

  if (model.capabilities.length === 0) {
    issues.push('the model needs at least one capability')
  }

  const expectedCounts = {
    interfaces: model.interfaces.length,
    experiences: model.experiences.length,
    screens: model.screens.length,
    domains: model.domains.length,
    entities: model.entities.length,
    capabilities: model.capabilities.length,
    capabilityScenarios: model.capabilityScenarios.length,
    journeys: model.journeys.length,
    journeyScenarios: model.journeyScenarios.length,
    businessRules: model.businessRules.length,
    variations: model.variations.length
  }
  const referenceHosts: Array<{ id: string, references: ReportReference[] }> = [
    { id: 'product', references: report.references },
    ...Object.values(reportResourceCollections(model)).flat()
  ]
  for (const host of referenceHosts) {
    const targets = new Set<string>()
    for (const reference of host.references) {
      if (targets.has(reference.target)) {
        issues.push(`"${host.id}": duplicate reference target "${reference.target}"`)
      }
      targets.add(reference.target)
    }
  }

  if (report.referenceProfile === 'portable') {
    for (const kind of ['covered', 'exclusions', 'unmapped', 'limitations'] as const) {
      if (report.coverage[kind].length) {
        issues.push(`referenceProfile is portable but coverage.${kind} describes the origin repository's code`)
      }
    }
    for (const field of ['scope', 'method'] as const) {
      if (report.coverage[field]) issues.push(`referenceProfile is portable but coverage.${field} describes the origin repository's code`)
    }
    const entryPointHosts = [...model.interfaces, ...model.experiences, ...model.screens]
    for (const host of entryPointHosts) {
      for (const point of host.entryPoints) {
        if (isRepositoryEntryPoint(point.path)) {
          issues.push(`"${host.id}": portable report still exposes the repository entry point "${point.path}"`)
        }
      }
    }
    for (const host of referenceHosts) {
      for (const reference of host.references) {
        if (
          reference.kind === 'code'
          || reference.role === 'implementation'
          || !isHttpUrl(reference.target)
        ) {
          issues.push(`"${host.id}": portable report still exposes reference "${reference.target}"`)
        }
      }
    }
  }

  for (const key of Object.keys(expectedCounts) as Array<keyof typeof expectedCounts>) {
    const value = expectedCounts[key]
    if (report.counts[key] !== value) issues.push(`counts.${key} must equal ${value}`)
  }

  return issues
}

function isAbsoluteFilesystemPath(value: string): boolean {
  if (/^file:/i.test(value)) return true
  if (value.includes('\\')) return true
  if (/^[a-z]:[\\/]/i.test(value) || /^(?:\\\\|\/\/)/.test(value)) return true
  return /^\/Users(?:\/|$)/.test(value)
    || /^\/home\/[^/]+(?:\/|$)/.test(value)
    || /^\/(?:private|var|tmp|etc|usr|opt|srv|mnt|media|Volumes|workspace|workspaces|repo|repos)(?:\/|$)/.test(value)
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isRepositoryEntryPoint(value: string): boolean {
  const path = value.trim()
  if (isAbsoluteFilesystemPath(path)) return true
  if (isHttpUrl(path)) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return false
  if (!path.includes('/')) return false
  return !path.startsWith('/')
}

/** Project a report into the source-free profile delivered outside its repository. */
export function projectPortableReport(report: ProductReport): ProductReport {
  const portableReferences = <T extends { kind: string, role: string, target: string }>(items: T[]): T[] =>
    items.filter(reference =>
      reference.kind !== 'code'
      && reference.role !== 'implementation'
      && isHttpUrl(reference.target)
    )
  const publicEntryPoints = <T extends { path: string }>(items: T[]): T[] =>
    items.filter(point => !isRepositoryEntryPoint(point.path))

  const strip = <T extends { references: Array<{ kind: string, role: string, target: string }> }>(items: T[]): T[] =>
    items.map(item => ({ ...item, references: portableReferences(item.references) }))
  const stripWithEntryPoints = <
    T extends { references: Array<{ kind: string, role: string, target: string }>, entryPoints: Array<{ path: string }> }
  >(items: T[]): T[] =>
    items.map(item => ({
      ...item,
      references: portableReferences(item.references),
      entryPoints: publicEntryPoints(item.entryPoints)
    }))

  return {
    ...report,
    referenceProfile: 'portable',
    references: portableReferences(report.references),
    model: {
      ...report.model,
      interfaces: stripWithEntryPoints(report.model.interfaces),
      experiences: stripWithEntryPoints(report.model.experiences),
      screens: stripWithEntryPoints(report.model.screens),
      domains: strip(report.model.domains),
      entities: strip(report.model.entities),
      capabilities: strip(report.model.capabilities),
      capabilityScenarios: strip(report.model.capabilityScenarios),
      journeys: strip(report.model.journeys),
      journeyScenarios: strip(report.model.journeyScenarios),
      businessRules: strip(report.model.businessRules),
      variations: strip(report.model.variations)
    },
    /* Coverage describes the origin repository's code, none of which is true
       of a receiving repository, so a portable report carries none. */
    coverage: { scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] }
  }
}

export function parseProductReport(input: unknown): ProductReport {
  const parsed = ProductReportSchema.safeParse(input)
  if (!parsed.success) throw new Error(describeReportShapeError(input, parsed.error))
  const report = parsed.data
  const issues = validateProductReport(report)
  if (issues.length) throw new Error(`Report validation failed:\n- ${issues.join('\n- ')}`)
  return report
}

/*
 * A shape failure is one sentence a person can act on, never Zod's issue array.
 * The wrong version is the common case and gets its own wording; anything else
 * names the first offending path.
 */
function describeReportShapeError(input: unknown, error: z.ZodError): string {
  const served = typeof input === 'object' && input !== null && 'schemaVersion' in input
    ? String((input as { schemaVersion: unknown }).schemaVersion)
    : undefined
  if (served !== undefined && served !== REPORT_SCHEMA_VERSION) {
    return `This is a Product Report of schema version ${served}; only ${REPORT_SCHEMA_VERSION} is accepted, and there is no compatibility reader. Export it again with a current pdd-kit.`
  }
  const first = error.issues[0]
  const path = first?.path.length ? first.path.map(String).join('.') : 'the report'
  return `This is not a valid Product Report: at ${path}, ${first?.message ?? 'the shape is wrong'}.`
}

/** Additional publication policy for a Product Report published as a public Blueprint. */
export function validateBlueprintReport(report: ProductReport): string[] {
  const issues: string[] = []
  if (!report.category) issues.push('category is required for a public Blueprint')
  if (!report.tags.length) issues.push('at least one tag is required for a public Blueprint')
  if (!report.authors.length) issues.push('at least one author is required for a public Blueprint')
  if (!report.license) issues.push('license is required for a public Blueprint')
  // Capability and Capability Scenario coverage bind every report, so the
  // product-report validator has already refused a model without them.
  return issues
}

/** Key-sorted JSON shared by report digest producers and consumers. */
export function canonicalReportJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalReportJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalReportJson(record[key])}`
    ).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
