import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCancel, select } from '@clack/prompts'
import { runInstall } from '../src/commands/install.js'
import { runUpdate } from '../src/commands/update.js'
import { detectProviders, providerById } from '../src/core/providers.js'
import { assertInstallTargets, currentOrchestration, findUnmanagedInstallations } from '../src/core/skill-installation.js'
import {
  ORCHESTRATED_VERIFY_DESCRIPTION,
  orchestratedVerifySkill,
  orchestrationLine,
  orchestrationSummary
} from '../src/core/orchestration.js'

// The interactive prompt is the one part of install a test cannot drive
// through a terminal, so the prompt library is replaced and each test answers.
vi.mock('@clack/prompts', async (original) => ({
  ...await original<typeof import('@clack/prompts')>(),
  select: vi.fn(),
  isCancel: vi.fn(() => false),
  spinner: () => ({ start: () => undefined, stop: () => undefined })
}))

/** Pretend both ends are a terminal, as an interactive install sees them. */
const terminalDescriptors = new Map<NodeJS.ReadStream | NodeJS.WriteStream, PropertyDescriptor | undefined>()

function asTerminal(): void {
  for (const stream of [process.stdin, process.stdout]) {
    terminalDescriptors.set(stream, Object.getOwnPropertyDescriptor(stream, 'isTTY'))
    Object.defineProperty(stream, 'isTTY', { value: true, configurable: true })
  }
}

function restoreTerminal(): void {
  for (const [stream, descriptor] of terminalDescriptors) {
    if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor)
    else delete (stream as { isTTY?: boolean }).isTTY
  }
  terminalDescriptors.clear()
}
import {
  PDD_KIT_SKILLS,
  installSkillsToTarget
} from '../src/core/skill-installation.js'

const temporaryDirectories: string[] = []

