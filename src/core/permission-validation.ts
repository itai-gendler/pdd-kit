import { containsPlace } from './ids.js'

export type PermissionEffect = 'creates' | 'changes' | 'removes' | 'reads'

/** One Entity selector, normalized across the folder and Product Report forms. */
export interface PermissionTarget {
  entityId: string
  effect: PermissionEffect | null
  from: string | null
  to: string | null
  facts: string[]
  contextPlaces: string[]
}

/** Only the parts of a grant that structural validation can resolve statically. */
export interface PermissionGrant {
  actorIds: string[]
  relatedActorId: string | null
  self: boolean
  unattended: boolean
  stateConditions: string[]
}

export interface PermissionRule {
  id: string
  targets: PermissionTarget[]
  /** Empty means the selected operations are forbidden to everyone. */
  grants: PermissionGrant[]
}

export interface PermissionOperation {
  label: string
  actorId: string | null
  unattended: boolean
  entityId: string
  alias: string | null
  effect: PermissionEffect
  from: string | null
  to: string | null
  /** The facts the Step cites on this Entity; empty when it cites none. */
  facts: string[]
  contextPlaces: string[]
  /** A removal that goes with another removal of its Step; that one needs the permission. */
  goesWith: boolean
}

/** Named facts a Screen discloses or collects; both lists are empty for a bare Entity. */
export interface PermissionScreenEntity {
  entityId: string
  shows: string[]
  collects: string[]
}

export interface PermissionScreen {
  label: string
  id: string
  containerId: string
  entities: PermissionScreenEntity[]
  actorIds: string[]
}

export interface PermissionBehavior {
  rules: PermissionRule[]
  operations: PermissionOperation[]
  screens: PermissionScreen[]
}

/** Nothing about an operation, its instance, or its states is left to guess. */
export function describePermissionOperation(operation: PermissionOperation): string {
  const name = operation.alias ? `${operation.entityId} (${operation.alias})` : operation.entityId
  if (operation.effect === 'reads') return `reads "${name}"`
  if (operation.effect === 'creates') return `creates "${name}"${operation.to ? ` as ${operation.to}` : ''}`
  if (operation.effect === 'removes') return `removes "${name}"${operation.from ? ` from ${operation.from}` : ''}`
  if (operation.from && operation.to) return `moves "${name}" from ${operation.from} to ${operation.to}`
  return `changes "${name}"`
}

/**
 * The places an operation occurs in.
 *
 * A Step that omits `contexts` is shared by every route of its Scenario, which
 * puts it inside that Scenario's places — not nowhere. Reading it as nowhere
 * would let a place-scoped Rule be sidestepped by deleting a key, and an
 * authorization claim that a deletion can escape is not a claim.
 */
export function operationPlaces(stepPlaces: string[], scenarioPlaces: string[]): string[] {
  return stepPlaces.length ? stepPlaces : scenarioPlaces
}

function operationInPlaces(operation: PermissionOperation, selectors: string[]): boolean {
  return !selectors.length || operation.contextPlaces.some(place =>
    selectors.some(selector => containsPlace(selector, place)))
}

/**
 * The shared selector algebra used by validation and lint's canonicality warnings.
 *
 * A fact-scoped target selects a Step only where the Step cites one of those
 * facts: a Step that names the Entity without facts makes no claim about any
 * fact, and what a Screen shows is the Screen's own claim, checked below.
 */
export function permissionTargetSelectsOperation(
  target: PermissionTarget,
  operation: PermissionOperation,
  ignoreFrom = false
): boolean {
  if (target.entityId !== operation.entityId) return false
  /* A removal that goes with another is permitted by the removal it goes
     with, so a Rule on this Entity's removal never selects it. */
  if (operation.goesWith) return false
  if (target.facts.length && !target.facts.some(fact => operation.facts.includes(fact))) return false
  if (target.effect !== null && target.effect !== operation.effect) return false
  if (!ignoreFrom && target.from !== null && target.from !== operation.from) return false
  if (target.to !== null && target.to !== operation.to) return false
  return operationInPlaces(operation, target.contextPlaces)
}

