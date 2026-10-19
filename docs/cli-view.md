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

## Changes

When your checkout is a Git repository, the report also shows what changed in
the Product Model. There is nothing to pass: you pick what to compare with in
the report itself, on the Changes page at the top of the sidebar; a chip in
the report's header names what you are comparing with on every page and opens
it. The other side is always your working tree, the report on screen. Changes
can be turned off from its page, hiding every change mark until you turn it
back on from the chip.

- **Uncommitted**, the default: what you changed since your last commit,
  staged or not, including new files.
- **Since origin/main**, named for what it measures from: everything since
  your branch left the default branch, its commits and your uncommitted
  changes together, as a pull request shows it. Its menu measures from another
  branch instead, such as the one a stacked branch was cut from, or from a tag.
  On the default branch itself it reads **Not pushed**: your commits the remote
  does not have yet. Once those are pushed it measures from your latest tag,
  **Since v1.2**, and with no tag there is only Uncommitted.

When the default branch has no Product Model yet, so everything reads as new,
the menu also offers when the model was created: the commit on your branch
that created it. To compare two past versions, check out the later one first.

Changes are read as the model means them, not as lines of Markdown: a resource
added, removed or modified, field by field, and Scenario Steps lined up like a
diff. A resource is identified by its type and id, so renaming an id reads as a
removal and an addition, and moving a file without changing its id changes
nothing. `product-model/build/` and `product-model/cache/` never count.

The version you compare with is read from Git's object store into a temporary
folder that is deleted at once. Nothing is checked out or stashed, and no ref, index entry or
file in your repository is written. The comparison follows your edits as you
save, and a new commit, a checkout or a fetch moves it along. A comparison says
what changed in the model, never whether the code does either; checking that is [`pdd-verify`](./skill-pdd-verify.md)'s job.

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
credentials, and deleted when you stop. Nothing from it runs. Its model must
lint before the report opens, and the report does not refresh. Run the command
again for a newer revision. `--cwd` does not apply.

Exits 0 when you stop it, 1 when the port cannot be opened or a repository
cannot be fetched or does not lint, and 2 for conflicting or invalid options.

## Next

- [`lint`](./cli-lint.md) to see every error in the terminal.
- [`blueprint export`](./cli-export.md) to write a portable report file.
