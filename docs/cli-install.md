---
title: install
description: Install the bundled pdd-kit agent skills safely for selected AI harnesses and scopes.
section: open-source
group: CLI
order: 21
---

# `pdd-kit install`

Install the three `pdd-*` agent skills into your AI harnesses, once per
project or once for your user, before you map, ideate or verify.

```bash
npx pdd-toolkit install [--providers <list>] [--scope project|global] [--orchestrate=on|off] [--yes] [--force]
```

## Options

| Option | Meaning |
| --- | --- |
| `--providers <list>` | Comma-separated harnesses: `android-studio,claude,codex,cursor,gemini,github`. Also accepted: `claude-code` for `claude`, `agents` for `codex`, and `copilot` for `github` |
| `--scope project\|global` | Install into the current project or your user configuration |
| `--orchestrate=on\|off` | Whether [`pdd-verify`](./skill-pdd-verify.md#implement-with-verify-opt-in) orchestrates implementation when you ask your agent to implement. Omitted, keeps the current setting (off for a new installation) |
| `--yes` | Take the defaults for anything not given: detected harnesses (Claude Code and Codex when none are detected), project scope, and each installation's current orchestration setting (off for a new one) |
| `--force` | Replace a colliding `pdd-*` skill directory that pdd-kit does not own |

Without a terminal (in CI, for example), pass `--providers` and `--scope`, or
`--yes` to take the defaults:

```bash
npx pdd-toolkit install --providers claude,codex --scope project
```

See [Installation](./installation.md) for each harness's directories and how to
choose a scope.

## What it does

1. Detects which harnesses you use. Interactively, you keep that selection or
   customize it, then choose project or global scope.
2. Checks every selected skills directory before writing to any of them.
   Interactively, it then asks how pdd-kit should fit into implementation:
   **Check on request** (orchestration off) or **Orchestrated** (on),
   defaulting to the current setting.
3. Writes the three skills, removing any `pdd-*` skill an earlier
   install recorded that this release no longer ships.
4. Writes `.pdd-kit-install.json` in each skills directory, recording the
   harness, scope, version, skill names and orchestration setting, so
   [`update`](./cli-update.md) can find it later and keep the setting.
5. Says whether orchestration is on or off, and the command that changes it.

It installs skills only: no `product-model/`, no hooks, no account.

## Orchestration

Your agent implements your usual way either way; orchestration decides when
the code is checked. Off, the default, is **check on request**: you run
`/pdd-verify`, or ask for a check, when you want one. On is **orchestrated**:
asking your agent to implement starts
[implement with verify](./skill-pdd-verify.md#implement-with-verify-opt-in),
which splits the work into phases, has your agent implement each one, and
checks each before the next.

```bash
npx pdd-toolkit install --orchestrate=on
```

The setting lives in the installed `pdd-verify` skill, where install changes
two lines: its description, so your agent picks it for implement requests, and
a setting line its instructions read. The marker records it, so `update` keeps
it. Nothing outside the skills directory changes. It applies to
every conversation in the agents you installed for; to skip it once, ask your
agent to implement without pdd-verify. Turn it off with
`npx pdd-toolkit update --orchestrate=off`.

## Safety

**The marker is the only proof of ownership.** A `pdd-*` directory the
marker does not list is someone else's, so it stops the run unless you pass
`--force`.

**A marker pdd-kit cannot read is not trusted.** A marker that is not valid
JSON, or that another package wrote, is refused, naming the file and the
command that replaces it once with `--force`.

**A refusal changes nothing.** Every harness is checked before any is written,
and the message names the directory that blocked the run.

Exits 0 when the skills are installed, 1 when a collision, a missing terminal or
a cancelled prompt stops it, and 2 for an unknown harness, scope,
orchestration setting or option.

## Next

- [`pdd-map`](./skill-pdd-map.md) for established code,
  [`pdd-ideate`](./skill-pdd-ideate.md) for a new product, or
  [`pdd-verify`](./skill-pdd-verify.md) for an existing model.
- [`update`](./cli-update.md) after upgrading the package.
