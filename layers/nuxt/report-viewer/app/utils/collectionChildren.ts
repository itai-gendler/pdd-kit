/**
 * What a tree card holds.
 *
 * A card is one Interface, Interface Variation or Domain; its children are the
 * resources the model files under it, in the model's own order. Nothing here
 * derives a relation the
 * projection does not already hold: an Interface's Experiences and Screens are
 * its containment, a Domain's Capabilities and Entities are its classification.
 * Every other collection lists plain rows; a Capability's or Journey's
 * Scenarios are read on its page.
 */
import type { AnyResourceView, ExperienceView, InterfaceView, ReportResourceKind, ReportWorkspace, RuleView, ScreenView } from './reportWorkspace'
import { ENTITY_KIND_META } from './reportWorkspace'
import { interfaceProjection } from './topologyProjections'
import { entityOperation, ruleAttachments } from './topologyTargets'
import { resourceAncestors } from './reportDestinations'
import type { TopologyBranch } from './topologyProjections'
import { absentAlternatives, placeDelivery, placeJourneys, type Place } from './placeReadings'

export interface RowChild {
  resource: AnyResourceView
  children: RowChild[]
}

/** The collections drawn as one tree card per subject. */
export const TREE_CARD_KINDS: ReportResourceKind[] = ['interface', 'domain']

/**
 * A resource type a tree card collection can stop drawing. A container's rows
 * give way to what they held; any other type's rows go with what sits under
 * them, so a dependent type hides with its parent.
 */
export interface TreeKindChoice {
  kind: ReportResourceKind
  contains?: boolean
  parent?: ReportResourceKind
}

/** The types each tree card collection draws, in rail order. The card's own subject is always drawn. */
export const TREE_KIND_CHOICES: Partial<Record<ReportResourceKind, TreeKindChoice[]>> = {
  interface: [
    { kind: 'experience', contains: true },
    { kind: 'screen', contains: true },
    { kind: 'capability' },
    { kind: 'capability-scenario', parent: 'capability' },
    { kind: 'journey' },
    { kind: 'journey-scenario', parent: 'journey' }
  ],
  domain: [{ kind: 'capability' }, { kind: 'entity' }]
}

/** Ready-made choices: what each hides. */
export const TREE_KIND_PRESETS: Partial<Record<ReportResourceKind, { id: string, label: string, hidden: ReportResourceKind[] }[]>> = {
  interface: [
    { id: 'everything', label: 'Everything', hidden: [] },
    { id: 'places', label: 'Places only', hidden: ['capability', 'capability-scenario', 'journey', 'journey-scenario'] },
    { id: 'delivery', label: 'Screens and Capabilities', hidden: ['capability-scenario', 'journey', 'journey-scenario'] }
  ]
}

/** The types a collection actually leaves out: a choice it offers, or one whose parent it leaves out. */
export function hiddenTreeKinds(collection: ReportResourceKind, hidden: readonly ReportResourceKind[]): Set<ReportResourceKind> {
  const choices = TREE_KIND_CHOICES[collection] ?? []
  const out = new Set(choices.filter(choice => hidden.includes(choice.kind)).map(choice => choice.kind))
  for (const choice of choices) if (choice.parent && out.has(choice.parent)) out.add(choice.kind)
  return out
}

/**
 * Draw only the types not hidden. A hidden container's rows give way to what
 * they held, each lifted row noting the container it came from; any other
 * hidden type's rows go with everything under them. A group of a hidden type
 * goes the same way, a group left empty goes, and every group counts only what
 * is still drawn, so a closed row's summary names only what opening it finds.
 */
export function visibleTreeNodes(nodes: TreeCardNode[], hidden: ReadonlySet<ReportResourceKind>, collection: ReportResourceKind, from?: string): TreeCardNode[] {
  const contains = (kind: ReportResourceKind) => Boolean(TREE_KIND_CHOICES[collection]?.find(choice => choice.kind === kind)?.contains)
  return nodes.flatMap((node): TreeCardNode[] => {
    if (node.groupKind) {
      if (hidden.has(node.groupKind)) return contains(node.groupKind) ? visibleTreeNodes(node.children, hidden, collection, from) : []
      const children = visibleTreeNodes(node.children, hidden, collection, from)
      return children.length ? [{ ...node, children, count: concrete(children) }] : []
    }
    const kind = node.resource?.kind
    /* A Variation's node names a set; it stays while any of its alternatives is drawn. */
    if (kind === 'variation') {
      const children = visibleTreeNodes(node.children, hidden, collection, from)
      return children.length ? [{ ...node, children }] : []
    }
    if (kind && hidden.has(kind)) return contains(kind) ? visibleTreeNodes(node.children, hidden, collection, node.title) : []
    return [{ ...node, note: node.note ?? from, children: visibleTreeNodes(node.children, hidden, collection) }]
  })
}

