<script setup lang="ts">
/** Complete resource content reused inside the URL-addressable slideover.
 * Scenarios remain inside their parent; Lifecycle belongs to an Entity.
 * The host places tabs above the scrolling reading and owns navigation.
 */
import type { AnyResourceView, EntityView, ReportWorkspace } from '../utils/reportWorkspace'
import { ENTITY_KIND_META } from '../utils/reportWorkspace'
import { parentOf, tabsFor, type PageTabId } from '../utils/pageSections'
import { COLUMN_CHOICES, type ColumnChoice } from '../composables/useColumns'
import { REPORT_COMPARISON } from '../utils/reportComparison'

const props = defineProps<{
  workspace: ReportWorkspace
  resource: AnyResourceView
  tabsTarget?: HTMLElement | null
  restorePosition?: boolean
}>()

const emit = defineEmits<{
  open: [resource: AnyResourceView]
  ready: []
}>()

const scenarioRoute = defineModel<string | null>('scenarioRoute', { default: null })
const routeColumns = defineModel<string>('routeColumns', { default: 'auto' })

const parent = computed(() => parentOf(props.workspace, props.resource))
const subject = computed(() => parent.value ?? props.resource)
const requestedChild = computed(() => parent.value ? props.resource.key : null)
const comparison = inject(REPORT_COMPARISON, ref(null))
const tabs = computed(() => tabsFor(props.workspace, props.resource, comparison.value
  ? key => (comparison.value!.byKey.has(key) ? 1 : 0) + (comparison.value!.children.get(key)?.length ?? 0)
    + (comparison.value!.moves.get(key)?.into.length ?? 0) + (comparison.value!.moves.get(key)?.out.length ?? 0)
  : undefined))

/**
 * The reader's chosen tab, as the host keeps it. `overview` is the default and
 * the value a host leaves out of the URL. It is read, never written back when
 * it does not fit: a tab the page does not have — `lifecycle` on an Entity
 * whose States were just edited away — falls back to the Overview on screen
 * and is there again when the States return.
 */
const tab = defineModel<string>('tab', { default: 'overview' })
const active = ref<PageTabId>('overview')
const isTab = (id: string): id is PageTabId => tabs.value.some(item => item.id === id)
/* Lifecycle may carry its selected change after a slash. */
const tabId = (value: string) => value.split('/')[0] ?? value
const tabDetail = computed(() => tab.value.includes('/') ? tab.value.slice(tab.value.indexOf('/') + 1) : '')

/* A Scenario address is its parent's Scenarios reading with its card open;
   the Scenario's own References are read on that card. */
watch([tabs, requestedChild, tab], () => {
  if (requestedChild.value && isTab('scenarios')) {
    active.value = 'scenarios'
    return
  }
  const requested = tabId(tab.value)
  active.value = isTab(requested) ? requested : 'overview'
}, { immediate: true })

function select(id: string) {
  if (!isTab(id)) return
  if (id !== 'scenarios' && requestedChild.value) emit('open', subject.value)
  active.value = id
  tab.value = id
}

const current = computed(() => tabs.value.find(tab => tab.id === active.value) ?? tabs.value[0])
const scenariosList = useTemplateRef('scenariosList')
const scenarioKind = computed(() => subject.value.kind === 'journey' ? 'journey-scenario' as const : 'capability-scenario' as const)
const { columnsFor, setColumns } = useColumns()
const scenarioColumns = computed(() => columnsFor(scenarioKind.value, 1))
const columnItems = COLUMN_CHOICES.map(value => ({ value, label: `${value} per row` }))
</script>

<template>
  <div class="min-w-0" :class="current?.id === 'lifecycle' && 'flex h-full min-h-0 flex-col'">
    <!-- The host places the strip above the scrolling reading. It needs no
         painted sticky backdrop, and standalone use keeps it in normal flow. -->
    <Teleport :to="tabsTarget || 'body'" :disabled="!tabsTarget">
      <ReportPageTabs
        v-if="tabs.length > 1"
        :model-value="active"
        :items="tabs"
        :label="`${ENTITY_KIND_META[subject.kind].label} readings`"
        :class="!tabsTarget && 'mb-5'"
        @update:model-value="select"
      >
        <template v-if="current?.id === 'scenarios' && current.count" #actions>
          <div class="flex items-center gap-2" data-scenario-controls>
            <UFieldGroup size="sm">
              <UTooltip text="Expand all">
                <UButton icon="i-lucide-maximize-2" color="neutral" variant="outline" aria-label="Expand all" @click="scenariosList?.toggleAll(true)" />
              </UTooltip>
              <UTooltip text="Collapse all">
                <UButton icon="i-lucide-minimize-2" color="neutral" variant="outline" aria-label="Collapse all" @click="scenariosList?.toggleAll(false)" />
              </UTooltip>
            </UFieldGroup>
            <USelect
              :model-value="scenarioColumns"
              :items="columnItems"
              value-key="value"
              size="sm"
              variant="outline"
              class="hidden w-36 sm:inline-flex"
              icon="i-lucide-layout-grid"
              aria-label="Rows per line"
              @update:model-value="setColumns(scenarioKind, $event as ColumnChoice)"
            />
          </div>
        </template>
      </ReportPageTabs>
    </Teleport>

    <div class="min-w-0" :class="current?.id === 'lifecycle' ? 'min-h-0 flex-1' : 'space-y-5'">
      <ReportScenariosList
        v-if="current?.id === 'scenarios'"
        ref="scenariosList"
        :workspace="workspace"
        :resource="subject"
        :columns="scenarioColumns"
        :selected-key="requestedChild"
        :reveal-selected="!restorePosition"
        @open="emit('open', $event)"
      />

      <ReportResourceChanges
        v-else-if="current?.id === 'changes'"
        :workspace="workspace"
        :resource="subject"
      />

      <ReportEntityLifecycle
        v-else-if="current?.id === 'lifecycle' && subject.kind === 'entity'"
        :workspace="workspace"
        :resource="(subject as EntityView)"
        :change="tabDetail"
        @update:change="tab = 'lifecycle'"
        @open="emit('open', $event)"
        @ready="emit('ready')"
      />

      <template v-else>
        <ReportPageBlock
          v-for="id in current?.blocks ?? []"
          :key="id"
          :workspace="workspace"
          :resource="subject"
          :id="id"
          :heading="current?.id === 'overview'"
          @open="emit('open', $event)"
        />
      </template>
    </div>
  </div>
</template>
