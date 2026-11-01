<script setup lang="ts">
/**
 * Changes: the resources that differ from the baseline, as one collection.
 *
 * Each change reads as a sentence, grouped by Domain, and filters narrow the
 * set like any collection's. What is new or removed with its container reads
 * inside it, a Domain reorganisation reads as moves, and References updated
 * on several resources of one type read as one row. Opening a change lands on
 * its resource's Changes reading. The header says what is compared; the
 * report header's Changes button switches it, or turns the comparison off.
 */
import type { ChangeStatus } from 'pdd-toolkit/report/compare'
import type { ReportFilterChip } from './ReportFilterBar.vue'
import type { AnyResourceView, ReportResourceKind, ReportWorkspace } from '../utils/reportWorkspace'
import { ENTITY_KIND_META } from '../utils/reportWorkspace'
import { collectionKindFor } from '../utils/reportDestinations'
import {
  CHANGE_META, CHANGE_STATUSES, REPORT_COMPARISON, changeEntries, readingKeyOf, viewerKind, type ChangeEntry
} from '../utils/reportComparison'
import type { ColumnChoice } from '../composables/useColumns'

/** `focus` narrows the Type filter to one rail collection's types, each time it is set. */
const props = defineProps<{ workspace: ReportWorkspace, focus?: { kind: ReportResourceKind, at: number } | null }>()
const emit = defineEmits<{ open: [resource: AnyResourceView, tab: string], product: [] }>()
const context = inject(REPORT_COMPARISON, ref(null))

const statuses = ref<ChangeStatus[]>([])
const kinds = ref<ReportResourceKind[]>([])
const closed = ref<string[]>([])
const { columnsFor, setColumns } = useColumns()
const columns = computed(() => columnsFor('changes', 1))
const rowGrid = computed(() => columns.value > 1
  ? { display: 'grid', gridTemplateColumns: `repeat(${columns.value}, minmax(0, 1fr))`, gap: '0.5rem', alignItems: 'start' }
  : undefined)

const all = computed(() => context.value?.comparison.changes ?? [])
const visible = computed(() => all.value.filter(change =>
  (!statuses.value.length || statuses.value.includes(change.status))
  && (!kinds.value.length || kinds.value.includes(viewerKind(change.kind)))))
const groups = computed(() => context.value ? changeEntries(context.value, props.workspace, visible.value) : [])
defineExpose({ shown: computed(() => visible.value.length), total: computed(() => all.value.length) })

/* A control offers only what the rows print, each with how many it holds. */
const statusOptions = computed(() => CHANGE_STATUSES
  .filter(status => all.value.some(change => change.status === status))
  .map(status => ({ value: status, label: `${CHANGE_META[status].label} (${all.value.filter(change => change.status === status).length})` })))
const kindOptions = computed(() => [...new Set(all.value.map(change => viewerKind(change.kind)))]
  .map(kind => ({ value: kind, label: ENTITY_KIND_META[kind].plural })))
const chips = computed<ReportFilterChip[]>(() => [
  ...statuses.value.map(status => ({ key: `status:${status}`, label: 'Change', value: CHANGE_META[status].label })),
  ...kinds.value.map(kind => ({ key: `kind:${kind}`, label: 'Type', value: ENTITY_KIND_META[kind].plural, kind }))
])
function removeChip(key: string) {
  statuses.value = statuses.value.filter(status => `status:${status}` !== key)
  kinds.value = kinds.value.filter(kind => `kind:${kind}` !== key)
}
function clear() { statuses.value = []; kinds.value = [] }
/* Applied once per request, as soon as the comparison has changes to narrow; later filter choices are the reader's. */
let appliedFocus = 0
watch([() => props.focus, kindOptions], ([focus, options]) => {
  if (!focus || focus.at === appliedFocus || !options.length) return
  appliedFocus = focus.at
  statuses.value = []
  kinds.value = options.map(option => option.value).filter(kind => collectionKindFor(kind) === focus.kind)
}, { immediate: true })
function toggleAll(open: boolean) { closed.value = open ? [] : groups.value.map(group => group.key) }
function setOpen(key: string, open: boolean) { closed.value = [...closed.value.filter(item => item !== key), ...(open ? [] : [key])] }

/* A resource's change opens its Changes reading; the Product, removals, moves and References rows read in place. */
const expanded = ref<string[]>([])
const readsInPlace = (entry: ChangeEntry) => entry.type !== 'change' || entry.change.kind === 'product' || entry.change.status === 'removed'
function activate(entry: ChangeEntry) {
  if (readsInPlace(entry)) {
    const open = !expanded.value.includes(entry.key)
    expanded.value = [...expanded.value.filter(key => key !== entry.key), ...(open ? [entry.key] : [])]
    return
  }
  const key = entry.type === 'change' ? readingKeyOf(entry.change) : null
  const resource = key ? props.workspace.byKey.get(key) : undefined
  if (resource) emit('open', resource, 'changes')
}

const baseline = computed(() => context.value?.input.baseline)
</script>

