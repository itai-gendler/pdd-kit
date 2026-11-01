<script setup lang="ts">
/**
 * One row of Changes: a resource's change, a Domain move, or References
 * updated on several resources of one type.
 *
 * A resource's change leads with its sentence and opens on its Changes
 * reading; what it contains, new or removed with it, is counted on it. A move
 * and a References row stand for several resources and list them in place.
 * The Product and removals have no reading to open, so they too read in place.
 */
import type { ResourceChange } from 'pdd-toolkit/report/compare'
import type { ReportWorkspace } from '../utils/reportWorkspace'
import { ENTITY_KIND_META } from '../utils/reportWorkspace'
import { resourceAncestors } from '../utils/reportDestinations'
import { REPORT_COMPARISON, changeResource, readingKeyOf, viewerKind, type ChangeEntry } from '../utils/reportComparison'
import { resourceOpenerKey } from '../utils/resourceNavigation'

const props = defineProps<{ entry: ChangeEntry, workspace: ReportWorkspace, expanded: boolean }>()
const emit = defineEmits<{ activate: [] }>()
const context = inject(REPORT_COMPARISON, ref(null))
const open = inject(resourceOpenerKey, () => {})

const kindOf = (change: ResourceChange) => ENTITY_KIND_META[viewerKind(change.kind)]
/* Inside its Capability or Journey, a Scenario is just a Scenario. */
const plural = (count: number, change: ResourceChange) => change.parent
  ? `${count} ${count === 1 ? 'Scenario' : 'Scenarios'}`
  : `${count} ${count === 1 ? kindOf(change).label : kindOf(change).plural}`
const names = (list: ResourceChange[], shown = 3) => list.length <= shown + 1
  ? list.map(change => change.title).join(', ').replace(/, ([^,]*)$/, ' and $1')
  : `${list.slice(0, shown).map(change => change.title).join(', ')} and ${list.length - shown} more`

/* The Product and removals are read here; a move and a References row list their resources here. */
const inPlace = computed(() => props.entry.type !== 'change' || props.entry.change.kind === 'product' || props.entry.change.status === 'removed')
const change = computed(() => props.entry.type === 'change' ? props.entry.change : null)
const status = computed(() => change.value?.status ?? 'modified')

/* Naming the changed resource, or a Scenario's parent, in its sentence opens the same Changes reading the row does. */
const reading = computed(() => {
  const key = change.value && !inPlace.value ? readingKeyOf(change.value) : null
  return key && change.value ? { keys: [change.value.key, key], key } : undefined
})
/* Counterparts — the web and the mobile Screen of one name — differ by where they sit, so the row says it. */
const place = computed(() => {
  const item = change.value
  if (!item || !context.value) return ''
  if (item.parent) return item.parent.title
  const side = item.status === 'removed' ? context.value.before : props.workspace
  const resource = changeResource(context.value, props.workspace, item)
  return resource && side ? resourceAncestors(side, resource).at(-1)?.title ?? '' : ''
})
/* What is new or removed with it, by type: "with 2 Experiences and 10 Screens". */
const folded = computed(() => {
  if (props.entry.type !== 'change' || !props.entry.folded.length) return ''
  const byKind = new Map<string, ResourceChange[]>()
  for (const item of props.entry.folded) byKind.set(item.kind, [...byKind.get(item.kind) ?? [], item])
  const parts = [...byKind.values()].map(list => plural(list.length, list[0]!))
  return `with ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}`
})
const movedOut = computed(() => change.value?.kind === 'domain' ? context.value?.moves.get(change.value.key)?.out.length ?? 0 : 0)
const mark = computed(() => {
  if (props.entry.type !== 'change') return { status: 'modified' as const, label: `${props.entry.changes.length}` }
  const item = props.entry.change
  return { status: item.status, label: item.status === 'modified' ? `${item.fields.length} ${item.fields.length === 1 ? 'field' : 'fields'}` : undefined }
})
const label = computed(() => {
  const entry = props.entry
  if (entry.type === 'move') return `${moveWords(entry.from?.title, entry.to?.title)}: ${names(entry.changes)}`
  if (entry.type === 'references') return `References updated on ${plural(entry.changes.length, entry.changes[0]!)}`
  return entry.change.title
})
/* "Moved from Runs to Briefs", or, with no Domain on one side, "Now in Briefs" and "No longer in Runs". */
function moveWords(from?: string, to?: string) {
  if (from && to) return `Moved from ${from} to ${to}`
  return to ? `Now in ${to}` : `No longer in ${from}`
}
const lead = (item: ResourceChange) => context.value && item.status === 'removed' ? changeResource(context.value, props.workspace, item)?.lead ?? '' : ''
const openChange = (item: ResourceChange) => {
  const key = readingKeyOf(item)
  if (key) open(key, 'changes')
}
</script>

