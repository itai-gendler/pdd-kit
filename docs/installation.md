---
title: Installation
description: Install the pdd-kit skills into your coding agent at project or global scope.
section: open-source
group: Get started
order: 2
---

# Installation

pdd-kit is installed once per repository (or once per machine) with the
`pdd-kit` CLI. Its npm package is named `pdd-toolkit` and installs the
`pdd-kit` command, so run it with `npx pdd-toolkit …`, or install the package
globally and run `pdd-kit …`. It requires Node.js 22.12 or newer.

```bash
npx pdd-toolkit install
```

The installer detects the coding agents you use (Claude Code, Codex, Cursor and
others), lets you customize the
selection, asks for project or global scope, and installs only the
pdd-kit skills. It never creates `product-model/`; the skills do that.

| Skill | What it does |
| --- | --- |
| [`pdd-map`](./skill-pdd-map.md) | Reads an existing repository and drafts its Product Model |
| [`pdd-ideate`](./skill-pdd-ideate.md) | Turns an idea or a change into an approved model change |
| [`pdd-verify`](./skill-pdd-verify.md) | Checks the code against the model and fixes the gaps you choose; or, if you opt in, plans implementation in phases ([implement with verify](./skill-pdd-verify.md#implement-with-verify-opt-in)) |

They run inside your coding agent, not in the terminal. Usually you just ask
("add guest checkout to the product", "check the code against the model")
and your agent picks the skill. To run one by name, use
`/pdd-map` in Claude Code and most agents, `$pdd-map` in
Codex and `@pdd-map` in Android Studio. These pages show the `/` form.

Check it worked: in your agent type `/pdd-` and the three skills
appear (Codex: `$pdd-`; Android Studio: `@pdd-`).

Installing changes nothing about how you implement: your agent keeps working
your usual way, and verify runs when you ask for a check. To let pdd-kit
orchestrate implementation instead (verify plans the work in phases and checks
each part before the next), answer yes when install asks, or pass
`--orchestrate=on`. See
[Implement with verify](./skill-pdd-verify.md#implement-with-verify-opt-in).

## Supported agents

| Provider | Project skills directory | Global skills directory |
| --- | --- | --- |
| Android Studio | `.android-studio/skills/` | `~/.android-studio/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.copilot/skills/` |

Claude Code's global directory follows `CLAUDE_CONFIG_DIR` when it is set.
Android Studio means Gemini's Agent Mode, Quail 1 or later. It also reads
`.agents/skills/`, so install for one of Android Studio and Codex, not both, or
it lists each skill twice. A `.github/` folder alone doesn't count as GitHub
Copilot; install looks for what Copilot reads there, such as
`.github/copilot-instructions.md`.

## Project or global

- **Project** installs into the repository, so the skills travel with it and
  teammates get them on checkout.
- **Global** installs into your user directory, making the skills available
  in every repository you open.

For non-interactive installation, provider flags, and collision safety, see
[`pdd-kit install`](./cli-install.md). To refresh an installation, see
[`pdd-kit update`](./cli-update.md).

## Claude Code plugin

Claude Code users can install the same three skills as a plugin instead, by
adding this repository as a marketplace:

```text
/plugin marketplace add itai-gendler/pdd-kit
/plugin install pdd-kit@pdd-kit
```

The plugin and the CLI installer deliver the same skills; use one or the other,
not both. Claude Code namespaces plugin skills by the plugin's name, so with
the plugin you run them as `/pdd-kit:pdd-map`, `/pdd-kit:pdd-ideate` and
`/pdd-kit:pdd-verify`. The plugin installs with orchestration off and has no
option to change it; turn it on with
[the sentence in your `AGENTS.md`](./skill-pdd-verify.md#implement-with-verify-opt-in)
instead, or run `/pdd-kit:pdd-verify implement …` for one request.

Next:

- Have code already? → [From your repo](./from-your-repo.md)
- Starting fresh? → [From an idea](./from-an-idea.md)
- Want a known product shape? → [From a Blueprint](./from-a-blueprint.md)