export interface TreeCardNode {
  id: string
  title: string
  resource?: AnyResourceView
  groupKind?: ReportResourceKind
  /** An available Screen reference, not a child owned by this reading. */
  sharedFrom?: AnyResourceView
  /** A short qualifier under the title, e.g. the Journey a Journey Scenario belongs to. */
  note?: string
  /** An alternative drawn under its own Variation node: the node already names the set. */
  inSet?: boolean
  /** A Variation node's place: where its alternatives are read as here or not. */
  place?: Place
  /** An alternative of this node's set that does not happen at its place: drawn struck, with no children. */
  absentFrom?: Place
  /** A group's concrete resources: a Variation node counts its alternatives, never itself. */
  count?: number
  children: TreeCardNode[]
}

export interface TreeCard {
  key: string
  title: string
  resource?: AnyResourceView
  children: TreeCardNode[]
}

const leaf = (resource: AnyResourceView, children: TreeCardNode[] = []): TreeCardNode => ({ id: resource.key, title: resource.title, resource, children })
const concrete = (nodes: TreeCardNode[]): number => nodes.reduce((total, node) => total + (node.resource?.kind === 'variation' ? node.children.filter(child => !child.absentFrom).length : 1), 0)
const group = (id: string, kind: ReportResourceKind, children: TreeCardNode[]): TreeCardNode => ({ id, title: ENTITY_KIND_META[kind].plural, groupKind: kind, count: concrete(children), children })

/**
 * In a tree an alternative always sits under its Variation's node, named by its
 * own title: the node names the set, and its children are the alternatives
 * found here, in their first one's place. At a place, an alternative that
 * happens nowhere in its branch follows them struck, with no children; one
 * delivered on a place nested inside is simply not drawn at this level. A place holding one
 * alternative still reads as a choice; the node's picker says where it does
 * happen. The set node is membership, not containment: each alternative keeps
 * its own children, and counts never include a struck one.
 */
export function foldVariations(workspace: ReportWorkspace, parentId: string, nodes: TreeCardNode[], place?: Place): TreeCardNode[] {
  const sets = new Map<string, TreeCardNode>()
  const folded = nodes.flatMap((node) => {
    const key = node.resource?.variation?.key
    const set = key ? workspace.byKey.get(key) : undefined
    if (!key || set?.kind !== 'variation') return [node]
    const existing = sets.get(key)
    if (existing) {
      existing.children.push({ ...node, inSet: true })
      return []
    }
    const holder: TreeCardNode = { id: `${parentId}>${key}`, title: set.title, resource: set, place, children: [{ ...node, inSet: true }] }
    sets.set(key, holder)
    return [holder]
  })
  if (place) {
    for (const holder of sets.values()) {
      const set = holder.resource
      if (set?.kind !== 'variation') continue
      const absent = absentAlternatives(workspace, set, new Set(holder.children.map(child => child.resource?.key)), place)
      holder.children.push(...absent.map(alternative => ({ id: `${holder.id}>${alternative.key}`, title: alternative.title, resource: alternative, inSet: true, absentFrom: place, children: [] })))
    }
  }
  return folded
}

/** The Screens a container holds. */
export function ownedScreens(workspace: ReportWorkspace, owner: AnyResourceView): ScreenView[] {
  return workspace.screens.filter(screen => screen.contexts.some(context =>
    owner.kind === 'experience' ? context.experienceId === owner.id : context.interfaceId === owner.id && !context.experienceId))
}

/**
 * What happens at a place, as items in its own branch. First what it
 * delivers: a Screen's own Capabilities; an Experience's or Interface's,
 * with Steps placed exactly there or available there and on no Screen of its
 * own. The branch says which by where the rows sit —
 * beside the place's Screens, never under one — so no group repeats it.
 * Under each Capability sit its own Scenarios
 * with a Step placed exactly on this place. Then the Journeys passing through:
 * a Journey Scenario belongs to its Journey, not to a Capability its Steps
 * use, so it sits under its Journey, and each appears once. All are occurrences, so an id is the path of keys.
 */
function deliveryLeaves(workspace: ReportWorkspace, place: InterfaceView | ExperienceView | ScreenView): TreeCardNode[] {
  const delivered = placeDelivery(workspace, place)
  /* Alternatives delivered at one place meet here, so they fold under their set like any siblings. */
  const leaves = foldVariations(workspace, place.key, delivered.map(({ capability, scenarios }) => {
    const id = `${place.key}>${capability.key}`
    return { ...leaf(capability, foldVariations(workspace, id, scenarios.map(scenario => ({ ...leaf(scenario), id: `${id}>${scenario.key}` })), place)), id }
  }), place)
  const journeys = foldVariations(workspace, place.key, placeJourneys(workspace, place).map(({ journey, scenarios }) => {
    const id = `${place.key}>${journey.key}`
    return { ...leaf(journey, foldVariations(workspace, id, scenarios.map(({ scenario }) => ({ ...leaf(scenario), id: `${id}>${scenario.key}` })), place)), id }
  }), place)
  return [...leaves, ...journeys]
}

