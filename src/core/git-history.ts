import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { buildViewerReportFrom } from '../commands/export.js'
import type { ModelIssue } from './model-issues.js'
import type { ProductReport } from './portable.js'

/**
 * Read the Product Model's history from Git's objects, for the report's Changes.
 *
 * Every command here only reads: nothing moves a ref, touches the index, or
 * writes into the worktree. A version is named by a stable id the page keeps in
 * its address and resolved again on every request, so a branch that moves is
 * followed and a commit stays put.
 */

/**
 * - `head`: the checked-out commit.
 * - `branch-base`: where the checked-out branch left the default branch.
 * - `branch:<ref>`: where `HEAD` left a branch under refs/heads or refs/remotes,
 *   its merge base, so work that branch gained since is never counted as yours.
 * - `tag:<ref>`: the commit a tag under refs/tags names.
 * - `commit:<sha>`: one commit, by its full name.
 */
export type GitVersionKind = 'head' | 'branch-base' | 'branch' | 'tag' | 'commit'

export interface GitVersion {
  id: string
  kind: GitVersionKind
  /** `main`, `origin/main`, `v1.2`, `2c01812`. */
  label: string
  commit: string | null
  subject: string | null
  committedAt: string | null
  /** The branch others merge into: the remote's default, else main or master. */
  default?: boolean
}

/** What the working tree holds beyond `HEAD` in `product-model/`, by Git's own account. */
export interface WorkingTreeScope {
  staged: number
  unstaged: number
  untracked: number
}

/** Where the reader stands, so the page can offer the comparisons that mean something here. */
export interface GitContext {
  /** The checked-out branch, or null when `HEAD` is detached. */
  branch: string | null
  /** The checked-out commit; null before the first commit. */
  head: GitVersion | null
  defaultBranch: GitVersion | null
  /** Where `HEAD` left the default branch, and how many commits it has made since. */
  branchBase: (GitVersion & { ahead: number }) | null
  /** Whether `HEAD` is the default branch itself, or sits on it. */
  onDefault: boolean
  /** Whether the checked-out branch is the default branch, or the local copy of a remote's. */
  onDefaultBranch: boolean
  /** The nearest tag `HEAD` contains, the last release it builds on. */
  latestTag: GitVersion | null
  /**
   * When the branch's starting point holds no Product Model, the commit on the
   * branch that created it: the first since then to touch it. Comparing from
   * there shows how the model changed, rather than all of it as new.
   */
  modelCreated: GitVersion | null
  scope: WorkingTreeScope
}

/** One version's Product Model, built the way the viewer builds the current one. */
export interface GitVersionModel {
  version: GitVersion
  /** `absent` when the version holds no Product Model; `blocked` when this pdd-kit cannot compile it. */
  state: 'ready' | 'absent' | 'blocked'
  report: ProductReport | null
  issues: ModelIssue[]
}

export interface GitVersionPage {
  versions: GitVersion[]
  more: boolean
}

export interface GitHistory {
  context: () => GitContext
  /** The default branch, then other branches and tags, newest first, without the checked-out branch; `query` matches names and subjects. */
  list: (query?: string) => GitVersionPage
  resolve: (id: string) => GitVersion
  model: (id: string) => GitVersionModel
  /** Changes whenever a ref or `HEAD` moves; cheap enough to ask every second. */
  revision: () => string
}

/** A version that does not resolve; its message is written for the reader. */
export class GitVersionError extends Error {}

/* Generated folders are never authored meaning, even when someone committed them. */
const GENERATED = new Set(['build', 'cache'])
const PAGE_SIZE = 60
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/
const REF = /^refs\/(?:heads|remotes|tags)\/[^\0]+$/
/* The models of the last few versions read, so switching back and forth is instant. */
const MODEL_CACHE = 6

interface GitResult { status: number, stdout: Buffer, stderr: string }

/** Run Git without a shell, without hooks, without a pager and without optional locks. */
function run(cwd: string, args: string[], input?: string): GitResult {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '--no-pager', '--literal-pathspecs', '-C', cwd, ...args], {
    input, maxBuffer: 512 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? Buffer.alloc(0), stderr: result.stderr?.toString('utf8').trim() ?? '' }
}

function output(cwd: string, args: string[]): string | null {
  const result = run(cwd, args)
  return result.status === 0 ? result.stdout.toString('utf8').trim() : null
}

