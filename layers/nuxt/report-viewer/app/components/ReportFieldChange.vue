<script setup lang="ts">
/**
 * One field that differs between the baseline and the current model, drawn by
 * its shape: prose word by word, a value as before and after, a list as what
 * joined and what left, Steps lined up as a code diff lines up lines.
 */
import type { ComparedItem, ComparedRef, FieldChange } from 'pdd-toolkit/report/compare'
import { resourceOpenerKey } from '../utils/resourceNavigation'
import { viewerKind, type ChangeReading } from '../utils/reportComparison'

const props = withDefaults(defineProps<{ change: FieldChange, reading: ChangeReading, nested?: boolean }>(), { nested: false })
const open = inject(resourceOpenerKey, () => {})
const refKey = (ref: ComparedRef) => `${viewerKind(ref.kind)}:${ref.id}`

/* A list reads, in Before, what it held; in After, what it holds; in Changes, the difference. */
const listRows = computed(() => {
  const change = props.change
  if (change.shape !== 'list') return []
  const rows: Array<{ status: 'added' | 'removed' | 'modified', item: ComparedItem, before?: ComparedItem, details?: FieldChange[] }> = []
  if (props.reading !== 'before') rows.push(...change.added.map(item => ({ status: 'added' as const, item })))
  rows.push(...change.changed.map(entry => ({ status: 'modified' as const, item: props.reading === 'before' ? entry.before : entry.after, before: entry.before, details: entry.details })))
  if (props.reading !== 'after') rows.push(...change.removed.map(item => ({ status: 'removed' as const, item })))
  return rows
})
const steps = computed(() => props.change.shape !== 'steps' ? []
  : props.change.steps.filter(step => props.reading === 'changes' || (props.reading === 'before' ? step.before : step.after)))
</script>

<template>
  <div class="min-w-0 space-y-1.5" data-field-change :data-field="change.field">
    <p class="report-field">{{ change.label }}</p>

    <!-- Prose -->
    <p v-if="change.shape === 'text'" class="text-sm leading-6 text-default">
      <ReportChangeText v-if="(reading === 'before' ? change.before : reading === 'after' ? change.after : true)" :segments="change.segments" :reading="reading" />
      <span v-else class="text-muted italic">{{ reading === 'before' ? 'Not stated' : 'No longer stated' }}</span>
    </p>

    <!-- One value -->
    <p v-else-if="change.shape === 'value'" class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <template v-if="reading !== 'after'">
        <span :class="reading === 'changes' && 'report-del'">
          <ReportResourceLink v-if="change.beforeRef && !change.beforeRef.removed" :resource-key="refKey(change.beforeRef)" @open="open(refKey(change.beforeRef))">{{ change.before }}</ReportResourceLink>
          <template v-else>{{ change.before ?? 'None' }}</template>
        </span>
      </template>
      <UIcon v-if="reading === 'changes'" name="i-lucide-arrow-right" class="size-3.5 shrink-0 text-dimmed" aria-label="became" />
      <template v-if="reading !== 'before'">
        <span :class="reading === 'changes' && 'report-ins'">
          <ReportResourceLink v-if="change.afterRef && !change.afterRef.removed" :resource-key="refKey(change.afterRef)" @open="open(refKey(change.afterRef))">{{ change.after }}</ReportResourceLink>
          <template v-else>{{ change.after ?? 'None' }}</template>
        </span>
      </template>
    </p>

    <!-- A list -->
    <template v-else-if="change.shape === 'list'">
      <ul class="space-y-1">
        <li v-for="row in listRows" :key="`${row.status}:${row.item.key}`" class="flex min-w-0 items-start gap-2 text-sm">
          <ReportChangeMark v-if="reading === 'changes'" :status="row.status" size="xs" class="mt-0.5" :label="row.status === 'modified' ? 'Changed' : undefined" />
          <span class="min-w-0">
            <ReportResourceLink v-if="row.item.ref && !row.item.ref.removed && row.status !== 'removed'" :resource-key="refKey(row.item.ref)"
              class="text-highlighted underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4 hover:decoration-current"
              @open="open(refKey(row.item.ref))">{{ row.item.label }}</ReportResourceLink>
            <span v-else :class="row.status === 'removed' && reading === 'changes' && 'report-removed-title'">{{ row.item.label }}</span>
            <span v-if="row.before && reading === 'changes' && row.before.label !== row.item.label" class="block text-xs text-muted">was {{ row.before.label }}</span>
            <!-- What about a kept member changed, when its name alone does not say. -->
            <span v-if="reading === 'changes' && row.details?.length" class="mt-1.5 block space-y-1.5 border-s border-default ps-3">
              <ReportFieldChange v-for="detail in row.details" :key="detail.field" :change="detail" :reading="reading" nested />
            </span>
          </span>
        </li>
      </ul>
      <p v-if="change.reordered && reading === 'changes'" class="flex items-center gap-1.5 text-xs text-muted">
        <UIcon name="i-lucide-arrow-up-down" class="size-3.5" />Order changed
      </p>
    </template>

    <!-- Steps, lined up -->
    <ol v-else-if="change.shape === 'steps'" class="space-y-1.5" aria-label="Steps">
      <li v-for="(step, index) in steps" :key="index" class="report-step-change grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)] items-start gap-2 px-2.5 py-2 text-sm"
        :data-change="reading === 'changes' && step.status !== 'same' ? step.status : undefined">
        <span class="font-mono text-xs font-semibold" :style="{ color: reading === 'changes' && step.status !== 'same' ? `var(--report-change-${step.status})` : undefined }" aria-hidden="true">
          {{ reading === 'changes' ? { same: '', added: '+', modified: '~', removed: '−' }[step.status] : '' }}
        </span>
        <span class="font-mono text-xs text-dimmed tabular-nums" :title="reading === 'changes' && step.beforeIndex && step.afterIndex && step.beforeIndex !== step.afterIndex ? `Step ${step.beforeIndex} before, ${step.afterIndex} now` : undefined">
          {{ reading === 'before' ? step.beforeIndex : reading === 'after' ? step.afterIndex : step.afterIndex ?? step.beforeIndex }}
        </span>
        <span class="min-w-0">
          <span class="sr-only">{{ reading === 'changes' && step.status !== 'same' ? `${step.status}: ` : '' }}</span>
          <ReportChangeText :segments="step.text" :reading="reading" />
          <span v-if="reading === 'changes' && step.details.length" class="mt-1.5 block space-y-1.5 border-s border-default ps-3">
            <ReportFieldChange v-for="detail in step.details" :key="detail.field" :change="detail" :reading="reading" nested />
          </span>
        </span>
      </li>
    </ol>
  </div>
</template>