<template>
  <div class="relative" data-change-item :data-change-key="entry.key" :data-change-entry="entry.type">
    <div class="report-resource-row group relative flex w-full items-start gap-3 overflow-hidden rounded-[0.625rem] border border-default bg-default px-3.5 py-2 text-start transition hover:border-accented hover:bg-elevated/40"
      :data-change-row="status">
      <!-- The full-card target sits behind the sentence, whose own resource links stay clickable. -->
      <button type="button" class="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :aria-expanded="inPlace ? expanded : undefined"
        :aria-label="inPlace ? `${expanded ? 'Hide' : 'Show'} ${label}` : `Open the changes to ${kindOf(change!).label} ${change!.title}`"
        @click="emit('activate')" />
      <UIcon v-if="entry.type === 'move'" name="i-lucide-move-right" class="pointer-events-none relative mt-1 size-4 shrink-0 text-dimmed" />
      <UIcon v-else-if="entry.type === 'references'" name="i-lucide-paperclip" class="pointer-events-none relative mt-1 size-4 shrink-0 text-dimmed" />
      <ReportKind v-else :kind="viewerKind(change!.kind)" :labelled="false" class="pointer-events-none relative mt-0.5" />
      <span class="pointer-events-none relative min-w-0 flex-1 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <!-- A move -->
        <span v-if="entry.type === 'move'" class="block text-sm leading-6 font-medium text-default">
          <template v-if="entry.from && entry.to">Moved from <span :class="entry.from.removed ? 'report-removed-title' : 'text-highlighted'">{{ entry.from.title }}</span> to <ReportChangePhrase :phrase="[{ ref: entry.to }]" /></template>
          <template v-else-if="entry.to">Now in <ReportChangePhrase :phrase="[{ ref: entry.to }]" /></template>
          <template v-else-if="entry.from">No longer in <span :class="entry.from.removed ? 'report-removed-title' : 'text-highlighted'">{{ entry.from.title }}</span></template><span class="text-muted">: {{ names(entry.changes) }}</span>
        </span>
        <!-- References only -->
        <span v-else-if="entry.type === 'references'" class="block text-sm leading-6 font-medium text-default">
          References updated on {{ plural(entry.changes.length, entry.changes[0]!) }}<span class="font-normal text-muted"> · {{ names(entry.changes) }}</span>
        </span>
        <!-- A Domain merged into the one its resources went to -->
        <span v-else-if="entry.mergedInto?.length" class="block text-sm leading-6 font-medium text-default">
          Domain <span class="report-removed-title">{{ change!.title }}</span>
          {{ entry.mergedInto.length === 1 ? 'merged into' : 'split between' }}
          <template v-for="(target, index) in entry.mergedInto" :key="target.id"><template v-if="index">{{ index === entry.mergedInto.length - 1 ? ' and ' : ', ' }}</template><ReportChangePhrase :phrase="[{ ref: target }]" /></template>
        </span>
        <template v-else>
          <span class="block text-sm leading-6 font-medium text-default">
            <ReportChangePhrase :phrase="change!.phrases[0]!" :reading="reading" />
            <span class="font-normal text-dimmed"> · {{ kindOf(change!).label }}<template v-if="place"> in {{ place }}</template></span>
          </span>
          <span v-for="(phrase, index) in change!.phrases.slice(1)" :key="index" class="block text-sm leading-6 text-default"><ReportChangePhrase :phrase="phrase" :reading="reading" /></span>
        </template>
        <span v-if="folded || entry.type === 'change' && (entry.moved || movedOut)" class="block text-xs text-muted">
          <template v-if="folded">{{ folded }}</template>
          <template v-if="entry.type === 'change' && entry.moved">{{ folded ? ' · ' : '' }}also {{ moveWords(entry.moved.from?.title, entry.moved.to?.title).replace(/^./, letter => letter.toLowerCase()) }}</template>
          <template v-if="movedOut">{{ movedOut }} {{ movedOut === 1 ? 'resource' : 'resources' }} moved out of it</template>
        </span>
      </span>
      <ReportChangeMark class="pointer-events-none relative mt-0.5" :status="mark.status" :label="mark.label" />
      <UIcon :name="inPlace ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="pointer-events-none relative mt-1 size-4 shrink-0 text-dimmed transition"
        :class="inPlace && expanded && 'rotate-180'" />
    </div>

    <div v-if="inPlace && expanded" class="mt-1 space-y-3 rounded-[0.625rem] border border-dashed border-default p-4" data-change-detail>
      <!-- The resources a move or a References row stands for, each opening its own Changes reading. -->
      <ul v-if="entry.type !== 'change'" class="grid gap-1.5 sm:grid-cols-2">
        <li v-for="item in entry.changes" :key="item.key" class="flex min-w-0 items-center gap-2 text-sm">
          <ReportKind :kind="viewerKind(item.kind)" :labelled="false" size="xs" />
          <ReportResourceLink :resource-key="readingKeyOf(item) ?? item.key" tab="changes" class="min-w-0 truncate text-highlighted underline decoration-dotted decoration-(--ui-border-accented) underline-offset-4 hover:decoration-current" @open="openChange(item)">{{ item.title }}</ReportResourceLink>
        </li>
      </ul>
      <template v-else-if="entry.change.kind === 'product' && entry.change.fields.length">
        <ReportFieldChange v-for="field in entry.change.fields" :key="field.field" :change="field" reading="changes" />
      </template>
      <template v-else>
        <p class="report-field">What {{ context?.input.baseline.label }} said</p>
        <p class="text-sm leading-6 text-muted">{{ lead(entry.change) || 'Nothing beyond its title.' }}</p>
        <template v-if="entry.folded.length">
          <p class="report-field">Removed with it</p>
          <ul class="grid gap-1 sm:grid-cols-2">
            <li v-for="item in entry.folded" :key="item.key" class="flex min-w-0 items-center gap-2 text-sm text-muted">
              <ReportKind :kind="viewerKind(item.kind)" :labelled="false" size="xs" /><span class="report-removed-title min-w-0 truncate">{{ item.title }}</span>
            </li>
          </ul>
        </template>
      </template>
    </div>
  </div>
</template>
