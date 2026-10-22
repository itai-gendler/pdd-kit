import type { ProductReport } from 'pdd-toolkit/report'
import { compareReports } from 'pdd-toolkit/report/compare'
import type { LocalIssue } from './useLocalProblems'

/**
 * Changes for `pdd-kit view`: which version of the model the files on disk
 * are compared with, chosen in the report itself.
 *
 * Two scopes. Uncommitted compares with the commit you are on. The other is
 * named for what it is measured from: where this branch left the default
 * branch (`Since origin/main`), what the default branch has not pushed yet
 * (`Not pushed`), or, on an up-to-date default branch, the last release
 * (`Since v1.2`). Its base can be another branch, a tag, or the commit that
 * created the model. The other side is always the working tree, which is the
 * report on screen. The choice lives in the address (`ch`, `from`), so Back and
 * a refresh keep it. The baseline is read from Git by the CLI and compared here.
 */

type VersionKind = 'head' | 'branch-base' | 'branch' | 'tag' | 'commit'

/** One version as the CLI names it. */
export interface LocalGitVersion {
  id: string
  kind: VersionKind
  label: string
  commit: string | null
  subject: string | null
  committedAt: string | null
  default?: boolean
}

/** `git/context.json`: where the reader stands. */
interface LocalGitContext {
  branch: string | null
  head: LocalGitVersion | null
  defaultBranch: LocalGitVersion | null
  branchBase: (LocalGitVersion & { ahead: number }) | null
  onDefault: boolean
  onDefaultBranch: boolean
  latestTag: LocalGitVersion | null
  modelCreated: LocalGitVersion | null
  scope: { staged: number, unstaged: number, untracked: number }
}

/** `git/model.json`: one version's model. */
interface LocalGitModel {
  version: LocalGitVersion
  state: 'ready' | 'absent' | 'blocked'
  report: ProductReport | null
  issues: LocalIssue[]
}

type Side = { model: LocalGitModel } | { error: string }

const SCOPES = ['uncommitted', 'branch'] as const
type Scope = typeof SCOPES[number]

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
const short = (commit: string | null | undefined) => commit?.slice(0, 7) ?? ''

/** What the working tree holds beyond the last commit, so the reader knows what "now" means: `1 staged and 2 unstaged changes`. */
function uncommitted(scope: LocalGitContext['scope']): string | null {
  const parts = ([['staged', scope.staged], ['unstaged', scope.unstaged], ['untracked', scope.untracked]] as const)
    .filter(([, count]) => count).map(([name, count]) => `${count} ${name}`)
  if (!parts.length) return null
  const total = scope.staged + scope.unstaged + scope.untracked
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]
  return `${list} ${total === 1 ? 'change' : 'changes'}`
}

/** A version as the report's base menu draws it. */
function choice(version: LocalGitVersion) {
  return {
    id: version.id,
    kind: version.kind,
    label: version.label,
    revision: short(version.commit) || undefined,
    detail: version.subject ?? undefined,
    date: version.committedAt ?? undefined,
    badges: version.default ? ['Default'] : undefined
  }
}

