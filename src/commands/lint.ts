import {
  variationIssues, variationEntityReferences, variationMembership, VARIATION_COLLECTION_OF,
  type VariationCollection
} from '../core/variations.js'
import { undeclaredEntityMentions } from '../core/entity-mentions.js'
import {
  conditionInstanceIssue, interfaceLanguageIssues, singletonRelationIssue, isLanguageTag, screenEntityIssues, screenReadIssues, unknownFactIssues
} from '../core/model-checks.js'
import type { Context } from '../core/frontmatter.js'
import { repositoryReferencePath } from '../core/frontmatter.js'
import type {
  BusinessRuleEntityTarget, BusinessRuleGrant, PddModel, RelatedSegment, ScenarioStep, ScenarioStepEntity
} from '../core/model.js'
import { lsFiles } from '../core/git.js'
import { containsPlace, counterpartKey, interfaceOf, isId, isQualifiedId, placeIdentityIssues, qualify } from '../core/ids.js'
import { INTERFACE_TYPES } from '../core/interface-types.js'
import { containsStructuralHeading, section, type MarkdownDoc } from '../core/markdown.js'
import { allResources, resourceCollections, loadModel } from '../core/model.js'
import { resolveModelRoot } from '../core/model-root.js'
import {
  operationPlaces,
  permissionTargetSelectsOperation,
  validatePermissionBehavior,
  type PermissionGrant,
  type PermissionOperation,
  type PermissionTarget
} from '../core/permission-validation.js'

export interface LintResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  counts: Record<string, number>
}

const ACCESS_MODES = new Set(['public', 'authenticated', 'restricted'])
const JOURNEY_RESULTS = new Set(['achieved', 'not-achieved'])
const INTERFACE_TYPE_SET = new Set<string>(INTERFACE_TYPES)

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every(value => right.has(value))
}

