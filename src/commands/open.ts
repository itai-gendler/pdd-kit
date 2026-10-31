import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync
} from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { stringify } from 'yaml'
import { writeModelReadme } from '../core/model-readme.js'
import type {
  ProductReport,
  ReportContext,
  ReportGrant,
  ReportScenarioStep,
  ReportSupportingSection,
} from '../core/portable.js'
import { lintModel } from './lint.js'
import { FOLDER_SCHEMA, loadModel } from '../core/model.js'
import { parseProductReport, projectPortableReport } from '../core/portable.js'
import { UsageError } from '../core/usage-error.js'
import { validateProductCover, validateProductLogo } from '../logo.js'
import { cliCommand } from '../core/invocation.js'

const MAX_REPORT_BYTES = 8 * 1024 * 1024

function readReportSource(source: string): unknown {
  if (/^https?:\/\//i.test(source)) {
    throw new UsageError(
      `\`blueprint open\` accepts local Product Report files. Use \`${cliCommand('blueprint pull <blueprint>')}\` for a published Blueprint.`
    )
  }
  const file = isAbsolute(source) ? source : resolve(process.cwd(), source)
  if (!existsSync(file) && !isSymbolicLink(file)) throw new Error(`No report file at ${file}.`)
  const stat = lstatSync(file)
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('The report source must be a regular file, not a symbolic link.')
  if (stat.size > MAX_REPORT_BYTES) throw new Error('The report exceeds the 8 MiB safety limit.')
  return JSON.parse(readFileSync(file, 'utf8'))
}

function isSymbolicLink(file: string): boolean {
  try {
    return lstatSync(file).isSymbolicLink()
  } catch {
    return false
  }
}

/** Resources with no frontmatter fields get no frontmatter block, not `{}`. */
function frontmatter(data: Record<string, unknown>): string {
  if (!Object.keys(data).length) return ''
  return `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n`
}

function references(value: ProductReport['references']): Array<Record<string, string>> {
  return value.map(reference => ({
    kind: reference.kind,
    role: reference.role,
    target: reference.target,
    ...(reference.title ? { title: reference.title } : {})
  }))
}

function entryPoints(value: Array<{ type: string, path: string }>): Array<Record<string, string>> {
  return value.map(point => ({ [point.type]: point.path }))
}

function contexts(value: ReportContext[]): Array<{ place: string }> {
  return value.map(item => ({ place: item.placeId }))
}

function context(value: ReportContext): { place: string } {
  return { place: value.placeId }
}

/** The path segments of a qualified id: "reader-web::personal-library" -> both. */
function idSegments(id: string): string[] {
  return id.split('::')
}

/**
 * Where a Screen expands to.
 *
 * The id carries the whole placement: the Interface, then an Experience where
 * the id has three segments. Screens never nest, so a Screen is always compact.
 */
function screenPath(root: string, id: string): string {
  const parts = idSegments(id)
  const interfaceId = parts[0]!
  const directory = parts.length === 3
    ? join(root, 'interfaces', interfaceId, 'experiences', parts[1]!)
    : join(root, 'interfaces', interfaceId)
  return resourcePath(join(directory, 'screens'), parts.at(-1)!, 'screen', false)
}

/** Compact until a resource needs a namespace for children or assets. */
function resourcePath(parent: string, id: string, type: string, expanded: boolean): string {
  return expanded ? join(parent, id, `${type}.md`) : join(parent, `${id}.md`)
}

function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (value === undefined || value === null || value === '') return false
    return !Array.isArray(value) || value.length > 0
  }))
}

/**
 * A Step's `entities` list as the folder writes it. Required on every Step,
 * and `[]` is a claim, so it never goes through `compactRecord`. The default
 * effect is omitted: writing it back would make a round trip differ from what
 * an author would have written.
 */
