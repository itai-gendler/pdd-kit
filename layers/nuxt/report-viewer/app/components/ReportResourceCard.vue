<script setup lang="ts">
/**
 * One resource, one row.
 *
 * The surface is already named after the kind, so the row never repeats it in
 * words — the coloured icon carries it. The slot that word occupied now holds
 * the fact that tells this resource from its neighbours: a Screen's context, a
 * Scenario's parent, an Experience's Interface. Without it a collection of
 * counterparts reads as a list of duplicates.
 */
import { resourceNavigationKey } from '../utils/resourceNavigation'
import type { AnyResourceView, ReportWorkspace } from '../utils/reportWorkspace'
import { ENTITY_KIND_META, entityFacetOf, resolveResource } from '../utils/reportWorkspace'
import type { ResourceCardMetric } from '../utils/resourceCards'
import { resourceCardPresentation } from '../utils/resourceCards'
import { slotColor } from '../utils/reportPalette'
import { titledBy, variationChooser } from '../utils/variations'
import { REPORT_COMPARISON, changeMark } from '../utils/reportComparison'

const props = withDefaults(defineProps<{
  workspace: ReportWorkspace
  resource: AnyResourceView
  active?: boolean
  /** False inside a group whose header already states what the badge would. */
  badge?: boolean
  /** A hook the surface supplies where the row's own would repeat its parent. */
  hookLabel?: string
  hook?: string
  /** In a multi-column grid the metrics stack under the title instead of
      hiding below the large breakpoint. */
  stacked?: boolean
  /** A row that opens to children: the row itself toggles, as a group header
      does, and a dedicated button at its end opens the page. */
  expandable?: boolean
  open?: boolean
  count?: number
  /** False where the row is read from another resource's side, and the
      resource's own reach would describe it rather than the relation. */
  metrics?: boolean
  /** False inside a surface that already names the row's Variation: the row then names only itself. */
  pill?: boolean
}>(), { badge: true, stacked: false, expandable: false, open: false, count: 0, metrics: true, pill: true })

const navigation = inject(resourceNavigationKey, null)
const href = computed(() => props.expandable ? undefined : navigation?.href(props.resource.key))
function activate(event: MouseEvent) {
  if (href.value && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)) return
  event.preventDefault()
  if (props.expandable) emit('toggle', props.resource)
  else emit('open', props.resource)
}

const emit = defineEmits<{ open: [resource: AnyResourceView], toggle: [resource: AnyResourceView] }>()
const presentation = computed(() => {
  const card = resourceCardPresentation(props.workspace, props.resource)
  const own = props.metrics ? card : { ...card, metrics: [] }
  return props.hook ? { ...own, hookLabel: props.hookLabel ?? own.hookLabel, hook: props.hook } : own
})
const kindLabel = computed(() => ENTITY_KIND_META[props.resource.kind].label)
/* A row with its own button — the Variation picker — keeps its link as a full-card
   target beside it, never around it. A lone alternative's row is titled by its
   Variation, and the picker names the alternative. */
const hasPill = computed(() => props.pill && (props.resource.kind === 'variation' || Boolean(props.resource.variation)))
const title = computed(() => hasPill.value ? titledBy(props.workspace, props.resource) : props.resource)
const memberKind = computed(() => title.value.kind === 'variation' ? title.value.memberKind : undefined)
const chooser = computed(() => props.resource.kind === 'variation' ? variationChooser(props.workspace, props.resource) : undefined)
const interfaceType = computed(() => title.value.kind === 'interface' ? title.value.interfaceType : undefined)
const facet = computed(() => title.value.kind === 'variation' ? title.value.memberFacet : entityFacetOf(title.value))
const acts = computed(() => title.value.kind === 'entity' ? title.value.acts ?? undefined : undefined)
/* While comparing, a row says how it changed — or that its Scenarios did — where the reader already looks. */
const comparison = inject(REPORT_COMPARISON, ref(null))
const mark = computed(() => changeMark(comparison.value, props.resource.key))
const colorMode = useColorMode()
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})

function metricColor(metric: ResourceCardMetric): string | undefined {
  if (!metric.kind) return undefined
  return slotColor(ENTITY_KIND_META[metric.kind].slot, mounted.value && colorMode.value === 'dark')
}

