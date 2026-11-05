---
title: update
description: Refresh only pdd-kit-managed skill installations in project or global scope.
section: open-source
group: CLI
order: 22
---

# `pdd-kit update`

Refresh installed pdd-kit skills to the version of the package you run,
after upgrading it. Upgrading the CLI itself is separate; see
[Updating the CLI](./cli.md#updating-the-cli).

```bash
npx pdd-toolkit update [--providers <list>] [--scope project|global] [--orchestrate=on|off] [--force]
```

## Options

| Option | Meaning |
| --- | --- |
| `--providers <list>` | Look only in these harnesses: `android-studio,claude,codex,cursor,gemini,github` |
| `--scope project\|global` | Look only in one scope |
| `--orchestrate=on\|off` | Turn [orchestration](./cli-install.md#orchestration) on or off in every installation found. Omitted, each keeps its setting |
| `--force` | Replace a colliding `pdd-*` directory pdd-kit does not own inside a managed installation |

With no options it looks in every harness, in both scopes:

```bash
npx pdd-toolkit update --providers claude,codex --scope project
```

## What it does

1. Finds every skills directory with a valid `.pdd-kit-install.json`
   marker. Unmarked installations are never found or touched. When none is
   found, it names what it saw instead: a marker that is not valid JSON or
   that another package wrote, or Codex skills left in `~/.codex/skills`, each
   with the command to run.
2. Writes the current three skills into each, and removes any `pdd-*`
   skill the marker recorded that this release no longer ships.
3. Refreshes the marker, keeping its original install time and, unless you
   pass `--orchestrate`, its orchestration setting.
4. Says whether orchestration is on or off, and the command that changes it.

It never changes your `product-model/` Product Model.

Exits 0 when at least one installation is updated, 1 when none is found or a
collision stops it, and 2 for an unknown harness, scope, orchestration setting
or option.

## Next

- [`install`](./cli-install.md) when there is nothing to update yet.
