<script setup lang="ts">
import { destinationForSection, destinationForLocation, graphForCollection, matrixForCollection, collectionKindFor } from '../utils/reportDestinations'
import { adjacentAlternatives, collapseVariations, variationsByOwner } from '../utils/variations'
import { resourceNavigationKey, resourceOpenerKey, type ResourceOpenOptions } from '../utils/resourceNavigation'
import { referenceNavigationKey, localReferenceHref } from '../utils/referenceNavigation'
import type { TopologyReading } from '../utils/topologyState'
import { defaultTopologyReading } from '../utils/topologyState'
import { collectionRelation, pruneRelationSelections } from '../utils/collectionRelations'
import type {
  AnyResourceView,
  ReportResourceKind,
  ReportWorkspace
} from '../utils/reportWorkspace'
import {
  ENTITY_KIND_META,
  REPORT_ENTITY_KINDS,
  entityFacetOf,
  resolveResource,
  resolveResourceKey
} from '../utils/reportWorkspace'
import type { FacetSelections } from '../utils/resourceFacets'
import {
  resourcesOfKind,
  collectionGroups,
  facetKindsFor,
  filterResources,
  hasSelections
} from '../utils/resourceFacets'
import { TREE_CARD_KINDS, TREE_KIND_CHOICES, hiddenTreeKinds, treeCards, treeBranchKeys } from '../utils/collectionChildren'
import type { ColumnChoice } from '../composables/useColumns'
import { KIND_TERM } from '../utils/vocabulary'
import type { VocabularySlug } from '../utils/vocabulary.generated'
import { firstSentence } from '../utils/reportMarkdown'
import type { ReportProductCatalogLink, ReportProductLink } from '../utils/reportProducts'
import { defaultCoverageReading, type CoverageReading } from '../utils/coverageState'

const props = withDefaults(defineProps<{
  workspace: ReportWorkspace
  logoSrc?: string | null
  products?: ReportProductLink[]
  productCatalog?: ReportProductCatalogLink
  sidebarVocabulary?: boolean
  toolsTarget?: string
}>(), { sidebarVocabulary: true })

/* ------------------------------------------------------------------ */
/* Selection: `activeKind` is what the collection view is about, and */
/* `openResource` is inspected over that working view.                   */
/* ------------------------------------------------------------------ */

type ReportSection = 'overview' | ReportResourceKind

const section = defineModel<string>('section', { default: 'overview' })

const openResource = defineModel<string | null>('resource', { default: null })

const pageTab = defineModel<string>('tab', { default: 'overview' })
const resourceTab = defineModel<string>('resourceTab', { default: 'overview' })
const scenarioRoute = defineModel<string | null>('scenarioRoute', { default: null })
const routeColumns = defineModel<string>('routeColumns', { default: 'auto' })
const coverage = defineModel<CoverageReading>('coverage', { default: defaultCoverageReading })
const topology = defineModel<TopologyReading>('topology', { default: defaultTopologyReading })

const activeKind = ref<ReportResourceKind>('product')
const activeSection = ref<ReportSection>('overview')

const KNOWN_SECTIONS = new Set<string>(['overview', ...REPORT_ENTITY_KINDS.map(meta => meta.kind)])

/* Two-way, but never fighting: each side only writes when the value differs. */
watch(section, (value) => {
  if (value === activeSection.value) return
  const known = (KNOWN_SECTIONS.has(value) ? value : 'overview') as ReportSection
  const next = known === 'overview' ? known : collectionKindFor(known as ReportResourceKind)
  activeSection.value = next
  activeKind.value = next === 'overview' ? 'product' : next as ReportResourceKind
}, { immediate: true })

watch(activeSection, (value) => {
  if (section.value !== value) section.value = value
})
/* One resource's neighbourhood, drawn on the topology canvas rather than in a
   page that cannot give the graph the full report width. */
const searchOpen = ref(false)

const vocabulary = useVocabularyPanel()
const mobileNavOpen = ref(false)
const mobileNavId = useId()
const sidebarId = useId()
const sidebarCollapsed = ref(false)
let afterNavigationClose: (() => void) | undefined

/* Finish closing the drawer before opening another modal and moving focus. */
function openSidebarTool(action: () => void) {
  if (!mobileNavOpen.value) { action(); return }
  afterNavigationClose = action
  mobileNavOpen.value = false
}
function finishNavigationClose() {
  const action = afterNavigationClose
  afterNavigationClose = undefined
  action?.()
}
function openVocabulary(originId: string) {
  const returnId = mobileNavOpen.value ? mobileNavId : originId
  openSidebarTool(() => vocabulary.show(undefined, returnId))
}
/* Clicks and direct links select the same resource reading. */
const openPageKey = openResource

/* Filter state is kept per kind: moving to another kind and back returns to
   the narrowing you left, which is the point of a persistent working view.
   Nothing else is kept, because nothing else is configurable — the reading and
   its grouping are decided by the report, not auditioned on every visit. */
const facetState = reactive<Partial<Record<ReportResourceKind, FacetSelections>>>({})
const collectionSelections = reactive<Partial<Record<ReportResourceKind, string[]>>>({})
const relationSelections = reactive<Partial<Record<ReportResourceKind, string[]>>>({})
const closedGroups = ref<string[]>([])
/* Rows open to their children on request and stay open for the session, keyed
   by collection and resource so a Screen open under one Interface is not open
   under another. */
/* Tree cards remember which nodes the reader opened, per card. */
const treeExpansion = ref<Record<string, string[]>>({})
const collectionStateReady = ref(false)
const collectionStorageKey = () => `pdd-kit:collections:${location.pathname}:${props.workspace.identity.id}`

