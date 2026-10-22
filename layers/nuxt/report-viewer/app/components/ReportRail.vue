<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { ReportResourceKind, ReportWorkspace } from '../utils/reportWorkspace'
import type { ReportPage } from '../utils/reportDestinations'
import { COLLECTION_PAGES, OVERVIEW_PAGE, REPORT_PAGES } from '../utils/reportDestinations'
import { REPORT_COMPARISON, compactChangeCount } from '../utils/reportComparison'

const props = defineProps<{
  workspace: ReportWorkspace
  activeSection: string
  counts: Record<ReportResourceKind, number>
  collapsed?: boolean
}>()

/* The rail changes the subject. Each collection keeps its drawings inside it. */
const emit = defineEmits<{ kind: [kind: ReportResourceKind], changes: [kind?: ReportResourceKind] }>()
const comparison = inject(REPORT_COMPARISON, ref(null))

type RailItem = NavigationMenuItem & { iconColor?: string, count?: number, kind?: ReportResourceKind, changed?: { total: number, title: string, status: 'added' | 'modified' | 'removed' | 'mixed' } }
const activeColor = computed(() => {
  const page = REPORT_PAGES.find(item => item.section === props.activeSection)
  return page ? `var(--report-slot-${page.slot})` : 'var(--ui-text-muted)'
})
const railItem = (page: ReportPage): RailItem => ({
  label: page.label,
  icon: page.icon,
  iconColor: `var(--report-slot-${page.slot})`,
  active: props.activeSection === page.section,
  'data-current': props.activeSection === page.section,
  'aria-label': page.label,
  kind: page.kind,
  onSelect: () => emit('kind', page.kind)
})
const overviewItems = computed<RailItem[]>(() => [railItem(OVERVIEW_PAGE)])
/* While comparing, Changes leads the rail with its count, which its accessible name carries too. */
const changesCount = computed(() => !comparison.value || comparison.value.input.pending || comparison.value.input.unavailable ? undefined : comparison.value.comparison.changes.length)
const changesItems = computed<RailItem[]>(() => comparison.value ? [{
  label: 'Changes',
  icon: 'i-lucide-git-compare',
  iconColor: 'var(--ui-text-highlighted)',
  active: props.activeSection === 'changes',
  'data-current': props.activeSection === 'changes',
  'aria-label': changesCount.value === undefined ? 'Changes' : `Changes, ${changesCount.value}`,
  count: changesCount.value,
  onSelect: () => emit('changes', undefined)
}] : [])
/* The one dot popover open, closed as soon as it leads to Changes. */
const openDot = ref<ReportResourceKind | null>(null)
/*
 * Moving from one dot to the next opens the next before the last one's close
 * delay ends, so a popover closing clears only itself, never the one that has
 * just opened.
 */
function setDot(kind: ReportResourceKind, open: boolean) {
  if (open) openDot.value = kind
  else if (openDot.value === kind) openDot.value = null
}
function showChanges(kind?: ReportResourceKind) {
  openDot.value = null
  emit('changes', kind)
}
const changedIn = (kind: ReportResourceKind): RailItem['changed'] => {
  const counts = comparison.value?.collections[kind]
  if (!counts) return undefined
  const total = counts.added + counts.modified + counts.removed
  const parts = (['added', 'modified', 'removed'] as const).filter(status => counts[status]).map(status => `${counts[status]} ${status}`)
  /* The mark says what kind of change, when there is only one kind; mixed changes wear a neutral dot. */
  const statuses = (['added', 'modified', 'removed'] as const).filter(status => counts[status])
  const status = statuses.length === 1 ? statuses[0]! : 'mixed'
  return total ? { total, status, title: parts.join(', ') } : undefined
}
const items = computed<RailItem[][]>(() => [
  [
    { label: 'Resources', type: 'label' },
    ...COLLECTION_PAGES.map((page) => {
      const changed = changedIn(page.kind)
      /* Collapsed, a changed row's icon opens the changes popover, which names the collection; the others keep their label tooltip. */
      return { ...railItem(page), count: props.counts[page.kind], changed, ...(changed ? {} : { tooltip: true }) }
    })
  ]
])
const menuUi = computed(() => ({
  root: 'gap-1',
  list: 'flex flex-col gap-1',
  link: ['report-navitem min-h-9 gap-2.5 font-normal data-[current=true]:font-semibold', props.collapsed ? 'justify-center' : 'px-2.5'],
  label: 'px-2.5 pt-0 pb-1 font-mono text-[10px] tracking-widest uppercase text-dimmed',
  separator: 'h-4 bg-transparent'
}))
/* Collapsed, the Changes row drops its vertical padding so the icon and the count under it fit the 36px row. */
const changesUi = computed(() => props.collapsed ? { ...menuUi.value, link: [...menuUi.value.link, 'py-0'] } : menuUi.value)
</script>

