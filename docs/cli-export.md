---
title: blueprint export
description: Compile a Product Model into a portable Product Report that can move safely between repositories.
section: open-source
group: CLI
order: 25
---

# `pdd-kit blueprint export`

Turn your Product Model into a [Blueprint](./from-a-blueprint.md#what-a-blueprint-is)
file, when you want to hand the model to another repository or inspect what
would travel.

```bash
npx pdd-toolkit blueprint export
```

## Options

None.

## What it does

1. Finds the model (see [Choosing the Product Model](./cli.md#choosing-the-product-model))
   and lints it. Any lint error stops the run.
2. Compiles it into a Product Report (schema version 20) and applies the
   [portable projection](#portable-export).
3. Writes `product-model/build/report.json`, plus a small
   `product-model/cache/build.json` stamp. Both are generated and gitignored, and
   replaced on every run.

The report carries no logo or cover: `product-model/product/logo.svg` and
`cover.webp` stay behind.

## Portable export

The projection drops what only makes sense in your repository and keeps the
product meaning:

| Field | Portable result |
| --- | --- |
| `references` | Keep only HTTP(S) `intent` and `context` References, never kind `code` |
| `entryPoints` | Remove repository paths and `file:` URLs; keep Product routes, HTTP(S) URLs, other deep links and commands |
| `coverage` | Emptied: Coverage describes this repository's code, which a Blueprint does not carry |
| `referenceProfile` | Set to `portable` |
| `lintVerbs` | Keep the model's custom verbs so naming checks work after import |

See [Coverage](./product-model.md#coverage) and [References](./references.md).

Exits 0 when the report is written, 1 when no model is found or it does not
lint, and 2 for an unknown option.

## Next

- [`blueprint open`](./cli-open.md) expands the file into a Product Model
  elsewhere.
- [`blueprint contribute`](./cli-contribute.md) proposes it as a Blueprint.