function pruneFacets() {
  for (const kind of Object.keys(relationSelections) as ReportResourceKind[]) {
    const relation = collectionRelation(props.workspace, kind)
    relationSelections[kind] = relation ? pruneRelationSelections(relation.source, relationSelections[kind] ?? []) : []
  }
  for (const kind of Object.keys(collectionSelections) as ReportResourceKind[]) {
    collectionSelections[kind] = collectionSelections[kind]?.filter(key => props.workspace.byKey.get(key)?.kind === kind)
  }
  for (const kind of Object.keys(facetState) as ReportResourceKind[]) {
    for (const facet of Object.keys(facetState[kind] ?? {}) as ReportResourceKind[]) {
      const ids = facetState[kind]![facet] ?? []
      const valid = facetKindsFor(props.workspace, kind).includes(facet) ? ids.filter(id => resolveResource(props.workspace, facet, id)) : []
      if (ids.length !== valid.length) facetState[kind]![facet] = valid
    }
  }
}

function restoreCollectionState() {
  collectionStateReady.value = false
  for (const key of Object.keys(facetState)) delete (facetState as Record<string, unknown>)[key]
  for (const kind of Object.keys(collectionSelections) as ReportResourceKind[]) delete collectionSelections[kind]
  for (const kind of Object.keys(relationSelections) as ReportResourceKind[]) delete relationSelections[kind]
  closedGroups.value = []
  treeExpansion.value = {}
  try {
    const saved = JSON.parse(sessionStorage.getItem(collectionStorageKey()) ?? 'null')
    if (saved) {
      for (const { kind } of REPORT_ENTITY_KINDS) {
        if (Array.isArray(saved.relations?.[kind])) relationSelections[kind] = saved.relations[kind].filter((key: unknown): key is string => typeof key === 'string')
        if (Array.isArray(saved.selections?.[kind])) collectionSelections[kind] = saved.selections[kind].filter((key: unknown): key is string => typeof key === 'string')
        for (const facet of facetKindsFor(props.workspace, kind)) {
          const ids = saved.facets?.[kind]?.[facet]
          if (Array.isArray(ids)) {
            facetState[kind] ??= {}
            facetState[kind]![facet] = ids.filter((id: unknown): id is string => typeof id === 'string')
          }
        }
      }
      if (Array.isArray(saved.closed)) closedGroups.value = saved.closed.filter((id: unknown) => typeof id === 'string')
      if (saved.trees && typeof saved.trees === 'object') {
        treeExpansion.value = Object.fromEntries(Object.entries(saved.trees as Record<string, unknown>)
          .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(item => typeof item === 'string')))
      }
    }
  } catch { /* Collections remain usable when storage is unavailable. */ }
  pruneFacets()
  collectionStateReady.value = true
}

onMounted(restoreCollectionState)
watch(() => props.workspace.identity.id, () => { if (collectionStateReady.value) restoreCollectionState() })
watch(() => props.workspace, pruneFacets)
watch([facetState, collectionSelections, relationSelections, closedGroups, treeExpansion], () => {
  if (!collectionStateReady.value) return
  try { sessionStorage.setItem(collectionStorageKey(), JSON.stringify({ facets: facetState, selections: collectionSelections, relations: relationSelections, closed: closedGroups.value, trees: treeExpansion.value })) } catch { /* Optional persistence. */ }
}, { deep: true })

const collectionGroupKey = (key: string) => `${activeKind.value}:${key}`
function setCollectionGroupOpen(key: string, open: boolean) {
  const id = collectionGroupKey(key)
  closedGroups.value = [...closedGroups.value.filter(item => item !== id), ...(!open ? [id] : [])]
}

/* Domains and Interfaces draw as tree cards; Capabilities and Journeys as rows
   that expand to their Scenarios. */
const treeCardsShown = computed(() => TREE_CARD_KINDS.includes(activeKind.value))
const closedCards = computed(() => closedGroups.value
  .filter(id => id.startsWith(`${activeKind.value}:`)).map(id => id.slice(activeKind.value.length + 1)))
const cardExpansion = computed(() => Object.fromEntries(Object.entries(treeExpansion.value)
  .filter(([id]) => id.startsWith(`${activeKind.value}:`)).map(([id, values]) => [id.slice(activeKind.value.length + 1), values])))
function setCardExpansion(key: string, values: string[]) {
  treeExpansion.value = { ...treeExpansion.value, [`${activeKind.value}:${key}`]: values }
}

const activeMeta = computed(() => ENTITY_KIND_META[activeKind.value])

const kindCounts = computed<Record<ReportResourceKind, number>>(() => ({
  product: 1,
  interface: props.workspace.counts.interfaces,
  experience: props.workspace.counts.experiences,
  screen: props.workspace.counts.screens,
  domain: props.workspace.counts.domains,
  entity: props.workspace.counts.entities,
  capability: props.workspace.counts.capabilities,
  journey: props.workspace.counts.journeys,
  'capability-scenario': props.workspace.counts.capabilityScenarios,
  'journey-scenario': props.workspace.counts.journeyScenarios,
  rule: props.workspace.counts.rules,
  variation: props.workspace.counts.variations
}))

const facets = computed<FacetSelections>(() => facetState[activeKind.value] ?? {})
const selectedRows = computed({
  get: () => collectionSelections[activeKind.value] ?? [],
  set: (keys: string[]) => { collectionSelections[activeKind.value] = keys }
})
const selectedRelations = computed({
  get: () => relationSelections[activeKind.value] ?? [],
  set: (keys: string[]) => { relationSelections[activeKind.value] = keys }
})
const relationView = useReportMatrixView(() => props.workspace, activeKind, selectedRelations)
const relationRowKeys = computed(() => relationView.value ? new Set(relationView.value.matrix.rows.map(row => row.key)) : null)
const filtersActive = computed(() => hasSelections(facets.value) || selectedRows.value.length > 0 || selectedRelations.value.length > 0)

function facetValues(kind: ReportResourceKind): string[] {
  return facets.value[kind] ?? []
}

function setFacet(kind: ReportResourceKind, ids: string[]) {
  facetState[activeKind.value] = { ...facets.value, [kind]: ids }
}

