import type { VariationKind, VariationMemberType } from '../core/variations.js'
import type { ResourceFile, PddModel } from '../core/model.js'
import type { ProductReport } from '../core/portable.js'
import { join, relative, sep } from 'node:path'
import { writeGeneratedFile } from '../core/generated-files.js'
import { lsFiles } from '../core/git.js'
import { section, supportingSections } from '../core/markdown.js'
import type { InterfaceType } from '../core/interface-types.js'
import { loadModel } from '../core/model.js'
import { qualify } from '../core/ids.js'
import { resolveModelRoot, type ModelRoot } from '../core/model-root.js'
import {
  ProductReportSchema,
  REPORT_SCHEMA_VERSION,
  projectPortableReport,
  validateProductReport
} from '../core/portable.js'
import { failureIssue, modelIssues, type ModelIssue } from '../core/model-issues.js'
import { cliVersion } from '../version.js'
import { lintModel } from './lint.js'

const byId = <T extends { id: string }>(items: T[]): T[] => [...items].sort((a, b) => a.id.localeCompare(b.id, 'en'))
const sorted = (items: string[]): string[] => [...items].sort()
const contexts = (items: Array<{ place: string }>) =>
  [...items].sort((left, right) => left.place.localeCompare(right.place, 'en')).map(item => ({ placeId: item.place }))

const IMAGE_ASSET = /\.(png|jpe?g|gif|webp|avif|svg)$/i

/**
 * Co-located assets become workspace-profile references.
 *
 * Class is the path: anything under `implementation/` describes this
 * realization and so carries `role: implementation`, which the portable
 * projection already drops — along with every repository-relative target. That
 * is why assets need no new wire field and why export carries no binaries yet.
 */
function assetReferences(resource: ResourceFile, modelRoot: string) {
  const meta = new Map(resource.assetMeta.map(item => [item.file, item]))
  return resource.assets.map((file) => {
    const declared = meta.get(file)
    return {
      kind: (IMAGE_ASSET.test(file) ? 'visual' : 'doc') as 'visual' | 'doc',
      role: (file.startsWith('implementation/') ? 'implementation' : 'intent') as 'implementation' | 'intent',
      target: relative(modelRoot, join(resource.directory, file)).split(sep).join('/'),
      ...(declared?.title ? { title: declared.title } : {})
    }
  })
}

function resourceContent(resource: ResourceFile, recognized: string[], modelRoot: string) {
  return {
    intent: section(resource.doc, 'Intent') || '',
    supportingSections: supportingSections(resource.doc, ['Intent', ...recognized]),
    references: [...assetReferences(resource, modelRoot), ...resource.references].map(reference => ({
      kind: reference.kind,
      role: reference.role,
      target: reference.target,
      ...(reference.title ? { title: reference.title } : {})
    }))
  }
}

/**
 * Compile a linted model into a workspace Product Report, references intact.
 *
 * The pure compiler. `buildProject` projects what this returns before writing
 * it, so a delivered Blueprint carries only portable references.
 */