/** Repository-relative POSIX path of a model's `product-model/`. */
function modelPath(gitRoot: string, modelRoot: string): string {
  const prefix = relative(gitRoot, modelRoot).split(sep).filter(Boolean).join('/')
  return prefix ? `${prefix}/product-model` : 'product-model'
}

/** Counts of `product-model/` paths that differ from `HEAD`, as `git status` sees them; ignored files never count. */
export function workingTreeScope(gitRoot: string, modelRoot: string): WorkingTreeScope {
  const scope: WorkingTreeScope = { staged: 0, unstaged: 0, untracked: 0 }
  const result = run(gitRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', modelPath(gitRoot, modelRoot)])
  if (result.status !== 0) return scope
  const entries = result.stdout.toString('utf8').split('\0')
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!
    if (entry.length < 4) continue
    const x = entry[0]
    const y = entry[1]
    /* A rename or copy carries its source path as the next entry. */
    if (x === 'R' || x === 'C') index++
    if (x === '?' && y === '?') { scope.untracked++; continue }
    if (x !== ' ') scope.staged++
    if (y !== ' ') scope.unstaged++
  }
  return scope
}

interface TreeEntry { sha: string, path: string, size: number }

function treeEntries(gitRoot: string, commit: string, path: string): TreeEntry[] {
  const result = run(gitRoot, ['ls-tree', '-r', '-l', '-z', '--full-tree', commit, '--', path])
  if (result.status !== 0) throw new Error(result.stderr || 'git ls-tree failed')
  return result.stdout.toString('utf8').split('\0').filter(Boolean).flatMap((line) => {
    const tab = line.indexOf('\t')
    const [mode, type, sha, size] = line.slice(0, tab).trim().split(/\s+/)
    /* Only regular files: a symlink is never followed and a submodule is not the model's. */
    return type === 'blob' && (mode === '100644' || mode === '100755') ? [{ sha: sha!, path: line.slice(tab + 1), size: Number(size) }] : []
  })
}

/** Read many blobs in one `cat-file --batch`; it reads objects only, with no filters or hooks. */
function blobs(gitRoot: string, shas: string[]): Map<string, Buffer> {
  const unique = [...new Set(shas)]
  const found = new Map<string, Buffer>()
  if (!unique.length) return found
  const result = run(gitRoot, ['cat-file', '--batch'], `${unique.join('\n')}\n`)
  if (result.status !== 0) throw new Error(result.stderr || 'git cat-file failed')
  const buffer = result.stdout
  let offset = 0
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset)
    if (newline < 0) break
    const [sha, type, size] = buffer.subarray(offset, newline).toString('utf8').split(' ')
    offset = newline + 1
    if (type === 'missing' || size === undefined) continue
    const length = Number(size)
    found.set(sha!, buffer.subarray(offset, offset + length))
    offset += length + 1
  }
  return found
}

/**
 * Build the Product Model a commit holds, without checking anything out.
 *
 * The model's files are read from Git's object database into a temporary
 * directory that is removed before this returns; the user's worktree, index
 * and refs are never touched. Lint runs against the files the commit tracks,
 * so a version reads exactly as it did when it was committed.
 */
export function buildAtCommit(gitRoot: string, modelRoot: string, commit: string): Omit<GitVersionModel, 'version'> {
  const path = modelPath(gitRoot, modelRoot)
  const entries = treeEntries(gitRoot, commit, path).filter((entry) => {
    const inside = entry.path.slice(path.length + 1)
    return !GENERATED.has(inside.split('/')[0] ?? '')
  })
  if (!entries.length) return { state: 'absent', report: null, issues: [] }
  const contents = blobs(gitRoot, entries.map(entry => entry.sha))
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'pdd-kit-version-')))
  try {
    for (const entry of entries) {
      const target = join(root, ...entry.path.split('/'))
      if (!target.startsWith(`${root}${sep}`)) continue
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, contents.get(entry.sha) ?? Buffer.alloc(0))
    }
    const prefix = path.split('/').slice(0, -1)
    const tracked = () => (output(gitRoot, ['ls-tree', '-r', '-z', '--name-only', '--full-tree', commit]) ?? '').split('\0').filter(Boolean)
    const build = buildViewerReportFrom(join(root, ...prefix), tracked, root)
    return { state: build.report ? 'ready' : 'blocked', report: build.report ?? null, issues: build.issues }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

