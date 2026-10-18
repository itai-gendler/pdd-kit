<script setup lang="ts">
/** One preview-card picker changes only the drawing of the collection. */
import type { CollectionControlsProps, CollectionDrawing } from '../utils/collectionControls'
import type { ColumnChoice } from '../composables/useColumns'
import { collectionDrawingChoices } from '../utils/collectionDrawings'
import type { ReportResourceKind } from '../utils/reportWorkspace'

const props = defineProps<CollectionControlsProps>()
const emit = defineEmits<{ drawing: [value: CollectionDrawing], columns: [value: ColumnChoice], toggleAll: [open: boolean], hiddenKinds: [kinds: ReportResourceKind[]] }>()
const choices = computed(() => collectionDrawingChoices(props.kind))
const current = computed(() => choices.value.find(item => item.id === props.drawing) ?? choices.value[0]!)
const matrixMode = computed(() => props.kind === 'rule' ? 'rules' : props.kind === 'capability' ? 'delivery' : 'mutations')
const pickerOpen = ref(false)
function choose(id: CollectionDrawing) { pickerOpen.value = false; emit('drawing', id) }
watch([() => props.kind, () => props.drawing], () => { pickerOpen.value = false })
</script>
<template>
  <div class="report-drawing-controls">
    <!-- Auxiliary controls grow to the left; the view chooser is always last. -->
    <ReportDrawingRowTools v-if="drawing === 'rows'" class="hidden sm:flex" :columns="columns" :expands-anything="expandsAnything"
      :kinds-of="kindsOf" :hidden-kinds="hiddenKinds"
      @columns="emit('columns', $event)" @toggle-all="emit('toggleAll', $event)" @hidden-kinds="emit('hiddenKinds', $event)" />
    <ReportMatrixLegend v-if="drawing === 'matrix'" class="hidden sm:block" :mode="matrixMode" />

    <div v-if="choices.length > 1" class="report-drawing-chooser" data-drawing-switch :data-current-drawing="drawing" role="group" aria-label="Collection view">
      <UPopover v-model:open="pickerOpen" :content="{ align: 'end', collisionPadding: 12 }" :ui="{ content: 'report-drawing-cards' }">
        <UButton :icon="current.icon" trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" size="sm"
          class="report-drawing-trigger" :aria-label="`Change view, current view: ${current.label}`" :ui="{ trailingIcon: 'ms-auto' }" data-view-trigger>
          <span class="truncate"><span class="hidden sm:inline">{{ current.label }}</span><span class="sm:hidden">{{ current.shortLabel }}</span></span>
        </UButton>
        <template #content>
          <p class="px-2 pb-2 text-xs text-muted">Choose a view · same filters</p>
          <div class="space-y-1" role="group" aria-label="View previews">
            <button v-for="choice in choices" :key="choice.id" type="button" class="report-drawing-card" :data-current="drawing === choice.id"
              :aria-pressed="drawing === choice.id" :aria-label="`Draw as ${choice.id}`" @click="choose(choice.id)">
              <ReportDrawingPreview :drawing="choice.id" />
              <span class="min-w-0"><span class="report-drawing-card-title block font-medium">{{ choice.label }}</span><span class="report-drawing-card-subtitle mt-1 block text-muted">{{ choice.description }}</span></span>
              <UIcon v-if="drawing === choice.id" name="i-lucide-check" class="size-4 shrink-0 text-primary" />
            </button>
          </div>
          <div v-if="drawing === 'rows' && expandsAnything" class="mt-3 border-t border-default pt-3 sm:hidden">
            <p class="mb-2 text-xs text-muted">List controls</p>
            <ReportDrawingRowTools :columns="columns" :expands-anything="expandsAnything" compact @toggle-all="emit('toggleAll', $event)" />
            <ReportKindVisibility v-if="kindsOf" class="mt-3" :collection="kindsOf" :hidden="hiddenKinds ?? []" inline @hidden="emit('hiddenKinds', $event)" />
          </div>
          <ReportMatrixLegend v-if="drawing === 'matrix'" class="mt-3 sm:hidden" :mode="matrixMode" />
        </template>
      </UPopover>
    </div>
  </div>
</template>