function grantCanPermitOperation(
  grant: PermissionGrant,
  operation: PermissionOperation,
  targetId: string
): boolean {
  const stateHolds = grant.stateConditions.every(state => operation.from === null || state === operation.from)
  if (operation.unattended) {
    return operation.actorId === null && grant.unattended
      && !grant.actorIds.length && grant.relatedActorId === null && !grant.self && stateHolds
  }
  if (grant.unattended || operation.actorId === null) return false
  if (grant.actorIds.length && !grant.actorIds.includes(operation.actorId)) return false
  if (grant.relatedActorId !== null && grant.relatedActorId !== operation.actorId) return false
  if (grant.self && operation.actorId !== targetId) return false
  return stateHolds
}

function targetSelectsScreen(target: PermissionTarget, entity: PermissionScreenEntity, screenId: string): boolean {
  // A read carries no state, so a target that selects by `from` or `to` is
  // about a state move and can never govern what a Screen presents. A
  // fact-scoped target governs a Screen only where the Screen says it shows
  // that fact, so it never selects a bare entry, which names no fact; an
  // Entity-wide read still does. An entry that only collects presents nothing.
  if (target.entityId !== entity.entityId) return false
  if (!entity.shows.length && entity.collects.length) return false
  if (target.facts.length && (!target.facts.some(fact => entity.shows.includes(fact)))) return false
  return (target.effect === null || target.effect === 'reads')
    && target.from === null
    && target.to === null
    && (!target.contextPlaces.length || target.contextPlaces.some(place => containsPlace(place, screenId)))
}

function grantCanPermitScreen(grant: PermissionGrant, actorId: string, entityId: string): boolean {
  return !grant.unattended
    && (!grant.actorIds.length || grant.actorIds.includes(actorId))
    && (grant.relatedActorId === null || grant.relatedActorId === actorId)
    && (!grant.self || actorId === entityId)
}

/**
 * Apply permission Rules to the Steps and Screens they govern.
 *
 * Every matching Rule is visited independently, preserving AND across Rules;
 * any grant of one Rule may permit, preserving OR within that Rule.
 */
export function validatePermissionBehavior(behavior: PermissionBehavior): string[] {
  const issues: string[] = []

  for (const operation of behavior.operations) {
    if (operation.unattended && operation.actorId !== null) {
      issues.push(`${operation.label}: an unattended operation names no actor`)
      continue
    }
    const described = describePermissionOperation(operation)
    for (const rule of behavior.rules) {
      const targets = rule.targets.filter(target => permissionTargetSelectsOperation(target, operation))
      if (!targets.length) continue
      if (!rule.grants.length) {
        issues.push(`${operation.label}: ${described}, which rule "${rule.id}" forbids to everyone`)
        continue
      }
      if (!operation.unattended && operation.actorId === null) {
        issues.push(`${operation.label}: ${described}, which rule "${rule.id}" governs, so it needs an actor`)
        continue
      }
      if (!rule.grants.some(grant => grantCanPermitOperation(grant, operation, targets[0]!.entityId))) {
        issues.push(operation.unattended
          ? `${operation.label}: ${described} unattended, and rule "${rule.id}" has no "unattended" grant for it`
          : `${operation.label}: actor "${operation.actorId}" ${described}, and no grant of rule "${rule.id}" can permit it`)
      }
    }
  }

  for (const screen of behavior.screens) {
    for (const entity of screen.entities) {
      for (const rule of behavior.rules) {
        const targets = rule.targets.filter(target => targetSelectsScreen(target, entity, screen.id))
        if (!targets.length) continue
        const governed = targets.flatMap(target => target.facts).filter(fact => entity.shows.includes(fact))
        const what = governed.length ? `"${entity.entityId}" facts "${[...new Set(governed)].join('", "')}"` : `"${entity.entityId}"`
        if (!rule.grants.length) {
          issues.push(`${screen.label}: presents ${what}, which rule "${rule.id}" forbids anyone to read`)
          continue
        }
        const permitted = screen.actorIds.some(actorId =>
          rule.grants.some(grant => grantCanPermitScreen(grant, actorId, entity.entityId)))
        if (!permitted) {
          issues.push(`${screen.label}: presents ${what}, and no actor of "${screen.containerId}" has a grant to read it in rule "${rule.id}"`)
        }
      }
    }
  }

  return issues
}
