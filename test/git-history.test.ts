import { execFileSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildViewerReport } from '../src/commands/export.js'
import { buildAtCommit, createGitHistory, GitVersionError, workingTreeScope } from '../src/core/git-history.js'
import { compareReports } from '../src/report-compare.js'

const FIXTURE = join(__dirname, 'fixtures', 'fixture-shop')
const directories: string[] = []
/* No optional locks: the test's own `git status` must not refresh the index it is checking. */
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).trim()

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function repository(withModel = true): string {
  const root = mkdtempSync(join(tmpdir(), 'pdd-kit-history-test-'))
  directories.push(root)
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Test')
  git(root, 'config', 'commit.gpgsign', 'false')
  if (withModel) {
    cpSync(FIXTURE, root, { recursive: true })
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'Map the shop')
  }
  return git(root, 'rev-parse', '--show-toplevel')
}

const scenario = (root: string) => join(root, 'product-model', 'capabilities', 'place-order', 'scenarios', 'complete-checkout.md')
const entity = (root: string) => join(root, 'product-model', 'entities', 'order.md')

/** Everything a comparison must leave alone: refs, the index, the worktree's state. */
function repositoryState(root: string) {
  const index = join(root, '.git', 'index')
  return {
    refs: git(root, 'for-each-ref', '--format=%(refname) %(objectname)'),
    head: git(root, 'rev-parse', 'HEAD'),
    symbolic: git(root, 'rev-parse', '--abbrev-ref', 'HEAD'),
    status: git(root, 'status', '--porcelain=v1', '--untracked-files=all', '--ignored'),
    index: readFileSync(index).toString('base64'),
    indexTime: statSync(index).mtimeMs,
    stash: git(root, 'stash', 'list')
  }
}

