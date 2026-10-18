<script setup lang="ts">
/**
 * The filter area of a surface: the controls that narrow it, above what they
 * narrowed it to.
 *
 * One control per axis, inline when the filters and actions fit on one row,
 * otherwise in a sheet. The selected values stay above the reading at every width.
 *
 * A control says how many values it holds, never which: the chosen values sit
 * on the second row, so the control line stays a fixed, scannable width however
 * much is selected, and every value keeps its own way out.
 */
import type { ReportInterface } from 'pdd-toolkit/report'
import type { ActingSide, EntityFacet, ReportResourceKind } from '../utils/reportWorkspace'

export interface ReportFilterChip {
  /** Stable identity for removal; the surface decides what it means. */
  key: string
  label: string
  value: string
  kind?: ReportResourceKind
  facet?: EntityFacet | null
  acts?: ActingSide | null
  interfaceType?: ReportInterface['type'] | null
  /** Says how the set is drawn, not what it holds: it sits with the filters' chips but is never counted as one. */
  drawing?: boolean
}

const props = withDefaults(defineProps<{
  chips: ReportFilterChip[]
  filtersOffered?: boolean
  label?: string
}>(), { filtersOffered: true, label: 'Filters' })
const filterCount = computed(() => props.chips.filter(chip => !chip.drawing).length)
const emit = defineEmits<{ remove: [key: string], clear: [] }>()
const sheetOpen = ref(false)
const bar = useTemplateRef('bar')
const inlineFilters = useTemplateRef('inlineFilters')
const actions = useTemplateRef('actions')
const collapsed = ref(true)
let resize: ResizeObserver | undefined
let phone: MediaQueryList | undefined

/** Measure the full inline controls even while their clipped wrapper is hidden.
 * Keeping their natural width avoids a collapse/expand loop at the boundary. */
function updateLayout() {
  if (!bar.value || !inlineFilters.value) return
  const gap = parseFloat(getComputedStyle(bar.value).columnGap) || 0
  const required = inlineFilters.value.getBoundingClientRect().width
    + (actions.value ? actions.value.getBoundingClientRect().width + gap : 0)
  collapsed.value = Boolean(phone?.matches) || Math.ceil(required) > bar.value.clientWidth
  if (!collapsed.value) sheetOpen.value = false
}
onMounted(() => {
  phone = window.matchMedia('(width < 640px)')
  phone.addEventListener('change', updateLayout)
  resize = new ResizeObserver(updateLayout)
  for (const element of [bar.value, inlineFilters.value, actions.value]) {
    if (element) resize.observe(element)
  }
  updateLayout()
})
onBeforeUnmount(() => {
  resize?.disconnect()
  phone?.removeEventListener('change', updateLayout)
})
</script>

<template>
  <div data-report-filter-bar :data-filters-collapsed="collapsed" class="space-y-2">
    <div ref="bar" class="relative flex items-center gap-2">
      <UDrawer
        v-if="filtersOffered || chips.length"
        v-model:open="sheetOpen"
        :title="label"
        :close="{ size: 'sm' }"
        :ui="{
          content: 'report-shell max-h-[85dvh]',
          container: 'min-h-0',
          body: 'overflow-y-auto',
          footer: 'flex-row pb-[max(1rem,env(safe-area-inset-bottom))]'
        }"
      >
        <UButton
          v-show="collapsed"
          icon="i-lucide-funnel"
          color="neutral"
          variant="outline"
          size="sm"
          data-mobile-filters
        >
          {{ label }}
          <span v-if="filterCount" class="report-meta">{{ filterCount }}</span>
        </UButton>
        <template #body>
          <div class="flex flex-col gap-3" data-mobile-filter-controls>
            <slot :in-sheet="true" />
          </div>
        </template>
        <template #footer>
          <UButton
            color="neutral"
            variant="outline"
            label="Clear all"
            size="sm"
            :disabled="!chips.length"
            @click="emit('clear')"
          />
          <UButton label="Show results" size="sm" class="flex-1 justify-center" @click="sheetOpen = false" />
        </template>
      </UDrawer>
      <div :class="collapsed ? 'pointer-events-none invisible absolute inset-x-0 overflow-hidden' : 'contents'">
        <div ref="inlineFilters" class="flex w-max shrink-0 items-center gap-2" :inert="collapsed" :aria-hidden="collapsed || undefined">
          <slot :in-sheet="false" />
          <UButton
            v-if="chips.length"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            label="Clear"
            aria-label="Clear every filter"
            @click="emit('clear')"
          />
        </div>
      </div>
      <!-- What is not a filter but belongs on the same line: how the set is
           drawn, and how densely. It sits at the end, clear of the controls. -->
      <div v-if="$slots.end" ref="actions" class="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <slot name="end" />
      </div>
    </div>

    <!-- What the controls narrowed it to. Absent rather than empty. -->
    <div v-if="chips.length" class="flex items-center gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        class="report-chip"
        :title="`Clear this ${chip.label.toLowerCase()} filter`"
        :aria-label="`Remove ${chip.label}: ${chip.value}`"
        @click="emit('remove', chip.key)"
      >
        <ReportKind
          v-if="chip.kind"
          :kind="chip.kind"
          :interface-type="chip.interfaceType"
          :facet="chip.facet"
          :acts="chip.acts"
          :labelled="false"
          size="xs"
        />
        <span class="shrink-0 text-dimmed">{{ chip.label }}</span>
        <span class="min-w-0 truncate font-medium text-highlighted">{{ chip.value }}</span>
        <UIcon name="i-lucide-x" class="size-3 shrink-0 text-dimmed" />
      </button>
    </div>
  </div>
</template>