function clearFacets() {
  selectedRows.value = []
  selectedRelations.value = []
  facetState[activeKind.value] = {}
}

/** Only kinds this collection's own rows print, and only if the model has any. */
const facetKinds = computed(() => facetKindsFor(props.workspace, activeKind.value)
  .filter(kind => resourcesOfKind(props.workspace, kind).length))

/* An option carries its resource: a filter list reads like the collection it
   narrows, so an Actor keeps its silhouette and a Web Interface its globe. */
function facetOptions(kind: ReportResourceKind) {
  return resourcesOfKind(props.workspace, kind).map(resource => ({
    label: resource.title,
    value: resource.id,
    facet: entityFacetOf(resource),
    acts: resource.kind === 'entity' ? resource.acts ?? undefined : undefined,
    interfaceType: resource.kind === 'interface' ? resource.interfaceType : undefined
  }))
}

/*
  A collection offers every axis it has, always.

  A size threshold made two reports of the same renderer differ for no reason
  the reader could see: a five-Entity product had no filters and a sixteen-Entity
  one did, and nothing on either screen said why. An axis that exists is an axis
  the reader can narrow by; the only reason not to draw a control is that there
  is nothing behind it.
*/
const filtersOffered = computed(() => facetKinds.value.length > 0 || Boolean(collectionMatrix.value && kindResources.value.length))

/** Each selected value has its own way out, including multiple values on one axis. */
const facetChips = computed(() => facetKinds.value
  .flatMap((kind) => {
    const meta = ENTITY_KIND_META[kind]
    return facetValues(kind).map((id) => {
      const resource = resolveResource(props.workspace, kind, id)
      return {
        key: `${kind}:${id}`,
        kind,
        facet: resource ? entityFacetOf(resource) : null,
        acts: resource?.kind === 'entity' ? resource.acts ?? undefined : undefined,
        interfaceType: resource?.kind === 'interface' ? resource.interfaceType : undefined,
        label: meta.label,
        value: resource?.title ?? id
      }
    })
  }))

const kindResources = computed<AnyResourceView[]>(() => resourcesOfKind(props.workspace, activeKind.value))

/** What every surface shows: the rows, and the counts beside the heading. */
const visibleResources = computed(() => filterResources(kindResources.value, facets.value)
  .filter(resource => (!selectedRows.value.length || selectedRows.value.includes(resource.key))
    && (!relationRowKeys.value || relationRowKeys.value.has(resource.key))))

/* Grouping is a property of the collection, not a control on it. */
const resourceGroups = computed(() => collectionGroups(props.workspace, activeKind.value, visibleResources.value))
const grouped = computed(() => resourceGroups.value.some(group => group.kind))

const multiGroupCount = computed(() => {
  const memberships = new Map<string, number>()
  for (const group of resourceGroups.value) {
    for (const resource of group.resources) memberships.set(resource.key, (memberships.get(resource.key) ?? 0) + 1)
  }
  return [...memberships.values()].filter(count => count > 1).length
})

const multiGroupNote = computed(() => {
  const count = multiGroupCount.value
  if (!count) return ''
  const subject = count === 1 ? activeMeta.value.label : activeMeta.value.plural
  return `${count} ${subject} ${count === 1 ? 'relates' : 'relate'} to more than one `
    + `Domain and ${count === 1 ? 'appears' : 'appear'} under each.`
})

const openPage = computed<AnyResourceView | null>(() => openPageKey.value
  ? resolveResourceKey(props.workspace, openPageKey.value) ?? null
  : null)

/* The resource is inspected over the working view; it never selects a rail row. */
const navigation = inject(resourceNavigationKey, null)
const referenceNavigation = inject(referenceNavigationKey, null)
const reference = referenceNavigation?.current ?? ref<string | null>(null)
const localReferenceTrail = ref<Array<string | null>>([])
const previousReference = referenceNavigation?.previous ?? computed(() => localReferenceTrail.value.at(-1) ?? null)
function openReference(href: string) {
  const target = localReferenceHref(href)
  if (!target || target === reference.value) return
  if (!openResource.value && !reference.value) returnFocus.value = document.activeElement as HTMLElement | null
  if (referenceNavigation) referenceNavigation.open(target)
  else { localReferenceTrail.value.push(reference.value); reference.value = target }
}
function backReference() {
  if (referenceNavigation) referenceNavigation.back()
  else reference.value = localReferenceTrail.value.pop() ?? null
}
provide(referenceNavigationKey, {
  current: reference, previous: previousReference,
  href: href => referenceNavigation?.href(href) ?? href,
  open: openReference, back: backReference
})
const returnFocus = shallowRef<HTMLElement | null>(null)
const workingHeading = useTemplateRef('workingHeading')
const localTrail = ref<Array<{ key: string, tab: string }>>([])
const previousResource = computed(() => {
  const key = navigation ? navigation.previous.value?.resource : localTrail.value.at(-1)?.key
  return key ? resolveResourceKey(props.workspace, key) : null
})
function backResource() {
  if (navigation) { navigation.back(); return }
  const previous = localTrail.value.pop()
  if (previous) { openResource.value = previous.key; resourceTab.value = previous.tab }
}
/* Live recompiles replace the projection. Rehydrate selection by stable key so
   focus, filters, and the open page survive ordinary model edits. */
watch([() => props.workspace, openResource], ([workspace]) => {
  if (openResource.value && !workspace.byKey.has(openResource.value)) leavePage()
}, { immediate: true })

const destination = computed(() => destinationForLocation(activeSection.value, pageTab.value))
const topologyActive = computed(() => Boolean(destination.value))
/* The collection's Graph, when it has one. Absent, not disabled, when it does
   not: the switch appears only where a second drawing exists. */
const collectionGraph = computed(() => activeKind.value === 'product' ? undefined : graphForCollection(activeKind.value))
const collectionMatrix = computed(() => matrixForCollection(activeKind.value))
const drawing = computed<'rows' | 'graph' | 'matrix'>(() => collectionMatrix.value && pageTab.value === 'matrix' ? 'matrix'
  : collectionGraph.value && pageTab.value === 'graph' ? 'graph' : 'rows')
