<script setup lang="ts">
/**
 * A resource's Changes reading: how it differs from the baseline, field by
 * field, and — for a Capability or Journey — how each of its Scenarios does,
 * since Scenarios are read inside their parent. Before and After are complete
 * readings of the changed fields, so nothing the baseline said is lost.
 */
import type { Phrase, ResourceChange } from 'pdd-toolkit/report/compare'
import type { AnyResourceView, ReportWorkspace } from '../utils/reportWorkspace'
import { REPORT_COMPARISON, changeResource, domainMove, viewerKind, type ChangeReading } from '../utils/reportComparison'
import { resourceDomains } from '../utils/reportDestinations'
import { resourceOpenerKey } from '../utils/resourceNavigation'

const props = defineProps<{ workspace: ReportWorkspace, resource: AnyResourceView }>()
const context = inject(REPORT_COMPARISON, ref(null))
const open = inject(resourceOpenerKey, () => {})
const reading = ref<ChangeReading>('changes')
const readings: Array<{ id: ChangeReading, label: string }> = [
  { id: 'before', label: 'Before' }, { id: 'changes', label: 'Changes' }, { id: 'after', label: 'After' }
]

const own = computed(() => context.value?.byKey.get(props.resource.key) ?? null)
const children = computed(() => context.value?.children.get(props.resource.key) ?? [])
const baseline = computed(() => context.value?.input.baseline)

/*
 * A Domain's membership: what moved in or was added in it, and what moved out
 * or was removed from it. Only resources authored in one Domain count, so a
 * Screen reaching it through a Capability does not.
 */
const membership = computed(() => {
  if (props.resource.kind !== 'domain' || !context.value) return null
  const id = props.resource.id
  const ctx = context.value
  const authored = (kind: string) => kind === 'entity' || kind === 'capability'
  const inDomain = (change: ResourceChange) => {
    const resource = changeResource(ctx, props.workspace, change)
    const side = change.status === 'removed' ? ctx.before : props.workspace
    return Boolean(resource && side && resourceDomains(side, resource).some(domain => domain.id === id))
  }
  const moves = ctx.moves.get(props.resource.key)
  const joined = [
    ...(moves?.into ?? []).map(change => ({ change, note: domainMove(change)?.from ? `from ${domainMove(change)!.from!.title}` : 'from no Domain' })),
    ...ctx.comparison.changes.filter(change => change.status === 'added' && authored(change.kind) && inDomain(change)).map(change => ({ change, note: 'new' }))
  ]
  const left = [
    ...(moves?.out ?? []).map(change => ({ change, note: domainMove(change)?.to ? `to ${domainMove(change)!.to!.title}` : 'to no Domain' })),
    ...ctx.comparison.changes.filter(change => change.status === 'removed' && authored(change.kind) && inDomain(change)).map(change => ({ change, note: 'removed' }))
  ]
  return joined.length || left.length ? { joined, left } : null
})


/* Inside its parent's reading, a Scenario's sentence need not say which parent it is in. */
function inHere(phrase: Phrase): Phrase {
  const last = phrase.at(-1)
  const before = phrase.at(-2)
  return last && 'ref' in last && `${last.ref.kind}:${last.ref.id}` === props.resource.key && before && 'text' in before && /^ (?:in|from) $/.test(before.text)
    ? phrase.slice(0, -2) : phrase
}

function summary(change: ResourceChange): string {
  if (change.status === 'added') return `New since ${baseline.value?.label ?? 'the baseline'}.`
  if (change.status === 'removed') return `Present in ${baseline.value?.label ?? 'the baseline'}, gone now.`
  return ''
}
</script>

<template>
  <div class="space-y-5" data-resource-changes>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="flex min-w-0 items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-git-compare" class="size-4 shrink-0 text-dimmed" />
        <span class="min-w-0">Since <span class="font-medium text-highlighted">{{ baseline?.label }}</span><span v-if="baseline?.revision && baseline.revision !== baseline.label" class="font-mono text-xs"> · {{ baseline.revision }}</span></span>
      </p>
      <UFieldGroup size="sm" role="group" aria-label="Read the change as">
        <UButton v-for="item in readings" :key="item.id" :label="item.label" color="neutral" :variant="reading === item.id ? 'subtle' : 'outline'"
          :aria-pressed="reading === item.id" @click="reading = item.id" />
      </UFieldGroup>
    </div>

    <section v-if="own" class="space-y-3" data-own-change>
      <div class="flex flex-wrap items-center gap-2">
        <ReportChangeMark :status="own.status" />
        <span class="text-sm text-muted">{{ summary(own) }}</span>
      </div>
      <ul class="space-y-1 text-sm leading-6">
        <li v-for="(phrase, index) in own.phrases" :key="index"><ReportChangePhrase :phrase="phrase" /></li>
      </ul>
      <div v-if="own.fields.length" class="space-y-4 rounded-lg border border-default bg-elevated/20 p-4">
        <ReportFieldChange v-for="field in own.fields" :key="field.field" :change="field" :reading="reading" />
      </div>
    </section>

    <section v-if="membership" class="space-y-3" data-domain-membership>
      <div v-for="side in ([['Now holds', membership.joined], ['No longer holds', membership.left]] as const)" v-show="side[1].length" :key="side[0]" class="space-y-1.5">
        <h3 class="report-field">{{ side[0] }} <span class="report-meta">{{ side[1].length }}</span></h3>
        <ul class="grid gap-1 sm:grid-cols-2">
          <li v-for="item in side[1]" :key="item.change.key" class="flex min-w-0 items-center gap-2 text-sm">
            <ReportKind :kind="viewerKind(item.change.kind)" :labelled="false" size="xs" />
            <span v-if="item.change.status === 'removed'" class="report-removed-title min-w-0 truncate">{{ item.change.title }}</span>
            <ReportResourceLink v-else :resource-key="item.change.key" class="min-w-0 truncate text-highlighted hover:underline" @open="open(item.change.key)">{{ item.change.title }}</ReportResourceLink>
            <span class="shrink-0 text-xs text-muted">{{ item.note }}</span>
          </li>
        </ul>
      </div>
    </section>

    <section v-if="children.length" class="space-y-3" data-child-changes>
      <h3 class="report-field">Scenarios</h3>
      <article v-for="child in children" :key="child.key" class="space-y-3 rounded-lg border border-default p-4" :data-change-row="child.status">
        <header class="flex flex-wrap items-center gap-2">
          <ReportKind :kind="(child.kind as 'capability-scenario' | 'journey-scenario')" :labelled="false" size="xs" />
          <span v-if="child.status === 'removed'" class="report-removed-title text-[15px] font-semibold">{{ child.title }}</span>
          <ReportResourceLink v-else :resource-key="child.key" class="text-[15px] font-semibold text-highlighted hover:underline" @open="open(child.key)">{{ child.title }}</ReportResourceLink>
          <ReportChangeMark :status="child.status" :label="child.status === 'modified' ? `${child.fields.length} ${child.fields.length === 1 ? 'field' : 'fields'}` : undefined" />
        </header>
        <ul class="space-y-1 text-sm leading-6">
          <li v-for="(phrase, index) in child.phrases" :key="index"><ReportChangePhrase :phrase="inHere(phrase)" /></li>
        </ul>
        <div v-if="child.fields.length" class="space-y-4">
          <ReportFieldChange v-for="field in child.fields" :key="field.field" :change="field" :reading="reading" />
        </div>
      </article>
    </section>

    <p v-if="!own && !children.length && !membership" class="text-sm text-muted italic">Unchanged since {{ baseline?.label }}.</p>
  </div>
</template>
