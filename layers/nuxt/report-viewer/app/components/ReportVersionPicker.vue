<script setup lang="ts">
/** The caret beside a scope that opens what it can be measured from. */
import type { ComparisonBase } from '../utils/reportComparison'

defineProps<{ base: ComparisonBase, label: string }>()
const open = ref(false)
const list = useTemplateRef('list')
function focusList(event: Event) {
  event.preventDefault()
  void nextTick(() => list.value?.focus())
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start', collisionPadding: 12, onOpenAutoFocus: focusList }" :ui="{ content: 'w-88 max-w-[calc(100vw-1.5rem)] overflow-hidden' }">
    <UButton icon="i-lucide-chevron-down" color="neutral" variant="outline" size="sm" :aria-label="`${label}: measure from another branch or tag`"
      :title="'Measure from another branch or tag'" data-version-picker-trigger />
    <template #content>
      <p class="border-b border-default px-3 py-2 text-xs text-muted">Measure from</p>
      <ReportVersionList ref="list" :base="base" @chosen="open = false" />
    </template>
  </UPopover>
</template>