const vocabularyContext = computed(() => {
  if (openPage.value) return KIND_TERM[openPage.value.kind]
  return KIND_TERM[activeKind.value]
})
/**
 * What this surface is, named once.
 *
 * The heading is the destination the reader chose: a rail row and the heading it
 * opens say the same word, so Overview heads its page `Overview` exactly as
 * Entities heads its page `Entities`.
 *
 * Beside it sits the qualifier that says what you are looking at — a count for a
 * collection, a type for a resource, and for the Overview the resource type it
 * presents. That type is `Product`. `Product Report` named the rendered artifact
 * rather than anything the model authors, and put a view, an artifact and a type
 * in one line while the tooltip defined a fourth thing.
 */
const surfaceHeading = computed(() => {
  if (activeKind.value === 'product') {
    const meta = ENTITY_KIND_META.product
    return { icon: meta.icon, slot: meta.slot, title: 'Overview', meta: meta.label,
      term: KIND_TERM.product, termText: meta.label }
  }
  const shown = visibleResources.value.length
  const all = kindResources.value.length
  return { icon: activeMeta.value.icon, slot: activeMeta.value.slot, title: activeMeta.value.plural,
    meta: shown === all ? String(all) : `${shown} / ${all}`,
    term: KIND_TERM[activeKind.value], termText: activeMeta.value.plural }
})

// Preserve collection order (Actors first, then authored Domains) without
// duplicating a Rule that belongs to more than one Domain; a Variation's
// alternatives sit side by side at the first one's place.
const matrixRows = computed(() => adjacentAlternatives([...new Map(resourceGroups.value.flatMap(group => group.resources)
  .map(resource => [resource.key, resource])).values()]))
const matrixView = computed(() => {
  const relation = relationView.value
  if (!relation) return undefined
  const keys = new Set(matrixRows.value.map(row => row.key))
  return { ...relation, matrix: { ...relation.matrix, rows: matrixRows.value, cells: relation.matrix.cells.filter(cell => keys.has(cell.row)) } }
})

/**
 * Tabs belong to the Overview and to resource pages, where they change which
 * set is on screen. A collection has no tabs: its drawings show one set,
 * and the switch between them sits beside the filters that narrow it.
 *
 * The Product's own readings are tabs. They were four collapsed disclosures
 * stacked below the identity — a reader had to open each one to learn whether it
 * held anything.
 */
const PRODUCT_TABS = [
  { id: 'coverage', label: 'Coverage' },
  { id: 'references', label: 'References' }
]

const surfaceTabs = computed(() => activeKind.value !== 'product' ? [] : [
  { id: 'overview', label: 'About' },
  ...PRODUCT_TABS
])
const activeSurfaceTab = computed(() => {
  if (destination.value) return destination.value.mode
  return surfaceTabs.value.some(tab => tab.id === pageTab.value) ? pageTab.value : 'overview'
})

/* One bar for all drawings: a filter narrows the set, and the set is what
   every drawing shows. The bar exists when there is something to narrow by or
   a second drawing to switch to. */
const showToolbar = computed(() => activeKind.value !== 'product'
  && (filtersOffered.value || Boolean(collectionGraph.value)))

/* Focus is a narrowing only the Graph can express — one resource and what
   touches it — so it is a chip there, and leaving for Rows lets it go. */
const focusChips = computed(() => drawing.value !== 'graph' ? [] : topology.value.focus.map((key) => {
  const resource = props.workspace.byKey.get(key)
  return { key: `focus:${key}`, label: 'Focus', value: resource?.title ?? key, kind: resource?.kind,
    facet: resource ? entityFacetOf(resource) : null,
    acts: resource?.kind === 'entity' ? resource.acts ?? undefined : undefined,
    interfaceType: resource?.kind === 'interface' ? resource.interfaceType : undefined }
}))
const selectionChips = computed(() => selectedRows.value.map(key => {
  const resource = props.workspace.byKey.get(key)
  return { key: `selection:${key}`, label: activeMeta.value.label, value: resource?.title ?? key, kind: activeKind.value }
}))
const relationChips = computed(() => selectedRelations.value.map(key => {
  const resource = props.workspace.byKey.get(key)
  const kind = key.startsWith('type:') ? key.slice(5) as ReportResourceKind : resource?.kind
  return { key: `relation:${key}`, label: relationView.value?.label ?? '',
    value: resource?.title ?? (kind ? `Any ${ENTITY_KIND_META[kind].label}` : key), kind,
    facet: resource ? entityFacetOf(resource) : null,
    acts: resource?.kind === 'entity' ? resource.acts : undefined,
    interfaceType: resource?.kind === 'interface' ? resource.interfaceType : undefined }
}))
/* The resource types a tree card collection leaves undrawn: a drawing choice,
   kept per collection, and a chip while any is hidden so none is hidden silently. */
const { hiddenFor, setHidden } = useHiddenKinds()
const kindsOf = computed(() => treeCardsShown.value && TREE_KIND_CHOICES[activeKind.value] ? activeKind.value : undefined)
const hiddenKinds = computed(() => kindsOf.value ? hiddenFor(kindsOf.value) : [])
const hiddenKindSet = computed(() => kindsOf.value ? hiddenTreeKinds(kindsOf.value, hiddenKinds.value) : new Set<ReportResourceKind>())
const hiddenChips = computed(() => hiddenKindSet.value.size ? [{ key: 'hidden-kinds', label: 'Hidden', drawing: true,
  value: (TREE_KIND_CHOICES[activeKind.value] ?? []).filter(choice => hiddenKindSet.value.has(choice.kind)).map(choice => ENTITY_KIND_META[choice.kind].plural).join(', ') }] : [])
