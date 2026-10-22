---
title: view
description: Open a Product Model as a private local report, from your checkout or from a GitHub repository.
section: open-source
group: CLI
order: 24
---

# `pdd-kit view`

Open a Product Model as a read-only report in your browser, while you write it
or to review someone else's branch or pull request.

```bash
npx pdd-toolkit view [repository] [--branch <name> | --pr <number>] [--no-open] [--port <port>]
```

## Options

| Option | Meaning |
| --- | --- |
| `[repository]` | A GitHub repository to view instead of your checkout |
| `--branch <name>` | Branch or tag of that repository |
| `--pr <number>` | Pull request of that repository; not with `--branch` |
| `--no-open` | Print the URL without opening the browser |
| `--port <port>` | Port from 1 to 65535; by default a free port the system picks |

## What it does

1. Starts a server on `127.0.0.1` only, and opens the report.
2. Compiles the model in memory. It writes nothing to your repository (no
   `product-model/build/report.json`) and sends nothing to pdd-kit.
3. Remembers how you set up the report (columns per collection, term tooltips,
   the expanded resource panel) in `pdd-kit/viewer-preferences.json` in your
   configuration folder (`$XDG_CONFIG_HOME` or `~/.config`, `%APPDATA%` on
   Windows), so the next run opens the same way.
4. Keeps running until you press Ctrl+C.

If the [GitHub CLI](https://cli.github.com) is signed in, the report asks GitHub
through `gh` whether you have starred pdd-kit, and a star beside the GitHub
link stars it when you click it, or unstars it when you click it again. Without
`gh`, only the link shows.

## Your checkout

With no repository, `view` uses your local model. See
[Choosing the Product Model](./cli.md#choosing-the-product-model). The report
follows your edits as you or your agent save them, and it still opens when the
model has lint errors:

- **The model builds with errors.** The report shows it and counts the problems
  in its header. A resource missing part of its file because of an error says
  so in its own reading.
- **A save stops the model from building.** The report keeps the last version
  that built, says how old it is, and lists what stops the rebuild.
- **Nothing has built yet.** The page lists the errors by file, and turns into
  the report on the first save that fixes them.

Each list can be copied as a request for your agent. With no model yet, the
page waits for one. Only `view` relaxes this: `lint` still fails and
`blueprint export` still refuses a model with errors.

## A GitHub repository

Pass `owner/repo`, a `https://github.com/owner/repo` URL, or
`git@github.com:owner/repo.git` to fetch over SSH. Only GitHub is supported, and
`git` must be installed.

```bash
npx pdd-toolkit view acme/checkout                      # default branch
npx pdd-toolkit view acme/checkout --branch release/2.4
npx pdd-toolkit view acme/checkout --pr 12
npx pdd-toolkit view https://github.com/acme/checkout/pull/12
```

A `.../tree/<branch>` or `.../pull/<number>` URL already picks the revision; do
not add `--branch` or `--pr`. A pull request from a fork shows the fork's
content.

The revision is fetched shallowly into a temporary directory, with your own Git
credentials, and deleted when you stop. Nothing from it runs. The report opens
as it does for your checkout, with any lint errors beside the model, but it
does not refresh: a model that does not build stops the command and prints
why. Run the command again for a newer revision. `--cwd` does not apply.

Exits 0 when you stop it, 1 when the port cannot be opened or a repository
cannot be fetched or its model does not build, and 2 for conflicting or invalid
options.

## Next

- [`lint`](./cli-lint.md) to see every error in the terminal.
- [`blueprint export`](./cli-export.md) to write a portable report file.