<template>
  <div class="flex min-h-0 flex-col" data-report-changes>
    <div class="shrink-0 space-y-2 px-4 pt-2 sm:px-5" data-comparison-baseline>
      <!-- What is compared, always named; the header's Changes button switches it. -->
      <p v-if="!context?.input.scope" class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-changes-since>
        <UIcon name="i-lucide-git-compare" class="size-4 shrink-0 text-dimmed" />
        <span class="text-muted">Since</span>
        <span class="font-medium text-highlighted">{{ baseline?.label }}</span>
        <span v-if="baseline?.revision && baseline.revision !== baseline.label" class="font-mono text-xs text-muted">{{ baseline.revision }}</span>
        <span v-if="baseline?.detail" class="min-w-0 truncate text-muted">“{{ baseline.detail }}”</span>
      </p>
      <p v-if="context?.input.scope" class="text-sm text-muted" data-changes-scope-line>{{ context.input.scope }}</p>
    </div>

    <div v-if="context?.input.pending" class="flex items-center gap-3 p-5 text-sm text-dimmed" data-changes-pending>
      <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
      Reading {{ baseline?.label }}…
    </div>

    <div v-else-if="context?.input.unavailable" class="p-5">
      <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :title="context.input.unavailable.title" :description="context.input.unavailable.description" />
    </div>

    <template v-else>
      <div class="shrink-0 px-4 pt-2 sm:px-5 sm:pt-3" data-collection-toolbar>
        <ReportFilterBar :chips="chips" :filters-offered="all.length > 0" @remove="removeChip" @clear="clear">
          <template #default="{ inSheet }">
            <USelectMenu v-model="statuses" :items="statusOptions" value-key="value" multiple size="sm" variant="outline" :search-input="false"
              :class="inSheet ? 'w-full' : 'min-w-36'" :ui="{ content: 'report-filter-menu', item: 'py-2' }" aria-label="Filter by change">
              <template #leading><UIcon name="i-lucide-git-compare" class="size-4 shrink-0 text-dimmed" /></template>
              <template #default>
                <span class="truncate">Change</span>
                <span v-if="statuses.length" class="report-meta">({{ statuses.length }})</span>
              </template>
              <template #item-leading="{ item }"><ReportChangeMark :status="item.value" size="xs" label="" /></template>
            </USelectMenu>
            <USelectMenu v-model="kinds" :items="kindOptions" value-key="value" multiple size="sm" variant="outline" :search-input="false"
              :class="inSheet ? 'w-full' : 'min-w-36'" :ui="{ content: 'report-filter-menu', item: 'py-2' }" aria-label="Filter by type">
              <template #leading><UIcon name="i-lucide-shapes" class="size-4 shrink-0 text-dimmed" /></template>
              <template #default>
                <span class="truncate">Type</span>
                <span v-if="kinds.length" class="report-meta">({{ kinds.length }})</span>
              </template>
              <template #item-leading="{ item }"><ReportKind :kind="item.value" :labelled="false" size="xs" /></template>
            </USelectMenu>
          </template>
          <template #end>
            <ReportCollectionControls kind="product" drawing="rows" :columns="columns" :expands-anything="groups.length > 1"
              @columns="setColumns('changes', $event as ColumnChoice)" @toggle-all="toggleAll" />
          </template>
        </ReportFilterBar>
      </div>

      <div class="report-pane min-h-0 flex-1">
        <div class="space-y-3 p-5">
          <p v-if="!all.length" class="text-sm text-muted italic">No changes to the Product Model since {{ baseline?.label }}.</p>
          <div v-else-if="!visible.length" class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-muted italic">Nothing matches the current filters.</p>
            <UButton icon="i-lucide-filter-x" color="neutral" variant="outline" size="sm" label="Clear filters" @click="clear" />
          </div>
          <UCollapsible
            v-for="group in groups"
            :key="group.key || 'none'"
            :open="!closed.includes(group.key)"
            class="overflow-hidden rounded-xl border border-default bg-elevated/20"
            @update:open="setOpen(group.key, $event)"
          >
            <template #default="{ open }">
              <UButton color="neutral" variant="ghost" size="lg" block data-group-header class="w-full justify-start rounded-none px-3 py-2 text-start">
                <ReportKind v-if="group.kind" kind="domain" :labelled="false" size="sm" />
                <ReportKind v-else-if="group.key === 'product'" kind="product" :labelled="false" size="sm" />
                <UIcon v-else name="i-lucide-minus" class="size-3.5 shrink-0 text-dimmed" />
                <span class="min-w-0 truncate text-sm font-semibold tracking-tight" :class="group.key ? 'text-highlighted' : 'text-muted'">{{ group.title }}</span>
                <span class="report-meta ms-auto">{{ group.count }}</span>
                <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed transition-transform" :class="open && 'rotate-180'" />
              </UButton>
            </template>
            <template #content>
              <div class="space-y-1.5 border-t border-muted p-2" :style="rowGrid" data-collection-rows>
                <ReportChangeEntry v-for="entry in group.entries" :key="entry.key" :entry="entry" :workspace="workspace"
                  :expanded="expanded.includes(entry.key)"
                  @activate="activate(entry)" />
              </div>
            </template>
          </UCollapsible>
          <p v-if="all.length" class="pt-2 text-xs text-dimmed">This compares two versions of the authored model. It says nothing about whether the code does either.</p>
        </div>
      </div>

    </template>
  </div>
</template>