const toolbarChips = computed(() => [...selectionChips.value, ...facetChips.value, ...relationChips.value, ...focusChips.value, ...hiddenChips.value])
function removeChip(key: string) {
  if (key === 'hidden-kinds') return setHidden(activeKind.value, [])
  if (key.startsWith('selection:')) selectedRows.value = selectedRows.value.filter(item => `selection:${item}` !== key)
  else if (key.startsWith('relation:')) selectedRelations.value = selectedRelations.value.filter(item => `relation:${item}` !== key)
  else if (key.startsWith('focus:')) topology.value = { ...topology.value, focus: topology.value.focus.filter(item => `focus:${item}` !== key) }
  else {
    const kind = facetKinds.value.find(kind => key.startsWith(`${kind}:`))
    if (kind) setFacet(kind, facetValues(kind).filter(id => `${kind}:${id}` !== key))
  }
}
function clearToolbar() {
  if (kindsOf.value) setHidden(kindsOf.value, [])
  clearFacets()
  if (drawing.value === 'graph') topology.value = { ...topology.value, focus: [] }
}
/** The keys the filters left in the set: what every drawing shows. */
const visibleKeys = computed(() => visibleResources.value.map(resource => resource.key))

/* Row density is the reader's, per collection, and only for Rows: a graph has
   no columns to count. */
const { columnsFor, setColumns } = useColumns()
/* Rows start one per line; tree cards start three abreast, as the Domain map did. */
const columns = computed(() => columnsFor(activeKind.value, treeCardsShown.value ? 3 : 1))
const rowGrid = computed(() => columns.value > 1
  ? { display: 'grid', gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`, gap: '0.5rem', alignItems: 'start' }
  : undefined)
/* Expand all and collapse all act on whatever this collection opens: its
   Domain groups, and the trees inside its cards. */
const expandsAnything = computed(() => grouped.value || treeCardsShown.value)
function toggleAllRows(open: boolean) {
  const prefix = `${activeKind.value}:`
  if (grouped.value) {
    const keys = resourceGroups.value.map(group => collectionGroupKey(group.key))
    closedGroups.value = [...closedGroups.value.filter(id => !id.startsWith(prefix)), ...(open ? [] : keys)]
  }
  if (treeCardsShown.value) {
    const cards = treeCards(props.workspace, activeKind.value, visibleResources.value, filtersActive.value, hiddenKindSet.value)
    /* The card itself opens and closes with everything inside it. */
    closedGroups.value = [...closedGroups.value.filter(id => !id.startsWith(prefix)), ...(open ? [] : cards.map(card => `${prefix}${card.key}`))]
    const next = { ...treeExpansion.value }
    for (const card of cards) {
      next[`${prefix}${card.key}`] = open ? treeBranchKeys(card.children) : []
    }
    treeExpansion.value = next
  }
}

/* Tree cards keep their own gap; only the column count is the reader's. */
const cardGrid = computed(() => ({ gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))` }))

// Drawing-specific focus and column choices survive switching drawings.
const drawingReadings = new Map<string, TopologyReading>()
function rememberDrawing() {
  if (drawing.value !== 'rows') drawingReadings.set(`${props.workspace.identity.id}:${activeKind.value}:${drawing.value}`, { ...topology.value })
}
function setDrawing(next: 'rows' | 'graph' | 'matrix') {
  if (next === drawing.value) return
  const target = next === 'matrix' ? collectionMatrix.value : collectionGraph.value
  rememberDrawing()
  leavePage()
  if (next !== 'rows' && target) {
    topology.value = { ...(drawingReadings.get(`${props.workspace.identity.id}:${activeKind.value}:${next}`) ?? defaultTopologyReading()), view: target.view }
    pageTab.value = next
    return
  }
  topology.value = { ...defaultTopologyReading(), expanded: topology.value.expanded, collapsed: topology.value.collapsed }
  pageTab.value = 'overview'
}


const pageReadingKey = computed(() => JSON.stringify([props.workspace.identity.id, activeSection.value, pageTab.value, topology.value.expanded, topology.value.collapsed]))
const { element: resourcePane, save: savePageScroll, restore: restorePageScroll } = useReportTopologyScroll(pageReadingKey)

/* Close clears only inspection state. The working view keeps its reading. */
function leavePage() {
  reference.value = null
  localReferenceTrail.value = []
  openResource.value = null
  resourceTab.value = 'overview'
  scenarioRoute.value = null
  routeColumns.value = 'auto'
  localTrail.value = []
}

function setKind(kind: ReportResourceKind) {
  rememberDrawing()
  mobileNavOpen.value = false
  kind = collectionKindFor(kind)
  topology.value = { ...topology.value, focus: [] }
  activeKind.value = kind
  activeSection.value = kind === 'product' ? 'overview' : kind
  pageTab.value = 'overview'
  leavePage()
}

function openView(sectionId: string, resource?: AnyResourceView) {
  const target = destinationForSection(sectionId)
  if (!target) return
  mobileNavOpen.value = false
  rememberDrawing()
  leavePage()
  if (target.mode === 'matrix' && resource) {
    facetState[target.rail] = {}
    collectionSelections[target.rail] = resource.kind === target.rail ? [resource.key] : []
    relationSelections[target.rail] = resource.kind !== target.rail ? [resource.key] : []
  }
  topology.value = { ...defaultTopologyReading(), view: target.view, hiddenKinds: [], query: '', focus: resource && target.mode !== 'matrix' ? [resource.key] : [], column: null }
  activeSection.value = target.rail
  activeKind.value = target.rail
  pageTab.value = target.mode
}

/** Resolve a key from an overview projection and open its page. */
function openResourceKey(key: string, tab = 'overview') {
  const resource = resolveResourceKey(props.workspace, key)
  if (resource) {
    openResourcePage(resource)
    resourceTab.value = tab
  }
}

