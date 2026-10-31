<script setup lang="ts">
/**
 * Prose as one side of the comparison reads it, or both at once: inserted
 * words underlined, removed words struck.
 */
import type { TextSegment } from 'pdd-toolkit/report/compare'
import type { ChangeReading } from '../utils/reportComparison'

defineProps<{ segments: TextSegment[], reading: ChangeReading }>()
</script>

<template>
  <span class="whitespace-pre-wrap">
    <template v-for="(segment, index) in segments" :key="index">
      <template v-if="segment.op === 'same'">{{ segment.text }}</template>
      <template v-else-if="reading === 'before'"><template v-if="segment.op === 'removed'">{{ segment.text }}</template></template>
      <template v-else-if="reading === 'after'"><template v-if="segment.op === 'added'">{{ segment.text }}</template></template>
      <ins v-else-if="segment.op === 'added'" class="report-ins"><span class="sr-only">Added: </span>{{ segment.text }}</ins>
      <del v-else class="report-del"><span class="sr-only">Removed: </span>{{ segment.text }}</del>
    </template>
  </span>
</template>
