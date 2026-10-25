/**
 * `pdd-kit/report` — strict Product Report v20 contract as a library.
 *
 * This entry point depends only on `zod` and stays free of Node built-ins so
 * browser consumers can validate, project, and digest reports consistently.
 */

export {
  INTERFACE_TYPES,
} from './core/interface-types.js'

export type {
  InterfaceType,
} from './core/interface-types.js'

export {
  reportVariationMembership,
} from './core/variation-membership.js'

export {
  REPORT_SCHEMA_VERSION,
  ReportSupportingSectionSchema,
  ReportReferenceSchema,
  TaxonomyEntrySchema,
  ReportCountsSchema,
  ReportAuthorSchema,
  ReportGeneratorSchema,
  ReportEntryPointSchema,
  ReportContextSchema,
  ReportInterfaceSchema,
  ReportExperienceSchema,
  ReportDomainSchema,
  ReportEntitySchema,
  ReportEntityStateSchema,
  ReportEntityFactSchema,
  ReportEntityRelationSchema,
  ReportCapabilitySchema,
  ReportScreenEntitySchema,
  ReportScreenSchema,
  ReportJourneySchema,
  ReportDecisionPointSchema,
  ReportScenarioRouteSchema,
  ReportScenarioStepContextSchema,
  ReportScenarioStepEntitySchema,
  ReportGrantSchema,
  ReportGrantConditionSchema,
  GRANT_OPERATORS,
  STEP_EFFECTS,
  ReportScenarioStepSchema,
  ReportCapabilityScenarioSchema,
  ReportJourneyScenarioSchema,
  ReportBusinessRuleTargetSchema,
  ReportBusinessRuleSchema,
  ReportVariationSchema,
  ReportVariationAlternativeSchema,
  ReportCoverageSchema,
  ReportUnmappedAreaSchema,
  ProductReportSchema,
  validateProductReport,
  validateBlueprintReport,
  parseProductReport,
  projectPortableReport,
  canonicalReportJson
} from './core/portable.js'

export type {
  ProductReport,
  ReportCoverage,
  ReportUnmappedArea,
  ReportCounts,
  ReportAuthor,
  ReportInterface,
  ReportExperience,
  ReportDomain,
  ReportEntity,
  ReportEntityState,
  ReportEntityFact,
  ReportEntityRelation,
  ReportCapability,
  ReportContext,
  ReportScreen,
  ReportScreenEntity,
  ReportJourney,
  ReportCapabilityScenario,
  ReportScenarioRoute,
  ReportScenarioStepContext,
  ReportScenarioStep,
  ReportScenarioStepEntity,
  ReportGrant,
  ReportGrantCondition,
  ReportJourneyScenario,
  ReportBusinessRule,
  ReportVariation,
  ReportVariationAlternative,
  ReportBusinessRuleTarget,
  ReportDecisionPoint,
  ReportReference,
  ReportSupportingSection
} from './core/portable.js'
