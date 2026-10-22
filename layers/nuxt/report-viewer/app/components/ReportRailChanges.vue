<script setup lang="ts">
/**
 * What changed in one collection, from its rail row: counts by kind, then the
 * changed resources themselves, each opening its Changes reading.
 */
import type { ResourceChange } from 'pdd-toolkit/report/compare'
import type { ReportResourceKind, ReportWorkspace } from '../utils/reportWorkspace'
import { ENTITY_KIND_META } from '../utils/reportWorkspace'
import { collectionKindFor, resourceAncestors } from '../utils/reportDestinations'
import { CHANGE_META, CHANGE_STATUSES, REPORT_COMPARISON, changeResource, readingKeyOf, viewerKind } from '../utils/reportComparison'
import { resourceOpenerKey } from '../utils/resourceNavigation'

const props = defineProps<{ kind: ReportResourceKind, workspace: ReportWorkspace }>()
const emit = defineEmits<{ changes: [] }>()
const context = inject(REPORT_COMPARISON, ref(null))
const open = inject(resourceOpenerKey, () => {})
const SHOWN = 6

const counts = computed(() => context.value?.collections[props.kind])
const changes = computed(() => (context.value?.comparison.changes ?? []).filter(change => change.kind !== 'product' && collectionKindFor(viewerKind(change.kind)) === props.kind))
const total = computed(() => changes.value.length)
/* Counterparts — the web and the mobile Screen of one name — differ by where they sit. */
function placeOf(change: ResourceChange): string {
  if (change.parent) return change.parent.title
  const ctx = context.value
  const side = change.status === 'removed' ? ctx?.before : props.workspace
  const resource = ctx ? changeResource(ctx, props.workspace, change) : undefined
  return resource && side ? resourceAncestors(side, resource).at(-1)?.title ?? '' : ''
}
function openChange(key: string | null) {
  if (key) open(key, 'changes')
}
</script>

<template>
  <div class="w-72 space-y-2.5 p-3" data-rail-changes-popover>
    <div class="space-y-1">
      <p class="text-sm font-semibold text-highlighted">{{ total }} {{ total === 1 ? 'change' : 'changes' }} in {{ ENTITY_KIND_META[kind].plural }}</p>
      <p class="text-xs text-muted">Since {{ context?.input.baseline.label }}</p>
    </div>
    <div v-if="counts" class="flex flex-wrap gap-1.5">
      <template v-for="status in CHANGE_STATUSES" :key="status">
        <ReportChangeMark v-if="counts[status]" :status="status" size="xs" :label="`${counts[status]} ${CHANGE_META[status].verb}`" />
      </template>
    </div>
    <ul class="space-y-1 border-t border-default pt-2">
      <li v-for="change in changes.slice(0, SHOWN)" :key="change.key" class="flex min-w-0 items-center gap-2 text-sm">
        <ReportKind :kind="viewerKind(change.kind)" :labelled="false" size="xs" />
        <span class="min-w-0 flex-1 truncate">
          <span v-if="change.status === 'removed'" class="report-removed-title">{{ change.title }}</span>
          <button v-else type="button" class="text-start text-highlighted hover:underline focus-visible:underline focus-visible:outline-none" @click="openChange(readingKeyOf(change))">{{ change.title }}</button>
          <span v-if="placeOf(change)" class="text-xs text-dimmed"> · {{ placeOf(change) }}</span>
        </span>
        <span class="shrink-0 font-mono text-[11px] font-semibold" :style="{ color: `var(--report-change-${change.status})` }" :aria-label="CHANGE_META[change.status].label">{{ CHANGE_META[change.status].glyph }}</span>
      </li>
      <li v-if="total > SHOWN" class="text-xs text-muted">and {{ total - SHOWN }} more</li>
    </ul>
    <UButton size="xs" color="neutral" variant="outline" block icon="i-lucide-git-compare" :label="`Show these in Changes`" @click="emit('changes')" />
  </div>
</template>