/** Inspection preserves the working view, including a graph's drawing and focus. */
function openResourcePage(resource: AnyResourceView, tab = 'overview', options: ResourceOpenOptions = {}) {
  reference.value = null
  localReferenceTrail.value = []
  if (resource.key === openResource.value) {
    if (tab !== 'overview') resourceTab.value = tab
    return
  }
  mobileNavOpen.value = false
  if (!openResource.value) returnFocus.value = document.activeElement as HTMLElement | null
  else if (options.replace) navigation?.replace?.()
  else if (!navigation) localTrail.value.push({ key: openResource.value, tab: resourceTab.value })
  openResource.value = resource.key
  resourceTab.value = tab
  scenarioRoute.value = null
  routeColumns.value = 'auto'
}
provide(resourceOpenerKey, (key, tab, options) => {
  const resource = resolveResourceKey(props.workspace, key)
  if (resource) openResourcePage(resource, tab, options)
})

function openSurfaceTab(id: string) {
  mobileNavOpen.value = false
  leavePage()
  pageTab.value = id
}

/** The Entity behind an Actors group header, for its silhouette. */
function resolvedGroupEntity(kind: ReportResourceKind | null, id: string) {
  if (kind !== 'entity' || !id) return undefined
  const resource = resolveResource(props.workspace, 'entity', id)
  return resource?.kind === 'entity' ? resource : undefined
}

/** Search inspects a resource over the current working view. */
function onSearchSelect(resource: AnyResourceView) {
  openResourcePage(resource)
}

/** Scenarios whose Journey is not in the model would otherwise be unreachable. */
const orphanScenarios = computed(() => props.workspace.scenarios
  .filter(scenario => scenario.scenarioType === 'journey'
    && !resolveResource(props.workspace, 'journey', scenario.journeyId)))
</script>

