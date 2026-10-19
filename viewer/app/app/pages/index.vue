<script setup lang="ts">
import type { ProductReport } from 'pdd-toolkit/report'
import type { LocalStatus } from '~/composables/useLocalProblems'

const { data, error, refresh, status } = await useFetch<ProductReport>(
  '/_pdd-kit/report.json',
  { server: false, cache: 'no-store' }
)

/* Changes: in Git, the report compares the files on disk with a version chosen in the report. */
const changes = useLocalChanges(data)
/* Hold the first render until Git has answered, so an address on Changes survives a refresh. */
const gitSettled = computed(() => changes.context.value !== undefined)

const problems = useLocalProblems()
const drawerOpen = ref(false)
const crash = ref<string | null>(null)
const logoSrc = ref<string | null>(null)
let logoRevision = 0
let events: EventSource | undefined

/* The header's pulse: which revision is on screen, and when it arrived. */
const live = useLocalLive()

async function refreshLogo() {
  logoRevision += 1
  const candidate = `/_pdd-kit/logo.svg?v=${logoRevision}`
  try {
    const response = await fetch(candidate, { method: 'HEAD', cache: 'no-store' })
    logoSrc.value = response.ok ? candidate : null
  } catch {
    logoSrc.value = null
  }
}

const { section, resource, tab, resourceTab, scenarioRoute, routeColumns, topology, coverage } = useReportNavigation()
void changes.refreshContext()
onMounted(() => {
  void refreshLogo()
  events = new EventSource('/_pdd-kit/events')
  events.addEventListener('open', () => { live.value = { ...live.value, connected: true }; void refresh(); void changes.refreshContext() })
  /* A ref moved or the working tree's status changed: ask where things stand, and re-read the baseline. */
  events.addEventListener('git', () => { void changes.refreshContext().then(() => changes.load()) })
  events.addEventListener('error', () => { live.value = { ...live.value, connected: false } })
  events.addEventListener('report', (event) => {
    let revision = live.value.revision + 1
    try {
      revision = (JSON.parse((event as MessageEvent).data) as { revision?: number }).revision ?? revision
    } catch { /* The count is a courtesy. */ }
    live.value = { revision, updatedAt: Date.now(), connected: true }
    crash.value = null
    void refresh()
    void refreshLogo()
  })
  events.addEventListener('status', (event) => {
    try {
      problems.value = JSON.parse((event as MessageEvent).data) as LocalStatus
    } catch { /* The next status replaces it. */ }
  })
})

onBeforeUnmount(() => {
  events?.close()
})

const state = computed(() => problems.value?.state ?? null)
/* No report to show: the CLI has none, or it was dropped when the CLI restarted. */
const blocked = computed(() => state.value === 'blocked' || (!data.value && Boolean(error.value) && state.value !== 'waiting'))
const blockedIssues = computed(() => problems.value?.issues
  ?? [{ severity: 'error' as const, message: (error.value as { data?: { message?: string } } | null)?.data?.message ?? 'The Product Model could not be compiled.' }])

/*
  A resource the loader showed without part of its file says so in its own
  reading. Only the current report has such resources; a stale one predates
  the problem.
*/
const resourceNotices = computed(() => {
  if (state.value !== 'degraded') return {}
  const notices: Record<string, { title: string, description: string, detail?: string }> = {}
  for (const issue of problems.value?.issues ?? []) {
    if (!issue.incomplete || !issue.resource || notices[issue.resource]) continue
    notices[issue.resource] = {
      title: 'Shown incomplete',
      description: `${issue.message.replace(/\.$/, '')}. Until it's fixed, this reading leaves out what that part of the file declares.`,
      detail: issue.file ? `${issue.file}${issue.line ? ` · line ${issue.line}` : ''}` : undefined
    }
  }
  return notices
})

/* Nothing left to list: the chip is gone, so the panel it opened goes too. */
watch(() => problems.value?.issues.length ?? 0, (count) => { if (!count) drawerOpen.value = false })

function openResource(key: string) {
  resource.value = key
  resourceTab.value = 'overview'
}

function onCrash(failure: unknown) {
  crash.value = failure instanceof Error ? failure.message : String(failure)
}
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <LocalWaiting v-if="state === 'waiting'" :message="problems?.issues[0]?.message" />

    <LocalBuildOverlay v-else-if="blocked" :issues="blockedIssues" :request="problems?.request" />

    <UContainer v-else-if="status === 'pending' && !data" class="py-16">
      <div class="flex items-center gap-3 text-sm text-dimmed">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
        Compiling the Product Model…
      </div>
    </UContainer>

    <template v-else-if="data && gitSettled">
      <LocalBuildOverlay v-if="crash" :crash="crash" />
      <NuxtErrorBoundary v-else @error="onCrash">
        <PddKitReportViewer
          v-model:section="section"
          v-model:resource="resource"
          v-model:tab="tab" v-model:resource-tab="resourceTab"
          v-model:scenario-route="scenarioRoute"
          v-model:route-columns="routeColumns"
          v-model:topology="topology"
          :report="data"
          v-model:coverage="coverage"
          :logo-src="logoSrc"
          :resource-notices="resourceNotices"
          :comparison="changes.comparison.value"
          class="pdd-kit-local-report min-h-0 flex-1"
        >
          <!-- Problems first, then the pulse: what to trust, then how fresh it is. -->
          <template #status>
            <LocalProblemsChip :report="data" :expanded="drawerOpen" @open="drawerOpen = !drawerOpen" />
            <LocalLivePulse />
          </template>
          <template #sidebar-header="{ collapsed }"><LocalViewerBrand :collapsed="collapsed" /></template>
          <template #sidebar-footer="{ collapsed }"><LocalViewerTools :collapsed="collapsed" /></template>
        </PddKitReportViewer>
      </NuxtErrorBoundary>
      <LocalProblemsDrawer v-model:open="drawerOpen" :report="data" @resource="openResource" />
    </template>
  </div>
</template>
