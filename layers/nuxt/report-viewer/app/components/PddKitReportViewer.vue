<script setup lang="ts">
provide('pdd-kit:viewer', useId())
import { defaultCoverageReading, type CoverageReading } from '../utils/coverageState'
import type { TopologyReading } from '../utils/topologyState'
import { defaultTopologyReading } from '../utils/topologyState'
import { destinationForLocation } from '../utils/reportDestinations'
/**
 * The public entry point every host renders.
 *
 * Hosts differ in what surrounds a report, not in how a report reads: the
 * local CLI viewer wraps it in dev chrome, the catalog wraps it in site
 * navigation and a pull command. Those differences arrive as slots and a
 * bindable section, so the Product Report stays one implementation.
 */
import type { ProductReport } from 'pdd-toolkit/report'
import { projectReportWorkspace } from '../utils/reportWorkspace'
import type { ReportProductCatalogLink, ReportProductLink } from '../utils/reportProducts'
import { RESOURCE_NOTICES, type ReportResourceNotice } from '../utils/resourceNotices'
import { REPORT_COMPARISON, REPORT_COMPARISON_SWITCH, buildComparisonContext, type ReportComparisonInput } from '../utils/reportComparison'

const props = withDefaults(defineProps<{
  report: ProductReport
  /** Host-resolved `product-model/product/logo.svg`; used in the picker and Overview. */
  logoSrc?: string | null
  /** Other products available in this host; mark the current destination active. */
  products?: ReportProductLink[]
  /** Optional link below the product choices to the host's full catalog. */
  productCatalog?: ReportProductCatalogLink
  /** Set false when the host already provides Vocabulary in its header. */
  sidebarVocabulary?: boolean
  /** Mounted host-header element receiving the report's search and Vocabulary controls. */
  toolsTarget?: string
  /**
   * Host notices shown at the top of a resource's reading, keyed by resource
   * key. The report renders them as given; what they say is the host's.
   */
  resourceNotices?: Record<string, ReportResourceNotice>
  /**
   * Another state of the same model to compare with, such as a Git baseline.
   * Present, the header names it in a chip the reader can turn off, and while
   * it is on the report marks what changed where it is drawn; the comparison
   * itself is computed here, from `report`, so it follows every recompile.
   */
  comparison?: ReportComparisonInput | null
}>(), { sidebarVocabulary: true, resourceNotices: () => ({}), comparison: null })
provide(RESOURCE_NOTICES, toRef(props, 'resourceNotices'))
/* On by default; the reader's choice is a display preference, like row density. */
const comparing = usePddKitStoredPreference<boolean>('pdd-kit:changes', () => true, value => typeof value === 'boolean' ? value : undefined)
provide(REPORT_COMPARISON_SWITCH, { input: toRef(props, 'comparison'), enabled: comparing })
provide(REPORT_COMPARISON, computed(() => props.comparison && comparing.value ? buildComparisonContext(props.comparison, props.report) : null))

/**
 * The open section: `overview` or a main resource collection. Bindable so a
 * host can keep it in the URL.
 */
const section = defineModel<string>('section', { default: 'overview' })

/**
 * The resource whose slideover is open, by stable key, or `null` for the section's own
 * surface. Bindable for the same reason: a host that keeps both in the URL gets
 * deep links, a working back button, and a refresh that lands where it left.
 */
const resource = defineModel<string | null>('resource', { default: null })

/**
 * The underlying view's drawing or Product tab; independent of the resource.
 */
const tab = defineModel<string>('tab', { default: 'overview' })

/** The resource reading is independent of the underlying collection drawing. */
const resourceTab = defineModel<string>('resourceTab', { default: 'overview' })

/** First route in the visible Scenario route window. */
const scenarioRoute = defineModel<string | null>('scenarioRoute', { default: null })

/** `auto`, or the reader's preferred number of visible route columns. */
const routeColumns = defineModel<string>('routeColumns', { default: 'auto' })
const coverage = defineModel<CoverageReading>('coverage', { default: defaultCoverageReading })
const topology = defineModel<TopologyReading>('topology', { default: defaultTopologyReading })

const workspace = computed(() => projectReportWorkspace(props.report))

/*
  Render the canonical location on both server and client. Only the tab's own
  view is reconciled here: an address that names no destination this report has
  simply reads as the section's first tab, which is the honest landing for a
  link written against a report the reader no longer has.
*/
const location = computed(() => {
  const next = { section: section.value, resource: resource.value, tab: tab.value, topology: topology.value }
  const destination = destinationForLocation(next.section, next.tab)
  return destination && next.topology.view !== destination.view ? { ...next, topology: { ...next.topology, view: destination.view } } : next
})
let mounted = false
function synchronizeLocation() {
  if (!mounted) return
  const next = location.value
  if (section.value !== next.section) section.value = next.section
  if (resource.value !== next.resource) resource.value = next.resource
  if (tab.value !== next.tab) tab.value = next.tab
  if (JSON.stringify(topology.value) !== JSON.stringify(next.topology)) topology.value = next.topology
}
watch(location, synchronizeLocation, { flush: 'post' })
onMounted(() => { mounted = true; synchronizeLocation() })
</script>

<template>
  <article data-pdd-kit-report-viewer class="pdd-kit-report">
    <ReportShell
      :section="location.section"
      :resource="location.resource"
      :tab="location.tab"
      v-model:coverage="coverage"
      v-model:resource-tab="resourceTab"
      v-model:scenario-route="scenarioRoute"
      v-model:route-columns="routeColumns"
      :topology="location.topology"
      :workspace="workspace"
      :logo-src="logoSrc"
      :products="products"
      :product-catalog="productCatalog"
      :sidebar-vocabulary="sidebarVocabulary"
      :tools-target="toolsTarget"
      @update:section="section = $event"
      @update:resource="resource = $event"
      @update:tab="tab = $event"
      @update:topology="topology = $event"
    >
      <template v-if="$slots['sidebar-header']" #sidebar-header="{ collapsed }">
        <slot name="sidebar-header" :collapsed="collapsed" />
      </template>
      <template v-if="$slots['sidebar-footer']" #sidebar-footer="{ collapsed }">
        <slot name="sidebar-footer" :collapsed="collapsed" />
      </template>
      <template v-if="$slots.navigation" #navigation="{ collapsed }">
        <slot name="navigation" :collapsed="collapsed" />
      </template>
      <template v-if="$slots['primary-action']" #primary-action>
        <slot name="primary-action" />
      </template>
      <template v-if="$slots.provenance" #provenance>
        <slot name="provenance" />
      </template>
      <template v-if="$slots.status" #status>
        <slot name="status" />
      </template>
    </ReportShell>
  </article>
</template>