<template>
  <div class="report-shell flex h-full min-h-0 flex-col text-sm">
    <Teleport v-if="toolsTarget" :to="toolsTarget">
      <ReportTools in-header @search="searchOpen = true" @vocabulary="openVocabulary" />
    </Teleport>

    <UDashboardGroup storage="local" storage-key="pdd-kit-report" :storage-options="{ initOnMounted: true }" unit="px" class="relative min-h-0 flex-1">
      <UDashboardSidebar
        :id="sidebarId"
        v-model:collapsed="sidebarCollapsed"
        collapsible
        :default-size="288"
        :collapsed-size="64"
        :toggle="false"
        aria-label="Report navigation"
        :ui="{ root: 'min-h-0', body: 'min-h-0 gap-0 overflow-hidden p-0' }"
      >
        <template #default="{ collapsed }">
          <ReportSidebar
            :workspace="workspace"
            :logo-src="logoSrc"
            :products="products"
            :product-catalog="productCatalog"
            :vocabulary="sidebarVocabulary"
            :collapsed="collapsed"
            :active-section="activeSection"
            :counts="kindCounts"
            :tools="!toolsTarget"
            @kind="setKind"
            @search="openSidebarTool(() => searchOpen = true)"
            @vocabulary="openVocabulary"
            @navigate="mobileNavOpen = false"
          >
            <template v-if="$slots['sidebar-header']" #brand><slot name="sidebar-header" :collapsed="collapsed" /></template>
            <template v-if="$slots['sidebar-footer']" #footer><slot name="sidebar-footer" :collapsed="collapsed" /></template>
            <template v-if="$slots.navigation" #navigation><slot name="navigation" :collapsed="collapsed" /></template>
          </ReportSidebar>
        </template>
      </UDashboardSidebar>

      <!-- CENTER: the working view for the active kind -->
      <section class="flex min-w-0 flex-1 flex-col">
        <!-- The working view's header owns report status and stays above its
             scrolling reading. On narrow screens, status gets its own line. -->
        <header
          v-if="surfaceHeading"
          data-report-page-header
          class="mb-2 grid shrink-0 grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-default px-4 py-2 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div class="flex min-w-0 items-center gap-2 sm:gap-3">
            <UDashboardSidebarCollapse
              size="sm"
              :aria-expanded="!sidebarCollapsed"
              :aria-controls="`pdd-kit-report-sidebar-${sidebarId}`"
            />
            <UButton
              icon="i-lucide-menu"
              color="neutral"
              variant="ghost"
              size="sm"
              class="lg:hidden"
              :id="mobileNavId"
              aria-label="Open report navigation"
              @click="mobileNavOpen = true"
            />
            <h1 v-if="surfaceHeading" ref="workingHeading" tabindex="-1" class="flex min-w-0 flex-1 items-center gap-2">
              <UIcon :name="surfaceHeading.icon" class="size-5 shrink-0 text-muted" :style="surfaceHeading.slot === undefined ? undefined : { color: `var(--report-slot-${surfaceHeading.slot})` }" />
              <span class="truncate text-lg font-semibold tracking-tight text-highlighted">{{ surfaceHeading.title }}</span>
              <span class="report-meta shrink-0">{{ surfaceHeading.meta }}</span>
              <ReportTerm v-if="surfaceHeading.term" :slug="surfaceHeading.term" :text="surfaceHeading.termText" icon-only />
            </h1>
          </div>
          <div data-report-status class="row-start-2 flex items-center gap-2.5 md:col-start-2 md:row-start-1">
            <slot v-if="$slots.status" name="status" />
            <time v-else class="report-meta" :datetime="workspace.identity.generatedAt" :title="`Generated ${workspace.identity.generatedAt}`">{{ workspace.identity.generatedAt.slice(0, 10) }}</time>
          </div>
        </header>

        <!-- Both kinds of reading switch sit outside the scroll pane, on the
             page's own background. Resource controls remain owned by the page. -->
        <ReportPageTabs
          v-if="surfaceTabs.length > 1"
          :model-value="activeSurfaceTab"
          :items="surfaceTabs"
          :label="`${activeMeta.plural} readings`"
          class="shrink-0 px-5"
          @update:model-value="openSurfaceTab"
        />

        <!-- Collection filters and the count stay the same in every drawing. -->
        <div v-if="showToolbar" class="shrink-0 px-4 pt-2 sm:px-5 sm:pt-3" data-collection-toolbar>
          <ReportFilterBar
            :key="activeKind"
            :chips="toolbarChips"
            :filters-offered="filtersOffered"
            @remove="removeChip"
            @clear="clearToolbar"
          >
            <template #default="{ inSheet }">
              <ReportMatrixResourceFilter v-if="collectionMatrix && kindResources.length" v-model="selectedRows"
                :label="activeMeta.plural" :kind="activeKind" :resources="kindResources" :in-sheet="inSheet" />
              <USelectMenu
                v-for="kind in facetKinds"
                :key="kind"
                :model-value="facetValues(kind)"
                :items="facetOptions(kind)"
                value-key="value"
                multiple
                size="sm"
                variant="outline"
                :class="inSheet ? 'w-full' : 'min-w-44'"
                :ui="{ content: 'report-filter-menu', item: 'py-2' }"
                :virtualize="facetOptions(kind).length > 100"
                :search-input="{ placeholder: `Find a ${ENTITY_KIND_META[kind].label.toLowerCase()}…` }"
                :aria-label="`Filter by ${ENTITY_KIND_META[kind].plural}`"
                @update:model-value="setFacet(kind, $event as string[])"
              >
                <template #leading>
                  <UIcon
                    :name="ENTITY_KIND_META[kind].icon"
                    class="size-4 shrink-0"
                    :style="{ color: `var(--report-slot-${ENTITY_KIND_META[kind].slot})` }"
                  />
                </template>
                <template #default>
                  <span class="truncate">{{ ENTITY_KIND_META[kind].plural }}</span>
                  <span v-if="facetValues(kind).length" class="report-meta">({{ facetValues(kind).length }})</span>
                </template>
                <!-- The control above says `Interfaces`, so a row need not
                     repeat the plug: its slot goes to the type instead. -->
                <template #item-leading="{ item }">
                  <ReportKind
                    :kind="kind"
                    :interface-type="item.interfaceType"
                    :facet="item.facet"
                    :acts="item.acts"
                    :labelled="false"
                    :with-kind="false"
                    size="xs"
                  />
                </template>
              </USelectMenu>
              <ReportRelationFilter v-if="relationView?.source.columns.length" v-model="selectedRelations"
                :label="relationView.label" :kind="activeKind === 'entity' ? 'capability' : undefined" :resources="relationView.source.columns" :grouped="activeKind === 'rule' || activeKind === 'capability'" :show-parents="activeKind === 'capability'" :in-sheet="inSheet" />
            </template>
            <template v-if="collectionGraph || drawing === 'rows'" #end>
              <ReportCollectionControls :kind="activeKind" :drawing="drawing" :columns="columns" :expands-anything="expandsAnything"
                :kinds-of="kindsOf" :hidden-kinds="hiddenKinds"
                @drawing="setDrawing" @columns="setColumns(activeKind, $event)" @toggle-all="toggleAllRows" @hidden-kinds="kindsOf && setHidden(kindsOf, $event)" />
            </template>
          </ReportFilterBar>
        </div>

        <!-- Rows, a resource page, or the Overview: a scrolling reading. -->
        <div v-if="!topologyActive" ref="resourcePane" class="report-pane min-h-0 flex-1" @scroll.capture.passive="savePageScroll">
          <div class="p-5">

          <!-- OVERVIEW: the Product, and what it promises -->
          <ReportOverview
            v-model:coverage="coverage"
            v-if="activeKind === 'product'"
            :workspace="workspace"
            :logo-src="logoSrc"
            :tab="activeSurfaceTab"
            @select="openResourcePage"
            @select-key="openResourceKey"
          >
            <template v-if="$slots['primary-action']" #primary-action>
              <slot name="primary-action" />
            </template>
            <template v-if="$slots.provenance" #provenance>
              <slot name="provenance" />
            </template>
          </ReportOverview>

          <!-- COLLECTION SURFACE: one named subject, one row shape. -->
          <div v-else :class="grouped ? 'space-y-3' : 'space-y-6'">
            <p v-if="multiGroupNote" class="text-xs text-dimmed">{{ multiGroupNote }}</p>
            <!-- Domains and Interfaces: one tree card per subject. -->
            <div v-if="treeCardsShown" class="report-tree-cards" :style="cardGrid" data-collection-rows>
              <ReportTreeCards
                :workspace="workspace"
                :kind="activeKind"
                :resources="visibleResources"
                :narrowed="filtersActive"
                :closed="closedCards"
                :expansion="cardExpansion"
                :highlight="facets.capability ?? []"
                :hidden="hiddenKindSet"
                @open="openResourcePage"
                @close="(key, closed) => setCollectionGroupOpen(key, !closed)"
                @expand="setCardExpansion"
              />
            </div>
            <UCollapsible
              v-for="group in treeCardsShown ? [] : resourceGroups"
              :key="group.key || 'all'"
              :open="!grouped || !closedGroups.includes(collectionGroupKey(group.key))"
              @update:open="setCollectionGroupOpen(group.key, $event)"
              :disabled="!grouped"
              :class="grouped && 'overflow-hidden rounded-xl border border-default bg-elevated/20'"
            >
              <template v-if="grouped" #default="{ open }">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="lg"
                  block
                  data-group-header
                  class="w-full justify-start rounded-none px-3 py-2 text-start"
                >
                  <ReportKind
                    v-if="group.kind"
                    :kind="group.kind"
                    :facet="entityFacetOf(resolvedGroupEntity(group.kind, group.key))"
                    :acts="resolvedGroupEntity(group.kind, group.key)?.acts"
                    :labelled="false"
                    size="sm"
                  />
                  <UIcon v-else name="i-lucide-minus" class="size-3.5 shrink-0 text-dimmed" />
                  <span
                    class="min-w-0 truncate text-sm font-semibold tracking-tight"
                    :class="group.kind ? 'text-highlighted' : 'text-muted'"
                  >
                    {{ group.title }}
                  </span>
                  <span class="report-meta ms-auto">{{ group.resources.length }}</span>
                  <UIcon
                    name="i-lucide-chevron-down"
                    class="size-3.5 shrink-0 text-dimmed transition-transform"
                    :class="open && 'rotate-180'"
                  />
                </UButton>
              </template>

              <!-- Padding and the divider sit inside the animated content, not
                   on it: the height animation reaches zero, and padding on the
                   element itself would hold the box open until it unmounts. -->
              <template #content>
                <div class="space-y-2" :class="grouped && 'border-t border-muted p-2'">
                  <!-- Alternatives that meet in a group read as their set: one row, picked from its picker.
                       A Scenario set sits under the Capability or Journey that owns its Scenarios. -->
                  <template v-for="part in variationsByOwner(workspace, collapseVariations(workspace, group.resources))" :key="part.owner?.key ?? ''">
                    <p v-if="part.owner" class="flex min-w-0 items-center gap-2 px-1 pt-1 text-sm font-medium" data-variation-owner>
                      <ReportKind :kind="part.owner.kind" :labelled="false" size="xs" class="shrink-0" />
                      <ReportResourceLink :resource-key="part.owner.key" class="min-w-0 truncate text-highlighted underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4 hover:decoration-current" @open="openResourcePage(part.owner)">{{ part.owner.title }}</ReportResourceLink>
                    </p>
                    <div class="space-y-2" :class="part.owner && 'ms-2.5 border-s border-accented ps-3'" :style="rowGrid" data-collection-rows>
                      <ReportResourceCard
                        v-for="resource in part.resources"
                        :key="resource.key"
                        :workspace="workspace"
                        :resource="resource"
                        :badge="group.kind !== 'domain'"
                        :stacked="columns > 1"
                        @open="openResourcePage"
                      />
                    </div>
                  </template>
                </div>
              </template>
            </UCollapsible>

            <!-- A dead end names its own way out. -->
            <div v-if="!visibleResources.length" class="flex flex-wrap items-center gap-3">
              <p class="text-sm text-muted italic">
                <template v-if="filtersActive">Nothing matches the current filters.</template>
                <template v-else>This model declares no {{ activeMeta.plural.toLowerCase() }}.</template>
              </p>
              <UButton
                v-if="filtersActive"
                icon="i-lucide-filter-x"
                color="neutral"
                variant="outline"
                size="sm"
                label="Clear filters"
                @click="clearFacets"
              />
            </div>

            <section v-if="activeKind === 'journey-scenario' && orphanScenarios.length" class="space-y-1 border-t border-default pt-4">
              <p class="report-field">Scenarios whose Journey is not in the model</p>
              <button
                v-for="scenario in orphanScenarios"
                :key="scenario.id"
                type="button"
                class="block text-start text-sm text-muted hover:text-primary"
                @click="openResourcePage(scenario)"
              >
                {{ scenario.title }} — declares journey “{{ scenario.journeyId }}”.
              </button>
            </section>
          </div>
          </div>
        </div>

        <!-- GRAPH: the collection's second drawing of the same set. -->
        <div v-else-if="drawing === 'graph' && collectionGraph" class="min-h-0 flex-1">
          <ReportCollectionGraph
            v-model:reading="topology"
            :workspace="workspace"
            :kind="activeKind"
            :view="collectionGraph.view"
            :visible-keys="visibleKeys"
            :narrowed="filtersActive"
            @select="openResourcePage"
            @product="setKind('product')"
          />
        </div>

        <!-- MATRIX: the shared relationship scope selects subjects and columns. -->
        <div v-else class="min-h-0 flex-1">
          <ReportProductTopology v-if="matrixView"
            :workspace="workspace"
            :matrix-view="matrixView"
            v-model:reading="topology"
            @select="openResourcePage"
          />
        </div>
      </section>

    </UDashboardGroup>

    <ReportResourceSlideover
      v-model:tab="resourceTab"
      v-model:scenario-route="scenarioRoute"
      v-model:route-columns="routeColumns"
      :workspace="workspace"
      :resource="openPage"
      :reference="reference"
      :previous-reference="previousReference"
      :previous="previousResource"
      :return-focus="returnFocus"
      :fallback-focus="workingHeading"
      @open="openResourcePage"
      @back="backResource"
      @reference-back="backReference"
      @reference-open="openReference"
      @close="leavePage"
      @view="openView"
    />

    <ReportSearchPalette
      v-model:open="searchOpen"
      :workspace="workspace"
      @select="onSearchSelect"
      @page="setKind"
    />

    <ReportVocabulary :context="vocabularyContext" tooltips />

    <USlideover
      v-model:open="mobileNavOpen"
      title="Report navigation"
      description="Report sections, search, vocabulary and viewer settings."
      side="left"
      :ui="{ content: 'w-72 max-w-[90vw]' }"
      @after:leave="finishNavigationClose"
    >
      <template #content>
        <ReportSidebar
          class="report-shell"
          :workspace="workspace"
          :logo-src="logoSrc"
          :products="products"
          :product-catalog="productCatalog"
          :vocabulary="sidebarVocabulary"
          :active-section="activeSection"
          :counts="kindCounts"
          tools
          @kind="setKind"
          @search="openSidebarTool(() => searchOpen = true)"
          @vocabulary="openVocabulary"
          @navigate="mobileNavOpen = false"
        >
          <template v-if="$slots['sidebar-header']" #brand><slot name="sidebar-header" :collapsed="false" /></template>
          <template #close>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              class="ms-auto min-h-8 min-w-8 shrink-0 self-start"
              aria-label="Close report navigation"
              @click="mobileNavOpen = false"
            />
          </template>
          <template v-if="$slots['sidebar-footer']" #footer><slot name="sidebar-footer" :collapsed="false" /></template>
          <template v-if="$slots.navigation" #navigation><slot name="navigation" :collapsed="false" /></template>
        </ReportSidebar>
      </template>
    </USlideover>
  </div>
</template>
