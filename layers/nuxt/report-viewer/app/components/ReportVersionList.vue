<script setup lang="ts">
/**
 * What a scope can be measured from: branches, the default first, then
 * releases (tags), then the host's extra versions, such as the commit that
 * created the model. A search appears only when the list is long.
 */
import type { ComparisonBase, ComparisonVersion } from '../utils/reportComparison'

const props = defineProps<{ base: ComparisonBase }>()
const emit = defineEmits<{ chosen: [] }>()

/* Past this many, a search narrows the list. */
const SEARCH_AFTER = 8
const query = ref('')
const found = ref<ComparisonVersion[]>([])
const more = ref(false)
const loading = ref(false)
const failed = ref(false)
/* Once offered, the search stays, so narrowing never hides it. */
const searchable = ref(false)
const search = useTemplateRef('search')
const list = useTemplateRef<HTMLElement>('list')

const groups = computed(() => [
  { key: 'branch', label: 'Branches', versions: found.value.filter(version => version.kind === 'branch') },
  { key: 'tag', label: 'Releases', versions: found.value.filter(version => version.kind === 'tag') },
  { key: 'extra', label: '', versions: query.value ? [] : props.base.extra }
].filter(group => group.versions.length))

/* Only the latest request draws: a slow answer to an older query is dropped. */
let request = 0
async function load() {
  const current = ++request
  loading.value = true
  failed.value = false
  try {
    const page = await props.base.search(query.value)
    if (current !== request) return
    found.value = page.versions
    more.value = page.more
    if (page.more || page.versions.length > SEARCH_AFTER) searchable.value = true
  } catch {
    if (current === request) failed.value = true
  } finally {
    if (current === request) loading.value = false
  }
}
let timer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void load(), 180)
})
onMounted(() => void load())
onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

function choose(id: string) {
  props.base.choose(id)
  emit('chosen')
}
/* Arrow keys move from the search into the list and through it. */
function navigate(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
  const buttons = [...(list.value?.querySelectorAll<HTMLButtonElement>('[data-version-option]') ?? [])]
  if (!buttons.length) return
  event.preventDefault()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}
const when = (date?: string) => {
  if (!date) return ''
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
defineExpose({ focus: () => searchable.value ? search.value?.inputRef?.focus() : list.value?.querySelector<HTMLButtonElement>('[data-version-option]')?.focus() })
</script>

<template>
  <div data-version-picker @keydown="navigate">
    <div v-if="searchable" class="border-b border-default p-2">
      <UInput ref="search" v-model="query" size="sm" icon="i-lucide-search" :loading="loading" placeholder="Find a branch or tag…" aria-label="Find a branch or tag" class="w-full" />
    </div>
    <div ref="list" class="max-h-80 overflow-y-auto p-1" :aria-busy="loading">
      <div v-for="(group, index) in groups" :key="group.key" :class="index > 0 && 'mt-1 border-t border-default pt-1'" :data-version-group="group.key">
        <p v-if="group.label" class="px-2 pt-1.5 pb-1 font-mono text-[10px] tracking-widest text-dimmed uppercase">{{ group.label }}</p>
        <button v-for="version in group.versions" :key="version.id" type="button" data-version-option :data-version="version.id" :aria-pressed="version.id === base.selected"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none" :class="version.id === base.selected && 'bg-elevated/60'"
          @click="choose(version.id)">
          <ReportVersionMark :kind="version.kind" />
          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="truncate text-sm">{{ version.label }}</span>
              <span v-for="badge in version.badges ?? []" :key="badge" class="shrink-0 rounded-full border border-default px-1.5 text-[11px] text-muted">{{ badge }}</span>
            </span>
            <span class="block truncate text-xs text-muted">{{ group.key === 'extra' ? version.detail : [version.revision, version.detail].filter(Boolean).join(' · ') }}</span>
          </span>
          <span v-if="group.key !== 'extra'" class="shrink-0 text-[11px] text-dimmed">{{ when(version.date) }}</span>
          <UIcon v-if="version.id === base.selected" name="i-lucide-check" class="size-4 shrink-0" />
        </button>
      </div>
      <p v-if="!groups.length" class="px-3 py-5 text-center text-sm text-muted">
        {{ loading ? 'Looking…' : failed ? 'The branches could not be listed.' : query ? 'No branch or tag matches.' : 'There are no other branches or tags.' }}
      </p>
      <p v-else-if="more" class="px-2 py-1.5 text-xs text-dimmed">Search to find older branches and tags.</p>
    </div>
  </div>
</template>
