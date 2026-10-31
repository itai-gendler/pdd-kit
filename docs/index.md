---
title: Introduction
description: pdd-kit brings Product-Driven Development to coding agents through a git-tracked Product Model and a verification loop that resolves gaps only with your approval.
section: open-source
group: Get started
order: 1
---

# Product-Driven Development for coding agents

pdd-kit is Product-Driven Development for coding agents. It keeps one
definition of your product in `product-model/`: what your product does, for whom,
where, and under which rules, including where it works more than one way
([Variations](./variations.md): feature flags, plan tiers, A/B tests, API
versions). The [Model overview](./product-model.md) explains the folder in five
minutes.

The Product Model says what the product is intended to do. It does not prescribe
the stack or replace your plan mode, SDD tool, coding agent, or tests.

## What the model covers, and what it doesn't

The model keeps what any rebuild of your web app, CLI or API would have to
keep, and nothing a rebuild is free to change:

| In the model | Left to design |
| --- | --- |
| Who can reach each place | Colors, typography, copy |
| What it shows and asks for | Components, layout, modals |
| What can be done there | Tabs, wizards and menus |
| Which rules apply | CLI syntax and flags |
| What happens next | API style: CRUD or RPC |

That is why [Interfaces](./interfaces.md) and their Screens are in it: a refund
operators issue in an admin console is a different product from one shoppers
request on the website.

## The development loop

Every product change runs the same loop:

::development-loop
```text
ideate → implement ⇄ verify
   ▲                     │
   └──── next change ────┘

implement: your agent, your way
```
::

Ideate and verify with pdd-kit. Your own agent implements, your way.

- **Ideate** with [`/pdd-ideate`](./skill-pdd-ideate.md):
  Decide the next change and record it in the product model.
- **Implement** with your agent, your way: With plan mode, an SDD tool, or freestyle.
- **Verify** with [`/pdd-verify`](./skill-pdd-verify.md):
  Check the code against the product model; fix what you choose.

You don't have to name a skill. Ask your agent for a change, such as "add
guest checkout to the product", and ideate decides it with you. Then implement
it the way you already do; your agent may recommend a check when it's done.
Ask it to check the code against the model, after implementing or whenever you
want to be sure, such as before a release: verify reports every gap and fixes
the ones you choose.

If you want verify to drive implementation too, planning the work in phases and
checking each one before the next, turn it on with
`npx pdd-toolkit install --orchestrate=on` or one sentence in your
`AGENTS.md`, or run `/pdd-verify implement …` for a single request. See
[Implement with verify](./skill-pdd-verify.md#implement-with-verify-opt-in).

Ideate changes the model only with your approval. Your agent changes the code
and never the model. A product question that comes up while implementing comes
back to you; it is never decided in code.

## See the model at any time

At any point in the loop, open the model as a local report in your browser:

```bash
npx pdd-toolkit view
```

![The local report open on a Blueprint's overview page](./images/report-overview.webp)

It updates as the files change, so you can keep it open while you ideate,
review a change, or verify. In a Git repository it also shows what changed in
the model since your last commit or since your branch left the default branch.
See [`view`](./cli-view.md) for the options.

## What pdd-kit never does

- Run your code to check it: the skills read it, they never execute it. While
  implementing, your agent runs your tests the way it always does.
- Write outside `product-model/`, or edit your AGENTS.md, CLAUDE.md or README.
- Commit for you.

## Next

- [Installation](./installation.md): install the skills into your coding agent.
- [Model overview](./product-model.md): the `product-model/` folder in five
  minutes.
