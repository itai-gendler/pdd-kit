<script setup lang="ts">
/**
 * One sentence of a change brief. Each resource it names opens; one that only
 * the baseline holds is struck. In a list of changes, the resource the change
 * is read on — itself, or a Scenario's parent — opens on its Changes reading,
 * since that is what the reader clicked the change for.
 */
import type { ComparedRef, Phrase } from 'pdd-toolkit/report/compare'
import { resourceOpenerKey } from '../utils/resourceNavigation'
import { viewerKind } from '../utils/reportComparison'

const props = defineProps<{ phrase: Phrase, reading?: { keys: string[], key: string } }>()
const open = inject(resourceOpenerKey, () => {})
const keyOf = (ref: ComparedRef) => `${viewerKind(ref.kind)}:${ref.id}`
const target = (ref: ComparedRef) => props.reading?.keys.includes(keyOf(ref))
  ? { key: props.reading.key, tab: 'changes' } : { key: keyOf(ref), tab: undefined }
</script>

<template>
  <span class="min-w-0">
    <template v-for="(part, index) in phrase" :key="index">
      <template v-if="'text' in part">{{ part.text }}</template>
      <span v-else-if="part.ref.removed || part.ref.kind === 'product'" :class="part.ref.removed ? 'report-removed-title' : 'font-medium text-highlighted'">{{ part.ref.title }}</span>
      <ReportResourceLink
        v-else
        :resource-key="target(part.ref).key"
        :tab="target(part.ref).tab"
        class="font-medium text-highlighted underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4 hover:decoration-current"
        @open="open(target(part.ref).key, target(part.ref).tab)"
      >{{ part.ref.title }}</ReportResourceLink>
    </template>
  </span>
</template>