describe('createGitHistory', () => {
  it('says where the reader stands: the branch, its commit, the default branch and where this branch left it', () => {
    const root = repository()
    const forked = git(root, 'rev-parse', 'HEAD')
    expect(createGitHistory(root, root).context()).toMatchObject({
      branch: 'main', head: { label: 'HEAD', commit: forked, subject: 'Map the shop' },
      defaultBranch: { id: 'branch:refs/heads/main', label: 'main', default: true },
      branchBase: { commit: forked, ahead: 0 }, onDefault: true, onDefaultBranch: true, latestTag: null
    })

    git(root, 'checkout', '--quiet', '-b', 'feature')
    appendFileSync(entity(root), '\nFeature notes.\n')
    git(root, 'commit', '--quiet', '-am', 'Feature work')
    git(root, 'checkout', '--quiet', 'main')
    appendFileSync(join(root, 'README.md'), '\nMain moved on.\n')
    git(root, 'commit', '--quiet', '-am', 'Main work')
    git(root, 'checkout', '--quiet', 'feature')
    const history = createGitHistory(root, root)
    expect(history.context()).toMatchObject({ branch: 'feature', branchBase: { label: 'main', commit: forked, ahead: 1 }, onDefault: false, onDefaultBranch: false })
    expect(history.resolve('branch-base')).toMatchObject({ kind: 'branch-base', label: 'main', commit: forked })
    /* Any branch measures from where this one left it, not from its latest commit. */
    expect(history.resolve('branch:refs/heads/main')).toMatchObject({ kind: 'branch', label: 'main', commit: forked })
  })

  it('knows the default branch\'s local copy, and the last release HEAD builds on', () => {
    const root = repository()
    git(root, 'tag', '-a', 'v1', '-m', 'First release')
    const released = git(root, 'rev-parse', 'HEAD')
    git(root, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/shop.git')
    git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
    expect(createGitHistory(root, root).context()).toMatchObject({
      onDefault: true, onDefaultBranch: true, latestTag: { id: 'tag:refs/tags/v1', label: 'v1', commit: released }
    })
    /* A commit not pushed yet: main is ahead of origin/main. */
    appendFileSync(entity(root), '\nUnpushed.\n')
    git(root, 'commit', '--quiet', '-am', 'Unpushed')
    expect(createGitHistory(root, root).context()).toMatchObject({
      defaultBranch: { label: 'origin/main' }, branchBase: { commit: released, ahead: 1 }, onDefault: false, onDefaultBranch: true
    })
  })

  it('names the commit that created the model when the branch\'s starting point holds none', () => {
    const root = repository(false)
    writeFileSync(join(root, 'README.md'), '# Shop\n')
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'Start')
    expect(createGitHistory(root, root).context().modelCreated).toBeNull()
    git(root, 'checkout', '--quiet', '-b', 'map')
    appendFileSync(join(root, 'README.md'), '\nBefore the model.\n')
    git(root, 'commit', '--quiet', '-am', 'Unrelated')
    cpSync(FIXTURE, root, { recursive: true })
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'Map the shop')
    const created = git(root, 'rev-parse', 'HEAD')
    appendFileSync(entity(root), '\nLater.\n')
    git(root, 'commit', '--quiet', '-am', 'Refine')
    expect(createGitHistory(root, root).context().modelCreated).toMatchObject({ id: `commit:${created}`, kind: 'commit', subject: 'Map the shop' })
    /* A starting point that already holds a model needs no such commit. */
    git(root, 'checkout', '--quiet', 'main')
    git(root, 'merge', '--quiet', '--ff-only', 'map')
    git(root, 'checkout', '--quiet', '-b', 'next')
    appendFileSync(entity(root), '\nNext.\n')
    git(root, 'commit', '--quiet', '-am', 'Next')
    expect(createGitHistory(root, root).context().modelCreated).toBeNull()
  })

  it('prefers the remote\'s default branch to a local one', () => {
    const root = repository()
    git(root, 'update-ref', 'refs/remotes/origin/trunk', 'HEAD')
    git(root, 'remote', 'add', 'origin', 'https://example.invalid/shop.git')
    git(root, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk')
    expect(createGitHistory(root, root).context().defaultBranch).toMatchObject({ id: 'branch:refs/remotes/origin/trunk', label: 'origin/trunk' })
  })

  it('names a detached HEAD without a branch', () => {
    const root = repository()
    git(root, 'checkout', '--quiet', '--detach')
    expect(createGitHistory(root, root).context()).toMatchObject({ branch: null, head: { commit: git(root, 'rev-parse', 'HEAD') } })
  })

  it('lists the default branch, then other branches and tags, without the checked-out branch', () => {
    const root = repository()
    const mapped = git(root, 'rev-parse', 'HEAD')
    git(root, 'tag', '-a', 'v1', '-m', 'First release')
    appendFileSync(join(root, 'README.md'), '\nCode only.\n')
    git(root, 'commit', '--quiet', '-am', 'Touch the code')
    git(root, 'branch', 'feature')
    const history = createGitHistory(root, root)
    expect(history.list().versions.map(version => version.id)).toEqual(['branch:refs/heads/feature', 'tag:refs/tags/v1'])
    git(root, 'checkout', '--quiet', 'feature')
    const page = history.list()
    expect(page.versions.map(version => version.id)).toEqual(['branch:refs/heads/main', 'tag:refs/tags/v1'])
    expect(page).toMatchObject({ more: false, versions: [{ default: true }, { label: 'v1', commit: mapped, subject: 'Map the shop' }] })
    /* A search matches names and subjects. */
    expect(history.list('touch').versions.map(version => version.id)).toEqual(['branch:refs/heads/main'])
    expect(history.list('v1').versions.map(version => version.id)).toEqual(['tag:refs/tags/v1'])
  })

  it('resolves only the versions it names, and says why one does not resolve', () => {
    const root = repository()
    const history = createGitHistory(root, root)
    const head = git(root, 'rev-parse', 'HEAD')
    expect(history.resolve('head')).toMatchObject({ kind: 'head', commit: head })
    expect(history.resolve(`commit:${head}`)).toMatchObject({ kind: 'commit', label: head.slice(0, 7) })
    expect(history.resolve('branch:refs/heads/main')).toMatchObject({ kind: 'branch', label: 'main', commit: head })
    for (const id of ['main', 'empty', 'commit:HEAD', 'commit:abc', 'branch:refs/tags/x', 'tag:refs/heads/main', 'branch:--output=/tmp/x', 'branch:refs/heads/gone']) {
      expect(() => history.resolve(id)).toThrow(GitVersionError)
    }
    expect(() => history.resolve('branch:refs/heads/gone')).toThrow(/gone no longer exists/)
  })

  it('refuses a repository with no commits', () => {
    const root = repository(false)
    const history = createGitHistory(root, root)
    expect(history.context().head).toBeNull()
    expect(() => history.resolve('head')).toThrow(/no commits yet/)
  })

  it('serves a version\'s model from Git', () => {
    const root = repository()
    const history = createGitHistory(root, root)
    const model = history.model('head')
    expect(model.state).toBe('ready')
    expect(model.report?.title).toBe(buildViewerReport({ modelRoot: root, gitRoot: root }).report?.title)
  })

  it('changes its revision when a ref moves', () => {
    const root = repository()
    const history = createGitHistory(root, root)
    const first = history.revision()
    expect(history.revision()).toBe(first)
    git(root, 'branch', 'elsewhere')
    expect(history.revision()).not.toBe(first)
  })
})