export function compileReport(
  model: PddModel,
  today: string,
  /**
   * Base for co-located asset targets. Reference targets resolve
   * repository-relative — the same base `lint` lists tracked files from — so a
   * nested model's assets stay addressable from the repository root.
   */
  assetBase = model.root
): ProductReport {
  const capabilityById = new Map(model.capabilities.map(capability => [capability.id, capability]))
  const journeyScenariosByJourney = new Map(model.journeys.map(journey => [
    journey.id,
    model.journeyScenarios.filter(scenario => scenario.journey === journey.id)
  ]))
  const scenarioActorIds = (scenario: typeof model.capabilityScenarios[number] | typeof model.journeyScenarios[number]) =>
    sorted([...new Set(scenario.steps.flatMap(step => step.actor ? [step.actor] : []))])
  const scenarioRoutes = (scenario: typeof model.capabilityScenarios[number] | typeof model.journeyScenarios[number]) =>
    scenario.routes.map(route => ({ id: route.id, name: route.name }))
  const scenarioSteps = (
    scenario: typeof model.capabilityScenarios[number] | typeof model.journeyScenarios[number],
    parentCapability?: string
  ) => scenario.steps.map(step => ({
    text: step.text,
    kind: step.kind as 'actor' | 'product' | 'condition',
    actorId: step.actor ?? null,
    capabilityId: parentCapability ?? step.capability ?? null,
    /* The default is resolved here, so a reader of the wire never has to know
       which value the folder is allowed to omit. */
    entities: step.entities.map(entry => {
      /* `with` names another entry of this Step by alias or Entity id; the
         wire carries the resolved pair, so a reader never resolves it. */
      const goesWith = entry.with === undefined
        ? undefined
        : step.entities.find(other => (other.as ?? other.entity) === entry.with)
      return {
        entityId: entry.entity,
        as: entry.as ?? null,
        effect: entry.effect ?? 'changes' as const,
        from: entry.from ?? null,
        to: entry.to ?? null,
        facts: sorted(entry.facts ?? []),
        with: goesWith ? { entityId: goesWith.entity, as: goesWith.as ?? null } : null
      }
    }),
    unattended: step.unattended === true,
    contexts: scenario.routes.flatMap(route => {
      const context = step.contexts.find(item => item.routeId === route.id)
      return context ? [{ routeId: route.id, placeId: context.place }] : []
    })
  }))
  const screenScenarioIds = (screenId: string, kind: 'capability' | 'journey') => sorted(
    (kind === 'capability' ? model.capabilityScenarios : model.journeyScenarios)
      .filter(scenario => scenario.steps.some(step => step.contexts.some(context => context.place === screenId)))
      .map(scenario => scenario.id)
  )

  const report: ProductReport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    id: model.product.id,
    title: model.product.doc.title,
    summary: model.product.summary || model.product.doc.lead,
    description: model.product.doc.lead,
    category: model.product.category ?? null,
    authors: model.product.authors,
    license: model.product.license ?? null,
    intent: section(model.product.doc, 'Intent') || '',
    supportingSections: supportingSections(model.product.doc, ['Intent']),
    references: model.product.references.map(reference => ({
      kind: reference.kind,
      role: reference.role,
      target: reference.target,
      ...(reference.title ? { title: reference.title } : {})
    })),
    referenceProfile: 'workspace',
    tags: sorted(model.product.tags),
    languages: sorted(model.product.languages),
    lintVerbs: sorted(model.config.lintVerbs),
    generatedAt: today,
    generator: { name: 'pdd-kit-cli', version: cliVersion() },
    counts: {
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
    },
    limitations: model.product.limitations,
    model: {
      taxonomies: {
        scenarioKinds: byId(model.scenarioKinds).map(kind => ({
          id: kind.id,
          name: kind.name,
          description: kind.description,
          ...(kind.colorSlot !== undefined ? { colorSlot: kind.colorSlot } : {})
        }))
      },
      interfaces: byId(model.interfaces).map(productInterface => ({
        id: productInterface.id,
        title: productInterface.doc.title,
        description: productInterface.doc.lead,
        type: productInterface.type as InterfaceType,
        actorIds: sorted(productInterface.actors),
        entryPoints: productInterface.entryPoints,
        languages: sorted(productInterface.languages),
        ...resourceContent(productInterface, [], assetBase)
      })),
      experiences: byId(model.experiences).map(experience => ({
        id: experience.id,
        title: experience.doc.title,
        description: experience.doc.lead,
        actorIds: sorted(experience.actors),
        interfaceIds: [experience.interface],
        accessMode: experience.access as 'public' | 'authenticated' | 'restricted',
        entryPoints: experience.entryPoints,
        ...resourceContent(experience, [], assetBase)
      })),
      screens: byId(model.screens).map(screen => ({
        id: screen.id,
        title: screen.doc.title,
        description: screen.doc.lead,
        capabilityIds: sorted(screen.capabilities),
        entities: [...screen.entities]
          .sort((left, right) => left.entity.localeCompare(right.entity, 'en'))
          .map(entry => ({ entityId: entry.entity, shows: sorted(entry.shows), collects: sorted(entry.collects) })),
        capabilityScenarioIds: screenScenarioIds(screen.id, 'capability'),
        journeyScenarioIds: screenScenarioIds(screen.id, 'journey'),
        entryPoints: screen.entryPoints,
        ...resourceContent(screen, [], assetBase)
      })),
      domains: byId(model.domains).map(domain => ({
        id: domain.id,
        name: domain.doc.title,
        description: domain.doc.lead,
        boundary: domain.boundary,
        ...(domain.colorSlot !== undefined ? { colorSlot: domain.colorSlot } : {}),
        ...resourceContent(domain, ['Boundary'], assetBase)
      })),
      entities: byId(model.entities).map(entity => ({
        id: entity.id,
        title: entity.doc.title,
        description: entity.doc.lead,
        ...(entity.domain ? { domainId: entity.domain } : {}),
        kind: (entity.kind as 'person' | 'system' | undefined) ?? null,
        acts: (entity.acts as 'external' | 'internal' | undefined) ?? null,
        singleton: entity.singleton,
        informationKept: entity.informationKept.map(fact => ({ name: fact.name, description: fact.description })),
        relations: entity.relations.map(relation => ({
          entityId: relation.entity, verb: relation.verb, cardinality: relation.cardinality
        })),
        states: entity.states.map(state => ({ name: state.title, content: state.description })),
        ...resourceContent(entity, ['Information kept', 'States'], assetBase)
      })),
      capabilities: byId(model.capabilities).map(capability => ({
        id: capability.id,
        title: capability.doc.title,
        description: capability.doc.lead,
        ...(capability.domain ? { domainId: capability.domain } : {}),
        availability: contexts(capability.availability),
        ...resourceContent(capability, [], assetBase)
      })),
      capabilityScenarios: byId(model.capabilityScenarios).map(scenario => ({
        id: scenario.id,
        capabilityId: scenario.capability,
        title: scenario.doc.title,
        kindId: scenario.kind,
        actorIds: scenarioActorIds(scenario),
        routes: scenarioRoutes(scenario),
        trigger: scenario.trigger,
        steps: scenarioSteps(scenario, scenario.capability),
        decisionPoints: scenario.decisionPoints,
        outcome: scenario.outcome,
        edgeCases: scenario.edgeCases,
        ...resourceContent(scenario, ['Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases'], assetBase)
      })),
      journeys: byId(model.journeys).map((journey) => {
        const scenarios = journeyScenariosByJourney.get(journey.id) || []
        const achievedCapabilityIds = new Set(
          scenarios.filter(scenario => scenario.result === 'achieved')
            .flatMap(scenario => scenario.steps.flatMap(item => item.capability ? [item.capability] : []))
        )
        const failedCapabilityIds = new Set(
          scenarios.filter(scenario => scenario.result === 'not-achieved')
            .flatMap(scenario => scenario.steps.flatMap(item => item.capability ? [item.capability] : []))
        )
        const failureOnlyCapabilityIds = [...failedCapabilityIds].filter(id => !achievedCapabilityIds.has(id))
        const domainIds = [...achievedCapabilityIds]
          .map(id => capabilityById.get(id)?.domain)
          .filter((id): id is string => Boolean(id))
        return {
          id: journey.id,
          title: journey.doc.title,
          goal: journey.goal,
          successCriterion: journey.successCriterion,
          actorIds: sorted(journey.actors),
          capabilityIds: sorted([...achievedCapabilityIds]),
          failureOnlyCapabilityIds: sorted(failureOnlyCapabilityIds),
          domainIds: sorted([...new Set(domainIds)]),
          ...resourceContent(journey, ['Goal', 'Success criterion'], assetBase)
        }
      }),
      journeyScenarios: byId(model.journeyScenarios).map(scenario => ({
        id: scenario.id,
        journeyId: scenario.journey,
        title: scenario.doc.title,
        kindId: scenario.kind,
        actorIds: scenarioActorIds(scenario),
        result: scenario.result as 'achieved' | 'not-achieved',
        routes: scenarioRoutes(scenario),
        steps: scenarioSteps(scenario),
        trigger: scenario.trigger,
        decisionPoints: scenario.decisionPoints,
        outcome: scenario.outcome,
        edgeCases: scenario.edgeCases,
        ...resourceContent(scenario, ['Trigger', 'Decision points', 'Outcome', 'Edge cases'], assetBase)
      })),
      businessRules: byId(model.businessRules).map(rule => ({
        id: rule.id,
        title: rule.doc.title,
        statement: rule.doc.lead,
        rationale: rule.rationale,
        appliesTo: rule.appliesTo.map(target => target.type === 'context'
          ? { type: 'context' as const, context: { placeId: target.context.place } }
          : target.type === 'entity'
            ? {
                type: 'entity' as const,
                entityId: target.id,
                effect: target.effect ?? null,
                from: target.from ?? null,
                to: target.to ?? null,
                facts: sorted(target.facts),
                contexts: target.contexts.map(context => ({ placeId: context.place }))
              }
            : {
                type: target.type,
                id: target.id,
                contexts: target.contexts.map(context => ({ placeId: context.place }))
              }),
        permits: rule.permits === undefined ? null : rule.permits.map(grant => ({
          actorIds: sorted(grant.actors),
          related: grant.related.map(segment => ({ verb: segment.verb, entityId: segment.entity })),
          self: grant.self === true,
          when: grant.when.map(condition => ({
            entityId: condition.entity ?? null,
            fact: condition.fact ?? null,
            state: condition.state ?? null,
            operator: condition.operator ?? null,
            value: condition.value === undefined
              ? null
              : typeof condition.value === 'object'
                ? { entityId: condition.value.entity, fact: condition.value.fact }
                : condition.value
          })),
          unattended: grant.unattended === true,
          configuredByEntityId: grant.configuredBy ?? null
        })),
        ...resourceContent(rule, ['Rationale'], assetBase)
      })),
      /* Alternatives are a set: the wire orders them by id, never by authoring. */
      variations: byId(model.variations).map(variation => ({
        id: variation.id,
        title: variation.doc.title,
        description: variation.doc.lead,
        kind: variation.kind as VariationKind,
        of: variation.of as VariationMemberType,
        takesEffect: variation.takesEffect,
        stability: variation.stability,
        assignmentUnit: variation.assignmentUnit,
        assignmentMethod: variation.assignmentMethod,
        assignmentFact: variation.assignmentFact,
        allocation: variation.allocation,
        settings: [...variation.settings].sort((a, b) => a.entity.localeCompare(b.entity, 'en') || a.fact.localeCompare(b.fact, 'en')),
        discriminator: variation.discriminator,
        alternatives: [...variation.alternatives]
          .sort((a, b) => a.id.localeCompare(b.id, 'en'))
          .map(item => ({ resourceId: item.id, selectedWhen: item.selectedWhen, label: item.label })),
        ...resourceContent(variation, [], assetBase)
      }))
    },
    coverage: {
      scope: model.coverage.scope,
      exclusions: model.coverage.exclusions,
      method: model.coverage.method,
      covered: model.coverage.covered,
      unmapped: model.coverage.unmapped,
      limitations: model.coverage.limitations
    }
  }

  const parsed = ProductReportSchema.parse(report)
  const issues = validateProductReport(parsed)
  if (issues.length) throw new Error(`Report validation failed:\n- ${issues.join('\n- ')}`)
  return parsed
}

