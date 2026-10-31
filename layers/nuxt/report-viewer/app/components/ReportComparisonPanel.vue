<script setup lang="ts">
/**
 * What the header's Changes button opens, on any page: whether changes show,
 * which scope, and what it is measured from. Choosing keeps the popover open,
 * so the reader can try another; Open Changes goes to the list.
 */
import { REPORT_COMPARISON, REPORT_COMPARISON_SWITCH } from '../utils/reportComparison'

const emit = defineEmits<{ changes: [] }>()
const comparisonSwitch = inject(REPORT_COMPARISON_SWITCH, null)
const context = inject(REPORT_COMPARISON, ref(null))

const input = computed(() => comparisonSwitch?.input.value ?? null)
const choices = computed(() => input.value?.choices)
const enabled = computed({
  get: () => Boolean(comparisonSwitch?.enabled.value),
  set: (value: boolean) => { if (comparisonSwitch) comparisonSwitch.enabled.value = value }
})
const settled = computed(() => Boolean(context.value && !input.value?.pending && !input.value?.unavailable))
/* Each scope says how many changes it holds: the host's count, or this comparison's for the scope on screen. */
const scopeCount = (scope: { id: string, count?: number }) => scope.count
  ?? (scope.id === choices.value?.scope && settled.value ? context.value!.comparison.changes.length : undefined)
/* The base list opens inside the popover, under the scopes, rather than in a popover of its own. */
const measuring = ref(false)
const baseScope = computed(() => choices.value?.scopes.find(scope => scope.base))
function chooseScope(id: string) {
  choices.value?.setScope(id)
  measuring.value = false
}
</script>

<template>
  <div class="w-[min(26rem,calc(100vw-1.5rem))]" data-comparison-panel>
    <div class="flex items-center gap-3 border-b border-default px-3 py-2.5">
      <UIcon name="i-lucide-git-compare" class="size-4 shrink-0 text-dimmed" />
      <span class="text-sm font-semibold text-highlighted">Changes</span>
      <USwitch v-model="enabled" size="sm" label="Show changes" class="ms-auto" :ui="{ label: 'text-xs text-muted' }" data-comparison-toggle />
    </div>

    <p v-if="!enabled" class="px-3 py-3 text-sm text-muted">Turn it on to mark what changed in the Product Model on every page.</p>
    <template v-else>
      <div class="space-y-2 px-3 py-3">
        <!-- A scope is named for what it is measured from; the caret lists what else it can be measured from. -->
        <UFieldGroup v-if="choices" size="sm" class="min-w-0 max-w-full" role="group" aria-label="Which changes" data-changes-scopes>
          <template v-for="scope in choices.scopes" :key="scope.id">
            <UButton color="neutral" :variant="scope.id === choices.scope ? 'subtle' : 'outline'" class="min-w-0"
              :disabled="scope.disabled" :aria-pressed="scope.id === choices.scope" :title="scope.description" :data-changes-scope="scope.id" @click="chooseScope(scope.id)">
              <span class="truncate">{{ scope.label }}</span><span v-if="scopeCount(scope) !== undefined" class="report-meta" data-changes-scope-count>{{ scopeCount(scope) }}</span>
            </UButton>
            <UButton v-if="scope.base" color="neutral" variant="outline" :icon="measuring ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              :aria-expanded="measuring" :aria-label="`${scope.label}: measure from another branch or tag`" title="Measure from another branch or tag"
              data-version-picker-trigger @click="measuring = !measuring" />
          </template>
        </UFieldGroup>
        <p v-if="input?.scope" class="text-xs text-muted" data-comparison-panel-line>{{ input.scope }}</p>
        <p v-else-if="input" class="text-xs text-muted">Since {{ input.baseline.label }}<template v-if="input.baseline.revision"> at {{ input.baseline.revision }}</template>.</p>
      </div>
      <div v-if="measuring && baseScope?.base" class="border-t border-default">
        <p class="px-3 pt-2 font-mono text-[10px] tracking-widest text-dimmed uppercase">Measure from</p>
        <ReportVersionList :base="baseScope.base" @chosen="measuring = false" />
      </div>
      <div class="flex justify-end border-t border-default px-2 py-1.5">
        <UButton size="sm" color="neutral" variant="ghost" trailing-icon="i-lucide-arrow-right" label="Open Changes" data-comparison-open @click="emit('changes')" />
      </div>
    </template>
  </div>
</template>