function metricTitle(metric: ResourceCardMetric, id: string): string {
  return metric.kind ? resolveResource(props.workspace, metric.kind, id)?.title ?? id : id
}

function metricInterfaceType(metric: ResourceCardMetric, id: string) {
  if (metric.kind !== 'interface') return undefined
  const resource = resolveResource(props.workspace, 'interface', id)
  return resource?.kind === 'interface' ? resource.interfaceType : undefined
}

function metricEntity(metric: ResourceCardMetric, id: string) {
  if (metric.kind !== 'entity') return undefined
  const resource = resolveResource(props.workspace, 'entity', id)
  return resource?.kind === 'entity' ? resource : undefined
}
</script>

<template>
  <div class="relative">
  <component
    :is="hasPill ? 'div' : href ? 'a' : 'button'"
    :href="hasPill ? undefined : href"
    :type="hasPill || href ? undefined : 'button'"
    :data-resource-key="resource.key"
    :data-change-row="mark?.status"
    class="report-resource-row group relative flex w-full items-center gap-4 overflow-hidden rounded-[0.625rem] border bg-default px-4 py-3 text-start transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    :class="[active ? 'border-primary bg-primary/5' : expandable ? 'border-default hover:bg-elevated' : 'border-default hover:border-accented hover:bg-elevated/40']"
    :aria-label="hasPill ? undefined : expandable ? `${open ? 'Collapse' : 'Expand'} ${kindLabel} ${resource.title}, ${count} ${count === 1 ? 'item' : 'items'}` : `Open ${kindLabel} ${resource.title}`"
    :aria-expanded="!hasPill && expandable ? open : undefined"
    @click="activate"
  >
    <!-- A separate full-card target preserves native link behavior without
         nesting the subtitle link inside another link or button. -->
    <component v-if="hasPill" :is="href ? 'a' : 'button'" :href="href" :type="href ? undefined : 'button'" :data-resource-key="resource.key"
      class="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      :aria-label="expandable ? `${open ? 'Collapse' : 'Expand'} ${kindLabel} ${resource.title}, ${count} ${count === 1 ? 'item' : 'items'}` : `Open ${kindLabel} ${resource.title}`"
      :aria-expanded="expandable ? open : undefined" data-card-primary @click.stop="activate" />
    <span class="flex min-w-0 flex-1 items-start gap-3" :class="hasPill && 'pointer-events-none relative'">
      <ReportKind
        :kind="title.kind"
        :interface-type="interfaceType"
        :facet="facet"
        :acts="acts"
        :member-kind="memberKind"
        :labelled="false"
        class="mt-0.5 pointer-events-auto"
      />
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-2">
          <span class="truncate text-[15px] font-semibold tracking-tight text-highlighted" data-row-title>{{ title.title }}</span>
          <ReportVariationPicker v-if="hasPill" :workspace="workspace" :resource="resource" @open="emit('open', $event)" />
          <ReportChangeMark v-if="mark" :status="mark.status" :label="mark.label" :title="mark.title" size="xs" />
          <UBadge
            v-if="badge && presentation.badge"
            color="neutral"
            variant="subtle"
            size="sm"
            class="min-w-12 max-w-40 truncate"
          >
            {{ presentation.badge }}
          </UBadge>
        </span>
        <span v-if="resource.lead" class="mt-0.5 block truncate text-sm leading-5 text-default">{{ resource.lead }}</span>
        <!-- The discriminating fact. Absent rather than empty when there is none. -->
        <span v-if="presentation.hook" class="mt-1 flex min-w-0 items-baseline gap-1.5">
          <span class="shrink-0 text-xs text-dimmed">{{ presentation.hookLabel }}</span>
          <!-- A surface may draw the hook itself, e.g. an operation with its badges; the text stays the fallback. -->
          <span v-if="$slots.hook" class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-xs font-medium text-muted"><slot name="hook" /></span>
          <span v-else class="truncate text-xs font-medium text-muted">{{ presentation.hook }}</span>
        </span>
        <!-- A set also says what chooses between its alternatives. -->
        <span v-if="chooser" class="mt-0.5 flex min-w-0 items-baseline gap-1.5" data-variation-chooser>
          <span class="shrink-0 text-xs text-dimmed">{{ chooser.label }}</span>
          <span class="truncate text-xs font-medium text-muted">{{ chooser.text }}</span>
        </span>
        <!-- Stacked: the same metrics, under the title, where a narrow column
             has no room beside it. -->
        <span v-if="stacked" class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span v-for="metric in presentation.metrics" :key="metric.label" :title="metric.kind ? metric.ids?.map(id => metricTitle(metric, id)).join(', ') : undefined">
            <span class="font-mono text-xs font-medium text-highlighted tabular-nums">{{ metric.value }}</span>
            <span class="ms-1 text-xs text-muted">{{ metric.label }}</span>
          </span>
        </span>
      </span>
    </span>

    <span class="shrink-0 items-center gap-4" :class="[stacked ? 'hidden' : 'hidden lg:flex', hasPill && 'pointer-events-none relative']">
      <UTooltip
        v-for="metric in presentation.metrics"
        :key="metric.label"
        :delay-duration="150"
        :disabled="!metric.kind"
        :ui="{ content: 'h-auto max-w-xl items-start px-3 py-3' }"
      >
        <span class="pointer-events-auto min-w-16 text-end">
          <span class="font-mono text-xs font-medium text-highlighted tabular-nums">{{ metric.value }}</span>
          <span class="ms-1 text-xs text-muted">{{ metric.label }}</span>
        </span>
        <template #content>
          <span class="block w-max max-w-[34rem] space-y-2">
            <span v-if="metric.kind" class="flex items-center gap-2 text-xs font-medium text-muted">
              <UIcon
                :name="ENTITY_KIND_META[metric.kind].icon"
                class="size-3.5 shrink-0"
                :style="{ color: metricColor(metric) }"
              />
              <span>{{ ENTITY_KIND_META[metric.kind].plural }}</span>
              <span class="font-mono text-dimmed tabular-nums">{{ metric.value }}</span>
            </span>
            <span v-if="metric.ids?.length" class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="id in metric.ids"
                :key="id"
                color="neutral"
                variant="outline"
                size="lg"
                :ui="{ base: 'max-w-80 gap-1.5 px-2.5 py-1.5 font-normal', label: 'truncate' }"
              >
                <template #leading>
                  <ReportInterfaceType
                    v-if="metric.kind === 'interface' && metricInterfaceType(metric, id)"
                    :type="metricInterfaceType(metric, id)!"
                    size="xs"
                  />
                  <ReportEntityMark
                    v-else-if="metricEntity(metric, id)"
                    :facet="entityFacetOf(metricEntity(metric, id))!"
                    :acts="metricEntity(metric, id)!.acts"
                    size="xs"
                  />
                  <UIcon
                    v-else-if="metric.kind"
                    :name="ENTITY_KIND_META[metric.kind].icon"
                    class="size-3.5 shrink-0"
                    :style="{ color: metricColor(metric) }"
                  />
                </template>
                {{ metricTitle(metric, id) }}
              </UBadge>
            </span>
            <span v-else-if="metric.kind" class="block text-xs text-dimmed">
              No {{ ENTITY_KIND_META[metric.kind].plural.toLowerCase() }}
            </span>
          </span>
        </template>
      </UTooltip>
    </span>

    <!-- The row's own end: a count and chevron where the row opens to
         children, as its group header wears them; the way into the page
         where it does not. -->
    <span v-if="expandable" class="flex shrink-0 items-center gap-1 ps-[4.5rem]">
      <span class="report-meta">{{ count }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed transition-transform" :class="open && 'rotate-180'" />
    </span>
    <UIcon
      v-else
      name="i-lucide-chevron-right"
      class="size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-default"
    />
  </component>
  <!-- Drilling down is a deliberate step from a row that otherwise keeps the
       reader here, so it has its own button. Outside the row: a button cannot
       hold a button. -->
  <UButton
    v-if="expandable"
    icon="i-lucide-arrow-right"
    color="neutral"
    variant="outline"
    size="xs"
    class="absolute end-14 top-1/2 -translate-y-1/2"
    data-open-page
    :aria-label="`Open ${kindLabel} ${resource.title}`"
    @click="emit('open', resource)"
  />
  </div>
</template>