/** A version's name from its id alone, until Git has answered for it. */
const idLabel = (id: string) => id.replace(/^(?:branch|tag):refs\/(?:heads|remotes|tags)\//, '').replace(/^commit:(.{7}).*/, '$1')

export function useLocalChanges(live: Ref<ProductReport | null | undefined>) {
  const route = useRoute()
  const router = useRouter()
  const one = (key: string) => typeof route.query[key] === 'string' && route.query[key] ? route.query[key] as string : null

  /** Undefined until the CLI answers; null when the model is not in Git. */
  const context = ref<LocalGitContext | null | undefined>(undefined)
  const base = ref<Side | null>(null)
  /* Which baseline `base` was read for: a new one never draws under the old one's name. */
  const loadedFor = ref('')

  /*
   * What the second scope is measured from unless the reader picks: where the
   * branch left the default branch, or, on the default branch with nothing to
   * push, the last release. With neither, there is only Uncommitted.
   */
  const defaultBase = computed<string | null>(() => {
    const git = context.value
    if (!git?.head) return null
    if (git.branchBase && !(git.onDefault && git.onDefaultBranch)) return 'branch-base'
    return git.latestTag?.id ?? null
  })
  const branchFrom = computed(() => context.value?.head ? one('from') ?? defaultBase.value : null)
  const scope = computed<Scope>(() => one('ch') === 'branch' && branchFrom.value ? 'branch' : 'uncommitted')
  const from = computed(() => scope.value === 'branch' ? branchFrom.value! : 'head')

  function navigate(next: { ch?: Scope, from?: string | null }) {
    const ch = next.ch ?? scope.value
    const picked = next.from === undefined ? one('from') : next.from
    void router.push({ query: { ...route.query, ch: ch === 'uncommitted' ? undefined : ch, from: picked ?? undefined } })
  }
  /* Picking the default again leaves the address clean. */
  function chooseBase(id: string) {
    const git = context.value
    const isDefault = id === defaultBase.value || (defaultBase.value === 'branch-base' && id === git?.defaultBranch?.id)
    navigate({ ch: 'branch', from: isDefault ? null : id })
  }

  async function refreshContext() {
    try {
      context.value = await $fetch<LocalGitContext>('/_pdd-kit/git/context.json', { cache: 'no-store' })
    } catch (error) {
      /* 404: not in Git. Anything else keeps what is on screen until the next event. */
      if ((error as { statusCode?: number }).statusCode === 404 || context.value === undefined) context.value = null
    }
  }

  async function read(id: string): Promise<Side> {
    try {
      return { model: await $fetch<LocalGitModel>('/_pdd-kit/git/model.json', { query: { version: id }, cache: 'no-store' }) }
    } catch (error) {
      return { error: (error as { data?: { message?: string } }).data?.message ?? 'Git could not be read.' }
    }
  }

  /* Only the latest request draws: switching quickly never shows a stale answer. */
  let request = 0
  async function load() {
    if (!context.value) return
    const current = ++request
    const wanted = from.value
    const next = await read(wanted)
    if (current !== request) return
    base.value = next
    loadedFor.value = wanted
  }
  /* Bumped whenever Git says a ref moved, which can move a picked base without moving anything else. */
  const refsMoved = ref(0)
  /* A new commit or a moved branch re-reads the baseline, keeping the old one on screen meanwhile; a save does not. */
  const commits = computed(() => context.value
    ? JSON.stringify([context.value.head?.commit, context.value.branchBase?.commit, context.value.branch, refsMoved.value])
    : '')
  watch([from, commits], () => void load())

  /*
   * Each scope's count, so the reader sees where the changes are before
   * switching: its baseline read once per commit, compared with every
   * recompile. A baseline that cannot be read or built has no count.
   */
  const scopeBases = ref<{ key: string, uncommitted?: ProductReport | null, branch?: ProductReport | null }>({ key: '' })
  const basesKey = computed(() => `${commits.value}\n${branchFrom.value ?? ''}`)
  const usable = (side: Side | null) => side && 'model' in side && side.model.state !== 'blocked' ? side.model.report : undefined
  async function loadScopeBases() {
    const git = context.value
    if (!git?.head) return
    const wanted = basesKey.value
    const branch = branchFrom.value
    const [head, measured] = await Promise.all([read('head'), branch ? read(branch) : Promise.resolve(null)])
    if (wanted !== basesKey.value) return
    scopeBases.value = { key: wanted, uncommitted: usable(head), branch: usable(measured) }
  }
  watch(basesKey, () => void loadScopeBases())
  const scopeCounts = computed(() => {
    const report = live.value
    const bases = scopeBases.value
    if (!report || bases.key !== basesKey.value) return {}
    const count = (base: ProductReport | null | undefined) => base === undefined ? undefined : compareReports(base, report).changes.length
    return { uncommitted: count(bases.uncommitted), branch: count(bases.branch) }
  })

  /** The version a scope is measured from, as Git named it once read, else from its id. */
  function versionOf(id: string): LocalGitVersion {
    const git = context.value
    const side = loadedFor.value === id ? base.value : null
    if (side && 'model' in side) return side.model.version
    if (id === 'head' && git?.head) return git.head
    if (id === 'branch-base' && git?.branchBase) return git.branchBase
    if (id === git?.latestTag?.id) return git.latestTag
    if (id === git?.modelCreated?.id) return git.modelCreated
    const kind: VersionKind = id.startsWith('tag:') ? 'tag' : id.startsWith('branch:') ? 'branch' : 'commit'
    return { id, kind, label: idLabel(id), commit: null, subject: null, committedAt: null }
  }
  const createdFrom = (id: string | null) => Boolean(id && id === context.value?.modelCreated?.id)

  /** The second scope's name says what it is measured from. */
  function branchLabel(id: string): string {
    const git = context.value
    if (id === 'branch-base' && git?.onDefaultBranch) return 'Not pushed'
    if (createdFrom(id)) return 'Since the model was created'
    return `Since ${versionOf(id).label}`
  }
  function branchDescription(id: string): string {
    const git = context.value
    const branch = git?.branch ?? 'HEAD'
    const version = versionOf(id)
    if (id === 'branch-base' && git?.onDefaultBranch) return `Your commits on ${branch} that ${version.label} does not have yet, and your uncommitted changes.`
    if (id === 'branch-base') return `Everything since ${branch} left ${version.label}: ${plural(git?.branchBase?.ahead ?? 0, 'commit')} and your uncommitted changes.`
    if (createdFrom(id)) return `Everything since this branch created the Product Model in ${short(version.commit)}.`
    if (version.kind === 'branch') return `Everything since ${branch} left ${version.label}, and your uncommitted changes.`
    return `Everything since ${version.label}, and your uncommitted changes.`
  }

  /** One line under the scopes saying exactly what is compared, commit included. */
  function scopeLine(git: LocalGitContext, id: string): string {
    const working = uncommitted(git.scope)
    const version = versionOf(id)
    const at = version.commit ? ` at ${short(version.commit)}` : ''
    const branch = git.branch ?? 'HEAD'
    let line: string
    if (id === 'head') line = `Since your last commit on ${branch}${at}`
    else if (id === 'branch-base' && git.onDefaultBranch) line = `${plural(git.branchBase?.ahead ?? 0, 'commit')} on ${branch} not yet on ${version.label}${at}`
    else if (id === 'branch-base') line = `${git.branchBase?.ahead ? plural(git.branchBase.ahead, 'commit') : 'No commits'} on ${branch} since it left ${version.label}${at}`
    else if (createdFrom(id)) line = `Since this branch created the Product Model${at}`
    else if (version.kind === 'branch') line = `Since ${branch} left ${version.label}${at}`
    else line = `Since ${version.label}${at}`
    if (!working) return `${line}.`
    return id === 'head' ? `${line}: your ${working} in product-model/.` : `${line}, plus your ${working} in product-model/.`
  }

  async function search(query: string) {
    const page = await $fetch<{ versions: LocalGitVersion[], more: boolean }>('/_pdd-kit/git/versions.json', { query: { q: query }, cache: 'no-store' })
    return { versions: page.versions.map(choice), more: page.more }
  }

  /** The two scopes in the reader's words; the second only while it has something to measure from. */
  const scopes = computed(() => {
    const git = context.value
    const branch = git?.branch ?? 'HEAD'
    const measured = branchFrom.value
    const selected = measured === 'branch-base' && git?.defaultBranch ? git.defaultBranch.id : measured
    const created = git?.modelCreated
    return [
      { id: 'uncommitted', label: 'Uncommitted', description: `What you changed since your last commit on ${branch}, saved or staged.`, disabled: !git?.head, count: scopeCounts.value.uncommitted },
      ...(measured ? [{
        id: 'branch',
        label: branchLabel(measured),
        description: branchDescription(measured),
        count: scopeCounts.value.branch,
        base: {
          selected: selected!,
          search,
          extra: created ? [{ ...choice(created), label: 'When the model was created', detail: `${short(created.commit)} · ${created.subject ?? ''}`.replace(/ · $/, '') }] : [],
          choose: chooseBase
        }
      }] : [])
    ]
  })

  const comparison = computed(() => {
    const git = context.value
    if (!git) return null
    const side = loadedFor.value === from.value ? base.value : null
    const version = versionOf(from.value)
    const choices = { scopes: scopes.value, scope: scope.value, setScope: (id: string) => navigate({ ch: id as Scope }) }
    const label = from.value === 'head' ? (git.branch ? `HEAD (${git.branch})` : 'HEAD (detached)') : version.label
    const baseline = { label, revision: short(version.commit) || undefined, detail: version.subject ?? undefined }
    const line = scopeLine(git, from.value)
    if (!side) return { before: null, baseline, scope: line, pending: true, choices }

    if ('error' in side) return { before: null, baseline, choices, unavailable: { title: 'This version could not be read', description: side.error } }
    if (side.model.state === 'blocked') {
      const errors = side.model.issues.filter(issue => issue.severity === 'error').length
      return {
        before: null, baseline, choices,
        unavailable: {
          title: `The model in ${side.model.version.label} does not build`,
          description: `${plural(errors || 1, 'problem')} stop this version of pdd-kit from compiling the Product Model at ${short(side.model.version.commit)}, so there is nothing to compare. Your current report is unaffected; pick another version.`
        }
      }
    }
    return { before: side.model.report, baseline, scope: line, choices }
  })

  /** Git moved a ref: read where the reader stands again, then every baseline on screen. */
  async function gitMoved() {
    await refreshContext()
    refsMoved.value++
  }

  return { context, comparison, refreshContext, gitMoved }
}
