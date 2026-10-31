---
title: blueprint pull
description: Pull a published Blueprint into the current directory.
section: open-source
group: CLI
order: 28
---

# `pdd-kit blueprint pull`

Pull a published [Blueprint](./from-a-blueprint.md#what-a-blueprint-is) by name
into `product-model/`, to start a product from a reviewed model.
[`blueprint list`](./cli-list.md) shows the names.

```bash
npx pdd-toolkit blueprint pull <name> [--force]
```

## Options

| Option | Meaning |
| --- | --- |
| `<name>` | The Blueprint's name: lowercase kebab-case, at most 80 characters |
| `--force` | Move a non-empty `product-model/` aside to a backup first |

`--cwd` picks the directory that receives `product-model/`.

## What it does

1. Downloads the Blueprint index and the report it names, anonymously (no
   account or sign-in).
2. Checks the report, then downloads the Product logo and cover if the
   Blueprint has them. A missing or invalid one is skipped, not an error, and a
   cover comes only with a logo.
3. Expands it exactly as [`blueprint open`](./cli-open.md) does, with the logo
   restored as `product-model/product/logo.svg` and the cover as
   `product-model/product/cover.webp`.

## Where Blueprints come from

Every Blueprint lives in `blueprints/` of the
[pdd-kit repository](https://github.com/itai-gendler/pdd-kit/tree/main/blueprints).
Each merge rebuilds them into the `blueprints-v20` GitHub Release, so a newly
merged Blueprint is pullable within minutes, without a CLI update. The `20` is
the report version this CLI reads.

To pull from a fork instead, set `PDD_KIT_BLUEPRINT_REPOSITORY` to its
`owner/repo`; the fork needs the same release, which its own copy of the
Publish Blueprints workflow builds.

## Safety

`pull` writes only after the report matches the digest in the index, its
Blueprint name, this CLI's report version and the 8 MiB limit, and only over
HTTPS. A refusal writes nothing.

Exits 0 when the model is written, 1 when the release, the network or the target
refuses it, and 2 for an invalid name, repository or option.

## Next

- [Start from a Blueprint](./from-a-blueprint.md#steps) to review, adapt,
  implement and check it.