function stepEntities(step: ReportScenarioStep): Array<Record<string, unknown>> {
  return step.entities.map(entry => ({
    ...compactRecord({
      entity: entry.entityId,
      as: entry.as ?? undefined,
      effect: entry.effect === 'changes' ? undefined : entry.effect,
      from: entry.from ?? undefined,
      to: entry.to ?? undefined,
      /* The folder names the entry it goes with as the Step names it: by
         alias when it has one, by Entity id otherwise. */
      with: entry.with ? entry.with.as ?? entry.with.entityId : undefined
    }),
    ...(entry.effect === 'removes' ? {} : { facts: entry.facts })
  }))
}

function grantRecord(grant: ReportGrant): Record<string, unknown> {
  return compactRecord({
    actors: grant.actorIds,
    related: grant.related.map(segment => ({ verb: segment.verb, entity: segment.entityId })),
    self: grant.self ? true : undefined,
    when: grant.when.map(condition => compactRecord({
      entity: condition.entityId ?? undefined,
      fact: condition.fact ?? undefined,
      state: condition.state ?? undefined,
      ...(condition.operator
        ? {
            [condition.operator]: typeof condition.value === 'object' && condition.value !== null
              ? { entity: condition.value.entityId, fact: condition.value.fact }
              : condition.value ?? undefined
          }
        : {})
    })),
    unattended: grant.unattended ? true : undefined,
    configuredBy: grant.configuredByEntityId ?? undefined
  })
}

function body(
  title: string,
  lead: string,
  intent: string,
  sections: Array<{ heading: string, content: string }>,
  supportingSections: ReportSupportingSection[]
): string {
  const blocks = [`# ${title}`, lead]
  if (intent) blocks.push(`## Intent\n\n${intent}`)
  for (const item of sections) {
    if (item.content) blocks.push(`## ${item.heading}\n\n${item.content}`)
  }
  for (const item of supportingSections) {
    blocks.push(`## ${item.heading}${item.content ? `\n\n${item.content}` : ''}`)
  }
  return `${blocks.filter(Boolean).join('\n\n')}\n`
}

function write(path: string, content: string): void {
  mkdirSync(resolve(path, '..'), { recursive: true })
  // Default umask permissions: the expanded model is committed and read by the
  // whole team, so it must not land as owner-only.
  writeFileSync(path, content, { encoding: 'utf8', flag: 'wx' })
}

function writeBytes(path: string, content: Uint8Array): void {
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, content, { flag: 'wx' })
}