function temporary(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(() => {
  restoreTerminal()
  vi.mocked(select).mockReset()
  vi.mocked(isCancel).mockReset().mockReturnValue(false)
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('skill installation', () => {
  it('installs only the namespaced skills into every selected project harness', async () => {
    const project = temporary('pdd-kit-install-')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(await runInstall(project, {
      providers: 'android-studio,claude,codex,cursor,gemini,github',
      scope: 'project',
      yes: true
    })).toBe(0)

    for (const root of ['.android-studio', '.claude', '.agents', '.cursor', '.gemini', '.github']) {
      const skillsDir = join(project, root, 'skills')
      for (const skill of PDD_KIT_SKILLS) {
        expect(existsSync(join(skillsDir, skill, 'SKILL.md'))).toBe(true)
      }
      const manifest = JSON.parse(readFileSync(join(skillsDir, '.pdd-kit-install.json'), 'utf8'))
      expect(manifest).toMatchObject({
        schema: 1,
        package: 'pdd-toolkit',
        scope: 'project',
        skills: [...PDD_KIT_SKILLS]
      })
    }

    expect(existsSync(join(project, 'product-model'))).toBe(false)
    expect(existsSync(join(project, 'AGENTS.md'))).toBe(false)
    expect(existsSync(join(project, '.claude', 'commands'))).toBe(false)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-map', 'references', 'format.md'))).toBe(true)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-map', 'scripts', 'inventory-repository.mjs'))).toBe(true)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-map', 'scripts', 'run-pdd-kit.mjs'))).toBe(true)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-ideate', 'scripts', 'run-pdd-kit.mjs'))).toBe(true)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-verify', 'scripts', 'run-pdd-kit.mjs'))).toBe(true)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-kit-init'))).toBe(false)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-kit-sync'))).toBe(false)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-kit-contribute'))).toBe(false)
    expect(existsSync(join(project, '.claude', 'skills', 'pdd-kit-publish'))).toBe(false)
  })

  it('uses provider-specific global destinations', () => {
    // Exercise the default location without inheriting a real harness home.
    vi.stubEnv('CODEX_HOME', undefined)
    const project = temporary('pdd-kit-global-project-')
    const home = temporary('pdd-kit-global-home-')

    const result = installSkillsToTarget(
      project,
      { provider: providerById('codex'), scope: 'global' },
      '9.9.9',
      { home }
    )

    // Codex reads user skills from ~/.agents/skills, not $CODEX_HOME/skills.
    expect(result.skillsDir).toBe(join(home, '.agents', 'skills'))
    expect(existsSync(join(result.skillsDir, 'pdd-map', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(home, '.codex', 'skills'))).toBe(false)
    expect(existsSync(join(project, '.agents'))).toBe(false)
  })

  it('installs Android Studio skills in its own directory, in the project and for the user', () => {
    const project = temporary('pdd-kit-android-project-')
    const home = temporary('pdd-kit-android-home-')
    const provider = providerById('android-studio')

    const local = installSkillsToTarget(project, { provider, scope: 'project' }, '9.9.9', { home })
    const global = installSkillsToTarget(project, { provider, scope: 'global' }, '9.9.9', { home })

    // Agent Mode also reads `.agents/skills`, but that directory's marker belongs to Codex.
    expect(local.skillsDir).toBe(join(project, '.android-studio', 'skills'))
    expect(global.skillsDir).toBe(join(home, '.android-studio', 'skills'))
    expect(existsSync(join(local.skillsDir, 'pdd-verify', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(global.skillsDir, 'pdd-verify', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(project, '.agents'))).toBe(false)
  })

  it('refuses an unowned collision unless force is explicit', () => {
    const project = temporary('pdd-kit-collision-')
    const collision = join(project, '.claude', 'skills', 'pdd-map')
    mkdirSync(collision, { recursive: true })
    writeFileSync(join(collision, 'SKILL.md'), '---\nname: pdd-map\n---\nUnrelated.\n')

    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '9.9.9'
    )).toThrow(/not marked as a pdd-kit-managed skill/)

    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '9.9.9',
      { force: true }
    )).not.toThrow()
    expect(readFileSync(join(collision, 'SKILL.md'), 'utf8')).toContain('pdd-kit')
  })

  it('refuses an unmarked directory even when its SKILL.md mentions pdd-kit', () => {
    // A fork that kept the skill's name and the word pdd-kit is still
    // somebody else's: only the install manifest proves ownership.
    const project = temporary('pdd-kit-fork-')
    const fork = join(project, '.claude', 'skills', 'pdd-map')
    mkdirSync(fork, { recursive: true })
    writeFileSync(join(fork, 'SKILL.md'), '---\nname: pdd-map\ndescription: MY OWN FORK of the pdd-kit mapping skill\n---\nMY CUSTOM EDIT.\n')

    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '9.9.9'
    )).toThrow(/not marked as a pdd-kit-managed skill/)
    expect(readFileSync(join(fork, 'SKILL.md'), 'utf8')).toContain('MY CUSTOM EDIT')
  })

  it('refuses a manifest that records a name outside the skills directory', () => {
    // The manifest is read out of the target repository, which is untrusted. A
    // recorded name reaches a recursive remove, so a name that escapes the
    // skills directory invalidates the marker instead of being followed.
    const project = temporary('pdd-kit-hostile-manifest-')
    const skillsDir = join(project, '.agents', 'skills')
    const victim = join(project, 'victim')
    const claimed = join(skillsDir, 'pdd-map')
    mkdirSync(victim, { recursive: true })
    mkdirSync(claimed, { recursive: true })
    writeFileSync(join(victim, 'secret.txt'), 'not pdd-kit property\n')
    writeFileSync(join(claimed, 'SKILL.md'), '---\nname: pdd-map\n---\nSomebody else.\n')
    writeFileSync(join(skillsDir, '.pdd-kit-install.json'), JSON.stringify({
      schema: 1,
      package: 'pdd-toolkit',
      version: '0.5.0',
      provider: 'codex',
      scope: 'project',
      skills: ['pdd-map', '../../victim'],
      installedAt: '2026-01-01T00:00:00.000Z'
    }))

    // The marker is not ours, so it grants no ownership either.
    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('codex'), scope: 'project' },
      '9.9.9'
    )).toThrow(/not marked as a pdd-kit-managed skill/)
    expect(existsSync(join(victim, 'secret.txt'))).toBe(true)

    // Not even `--force`, which grants overwriting this skills directory and
    // nothing above it.
    installSkillsToTarget(
      project,
      { provider: providerById('codex'), scope: 'project' },
      '9.9.9',
      { force: true }
    )
    expect(existsSync(join(victim, 'secret.txt'))).toBe(true)
  })

  it('leaves a recorded name this Product could never have written', () => {
    // A well-formed marker still only proves ownership of names pdd-kit
    // ships or once shipped; anything else in the list is somebody's own work.
    const project = temporary('pdd-kit-stale-name-')
    const skillsDir = join(project, '.agents', 'skills')
    const notOurs = join(skillsDir, 'my-notes')
    mkdirSync(notOurs, { recursive: true })
    writeFileSync(join(notOurs, 'SKILL.md'), '---\nname: my-notes\n---\nMine.\n')
    writeFileSync(join(skillsDir, '.pdd-kit-install.json'), JSON.stringify({
      schema: 1,
      package: 'pdd-toolkit',
      version: '0.5.0',
      provider: 'codex',
      scope: 'project',
      skills: [...PDD_KIT_SKILLS, 'my-notes'],
      installedAt: '2026-01-01T00:00:00.000Z'
    }))

    installSkillsToTarget(
      project,
      { provider: providerById('codex'), scope: 'project' },
      '9.9.9'
    )
    expect(existsSync(join(notOurs, 'SKILL.md'))).toBe(true)
  })

  it('checks every harness target before writing any', () => {
    const project = temporary('pdd-kit-check-first-')
    const collision = join(project, '.agents', 'skills', 'pdd-map')
    mkdirSync(collision, { recursive: true })
    writeFileSync(join(collision, 'SKILL.md'), '---\nname: pdd-map\n---\nUnrelated.\n')

    const targets = [
      { provider: providerById('claude'), scope: 'project' as const },
      { provider: providerById('codex'), scope: 'project' as const }
    ]
    expect(() => assertInstallTargets(project, targets)).toThrow(/not marked as a pdd-kit-managed skill/)
    // The refusal came from the second target, and the first was never written.
    expect(existsSync(join(project, '.claude', 'skills'))).toBe(false)
    expect(() => assertInstallTargets(project, targets, { force: true })).not.toThrow()
  })

  it('removes stale owned namespaced skills and leaves unowned files alone', () => {
    const project = temporary('pdd-kit-owned-skills-')
    const skillsDir = join(project, '.agents', 'skills')
    const stale = join(skillsDir, 'pdd-kit-example')
    const lookalike = join(skillsDir, 'pdd-kit-unowned')
    const unrelated = join(skillsDir, 'map')
    for (const directory of [stale, lookalike, unrelated]) {
      mkdirSync(directory, { recursive: true })
      writeFileSync(join(directory, 'SKILL.md'), '# Example pdd-kit skill')
    }
    writeFileSync(join(skillsDir, '.pdd-kit-install.json'), JSON.stringify({
      schema: 1,
      package: 'pdd-toolkit',
      version: '0.12.0',
      provider: 'codex',
      scope: 'project',
      skills: ['pdd-kit-example', 'map'],
      installedAt: '2026-01-01T00:00:00.000Z'
    }))

    installSkillsToTarget(project, { provider: providerById('codex'), scope: 'project' }, '9.9.9')
    expect(existsSync(stale)).toBe(false)
    expect(existsSync(lookalike)).toBe(true)
    expect(existsSync(unrelated)).toBe(true)

    const command = join(project, '.claude', 'commands', 'pdd-kit', 'init.md')
    mkdirSync(join(project, '.claude', 'commands', 'pdd-kit'), { recursive: true })
    writeFileSync(command, '# pdd-kit command owned by another tool')
    installSkillsToTarget(project, { provider: providerById('claude'), scope: 'project' }, '9.9.9')
    expect(existsSync(command)).toBe(true)
  })

  it('updates managed skills without changing product files', async () => {
    const project = temporary('pdd-kit-update-')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '0.0.1'
    )
    const skillsDir = join(project, '.claude', 'skills')
    const manifestFile = join(skillsDir, '.pdd-kit-install.json')
    const originalManifest = JSON.parse(
      readFileSync(manifestFile, 'utf8')
    )
    originalManifest.skills = originalManifest.skills.filter(
      (skill: string) => skill !== 'pdd-verify'
    )
    writeFileSync(manifestFile, `${JSON.stringify(originalManifest, null, 2)}\n`)
    rmSync(join(skillsDir, 'pdd-verify'), { recursive: true })
    const product = join(project, 'product-model', 'product.md')
    mkdirSync(join(project, 'product-model'), { recursive: true })
    writeFileSync(product, '# Keep me\n')

    expect(await runUpdate(project, { scope: 'project' })).toBe(0)
    expect(readFileSync(product, 'utf8')).toBe('# Keep me\n')
    expect(existsSync(join(skillsDir, 'pdd-verify', 'SKILL.md'))).toBe(true)
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    expect(manifest.version).not.toBe('0.0.1')
    expect(manifest.installedAt).toBe(originalManifest.installedAt)
    expect(manifest.updatedAt).toBeDefined()
    expect(manifest.skills).toEqual([...PDD_KIT_SKILLS])
  })
})