<template>
  <div :style="{ '--report-rail-active-color': activeColor }">
    <div v-if="$slots.navigation" class="mb-4 px-1">
      <slot name="navigation" :collapsed="collapsed" />
    </div>
    <UNavigationMenu
      :items="items"
      :collapsed="collapsed"
      orientation="vertical"
      color="neutral"
      :tooltip="false"
      aria-label="Report sections"
      :ui="menuUi"
    >
      <template #list-leading>
        <UNavigationMenu
          v-if="changesItems.length"
          :items="changesItems"
          :collapsed="collapsed"
          orientation="vertical"
          color="neutral"
          tooltip
          aria-label="Report changes"
          class="mb-1"
          :ui="changesUi"
          data-report-changes-rail
        >
          <template #item-leading="{ item }">
            <!-- Collapsed, the count sits under the icon once it is known; until then the icon stands alone, centered like the other rows. -->
            <span class="inline-flex shrink-0" :class="collapsed && 'flex-col items-center gap-[3px]'">
              <UIcon v-if="item.icon" :name="item.icon" class="shrink-0" :class="collapsed ? 'size-[17px]' : 'size-4'" :style="{ color: item.iconColor }" />
              <span v-if="collapsed && item.count !== undefined" class="report-rail-count" aria-hidden="true" data-rail-changes-count>{{ compactChangeCount(item.count) }}</span>
            </span>
          </template>
          <template #item-trailing="{ item }">
            <span v-if="!collapsed && item.count !== undefined" class="report-meta">{{ item.count }}</span>
          </template>
        </UNavigationMenu>
        <!-- Overview is the Product's own page; a gap sets it apart from the collections below. -->
        <div data-report-overview-actions class="mb-4 flex gap-1" :class="collapsed ? 'flex-col' : 'items-center'">
          <UNavigationMenu
            :items="overviewItems"
            :collapsed="collapsed"
            orientation="vertical"
            color="neutral"
            tooltip
            aria-label="Report overview"
            :class="collapsed ? 'w-full' : 'min-w-0 flex-1'"
            :ui="menuUi"
          >
            <template #item-leading="{ item }">
              <UIcon v-if="item.icon" :name="item.icon" class="shrink-0" :class="collapsed ? 'size-[17px]' : 'size-4'" :style="{ color: item.iconColor }" />
            </template>
          </UNavigationMenu>
          <slot name="overview-action" />
        </div>
      </template>
      <template #item-leading="{ item }">
        <!-- Collapsed, the dot rides on the icon, and hovering the icon opens what changed. -->
        <UPopover v-if="collapsed && item.changed" mode="hover" :open-delay="120" :close-delay="150" :open="openDot === item.kind" @update:open="setDot(item.kind!, $event)"
          :content="{ side: 'right', align: 'start', sideOffset: 18, collisionPadding: 12 }">
          <span class="report-rail-collapsed-target" data-rail-changed-target>
            <span class="relative inline-flex shrink-0">
              <UIcon v-if="item.icon" :name="item.icon" class="size-[17px] shrink-0" :style="{ color: item.iconColor }" />
              <span class="report-rail-changed report-rail-changed--corner" :data-rail-changed="item.changed.status"><span class="sr-only">Changed: {{ item.changed.title }}</span></span>
            </span>
          </span>
          <template #content>
            <ReportRailChanges :kind="item.kind!" :workspace="workspace" @changes="showChanges(item.kind)" />
          </template>
        </UPopover>
        <UIcon v-else-if="item.icon" :name="item.icon" class="shrink-0" :class="collapsed ? 'size-[17px]' : 'size-4'" :style="{ color: item.iconColor }" />
      </template>
      <template #item-trailing="{ item }">
        <!-- Where to look: the dot opens what changed in the collection on hover. -->
        <UPopover v-if="!collapsed && item.changed" mode="hover" :open="openDot === item.kind" @update:open="setDot(item.kind!, $event)" :open-delay="120" :close-delay="150"
          :content="{ side: 'right', align: 'start', sideOffset: 14, collisionPadding: 12 }">
          <!-- Clicking the dot opens Changes narrowed to this collection, not the collection itself. -->
          <span class="report-rail-changed-target" data-rail-changed-target role="button" tabindex="-1" :aria-label="`Show the changes in ${item.label}`"
            @click.stop.prevent="showChanges(item.kind)">
            <span class="report-rail-changed" :data-rail-changed="item.changed.status"><span class="sr-only">Changed: {{ item.changed.title }}</span></span>
          </span>
          <template #content>
            <ReportRailChanges :kind="item.kind!" :workspace="workspace" @changes="showChanges(item.kind)" />
          </template>
        </UPopover>
        <span v-if="!collapsed && item.count !== undefined" class="report-meta">{{ item.count }}</span>
      </template>
    </UNavigationMenu>
  </div>
</template>

<style scoped>
.report-rail-changed { display: inline-block; width: 7px; height: 7px; border-radius: 9999px; background: var(--report-change-modified); }
.report-rail-changed[data-rail-changed='added'] { background: var(--report-change-added); }
.report-rail-changed[data-rail-changed='removed'] { background: var(--report-change-removed); }
.report-rail-changed[data-rail-changed='mixed'] { background: var(--ui-text-muted); }
/* A comfortable hover target around a 7px dot. */
.report-rail-changed-target { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-inline: -5px; border-radius: 9999px; }
.report-rail-changed-target:hover { background: var(--ui-bg-accented); }
/* The whole collapsed row's icon area is the hover target, not just the glyph. */
.report-rail-collapsed-target { display: inline-flex; margin: -8px; padding: 8px; }
.report-rail-count { color: var(--ui-text-muted); font: 600 10px/1 var(--font-mono); }
.report-rail-changed--corner { position: absolute; top: -2px; inset-inline-end: -3px; box-shadow: 0 0 0 2px var(--ui-bg); }
/* Keep Nuxt UI's navigation and focus treatment, with the original rail tint. */
:deep(.report-navitem[data-current='true']::before) {
  background: color-mix(in srgb, var(--report-rail-active-color) 10%, var(--ui-bg-elevated));
  box-shadow: inset 2px 0 0 var(--report-rail-active-color);
}
</style>
