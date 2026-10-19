<script setup lang="ts">
/**
 * The header's highlight of what the report is compared with: the scope and
 * its count — `Since origin/main 282`, `Uncommitted 3` — on every page, so a
 * change mark never has to say what it is measured from. It opens Changes,
 * where the comparison is chosen. Turned off, it says so, and turns it back on.
 */
import { REPORT_COMPARISON, REPORT_COMPARISON_SWITCH } from '../utils/reportComparison'

const emit = defineEmits<{ changes: [] }>()
const comparisonSwitch = inject(REPORT_COMPARISON_SWITCH, null)
const context = inject(REPORT_COMPARISON, ref(null))

const input = computed(() => comparisonSwitch?.input.value ?? null)
const enabled = computed(() => Boolean(comparisonSwitch?.enabled.value))
const label = computed(() => {
  const choices = input.value?.choices
  return choices?.scopes.find(scope => scope.id === choices.scope)?.label ?? `Since ${input.value?.baseline.label}`
})
const total = computed(() => context.value && !input.value?.pending && !input.value?.unavailable ? context.value.comparison.changes.length : undefined)
const title = computed(() => enabled.value
  ? `${total.value ?? ''} changes · ${input.value?.scope ?? `${label.value}.`} Open Changes`
  : 'Changes are off. Turn them on')
async function activate() {
  if (comparisonSwitch && !enabled.value) {
    comparisonSwitch.enabled.value = true
    /* Changes exists only once the comparison is back: open it after the report has it. */
    await nextTick()
  }
  emit('changes')
}
</script>

<template>
  <!-- Drawn like the scope it names on Changes: the same neutral button and count. -->
  <UButton v-if="input" size="sm" color="neutral" :variant="enabled ? 'subtle' : 'outline'" class="min-w-0"
    :title="title" :aria-label="title" data-comparison-chip @click="activate">
    <UIcon :name="enabled && input.pending ? 'i-lucide-loader-circle' : enabled && input.unavailable ? 'i-lucide-triangle-alert' : 'i-lucide-git-compare'" class="size-4 shrink-0 text-dimmed" :class="enabled && input.pending && 'animate-spin'" />
    <template v-if="enabled">
      <span class="hidden max-w-48 truncate sm:inline">{{ label }}</span>
      <span v-if="total !== undefined" class="report-meta" data-comparison-total>{{ total }}</span>
    </template>
    <span v-else class="text-muted">Changes off</span>
  </UButton>
</template>