export function createGitHistory(gitRoot: string, modelRoot: string): GitHistory {
  const models = new Map<string, Omit<GitVersionModel, 'version'>>()

  /** `%H %cI %s` of one revision, or null when it names no commit. */
  function commitVersion(revision: string, id: string, kind: GitVersionKind, label?: string): GitVersion | null {
    const line = output(gitRoot, ['show', '-s', '--no-show-signature', '--format=%H%x00%cI%x00%s', '--end-of-options', `${revision}^{commit}`, '--'])
    if (!line) return null
    const [commit = '', committedAt = '', subject = ''] = line.split('\0')
    return { id: kind === 'commit' ? `commit:${commit}` : id, kind, label: label ?? commit.slice(0, 7), commit, subject, committedAt }
  }

  function currentBranch(): string | null {
    return output(gitRoot, ['symbolic-ref', '--quiet', 'HEAD']) || null
  }

  /** The remote's own default, then its main or master, then a local main or master. */
  function defaultRef(current: string | null): string | null {
    const remotes = (output(gitRoot, ['remote']) ?? '').split('\n').filter(Boolean)
    const configured = current ? output(gitRoot, ['config', '--get', `branch.${current.slice('refs/heads/'.length)}.remote`]) : null
    const remote = configured && remotes.includes(configured) ? configured
      : remotes.includes('origin') ? 'origin' : remotes.length === 1 ? remotes[0] : undefined
    const candidates = [
      ...(remote ? [output(gitRoot, ['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]), `refs/remotes/${remote}/main`, `refs/remotes/${remote}/master`] : []),
      'refs/heads/main', 'refs/heads/master'
    ]
    for (const candidate of candidates) {
      if (candidate && REF.test(candidate) && run(gitRoot, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${candidate}^{commit}`]).status === 0) return candidate
    }
    return null
  }

  const shortRef = (ref: string) => ref.replace(/^refs\/(?:heads|remotes|tags)\//, '')

  function branchBase(): { base: string, defaultRef: string } | null {
    const ref = defaultRef(currentBranch())
    if (!ref) return null
    const base = output(gitRoot, ['merge-base', ref, 'HEAD'])
    return base ? { base, defaultRef: ref } : null
  }

  function resolve(id: string): GitVersion {
    if (id === 'head') {
      const head = commitVersion('HEAD', 'head', 'head')
      if (!head) throw new GitVersionError('This repository has no commits yet.')
      return { ...head, label: 'HEAD' }
    }
    if (id === 'branch-base') {
      const found = branchBase()
      if (!found) throw new GitVersionError('This branch shares no history with a default branch, so it has no starting point.')
      const version = commitVersion(found.base, 'branch-base', 'branch-base')!
      return { ...version, label: shortRef(found.defaultRef) }
    }
    if (id.startsWith('branch:')) {
      const ref = id.slice('branch:'.length)
      if (!REF.test(ref) || ref.startsWith('refs/tags/')) throw new GitVersionError('That is not a version of this repository.')
      if (run(gitRoot, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]).status !== 0) throw new GitVersionError(`${shortRef(ref)} no longer exists.`)
      const base = output(gitRoot, ['merge-base', '--end-of-options', ref, 'HEAD'])
      if (!base) throw new GitVersionError(`${shortRef(ref)} shares no history with this branch.`)
      return commitVersion(base, id, 'branch', shortRef(ref))!
    }
    if (id.startsWith('commit:')) {
      const commit = id.slice('commit:'.length)
      const version = COMMIT.test(commit) ? commitVersion(commit, id, 'commit') : null
      if (!version) throw new GitVersionError('That commit is not in this repository.')
      return version
    }
    const ref = id.startsWith('tag:') ? id.slice('tag:'.length) : ''
    if (!REF.test(ref) || !ref.startsWith('refs/tags/')) throw new GitVersionError('That is not a version of this repository.')
    const version = commitVersion(ref, id, 'tag', shortRef(ref))
    if (!version) throw new GitVersionError(`${shortRef(ref)} no longer exists.`)
    return version
  }

  return {
    context() {
      const current = currentBranch()
      const head = commitVersion('HEAD', 'head', 'head')
      const ref = head ? defaultRef(current) : null
      const defaultBranch = ref ? { ...commitVersion(ref, `branch:${ref}`, 'branch', shortRef(ref))!, default: true } : null
      const base = ref ? output(gitRoot, ['merge-base', ref, 'HEAD']) : null
      const ahead = base ? Number(output(gitRoot, ['rev-list', '--count', `${base}..HEAD`]) ?? 0) : 0
      const path = modelPath(gitRoot, modelRoot)
      const baseHasModel = !base || Boolean(output(gitRoot, ['ls-tree', '--name-only', base, '--', path]))
      const created = baseHasModel ? null : output(gitRoot, ['rev-list', '--reverse', `${base}..HEAD`, '--', path])?.split('\n')[0] || null
      const tag = head ? output(gitRoot, ['describe', '--tags', '--abbrev=0', 'HEAD']) : null
      /* `main` against `origin/main`, or `main` itself. */
      const branchName = current ? shortRef(current) : null
      const onDefaultBranch = Boolean(branchName && ref && (ref === current || (ref.startsWith('refs/remotes/') && shortRef(ref).split('/').slice(1).join('/') === branchName)))
      return {
        branch: current ? shortRef(current) : null,
        head: head ? { ...head, label: 'HEAD' } : null,
        defaultBranch,
        branchBase: base && ref ? { ...commitVersion(base, 'branch-base', 'branch-base', shortRef(ref))!, ahead } : null,
        onDefault: Boolean(base && head && base === head.commit),
        onDefaultBranch,
        latestTag: tag && REF.test(`refs/tags/${tag}`) ? commitVersion(`refs/tags/${tag}`, `tag:refs/tags/${tag}`, 'tag', tag) : null,
        modelCreated: created ? commitVersion(created, `commit:${created}`, 'commit', created.slice(0, 7)) : null,
        scope: workingTreeScope(gitRoot, modelRoot)
      }
    },

    list(query = '') {
      const search = query.trim().slice(0, 200).toLowerCase()
      const current = currentBranch()
      const fallback = defaultRef(current)
      const refs = output(gitRoot, ['for-each-ref', '--sort=-committerdate',
        '--format=%(refname)%00%(symref)%00%(objecttype)%00%(objectname)%00%(committerdate:iso-strict)%00%(subject)%00%(*objecttype)%00%(*objectname)%00%(*committerdate:iso-strict)%00%(*subject)',
        'refs/heads', 'refs/remotes', 'refs/tags']) ?? ''
      const named: GitVersion[] = []
      for (const line of refs.split('\n').filter(Boolean)) {
        const [ref = '', symbolic, type, oid = '', date = '', title = '', peeledType, peeledOid = '', peeledDate = '', peeledTitle = ''] = line.split('\0')
        /* Measuring the checked-out branch from itself shows nothing. */
        if (symbolic || ref === current || !REF.test(ref)) continue
        const kind: GitVersionKind = ref.startsWith('refs/tags/') ? 'tag' : 'branch'
        const id = `${kind}:${ref}`
        /* One read for every ref; only a tag of a tag is peeled on its own. Tags of trees or blobs hold no model. */
        const version: GitVersion | null = type === 'commit' ? { id, kind, label: shortRef(ref), commit: oid, subject: title, committedAt: date }
          : type === 'tag' && peeledType === 'commit' ? { id, kind, label: shortRef(ref), commit: peeledOid, subject: peeledTitle, committedAt: peeledDate }
            : type === 'tag' ? commitVersion(ref, id, kind, shortRef(ref)) : null
        if (!version) continue
        if (search && !`${version.label} ${version.subject}`.toLowerCase().includes(search)) continue
        named.push({ ...version, ...(ref === fallback ? { default: true } : {}) })
      }
      const rank = (version: GitVersion) => version.default ? 0 : version.kind === 'branch' ? 1 : 2
      const versions = named.sort((a, b) => rank(a) - rank(b))
      return { versions: versions.slice(0, PAGE_SIZE), more: versions.length > PAGE_SIZE }
    },

    resolve,

    model(id) {
      const version = resolve(id)
      let built = models.get(version.commit!)
      if (!built) {
        built = buildAtCommit(gitRoot, modelRoot, version.commit!)
        models.set(version.commit!, built)
        if (models.size > MODEL_CACHE) models.delete(models.keys().next().value!)
      }
      return { version, ...built }
    },

    revision() {
      return `${output(gitRoot, ['show-ref', '--head']) ?? ''}\n${currentBranch() ?? ''}`
    }
  }
}