function prepareTarget(cwd: string, force: boolean): string {
  const root = resolve(cwd, 'product-model')
  if (existsSync(root)) {
    const stat = lstatSync(root)
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('Refusing to replace a non-directory or symbolic-link product-model target.')
    }
    if (readdirSync(root).length > 0) {
      if (!force) throw new Error('product-model/ is not empty. Choose an empty target or pass --force to create a backup first.')
      const backup = `${root}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
      renameSync(root, backup)
      console.log(`Backed up the existing product model to ${backup}.`)
    } else {
      rmdirSync(root)
    }
  }
  return root
}

function writeReport(root: string, report: ProductReport, hasLogo: boolean): void {
  write(join(root, 'config.yaml'), stringify({
    schema: FOLDER_SCHEMA,
    sdd: { paths: [] },
    ...(report.lintVerbs.length ? { lint: { verbs: report.lintVerbs } } : {})
  }, { lineWidth: 0 }))
  write(join(root, '.gitignore'), 'build/\ncache/\n')
  write(
    join(root, 'taxonomies.yaml'),
    stringify({ scenarioKinds: report.model.taxonomies.scenarioKinds }, { lineWidth: 0 })
  )
  write(
    hasLogo ? join(root, 'product', 'product.md') : join(root, 'product.md'),
    frontmatter(compactRecord({
      id: report.id,
      summary: report.summary,
      category: report.category,
      tags: report.tags,
      authors: report.authors,
      license: report.license,
      limitations: report.limitations,
      languages: report.languages,
      references: references(report.references)
    })) + body(report.title, report.description, report.intent, [], report.supportingSections)
  )
  write(
    join(root, 'coverage.md'),
    /* A portable report carries no coverage: no code in this repository has
       been mapped to the model yet. */
    frontmatter({ scope: '', method: '', covered: [], exclusions: [], unmapped: [], limitations: [] }) + body('Coverage', '', '', [], [])
  )

  for (const productInterface of report.model.interfaces) {
    const hasChildren = report.model.experiences.some(experience => idSegments(experience.id)[0] === productInterface.id)
      || report.model.screens.some(screen => idSegments(screen.id)[0] === productInterface.id)
    write(
      resourcePath(join(root, 'interfaces'), productInterface.id, 'interface', hasChildren),
      frontmatter(compactRecord({
        type: productInterface.type,
        actors: productInterface.actorIds,
        entryPoints: entryPoints(productInterface.entryPoints),
        languages: productInterface.languages,
        references: references(productInterface.references)
      })) + body(
        productInterface.title,
        productInterface.description,
        productInterface.intent,
        [],
        productInterface.supportingSections
      )
    )
  }
  for (const domain of report.model.domains) {
    write(
      resourcePath(join(root, 'domains'), domain.id, 'domain', false),
      frontmatter(compactRecord({
        colorSlot: domain.colorSlot,
        references: references(domain.references)
      })) + body(
        domain.name,
        domain.description,
        domain.intent,
        [{ heading: 'Boundary', content: domain.boundary }],
        domain.supportingSections
      )
    )
  }
  for (const entity of report.model.entities) {
    write(
      resourcePath(join(root, 'entities'), entity.id, 'entity', false),
      frontmatter(compactRecord({
        kind: entity.kind ?? undefined,
        acts: entity.acts ?? undefined,
        singleton: entity.singleton || undefined,
        domain: entity.domainId,
        relations: entity.relations.length
          ? entity.relations.map(relation => ({
            entity: relation.entityId, verb: relation.verb, cardinality: relation.cardinality
          }))
          : undefined,
        references: references(entity.references)
      })) + body(entity.title, entity.description, entity.intent, [], [
        ...(entity.informationKept.length
          ? [{ heading: 'Information kept', content: entity.informationKept.map(fact => `- **${fact.name}** — ${fact.description}`).join('\n') }]
          : []),
        ...(entity.states.length
          ? [{ heading: 'States', content: entity.states.map(state => `### ${state.name}\n\n${state.content}`).join('\n\n') }]
          : []),
        ...entity.supportingSections
      ])
    )
  }
  for (const experience of report.model.experiences) {
    const [interfaceId, experienceId] = idSegments(experience.id)
    const hasScreens = report.model.screens.some(screen => screen.id.startsWith(`${experience.id}::`))
    write(
      resourcePath(
        join(root, 'interfaces', interfaceId!, 'experiences'),
        experienceId!,
        'experience',
        hasScreens
      ),
      frontmatter(compactRecord({
        actors: experience.actorIds,
        access: experience.accessMode,
        entryPoints: entryPoints(experience.entryPoints),
        references: references(experience.references)
      })) + body(
        experience.title,
        experience.description,
        experience.intent,
        [],
        experience.supportingSections
      )
    )
  }
  for (const screen of report.model.screens) {
    write(
      screenPath(root, screen.id),
      frontmatter(compactRecord({
        entities: screen.entities.length
          ? screen.entities.map(entry => entry.shows.length || entry.collects.length ? compactRecord({ entity: entry.entityId, shows: entry.shows, collects: entry.collects }) : entry.entityId)
          : undefined,
        entryPoints: entryPoints(screen.entryPoints),
        references: references(screen.references)
      })) + body(
        screen.title,
        screen.description,
        screen.intent,
        [],
        screen.supportingSections
      )
    )
  }
  for (const capability of report.model.capabilities) {
    const hasScenarios = report.model.capabilityScenarios.some(scenario => scenario.capabilityId === capability.id)
    write(
      resourcePath(join(root, 'capabilities'), capability.id, 'capability', hasScenarios),
      frontmatter(compactRecord({
        domain: capability.domainId,
        availability: contexts(capability.availability),
        references: references(capability.references)
      })) + body(capability.title, capability.description, capability.intent, [], capability.supportingSections)
    )
  }
  for (const rule of report.model.businessRules) {
    write(
      resourcePath(join(root, 'business-rules'), rule.id, 'business-rule', false),
      frontmatter({
        appliesTo: rule.appliesTo.map(target => target.type === 'context'
          ? { type: 'context', context: context(target.context) }
          : target.type === 'entity'
            ? compactRecord({
                type: 'entity',
                id: target.entityId,
                effect: target.effect ?? undefined,
                from: target.from ?? undefined,
                to: target.to ?? undefined,
                facts: target.facts,
                contexts: target.contexts.map(context)
              })
            : compactRecord({
                type: target.type,
                id: target.id,
                contexts: target.contexts.map(context)
              })),
        /* `permits: []` is a claim — forbidden to everyone — so it is never
           compacted away; only an absent `permits` is. */
        ...(rule.permits === null ? {} : { permits: rule.permits.map(grantRecord) }),
        ...compactRecord({ references: references(rule.references) })
      }) + body(
        rule.title,
        rule.statement,
        rule.intent,
        [{ heading: 'Rationale', content: rule.rationale }],
        rule.supportingSections
      )
    )
  }

  for (const variation of report.model.variations) {
    write(
      resourcePath(join(root, 'variations'), variation.id, 'variation', false),
      frontmatter(compactRecord({
        kind: variation.kind,
        of: variation.of,
        assignmentUnit: variation.assignmentUnit,
        assignmentMethod: variation.assignmentMethod,
        assignmentFact: variation.assignmentFact,
        allocation: variation.allocation,
        settings: variation.settings,
        discriminator: variation.discriminator,
        takesEffect: variation.takesEffect,
        stability: variation.stability,
        alternatives: variation.alternatives.map(item => compactRecord({
          id: item.resourceId,
          label: item.label,
          selectedWhen: item.selectedWhen
        })),
        references: references(variation.references)
      })) + body(variation.title, variation.description, variation.intent, [], variation.supportingSections)
    )
  }

  const scenarioSections = (
    scenario:
      | ProductReport['model']['capabilityScenarios'][number]
      | ProductReport['model']['journeyScenarios'][number]
  ) => {
    const decisions = scenario.decisionPoints.map(decision =>
      `### ${decision.title}\n\n${decision.question}\n\n${
        decision.branches.map(branch => `- ${branch.condition} → ${branch.outcome}`).join('\n')
      }`
    ).join('\n\n')
    return [
      { heading: 'Trigger', content: scenario.trigger },
      { heading: 'Decision points', content: decisions },
      { heading: 'Outcome', content: scenario.outcome },
      { heading: 'Edge cases', content: scenario.edgeCases.map(item => `- ${item}`).join('\n') }
    ]
  }

  for (const scenario of report.model.capabilityScenarios) {
    write(
      resourcePath(
        join(root, 'capabilities', scenario.capabilityId, 'scenarios'),
        scenario.id,
        'capability-scenario',
        false
      ),
      frontmatter(compactRecord({
        kind: scenario.kindId,
        routes: Object.fromEntries(scenario.routes.map(route => [route.id, route.name])),
        steps: scenario.steps.map(step => ({
          ...compactRecord({
            text: step.text,
            kind: step.kind,
            actor: step.actorId ?? undefined,
            unattended: step.unattended ? true : undefined
          }),
          entities: stepEntities(step),
          ...compactRecord({
            contexts: step.contexts.length
              ? Object.fromEntries(step.contexts.map(context => [context.routeId, { place: context.placeId }]))
              : undefined
          })
        })),
        references: references(scenario.references)
      })) + body(
        scenario.title,
        '',
        scenario.intent,
        scenarioSections(scenario),
        scenario.supportingSections
      )
    )
  }
  for (const journey of report.model.journeys) {
    const hasScenarios = report.model.journeyScenarios.some(scenario => scenario.journeyId === journey.id)
    write(
      resourcePath(join(root, 'journeys'), journey.id, 'journey', hasScenarios),
      frontmatter(compactRecord({
        actors: journey.actorIds,
        references: references(journey.references)
      })) + body(
        journey.title,
        '',
        journey.intent,
        [
          { heading: 'Goal', content: journey.goal },
          { heading: 'Success criterion', content: journey.successCriterion }
        ],
        journey.supportingSections
      )
    )
  }
  for (const scenario of report.model.journeyScenarios) {
    write(
      resourcePath(
        join(root, 'journeys', scenario.journeyId, 'scenarios'),
        scenario.id,
        'journey-scenario',
        false
      ),
      frontmatter(compactRecord({
        kind: scenario.kindId,
        result: scenario.result,
        routes: Object.fromEntries(scenario.routes.map(route => [route.id, route.name])),
        steps: scenario.steps.map(step => ({
          ...compactRecord({
            text: step.text,
            kind: step.kind,
            actor: step.actorId ?? undefined,
            capability: step.capabilityId ?? undefined,
            unattended: step.unattended ? true : undefined
          }),
          entities: stepEntities(step),
          ...compactRecord({
            contexts: step.contexts.length
              ? Object.fromEntries(step.contexts.map(context => [context.routeId, { place: context.placeId }]))
              : undefined
          })
        })),
        references: references(scenario.references)
      })) + body(
        scenario.title,
        '',
        scenario.intent,
        scenarioSections(scenario),
        scenario.supportingSections
      )
    )
  }
}