/** One hierarchy for collection cards and focused containment readings. */
export function structureChildren(workspace: ReportWorkspace, resource: AnyResourceView): TreeCardNode[] {
  const screenLeaf = (screen: ScreenView): TreeCardNode => leaf(screen, deliveryLeaves(workspace, screen))
  const screensOf = (owner: AnyResourceView) => ownedScreens(workspace, owner)
  const screenGroup = (owner: Place) => group(`${owner.key}:screens`, 'screen', foldVariations(workspace, `${owner.key}:screens`, screensOf(owner).map(screenLeaf), owner))
  if (resource.kind === 'interface') {
    const experiences = workspace.experiences.filter(item => item.interfaceIds.includes(resource.id))
    const screens = screenGroup(resource)
    if (experiences.length) screens.title = 'Shared Screens'
    return [
      group(`${resource.key}:experiences`, 'experience', foldVariations(workspace, `${resource.key}:experiences`, experiences.map(experience => leaf(experience, [...deliveryLeaves(workspace, experience), ...[screenGroup(experience)].filter(node => node.children.length)])), resource)),
      screens
    ].filter(node => node.children.length).concat(deliveryLeaves(workspace, resource))
  }
  if (resource.kind === 'experience') {
    /* Shared Screens fold like the Experience's own: alternatives sit under their set node. */
    const shared = foldVariations(workspace, `${resource.key}:shared-screens`, workspace.interfaces.filter(iface => resource.interfaceIds.includes(iface.id)).flatMap(iface =>
      screensOf(iface).map(screen => ({ ...screenLeaf(screen), sharedFrom: iface }))), resource)
    return [...deliveryLeaves(workspace, resource), ...[screenGroup(resource), { ...group(`${resource.key}:shared-screens`, 'screen', shared), title: 'Shared Screens' }].filter(node => node.children.length)]
  }
  /* A Screen's own branch, as it sits in its container's tree. */
  if (resource.kind === 'screen') return screenLeaf(resource).children
  return []
}

/**
 * What a Business Rule applies to, as a tree: its targets grouped by kind in
 * rail order. A target holds only the places the Rule itself names — the
 * Contexts it narrows the target to, each noted with where it sits because
 * places repeat titles across Interfaces. A target the Rule does not narrow is
 * noted "Every supported Context" and holds nothing: those places are the
 * target's, read on its own page, where the Rule is listed too. An Entity
 * target notes its operation; a Context target is the place itself. Every
 * edge drawn here is read at its other end (see `attachedRules`).
 */
export function ruleScope(workspace: ReportWorkspace, rule: RuleView): TreeCardNode[] {
  const targets = ruleAttachments(workspace, rule).map(({ id, resource, target, contexts: narrowed }): TreeCardNode => {
    if (target.type === 'context') return { ...leaf(resource), id, note: 'Everything done here' }
    const where = narrowed.length
      ? `Only in ${narrowed.length} ${narrowed.length === 1 ? 'place' : 'places'}`
      : target.type === 'entity' ? '' : 'Every supported Context'
    const note = [target.type === 'entity' ? entityOperation(target) : '', where].filter(Boolean).join(' · ')
    const placeLeaf = (place: AnyResourceView): TreeCardNode => {
      const within = resourceAncestors(workspace, place).map(item => item.title).join(' · ')
      return { ...leaf(place), id: `${id}>${place.key}`, ...(within ? { note: within } : {}) }
    }
    return { ...leaf(resource, narrowed.map(placeLeaf)), id, ...(note ? { note } : {}) }
  })
  return KIND_ORDER.flatMap((kind) => {
    const members = targets.filter(node => node.resource?.kind === kind)
    return members.length ? [group(`${rule.key}:${kind}`, kind, members)] : []
  })
}

export interface InsideCount {
  kind: ReportResourceKind
  count: number
}

const KIND_ORDER = Object.keys(ENTITY_KIND_META) as ReportResourceKind[]

/**
 * What opening a closed row would find: the distinct resources anywhere below
 * it, counted by kind in rail order. It is navigation, never the row's own
 * meaning, so a row draws it only while closed. A resource filed twice below —
 * a Capability exposed on two Screens — counts once. A group already counts
 * its own kind, so its summary names only what lies deeper.
 */
