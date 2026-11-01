<script setup lang="ts">
/** How a resource changed: a glyph and a word in the change's tone, never the tone alone. */
import type { ChangeStatus } from 'pdd-toolkit/report/compare'
import { CHANGE_META } from '../utils/reportComparison'

withDefaults(defineProps<{ status: ChangeStatus, label?: string, size?: 'xs' | 'sm', title?: string }>(), { size: 'sm' })
</script>

<template>
  <span class="report-change-mark" :data-change="status" :data-size="size" :title="title" data-change-mark>
    <span class="report-change-mark__glyph" aria-hidden="true">{{ CHANGE_META[status].glyph }}</span>
    <span>{{ label ?? CHANGE_META[status].label }}</span>
  </span>
</template>