export interface BuildOutcome {
  report: ProductReport
  outputFile: string
}

/** Compile the current workspace without writing generated artifacts. */
export function compileWorkspaceReport(cwd: string): ProductReport {
  return compileResolvedWorkspaceReport(resolveModelRoot(cwd))
}

/** Compile a model whose ownership boundary has already been resolved. */
export function compileResolvedWorkspaceReport({ modelRoot, gitRoot }: ModelRoot): ProductReport {
  const model = loadModel(modelRoot)
  const tracked = gitRoot ? lsFiles(gitRoot) : []
  const result = lintModel(model, tracked)
  if (!result.ok) {
    throw new Error(`Lint failed:\n${result.errors.map(error => `- ${error}`).join('\n')}`)
  }
  const today = new Date().toISOString().slice(0, 10)
  return compileReport(model, today, gitRoot ?? modelRoot)
}

/** What the local viewer shows for one compile: a report when one builds, and every issue either way. */
export interface ViewerBuild {
  report?: ProductReport
  issues: ModelIssue[]
}

/**
 * Compile for the local viewer, which shows whatever the compiler accepts.
 *
 * Lint findings do not block here, unlike `lint` and `export`: a model whose
 * only errors are housekeeping, or whose loader dropped part of one file,
 * still yields a report worth reading, and the viewer lists the issues beside
 * it. Only a model the compiler refuses has no report. A model that cannot be
 * read at all comes back as one issue rather than an exception.
 */