describe('orchestration', () => {
  const SOURCE = join(__dirname, '..', 'skills')
  const claude = { provider: providerById('claude'), scope: 'project' as const }

  function installed(project: string, skill: string): string {
    return readFileSync(join(project, '.claude', 'skills', skill, 'SKILL.md'), 'utf8')
  }

  function marker(project: string): Record<string, unknown> {
    return JSON.parse(readFileSync(join(project, '.claude', 'skills', '.pdd-kit-install.json'), 'utf8'))
  }

  function changedLines(project: string, skill: string): string[][] {
    const before = readFileSync(join(SOURCE, skill, 'SKILL.md'), 'utf8').split('\n')
    const after = installed(project, skill).split('\n')
    expect(after.length).toBe(before.length)
    return before.flatMap((line, index) => line === after[index] ? [] : [[line, after[index]!]])
  }

  it('installs the shipped skills unchanged when it is off, and records off', () => {
    const project = temporary('pdd-kit-orchestrate-')
    expect(installSkillsToTarget(project, claude, '9.9.9').orchestrate).toBe('off')
    for (const skill of PDD_KIT_SKILLS) expect(changedLines(project, skill), skill).toEqual([])
    expect(marker(project).orchestrate).toBe('off')
  })

  it('changes only verify\'s description and setting line when it is on', () => {
    const project = temporary('pdd-kit-orchestrate-')
    installSkillsToTarget(project, claude, '9.9.9', { orchestrate: 'on' })
    const changes = changedLines(project, 'pdd-verify')
    expect(changes.map(([, after]) => after)).toEqual([
      `description: ${ORCHESTRATED_VERIFY_DESCRIPTION}`,
      orchestrationLine('on')
    ])
    expect(changedLines(project, 'pdd-ideate')).toEqual([])
    expect(changedLines(project, 'pdd-map')).toEqual([])
    expect(marker(project).orchestrate).toBe('on')
  })

  it('keeps the setting through an update unless asked to change it', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installSkillsToTarget(project, claude, '0.0.1', { orchestrate: 'on' })

    expect(await runUpdate(project, { scope: 'project' })).toBe(0)
    expect(installed(project, 'pdd-verify')).toContain(orchestrationLine('on'))
    expect(log.mock.calls.flat().join('\n')).toContain('Orchestration: on.')
    expect(log.mock.calls.flat().join('\n')).toContain('update --scope project --orchestrate=off')

    expect(await runUpdate(project, { scope: 'project', orchestrate: 'off' })).toBe(0)
    expect(changedLines(project, 'pdd-verify')).toEqual([])
    expect(marker(project).orchestrate).toBe('off')
    expect(log.mock.calls.flat().join('\n')).toContain('update --scope project --orchestrate=on')
  })

  it('reads a marker written before the setting existed as off', () => {
    const project = temporary('pdd-kit-orchestrate-')
    installSkillsToTarget(project, claude, '0.0.1')
    const file = join(project, '.claude', 'skills', '.pdd-kit-install.json')
    const { orchestrate: _, ...older } = marker(project)
    writeFileSync(file, JSON.stringify(older))
    expect(currentOrchestration(project, claude)).toBe('off')
    expect(installSkillsToTarget(project, claude, '9.9.9').orchestrate).toBe('off')
  })

  it('does not own a marker whose setting no pdd-kit release wrote', () => {
    const project = temporary('pdd-kit-orchestrate-')
    installSkillsToTarget(project, claude, '0.0.1')
    const file = join(project, '.claude', 'skills', '.pdd-kit-install.json')
    writeFileSync(file, JSON.stringify({ ...marker(project), orchestrate: 'sometimes' }))
    expect(() => installSkillsToTarget(project, claude, '9.9.9')).toThrow(/not a pdd-kit installation marker/)
  })

  it('names the setting and how to flip it after an install', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    expect(await runInstall(project, { providers: 'claude', scope: 'project', yes: true, orchestrate: 'on' })).toBe(0)
    expect(installed(project, 'pdd-verify')).toContain(orchestrationLine('on'))
    expect(log.mock.calls.flat().join('\n')).toContain('Orchestration: on.')
  })

  it('keeps an existing setting when --yes takes the defaults', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installSkillsToTarget(project, claude, '0.0.1', { orchestrate: 'on' })
    expect(await runInstall(project, { providers: 'claude', scope: 'project', yes: true })).toBe(0)
    expect(installed(project, 'pdd-verify')).toContain(orchestrationLine('on'))
  })

  it('asks interactively, starting from the current setting', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installSkillsToTarget(project, claude, '0.0.1', { orchestrate: 'on' })
    asTerminal()
    vi.mocked(select).mockResolvedValueOnce('off')

    expect(await runInstall(project, { providers: 'claude', scope: 'project' })).toBe(0)
    expect(vi.mocked(select)).toHaveBeenCalledOnce()
    const prompt = vi.mocked(select).mock.calls[0]![0]
    expect(prompt).toMatchObject({ initialValue: 'on' })
    // Either answer leaves implementing to the user's agent, and the question says so.
    expect(prompt.message).toContain('Your agent implements your usual way either way.')
    expect(prompt.options.map(option => [option.value, option.label])).toEqual([
      ['off', 'Check on request'],
      ['on', 'Orchestrated']
    ])
    expect(changedLines(project, 'pdd-verify')).toEqual([])
    expect(marker(project).orchestrate).toBe('off')
  })

  it('does not ask when the setting is given, and writes nothing when the question is cancelled', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    asTerminal()
    expect(await runInstall(project, { providers: 'claude', scope: 'project', orchestrate: 'on' })).toBe(0)
    expect(vi.mocked(select)).not.toHaveBeenCalled()

    const other = temporary('pdd-kit-orchestrate-')
    vi.mocked(select).mockResolvedValueOnce(Symbol('cancel'))
    vi.mocked(isCancel).mockReturnValueOnce(true)
    expect(await runInstall(other, { providers: 'claude', scope: 'project' })).toBe(1)
    expect(existsSync(join(other, '.claude', 'skills', 'pdd-verify'))).toBe(false)
  })

  it('names each setting and narrows the command to what the run touched', () => {
    const mixed = orchestrationSummary(
      [{ orchestrate: 'on', location: '.claude' }, { orchestrate: 'off', location: '.agents' }],
      { providers: ['claude', 'codex'], scope: 'project' }
    )
    expect(mixed).toContain('on in .claude; off in .agents')
    expect(mixed).toContain('update --providers claude,codex --scope project --orchestrate=on')
    expect(mixed).toContain('update --providers claude,codex --scope project --orchestrate=off')
    expect(orchestrationSummary([{ orchestrate: 'off', location: '.claude' }])).toMatch(/update --orchestrate=on`\.$/)
  })

  it('refuses a verify skill it cannot set, before writing it', () => {
    const shipped = readFileSync(join(SOURCE, 'pdd-verify', 'SKILL.md'), 'utf8')
    expect(() => orchestratedVerifySkill(shipped.replace(orchestrationLine('off'), ''), 'SKILL.md')).toThrow(/not the pdd-verify skill this version ships/)
    expect(() => orchestratedVerifySkill(`${shipped}\ndescription: again\n`, 'SKILL.md')).toThrow(/not the pdd-verify skill this version ships/)
    expect(orchestratedVerifySkill(shipped, 'SKILL.md')).toContain(orchestrationLine('on'))
  })

  it('refuses a setting other than on or off before writing anything', async () => {
    const project = temporary('pdd-kit-orchestrate-')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(await runInstall(project, { providers: 'claude', scope: 'project', yes: true, orchestrate: 'yes' })).toBe(2)
    expect(await runUpdate(project, { orchestrate: 'auto' })).toBe(2)
    expect(existsSync(join(project, '.claude'))).toBe(false)
  })
})

describe('installations this version does not manage', () => {
  function plantInstallation(skillsDir: string, marker: string): void {
    for (const skill of PDD_KIT_SKILLS) {
      mkdirSync(join(skillsDir, skill), { recursive: true })
      writeFileSync(join(skillsDir, skill, 'SKILL.md'), `---\nname: ${skill}\n---\nOld.\n`)
    }
    writeFileSync(join(skillsDir, '.pdd-kit-install.json'), marker)
  }

  function otherPackageMarker(packageName: string): string {
    return JSON.stringify({
      schema: 1,
      package: packageName,
      version: '0.34.0',
      provider: 'claude',
      scope: 'project',
      skills: [...PDD_KIT_SKILLS],
      installedAt: '2026-01-01T00:00:00.000Z'
    })
  }

  it('names the other package and the one command that replaces its install', async () => {
    const project = temporary('pdd-kit-previous-package-')
    const skillsDir = join(project, '.claude', 'skills')
    plantInstallation(skillsDir, otherPackageMarker('another-skills-package'))
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(await runUpdate(project, { scope: 'project' })).toBe(1)
    expect(errors.join('\n')).toContain('installed by another package, another-skills-package,')
    expect(errors.join('\n')).toContain('`pdd-kit install --providers claude --scope project --force` once')
    expect(errors.join('\n')).not.toContain('Run `pdd-kit install` first')

    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '9.9.9'
    )).toThrow(/installed by another package, another-skills-package,.*`pdd-kit install --providers claude --scope project --force` once/)
    // Nothing migrates on its own: the old skills are untouched until --force.
    expect(readFileSync(join(skillsDir, 'pdd-map', 'SKILL.md'), 'utf8')).toContain('Old.')

    expect(await runInstall(project, { providers: 'claude', scope: 'project', yes: true, force: true })).toBe(0)
    expect(JSON.parse(readFileSync(join(skillsDir, '.pdd-kit-install.json'), 'utf8')).package).toBe('pdd-toolkit')
    expect(await runUpdate(project, { scope: 'project' })).toBe(0)
  })

  it('reports a marker that is not valid JSON by its file, not as a missing installation', async () => {
    const project = temporary('pdd-kit-corrupt-marker-')
    const skillsDir = join(project, '.claude', 'skills')
    const marker = join(skillsDir, '.pdd-kit-install.json')
    plantInstallation(skillsDir, '{ "schema": 1,')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })

    expect(await runUpdate(project, { scope: 'project' })).toBe(1)
    expect(errors.join('\n')).toContain(`${marker} is not valid JSON`)
    expect(errors.join('\n')).toContain('`pdd-kit install --providers claude --scope project --force`')

    expect(() => installSkillsToTarget(
      project,
      { provider: providerById('claude'), scope: 'project' },
      '9.9.9'
    )).toThrow(`its marker ${marker} is not valid JSON`)
  })

  it('still says nothing is installed when there is nothing to name', async () => {
    const project = temporary('pdd-kit-nothing-')
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation(message => { errors.push(String(message)) })

    expect(await runUpdate(project, { scope: 'project' })).toBe(1)
    expect(errors).toEqual(['No managed pdd-kit skill installation found. Run `pdd-kit install` first.'])
  })

  it('names a Codex global install left at the location Codex no longer reads', () => {
    vi.stubEnv('CODEX_HOME', undefined)
    const project = temporary('pdd-kit-retired-codex-project-')
    const home = temporary('pdd-kit-retired-codex-home-')
    const retired = join(home, '.codex', 'skills')
    plantInstallation(retired, JSON.stringify({
      schema: 1,
      package: 'pdd-toolkit',
      version: '0.35.0',
      provider: 'codex',
      scope: 'global',
      skills: [...PDD_KIT_SKILLS],
      installedAt: '2026-01-01T00:00:00.000Z'
    }))

    const found = findUnmanagedInstallations(project, [providerById('codex')], ['global'], path => path, home)
    expect(found).toHaveLength(1)
    expect(found[0]!.skillsDir).toBe(retired)
    expect(found[0]!.message).toContain(`it now reads ${join(home, '.agents', 'skills')}`)
    expect(found[0]!.message).toContain('`pdd-kit install --providers codex --scope global`')
    expect(found[0]!.message).toContain('delete pdd-map, pdd-ideate, pdd-verify, .pdd-kit-install.json')
    expect(existsSync(join(retired, 'pdd-map', 'SKILL.md'))).toBe(true)
  })
})

describe('harness detection', () => {
  const detectedIds = (project: string, home: string) =>
    detectProviders(project, home).map(item => item.provider.id)

  it('finds Android Studio from .idea beside a Gradle build, and not Copilot from a bare .github', () => {
    const project = temporary('pdd-kit-detect-android-')
    const home = temporary('pdd-kit-detect-home-')
    mkdirSync(join(project, '.idea'))
    mkdirSync(join(project, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(project, 'settings.gradle.kts'), '')

    expect(detectedIds(project, home)).toEqual(['android-studio'])
    expect(detectProviders(project, home)[0]?.detectedAt).toBe(join(project, '.idea'))
  })

  it('does not take .idea alone for Android Studio, since every JetBrains IDE writes it', () => {
    const project = temporary('pdd-kit-detect-idea-')
    const home = temporary('pdd-kit-detect-home-')
    mkdirSync(join(project, '.idea'))

    expect(detectedIds(project, home)).toEqual([])
  })

  it('finds Android Studio from its own skills folder', () => {
    const project = temporary('pdd-kit-detect-android-own-')
    const home = temporary('pdd-kit-detect-home-')
    mkdirSync(join(project, '.android-studio'))

    expect(detectedIds(project, home)).toEqual(['android-studio'])
  })

  it('finds Copilot from what it reads in .github', () => {
    const project = temporary('pdd-kit-detect-copilot-')
    const home = temporary('pdd-kit-detect-home-')
    mkdirSync(join(project, '.github'))
    writeFileSync(join(project, '.github', 'copilot-instructions.md'), '')

    expect(detectedIds(project, home)).toEqual(['github'])
    expect(detectProviders(project, home)[0]?.detectedAt).toBe(join(project, '.github', 'copilot-instructions.md'))
  })
})