/** Pure structural rule engine over a loaded model; trackedFiles injected for testability. */
export function lintModel(model: PddModel, trackedFiles: string[]): LintResult {
  const errors = [...model.issues]
  const warnings: string[] = [...model.notices]
  const tracked = new Set(trackedFiles)
  /* Member key (`<collection>:<id>`) → Variation. Membership lives on the set. */
  const variationOf = variationMembership(model.variations)

  const requireTitle = (label: string, title: string, lead: string) => {
    if (!title) errors.push(`${label}: missing H1 title`)
    if (!lead) errors.push(`${label}: missing lead paragraph (description)`)
  }

  const validateSections = (
    label: string,
    doc: MarkdownDoc,
    recognized: string[],
    forbidden: string[] = []
  ) => {
    const recognizedSet = new Set(recognized.map(heading => heading.toLowerCase()))
    const forbiddenSet = new Set(forbidden.map(heading => heading.toLowerCase()))
    const seen = new Set<string>()
    if (containsStructuralHeading(doc.lead)) {
      errors.push(`${label}: lead paragraph must not contain an H1 or H2 heading`)
    }
    for (const item of doc.sections) {
      const normalized = item.heading.toLowerCase()
      if (recognizedSet.has(normalized)) {
        if (seen.has(normalized)) errors.push(`${label}: duplicate "## ${item.heading}" section`)
        seen.add(normalized)
      }
      if (forbiddenSet.has(normalized)) {
        errors.push(`${label}: "## ${item.heading}" is not allowed on this resource type`)
      }
      if (containsStructuralHeading(item.body)) {
        errors.push(`${label}: "## ${item.heading}" content must not contain an H1 or H2 heading`)
      }
    }
  }

  const validateListSection = (
    label: string,
    doc: MarkdownDoc,
    heading: string,
    kind: 'ordered' | 'bullet'
  ) => {
    const body = section(doc, heading)
    if (body === undefined) return
    const pattern = kind === 'ordered' ? /^\s*\d+[.)]\s+\S.*$/ : /^\s*[-*]\s+\S.*$/
    if (body.split('\n').some(line => line.trim() && !pattern.test(line))) {
      errors.push(`${label}: "## ${heading}" must contain only single-line ${kind}-list items`)
    }
  }

  const variationMembers = Object.fromEntries(Object.values(VARIATION_COLLECTION_OF)
    .map(collection => [collection, new Set(model[collection].map(item => item.id))])) as Record<VariationCollection, Set<string>>
  for (const issue of variationIssues(model.variations, {
    members: variationMembers,
    entities: model.entities,
    scenarioOwners: new Map([
      ...model.capabilityScenarios.map(item => [item.id, `capability:${item.capability}`] as const),
      ...model.journeyScenarios.map(item => [item.id, `journey:${item.journey}`] as const)
    ])
  })) {
    errors.push(`${model.variations.find(variation => variation.id === issue.id)!.file}: ${issue.message}`)
  }
  for (const variation of model.variations) {
    requireTitle(variation.file, variation.doc.title, variation.doc.lead)
    validateSections(variation.file, variation.doc, ['Intent'])
  }

  if (model.product.id && !isId(model.product.id)) errors.push('product.md: id must be lowercase kebab-case')
  if (model.product.id.length > 64) errors.push('product.md: id must be at most 64 characters')
  if (!model.product.id) errors.push('product.md: missing id')
  requireTitle('product.md', model.product.doc.title, model.product.doc.lead)
  validateSections('product.md', model.product.doc, ['Intent'])
  /*
   * A Product limitation is a deliberate constraint a reader of the Product
   * can rely on, including what the Product leaves to other systems. Wording
   * about the model itself — what it does not cover — says nothing a reader of
   * the Product can rely on; the product fact behind it is the limitation.
   */
  // "in the model" is left out on purpose: a limitation about a language
  // model's provider ("nothing is kept in the model provider's logs") is a
  // real Product constraint, and the phrase cannot tell the two apart.
  const MODEL_LANGUAGE = /\bnot model(?:l)?ed\b|\boutside (?:the|this) model\b|\bthe model does not\b/i
  for (const limitation of model.product.limitations) {
    if (MODEL_LANGUAGE.test(limitation)) {
      warnings.push(`product.md: limitation "${limitation}" speaks about the model; state the product fact instead, such as what the Product leaves to other systems`)
    }
  }
  if (model.product.summary && (/\r|\n/.test(model.product.summary) || model.product.summary.length > 400)) {
    errors.push('product.md: summary must be a single line with at most 400 characters')
  }
  if (model.product.category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(model.product.category)) {
    errors.push('product.md: category must be lowercase kebab-case')
  }
  if (model.product.category && model.product.category.length > 60) {
    errors.push('product.md: category must be at most 60 characters')
  }
  if (model.product.license && !/^[A-Za-z0-9][A-Za-z0-9.+-]*$/.test(model.product.license)) {
    errors.push('product.md: license must be one SPDX license identifier')
  }
  for (const [index, author] of model.product.authors.entries()) {
    if (!author.name.trim() || author.name.length > 120) {
      errors.push(`product.md: author ${index + 1} name must contain 1–120 characters`)
    }
    if (author.url) {
      try {
        const url = new URL(author.url)
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol')
      } catch {
        errors.push(`product.md: author ${index + 1} url must use HTTP(S)`)
      }
    }
  }

  /*
   * Languages are a closed vocabulary — a tag, not a name — so the shape is
   * checked here and the list against i18n configuration is `verify`'s.
   */
  for (const tag of model.product.languages) {
    if (!isLanguageTag(tag)) errors.push(`product.md: language "${tag}" is not a language tag like "en" or "pt-BR"`)
  }
  const productLanguages = new Set(model.product.languages)

  // Coverage scope and description uniqueness are the schema's to report, once,
  // when the model loads; a Coverage that failed to parse has nothing to recheck.

  const collections: Array<[string, Array<{ id: string }>]> = [
    ...Object.entries(resourceCollections(model)),
    ['scenarioKinds', model.scenarioKinds]
  ]
  // Interface, Experience, and Screen ids carry the path that distinguishes
  // repeated names across Interfaces; behavior ids stay bare and globally unique.
  const QUALIFIED_COLLECTIONS = new Set(['interfaces', 'experiences', 'screens'])
  for (const [name, items] of collections) {
    const valid = QUALIFIED_COLLECTIONS.has(name) ? isQualifiedId : isId
    for (const item of items) {
      if (!valid(item.id)) errors.push(`${name}: id "${item.id}" must be lowercase kebab-case`)
    }
  }

  errors.push(...placeIdentityIssues([
    ...model.interfaces, ...model.experiences, ...model.screens
  ].map(place => ({ id: place.id, label: place.file }))))

  const entityIds = new Set(model.entities.map(item => item.id))
  const singletonIds = new Set(model.entities.filter(entity => entity.singleton).map(entity => entity.id))
  const entitiesById = new Map(model.entities.map(item => [item.id, item]))
  const namedEntities = model.entities.map(entity => ({ id: entity.id, title: entity.doc.title }))
  /*
   * An Actor is an Entity that acts. Every actor reference — a Step's `actor`,
   * an Interface's, Experience's or Journey's `actors`, a grant's `actors` —
   * resolves here, and the message says which of the two things went wrong.
   */
  const actorIds = new Set(model.entities.filter(item => item.acts !== undefined).map(item => item.id))
  const requireActor = (label: string, id: string) => {
    if (actorIds.has(id)) return
    if (entityIds.has(id)) {
      errors.push(`${label}: "${id}" does not act; an actor is an Entity with "acts" and "kind"`)
    } else {
      errors.push(`${label}: references missing entity "${id}"`)
    }
  }
  const interfaceIds = new Set(model.interfaces.map(item => item.id))
  const interfacesById = new Map(model.interfaces.map(item => [item.id, item]))
  const experiencesById = new Map(model.experiences.map(experience => [experience.id, experience]))
  const screensById = new Map(model.screens.map(screen => [screen.id, screen]))
  const experienceScopedInterfaces = new Set(model.experiences.map(experience => experience.interface))
  /* Capability availability names a boundary: an undivided Interface or an Experience. */
  const availabilityPlaceIds = new Set<string>([
    ...model.interfaces.filter(item => !experienceScopedInterfaces.has(item.id)).map(item => item.id),
    ...model.experiences.map(experience => experience.id)
  ])
  const placeIds = new Set<string>([
    ...model.interfaces.map(item => item.id),
    ...model.experiences.map(item => item.id),
    ...model.screens.map(item => item.id)
  ])
  const domainIds = new Set(model.domains.map(domain => domain.id))
  const capabilityIds = new Set(model.capabilities.map(capability => capability.id))
  const journeyIds = new Set(model.journeys.map(journey => journey.id))
  const capabilityScenarioIds = new Set(model.capabilityScenarios.map(scenario => scenario.id))
  const journeyScenarioIds = new Set(model.journeyScenarios.map(scenario => scenario.id))
  const kindIds = new Set(model.scenarioKinds.map(kind => kind.id))

  const validateContextPlace = (label: string, context: Context): string => {
    const place = context.place
    if (!place) {
      errors.push(`${label}: Context needs a non-empty place id`)
      return place
    }
    if (!isQualifiedId(place)) {
      errors.push(`${label}: Context place "${place}" is not a valid Interface, Experience, or Screen id`)
      return place
    }
    if (!placeIds.has(place)) {
      errors.push(`${label}: Context references missing place "${place}"`)
    }
    return place
  }

  const resolveAvailabilityPlace = (label: string, place: string): boolean => {
    if (!place) {
      errors.push(`${label}: availability Context needs a non-empty place id`)
      return false
    }
    if (!isQualifiedId(place)) {
      errors.push(`${label}: availability Context place "${place}" is not a valid Interface, Experience, or Screen id`)
      return false
    }
    if (availabilityPlaceIds.has(place)) return true
    if (model.screens.some(screen => screen.id === place)) {
      errors.push(`${label}: availability Context place "${place}" must name its containing Interface or Experience, not a Screen`)
      return false
    }
    const owner = interfaceOf(place)
    if (!interfaceIds.has(owner)) {
      errors.push(`${label}: availability Context references missing interface "${owner}"`)
    } else if (place === owner) {
      errors.push(`${label}: interface "${owner}" is divided into Experiences, so name one of them`)
    } else {
      errors.push(`${label}: availability Context references missing experience "${place}"`)
    }
    return false
  }

  const validateAvailability = (label: string, contexts: Context[]): Set<string> => {
    const places = new Set<string>()
    for (const context of contexts) {
      const place = context.place
      if (places.has(place)) errors.push(`${label}: duplicate availability Context place "${place}"`)
      if (resolveAvailabilityPlace(label, place)) places.add(place)
    }
    return places
  }

  const validateEntryPointInterfaces = (
    label: string,
    points: Array<{ type: string }>,
    allowed: Set<string>
  ) => {
    for (const point of points) {
      if (!allowed.has(point.type)) {
        errors.push(`${label}: entry point references undeclared interface "${point.type}"`)
      }
    }
  }

  for (const productInterface of model.interfaces) {
    requireTitle(productInterface.file, productInterface.doc.title, productInterface.doc.lead)
    /* `availability` on Capabilities already says what an Interface offers; a
       prose boundary beside it was a second, unfalsifiable encoding. */
    validateSections(productInterface.file, productInterface.doc, ['Intent'], ['Capability boundary'])
    if (!INTERFACE_TYPE_SET.has(productInterface.type)) {
      errors.push(`${productInterface.file}: type "${productInterface.type}" must be ${INTERFACE_TYPES.join('|')}`)
    }
    if (!productInterface.actors.length) errors.push(`${productInterface.file}: needs at least one actor`)
    for (const actorId of productInterface.actors) requireActor(productInterface.file, actorId)
    for (const tag of productInterface.languages) {
      if (!isLanguageTag(tag)) errors.push(`${productInterface.file}: language "${tag}" is not a language tag like "en" or "pt-BR"`)
    }
    for (const issue of interfaceLanguageIssues(productInterface.languages.filter(isLanguageTag), productLanguages, 'product.md')) {
      errors.push(`${productInterface.file}: ${issue}`)
    }
    /*
     * F11 — one entry-point key vocabulary per resource. On an Interface the key
     * is that Interface's own `type`, or another Interface's id when a reader
     * arrives from that surface — a web report opened by a command has nowhere
     * else to record where it is reached from. On an Experience or Screen it is
     * the containing Interface's id. Its own id is refused: `type` says that.
     */
    for (const entryPoint of productInterface.entryPoints) {
      if (entryPoint.type === productInterface.type) continue
      if (entryPoint.type === productInterface.id) {
        errors.push(
          `${productInterface.file}: entry point key "${entryPoint.type}" is this Interface's own id; use its type "${productInterface.type}"`
        )
      } else if (!interfaceIds.has(entryPoint.type)) {
        errors.push(
          `${productInterface.file}: entry point key "${entryPoint.type}" must be this Interface's type "${productInterface.type}" or another Interface's id`
        )
      }
    }
  }

  for (const experience of model.experiences) {
    requireTitle(experience.file, experience.doc.title, experience.doc.lead)
    validateSections(experience.file, experience.doc, ['Intent'], ['Capability boundary'])
    if (!ACCESS_MODES.has(experience.access)) {
      errors.push(`${experience.file}: access "${experience.access}" must be public|authenticated|restricted`)
    }
    if (!experience.actors.length) errors.push(`${experience.file}: needs at least one actor`)
    for (const actorId of experience.actors) requireActor(experience.file, actorId)
    const owner = interfacesById.get(experience.interface)
    if (owner) {
      for (const actorId of experience.actors) {
        if (!owner.actors.includes(actorId)) {
          errors.push(`${experience.file}: actor "${actorId}" is not supported by interface "${experience.interface}"`)
        }
      }
    }
    validateEntryPointInterfaces(experience.file, experience.entryPoints, new Set([experience.interface]))
  }

  for (const productInterface of model.interfaces) {
    if (!experienceScopedInterfaces.has(productInterface.id)) continue
    const coveredActors = new Set(
      model.experiences
        .filter(experience => experience.interface === productInterface.id)
        .flatMap(experience => experience.actors)
    )
    for (const actorId of productInterface.actors) {
      if (!coveredActors.has(actorId)) {
        errors.push(`${productInterface.file}: actor "${actorId}" is not covered by any Experience declaring this interface`)
      }
    }
  }

  const capabilitiesPerDomain = new Map<string, number>()
  for (const capability of model.capabilities) {
    if (!capability.domain) continue
    capabilitiesPerDomain.set(capability.domain, (capabilitiesPerDomain.get(capability.domain) || 0) + 1)
  }
  for (const domain of model.domains) {
    requireTitle(domain.file, domain.doc.title, domain.doc.lead)
    validateSections(domain.file, domain.doc, ['Intent', 'Boundary'])
    // A Boundary that only asserts inclusion is a label, not a region. Stating
    // what a Domain does *not* own is what makes it checkable.
    if (!domain.boundary.trim()) {
      errors.push(`${domain.file}: a Domain needs a "## Boundary" section`)
    } else if (!/\b(does not|doesn't|not own|never|excludes?|rather than|outside)\b/i.test(domain.boundary)) {
      errors.push(
        `${domain.file}: "## Boundary" must state what the Domain does not own, not only what it covers`
      )
    }
    const held = capabilitiesPerDomain.get(domain.id) || 0
    if (held < 2) {
      warnings.push(
        `${domain.file}: names ${held} Capabilit${held === 1 ? 'y' : 'ies'}; a Domain holding fewer than two is a folder, not a region`
      )
    }
  }

  /*
   * F2 — whether an Interface is divided into Experiences is DERIVED, never
   * judged. An Interface must hold Experiences when it serves more than one
   * `access` value, or two or more Actor sets whose Capability coverage is
   * disjoint; it must not when neither holds. Every input is already authored,
   * so the linter decides the question and an author never applies a prose test
   * to it. Without this, one product had two lint-clean encodings whose ids
   * shared nothing.
   */
  const experiencesByInterface = new Map<string, typeof model.experiences>()
  for (const experience of model.experiences) {
    const list = experiencesByInterface.get(experience.interface) || []
    list.push(experience)
    experiencesByInterface.set(experience.interface, list)
  }
  for (const productInterface of model.interfaces) {
    const owned = experiencesByInterface.get(productInterface.id) || []

    // Actor sets that reach this Interface, grouped by the Capabilities available there.
    const actorSets: Array<Set<string>> = []
    for (const capability of model.capabilities) {
      const here = capability.availability.some(
        context => context.place === productInterface.id || context.place.startsWith(`${productInterface.id}::`)
      )
      if (!here) continue
      const reached = new Set(
        productInterface.actors.filter(actorId =>
          model.capabilityScenarios.some(
            scenario =>
              scenario.capability === capability.id &&
              // A Scenario's Actor set is derived from its Steps, never authored,
              // and an attributed actor on a Product Step counts as much as a
              // performing one.
              scenario.steps.some(step => step.actor === actorId)
          )
        )
      )
      if (reached.size) actorSets.push(reached)
    }
    /*
     * Roles one person holds are one audience. Actors that each relate
     * one-to-one to the same Entity that does not act — the Account keeping
     * the person's facts — are joined by it, whichever role a Step open to
     * every role happens to name.
     */
    const reachedActors = new Set(actorSets.flatMap(reached => [...reached]))
    const holdersByAccount = new Map<string, Set<string>>()
    for (const actorId of reachedActors) {
      for (const relation of entitiesById.get(actorId)?.relations ?? []) {
        if (relation.cardinality !== 'one-to-one' || entitiesById.get(relation.entity)?.acts) continue
        holdersByAccount.set(relation.entity, (holdersByAccount.get(relation.entity) ?? new Set()).add(actorId))
      }
    }
    for (const holders of holdersByAccount.values()) if (holders.size > 1) actorSets.push(holders)
    /*
     * The audiences are disjoint when the Actors split into groups no Capability
     * bridges: more than one connected component in the graph of Actors and the
     * Capabilities available here, with roles sharing an Account joined. Any two Capabilities with no Actor in common
     * is a different, stricter question — an admin-only and a shopper-only
     * Capability never share one, however many shared Capabilities sit beside
     * them — and it is not the one the format asks.
     */
    const root = new Map<string, string>()
    const find = (actorId: string): string => {
      let current = actorId
      while (root.get(current) !== undefined && root.get(current) !== current) current = root.get(current)!
      return current
    }
    for (const reached of actorSets) {
      const [first, ...rest] = [...reached]
      if (!first) continue
      if (!root.has(first)) root.set(first, first)
      for (const other of rest) {
        if (!root.has(other)) root.set(other, other)
        root.set(find(other), find(first))
      }
    }
    const components = new Set([...root.keys()].map(find)).size
    const disjointAudiences = components > 1
    const accessModes = new Set(owned.map(experience => experience.access).filter(Boolean))
    const mustDivide = accessModes.size > 1 || disjointAudiences

    /*
     * Counterparts and Variations justify existing Experiences: when
     * the same Experience name exists under another Interface, the two are
     * counterparts by construction — the same context on two platforms — and
     * forcing one to flatten would make two views of one context look
     * unrelated.
     */
    const hasCounterpart = owned.some(experience => {
      const localId = experience.id.split('::').pop()
      return model.experiences.some(
        other => other.interface !== productInterface.id && other.id.split('::').pop() === localId
      )
    })
    if (owned.length && !mustDivide && !hasCounterpart && !owned.some(item => variationOf.has(`experiences:${item.id}`))) {
      errors.push(
        `${productInterface.file}: holds Experiences but serves one audience through one access mode, and none is a counterpart or Variation; use direct Interface availability`
      )
    }
    if (!owned.length && disjointAudiences) {
      errors.push(
        `${productInterface.file}: serves Actor sets no available Capability bridges; these are Experiences, not one context`
      )
    }
    /*
     * One access mode is one context. Two Experiences with the same access and
     * an Actor in common are one audience cut by area — an admin-only page
     * beside one admins share with members — which is a Screen there, not a
     * second context. Alternatives of one Variation coexist by construction; an
     * Experience beside them, or in another Variation, is still compared.
     */
    const setOf = (experience: { id: string }) => variationOf.get(`experiences:${experience.id}`)
    for (const [index, experience] of owned.entries()) {
      const twin = owned.slice(index + 1).find(
        other => other.access === experience.access
          && other.actors.some(actor => experience.actors.includes(actor))
          && (setOf(experience) === undefined || setOf(experience) !== setOf(other))
      )
      if (twin) {
        errors.push(
          `${experience.file}: shares \`${experience.access}\` access and an Actor with ${twin.id}; one access mode is one context unless its audiences share no Actor`
        )
      }
    }
  }

  /*
   * F1 — behavioral ids are verb-noun; cross-cutting ids are the bare noun.
   * Ids are the format's whole identity mechanism, so two models of one product
   * that name the same behavior differently cannot be diffed or compared. The
   * check is deliberately a warning: it recognises the nominalisations that
   * signal a noun phrase rather than trying to conjugate English.
   */
  const NOMINALISED = /(?:ing|tion|sion|ment|ance|ence|ity|ness)$/
  // A small vocabulary of product verbs. An id that already contains one reads
  // as verb-noun however it ends — `publish-and-share-a-collection` is fine —
  // so only a nominalised id with no verb in it is flagged.
  const PRODUCT_VERBS = new Set([
    'accept', 'activate', 'add', 'allow', 'answer', 'apply', 'approve', 'archive', 'assign', 'authorize', 'back', 'block', 'book', 'browse', 'build',
    'cancel', 'change', 'check', 'choose', 'close', 'collect', 'compare', 'complete', 'compose',
    'configure', 'confirm', 'connect', 'contribute', 'create', 'deactivate', 'decide', 'decline', 'delete',
    'deliver', 'disable', 'disconnect', 'discover', 'dismiss', 'download', 'duplicate', 'edit', 'enable', 'enter', 'expire', 'explore', 'export', 'find', 'follow',
    'gate', 'generate', 'grant', 'handle', 'import', 'install', 'invite', 'issue', 'join',
    'keep', 'leave', 'link', 'lint', 'list', 'log', 'manage', 'map', 'mark', 'merge', 'move', 'name',
    'open', 'order', 'organize', 'pause', 'pay', 'pin', 'place', 'plan', 'preserve', 'propose', 'publish', 'pull',
    'read', 'receive', 'recover', 'refresh', 'refund', 'reopen', 'regenerate', 'register', 'reject', 'remove', 'rename', 'reorder', 'reply', 'republish',
    'report', 'request', 'resend', 'reset', 'resolve', 'restore', 'resume', 'retry', 'return', 'review',
    'revoke', 'run', 'save', 'schedule', 'search', 'select', 'send', 'serve', 'set', 'settle',
    'share', 'ship', 'show', 'sign', 'star', 'start', 'stop', 'submit', 'subscribe', 'switch',
    'synchronize', 'track', 'transfer', 'unarchive', 'unassign', 'uncheck', 'unfollow', 'unlink', 'unlist', 'unpin', 'unpublish', 'unresolve', 'unstar', 'unsubscribe', 'update', 'upload', 'verify',
    'view', 'withdraw', 'write', ...model.config.lintVerbs
  ])
  /*
   * The model's own noun vocabulary: everything an id can legitimately be about.
   * A qualified id also contributes its last segment, since that is how authors
   * refer to a Screen or Experience in prose.
   */
  const nounVocabulary = new Set<string>()
  for (const resource of [...model.entities, ...model.domains, ...model.interfaces, ...model.experiences, ...model.screens]) {
    nounVocabulary.add(resource.id)
    const leaf = resource.id.split('::').pop()
    if (leaf) nounVocabulary.add(leaf)
  }
  const thingVocabulary = new Set([...model.entities, ...model.domains, ...model.interfaces].map(resource => resource.id))
  // A word this model declares as a thing is read as that thing, not as a verb:
  // `order` in `order-management` names the Order, so the id carries no verb.
  const isVerbSegment = (segment: string) => PRODUCT_VERBS.has(segment) && !nounVocabulary.has(segment)

  const behavioural: Array<{ file: string, id: string, kind: string }> = [
    ...model.capabilities.map(item => ({ file: item.file, id: item.id, kind: 'Capability' })),
    ...model.capabilityScenarios.map(item => ({ file: item.file, id: item.id, kind: 'Capability Scenario' })),
    ...model.journeys.map(item => ({ file: item.file, id: item.id, kind: 'Journey' })),
    ...model.journeyScenarios.map(item => ({ file: item.file, id: item.id, kind: 'Journey Scenario' }))
  ]
  for (const resource of behavioural) {
    const segments = resource.id.split('-')
    const last = segments[segments.length - 1] || ''
    const carriesVerb = segments.some(isVerbSegment)
    // A last segment the model declares is the object, not a nominalisation:
    // `archive-document` acts on a Document, `unresolve-comment` on a Comment.
    const declared = nounVocabulary.has(last) || nounVocabulary.has(last.replace(/s$/, ''))
    if (NOMINALISED.test(last) && !declared && !carriesVerb) {
      warnings.push(
        `${resource.file}: ${resource.kind} id "${resource.id}" reads as a noun phrase; a behavioral id starts with a verb`
      )
    }
  }

  /*
   * The split test separates parts that differ in verb, and the verb is the one
   * the control shows. A Scenario that opens with the opposite of its
   * Capability's verb — `enable-a-disabled-link` under `disable-link` — is the
   * other half of a toggle folded in, and two encodings of one product would
   * disagree on the Capability count. The first id segment is read directly:
   * `unlist` and `unfollow` need not be in the lexicon to be opposites.
   */
  const leadingVerb = (id: string) => id.split('-')[0] || ''
  const OPPOSITE_VERBS: Array<[string, string[]]> = [
    ['publish', ['unpublish', 'unlist']],
    ['enable', ['disable']],
    ['follow', ['unfollow']],
    ['pause', ['resume']],
    ['accept', ['dismiss', 'decline']],
    ['share', ['unshare']],
    ['open', ['close']],
    ['reopen', ['close']],
    ['subscribe', ['unsubscribe']],
    ['join', ['leave']],
    ['add', ['remove']],
    ['save', ['unsave', 'remove']],
    ['archive', ['restore', 'unarchive']],
    ['lock', ['unlock']],
    ['pin', ['unpin']],
    ['star', ['unstar']],
    ['link', ['unlink']],
    ['check', ['uncheck']],
    ['assign', ['unassign']],
    ['connect', ['disconnect']],
    ['start', ['stop']],
    ['tag', ['untag']]
  ]
  const opposites = new Map<string, Set<string>>()
  for (const [verb, others] of OPPOSITE_VERBS) {
    for (const other of others) {
      opposites.set(verb, (opposites.get(verb) || new Set()).add(other))
      opposites.set(other, (opposites.get(other) || new Set()).add(verb))
    }
  }
  /*
   * Two spellings the first segment alone misses: "stop sharing" opens with
   * `stop` and carries the verb it reverses in its second segment, and
   * "mark read" / "mark unread" share `mark` and differ in their last word.
   * Each returns the two verbs as the author wrote them, or nothing.
   */
  const verbStem = (verb: string) => verb.replace(/e$/, '')
  const stopPhrase = (stopper: string[], verb: string) =>
    stopper[0] === 'stop' && verb !== 'stop' && verb.length > 2 && (stopper[1] || '').startsWith(verbStem(verb))
  const oppositeVerbs = (capabilityId: string, scenarioId: string): [string, string] | undefined => {
    const capability = capabilityId.split('-')
    const scenario = scenarioId.split('-')
    const capabilityVerb = capability[0] || ''
    const scenarioVerb = scenario[0] || ''
    if (opposites.get(capabilityVerb)?.has(scenarioVerb)) return [capabilityVerb, scenarioVerb]
    if (stopPhrase(scenario, capabilityVerb)) return [capabilityVerb, `stop ${scenario[1]}`]
    if (stopPhrase(capability, scenarioVerb)) return [`stop ${capability[1]}`, scenarioVerb]
    if (capabilityVerb === 'mark' && scenarioVerb === 'mark') {
      const state = capability.at(-1)
      const opposite = state === 'read' ? 'unread' : state === 'unread' ? 'read' : undefined
      if (opposite && scenario.slice(1).includes(opposite)) return [`mark ${state}`, `mark ${opposite}`]
    }
    return undefined
  }
  for (const scenario of model.capabilityScenarios) {
    const pair = oppositeVerbs(scenario.capability, scenario.id)
    if (pair) {
      warnings.push(
        `${scenario.file}: opens with "${pair[1]}" under Capability "${scenario.capability}", whose verb is "${pair[0]}"; opposite verbs are separate Capabilities`
      )
    }
  }

  /*
   * An umbrella verb names a bucket, not a control: `manage-orders` hides
   * refunding, merging and confirming, which the split test makes separate
   * Capabilities. Read from the first segment directly, like the opposite
   * pairs, so a verb the lexicon lacks is still caught.
   */
  const UMBRELLA_VERBS = new Set(['manage', 'organize', 'handle', 'administer'])
  for (const capability of model.capabilities) {
    const verb = leadingVerb(capability.id)
    if (UMBRELLA_VERBS.has(verb)) {
      warnings.push(
        `${capability.file}: capability id "${capability.id}" leads with the umbrella verb "${verb}"; name each verb its controls show — opposite and distinct verbs are separate Capabilities`
      )
    }
  }

  /*
   * Behavioral ids draw their noun half from that vocabulary. Two independent
   * mappings of one repository agreed on 95% of the Capabilities they found and
   * shared 29% of the ids, because one wrote `install-skills` where the other
   * wrote `install-agent-skills` and one `lint-model` where the other wrote
   * `lint-product-model`. The concepts matched; the nouns did not. Anchoring the
   * noun half to a term the model already declares removes that whole class of
   * divergence, and only fires when the author has declared the fuller term.
   */
  for (const resource of behavioural) {
    const segments = resource.id.split('-')
    if (segments.length < 2) continue
    const object = segments.slice(1).join('-')
    if (nounVocabulary.has(object)) continue
    // Suffix only. A declared term that merely *starts* with the noun half is
    // usually a different thing — `blueprint-portability` is a Domain, and
    // `contribute-blueprint` is correctly about a blueprint, not about the Domain.
    // Only things a behavior acts on: an Experience or Screen names a place.
    const candidates = [...thingVocabulary]
      .filter(term => term.endsWith(`-${object}`) && term !== resource.id)
    // Two declared kinds sharing the noun make it their category:
    // `send-message` beside channel and direct messages names both.
    const fuller = candidates.length === 1 ? candidates[0] : undefined
    if (fuller) {
      warnings.push(
        `${resource.file}: ${resource.kind} id "${resource.id}" names "${object}" where this model declares "${fuller}"; use the declared name`
      )
    }
  }

  /*
   * Cross-cutting ids name something that *is*, so they never open with a verb.
   * A Business Rule states what must remain true and reads as an assertion about
   * a subject, not as a command.
   */
  const nounIdKinds: Array<{ file: string, id: string, kind: string }> = [
    ...model.entities.map(item => ({ file: item.file, id: item.id, kind: 'Entity' })),
    ...model.domains.map(item => ({ file: item.file, id: item.id, kind: 'Domain' })),
    ...model.businessRules.map(item => ({ file: item.file, id: item.id, kind: 'Business Rule' }))
  ]
  for (const resource of nounIdKinds) {
    const segments = resource.id.split('-')
    // A single-segment id cannot be verb-noun; `order` is a noun here even
    // though the same word is a verb elsewhere.
    if (segments.length < 2) continue
    const first = segments[0] || ''
    // A verb only commands when it acts on something the model declares:
    // `cancel-unpaid-orders` does, while `pull-request` and `sign-in` are nouns.
    // A declared noun can span segments: `approve-refund-request` acts on a Refund request.
    const rest = segments.slice(1)
    const nouns = [...rest, ...rest.map((_, index) => rest.slice(index).join('-'))]
    const actsOnDeclared = nouns.some(noun => nounVocabulary.has(noun) || nounVocabulary.has(noun.replace(/s$/, '')))
    if (isVerbSegment(first) && actsOnDeclared) {
      warnings.push(
        `${resource.file}: ${resource.kind} id "${resource.id}" opens with a verb; cross-cutting ids name what a thing is, not what is done`
      )
    }
  }

  /*
   * An Entity declares nothing about who uses it. Steps say what changes it, a
   * Screen says what presents it, and everything that names an actor says who
   * acts — all resolved here, with the whole model in hand.
   */
  const allScenarios = [...model.capabilityScenarios, ...model.journeyScenarios]
  const changedEntities = new Set<string>()
  /* Every state some Step leaves an Entity in, and every origin some Step leaves it from. */
  const producedStates = new Map<string, Set<string>>()
  const originStates = new Map<string, Map<string, string>>()
  for (const scenario of allScenarios) {
    for (const step of scenario.steps) {
      for (const entry of step.entities) {
        if ((entry.effect ?? 'changes') === 'reads') continue
        changedEntities.add(entry.entity)
        if (entry.to !== undefined) {
          producedStates.set(entry.entity, new Set([...(producedStates.get(entry.entity) ?? []), entry.to]))
        }
        if (entry.from !== undefined) {
          const origins = originStates.get(entry.entity) ?? new Map<string, string>()
          if (!origins.has(entry.from)) origins.set(entry.from, scenario.file)
          originStates.set(entry.entity, origins)
        }
      }
    }
  }
  const presentedOn = new Map<string, string[]>()
  for (const screen of model.screens) {
    for (const entry of screen.entities) {
      const entity = entitiesById.get(entry.entity)
      if (!entity) {
        errors.push(`${screen.file}: names missing entity "${entry.entity}"`)
        continue
      }
      presentedOn.set(entry.entity, [...(presentedOn.get(entry.entity) || []), screen.id])
      for (const issue of screenEntityIssues(entry.entity, entry, entity)) errors.push(`${screen.file}: ${issue}`)
    }
  }
  /* A settings or policy Entity that only Rules read is still in use: a
     condition reads a fact of it, or a grant is gated by it. */
  const citedByVariation = new Set(model.variations.flatMap(variation => variationEntityReferences(variation)))
  const citedByRule = new Set<string>(model.businessRules.flatMap(rule => (rule.permits ?? []).flatMap(grant => [
    ...(grant.configuredBy ? [grant.configuredBy] : []),
    ...grant.when.flatMap(condition => [
      ...(condition.entity ? [condition.entity] : []),
      ...(typeof condition.value === 'object' && condition.value !== null ? [condition.value.entity] : [])
    ])
  ])))
  /* Named as an actor anywhere: a Step, a surface, a Journey, or a grant. */
  const namedAsActor = new Set<string>([
    ...allScenarios.flatMap(scenario => scenario.steps.flatMap(step => step.actor ? [step.actor] : [])),
    ...model.interfaces.flatMap(item => item.actors),
    ...model.experiences.flatMap(item => item.actors),
    ...model.journeys.flatMap(item => item.actors),
    ...model.businessRules.flatMap(rule => (rule.permits ?? []).flatMap(grant => [
      ...grant.actors,
      ...(grant.related.length ? [grant.related[grant.related.length - 1]!.entity] : [])
    ]))
  ])

  for (const entity of model.entities) {
    requireTitle(entity.file, entity.doc.title, entity.doc.lead)
    /*
     * `## Transitions` and `## Relations` are refused for the reason `## Steps`
     * is refused on a Scenario: the frontmatter and the Steps are the one
     * authority, and a prose section beside them is a second one that can
     * disagree.
     */
    validateSections(
      entity.file,
      entity.doc,
      ['Intent', 'Information kept', 'States'],
      ['Transitions', 'Relations']
    )
    if (entity.domain && !domainIds.has(entity.domain)) {
      errors.push(`${entity.file}: names missing domain "${entity.domain}"`)
    }

    /*
     * The lifecycle is composed from every Scenario, and this is where the
     * composition says what it is missing. The first listed state is the one a
     * thing starts in, so it is reachable by construction — a Catalog product no
     * Capability creates is a real Entity whose instances pre-exist the model.
     * Everything else has to be produced by some Step. No creation and no
     * termination are notes the report shows, never findings here.
     */
    const first = entity.states[0]?.title
    const produced = producedStates.get(entity.id) ?? new Set<string>()
    for (const state of entity.states.slice(1)) {
      if (!produced.has(state.title)) {
        warnings.push(`${entity.file}: no Step leaves it in "${state.title}"`)
      }
    }
    for (const [from, file] of originStates.get(entity.id) ?? []) {
      if (from !== first && !produced.has(from)) {
        warnings.push(`${entity.file}: ${file} moves it from "${from}", which no Step produces`)
      }
    }

    /*
     * Relations are declared on one side; the inverse is derived. A relation to
     * another Entity is an edge in the product's own vocabulary — it never
     * satisfies the no-orphans rule below, because a cluster of Entities
     * referencing each other while no behaviour touches any of them is still
     * vocabulary nobody uses.
     */
    /* Two states with one name are two rows a Step's `from` and `to` cannot
       tell apart, so the lifecycle they compose is ambiguous. */
    const stateTitles = new Set<string>()
    for (const state of entity.states) {
      if (stateTitles.has(state.title)) errors.push(`${entity.file}: duplicate state "${state.title}"`)
      stateTitles.add(state.title)
    }

    // A relation may target this same Entity: a Comment replies to another
    // Comment, a Task blocks another Task. Only a duplicate edge is wrong.
    const relationTargets = new Set<string>()
    for (const relation of entity.relations) {
      if (!entityIds.has(relation.entity)) {
        errors.push(`${entity.file}: relation names missing entity "${relation.entity}"`)
      }
      const key = `${relation.entity}\0${relation.verb}`
      if (relationTargets.has(key)) errors.push(`${entity.file}: duplicate relation "${relation.verb} ${relation.entity}"`)
      relationTargets.add(key)
      const singletonIssue = singletonRelationIssue({ from: entity.id, to: relation.entity, cardinality: relation.cardinality }, singletonIds)
      if (singletonIssue) errors.push(`${entity.file}: relation "${relation.verb} ${relation.entity}" ${singletonIssue}`)

      /*
       * Now that a relation states both ends, an Entity relating back is the
       * same relationship written twice, and the two encodings can contradict
       * each other outright. A warning rather than an error, because two
       * genuinely different relationships between one pair remain legal.
       */
      if (relation.entity === entity.id) continue
      const facing = model.entities.find(other => other.id === relation.entity)
      for (const back of facing?.relations ?? []) {
        if (back.entity !== entity.id) continue
        warnings.push(
          `${entity.file}: "${relation.verb} ${relation.entity}" faces "${back.verb} ${back.entity}" in ${facing!.file}; a relation is declared on one side only and now states both ends`
        )
      }
    }

    // No orphans. Vocabulary nothing points at is either unused or a relation
    // somebody forgot to declare, and both are worth an error. A read never
    // counts; acting does.
    if (!changedEntities.has(entity.id) && !(presentedOn.get(entity.id) || []).length
      && !namedAsActor.has(entity.id) && !citedByRule.has(entity.id) && !citedByVariation.has(entity.id)) {
      errors.push(`${entity.file}: no Step changes it, no Screen presents it, nothing names it as an actor, no Rule reads it, and no Variation chooses by it`)
    }
  }

  const capabilityAvailability = new Map<string, Set<string>>()
  for (const capability of model.capabilities) {
    requireTitle(capability.file, capability.doc.title, capability.doc.lead)
    validateSections(capability.file, capability.doc, ['Intent'])
    if (!capability.availability.length) errors.push(`${capability.file}: needs at least one availability Context`)
    if (capability.domain && !domainIds.has(capability.domain)) {
      errors.push(`${capability.file}: references missing domain "${capability.domain}"`)
    }
    capabilityAvailability.set(capability.id, validateAvailability(capability.file, capability.availability))
  }

  /* An Experience is authoritative for its audience; an undivided Interface is authoritative for its. */
  const supportedActorsForContainer = (place: string): Set<string> | undefined => {
    const experience = experiencesById.get(place)
    if (experience) return new Set(experience.actors)
    const productInterface = interfacesById.get(place)
    return productInterface ? new Set(productInterface.actors) : undefined
  }

  /*
   * A Screen beside `experiences/` is shared: it is inside every Experience of
   * its Interface. Containment, Scenario coverage, and Step Contexts therefore
   * read a divided Interface as the set of its Experiences, and an undivided
   * Interface or an Experience as itself.
   */
  const isDividedInterface = (place: string) => (experiencesByInterface.get(place) || []).length > 0
  const availabilityPlacesOf = (containerId: string): string[] =>
    isDividedInterface(containerId)
      ? (experiencesByInterface.get(containerId) || []).map(experience => experience.id)
      : [containerId]
  const insideEvery = (supported: Set<string>, containerId: string) =>
    availabilityPlacesOf(containerId).every(place => supported.has(place))

  const resolveScenarioContext = (label: string, placeId: string) => {
    if (!placeId) {
      errors.push(`${label}: Context needs a non-empty place id`)
      return undefined
    }
    if (!isQualifiedId(placeId)) {
      errors.push(`${label}: Context place "${placeId}" is not a valid Interface, Experience, or Screen id`)
      return undefined
    }
    const screen = screensById.get(placeId)
    if (screen) return { place: placeId, containerId: screen.containerId, screen }
    const experience = experiencesById.get(placeId)
    if (experience) {
      return { place: placeId, containerId: placeId, screen: undefined }
    }
    const productInterface = interfacesById.get(placeId)
    if (productInterface) {
      if (experienceScopedInterfaces.has(placeId)) {
        errors.push(`${label}: Interface "${placeId}" is divided into Experiences, so the Context must name one of them, one of their Screens, or a Screen it shares`)
      }
      return { place: placeId, containerId: placeId, screen: undefined }
    }
    errors.push(`${label}: Context references missing place "${placeId}"`)
    return undefined
  }

  type ScenarioForValidation = typeof model.capabilityScenarios[number] | typeof model.journeyScenarios[number]
  const validateScenarioShape = (
    scenario: ScenarioForValidation,
    implicitCapability?: string,
    journeyActors?: Set<string>
  ) => {
    if (!scenario.routes.length) errors.push(`${scenario.file}: needs at least one route`)
    const routeIds = new Set<string>()
    const routeNames = new Set<string>()
    const routeContextPlaces = new Map<string, string[]>(scenario.routes.map(route => [route.id, []]))
    for (const route of scenario.routes) {
      const label = `${scenario.file}: route "${route.id}"`
      if (!route.id) errors.push(`${scenario.file}: route id must not be empty`)
      else if (!isId(route.id)) errors.push(`${label}: id must be lowercase kebab-case`)
      if (routeIds.has(route.id)) errors.push(`${label}: duplicate route id`)
      routeIds.add(route.id)
      const name = route.name.trim()
      if (!name) errors.push(`${label}: needs a non-empty name`)
      const normalizedName = name.toLocaleLowerCase()
      if (routeNames.has(normalizedName)) errors.push(`${label}: duplicate route name "${route.name}"`)
      routeNames.add(normalizedName)
    }

    if (!scenario.steps.length) errors.push(`${scenario.file}: needs at least one step`)
    const allContextPlaces = new Set<string>()
    const allContainers = new Set<string>()
    const scenarioActors = new Set<string>()
    const capabilitySteps: Array<{ capability: string, contextPlaces: Set<string>, containers: Set<string> }> = []
    const unattendedScenario = scenario.steps[0]?.unattended === true
    /* Per instance, the state the last Step left it in; per Entity, whether it
       is mentioned bare or aliased — once aliased anywhere, aliased everywhere. */
    const instanceStates = new Map<string, string>()
    const aliasModes = new Map<string, 'bare' | 'aliased'>()
    for (const [index, step] of scenario.steps.entries()) {
      const label = `${scenario.file}: step ${index + 1}`
      if (!step.text.trim()) errors.push(`${label}: needs non-empty text`)
      if (/\r|\n/.test(step.text)) errors.push(`${label}: text must be a single line`)
      if (!['actor', 'product', 'condition'].includes(step.kind)) {
        errors.push(`${label}: kind "${step.kind}" must be actor|product|condition`)
      }
      /*
       * An actor Step names who performs it. A Product or condition Step may
       * name who it is attributable to — the Product did it for them — and a
       * Business Rule reads either as "who did". Every actor named joins the
       * Scenario's Actor set. An unattended Scenario names nobody: its
       * permission is a Rule's unattended grant, not a person.
       */
      if (step.kind === 'actor' && !step.actor) errors.push(`${label}: an actor Step needs one actor`)
      if (step.actor) {
        scenarioActors.add(step.actor)
        requireActor(label, step.actor)
        if (unattendedScenario) {
          errors.push(`${label}: an unattended Scenario names no actor; its permission is a Rule's "unattended" grant`)
        }
      }

      /*
       * A Step's `entities` closes the loop the model could not check before.
       * Each state named must be one the Entity has; a creation says where it
       * starts and a removal where it ends when the Entity has states at all;
       * two instances of one Entity are told apart by alias; and where an
       * earlier Step left an instance in a state, this Step leaves from it.
       */
      if (!implicitCapability && !step.capability
        && step.entities.some(entry => (entry.effect ?? 'changes') !== 'reads')) {
        errors.push(`${label}: a Journey Step that creates, changes or removes an Entity needs a "capability" to own the change`)
      }
      for (const entry of step.entities) {
        const entity = entitiesById.get(entry.entity)
        if (!entity) {
          errors.push(`${label}: references missing entity "${entry.entity}"`)
          continue
        }
        const effect = entry.effect ?? 'changes'
        const name = entry.as ? `${entry.entity} (${entry.as})` : entry.entity
        const mode = entry.as ? 'aliased' : 'bare'
        const priorMode = aliasModes.get(entry.entity)
        if (priorMode && priorMode !== mode) {
          errors.push(`${label}: "${entry.entity}" is ${priorMode === 'aliased' ? 'aliased' : 'bare'} elsewhere in this Scenario; once an Entity is aliased, every mention of it is`)
        }
        aliasModes.set(entry.entity, mode)
        for (const issue of unknownFactIssues(entry.entity, entry.facts, entity)) errors.push(`${label}: ${issue}`)

        const hasStates = entity.states.length > 0
        for (const [key, value] of [['from', entry.from], ['to', entry.to]] as const) {
          if (value === undefined) continue
          if (!hasStates) errors.push(`${label}: "${key}: ${value}" names a state, and entity "${entry.entity}" declares none`)
          else if (!entity.states.some(state => state.title === value)) {
            errors.push(`${label}: "${value}" is not a state of entity "${entry.entity}"`)
          }
        }
        if (hasStates && effect === 'creates' && entry.to === undefined) {
          errors.push(`${label}: creating "${name}" needs "to", the state it starts in`)
        }
        if (hasStates && effect === 'removes' && entry.from === undefined) {
          errors.push(`${label}: removing "${name}" needs "from", the state it ends in`)
        }

        const instance = `${entry.entity}\0${entry.as ?? ''}`
        const left = instanceStates.get(instance)
        if (entry.from !== undefined && left !== undefined && left !== entry.from) {
          errors.push(
            `${label}: "${name}" was left in "${left}" by an earlier Step, not "${entry.from}"; if these are different instances, give them aliases`
          )
        }
        if (effect === 'removes') instanceStates.delete(instance)
        else if (entry.to !== undefined) instanceStates.set(instance, entry.to)
      }

      /*
       * A Step whose text names a thing it does not declare is the silence this
       * key exists to end. Titles only, never every word: the undefined-vocabulary
       * check that matched all prose was abandoned for noise. The Step's own
       * actor is exempt, and so is "The Product", which every Product Step opens
       * with by convention.
       */
      for (const entity of undeclaredEntityMentions(
        step.text,
        namedEntities,
        step.entities.map(entry => entry.entity),
        step.actor
      )) {
        errors.push(`${label}: text names "${entity.title}" and "entities" does not declare it`)
      }

      const capabilityId = implicitCapability || step.capability
      if (capabilityId) {
        capabilitySteps.push({ capability: capabilityId, contextPlaces: new Set<string>(), containers: new Set<string>() })
        if (!capabilityIds.has(capabilityId)) {
          errors.push(`${label}: references missing capability "${capabilityId}"`)
        }
      }

      if (!step.contexts.length) continue
      const contextualizedRouteIds = new Set<string>()
      for (const context of step.contexts) {
        const contextLabel = `${label}: route "${context.routeId}"`
        if (!routeIds.has(context.routeId)) {
          errors.push(`${contextLabel}: references undeclared route`)
        }
        if (contextualizedRouteIds.has(context.routeId)) errors.push(`${contextLabel}: duplicate Context`)
        contextualizedRouteIds.add(context.routeId)
        routeContextPlaces.get(context.routeId)?.push(context.place)
        const resolved = resolveScenarioContext(contextLabel, context.place)
        if (!resolved) continue
        allContextPlaces.add(resolved.place)
        allContainers.add(resolved.containerId)
        const currentCapabilityStep = capabilityId ? capabilitySteps.at(-1) : undefined
        currentCapabilityStep?.contextPlaces.add(resolved.place)
        currentCapabilityStep?.containers.add(resolved.containerId)
        if (capabilityId) {
          const supported = capabilityAvailability.get(capabilityId) || new Set<string>()
          if (!insideEvery(supported, resolved.containerId)) {
            errors.push(`${contextLabel}: Context place "${resolved.place}" is outside capability "${capabilityId}"`)
          }
        }
        if (step.actor) {
          const supported = supportedActorsForContainer(resolved.containerId) || new Set<string>()
          if (!supported.has(step.actor)) {
            errors.push(`${contextLabel}: Context place does not support actor "${step.actor}"`)
          }
        }
      }
      if (!sameSet(contextualizedRouteIds, routeIds)) {
        errors.push(`${label}: contexts must assign every declared route or be omitted`)
      }
    }

    /*
     * F5 — a Scenario needs an actor Step OR an unattended trigger. Unattended
     * behavior (a schedule the Product owns, an expiry, a retry) is real Product
     * behavior with nobody to name, and requiring an Actor left it uncovered.
     */
    const unattendedTrigger = unattendedScenario
    if (unattendedTrigger && scenario.steps[0]?.kind !== 'condition') {
      errors.push(`${scenario.file}: an unattended trigger must be a condition Step`)
    }
    for (const [index, step] of scenario.steps.entries()) {
      if (index > 0 && step.unattended) {
        errors.push(`${scenario.file}: step ${index + 1}: "unattended" is valid only on the first Step`)
      }
    }
    if (!scenario.steps.some(step => step.kind === 'actor') && !unattendedTrigger) {
      errors.push(`${scenario.file}: needs at least one actor Step, or an unattended first condition Step`)
    }
    for (const route of scenario.routes) {
      const sequence = routeContextPlaces.get(route.id) || []
      if (!sequence.length) errors.push(`${scenario.file}: route "${route.id}" must have a Context on at least one Step`)
    }
    const seenSequences = new Map<string, string>()
    for (const route of scenario.routes) {
      const sequence = (routeContextPlaces.get(route.id) || []).join('\n')
      if (!sequence) continue
      const twin = seenSequences.get(sequence)
      if (twin) errors.push(`${scenario.file}: route "${route.id}" repeats every Context place of route "${twin}"`)
      else seenSequences.set(sequence, route.id)
    }

    // An unattended Scenario has no Actor by construction, so "does this place
    // permit the Scenario's Actors" has no answer for it. Its Contexts say where
    // an Actor OBSERVES the outcome, which the Screen/Capability checks already
    // cover.
    const supportedSomewhere = new Set<string>()
    if (!unattendedTrigger) {
      for (const container of allContainers) {
        const supported = supportedActorsForContainer(container) || new Set<string>()
        const participating = [...scenarioActors].filter(actorId => supported.has(actorId))
        if (!participating.length) {
          errors.push(`${scenario.file}: Context place "${container}" permits none of the Scenario Actors`)
        }
        for (const actorId of participating) supportedSomewhere.add(actorId)
      }
    }
    for (const actorId of scenarioActors) {
      if (actorIds.has(actorId) && !supportedSomewhere.has(actorId)) {
        errors.push(`${scenario.file}: actor "${actorId}" is not supported by any selected Context place`)
      }
    }

    if (journeyActors) {
      for (const route of scenario.routes) {
        const firstActorStep = scenario.steps.find(step =>
          step.kind === 'actor' && step.contexts.some(context => context.routeId === route.id)
        )
        if (!firstActorStep?.actor || !journeyActors.has(firstActorStep.actor)) {
          errors.push(`${scenario.file}: route "${route.id}" must begin its contextualized Actor Steps with a Journey Actor`)
        }
      }
    }
    return { allContextPlaces, allContainers, scenarioActors, capabilitySteps }
  }

  const validateScenarioSections = (scenario: {
    file: string
    doc: { title: string, lead: string, sections: Array<{ heading: string, body: string }> }
    kind: string
    trigger: string
    outcome: string
    edgeCases: string[]
  }) => {
    if (!scenario.doc.title) errors.push(`${scenario.file}: missing H1 title`)
    if (scenario.doc.lead) {
      errors.push(`${scenario.file}: carries no lead paragraph; move that content into "## Trigger" or another explicit section`)
    }
    validateSections(
      scenario.file,
      scenario.doc,
      ['Intent', 'Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases'],
      ['Goal', 'Success criterion', 'Steps']
    )
    validateListSection(scenario.file, scenario.doc, 'Edge cases', 'bullet')
    if (!scenario.kind || !kindIds.has(scenario.kind)) {
      errors.push(`${scenario.file}: kind "${scenario.kind}" is not defined in taxonomies.yaml`)
    }
    if (!scenario.trigger) errors.push(`${scenario.file}: missing "## Trigger" section`)
    if (!scenario.outcome) errors.push(`${scenario.file}: missing "## Outcome" section`)
    if (section(scenario.doc, 'Edge cases') !== undefined && !scenario.edgeCases.length) {
      errors.push(`${scenario.file}: "## Edge cases" needs at least one bullet item when present`)
    }
  }

  const seenScenarioIds = new Map<string, string>()
  for (const scenario of [...model.capabilityScenarios, ...model.journeyScenarios]) {
    const previous = seenScenarioIds.get(scenario.id)
    if (previous) {
      errors.push(`${scenario.file}: scenario id "${scenario.id}" already used in ${previous} (ids are global)`)
    }
    seenScenarioIds.set(scenario.id, scenario.file)
  }

  const capabilityScenariosById = new Map(model.capabilityScenarios.map(scenario => [scenario.id, scenario]))
  const capabilityScenarioContextPlaces = new Map<string, Set<string>>()
  const coveredCapabilityPlaces = new Map<string, Set<string>>()
  for (const scenario of model.capabilityScenarios) {
    validateScenarioSections(scenario)
    if (!scenario.capability) {
      errors.push(`${scenario.file}: needs one capability`)
    } else if (!capabilityIds.has(scenario.capability)) {
      errors.push(`${scenario.file}: references missing capability "${scenario.capability}"`)
    }
    const { allContextPlaces, allContainers } = validateScenarioShape(scenario, scenario.capability)
    capabilityScenarioContextPlaces.set(scenario.id, allContextPlaces)
    const coveredPlaces = coveredCapabilityPlaces.get(scenario.capability) || new Set<string>()
    for (const place of allContainers) for (const inside of availabilityPlacesOf(place)) coveredPlaces.add(inside)
    coveredCapabilityPlaces.set(scenario.capability, coveredPlaces)
    const supported = capabilityAvailability.get(scenario.capability) || new Set<string>()
    for (const place of allContainers) {
      if (!insideEvery(supported, place)) {
        errors.push(`${scenario.file}: Context place "${place}" is outside capability "${scenario.capability}"`)
      }
    }
  }
  for (const capability of model.capabilities) {
    const covered = coveredCapabilityPlaces.get(capability.id) || new Set<string>()
    const required = capabilityAvailability.get(capability.id) || new Set<string>()
    for (const place of required) {
      if (covered.has(place)) continue
      const finding = `${capability.file}: availability Context place "${place}" needs Capability Scenario coverage`
      errors.push(finding)
    }
  }

  const journeysById = new Map(model.journeys.map(journey => [journey.id, journey]))
  for (const journey of model.journeys) {
    if (!journey.doc.title) errors.push(`${journey.file}: missing H1 title`)
    if (journey.doc.lead) {
      errors.push(`${journey.file}: carries no lead paragraph; move that content into "## Goal"`)
    }
    validateSections(
      journey.file,
      journey.doc,
      ['Intent', 'Goal', 'Success criterion'],
      ['Trigger', 'Steps', 'Decision points', 'Outcome', 'Edge cases']
    )
    if (!journey.actors.length) errors.push(`${journey.file}: needs at least one actor`)
    for (const actorId of journey.actors) requireActor(journey.file, actorId)
    if (!journey.goal) errors.push(`${journey.file}: missing "## Goal" section`)
    if (!journey.successCriterion) errors.push(`${journey.file}: missing "## Success criterion" section`)
    if (!model.journeyScenarios.some(scenario => scenario.journey === journey.id && scenario.result === 'achieved')) {
      errors.push(`${journey.file}: needs at least one achieved Journey Scenario`)
    }
  }

  const journeyScenariosById = new Map(model.journeyScenarios.map(scenario => [scenario.id, scenario]))
  const journeyScenarioSteps = new Map<string, Array<{ capability: string, contextPlaces: Set<string>, containers: Set<string> }>>()
  const journeyScenarioActors = new Map<string, Set<string>>()
  for (const scenario of model.journeyScenarios) {
    validateScenarioSections(scenario)
    const journey = journeysById.get(scenario.journey)
    if (!journey) errors.push(`${scenario.file}: references missing journey "${scenario.journey}"`)
    if (!JOURNEY_RESULTS.has(scenario.result)) {
      errors.push(`${scenario.file}: result "${scenario.result}" must be achieved|not-achieved`)
    }
    const journeyActorSet = new Set(journey?.actors || [])
    const { scenarioActors, capabilitySteps } = validateScenarioShape(scenario, undefined, journeyActorSet)
    if (journey && ![...scenarioActors].some(actorId => journeyActorSet.has(actorId))) {
      errors.push(`${scenario.file}: actor Steps must include at least one actor from journey "${scenario.journey}"`)
    }
    if (!capabilitySteps.length) errors.push(`${scenario.file}: needs at least one Capability-bearing step`)
    journeyScenarioSteps.set(scenario.id, capabilitySteps)
    journeyScenarioActors.set(scenario.id, scenarioActors)
    if (scenario.result === 'achieved' && new Set(capabilitySteps.map(item => item.capability)).size < 2) {
      errors.push(`${scenario.file}: an achieved Journey Scenario needs at least two distinct Capabilities`)
    } else if (scenario.result === 'achieved' && journey) {
      /* The Product carries the Journey's own Actor across; a hand-off to
         another Actor carries nobody, so only Steps one Journey Actor performs
         or is attributed count toward the two Capabilities — counted per
         Actor, since an agent proposing and a person accepting are two Actors
         each using one Capability, not one Actor carried through two. */
      const carried = new Map<string, Set<string>>()
      for (const step of scenario.steps) {
        if (!step.capability || !step.actor || !journeyActorSet.has(step.actor)) continue
        carried.set(step.actor, (carried.get(step.actor) || new Set()).add(step.capability))
      }
      if (![...carried.values()].some(capabilities => capabilities.size >= 2)) {
        errors.push(`${scenario.file}: an achieved Journey Scenario must carry one Journey Actor through at least two Capabilities; Steps of another Actor, or of another Journey Actor, do not add up`)
      }
    }
  }

  for (const journey of model.journeys) {
    const achievedActorIds = new Set(
      model.journeyScenarios
        .filter(scenario => scenario.journey === journey.id && scenario.result === 'achieved')
        .flatMap(scenario => [...(journeyScenarioActors.get(scenario.id) || [])])
    )
    for (const actorId of journey.actors) {
      if (!achievedActorIds.has(actorId)) {
        errors.push(`${journey.file}: actor "${actorId}" needs an achieved Journey Scenario`)
      }
    }
  }

  /* Every Step placed on a Screen, by Screen id. */
  const stepsOnScreen = new Map<string, Array<{ label: string, step: ScenarioStep, capabilityId: string | undefined }>>()
  for (const scenario of allScenarios) {
    const implicitCapability = 'capability' in scenario ? scenario.capability : undefined
    for (const [index, step] of scenario.steps.entries()) {
      const capabilityId = implicitCapability ?? step.capability
      for (const place of new Set(step.contexts.map(context => context.place))) {
        if (!screensById.has(place)) continue
        const placed = stepsOnScreen.get(place) || []
        placed.push({ label: `${scenario.file}: step ${index + 1}`, step, capabilityId })
        stepsOnScreen.set(place, placed)
      }
    }
  }

  for (const screen of model.screens) {
    requireTitle(screen.file, screen.doc.title, screen.doc.lead)
    /* A Screen is relations only. What it shows is `entities`, what it offers
       derives from the Steps placed on it, and its states are the
       Scenario branches that reach them; a prose section for any of these was
       a second encoding nothing could check. */
    validateSections(
      screen.file,
      screen.doc,
      ['Intent'],
      ['Information presented', 'Available actions', 'View states', 'Capability boundary']
    )
    if (!availabilityPlacesOf(screen.containerId).every(place => availabilityPlaceIds.has(place))) {
      errors.push(`${screen.file}: containing place "${screen.containerId}" must be an Interface or an Experience`)
    }
    if (!screen.capabilities.length) errors.push(`${screen.file}: needs at least one capability`)
    for (const capabilityId of screen.capabilities) {
      if (!capabilityIds.has(capabilityId)) {
        errors.push(`${screen.file}: references missing capability "${capabilityId}"`)
        continue
      }
      const supported = capabilityAvailability.get(capabilityId) || new Set<string>()
      const missing = availabilityPlacesOf(screen.containerId).filter(place => !supported.has(place))
      if (!missing.length) continue
      errors.push(isDividedInterface(screen.containerId)
        ? `${screen.file}: capability "${capabilityId}" must be available in every Experience of "${screen.containerId}", which shares this Screen; missing "${missing.join('", "')}"`
        : `${screen.file}: capability "${capabilityId}" is not available in containing place "${screen.containerId}"`)
    }
    validateEntryPointInterfaces(
      screen.file,
      screen.entryPoints,
      new Set([interfaceOf(screen.containerId)])
    )

    const placed = stepsOnScreen.get(screen.id) || []
    const presented = new Map(screen.entities.map(entry => [entry.entity, entry]))
    for (const { label, step } of placed) {
      const reads = { kind: step.kind, entities: step.entities.map(entry => ({ entityId: entry.entity, effect: entry.effect ?? 'changes', facts: entry.facts })) }
      for (const issue of screenReadIssues(screen.id, presented, reads, actorIds)) errors.push(`${label}: ${issue}`)
    }
  }


  /*
   * A `related` path starts at the Rule's one Entity target and walks declared
   * relations and their derived inverses, one segment at a time. Each segment
   * names the verb and the Entity it arrives at, so a hop resolves to exactly
   * one relation or it is an error naming what went wrong. A self-relation is
   * refused: naming the Entity does not give it a direction.
   */
  const relationEdges = model.entities.flatMap(entity => entity.relations.map(relation => ({
    from: entity.id, to: relation.entity, cardinality: relation.cardinality
  })))
  const walkRelated = (start: string, segments: RelatedSegment[], label: string): string | undefined => {
    let current = start
    for (const [index, segment] of segments.entries()) {
      const segmentLabel = `${label}: related segment ${index + 1}`
      if (!entityIds.has(segment.entity)) {
        errors.push(`${segmentLabel}: references missing entity "${segment.entity}"`)
        return undefined
      }
      if (segment.entity === current) {
        errors.push(`${segmentLabel}: "${segment.verb}" walks "${current}" to itself, and a self-relation has no direction to follow`)
        return undefined
      }
      const forward = (entitiesById.get(current)?.relations ?? [])
        .filter(relation => relation.verb === segment.verb && relation.entity === segment.entity)
      const inverse = (entitiesById.get(segment.entity)?.relations ?? [])
        .filter(relation => relation.verb === segment.verb && relation.entity === current)
      const matches = forward.length + inverse.length
      if (matches === 0) {
        errors.push(`${segmentLabel}: no relation "${segment.verb}" joins "${current}" and "${segment.entity}" in either direction`)
        return undefined
      }
      if (matches > 1) {
        errors.push(`${segmentLabel}: "${segment.verb}" joins "${current}" and "${segment.entity}" more than once; give one of them another verb`)
        return undefined
      }
      current = segment.entity
    }
    return current
  }

  for (const rule of model.businessRules) {
    requireTitle(rule.file, rule.doc.title, rule.doc.lead)
    validateSections(rule.file, rule.doc, ['Intent', 'Rationale'])
    if (!rule.appliesTo.length) errors.push(`${rule.file}: needs at least one appliesTo target`)

    /*
     * F4 — a Rule governs two or more behaviors, or a Context independent of
     * any single behavior. Anything true of exactly one Capability is that
     * Capability's business: a `condition` Step or its Scenario Outcome. A
     * `type: context` target is always fine, since a constraint on an
     * interaction context belongs to no behavior.
     */
    const resourceTargets = rule.appliesTo.filter(target => target.type !== 'context' && target.type !== 'entity')
    const entityTargets = rule.appliesTo.filter((target): target is BusinessRuleEntityTarget => target.type === 'entity')
    const narrowed = resourceTargets.some(
      target => 'contexts' in target && Array.isArray(target.contexts) && target.contexts.length > 0
    )
    const hasContextTarget = rule.appliesTo.some(target => target.type === 'context')
    /* An Entity target is always valid: a durable invariant or permission on a
       thing is a Rule even when it selects one operation, because the two homes
       this warning suggests do not exist for a permission. */
    if (resourceTargets.length === 1 && !narrowed && !hasContextTarget && !entityTargets.length) {
      const only = resourceTargets[0]
      const owner = only && 'id' in only ? only.id : 'that resource'
      warnings.push(
        `${rule.file}: governs only "${owner}"; a constraint true of one behavior belongs to it as a condition Step or Outcome, not a Business Rule`
      )
    }
    const seenTargets = new Set<string>()
    const capabilityTargets = new Set<string>()
    const journeyTargets = new Set<string>()
    const capabilityScenarioTargets: string[] = []
    const journeyScenarioTargets: string[] = []
    const directContextPlaces: string[] = []
    for (const [index, target] of rule.appliesTo.entries()) {
      const label = `${rule.file}: appliesTo item ${index + 1}`
      if (target.type === 'context') {
        const place = validateContextPlace(label, target.context)
        const key = `context\0${place}`
        if (seenTargets.has(key)) errors.push(`${label}: duplicate Context target place "${place}"`)
        const overlapping = directContextPlaces.find(existing =>
          existing !== place && (containsPlace(existing, place) || containsPlace(place, existing))
        )
        if (overlapping) {
          errors.push(`${label}: Context target place "${place}" is redundant with "${overlapping}"`)
        }
        seenTargets.add(key)
        directContextPlaces.push(place)
        continue
      }
      if (target.type === 'entity') {
        const entity = entitiesById.get(target.id)
        if (!target.id) errors.push(`${label}: needs a non-empty id`)
        else if (!entity) errors.push(`${label}: references missing entity "${target.id}"`)
        const key = `entity\0${target.id}\0${target.effect ?? ''}\0${target.from ?? ''}\0${target.to ?? ''}\0${target.facts.join(',')}`
        if (seenTargets.has(key)) errors.push(`${label}: duplicate target "entity:${target.id}"`)
        seenTargets.add(key)
        if (entity) {
          for (const [stateKey, value] of [['from', target.from], ['to', target.to]] as const) {
            if (value !== undefined && !entity.states.some(state => state.title === value)) {
              errors.push(`${label}: "${stateKey}: ${value}" is not a state of entity "${target.id}"`)
            }
          }
          for (const issue of unknownFactIssues(target.id, target.facts, entity)) errors.push(`${label}: ${issue}`)
        }
        /* An Entity has no availability. A place-scoped Entity Rule is about
           visibility, so the selector names a Screen presenting the Entity —
           with the governed fact, where the Rule names one — or an ancestor. */
        const presenting = model.screens.filter(screen => screen.entities.some(entry =>
          entry.entity === target.id
          && (!target.facts.length || [...entry.shows, ...entry.collects].some(fact => target.facts.includes(fact)))
        )).map(screen => screen.id)
        const seenEntityContextPlaces: string[] = []
        for (const [contextIndex, context] of target.contexts.entries()) {
          const contextLabel = `${label}: Context ${contextIndex + 1}`
          const place = validateContextPlace(contextLabel, context)
          if (seenEntityContextPlaces.includes(place)) errors.push(`${contextLabel}: duplicate Context place "${place}"`)
          const overlapping = seenEntityContextPlaces.find(existing =>
            existing !== place && (containsPlace(existing, place) || containsPlace(place, existing))
          )
          if (overlapping) {
            errors.push(`${contextLabel}: Context place "${place}" is redundant with "${overlapping}"`)
          }
          seenEntityContextPlaces.push(place)
          if (rule.permits === undefined && placeIds.has(place) && !presenting.some(screenId => screenId === place || containsPlace(place, screenId))) {
            errors.push(`${contextLabel}: Context place "${place}" presents entity "${target.id}" nowhere`)
          }
        }
        continue
      }
      if (!['capability', 'capability-scenario', 'journey', 'journey-scenario'].includes(target.type)) {
        errors.push(`${label}: type "${target.type}" must be capability|capability-scenario|journey|journey-scenario|context|entity`)
        continue
      }
      if (!target.id) errors.push(`${label}: needs a non-empty id`)
      const key = `${target.type}\0${target.id}`
      if (seenTargets.has(key)) errors.push(`${label}: duplicate target "${target.type}:${target.id}"`)
      seenTargets.add(key)
      let supported = new Set<string>()
      if (target.type === 'capability') {
        if (!capabilityIds.has(target.id)) errors.push(`${label}: references missing capability "${target.id}"`)
        capabilityTargets.add(target.id)
        supported = new Set(capabilityAvailability.get(target.id) || [])
        for (const screen of model.screens) {
          if (supported.has(screen.containerId) && screen.capabilities.includes(target.id)) supported.add(screen.id)
        }
      } else if (target.type === 'capability-scenario') {
        if (!capabilityScenarioIds.has(target.id)) errors.push(`${label}: references missing Capability Scenario "${target.id}"`)
        capabilityScenarioTargets.push(target.id)
        supported = capabilityScenarioContextPlaces.get(target.id) || supported
      } else if (target.type === 'journey') {
        if (!journeyIds.has(target.id)) errors.push(`${label}: references missing journey "${target.id}"`)
        journeyTargets.add(target.id)
        for (const scenario of model.journeyScenarios.filter(item => item.journey === target.id && item.result === 'achieved')) {
          for (const entry of journeyScenarioSteps.get(scenario.id) || []) {
            for (const place of entry.contextPlaces) supported.add(place)
          }
        }
      } else {
        if (!journeyScenarioIds.has(target.id)) errors.push(`${label}: references missing Journey Scenario "${target.id}"`)
        journeyScenarioTargets.push(target.id)
        for (const entry of journeyScenarioSteps.get(target.id) || []) {
          for (const place of entry.contextPlaces) supported.add(place)
        }
      }
      const seenContextPlaces: string[] = []
      for (const [contextIndex, context] of target.contexts.entries()) {
        const contextLabel = `${label}: Context ${contextIndex + 1}`
        const place = validateContextPlace(contextLabel, context)
        if (seenContextPlaces.includes(place)) errors.push(`${contextLabel}: duplicate Context place "${place}"`)
        const overlapping = seenContextPlaces.find(existing =>
          existing !== place && (containsPlace(existing, place) || containsPlace(place, existing))
        )
        if (overlapping) {
          errors.push(`${contextLabel}: Context place "${place}" is redundant with "${overlapping}"`)
        }
        seenContextPlaces.push(place)
        const sharedScreen = screensById.get(place)
        const insideTarget = supported.has(place)
          || [...supported].some(candidate => containsPlace(place, candidate))
          || (sharedScreen !== undefined && insideEvery(supported, sharedScreen.containerId))
        if (!insideTarget) {
          errors.push(`${contextLabel}: Context place "${place}" is outside target "${target.type}:${target.id}"`)
        }
      }
    }
    for (const scenarioId of capabilityScenarioTargets) {
      const capabilityId = capabilityScenariosById.get(scenarioId)?.capability
      if (capabilityId && capabilityTargets.has(capabilityId)) {
        errors.push(`${rule.file}: target "capability-scenario:${scenarioId}" is redundant with capability target "${capabilityId}"`)
      }
    }
    for (const scenarioId of journeyScenarioTargets) {
      const journeyId = journeyScenariosById.get(scenarioId)?.journey
      if (journeyId && journeyTargets.has(journeyId)) {
        errors.push(`${rule.file}: target "journey-scenario:${scenarioId}" is redundant with journey target "${journeyId}"`)
      }
    }

    /*
     * `permits` — structural eligibility only. `lint` cannot prove runtime
     * ownership, a fact's value, or customer configuration, and never claims a
     * grant is satisfied; it checks that every id resolves, that every path
     * walks one unambiguous hop at a time onto an Entity that acts, and that
     * no grant is impossible by construction.
     */
    if (rule.permits !== undefined) {
      if (rule.appliesTo.some(target => target.type !== 'entity')) {
        errors.push(`${rule.file}: "permits" needs Entity targets only; an operation is an Entity effect, and who uses a surface is its Interface's "actors"`)
      }
      const singleTarget = entityTargets.length === 1 ? entityTargets[0] : undefined
      const targetEntity = singleTarget ? entitiesById.get(singleTarget.id) : undefined
      /* One permission Rule per operation: a target without `effect` selects
         creates, changes, removes and reads at once, so two authors would
         split the same policy differently. Naming the effect is the shape. */
      for (const target of entityTargets) {
        if (target.effect === undefined) {
          warnings.push(`${rule.file}: target "entity:${target.id}" names no "effect"; each operation gets its own permission Rule naming its effect`)
        }
      }
      for (const [grantIndex, grant] of rule.permits.entries()) {
        const grantLabel = `${rule.file}: grant ${grantIndex + 1}`
        for (const actorId of grant.actors) requireActor(grantLabel, actorId)
        /* An AI agent acts for the person who connected it, so a grant to
           it names that person on its path: a bare grant admits every agent,
           and a path that never reaches a person — `leaves ai-agent` alone —
           says which agent wrote a thing, not who authorized it. */
        const reachesAgent = grant.actors.includes('ai-agent') || grant.related.at(-1)?.entity === 'ai-agent'
        if (reachesAgent && !grant.related.length) {
          warnings.push(`${grantLabel}: grants "ai-agent" with no "related" path, which admits any AI agent; say whose AI agent it is through "related"`)
        } else if (reachesAgent && singleTarget) {
          const path = [singleTarget.id, ...grant.related.slice(0, -1).map(segment => segment.entity)]
          if (!path.some(id => entitiesById.get(id)?.kind === 'person')) {
            warnings.push(`${grantLabel}: reaches "ai-agent" without passing a person; walk "related" through the person who connected the agent`)
          }
        }
        if (grant.configuredBy !== undefined && !entityIds.has(grant.configuredBy)) {
          errors.push(`${grantLabel}: "configuredBy" references missing entity "${grant.configuredBy}"`)
        }
        if (grant.self) {
          for (const target of entityTargets) {
            if (entityIds.has(target.id) && !actorIds.has(target.id)) {
              errors.push(`${grantLabel}: "self" needs entity "${target.id}" to act`)
            }
          }
        }
        if (grant.related.length) {
          if (!singleTarget) {
            errors.push(`${grantLabel}: "related" needs exactly one Entity target to start from`)
          } else {
            const endpoint = walkRelated(singleTarget.id, grant.related, grantLabel)
            if (endpoint !== undefined && !actorIds.has(endpoint)) {
              errors.push(`${grantLabel}: "related" ends on "${endpoint}", which does not act`)
            }
            if (endpoint !== undefined && grant.actors.length && !grant.actors.includes(endpoint)) {
              errors.push(`${grantLabel}: "actors" excludes "${endpoint}", where "related" ends; the grant can never be satisfied`)
            }
          }
        }
        for (const [conditionIndex, condition] of grant.when.entries()) {
          const conditionLabel = `${grantLabel}: condition ${conditionIndex + 1}`
          if (condition.state !== undefined) {
            if (!singleTarget) {
              errors.push(`${conditionLabel}: a "state" condition needs exactly one Entity target`)
              continue
            }
            if (singleTarget.effect === 'creates') {
              errors.push(`${conditionLabel}: a "state" condition on a "creates" target; there is no instance yet`)
            }
            if (targetEntity && !targetEntity.states.some(state => state.title === condition.state)) {
              errors.push(`${conditionLabel}: "${condition.state}" is not a state of entity "${singleTarget.id}"`)
            }
            continue
          }
          let holder = targetEntity
          let holderId = singleTarget?.id
          if (condition.entity !== undefined) {
            holder = entitiesById.get(condition.entity)
            holderId = condition.entity
            if (!holder) errors.push(`${conditionLabel}: references missing entity "${condition.entity}"`)
          } else if (!singleTarget) {
            errors.push(`${conditionLabel}: a "fact" without "entity" needs exactly one Entity target to read it on`)
            continue
          }
          if (holder && condition.fact !== undefined && !holder.informationKept.some(item => item.name === condition.fact)) {
            errors.push(`${conditionLabel}: "${condition.fact}" is not a fact of entity "${holderId}"`)
          }
          if (holder && condition.entity !== undefined) {
            const issue = conditionInstanceIssue({
              entityId: condition.entity,
              actorIds: grant.actors,
              pathIds: grant.related.map(segment => segment.entity),
              targetId: singleTarget?.id,
              singletonIds,
              relations: relationEdges
            })
            if (issue) errors.push(`${conditionLabel}: ${issue}`)
          }
          /* A threshold another fact holds is read like a condition's `entity`:
             one instance, or the condition says nothing. */
          if (typeof condition.value === 'object' && condition.value !== null) {
            const threshold = condition.value
            const thresholdHolder = entitiesById.get(threshold.entity)
            if (!thresholdHolder) {
              errors.push(`${conditionLabel}: the threshold references missing entity "${threshold.entity}"`)
            } else {
              for (const issue of unknownFactIssues(threshold.entity, [threshold.fact], thresholdHolder)) errors.push(`${conditionLabel}: the threshold's ${issue}`)
              const issue = threshold.entity === singleTarget?.id ? undefined : conditionInstanceIssue({
                entityId: threshold.entity,
                actorIds: grant.actors,
                pathIds: grant.related.map(segment => segment.entity),
                targetId: singleTarget?.id,
                singletonIds,
                relations: relationEdges
              })
              if (issue) errors.push(`${conditionLabel}: the threshold ${issue}`)
            }
          }
        }
      }
    }
  }

  /*
   * The Rules against the Steps and Screens they govern. A target selects a
   * Step by the keys its `entities` entry carries; a grant is *possible* for the
   * Step's actor when every who-key it carries could be that actor — `actors`
   * lists it, `related` ends on its type, `self` is the targeted thing itself,
   * `unattended` is what the Scenario is — and every state condition matches
   * the Step's origin where it has one. A fact-scoped Rule selects the Steps
   * that cite one of its facts and the Screens that list one. A permission
   * Rule that is a Variation alternative holds only while selected, and lint
   * cannot tell which alternative a Step runs under, so it is left to verify.
   */
  const permissionRuleResources = model.businessRules.filter(
    rule => !variationOf.has(`businessRules:${rule.id}`) && rule.permits !== undefined && rule.appliesTo.length > 0 && rule.appliesTo.every(target => target.type === 'entity')
  )
  const permissionTarget = (target: BusinessRuleEntityTarget): PermissionTarget => ({
    entityId: target.id,
    effect: target.effect ?? null,
    from: target.from ?? null,
    to: target.to ?? null,
    facts: target.facts,
    contextPlaces: target.contexts.map(context => context.place)
  })
  const permissionGrant = (grant: BusinessRuleGrant): PermissionGrant => ({
    actorIds: grant.actors,
    relatedActorId: grant.related.at(-1)?.entity ?? null,
    self: grant.self === true,
    unattended: grant.unattended === true,
    stateConditions: grant.when.flatMap(condition => condition.state === undefined ? [] : [condition.state])
  })
  /* A Step without `contexts` is shared by all routes, so it happens inside the
     Scenario's places rather than in none of them. */
  const scenarioPlaces = new Map<string, string[]>(allScenarios.map(scenario => [
    scenario.file,
    [...new Set(scenario.steps.flatMap(step => step.contexts.map(context => context.place)))]
  ]))
  const permissionOperation = (
    label: string,
    step: ScenarioStep,
    entry: ScenarioStepEntity,
    unattended: boolean,
    scenarioFile: string
  ): PermissionOperation => ({
    label,
    actorId: step.actor ?? null,
    unattended,
    entityId: entry.entity,
    alias: entry.as ?? null,
    effect: entry.effect ?? 'changes',
    from: entry.from ?? null,
    to: entry.to ?? null,
    facts: entry.facts ?? [],
    contextPlaces: operationPlaces(
      step.contexts.map(context => context.place),
      scenarioPlaces.get(scenarioFile) ?? []
    ),
    goesWith: entry.with !== undefined
  })
  const permissionRules = permissionRuleResources.map(rule => ({
    id: rule.id,
    targets: rule.appliesTo
      .filter((target): target is BusinessRuleEntityTarget => target.type === 'entity')
      .map(permissionTarget),
    grants: (rule.permits ?? []).map(permissionGrant)
  }))
  const selects = (
    target: BusinessRuleEntityTarget,
    entry: ScenarioStepEntity,
    step: ScenarioStep,
    scenarioFile: string,
    ignoreFrom = false
  ): boolean => {
    return permissionTargetSelectsOperation(
      permissionTarget(target),
      permissionOperation('', step, entry, false, scenarioFile),
      ignoreFrom
    )
  }

  /* Two permission Rules with one selector are nearly always alternatives
     written apart — and apart, they AND. */
  const selectorKeys = new Map<string, string>()
  for (const rule of permissionRuleResources) {
    const key = rule.appliesTo
      .map(target => target.type === 'entity'
        ? [target.id, target.effect ?? '', target.from ?? '', target.to ?? '', [...target.facts].sort().join(','), target.contexts.map(context => context.place).sort().join(',')].join('|')
        : '')
      .sort()
      .join('\n')
    const twin = selectorKeys.get(key)
    if (twin) {
      warnings.push(`${rule.file}: selects exactly what ${twin} selects; grants meant as alternatives sit in one Rule, and apart they AND`)
    } else {
      selectorKeys.set(key, rule.file)
    }
  }

  /* The minimal selector is canonical: a narrowing every selected Step already
     satisfies says nothing now and silently exempts a Step added later. */
  for (const rule of permissionRuleResources) {
    for (const [targetIndex, target] of rule.appliesTo.entries()) {
      if (target.type !== 'entity') continue
      const label = `${rule.file}: appliesTo item ${targetIndex + 1}`
      const selected: ScenarioStepEntity[] = []
      const selectedIgnoringFrom: ScenarioStepEntity[] = []
      for (const scenario of allScenarios) {
        for (const step of scenario.steps) {
          for (const entry of step.entities) {
            if (selects(target, entry, step, scenario.file)) selected.push(entry)
            if (selects(target, entry, step, scenario.file, true)) selectedIgnoringFrom.push(entry)
          }
        }
      }
      if (target.from !== undefined && selectedIgnoringFrom.length && selectedIgnoringFrom.every(entry => entry.from === target.from)) {
        warnings.push(`${label}: "from: ${target.from}" is redundant; every Step it could select already leaves from it`)
      }
      for (const [grantIndex, grant] of (rule.permits ?? []).entries()) {
        for (const condition of grant.when) {
          if (condition.state === undefined) continue
          if (selected.length && selected.every(entry => entry.from === condition.state)) {
            warnings.push(`${rule.file}: grant ${grantIndex + 1}: "state: ${condition.state}" is redundant; every selected Step already leaves from it`)
          }
        }
      }
    }
  }

  /*
   * Where the model already decides who may change an Entity, an Actor's
   * change or removal of it that no permission Rule selects is the gap a
   * reader will hit: the Rules say who may edit a Question, and nothing says
   * who may remove one. Creating is left open, since anyone a place admits
   * usually may make their own, and an Entity with no permission Rule at all is
   * a model that has not taken up authorization, which is not lint's call.
   * Reported once per Entity and effect.
   */
  const governedEntities = new Set(permissionRuleResources.flatMap(rule =>
    rule.appliesTo.flatMap(target => target.type === 'entity' && target.effect !== 'reads' ? [target.id] : [])))
  const ungoverned = new Set<string>()
  for (const scenario of allScenarios) {
    for (const [index, step] of scenario.steps.entries()) {
      // A Step attributed to an Actor — a Product Step carrying `actor` — is
      // that Actor's operation for permission purposes, exactly as when the
      // Actor performs it; only unattended Steps, which act for nobody, skip.
      if (!step.actor || step.unattended) continue
      for (const entry of step.entities) {
        const effect = entry.effect ?? 'changes'
        if (effect !== 'changes' && effect !== 'removes') continue
        // A removal that goes with another is permitted by that removal.
        if (entry.with !== undefined) continue
        // An Actor changing its own record (an Owner turning on one of their
        // settings) is that person's own business, not a gap in who may act.
        if (entry.entity === step.actor || !governedEntities.has(entry.entity)) continue
        const key = `${entry.entity}|${effect}`
        if (ungoverned.has(key)) continue
        const governed = permissionRuleResources.some(rule => rule.appliesTo.some(target =>
          target.type === 'entity' && selects(target, entry, step, scenario.file)))
        if (governed) continue
        ungoverned.add(key)
        warnings.push(`${scenario.file}: step ${index + 1}: "${step.actor}" ${effect} "${entry.entity}", which no permission Rule selects, though Rules govern who may change it otherwise; say who may`)
      }
    }
  }

  /*
   * A removal goes `with` the thing that holds it, read from the relation's
   * declared side: the holder declares a one-to-many or one-to-one relation to
   * the held, itself included. One cascade then has one encoding — `comment`
   * with `card`, never `card` with `comment`. Removing a holder and what it
   * holds in one Step with no `with` nearly always hides one.
   */
  const holds = (holder: string, held: string) => (entitiesById.get(holder)?.relations ?? [])
    .some(relation => relation.entity === held && (relation.cardinality === 'one-to-many' || relation.cardinality === 'one-to-one'))
  for (const scenario of allScenarios) {
    for (const [index, step] of scenario.steps.entries()) {
      const label = `${scenario.file}: step ${index + 1}`
      const referenceOf = (entry: ScenarioStepEntity) => entry.as ?? entry.entity
      for (const effect of ['removes', 'creates'] as const) {
        const entries = step.entities.filter(entry => entry.effect === effect)
        const noun = effect === 'removes' ? 'a removal' : 'a creation'
        for (const entry of entries) {
          if (entry.with === undefined) continue
          const target = entries.find(other => referenceOf(other) === entry.with)
          if (target && !holds(target.entity, entry.entity)) {
            errors.push(`${label}: "${referenceOf(entry)}" goes "with" "${entry.with}", but "${target.entity}" declares no one-to-many or one-to-one relation to "${entry.entity}"; ${noun} goes with the thing that holds it${holds(entry.entity, target.entity) ? `, so "${entry.with}" goes "with" "${referenceOf(entry)}"` : ''}`)
          }
        }
        for (const [position, left] of entries.entries()) {
          for (const right of entries.slice(position + 1)) {
            if (left.with !== undefined || right.with !== undefined) continue
            const [holder, held] = holds(left.entity, right.entity) ? [left, right] : holds(right.entity, left.entity) ? [right, left] : []
            if (!holder || !held) continue
            warnings.push(`${label}: ${effect} "${referenceOf(held)}" alongside "${referenceOf(holder)}", which holds it; say "${referenceOf(held)}" goes "with" "${referenceOf(holder)}"`)
          }
        }
      }
    }
  }

  errors.push(...validatePermissionBehavior({
    rules: permissionRules,
    operations: allScenarios.flatMap(scenario => {
      const unattended = scenario.steps[0]?.unattended === true
      return scenario.steps.flatMap((step, index) =>
        step.entities.map(entry => permissionOperation(`${scenario.file}: step ${index + 1}`, step, entry, unattended, scenario.file)))
    }),
    screens: model.screens.map(screen => ({
      label: screen.file,
      id: screen.id,
      containerId: screen.containerId,
      entities: screen.entities.map(entry => ({ entityId: entry.entity, shows: entry.shows, collects: entry.collects })),
      actorIds: [...(supportedActorsForContainer(screen.containerId) ?? [])]
    }))
  }))

  if (model.interfaces.length === 0) errors.push('interfaces/: the model needs at least one interface')
  if (model.capabilities.length === 0) {
    errors.push('capabilities/: the model needs at least one capability')
  }

  const resources = allResources(model)
  /*
    Asset metadata is additive: it titles and describes files that are already
    there, and never sets their class. Class is the path — anything under
    `implementation/` describes this realization — which is the only rule a
    foreign tool writing a capture on CI can actually satisfy.
  */
  for (const resource of resources) {
    const present = new Set(resource.assets)
    for (const asset of resource.assetMeta) {
      if (!present.has(asset.file)) {
        errors.push(`${resource.file}: asset "${asset.file}" is not a file in this resource's expanded folder`)
      }
    }
  }

  const referenceHosts = [{ file: 'product.md', references: model.product.references }, ...resources]
  for (const resource of referenceHosts) {
    const targets = new Set<string>()
    for (const reference of resource.references) {
      if (targets.has(reference.target)) {
        errors.push(`${resource.file}: duplicate reference target "${reference.target}"`)
      }
      targets.add(reference.target)
      const path = repositoryReferencePath(reference)
      if (!path || tracked.has(path)) continue
      if (reference.kind === 'code') {
        errors.push(`${resource.file}: code reference path "${path}" is not a tracked file`)
      } else {
        warnings.push(`${resource.file}: reference target "${reference.target}" does not exist in the repository`)
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
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
      businessRules: model.businessRules.length
    }
  }
}

export function runLint(cwd: string, json: boolean): number {
  let modelRoot: string
  let gitRoot: string | undefined
  try {
    ({ modelRoot, gitRoot } = resolveModelRoot(cwd))
  } catch (error) {
    const message = (error as Error).message
    if (json) {
      console.log(JSON.stringify({ ok: false, errors: [message], warnings: [], counts: {} }, null, 2))
    } else {
      console.error(`error: ${message}`)
    }
    return 1
  }
  const model = loadModel(modelRoot)
  const result = lintModel(model, gitRoot ? lsFiles(gitRoot) : [])
  if (json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    for (const error of result.errors) console.error(`error: ${error}`)
    for (const warning of result.warnings) console.warn(`warning: ${warning}`)
    console.log(result.ok
      ? 'Product Model structure is sound.'
      : `Lint failed with ${result.errors.length} error(s).`)
  }
  return result.ok ? 0 : 1
}
