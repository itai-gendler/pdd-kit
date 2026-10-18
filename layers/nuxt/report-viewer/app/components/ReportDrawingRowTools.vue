<script setup lang="ts">
import type { ColumnChoice } from '../composables/useColumns'
import { COLUMN_CHOICES } from '../composables/useColumns'
import type { ReportResourceKind } from '../utils/reportWorkspace'
/* Show leads the group: Expand all and Collapse all act on the types it leaves drawn. */
defineProps<{ columns: ColumnChoice, expandsAnything: boolean, compact?: boolean, kindsOf?: ReportResourceKind, hiddenKinds?: ReportResourceKind[] }>()
const emit = defineEmits<{ columns: [value: ColumnChoice], toggleAll: [open: boolean], hiddenKinds: [kinds: ReportResourceKind[]] }>()
const items = COLUMN_CHOICES.map(value => ({ value, label: `${value} per row` }))
</script>
<template>
  <div class="flex items-center gap-2">
    <UFieldGroup v-if="expandsAnything" size="sm" data-expand-all>
      <ReportKindVisibility v-if="kindsOf && !compact" :collection="kindsOf" :hidden="hiddenKinds ?? []" @hidden="emit('hiddenKinds', $event)" />
      <UTooltip text="Expand all groups"><UButton icon="i-lucide-maximize-2" color="neutral" variant="outline" aria-label="Expand all" @click="emit('toggleAll', true)" /></UTooltip>
      <UTooltip text="Collapse all groups"><UButton icon="i-lucide-minimize-2" color="neutral" variant="outline" aria-label="Collapse all" @click="emit('toggleAll', false)" /></UTooltip>
    </UFieldGroup>
    <USelect v-if="!compact" :model-value="columns" :items="items" value-key="value" size="sm" variant="outline"
      class="w-28 md:w-36" icon="i-lucide-layout-grid" aria-label="Rows per line" data-columns-control @update:model-value="emit('columns', $event as ColumnChoice)" />
  </div>
</template>