export function buildViewerReport({ modelRoot, gitRoot }: ModelRoot): ViewerBuild {
  let issues: ModelIssue[] = []
  try {
    const model = loadModel(modelRoot)
    const tracked = gitRoot ? lsFiles(gitRoot) : []
    const result = lintModel(model, tracked)
    issues = modelIssues(result.errors, result.warnings, modelRoot)
    const today = new Date().toISOString().slice(0, 10)
    return { report: compileReport(model, today, gitRoot ?? modelRoot), issues }
  } catch (error) {
    // A refusal lint predicted is already listed; only an unexplained one adds its own text.
    if (issues.some(issue => issue.severity === 'error')) return { issues }
    return { issues: [...issues, failureIssue(firstLine(error), modelRoot)] }
  }
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // A schema refusal is a JSON dump; a report check lists what it refused.
  if (message.startsWith('[')) return 'The model does not match the report format.'
  const [head, detail] = message.split('\n')
  return detail && head!.endsWith(':') ? `${head} ${detail.replace(/^- /, '')}` : head!
}

export function buildProject(cwd: string): BuildOutcome {
  const resolved = resolveModelRoot(cwd)
  // Export emits the portable profile. Source navigation belongs to this
  // workspace and would be misleading in a Blueprint opened elsewhere.
  const report = projectPortableReport(compileResolvedWorkspaceReport(resolved))

  const outputFile = writeGeneratedFile(
    resolved.modelRoot,
    ['product-model', 'build', 'report.json'],
    `${JSON.stringify(report, null, 2)}\n`
  )
  writeGeneratedFile(
    resolved.modelRoot,
    ['product-model', 'cache', 'build.json'],
    `${JSON.stringify({ builtAt: new Date().toISOString(), schemaVersion: REPORT_SCHEMA_VERSION }, null, 2)}\n`
  )
  return { report, outputFile }
}

export function runExport(cwd: string): number {
  try {
    const { outputFile } = buildProject(cwd)
    console.log(`Exported Blueprint to ${outputFile}.`)
    return 0
  } catch (error) {
    console.error((error as Error).message)
    return 1
  }
}
