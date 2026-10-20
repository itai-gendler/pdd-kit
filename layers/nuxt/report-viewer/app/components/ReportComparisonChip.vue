<script setup lang="ts">
/**
 * The header's Changes button: the scope and its count — `Since origin/main
 * 282`, `Uncommitted 3` — on every page, so a change mark never has to say
 * what it is measured from. It opens a popover that switches the scope, picks
 * what it is measured from, turns changes on and off, and opens Changes.
 */
import { REPORT_COMPARISON, REPORT_COMPARISON_SWITCH } from '../utils/reportComparison'

const emit = defineEmits<{ changes: [] }>()
const comparisonSwitch = inject(REPORT_COMPARISON_SWITCH, null)
const context = inject(REPORT_COMPARISON, ref(null))

const open = ref(false)
const input = computed(() => comparisonSwitch?.input.value ?? null)
const enabled = computed(() => Boolean(comparisonSwitch?.enabled.value))
const label = computed(() => {
  const choices = input.value?.choices
  return choices?.scopes.find(scope => scope.id === choices.scope)?.label ?? `Since ${input.value?.baseline.label}`
})
const total = computed(() => context.value && !input.value?.pending && !input.value?.unavailable ? context.value.comparison.changes.length : undefined)
const title = computed(() => enabled.value ? `${total.value ?? ''} changes · ${input.value?.scope ?? `${label.value}.`}` : 'Changes are off')
function showChanges() {
  open.value = false
  emit('changes')
}
</script>

<template>
  <UPopover v-if="input" v-model:open="open" :content="{ align: 'end', sideOffset: 6, collisionPadding: 12 }" :ui="{ content: 'overflow-hidden' }">
    <!-- Drawn like the scopes it names: the same neutral button and count. -->
    <UButton size="sm" color="neutral" :variant="enabled ? 'subtle' : 'outline'" class="min-w-0"
      :title="title" :aria-label="title" data-comparison-chip>
      <UIcon :name="enabled && input.pending ? 'i-lucide-loader-circle' : enabled && input.unavailable ? 'i-lucide-triangle-alert' : 'i-lucide-git-compare'" class="size-4 shrink-0 text-dimmed" :class="enabled && input.pending && 'animate-spin'" />
      <template v-if="enabled">
        <span class="hidden max-w-48 truncate sm:inline">{{ label }}</span>
        <span v-if="total !== undefined" class="report-meta" data-comparison-total>{{ total }}</span>
      </template>
      <span v-else class="text-muted">Changes off</span>
      <UIcon name="i-lucide-chevron-down" class="size-3.5 shrink-0 text-dimmed" />
    </UButton>
    <template #content>
      <ReportComparisonPanel @changes="showChanges" />
    </template>
  </UPopover>
</template>
