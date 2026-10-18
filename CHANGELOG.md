# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Restored the landing page hero's original opening sentence.
- **Report:** A Reference to a heading or anchor inside a repository file opens that file instead of saying it is unavailable.

## [0.37.0] - 2026-10-14

### Added

- Each version is published as a GitHub Release with its changelog, so watching the repository's releases announces it. ([#137](https://github.com/itai-gendler/pdd-kit/pull/137)) ([5b07e79](https://github.com/itai-gendler/pdd-kit/commit/5b07e790fbdeed268c3ee716982a5b92acbc0f4e))

- **CLI:** `install` asks how pdd-kit should fit into implementation: check on request, or orchestrated, where it splits the work into phases and checks each one. Your agent implements your usual way either way. `install` and `update` take `--orchestrate`; it is off by default, and `update` keeps your choice. ([#160](https://github.com/itai-gendler/pdd-kit/pull/160)) ([88126ed](https://github.com/itai-gendler/pdd-kit/commit/88126edba6bb062238f5b8200eef37b5489edc36))

### Changed

- **CLI:** **Breaking.** pdd-kit requires Node.js 22.12 or later; Node.js 20 has reached end of life. ([#153](https://github.com/itai-gendler/pdd-kit/pull/153)) ([53cb2df](https://github.com/itai-gendler/pdd-kit/commit/53cb2df3846fc9dfc376d25c6fd2ea41a471a5fd))

- **Skills:** **Breaking.** pdd-kit no longer takes over implementing. Asking your agent to implement works your usual way, and `pdd-verify` runs when you ask for a check: it reports every gap first and fixes only the ones you choose. To have verify plan and check implementation in phases as before, opt in to **implement with verify** at install, in your `AGENTS.md`, or for one request. ([#160](https://github.com/itai-gendler/pdd-kit/pull/160)) ([88126ed](https://github.com/itai-gendler/pdd-kit/commit/88126edba6bb062238f5b8200eef37b5489edc36))

- **CLI:** The README in every Product Model tells agents to implement your usual way and recommend a check when they finish, unless you opted in to implementing with `pdd-verify`. ([#160](https://github.com/itai-gendler/pdd-kit/pull/160)) ([88126ed](https://github.com/itai-gendler/pdd-kit/commit/88126edba6bb062238f5b8200eef37b5489edc36))

- **Docs:** The development loop, the Get started guides, the FAQ and the README describe implementing as your own workflow and explain how to opt in to implement with verify. ([#160](https://github.com/itai-gendler/pdd-kit/pull/160)) ([88126ed](https://github.com/itai-gendler/pdd-kit/commit/88126edba6bb062238f5b8200eef37b5489edc36))

- **Docs:** A diagram of the development pipeline today and with Product-Driven Development closes pdd-kit.dev's "What changes with a product model" and follows the README's "Why a Product Model in the AI era". ([#131](https://github.com/itai-gendler/pdd-kit/pull/131)) ([fde1ddf](https://github.com/itai-gendler/pdd-kit/commit/fde1ddf5259ad16461b1ce3b26bc3ba8e4ef1c2d))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.36.0...v0.37.0][0.37.0]

## [0.36.0] - 2026-10-13

### Changed

- **Report:** **Breaking.** The report viewer's components, composables, CSS classes, custom properties and data attributes now share the `Report` prefix, such as `ReportShell`, `useReportNavigation`, `.report-*` and `data-report-*`. Nuxt hosts that use them by name need the new names. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **Report:** Display preferences (columns per collection, term tooltips, the expanded resource panel and the collapsed sidebar) are kept in the browser's local storage, and the report sets no cookies. `pdd-kit view` remembers your columns, tooltips and panel choice across runs in a file in your configuration folder. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **Skills:** In a pdd-kit development checkout, the skills run the `pdd-kit-dev` launcher; they no longer run a generically named program from `~/.local/bin`. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **Docs:** pdd-kit.dev reads as an open-source project: the footer names the MIT license and links to contributing and issues, and the site sets no cookies. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **Docs:** The README opens with the problem as it is: the product definition already exists, but unstructured, incomplete and scattered, so every coding agent reconstructs it differently each time. pdd-kit.dev's "Where is your product model today?" says the same. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **CLI:** Codex global skills install to `~/.agents/skills`, where Codex looks for them; `update` names any left in the old `~/.codex/skills`. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **CLI:** Hints show `npx pdd-toolkit …` when pdd-kit runs through npx, so the suggested command works as printed. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Skills:** Installed as a Claude Code plugin, the skills lint with the pdd-kit release they came with instead of the latest one published. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Skills:** Asking your agent to implement or build a feature in a repository with a Product Model starts `pdd-verify`, and the format reference covers more of what `lint` checks. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** The README, the docs and the FAQ explain that the npm package is `pdd-toolkit` and the command it installs is `pdd-kit`, and the verification loop is described as approval-gated everywhere. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** A guide to contributing a Blueprint, and a `git init` step when starting from an idea. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** pdd-kit.dev's home page and link previews state the problem in the README's words, and Blueprint pages get their own link preview with title, summary and cover. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** The privacy page says pdd-kit.dev counts page views with Cloudflare Web Analytics, without cookies, and lists when the CLI contacts npm and GitHub. The site no longer loads icons from a third-party service. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

### Fixed

- `pdd-kit view itai-gendler/pdd-kit` opens pdd-kit's own Product Model again, which now also covers `blueprint list`. ([#125](https://github.com/itai-gendler/pdd-kit/pull/125)) ([18497ba](https://github.com/itai-gendler/pdd-kit/commit/18497ba99931c2150be44d670cf2ffccb866a9e1))

- **CLI:** `install` and `update` explain a damaged install marker, naming the file and the command to fix it. A missing report file or `--cwd` folder gets a plain message. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Skills:** Linting explains when npm is missing, and works on Windows. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** The installation check, the export report version and the example Blueprints in the docs are correct again, and running lint in CI is described as optional. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

- **Docs:** The committed Blueprint READMEs tell agents to run `npx pdd-toolkit`, like pulled ones. ([#129](https://github.com/itai-gendler/pdd-kit/pull/129)) ([4246cef](https://github.com/itai-gendler/pdd-kit/commit/4246cef5877c9e3e6241e3e64d2cf01aef9ff9b6))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.35.0...v0.36.0][0.36.0]

## [0.35.0] - 2026-10-13

### Changed

- **CLI:** The npm package is now `pdd-toolkit`: run it with `npx pdd-toolkit`. The command it installs is still `pdd-kit`. ([#127](https://github.com/itai-gendler/pdd-kit/pull/127)) ([42233c3](https://github.com/itai-gendler/pdd-kit/commit/42233c3ffad9eacc3ea4760b111ba09a521dacb4))

- pdd-kit has a new logo, an engraved compass rose beside a PDD-KIT wordmark, in the report, the README and the browser and app icons. ([#123](https://github.com/itai-gendler/pdd-kit/pull/123)) ([a00b2be](https://github.com/itai-gendler/pdd-kit/commit/a00b2beae654ea021dbc73f936dd44cefd7a1389))

- **Docs:** pdd-kit.dev, with the docs, the FAQ, the changelog and every Blueprint, is built from this repository, and the FAQ links to its Blueprints again. ([#121](https://github.com/itai-gendler/pdd-kit/pull/121)) ([1e1fc7c](https://github.com/itai-gendler/pdd-kit/commit/1e1fc7c5fe83b6f4698eabf08941dab80780d2fe))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.34.1...v0.35.0][0.35.0]

## [0.34.1] - 2026-10-12

### Fixed

- **Report:** Graphs show again in `pdd-kit view` and in Nuxt hosts of the report viewer; in 0.34.0 they were drawn with no height. ([#119](https://github.com/itai-gendler/pdd-kit/pull/119)) ([bd51001](https://github.com/itai-gendler/pdd-kit/commit/bd51001897840b05656d1dc5b52a568264ae058c))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.34.0...v0.34.1][0.34.1]

## [0.34.0] - 2026-10-12

### Added

- **CLI:** `blueprint list` shows every published Blueprint by the name `blueprint pull` takes. ([e685cd0](https://github.com/itai-gendler/pdd-kit/commit/e685cd03990b9eb8201f9d3ff4104c54913a25ea))

### Changed

- pdd-kit is the new name, and the Product Model lives in `product-model/`. The skills are `pdd-map`, `pdd-ideate` and `pdd-verify` (run `install` again), and environment variables start with `PDD_KIT_`. ([9514989](https://github.com/itai-gendler/pdd-kit/commit/95149899b69f3f92b8d2e3443d00c612ece410aa))

- **CLI:** Blueprints are published from the repository itself: a merged Blueprint can be pulled within minutes, without a CLI update and without a catalog server. ([e685cd0](https://github.com/itai-gendler/pdd-kit/commit/e685cd03990b9eb8201f9d3ff4104c54913a25ea))

- **CLI:** `blueprint contribute` opens its pull request on the new pdd-kit repository, and merging it publishes the Blueprint. ([9514989](https://github.com/itai-gendler/pdd-kit/commit/95149899b69f3f92b8d2e3443d00c612ece410aa))

- **Docs:** The FAQ is now available directly in the repository and supplies the website’s dedicated FAQ page. ([#114](https://github.com/itai-gendler/pdd-kit/pull/114)) ([0f9fb9d](https://github.com/itai-gendler/pdd-kit/commit/0f9fb9d8976bd605c56f47e312a60f855a1d4d58))

- **Docs:** The FAQ leads with why a Product Model, then adopting it, with every comparison — SDD and AI-generated docs among them — under What it is and isn't. ([#115](https://github.com/itai-gendler/pdd-kit/pull/115)) ([e9e6e97](https://github.com/itai-gendler/pdd-kit/commit/e9e6e971639f81092611b9c2125d18a158e043d1))

- **Docs:** The README explains Product-Driven Development with the questions the Product Model answers, shown on the Kanban Board Blueprint. ([#110](https://github.com/itai-gendler/pdd-kit/pull/110)) ([bcb2e69](https://github.com/itai-gendler/pdd-kit/commit/bcb2e693aefd48226a9b3b11729e5fe2a1ddd4a3))

- **Docs:** The README opens with a short map of its sections and shows where the Product Model fits beside docs, design, code and people. ([#116](https://github.com/itai-gendler/pdd-kit/pull/116)) ([b15e4b1](https://github.com/itai-gendler/pdd-kit/commit/b15e4b1c22c9030e136ea9c23e025b8865935f7c))

### Removed

- **CLI:** `blueprint pull --catalog` and the catalog URL and contribution upstream environment variables. `PDD_KIT_BLUEPRINT_REPOSITORY` now points `list`, `pull` and `contribute` at a fork. ([9514989](https://github.com/itai-gendler/pdd-kit/commit/95149899b69f3f92b8d2e3443d00c612ece410aa))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.33.0...v0.34.0][0.34.0]

## [0.33.0] - 2026-10-08

### Changed

- **Report:** `pdd-kit view` opens a model with lint errors whenever it can still be built, and counts its problems in the header. A save that breaks the build keeps the last version on screen and says how old it is. ([#111](https://github.com/itai-gendler/pdd-kit/pull/111)) ([1afb13c](https://github.com/itai-gendler/pdd-kit/commit/1afb13c389749c2d137802324e0041dbacbfce96))
- **Report:** Problems are listed by file, link to the resource they affect, and can be copied as a request for your agent. A resource shown without part of its file says so. ([#111](https://github.com/itai-gendler/pdd-kit/pull/111)) ([1afb13c](https://github.com/itai-gendler/pdd-kit/commit/1afb13c389749c2d137802324e0041dbacbfce96))
- **Report:** A model that doesn't build yet, or a report that fails to draw, shows a clear full-page explanation instead of a raw error. ([#111](https://github.com/itai-gendler/pdd-kit/pull/111)) ([1afb13c](https://github.com/itai-gendler/pdd-kit/commit/1afb13c389749c2d137802324e0041dbacbfce96))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.32.0...v0.33.0][0.33.0]

## [0.32.0] - 2026-10-07

### Changed

- A permission that depends on a setting, such as a workspace's approval limit, says whose setting it is: the person's, their workspace's, or the whole product's. Mark the product's own settings `singleton: true`. ([#108](https://github.com/itai-gendler/pdd-kit/pull/108)) ([5618c05](https://github.com/itai-gendler/pdd-kit/commit/5618c05ee38bc28459060b4009dfb4b38cdc5270))
- Creating something can create what belongs to it in the same step, such as a new board's first admin. ([#108](https://github.com/itai-gendler/pdd-kit/pull/108)) ([5618c05](https://github.com/itai-gendler/pdd-kit/commit/5618c05ee38bc28459060b4009dfb4b38cdc5270))
- Reports use format version 19; re-export Blueprints after updating. ([#108](https://github.com/itai-gendler/pdd-kit/pull/108)) ([5618c05](https://github.com/itai-gendler/pdd-kit/commit/5618c05ee38bc28459060b4009dfb4b38cdc5270))
- **CLI:** `lint` catches a permission that doesn't say whose setting it reads, and a Capability named with an umbrella verb such as manage. ([#108](https://github.com/itai-gendler/pdd-kit/pull/108)) ([5618c05](https://github.com/itai-gendler/pdd-kit/commit/5618c05ee38bc28459060b4009dfb4b38cdc5270))

### Removed

- **Report:** The versioned `ProductReportV18` names; use `ProductReport` and `ProductReportSchema`. ([#108](https://github.com/itai-gendler/pdd-kit/pull/108)) ([5618c05](https://github.com/itai-gendler/pdd-kit/commit/5618c05ee38bc28459060b4009dfb4b38cdc5270))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.31.0...v0.32.0][0.32.0]

## [0.31.0] - 2026-10-07

### Added

- **Report:** Search (⌘K) also finds the report's pages — Overview and every collection — and opens them as the sidebar does. ([#105](https://github.com/itai-gendler/pdd-kit/pull/105)) ([f47fc30](https://github.com/itai-gendler/pdd-kit/commit/f47fc301f02ae9aa63c92a09f4bd3194e0ad6ae4))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.30.0...v0.31.0][0.31.0]

### Changed

- **Docs:** The CLI and Skills overview pages have their own titles, so search results and browser tabs no longer show two pages both called Overview.

## [0.30.0] - 2026-10-07

### Added

- **Blueprints:** Fourteen new Blueprints, so the catalog launches with fifteen across five categories: Productivity, Collaboration, Dev Tools, Community and Education. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- **Blueprints:** A Blueprint can carry a cover image, `product/cover.webp`, shown on its catalog card; each of the fifteen launch Blueprints has one. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))

### Changed

- **Blueprints:** The Content Feed Reader now belongs to Productivity. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- **Skills:** Ideate checks the whole model before approval: every thing people create can be changed and removed, every Journey is found, opposite actions are separate Capabilities, and every action says who may do it. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- **Skills:** A product's AI is modelled one of two ways: a model the product calls to draft, or your own AI agent connecting to it. A kept proposal to change something you own waits until you accept it. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- Publishing and unpublishing, and other opposite actions, are separate Capabilities; changing your own vote or answer stays part of giving it. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- A Journey continues only where the product carries the same person on; something shown where they already are does not count. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- Deleting a thing can remove what belongs to it: a removal says what it goes `with`, and only removing the thing itself needs permission. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- Reports use a new format version; re-export Blueprints after updating. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))
- **CLI:** `lint` catches a Journey that never carries its own person through two Capabilities, an opposite action hidden inside a Capability, an AI agent permission that names no person, an unguarded change, and limitations that describe the model instead of the product. ([#88](https://github.com/itai-gendler/pdd-kit/pull/88)) ([4cc2750](https://github.com/itai-gendler/pdd-kit/commit/4cc27502fc5a27068ad6bee2ba4f70e9e0d561da))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.29.1...v0.30.0][0.30.0]

## [0.29.1] - 2026-10-07

### Changed

- **Docs:** The README and the Get started guides lead with mapping your own repository, and say what to ask your agent for everyday changes. ([#100](https://github.com/itai-gendler/pdd-kit/pull/100)) ([b8f4398](https://github.com/itai-gendler/pdd-kit/commit/b8f43987ad817ced5de8e4769642e5fdeafe3b4b))
- **Skills:** Asking your agent to "map this repo into a Product Model" starts map. ([#100](https://github.com/itai-gendler/pdd-kit/pull/100)) ([b8f4398](https://github.com/itai-gendler/pdd-kit/commit/b8f43987ad817ced5de8e4769642e5fdeafe3b4b))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.29.0...v0.29.1][0.29.1]

## [0.29.0] - 2026-10-07

### Changed

- Coverage now describes only which of your code a model accounts for, each entry naming its folders; what the product leaves out is said in its limitations. A model or Blueprint with no code yet has empty coverage, and the report says so. ([#98](https://github.com/itai-gendler/pdd-kit/pull/98)) ([2caf3d9](https://github.com/itai-gendler/pdd-kit/commit/2caf3d9fc9602303fb7366b8b861dbe7fd743ea2))
- Reports use a new format version; re-export Blueprints after updating. ([#98](https://github.com/itai-gendler/pdd-kit/pull/98)) ([2caf3d9](https://github.com/itai-gendler/pdd-kit/commit/2caf3d9fc9602303fb7366b8b861dbe7fd743ea2))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.28.0...v0.29.0][0.29.0]

## [0.28.0] - 2026-10-06

### Added

- **Skills:** Ask your agent to implement the Product Model, all of it or a part, and verify plans the work in phases that your agent implements your usual way, checks each part, and settles any product question with you. Ask for one part at a time or everything in one go if you prefer. ([#91](https://github.com/itai-gendler/pdd-kit/pull/91)) ([0c38287](https://github.com/itai-gendler/pdd-kit/commit/0c38287a93bee0dcd6ba2a0610fdca83185dc872))

### Changed

- **Skills:** Asking to change the product, such as "make a PDD change", now starts ideate, which ends by offering to implement the approved change. ([#91](https://github.com/itai-gendler/pdd-kit/pull/91)) ([0c38287](https://github.com/itai-gendler/pdd-kit/commit/0c38287a93bee0dcd6ba2a0610fdca83185dc872))
- **CLI:** The README in every Product Model tells any agent how to implement the model and change it, and which parts of the model the code must honor. ([#91](https://github.com/itai-gendler/pdd-kit/pull/91)) ([0c38287](https://github.com/itai-gendler/pdd-kit/commit/0c38287a93bee0dcd6ba2a0610fdca83185dc872))
- **Docs:** The development loop and the Get started guides now show asking your agent to implement, in phases, with verify checking each part. ([#91](https://github.com/itai-gendler/pdd-kit/pull/91)) ([0c38287](https://github.com/itai-gendler/pdd-kit/commit/0c38287a93bee0dcd6ba2a0610fdca83185dc872))

### Fixed

- **Skills:** Telling your agent to "take your recommendation" now settles the open questions without approving the change: the skills still show you the complete change and write the model only after you approve it. ([#96](https://github.com/itai-gendler/pdd-kit/pull/96)) ([9d6f999](https://github.com/itai-gendler/pdd-kit/commit/9d6f9994fe07a125732b6d89d5688ef5e9af0a4e))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.27.0...v0.28.0][0.28.0]

## [0.27.0] - 2026-10-06

### Changed

- **Report:** Clicking the local report's star again unstars pdd-kit on GitHub. ([#94](https://github.com/itai-gendler/pdd-kit/pull/94)) ([bbe82f8](https://github.com/itai-gendler/pdd-kit/commit/bbe82f8c05b8175dfc1c9374edc67a01d7ee6633))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.26.0...v0.27.0][0.27.0]

## [0.26.0] - 2026-10-06

### Added

- **Report:** The local report can star pdd-kit on GitHub in one click, through your signed-in GitHub CLI. ([#92](https://github.com/itai-gendler/pdd-kit/pull/92)) ([a045b35](https://github.com/itai-gendler/pdd-kit/commit/a045b350e3267615d0313d0689a1081fba38d32f))

### Changed

- **Report:** The local report's Documentation and GitHub links no longer show a new-tab arrow. ([#92](https://github.com/itai-gendler/pdd-kit/pull/92)) ([a045b35](https://github.com/itai-gendler/pdd-kit/commit/a045b350e3267615d0313d0689a1081fba38d32f))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.25.1...v0.26.0][0.26.0]

## [0.25.1] - 2026-10-05

- The README demo shows the current Product Model, one Screen per subject. ([#86](https://github.com/itai-gendler/pdd-kit/pull/86)) ([1dce3bf](https://github.com/itai-gendler/pdd-kit/commit/1dce3bf95d1ae3f80f4ad115bfdd63b0dc5e892f))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.25.0...v0.25.1][0.25.1]

## [0.25.0] - 2026-10-05

- The README demo now tours pdd-kit's own Product Model, with the command to open it yourself. ([#82](https://github.com/itai-gendler/pdd-kit/pull/82)) ([04cef90](https://github.com/itai-gendler/pdd-kit/commit/04cef903858fa1626f857776b0674807141faf85))
- The README and the docs Introduction show in one table what the model holds and what it leaves to design. ([#81](https://github.com/itai-gendler/pdd-kit/pull/81)) ([d537e94](https://github.com/itai-gendler/pdd-kit/commit/d537e94b57ddae39da096fabd8faa2d4ad5ba91d))
- A Screen is now one place however it is drawn: tabs, panels and wizard stages belong to it, so a redesign no longer changes the model. Screens no longer nest. ([#81](https://github.com/itai-gendler/pdd-kit/pull/81)) ([d537e94](https://github.com/itai-gendler/pdd-kit/commit/d537e94b57ddae39da096fabd8faa2d4ad5ba91d))
- Interfaces and Experiences no longer list the Screens reachable from everywhere; menus are design. ([#81](https://github.com/itai-gendler/pdd-kit/pull/81)) ([d537e94](https://github.com/itai-gendler/pdd-kit/commit/d537e94b57ddae39da096fabd8faa2d4ad5ba91d))
- A quality the product commits to, such as an accessibility level, is recorded as a Business Rule. ([#81](https://github.com/itai-gendler/pdd-kit/pull/81)) ([d537e94](https://github.com/itai-gendler/pdd-kit/commit/d537e94b57ddae39da096fabd8faa2d4ad5ba91d))
- Models and exported reports use a new format version; re-export Blueprints after updating. ([#81](https://github.com/itai-gendler/pdd-kit/pull/81)) ([d537e94](https://github.com/itai-gendler/pdd-kit/commit/d537e94b57ddae39da096fabd8faa2d4ad5ba91d))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.24.2...v0.25.0][0.25.0]

## [0.24.2] - 2026-10-05

- The README opens with a short animated tour of the local report. ([#79](https://github.com/itai-gendler/pdd-kit/pull/79)) ([012b16d](https://github.com/itai-gendler/pdd-kit/commit/012b16d267ba219fb00d3bef13ffd97f1d5affa1))
- The changelog names the pull request and commit behind every entry, the contributors to each release, and its full comparison, and reads the same on pdd-kit.dev. ([#73](https://github.com/itai-gendler/pdd-kit/pull/73)) ([3a46c36](https://github.com/itai-gendler/pdd-kit/commit/3a46c362e7d7716a5b5804e02303f44a595d4c7b))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.24.1...v0.24.2][0.24.2]

## [0.24.1] - 2026-10-05

- A shorter README that says what pdd-kit does, why it matters and how to start, with an animated development loop. ([#74](https://github.com/itai-gendler/pdd-kit/pull/74)) ([2d92913](https://github.com/itai-gendler/pdd-kit/commit/2d9291301b6e1d816900635d1454e7c0ba66b034))
- The development loop now reads ideate → implement → verify, and says plainly that implementing stays in your own workflow. ([#74](https://github.com/itai-gendler/pdd-kit/pull/74)) ([2d92913](https://github.com/itai-gendler/pdd-kit/commit/2d9291301b6e1d816900635d1454e7c0ba66b034))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.24.0...v0.24.1][0.24.1]

## [0.24.0] - 2026-10-05

- A globally installed CLI offers each newer release once, and updates itself only when you choose to. Turn the reminder off from the prompt or with `PDD_KIT_NO_UPDATE_CHECK=1`. ([#77](https://github.com/itai-gendler/pdd-kit/pull/77)) ([0784f6a](https://github.com/itai-gendler/pdd-kit/commit/0784f6a167f70c917bcabbe50efb92dc2d5c57fa))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.23.1...v0.24.0][0.24.0]

## [0.23.1] - 2026-10-04

- The report and every pdd-kit page show in light mode only for now; dark mode will return once it reads as well as light. ([#71](https://github.com/itai-gendler/pdd-kit/pull/71)) ([9a4506c](https://github.com/itai-gendler/pdd-kit/commit/9a4506c40d8da7156d7136b6a76166c514646bf7))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.23.0...v0.23.1][0.23.1]

## [0.23.0] - 2026-10-04

- Model experiments, configuration choices and supported versions as Variations of an Interface, Experience, Screen, Entity, Capability, Journey, Scenario or Business Rule, and browse them in a new Variations collection. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Read every alternative under its Variation's name (in readings, lists, trees, graphs, matrices, Lifecycles and search) and switch between them in place; what holds only under some alternatives is dashed and says which. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Model nested Screens, Screens reachable from anywhere in an Interface or Experience, and the languages a Product serves. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Record the facts a Screen shows and collects, and the facts each Scenario Step reads, changes or creates; a Screen's Capabilities now come from the Steps placed on it. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Read what a Business Rule applies to, and find every Rule that names a resource from that resource. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- See each place's Capabilities, Scenarios and Journeys, including what happens directly on it, and follow Capability state changes into Entity Lifecycles. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Read permissions as operations and grants, with badges on the facts they restrict. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Mapping no longer fails on very large repositories, and draws Capabilities, Domains, Journeys, settings and roles more consistently. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Verification checks each Variation's alternatives, and what selects them, against the code. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Fewer false lint warnings about resource names. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- The local report keeps running when Git cannot open the repository, saying so once. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Blueprints with ambiguous place names are rejected before import. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- Shorter, simpler documentation: the introduction shows the development loop and the local report, each Product Model page leads with everyday examples, and a new Variations page covers feature flags, plan tiers, A/B tests and API versions. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))
- **Breaking.** Models and Blueprints must be updated to the new format; older model and report formats are rejected. Screens describe what they show and offer through relations instead of prose sections and Capability lists; Interfaces and Experiences drop their Capability boundary sections and Screen lists; References drop state labels. ([#65](https://github.com/itai-gendler/pdd-kit/pull/65)) ([529b072](https://github.com/itai-gendler/pdd-kit/commit/529b07286ef9f12f61712e657b914cc3a821d0b8))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.22.0...v0.23.0][0.23.0]

## [0.22.0] - 2026-09-23

- Coverage now records scope, modeled behavior, approved exclusions, gaps and uncertainty instead of a completeness status. Existing models need the new Coverage format. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Read Coverage on one page: scope and method with a card per category, then every recorded path with its statements available in place. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Tell Coverage categories apart at a glance by icon and colour, filter by category, and find recorded paths by name. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Browse References by where they point: each file or external page appears once with the resources that cite it, repository files beside external links, with a card per kind to filter by and search by path or link. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- See each resource's References split into repository files and external links. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Blueprints keep Coverage descriptions but leave repository paths behind; older Blueprint formats are no longer accepted. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Apply the same structural checks to every model, including those with known gaps. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Open the local report before a model exists and follow valid edits as they arrive, with visible connection status. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Recover the local report when a repository is initialized or referenced files are staged. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Reject Blueprint steps with undeclared Entities before importing the model. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))
- Read clearer Product details and larger headings in About, under a simpler report header. ([#55](https://github.com/itai-gendler/pdd-kit/pull/55)) ([b4227e7](https://github.com/itai-gendler/pdd-kit/commit/b4227e7676faa4873aa409496d9e1fce4a1bb8bb))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.21.0...v0.22.0][0.22.0]

## [0.21.0] - 2026-09-21

- Choose lists, graphs and comparisons from preview cards, keeping the same filters and counts. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Find comparison tables within Entities, Capabilities and Business Rules, with simpler relationship filters. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Browse Interfaces and Domains in consistent trees with clearer counts and indentation. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Explore an Interface's Experiences & Screens or an Experience's Screens, including shared Screens and ownership links. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Keep resource headers compact, with additional Domains behind a “more” button. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Expand or collapse all Overview references, which start collapsed. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))
- Keep comparison legends beside filters, with warmer neutral badges in both themes. ([#63](https://github.com/itai-gendler/pdd-kit/pull/63)) ([dd07799](https://github.com/itai-gendler/pdd-kit/commit/dd0779949c5e07bd45005097960cf365e5c75d11))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.20.0...v0.21.0][0.21.0]

## [0.20.0] - 2026-09-18

- View the Product Model of a GitHub repository, branch, or pull request without cloning it yourself. ([#61](https://github.com/itai-gendler/pdd-kit/pull/61)) ([86c4496](https://github.com/itai-gendler/pdd-kit/commit/86c44963d633b92a7e3ad5b11b766116872191ae))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.19.0...v0.20.0][0.20.0]

## [0.19.0] - 2026-09-17

- Clearer comparison tables with independent filters and smoother navigation. ([#59](https://github.com/itai-gendler/pdd-kit/pull/59)) ([8e4abd4](https://github.com/itai-gendler/pdd-kit/commit/8e4abd482086687f28e8c806fcfe99a545b58bf7))
- Colored badges with details on click and complete legends. ([#59](https://github.com/itai-gendler/pdd-kit/pull/59)) ([8e4abd4](https://github.com/itai-gendler/pdd-kit/commit/8e4abd482086687f28e8c806fcfe99a545b58bf7))
- Larger Context paths and improved keyboard navigation. ([#59](https://github.com/itai-gendler/pdd-kit/pull/59)) ([8e4abd4](https://github.com/itai-gendler/pdd-kit/commit/8e4abd482086687f28e8c806fcfe99a545b58bf7))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.18.0...v0.19.0][0.19.0]

## [0.18.0] - 2026-09-17

- Navigate reports with a collapsible sidebar and clearer page headers. ([#60](https://github.com/itai-gendler/pdd-kit/pull/60)) ([69073e0](https://github.com/itai-gendler/pdd-kit/commit/69073e0f2ee4f926629b638c2ed07960592b4bbd))
- See the current Product and switch between catalog Blueprints from the sidebar. ([#60](https://github.com/itai-gendler/pdd-kit/pull/60)) ([69073e0](https://github.com/itai-gendler/pdd-kit/commit/69073e0f2ee4f926629b638c2ed07960592b4bbd))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.17.0...v0.18.0][0.18.0]

## [0.17.0] - 2026-09-16

- Select lifecycle states by clicking anywhere on their cards, with consistent highlighting. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))
- Explore entity lifecycles as States with their outgoing changes, or as an interactive graph. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))
- Expand resource panels to the full window without losing your place. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))
- Use consistent model terms in resource headings and summaries. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))
- Show consistent resource icon colors in lifecycle details and relationship lists. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))
- Keep related Domains visible in resource headers across tabs. ([#58](https://github.com/itai-gendler/pdd-kit/pull/58)) ([a5f1493](https://github.com/itai-gendler/pdd-kit/commit/a5f1493f5046048ddfc17db4c49aef0d08b6b76c))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.16.0...v0.17.0][0.17.0]

## [0.16.0] - 2026-09-16

- Responsive filters and consistent report controls across screen sizes. ([#57](https://github.com/itai-gendler/pdd-kit/pull/57)) ([b6602ba](https://github.com/itai-gendler/pdd-kit/commit/b6602ba263c80dd7391458dfca684a96f04a8015))
- Cleaner graphs with more room to explore. ([#57](https://github.com/itai-gendler/pdd-kit/pull/57)) ([b6602ba](https://github.com/itai-gendler/pdd-kit/commit/b6602ba263c80dd7391458dfca684a96f04a8015))
- Resource panels dim the page and close when clicking outside. ([#57](https://github.com/itai-gendler/pdd-kit/pull/57)) ([b6602ba](https://github.com/itai-gendler/pdd-kit/commit/b6602ba263c80dd7391458dfca684a96f04a8015))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.15.0...v0.16.0][0.16.0]

## [0.15.0] - 2026-09-15

- Explore resources in side panels without losing your place. ([#56](https://github.com/itai-gendler/pdd-kit/pull/56)) ([93e8fff](https://github.com/itai-gendler/pdd-kit/commit/93e8ffffd6b0fe5eabc45e534643a05d004c4f4c))
- Find connections and grouped references in dedicated tabs, with clear file paths, owners, and external links. ([#56](https://github.com/itai-gendler/pdd-kit/pull/56)) ([93e8fff](https://github.com/itai-gendler/pdd-kit/commit/93e8ffffd6b0fe5eabc45e534643a05d004c4f4c))
- Read formatted documents and color-coded source files inside the report, in either theme. ([#56](https://github.com/itai-gendler/pdd-kit/pull/56)) ([93e8fff](https://github.com/itai-gendler/pdd-kit/commit/93e8ffffd6b0fe5eabc45e534643a05d004c4f4c))
- Smoother graph expansion and clearer Domain and Interface trees. ([#56](https://github.com/itai-gendler/pdd-kit/pull/56)) ([93e8fff](https://github.com/itai-gendler/pdd-kit/commit/93e8ffffd6b0fe5eabc45e534643a05d004c4f4c))
- Simplified resource headers, controls, and Scenario cards. ([#56](https://github.com/itai-gendler/pdd-kit/pull/56)) ([93e8fff](https://github.com/itai-gendler/pdd-kit/commit/93e8ffffd6b0fe5eabc45e534643a05d004c4f4c))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.14.0...v0.15.0][0.15.0]

## [0.14.0] - 2026-09-15

- Redesigned Capability and Journey Scenarios with clearer Steps and details. ([#54](https://github.com/itai-gendler/pdd-kit/pull/54)) ([761667e](https://github.com/itai-gendler/pdd-kit/commit/761667ed4a99d05741bb8c45cde123344e56e759))
- Added Rows and Graph views with shared filters and saved row layouts. ([#54](https://github.com/itai-gendler/pdd-kit/pull/54)) ([761667e](https://github.com/itai-gendler/pdd-kit/commit/761667ed4a99d05741bb8c45cde123344e56e759))
- Simplified report navigation and made styling consistent. ([#54](https://github.com/itai-gendler/pdd-kit/pull/54)) ([761667e](https://github.com/itai-gendler/pdd-kit/commit/761667ed4a99d05741bb8c45cde123344e56e759))
- Fixed Back navigation, expansion state, and duplicate graph nodes. ([#54](https://github.com/itai-gendler/pdd-kit/pull/54)) ([761667e](https://github.com/itai-gendler/pdd-kit/commit/761667ed4a99d05741bb8c45cde123344e56e759))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.13.0...v0.14.0][0.14.0]

## [0.13.0] - 2026-09-12

### Removed

- Hidden historical CLI options and command migration messages. Use the commands
  and options shown in help, including `--cwd` and `--scope project|global`. ([#53](https://github.com/itai-gendler/pdd-kit/pull/53)) ([89947f3](https://github.com/itai-gendler/pdd-kit/commit/89947f30afe4f56c5253999358cef7a5d9931217))
- One-off cleanup of old bare-name skills and Claude commands during installation. ([#53](https://github.com/itai-gendler/pdd-kit/pull/53)) ([89947f3](https://github.com/itai-gendler/pdd-kit/commit/89947f30afe4f56c5253999358cef7a5d9931217))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.12.0...v0.13.0][0.13.0]

## [0.12.0] - 2026-09-10

### Changed

- Every page of the report reads the same way: what it is and the ways out of
  it, then tabs for which set you are reading, then what narrows it. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Tabs are the report's only switch. Each named reading sits beside List in the
  collection it belongs to; the Cards/Table toggle and the grouping menu are
  gone. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Filters sit beside the rows they narrow, one control per axis, on every
  collection whatever its size. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Collections group by Domain on their own, and Entities that act lead the list. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Overview is the Product's own page, with About, Coverage and References. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Compare delivery is now a Capability by Interface matrix. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- The documentation explains the Product Model. The report explains itself. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Report links shared before this release open the Overview. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))

### Removed

- The All resources and connections view. The rail already lists every
  collection with its count, and a resource's connections are on its page. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))

### Fixed

- Icons missing from the local report, including the loading indicator and the
  warning shown while an edit is invalid. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))
- Interactive controls now show the hand cursor. ([#48](https://github.com/itai-gendler/pdd-kit/pull/48)) ([2732ad0](https://github.com/itai-gendler/pdd-kit/commit/2732ad01e1ce976696b0221106a4a0c7203283ba))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.11.0...v0.12.0][0.12.0]

## [0.11.0] - 2026-09-07

### Fixed

- Generated product models omit rejected approaches and settled deliberation. ([#45](https://github.com/itai-gendler/pdd-kit/pull/45)) ([0358122](https://github.com/itai-gendler/pdd-kit/commit/035812229bef0aa8856cbc91c0fc8dcde5a6a138))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.10.0...v0.11.0][0.11.0]

## [0.10.0] - 2026-09-06

### Added

- Inline term definitions and a searchable Vocabulary panel for reports and docs. ([#40](https://github.com/itai-gendler/pdd-kit/pull/40)) ([189fb95](https://github.com/itai-gendler/pdd-kit/commit/189fb9526f397c0d573ceb6ef98f2c1d9b5711b5))
- Option to hide the tooltips that explain terms, with the preference remembered. ([#40](https://github.com/itai-gendler/pdd-kit/pull/40)) ([189fb95](https://github.com/itai-gendler/pdd-kit/commit/189fb9526f397c0d573ceb6ef98f2c1d9b5711b5))

### Changed

- Refined report header controls, icons, coverage badges, and documentation. ([#40](https://github.com/itai-gendler/pdd-kit/pull/40)) ([189fb95](https://github.com/itai-gendler/pdd-kit/commit/189fb9526f397c0d573ceb6ef98f2c1d9b5711b5))

### Fixed

- Improved breadcrumb and definition-button accessibility. ([#40](https://github.com/itai-gendler/pdd-kit/pull/40)) ([189fb95](https://github.com/itai-gendler/pdd-kit/commit/189fb9526f397c0d573ceb6ef98f2c1d9b5711b5))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.9.0...v0.10.0][0.10.0]

## [0.9.0] - 2026-09-04

### Added

- **Entity — one resource type for every thing the Product keeps or reasons
  about.** Identity, not storage, is the test. An Entity carries named facts,
  optional states, and relations in product language; implementation types,
  keys, indexes, join records, and regenerable representations stay out. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **Entity relations state both ends.** `one-to-one`, `one-to-many`, and
  `many-to-many` read from the declaring Entity to its target; the inverse is
  derived so two files cannot disagree. Entity pages and the *What it keeps*
  topology view render the product's own relationship graph. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **Business Rules can express authorization.** An Entity target selects an
  operation, facts, states, and optional Contexts. `permits` grants name
  actors, a related Entity path, self, unattended work, or configuration, with
  optional fact and state conditions. `lint` rejects Steps and Screens that no
  applicable grant can permit, without claiming runtime authorization has been
  proved. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **A Scenario Step says what it does to the Product's things.** Every Step
  carries `entities: []` or entries shaped as
  `{ entity, as, effect, from, to }`, where `effect` is
  `creates|changes|removes|reads`. Lifecycles and reverse edges are composed
  from acceptance Steps rather than authored a second time. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **Unattended Scenarios.** A first condition Step may state
  `unattended: true` for schedules, expiry, retry, and other Product-owned
  behavior with no Actor. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- `agent` joins the Interface types, and an Interface may own shared Screens
  beside its Experiences. A shared Screen is inside every Experience of its
  Interface: a Capability it exposes must be available in each, a Step on it is
  inside a Capability's availability only when every Experience is, and that
  Step counts as Scenario coverage for each. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **A Domain states what its Boundary excludes**, in the authored folder and on
  the wire. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **The Product Report renders every Entity edge.** Entities have a rail entry,
  collection, page, search results, facts, relations, composed lifecycle, and
  topology presence. An Entity with States reads its lifecycle as a state
  machine on its own tab, with each selecting Rule's grants in full. Scenario
  Steps show what they create, change, remove, or read; Journey outcomes
  summarize what they leave behind; Rules read their grants as sentences. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **`spec/rejected.md`** — shapes designed far enough to be costed and then
  chosen against, so the same argument is not had twice. It binds nothing and
  takes rejections and deferrals only: never a plan, a status, or a file
  reference. Entries are appended, so reopening a decision means a superseding
  entry rather than an edit. It carries what a format or report change most
  often re-proposes — tags and free-form metadata, a glossary resource type,
  typed facts, `actors/` as its own collection, permission on a Capability
  target, `transitions` on the Entity, the permission algebra's discarded
  spellings, and Blueprint provenance. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- pdd-kit now keeps a reviewed Product Model of itself. The Content Feed
  Reader Blueprint and golden Fixture Shop were expanded to exercise Entities,
  relations, lifecycles, unattended behavior, and permission Rules. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))

### Changed

- **Folder schema 8 and Product Report v13 are the only accepted contracts.**
  Historical reports are refused rather than migrated. The report SDK exports
  `ProductReportV13Schema`, `ProductReportV13`, the unversioned current
  aliases, Entity/fact/relation types, Step effect types, and grant types. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **A Capability no longer declares Entities and an Entity no longer declares
  transitions.** Scenario Steps are the single source of truth for what happens
  to the things the Product keeps. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- `## Information kept` is a list of uniquely named facts, so a Rule can govern
  one fact exactly. `## Product states` is retired. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- Behavioral ids are verb-noun and reuse vocabulary the model already declares.
  Entity, Domain, and Business Rule ids do not begin with a verb. The linter
  derives these naming findings rather than asking an author to judge them. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- Whether an Interface needs Experiences, and whether it divides, is derived
  rather than judged: audiences are disjoint when no available Capability
  bridges them, with the counterpart exception for symmetric platform pairs.
  Interface entry-point keys may name the Interface's type or another Interface
  from which it is reached. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- A Business Rule governs at least two behaviors or an independent Context, and
  a Domain states what its Boundary excludes. Both are now linted. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **The installer decides ownership by its manifest alone.** A directory that
  merely names a skill and mentions pdd-kit is somebody else's; retired
  skills are removed only when the manifest recorded them; every harness is
  checked before any is written, so a refusal leaves nothing changed. This is
  visible on upgrade: an installation made before the marker existed carries no
  proof it is ours, so `install` and `update` refuse it with *Refusing to
  overwrite … Pass `--force`*. One `--force` re-adopts it, and every later run
  is marked. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- `pdd-map`, `pdd-ideate`, and the authoring branches of
  `pdd-verify` settle undetermined boundary, granularity, naming, and
  acceptance calls in rounds before writing. They attach the evidence they read
  and surface remaining judgment calls explicitly; ideate's proposed delta ends
  with a `Judgment calls` section, as map's already did. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- `pdd-verify` re-derives findings from the current model and
  repository, verifies Entity facts, states, relations, composed transitions,
  Step effects, and Rule grants, and never persists a workflow ledger. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- The docs define each resource type on its owning page. Actor guidance moved
  into Entities, Capability and Journey pages own their Scenario fields,
  Business Rules owns permission semantics, and the catalog transport — the
  report media type and its `version` parameter — is written where a catalog
  operator reads it. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- The open page tab lives in the URL (`t`), so a Lifecycle or Scenarios tab
  survives a refresh and can be linked. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **The design record under `plans/` is retired; the constraints it carried
  moved into the registers that govern them.** `AGENTS.md` gains *How format
  decisions are judged* — the shipped agent as the standard a rule must meet,
  the ranked quality axes, empirical double-authoring, descriptive and
  generative use judged equally, and the pull-request diff as the binding human
  surface. Its report viewer standards gain four rendering rules and the
  four-row test for making a section render as more than prose. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))

### Removed

- **`actors/` is no longer a collection, and Actor is no longer a resource
  type.** A person or system that acts is an Entity with
  `kind: person|system` and `acts: external|internal`. Actor remains a role. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))

### Fixed

- **`blueprint pull` asks for the report version it can read, and refuses
  another.** The Accept header is derived from the schema's major, and a
  catalog answering with a different `version` parameter is refused before the
  body is parsed. A report of another schema version, from a catalog or a file,
  is refused in one sentence naming both versions instead of a Zod issue dump. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **`blueprint open` and `pull` keep the author's coverage prose.** Only
  `method` is rewritten, as the report contract says; the note that
  implementation alignment has not been verified here now lives in `method`
  with the other origin claim, and `limitations` and `rationale` come through
  exactly as authored. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- **An Experience's `interfaceIds` is exactly the Interface its id names.**
  Expansion files an Experience by its qualified id, so a list saying anything
  else was a second encoding of containment — a report could validate under one
  Interface and expand under another. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- The stable viewer keeps the current page and its filters through a recompile,
  so `pdd-kit view` can stay open while the model is edited. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))
- The packed Nuxt Layer consumer, viewer documentation, and package manifest
  stay aligned with the current report major; generated Layer `node_modules`
  are excluded from the npm tarball; and `check-repo` pins both registers and
  the CLI header to the report schema's major, so the version cannot go stale
  in prose the way it once did in code. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))

### Security

- **The installer follows no name it did not write.** The installation manifest
  is read out of the target repository, which pdd-kit treats as untrusted,
  and every name it records reaches a recursive remove. A `skills` entry that is
  not a plain directory name now invalidates the marker, a recorded name this
  Product could not have written is left alone, and every removal must resolve
  to a direct child of the skills directory — so a crafted manifest can no
  longer point `install` at a directory outside it. ([#34](https://github.com/itai-gendler/pdd-kit/pull/34)) ([2a14ea1](https://github.com/itai-gendler/pdd-kit/commit/2a14ea12885ec012557aae33e4ee44b3e003a541))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.8.0...v0.9.0][0.9.0]

## [0.8.0] - 2026-08-25

### Added

- **Co-located assets.** Files beside `<type>.md` are product assets owned by
  the entity; anything under the reserved `implementation/` directory
  describes this realization and stays home. Class comes from the path, which is
  the only rule a tool writing a capture on CI can satisfy. An optional
  `assets:` list titles and scopes those files without ever setting their class,
  and unlisted files stay legal. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- An optional `state:` on a reference or asset, valid only on a Screen and
  validated against its `## Product states`, so several captures of one view are
  placed beside the state each depicts instead of arriving as a flat list. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- A `prd` Reference kind for attaching a product requirements document as
  `intent` or `context` without making that external document the Product Model
  authority. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- An optional ordered `screens:` list on an Interface or Experience declaring
  reading order over its own children. Reachability stays with the tree. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- `pdd-kit view` serves repository files from a read-only, extension-
  allowlisted mount, and the report viewer renders local `visual` references and
  co-located assets as thumbnails instead of inert text. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Every entity has a page**, at its own URL, with the authored body at full
  width — steps, inline routes, decision points, screen states, rule statements,
  connections, and references are no longer confined to a drawer. Every page
  has Overview; Capability and Journey pages alone add Scenarios. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **A concrete Actor's marker draws what it is.** The Actor mark carries the
  authored `kind` as its silhouette — a person or a system, at the size every
  other kind's mark uses — and the Product-boundary `relationship` is written as
  a word where each reading has room for it. A Scenario Step names its Actor
  with that mark in a chip that opens the Actor, rather than as prose. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The open section and the open entity page live in the URL, so a report has
  deep links, a working browser back button, and a refresh that lands where it
  left. `PddKitReportViewer` exposes both as bindable models. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Each collection states the question it answers and the derivation behind its
  reading order, in the vocabulary the named topology views already use. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Every collection opens grouped by the containment the format declares for it,
  and says so when an entity relates to more than one group. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Counterpart Screens, Experiences and Interfaces cross-link from their pages:
  the same thing on another Interface is named as such rather than appearing to
  be a duplicate row. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- One entity's neighbourhood is drawn on the named Topology canvas, at a width
  that can render it, when the reader chooses the page's Neighbourhood action. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The stable pdd-kit Product Report: an entity-first browse, search,
  scenario, journey, and named-topology experience over one complete report
  projection. It renders every authored entity on its page while ranking
  collection and Overview readings for repeated human use. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- A shared Vue Flow foundation in the report-viewer layer (`@vue-flow/core` with a
  `@dagrejs/dagre` layered layout, both optional peer dependencies): one
  entity box and one container box for nine visual categories (with both
  Scenario types distinguished in content), a fixed relation-verb
  vocabulary, a measured Interface → Experience → Screen containment map, a
  sitemap of the same hierarchy drawn either as a top-down tree or radially
  from the Product core, plus focused entity filtering on the named Topology
  surface. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))

### Changed

- **Context is now the single location concept.** Folder schema 6 replaces
  scalar availability boundaries and Scenario Places with one strict
  `{ place: ... }` Context shape across Capability availability, Scenario
  Steps, and Business Rule selectors. A Context place resolves to an Interface,
  Experience, or Screen; Screens derive their place from their path and declare
  no availability of their own. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Product Report v10 mirrors the same model with `{ placeId: ... }` Contexts,
  removes the former availability and Place wire records, and is the only
  accepted report version. The CLI, report SDK, Product Report, bundled skills,
  fixtures, and Content Feed Reader Blueprint consume schema 6 and report v10
  directly. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Product Model terminology now names the Interface → Experience → Screen
  hierarchy directly. The under-defined “surface” alias, including
  `surface-parent`, surface-tree IDs, and the former Delivery surfaces view, has
  been replaced by concrete entity names and `screen-parent`. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Product Report entity readings present authored Capability Context once
  instead of repeating it in the fact strip and under “Available in.” Derived
  Journey and Scenario Contexts stay with their concrete routes, Screen
  placement stays in identity, and Rule Context selectors stay with
  applicability. Journey starting places retain the exact first route Context
  and appear as “Starts at”; raw entry-point routes remain report data rather
  than human-facing report content. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Collection rows, relations, search results, and topology entities open their
  URL-backed pages directly. References stay in Overview, Neighbourhood opens
  Topology, and the inspector and slideover are removed. The private report
  experiment layer remains under the final `report-viewer-lab` name with no
  active report experiments; the background audition remains independent in
  `theme-lab`. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Capability and Journey Scenarios share one route-and-Steps model.** Every
  Scenario now owns named `routes` and one ordered, typed `steps` list. An Actor
  Step names its responsible Actor, a Journey Step may name its Capability, and
  a contextualized Step maps every route to its exact Interface, Experience, or
  Screen. Route-neutral Steps remain first-class without a Context. The
  separate Journey
  `flow`, `operation`, stage ids, per-Step route objects, Scenario-wide Actors
  and availability, authored Screen Scenario backlinks, and Markdown `## Steps`
  are removed. Folder schema 3 and Product Report v7 are no longer accepted;
  this release has no compatibility reader. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Every Interface now declares one required interaction `type` (`web`,
  `mobile-app`, `desktop-app`, `cli`, `api`, `webhook`, `messaging`, `voice`,
  or `device`). Reports preserve it directly and use it to distinguish
  Interface contexts visually instead of guessing from ids or route names. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- A Journey Step names a durable Capability, never a Capability Scenario, while
  its text states the concrete observable action or condition. Capability
  Scenarios may split and merge without leaving dangling Journey composition
  references. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Journey pages have one Scenario reading.** The peer `Flows` tab and the
  duplicate Journey-local diagram are removed because they projected the same
  authored Steps while silently dropping Steps without a Capability. The named
  topology view is now **Journey composition**: it explicitly answers the
  narrower Capability-composition question. Outside visible Domain groupings,
  Capability nodes use the consistent Capability color rather than inheriting
  a Domain color that could be mistaken for status. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Capability and Journey Scenarios share one Steps treatment.** Both render
  the same Step-by-route matrix. Columns use the authored route name and stable
  order; placed cells show the exact typed Interface → Experience → Screen
  hierarchy. Step-kind labels explain Actor actions, Product actions, and
  conditions; Capability labels appear only where they discriminate Journey
  Steps. Steps without a Context and Context transitions are described in
  plain language, without exposing internal route ids. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **The report navigation rail lists kinds, flat.** Kinds do not nest —
  instances do — so both Scenario kinds leave the rail and are read on the page
  for the Capability or Journey that owns them. The Capability and Journey main
  screens open their collections directly, without a redundant parent/Scenario
  tab strip. Ten destinations instead of twelve, and no indentation claiming a
  hierarchy the other eight rows have too. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Collection chrome scales with the collection.** The per-relation filter
  dropdowns collapse into one control with a chip per *active* filter, and it is
  not rendered at all below eight entities — seven dropdowns above four Journeys
  was a wall, not an offer. The card-style switcher is gone; the dense row is
  the only layout, and it carries the fact that distinguishes an entity from its
  neighbours (a Screen's scope, a Scenario's parent) where the repeated kind
  label used to be. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Entity tables render the name of a relation the format makes single-valued
  rather than the count `1`, and drop any column constant across the rows on
  screen. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The bundled skills carry a worked Capability Scenario. The reference every
  skill reads described `routes`, typed `steps`, and per-route Contexts in
  prose but showed no Scenario file, leaving the model's most structured
  artifact to be inferred. The example is single-route, because that is the
  case where the `routes` requirement is least guessable. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The bundled skills name the Product's portable identity keys — `summary`,
  `category`, `authors`, and `license`. Report hosts read all four, and a model
  authored without them reaches a Blueprint incomplete. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- `npm run check` asserts that every entity kind, frontmatter key, and required
  section named in `spec/format.md` also appears in the canonical skill
  reference. The reference may be terser than the contract; it may not omit a
  name, because an agent cannot author a key it was never told about. It found
  the three missing Product keys above on its first run. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- A README for the `pdd-toolkit/nuxt/theme` layer, which shipped as a public
  export with no documentation of its palette roles, type scale,
  `<PddKitBrand>` lockup, or icon-family composable. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Folder schema 5 — a breaking change with no compatibility reader.** An
  entity is compact as `<id>.md` until it owns an asset or typed child
  collection, then expands to `<id>/<type>.md`. Both shapes derive the same id
  and cannot coexist. This keeps leaf-heavy collections readable while giving
  every kind—Screens most of all—a co-located namespace when needed.
  `product.md` similarly expands to `product/product.md` only when it owns
  `logo.svg`. Two coexisting shapes, and an expanded folder missing its
  `<type>.md`, are `lint` errors — neither is a state a correct model passes
  through. An expanded folder that owns nothing *yet* is a warning instead: the
  rule still holds, and expansion normalizes the folder back to the compact
  form, but an author reaches the expanded shape in two steps and the
  intermediate step is not a defect. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **The Interface → Experience → Screen hierarchy nests.** An Experience
  belongs to exactly one Interface and
  a Screen to exactly one scope, so the path is the parent relation. An
  Experience no longer writes `interfaces:`, a Capability Scenario no longer
  writes `capability:`, a Journey Scenario no longer writes `journey:`, and a
  Screen no longer writes `availability:`. Reparenting is a `git mv` that reads
  correctly in a pull request. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Interface, Experience, and Screen ids are qualified** by the path that
  distinguishes them. Experience and Screen names repeat across Interfaces on purpose: two entities of the same
  kind sharing a path suffix below their Interface are counterparts — the same
  thing on two Interfaces. Behavior-tree ids stay bare and globally unique. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Domain is a subject axis, not a capability folder.** It now requires a
  `## Boundary` section, and only Capability authors `domain:` — a Screen's,
  Experience's or Journey's Domains are derived through their Capabilities
  rather than restated where a second copy could disagree. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Product Report `schemaVersion` is `10.0.0`, and the catalog media type moves
  to `version=10`. There is exactly one accepted report version, as before. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Scenario documentation moves onto its parent's page. A Scenario is not a
  top-level entity — it has a mandatory single parent that decides its kind —
  so Capability Scenarios are documented in `docs/capabilities.md`, Journey
  Scenarios in `docs/journeys.md`, and the containment rule that separates them
  in `docs/product-model.md`. The standalone `docs/scenarios.md` is removed. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- An external system is an Actor only when it **initiates** interaction with
  the Product, and only then does it arrive through an Interface.
  Interfaces are inbound by definition; an outbound connection the Product
  opens to a third party — a polled feed, a payment processor, a mail provider,
  a model API — is not an Interface and its far side is not an Actor. Model the
  call inside the Capability that makes it, scope that Capability to the
  Interfaces where an Actor observes the result, and make its
  product-significant failure behavior a Capability Scenario. Direction, not
  ownership, is the axis: the same third party calling the Product back through
  a webhook is a genuine Actor with a genuine Interface. No entity type, folder
  schema, parser, or linter behavior changes — `lint` cannot recover direction
  from the files, so the rule lives in `spec/format.md`, the Product Model
  docs, and the mapping rubric. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The Content Feed Reader Blueprint applies that rule. It drops the
  `feed-provider` Actor and the `syndicated-feed-integration` Interface;
  `feed-synchronization` now lives on the Reader-facing Interfaces where its
  result is seen, carries the RSS specification as a context Reference, and is
  triggered by a Reader-initiated refresh on the Source list Screen — a trigger
  the model previously never stated. Its catch-up failure variation no longer
  contradicts itself about whether the backlog was unchanged or caught up. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Breaking.** `pdd-toolkit/nuxt/report-viewer` accepts the canonical
  `ProductReportV10` directly and owns the complete Product Report projection
  and topology engine. The lossy report view-model export and
  the former whole-report audition layer are removed. The private,
  unpublished `report-viewer-lab` remains as an empty boundary for future
  experiments, while `theme-lab` continues to own background auditions. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- **Breaking.** Logo, lockup, and favicon selection are no longer theme-lab
  experiments. The approved mark, wordmark, brand renderer, favicon, and
  install-icon family now live at canonical paths in `pdd-toolkit/nuxt/theme`;
  `pdd-toolkit/theme-lab/variants` exposes background choices only. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The Product Report keeps entity identity collision-safe across collections,
  preserves focus across live recompiles, separates Capability and Journey
  Scenario readings, shows Screen-to-Journey derivation provenance, renders
  ordered Journey path lanes, and uses fixed named views instead of a generic
  cross-kind grouping builder. Mobile navigation is a dedicated drawer. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Product Report v10 stores authored supporting H2 sections as ordered
  `{ heading, content }` records instead of an opaque Markdown string. Lint
  rejects Journey and Scenario lead prose, duplicate or conflicting structured
  sections, malformed structured lists, and duplicate values in set-valued
  relations rather than allowing authored content to disappear or inflate
  derived relationships. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The Content Feed Reader catalog Blueprint now models two actor-facing access
  boundaries: Reader work and Visitor consumption. Feed collection is an
  outbound Capability dependency rather than a synthetic Actor or Interface.
  The model has two Actors, two Interfaces, three Experiences, three Domains,
  eight Screens, ten Capabilities, twenty-four Capability Scenarios, four
  Journeys, eight Journey Scenarios, and four Business Rules. Domains group
  Capabilities on one axis — Sources, Reading, Collections — so no Capability
  needs its Domain's definition widened to admit it. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Both teaching models now demonstrate a Journey that is attempted and not
  reached. The Blueprint carries two `not-achieved` Journey Scenarios and the
  golden fixture one, so `result` is an axis with real values rather than a
  constant, and `failureOnlyCapabilityIds` is exercised against authored
  content instead of always deriving empty. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The Product Report treats Capability Scenarios and Journey Scenarios as
  separate entity kinds rather than one kind carrying a type flag. They remain
  contained by their Capability or Journey while preserving their own search
  results, pages, terminal results, and derived backlinks. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))

### Fixed

- The release artifact smoke test follows the promoted stable boundaries: it
  requires the approved icon under `theme`, not an old `theme-lab` audition
  path, and rejects the retired lossy Report View Model export instead of
  requiring it. The stale assertions stopped the first `v0.8.0` publish
  attempts before npm. ([#32](https://github.com/itai-gendler/pdd-kit/pull/32)) ([dbca71a](https://github.com/itai-gendler/pdd-kit/commit/dbca71a955d22f5d3e42e642bc894a747f8f1722))
- `package.json` no longer lists `plans/shared-theme-lab.md` among its packaged
  files. The file was deleted while the entry stayed, and npm drops a missing
  `files` entry silently, so the packed tarball simply carried no `plans/` at
  all and nothing reported it. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The docs group allowlist no longer permits `Learn from examples`, which no
  page has used since the feed-reader walkthrough was removed. An allowed group
  with nothing behind it is a sidebar section the navigation cannot build. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Two routes of one Scenario that repeat the same Context place sequence are
  now a finding in both `lint` and report validation. A route id names one
  traversal, so a second id over the same sequence claims a lane the Product
  does not have. The Content Feed Reader Blueprint carried two:
  `publish-on-mobile` and `unlist-from-mobile`, which never left the web
  Interface, and could not have — neither Capability declares a mobile context. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Entity pages no longer inherit the scroll offset of the collection or entity
  that opened them, so each reading begins at its own title, identity, and lead. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The local viewer resolves the Blueprint logo at `product/logo.svg`, where
  schema 5 puts it once the Product expands. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- An unexpected entry in a collection is now an explicit finding. A file nested
  one level too deep, or saved with the wrong extension, previously vanished
  from the model with no finding at all. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The local viewer's Content-Security-Policy sets `manifest-src`, which was
  blocking `site.webmanifest`. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- The Product Report light and dark page surfaces are part of the shared theme
  again. The warm base, top glow, and paper grain moved from the optional
  theme-lab audition layer into `pdd-toolkit/nuxt/theme`, where the promoted
  Product Report and the bundled local viewer inherit them without depending on a
  lab layer. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Journey composition no longer implies a Screen is reached from a Step that
  cannot expose it. A Screen is authored against the whole Journey Scenario, so
  it now attaches to the last Capability-bearing Step whose Capability declares that
  Screen and shares an availability context with it — a non-visual integration
  Step no longer appears to land on a Reader Screen. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))
- Journey composition lays ordered Capability-bearing Steps downward with variations side by side. A
  left-to-right chain was wider than the canvas for a short Journey, so it
  scaled the whole graph down and left the height unused. ([#30](https://github.com/itai-gendler/pdd-kit/pull/30)) ([1a22915](https://github.com/itai-gendler/pdd-kit/commit/1a22915c144f334269c2602c85e5ff67d946d726))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.7.2...v0.8.0][0.8.0]

## [0.7.2] - 2026-08-05

### Added

- Add `--help` and strict option parsing to the Blueprint catalog publisher so
  its maintainer-only production flow is discoverable before a credential is
  configured. ([#12](https://github.com/itai-gendler/pdd-kit/pull/12)) ([2d03595](https://github.com/itai-gendler/pdd-kit/commit/2d03595addf1ea2992aae9909639818a3b53abd3))

### Fixed

- Open the `BL` ligature apart in the generated tab icons, so a browser tab shows
  two letters instead of one blob at 16px. Only the favicon family is respaced —
  the logo artwork and the larger app icons keep the ligature as drawn. ([#11](https://github.com/itai-gendler/pdd-kit/pull/11)) ([b863f6d](https://github.com/itai-gendler/pdd-kit/commit/b863f6dd5b041d88180fb540c96f7b2233f8633e))
- Restrict the Blueprint publisher credential to the exact production catalog
  origin or a loopback development origin, preventing a mistaken `--catalog`
  value from sending it to an arbitrary HTTPS host. ([#12](https://github.com/itai-gendler/pdd-kit/pull/12)) ([2d03595](https://github.com/itai-gendler/pdd-kit/commit/2d03595addf1ea2992aae9909639818a3b53abd3))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.7.1...v0.7.2][0.7.2]

## [0.7.1] - 2026-08-04

### Fixed

- Compile the public `pdd-toolkit/theme-lab/variants` subpath into `dist` so
  plain Node consumers such as Playwright can import it from `node_modules`
  without relying on unsupported TypeScript stripping. ([5cf8b56](https://github.com/itai-gendler/pdd-kit/commit/5cf8b56c69028b474fe20b609072e73ab224f344))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.7.0...v0.7.1][0.7.1]

## [0.7.0] - 2026-08-04

### Added

- `pdd-kit view` renders the current Product Model privately on localhost,
  recompiles automatically after debounced source edits, streams revisions to
  open browsers, retains the last valid report during lint errors, writes no
  generated report, and opens no network listener beyond `127.0.0.1`. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Root `pdd-toolkit` exports for the pure Product Report view-model projection,
  the shared Nuxt report renderer, and a sibling pdd-kit-wide theme Layer,
  so hosts share UI without a second public npm package. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- An opt-in shared Nuxt theme-lab Layer for auditioning the same backgrounds,
  marks, lockups, and favicon families across the landing site and local report
  viewer without promoting undecided presentation into the stable theme. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- An optional `product-model/product/logo.svg` Product logo used by the local viewer and
  Blueprint presentation. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- First-class Interface entities for supported Product interaction contracts,
  with exact Interface–Experience availability across Capabilities, Journeys,
  Screens, Scenarios, and Business Rules. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Required Actor classification as `person|system` and `external|internal`. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Platform-neutral Screen entities for meaningful web and mobile product views,
  including product-visible information, actions, states, capability boundaries,
  relationships, and optional public routes or deep links. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Universal References on every semantic entity, with independent artifact
  kinds (`code|spec|proposal|doc|adr|visual|research`) and attachment roles
  (`intent|implementation|context`). Referenced content stays outside the
  Product Model and never replaces its prose or proves alignment. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `pdd-map` for initial adoption, scoped remapping, and deliberate
  Product Model coverage expansion without executing target code. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `pdd-verify` as the single post-build invocation. It classifies
  model/code gaps, negotiates only authority decisions, automatically runs
  internal intent-resolution or scoped-mapping phases, hands code corrections
  to a harness-injected builder, and re-verifies until aligned or blocked. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `report only` verification mode, an explicit missing-builder handoff, and an
  unchanged-gap stopping rule. Verification findings are re-derived rather than
  persisted in a receipt or ledger. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Accepted decisions covering repository-owned files, unified References,
  non-persisted verification, and the three-skill boundary. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))

### Changed

- The CLI now uses a real hierarchical command parser with concise root help,
  command-specific options, nested Blueprint help, standard `-h`/`-V` flags,
  strict option ownership, and usage validation before command execution. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `-c, --cwd` now always means "run from this directory". A model directly in the
  current directory wins over the Git-root model whether or not `--cwd .` was
  typed explicitly. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** A catalog Blueprint has no separate `blueprint.yaml`. Product
  ID, title, summary, description, category, tags, authors, license, and report
  content come from `product.md`; visual identity comes only from
  `product-model/product/logo.svg`, and catalog operational state remains outside the
  Product Model. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** Product Report v7 is the only accepted report contract. It
  carries portable Product identity and attribution, uses `summary` for the
  short Product description, and renames computed entity totals to `counts`. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** `blueprint contribute` no longer accepts `--slug`; the Product
  ID is the canonical contribution directory, branch suffix, catalog slug, and
  pull name. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))

- **Breaking.** Folder schema 3 and Product Report v7 are now the only accepted
  formats. Schema 1/2, Product Report v4/v5/v6, and their compatibility paths are
  removed rather than migrated. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** Feature is renamed Capability throughout the folder format,
  parser, SDK, CLI, skills, docs, fixtures, and Blueprint. `features/` is
  rejected; Capabilities live in `capabilities/`. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** Experiences now declare their Interfaces and no longer carry
  `exit`. Journeys use Capabilities and exact availability, may cross Domains,
  and no longer declare one Domain. Business Rules exclusively own Rule scope. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Domains are optional Capability groupings. Screens remain optional and now
  use exact availability without embedding visual evidence. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- The bundled Content & Feed Reader Blueprint now demonstrates the complete
  model, including cross-platform Screens, product states, mobile deep links,
  and external visual and research references. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** The public skill set is exactly `pdd-map`,
  `pdd-ideate`, and `pdd-verify`. Ideate also handles a narrow
  already-decided verification handoff without reopening broad brainstorming. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** `pdd-kit validate` is now `pdd-kit lint`. The old
  spelling is refused with exit code 2 and a replacement message; it is not an
  alias. Lint output contains only `ok`, `errors`, `warnings`, and `counts`—no
  branch situation or authority inference. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** `references` replaces both `codeRefs` and `links`. Reference
  records are strict, duplicate targets fail lint, code targets require tracked
  files, and missing local non-code targets warn. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `coverage.status` now describes model breadth only: `draft` while the model
  itself is under review, `partial` with known unmapped areas, and `complete`
  when intended product scope is modeled. A complete model may have zero
  References. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** Product Report v7 declares a `workspace` or `portable` Reference
  profile. Portable projection replaces evidence-redaction terminology and
  keeps only HTTP(S) intent/context References. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- **Breaking.** Coverage no longer contains counts, mapped entities, or a
  redaction flag. Entity totals live only in Counts; Coverage is independent
  from References. Blueprint open and pull preserve model breadth while
  removing repository-local Coverage source areas. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Every model creation path carries canonical orientation in
  `product-model/README.md`. pdd-kit still never writes target-root
  `AGENTS.md`, `CLAUDE.md`, or README files. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Canonical report expansion now owns that orientation file for `open`, `pull`,
  and `contribute`; Blueprint contributions accept every valid model-breadth
  Coverage status and publish no source-repository provenance. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Lint now requires the complete committed model shell (`README.md` plus a
  `.gitignore` covering `build/` and `cache/`), and CLI argument, provider,
  scope, slug, and catalog-origin errors consistently exit with usage code 2. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Documentation now teaches three starting doors and one ongoing loop:
  `ideate → injected build → verify (including final lint) → merge`. Map is explicitly not a
  daily maintenance command, and lint is explicitly not semantic verification. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))

### Fixed

- Product logos are parsed as namespace-aware XML and restricted to a static SVG
  allowlist, closing namespace-prefix and escaped-reference paths around the
  active-content checks. Logo responses from the local viewer also carry a
  script-free sandbox CSP. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- `blueprint pull` retrieves the optional logo from the selected catalog's
  same-origin endpoint, so custom catalogs and commit-pinned reports cannot be
  paired with the current logo from the official PDD `main` branch. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Releases tag an already prepared package and changelog exactly once; the tag
  push is now the single automatic publication trigger. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))

### Removed

- The init, sync, doctor, and deep-dive skills. Their useful scopes now belong to map or verify. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- The contribute skill. Catalog contribution remains the deterministic
  `pdd-kit blueprint contribute` CLI command. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))
- Git branch-state routing from lint and the internal `branch-state` module. ([2339dd3](https://github.com/itai-gendler/pdd-kit/commit/2339dd369eaf459d2dce5f647c6a606e81517426))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [1e35f0f...v0.7.0][0.7.0]

## [0.6.0] - 2026-07-31

pdd-kit consolidates onto one site. The Platform is retired; the Blueprint
catalog moves to `pdd-kit.dev` and becomes anonymous to browse and to pull.

The previous published npm version is `0.5.0`. An intermediate draft of this
release included authenticated Platform workflows, but it was never published;
the final `0.6.0` replaces those workflows with the anonymous catalog and the
pull-request contribution flow described below.

### Added

- `pdd-kit open <report>` expands a local Product Report back into a
  canonical `product-model/` Product Model, making `export` and `open`
  semantic inverses. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `pdd-kit pull <blueprint-name>` anonymously retrieves a Blueprint and
  expands it without a user-facing `report.json` download. It writes a
  greenfield block into `AGENTS.md` and sends
  `user-agent: pdd-kit/<version>` to the catalog. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- **Features** and **business rules** are first-class product-model entities
  with their own directories, IDs, relationships, and validation rules. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- A `pdd-toolkit/report` library entry point exporting the Product Report
  schema, its cross-entity validator, and the canonical digest. It depends only
  on `zod` and never loads the CLI. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `redactSourceEvidence` in the `pdd-toolkit/report` contract strips every
  repository reference from a report before it leaves its owning workspace —
  `codeRefs`, repository `entryPoints`, repository-relative `links`, and
  `coverage.sourceAreas`. Product-facing routes and HTTP(S) URLs are kept.
  `coverage.mapped` remains a model-quality signal, and
  `coverage.evidenceRedacted` records both that those counts describe the
  origin repository and that validation must reject any repository path still
  present. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- Plan and verify skills for planning in the
  Product Model and verifying implementation evidence before merge. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- An implement skill builds the software a Product Model describes, with
  its scenarios as the acceptance contract. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `pdd-ideate` proposes candidate product directions as a shortlist.
  It is the only skill that never writes to the model. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- Draft greenfield product models, with missing-evidence warnings during
  planning and support for exporting planned Product Model Versions before
  implementation is complete. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `blueprints/` — the Blueprint source layout, with a `blueprint.yaml` manifest
  and MIT-licensed content. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `blueprints:check`, wired into `verify`, parses every manifest, builds every
  Blueprint, and rejects any that carries source evidence. It does not trust
  `contribute`, because anyone can open a pull request by hand. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `blueprints:publish` pushes built Blueprints to the catalog. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `resolveModelRoot` allows the model to live outside the Git root or without a
  repository, adding general monorepo support. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- A structured open-source documentation section with tutorials, individual
  skill pages, and deterministic navigation frontmatter. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `docs/terminology.md` defines every product-model entity and separates the
  terms that are easy to confuse. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))

### Changed

- **Breaking.** `pdd-kit publish` is now `pdd-kit contribute`, and
  opens a pull request against `itai-gendler/pdd-kit` through the `gh` CLI rather
  than submitting to a Platform. No API key is involved. The model in the pull
  request is regenerated from a redacted report, so it carries no source paths
  and is byte-identical to what `pull` produces. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- **Breaking.** `pdd-kit build` is now `pdd-kit export`. `build` still
  works and warns; it will be removed after 0.6.x. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `export` emits a source-free **Product Report v4** at
  `product-model/build/report.json`, replacing the portable v3 `project.json`.
  The report carries no repository URL, commit, branch, or workspace metadata. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- **Breaking.** The model directory is now called the **Product Model** throughout
  the CLI, docs, and skills. "Product map" is reserved for a visual or
  navigable view of that model. Draft coverage is an evidence state and no
  longer implies a reusable Blueprint. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- Product Report validation rejects content that cannot round-trip into
  canonical Markdown and inconsistent mapped-coverage counts. Product Model
  validation continues to reject non-draft behavioral claims without evidence. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- `--catalog` defaults to `https://pdd-kit.dev` and accepts any origin.
  Precedence is `--catalog`, the catalog URL environment variable, then the default. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- The publish skill is now the contribute skill. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- Skill runners pin the CLI to the version the skills were installed from rather
  than resolving the latest published version, which could validate a model
  against an older published format. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))

### Fixed

- Report expansion is idempotent. `open` appended its coverage limitation
  unconditionally, so every open/pull cycle gained another copy and broke the
  guarantee that a pulled Blueprint matches what the catalog holds. ([#5](https://github.com/itai-gendler/pdd-kit/pull/5)) ([1b01308](https://github.com/itai-gendler/pdd-kit/commit/1b01308ccd92276683068761b7795c5029176b70))
- Docs dispatch sends an immutable commit-pinned revision to the landing
  pipeline ([#2](https://github.com/itai-gendler/pdd-kit/pull/2)). ([#3](https://github.com/itai-gendler/pdd-kit/pull/3)) ([d57aeb4](https://github.com/itai-gendler/pdd-kit/commit/d57aeb41f17aa335a1616474c250d17bbcf0206a))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.5.0...1e35f0f][0.6.0]

## [0.5.0] - 2026-07-26

### Added

- `build` and `publish` CLI commands, the publish skill with its
  isolated runner, and the CI publishing recipe
  ([#1](https://github.com/itai-gendler/pdd-kit/pull/1)). ([cff997b](https://github.com/itai-gendler/pdd-kit/commit/cff997b7aa8c05f27a3efa16290c16b48f8f0448))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.4.0...v0.5.0][0.5.0]

## [0.4.0] - 2026-07-26

Initial public launch of the repository.

### Added

- CLI: `install`, `update`, and `validate` commands. ([90ed7d1](https://github.com/itai-gendler/pdd-kit/commit/90ed7d1c040d6c78f0a88c40e061d78122f3afde))
- Agent skills for init, sync, deep-dive, validate, and doctor. ([90ed7d1](https://github.com/itai-gendler/pdd-kit/commit/90ed7d1c040d6c78f0a88c40e061d78122f3afde))
- The `product-model/` product-map format and its contract in
  `docs/format.md`. ([90ed7d1](https://github.com/itai-gendler/pdd-kit/commit/90ed7d1c040d6c78f0a88c40e061d78122f3afde))
- Claude plugin manifest and marketplace entry. ([90ed7d1](https://github.com/itai-gendler/pdd-kit/commit/90ed7d1c040d6c78f0a88c40e061d78122f3afde))

### Contributors

- [@itai-gendler](https://github.com/itai-gendler)

**Full Changelog**: [v0.4.0][0.4.0]

[Unreleased]: https://github.com/itai-gendler/pdd-kit/compare/v0.37.0...HEAD
[0.37.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.36.0...v0.37.0
[0.36.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.35.0...v0.36.0
[0.35.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.34.1...v0.35.0
[0.34.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.34.0...v0.34.1
[0.34.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.33.0...v0.34.0
[0.33.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.32.0...v0.33.0
[0.32.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.31.0...v0.32.0
[0.31.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.30.0...v0.31.0
[0.30.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.29.1...v0.30.0
[0.29.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.28.0...v0.29.0
[0.28.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.25.1...v0.26.0
[0.25.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.25.0...v0.25.1
[0.25.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.24.2...v0.25.0
[0.24.2]: https://github.com/itai-gendler/pdd-kit/compare/v0.24.1...v0.24.2
[0.24.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.24.0...v0.24.1
[0.24.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.23.1...v0.24.0
[0.23.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.23.0...v0.23.1
[0.23.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.18.0...v0.19.0
[0.18.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.15.0...v0.16.0
[0.15.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/itai-gendler/pdd-kit/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/itai-gendler/pdd-kit/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/itai-gendler/pdd-kit/compare/1e35f0f...v0.7.0
[0.6.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.5.0...1e35f0f
[0.5.0]: https://github.com/itai-gendler/pdd-kit/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/itai-gendler/pdd-kit/releases/tag/v0.4.0
