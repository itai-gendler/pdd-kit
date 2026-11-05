import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { UsageError } from './usage-error.js'

export type ProviderId = 'android-studio' | 'claude' | 'codex' | 'cursor' | 'gemini' | 'github'
export type InstallScope = 'project' | 'global'

export interface Provider {
  id: ProviderId
  name: string
  projectRoot: string
  projectSkillsDir: string
  globalHarnessDirs: (home: string) => string[]
  globalSkillsDir: (home: string) => string
  /**
   * Where the harness shows itself in a project, when its own folder is not
   * enough to tell. Without it, the project root folder is the sign.
   */
  detectInProject?: (project: string) => string | undefined
  /**
   * Global skills directories the harness used to read and pdd-kit once
   * installed into. Nothing is written or updated there; `update` only names
   * an installation it finds, so the reader can move it.
   */
  retiredGlobalSkillsDirs?: (home: string) => string[]
}

const envHome = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback

const firstExisting = (project: string, paths: string[]): string | undefined =>
  paths.map(path => join(project, path)).find(candidate => existsSync(candidate))

const GRADLE_FILES = ['settings.gradle', 'settings.gradle.kts', 'build.gradle', 'build.gradle.kts']

// Almost every GitHub repository has a `.github/` folder, so only what Copilot
// itself reads there counts as a sign of it.
const COPILOT_PROJECT_FILES = [
  join('.github', 'skills'),
  join('.github', 'copilot-instructions.md'),
  join('.github', 'instructions'),
  join('.github', 'prompts'),
  join('.github', 'agents'),
  join('.github', 'chatmodes')
]

export const PROVIDERS: Provider[] = [
  {
    id: 'android-studio',
    name: 'Android Studio',
    // Agent Mode (Quail 1 and later) also reads `.agents/skills`, Codex's
    // directory; its own one keeps each installation's marker to one harness.
    projectRoot: '.android-studio',
    projectSkillsDir: join('.android-studio', 'skills'),
    globalHarnessDirs: home => [join(home, '.android-studio')],
    globalSkillsDir: home => join(home, '.android-studio', 'skills'),
    // An Android Studio project has `.idea/` beside its Gradle build.
    detectInProject: project =>
      firstExisting(project, ['.android-studio'])
      ?? (firstExisting(project, GRADLE_FILES) ? firstExisting(project, ['.idea']) : undefined)
  },
  {
    id: 'claude',
    name: 'Claude Code',
    projectRoot: '.claude',
    projectSkillsDir: join('.claude', 'skills'),
    globalHarnessDirs: home => [envHome('CLAUDE_CONFIG_DIR', join(home, '.claude'))],
    globalSkillsDir: home => join(envHome('CLAUDE_CONFIG_DIR', join(home, '.claude')), 'skills')
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    projectRoot: '.agents',
    projectSkillsDir: join('.agents', 'skills'),
    globalHarnessDirs: home => [envHome('CODEX_HOME', join(home, '.codex'))],
    // Codex reads user skills from ~/.agents/skills; $CODEX_HOME/skills is its
    // retired location, still read for now and not deduplicated against it.
    globalSkillsDir: home => join(home, '.agents', 'skills'),
    retiredGlobalSkillsDirs: home => [join(envHome('CODEX_HOME', join(home, '.codex')), 'skills')]
  },
  {
    id: 'cursor',
    name: 'Cursor',
    projectRoot: '.cursor',
    projectSkillsDir: join('.cursor', 'skills'),
    globalHarnessDirs: home => [join(home, '.cursor')],
    globalSkillsDir: home => join(home, '.cursor', 'skills')
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    projectRoot: '.gemini',
    projectSkillsDir: join('.gemini', 'skills'),
    globalHarnessDirs: home => [join(home, '.gemini')],
    globalSkillsDir: home => join(home, '.gemini', 'skills')
  },
  {
    id: 'github',
    name: 'GitHub Copilot',
    projectRoot: '.github',
    projectSkillsDir: join('.github', 'skills'),
    globalHarnessDirs: home => [join(home, '.copilot'), join(home, '.github')],
    globalSkillsDir: home => join(home, '.copilot', 'skills'),
    detectInProject: project => firstExisting(project, COPILOT_PROJECT_FILES)
  }
]

const PROVIDER_ALIASES: Record<string, ProviderId> = {
  agents: 'codex',
  'android-studio': 'android-studio',
  claude: 'claude',
  'claude-code': 'claude',
  codex: 'codex',
  copilot: 'github',
  cursor: 'cursor',
  gemini: 'gemini',
  github: 'github'
}

export interface DetectedProvider {
  provider: Provider
  detectedAt: string
  source: 'project' | 'global'
}

export function providerById(id: ProviderId): Provider {
  return PROVIDERS.find(provider => provider.id === id)!
}

export function parseProviderIds(input: string | undefined): ProviderId[] | undefined {
  if (input === undefined) return undefined
  const tokens = input.split(',').map(token => token.trim().toLowerCase()).filter(Boolean)
  if (tokens.length === 0) throw new UsageError('--providers requires at least one provider.')

  const ids: ProviderId[] = []
  const invalid: string[] = []
  for (const token of tokens) {
    const id = PROVIDER_ALIASES[token]
    if (!id) invalid.push(token)
    else if (!ids.includes(id)) ids.push(id)
  }
  if (invalid.length > 0) {
    throw new UsageError(
      `Unknown provider(s): ${invalid.join(', ')}. Supported providers: ${PROVIDERS.map(provider => provider.id).join(', ')}.`
    )
  }
  return ids
}

export function detectProviders(cwd: string, home = homedir()): DetectedProvider[] {
  const project = resolve(cwd)
  const detected: DetectedProvider[] = []
  for (const provider of PROVIDERS) {
    const projectPath = provider.detectInProject
      ? provider.detectInProject(project)
      : firstExisting(project, [provider.projectRoot])
    if (projectPath) {
      detected.push({ provider, detectedAt: projectPath, source: 'project' })
      continue
    }
    const globalPath = provider.globalHarnessDirs(home).find(candidate => existsSync(candidate))
    if (globalPath) {
      detected.push({ provider, detectedAt: globalPath, source: 'global' })
    }
  }
  return detected
}

export function providerSkillsDir(
  provider: Provider,
  scope: InstallScope,
  cwd: string,
  home = homedir()
): string {
  return scope === 'project'
    ? join(resolve(cwd), provider.projectSkillsDir)
    : provider.globalSkillsDir(home)
}

export function formatDisplayPath(path: string, home = homedir()): string {
  const resolvedHome = resolve(home)
  const resolvedPath = resolve(path)
  if (resolvedPath === resolvedHome) return '~'
  if (resolvedPath.startsWith(`${resolvedHome}${sep}`)) return `~${resolvedPath.slice(resolvedHome.length)}`
  return resolvedPath
}
