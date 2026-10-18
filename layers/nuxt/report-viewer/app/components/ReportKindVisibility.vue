<script setup lang="ts">
/**
 * Which resource types a tree card collection draws.
 *
 * A drawing choice, so it sits with the drawing tools on the right of the filter
 * row, first in the group whose Expand all and Collapse all act on what it
 * leaves. One box per type in rail order; a type that hides with its parent is
 * indented under it and unavailable while the parent is hidden. Inline, for the
 * phone's list controls, it is the list without the button.
 */
import type { ReportResourceKind } from '../utils/reportWorkspace'
import { ENTITY_KIND_META } from '../utils/reportWorkspace'
import { TREE_KIND_CHOICES, TREE_KIND_PRESETS, hiddenTreeKinds } from '../utils/collectionChildren'

const props = defineProps<{ collection: ReportResourceKind, hidden: ReportResourceKind[], inline?: boolean }>()
const emit = defineEmits<{ hidden: [kinds: ReportResourceKind[]] }>()
const choices = computed(() => TREE_KIND_CHOICES[props.collection] ?? [])
const presets = computed(() => TREE_KIND_PRESETS[props.collection] ?? [])
const effective = computed(() => hiddenTreeKinds(props.collection, props.hidden))
const shown = computed(() => choices.value.filter(choice => !effective.value.has(choice.kind)).length)
const summary = computed(() => shown.value === choices.value.length ? 'All' : `${shown.value} ${shown.value === 1 ? 'type' : 'types'}`)
const presetOn = (hidden: ReportResourceKind[]) => hidden.length === props.hidden.length && hidden.every(kind => props.hidden.includes(kind))
const parentOf = (kind: ReportResourceKind) => choices.value.find(choice => choice.kind === kind)?.parent
function toggle(kind: ReportResourceKind, on: boolean | 'indeterminate') {
  emit('hidden', on === true ? props.hidden.filter(item => item !== kind) : [...props.hidden, kind])
}
</script>

<template>
  <UPopover v-if="!inline" :content="{ align: 'end', collisionPadding: 12 }">
    <UButton icon="i-lucide-layers" trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" size="sm"
      :aria-label="`Resource types shown: ${summary}`" data-kind-visibility :data-hidden-kinds="[...effective].join(' ')">
      Show <span class="text-xs text-muted tabular-nums">{{ summary }}</span>
    </UButton>
    <template #content>
      <div class="w-72 space-y-3 p-3">
        <ReportKindVisibility :collection="collection" :hidden="hidden" inline @hidden="emit('hidden', $event)" />
      </div>
    </template>
  </UPopover>
  <div v-else class="space-y-3" role="group" aria-label="Resource types to show">
    <div v-if="presets.length" class="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
      <UButton v-for="preset in presets" :key="preset.id" :label="preset.label" size="xs" color="neutral"
        :variant="presetOn(preset.hidden) ? 'solid' : 'outline'" :aria-pressed="presetOn(preset.hidden)" @click="emit('hidden', preset.hidden)" />
    </div>
    <ul class="space-y-1 border-t border-default pt-2">
      <li v-for="choice in choices" :key="choice.kind" :class="choice.parent ? 'ps-6' : ''">
        <UCheckbox :model-value="!effective.has(choice.kind)" :disabled="Boolean(choice.parent && effective.has(choice.parent))"
          :data-kind-choice="choice.kind" @update:model-value="toggle(choice.kind, $event)">
          <template #label>
            <span class="inline-flex items-center gap-1.5">
              <ReportKind :kind="choice.kind" size="xs" :labelled="false" />{{ ENTITY_KIND_META[choice.kind].plural }}
            </span>
          </template>
          <template v-if="parentOf(choice.kind) && effective.has(parentOf(choice.kind)!)" #description>
            Hidden with {{ ENTITY_KIND_META[parentOf(choice.kind)!].plural }}
          </template>
        </UCheckbox>
      </li>
    </ul>
    <p class="text-xs text-muted">Only how this tree is drawn changes. Filters and other collections are untouched.</p>
  </div>
</template>