export interface ExpandedProductReport {
  report: ProductReport
  root: string
}

export interface ExpandProductReportOptions {
  /** Optional Product logo to restore into the expanded model. */
  logo?: Uint8Array
  /** Optional Product cover, restored beside the logo; a model without a logo has no `product/` for it. */
  cover?: Uint8Array
}

export function expandProductReport(
  cwd: string,
  input: unknown,
  force: boolean,
  options: ExpandProductReportOptions = {}
): ExpandedProductReport {
  let staging: string | undefined
  try {
    const sourceReport = parseProductReport(input)
    const report = parseProductReport(projectPortableReport(sourceReport))
    const targetParent = dirname(resolve(cwd, 'product-model'))
    mkdirSync(targetParent, { recursive: true })
    staging = mkdtempSync(join(targetParent, 'product-model-open-'))
    const stagedRoot = join(staging, 'product-model')
    writeReport(stagedRoot, report, Boolean(options.logo))
    if (options.logo) {
      const issues = validateProductLogo(options.logo)
      if (issues.length) throw new Error(`The Product logo is invalid: ${issues.join('; ')}`)
      writeBytes(join(stagedRoot, 'product', 'logo.svg'), options.logo)
      if (options.cover) {
        const coverIssues = validateProductCover(options.cover)
        if (coverIssues.length) throw new Error(`The Product cover is invalid: ${coverIssues.join('; ')}`)
        writeBytes(join(stagedRoot, 'product', 'cover.webp'), options.cover)
      }
    }
    // Expansion is the one canonical report-to-model primitive used by open,
    // pull, and contribution. Keeping orientation here makes their model trees
    // identical and lets lint require the complete committed layout.
    writeModelReadme(staging)
    const lint = lintModel(loadModel(staging), [])
    if (!lint.ok) {
      throw new Error(
        `The report cannot be expanded into a structurally sound Product Model:\n${
          lint.errors.map(error => `- ${error}`).join('\n')
        }`
      )
    }
    const root = prepareTarget(cwd, force)
    renameSync(stagedRoot, root)
    return { report, root }
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true })
  }
}

export async function runOpen(cwd: string, source: string, force: boolean): Promise<number> {
  try {
    const opened = expandProductReport(cwd, readReportSource(source), force)
    console.log(`Opened Blueprint "${opened.report.title}" into ${opened.root}.`)
    return 0
  } catch (error) {
    console.error((error as Error).message)
    return error instanceof UsageError ? 2 : 1
  }
}