export function insideSummary(node: TreeCardNode): InsideCount[] {
  const found = new Map<ReportResourceKind, Set<string>>()
  const walk = (child: TreeCardNode) => {
    /* A struck alternative is not here, so it is never something found below. */
    if (child.absentFrom) return
    const resource = child.resource
    /* A Variation node is membership, not something found below: only its alternatives count. */
    if (resource && resource.kind !== node.groupKind && resource.kind !== 'variation') found.set(resource.kind, (found.get(resource.kind) ?? new Set()).add(resource.key))
    child.children.forEach(walk)
  }
  node.children.forEach(walk)
  return KIND_ORDER.flatMap(kind => found.has(kind) ? [{ kind, count: found.get(kind)!.size }] : [])
}

/** The summary read aloud, as the expand control's label carries it. */
export function insideLabel(summary: InsideCount[]): string {
  return summary.map(({ kind, count }) => `${count} ${count === 1 ? ENTITY_KIND_META[kind].label : ENTITY_KIND_META[kind].plural}`).join(', ')
}

/** The same compact expansion defaults wherever a hierarchy is read. Scenarios start folded, under a Capability or a Journey alike. */
export function treeBranchKeys(nodes: TreeCardNode[], defaults = false): string[] {
  return nodes.flatMap(node => [
    ...(node.children.length && (!defaults || (node.children.length <= 8 && node.resource?.kind !== 'capability' && node.resource?.kind !== 'journey')) ? [node.id] : []),
    ...treeBranchKeys(node.children, defaults)
  ])
}

/**
 * A Domain card groups its Capabilities and its Entities; an Interface card its
 * Experiences, each with its Screens, and the Screens it holds directly. The
 * Domain grid ends with what no Domain claims, unless a filter narrowed it.
 */
export function treeCards(workspace: ReportWorkspace, kind: ReportResourceKind, resources: AnyResourceView[], narrowed: boolean, hidden?: ReadonlySet<ReportResourceKind>): TreeCard[] {
  const cards = allTreeCards(workspace, kind, resources, narrowed)
  return hidden?.size ? cards.map(card => ({ ...card, children: visibleTreeNodes(card.children, hidden, kind) })) : cards
}

function allTreeCards(workspace: ReportWorkspace, kind: ReportResourceKind, resources: AnyResourceView[], narrowed: boolean): TreeCard[] {
  if (kind === 'domain') {
    const domainCard = (key: string, title: string, capabilities: AnyResourceView[], entities: AnyResourceView[], resource?: AnyResourceView): TreeCard => ({
      key, title, resource,
      children: [
        group(`${key}:capabilities`, 'capability', foldVariations(workspace, `${key}:capabilities`, capabilities.map(item => leaf(item)))),
        group(`${key}:entities`, 'entity', foldVariations(workspace, `${key}:entities`, entities.map(item => leaf(item))))
      ].filter(group => group.children.length)
    })
    const cards = resources.filter(item => item.kind === 'domain').map(domain => domainCard(domain.key, domain.title,
      workspace.capabilities.filter(item => item.domainId === domain.id), workspace.entities.filter(item => item.domainId === domain.id), domain))
    const unassigned = domainCard('unassigned', 'Unassigned', workspace.capabilities.filter(item => !item.domainId), workspace.entities.filter(item => !item.domainId))
    return [...cards, ...(!narrowed && unassigned.children.length ? [unassigned] : [])]
  }
  if (kind === 'interface') {
    const roots = resources.filter(item => item.kind === 'interface').map(iface => leaf(iface, structureChildren(workspace, iface)))
    return foldVariations(workspace, 'interfaces', roots).map(node => ({
      key: node.resource!.key, title: node.title, resource: node.resource, children: node.children
    }))
  }
  return []
}

/** New set roots retain each alternative's previously saved card expansion. */
export function treeCardExpanded(card: TreeCard, closed: readonly string[], expansion: Readonly<Record<string, string[]>>): string[] {
  const saved = expansion[card.key]
  const children = saved ?? (card.resource?.kind === 'variation'
    ? card.children.flatMap(child => [
      ...(closed.includes(child.id) ? [] : [child.id]),
      ...(expansion[child.id] ?? treeBranchKeys(child.children, true))
    ])
    : treeBranchKeys(card.children, true))
  return [...new Set([...(closed.includes(card.key) ? [] : [card.key]), ...children])]
}

const fromBranch = (branch: TopologyBranch): RowChild[] => branch.children
  .flatMap(child => child.resource ? [{ resource: child.resource, children: fromBranch(child) }] : fromBranch(child))

export function rowChildren(workspace: ReportWorkspace, resource: AnyResourceView): RowChild[] {
  switch (resource.kind) {
    case 'interface': {
      const branch = interfaceProjection(workspace).find(item => item.id === resource.key)
      return branch ? fromBranch(branch) : []
    }
    case 'domain':
      return [
        ...workspace.capabilities.filter(item => item.domainId === resource.id),
        ...workspace.entities.filter(item => item.domainId === resource.id)
      ].map(item => ({ resource: item, children: [] }))
    default:
      return []
  }
}