describe('workingTreeScope', () => {
  it('counts staged, unstaged and untracked model files, never ignored ones', () => {
    const root = repository()
    expect(workingTreeScope(root, root)).toEqual({ staged: 0, unstaged: 0, untracked: 0 })

    appendFileSync(entity(root), '\nStaged.\n')
    git(root, 'add', entity(root))
    expect(workingTreeScope(root, root)).toEqual({ staged: 1, unstaged: 0, untracked: 0 })

    appendFileSync(entity(root), '\nThen edited again.\n')
    appendFileSync(scenario(root), '\nUnstaged.\n')
    writeFileSync(join(root, 'product-model', 'entities', 'gift-card.md'), '# Gift card\n\nA prepaid balance.\n')
    mkdirSync(join(root, 'product-model', 'build'), { recursive: true })
    writeFileSync(join(root, 'product-model', 'build', 'report.json'), '{}')
    /* Code outside the model is not the model's change. */
    appendFileSync(join(root, 'README.md'), '\nUnrelated.\n')
    expect(workingTreeScope(root, root)).toEqual({ staged: 1, unstaged: 2, untracked: 1 })
  })
})

describe('buildAtCommit', () => {
  it('builds the committed model from Git objects while the worktree differs, changing nothing', () => {
    const root = repository()
    const before = repositoryState(root)
    writeFileSync(scenario(root), readFileSync(scenario(root), 'utf8').replace('and a confirmation is shown', 'and a receipt is emailed'))
    git(root, 'add', scenario(root))
    appendFileSync(entity(root), '\nUnstaged note.\n')
    const edited = repositoryState(root)

    const baseline = buildAtCommit(root, root, git(root, 'rev-parse', 'HEAD'))
    expect(baseline.state).toBe('ready')
    expect(baseline.issues.filter(issue => issue.severity === 'error')).toEqual([])
    const current = buildViewerReport({ modelRoot: root, gitRoot: root })
    const comparison = compareReports(baseline.report, current.report!)
    expect(comparison.changes.map(change => [change.key, change.status])).toEqual([
      ['entity:order', 'modified'],
      ['capability-scenario:complete-checkout', 'modified']
    ])
    expect(repositoryState(root)).toEqual(edited)
    expect(edited.head).toBe(before.head)
  })

  it('reads a model nested below the repository root', () => {
    const root = repository(false)
    cpSync(join(__dirname, '..', 'blueprints', 'bookmark-manager'), join(root, 'apps', 'bookmarks'), { recursive: true })
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'Nested model')
    const baseline = buildAtCommit(root, join(root, 'apps', 'bookmarks'), git(root, 'rev-parse', 'HEAD'))
    expect(baseline.report?.title).toBe('Bookmark Manager')
  })

  it('says a commit has no model when the model was created after it', () => {
    const root = repository(false)
    writeFileSync(join(root, 'README.md'), '# Shop\n')
    git(root, 'add', '-A')
    git(root, 'commit', '--quiet', '-m', 'Start')
    cpSync(FIXTURE, root, { recursive: true })
    const baseline = buildAtCommit(root, root, git(root, 'rev-parse', 'HEAD'))
    expect(baseline).toEqual({ state: 'absent', report: null, issues: [] })
    const current = buildViewerReport({ modelRoot: root, gitRoot: root })
    expect(compareReports(baseline.report, current.report!).counts.removed).toBe(0)
  })

  it('never reads generated output, even when it was committed', () => {
    const root = repository()
    mkdirSync(join(root, 'product-model', 'build'), { recursive: true })
    mkdirSync(join(root, 'product-model', 'cache'), { recursive: true })
    writeFileSync(join(root, 'product-model', 'build', 'notes.md'), '---\nbroken: [\n---\n')
    writeFileSync(join(root, 'product-model', 'cache', 'x.md'), 'cached')
    git(root, 'add', '-f', 'product-model/build', 'product-model/cache')
    git(root, 'commit', '--quiet', '-m', 'Commit generated output by mistake')
    rmSync(join(root, 'product-model', 'build'), { recursive: true })
    rmSync(join(root, 'product-model', 'cache'), { recursive: true })
    const baseline = buildAtCommit(root, root, git(root, 'rev-parse', 'HEAD'))
    const current = buildViewerReport({ modelRoot: root, gitRoot: root })
    expect(compareReports(baseline.report, current.report!).changes).toEqual([])
  })
})
