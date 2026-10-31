---
title: Model overview
description: The Product Model in five minutes (what the product-model/ folder holds, what each resource type is for, and how to tell them apart).
section: open-source
group: Product Model
order: 6
terms:
  - term: Product Model
    anchor: the-shape-of-a-model
    definition: "The product-model/ folder: one product described in Markdown files, tracked in Git, and free to point at the repository's code."
  - term: Intent
    anchor: authoring-conventions
    definition: "Why a resource exists and which outcome it protects, never a restatement of what it does."
  - term: Coverage
    anchor: coverage
    definition: "Which of the repository's code the model accounts for, what it leaves out as not product behavior, and known gaps."
  - term: Resource type
    anchor: what-belongs-in-a-model
    definition: "A kind of resource, such as Entity or Capability, decided by where its file sits in the Product Model."
---

# The Product Model

**A Product Model is a folder of Markdown files, `product-model/`, that says what
one product does today: for whom, where, with what, and under which rules.** It
lives in your repository, changes in pull requests, and is checked by
[`pdd-kit lint`](./cli-lint.md), which reports every rule a file breaks.

It describes the product, not the code: no files, frameworks or endpoints, only
what a person using the product could confirm.

## The shape of a model

Each file is one **resource**, and the folder it sits in decides its type.

```text
product-model/
├── product.md              # the one Product
├── coverage.md             # which code the model accounts for
├── interfaces/             # where people and systems meet the Product
│   └── customer-web/
│       ├── interface.md
│       └── experiences/storefront/
│           ├── experience.md
│           └── screens/order-status.md
├── entities/               # what the Product keeps, including who acts
├── domains/                # optional subject areas
├── capabilities/           # what the Product can do
│   └── place-order/
│       ├── capability.md
│       └── scenarios/complete-checkout.md
├── journeys/               # goals that need several Capabilities
├── business-rules/         # what must stay true, and who may act
├── variations/             # supported alternatives, and what picks one
├── config.yaml  taxonomies.yaml  README.md  .gitignore
```

Two trees and a few cross-links. **Where**: Interface → Experience → Screen.
**What**: Capability → Scenario, and Journey → Scenario. A Capability's
`availability` (the places, each an Interface or Experience, where it is
offered) joins the two, Domains group by subject, and Business Rules and
Variations attach across everything.

## What belongs in a model

| Resource type | How many | What it's for |
| --- | --- | --- |
| [Product](./product.md) | Exactly one | The product's promise and its boundary |
| [Entity](./entities.md) | At least one that acts | A thing the Product keeps: what it knows about it and the states it moves through. An Entity that acts (a person or a system) is an **Actor** |
| [Interface](./interfaces.md) | At least one | A surface the Product offers: a web app, a mobile app, a CLI, an API, a webhook |
| [Experience](./interfaces.md#experiences) | When an Interface needs dividing | A context inside one Interface with its own audience and access |
| [Screen](./interfaces.md#screens) | Optional | A place: what an Actor sees and can do there |
| [Domain](./domains.md) | Optional | A subject area grouping Capabilities and Entities |
| [Capability](./capabilities.md) | At least one | Something the Product can do, proven by its Scenarios |
| [Journey](./journeys.md) | Optional | An Actor's goal that takes several Capabilities |
| [Business Rule](./business-rules.md) | Optional | Something that must stay true, and the only place that says who may act |
| [Variation](./variations.md) | Optional | Two or more supported ways, and what decides which applies |

Capabilities and Journeys each own **Scenarios**: concrete cases with a trigger,
**Steps** and an outcome. A Step names the place it happens: a Screen,
Experience or Interface.

Create an optional type only when it says something real. A small model is still
a valid one.

## Which type is this?

| What you're looking at | Model it as |
| --- | --- |
| A thing someone would call "this one", such as an order or a refund | An [Entity](./entities.md) |
| A person or system that starts something in the Product | An Entity that acts |
| Something the Product calls out to, like a payment API | No Interface: the Capability that calls it says so in its prose |
| A surface that receives requests, such as an app, a CLI or a webhook | An [Interface](./interfaces.md) |
| Signed-out and signed-in parts of one Interface | Two [Experiences](./interfaces.md#experiences) |
| An empty or unauthorized view | A condition in the Scenario that meets it, not a Screen |
| One thing the Product does | A [Capability](./capabilities.md) |
| One case of it (success, refusal, edge) | A Scenario of that Capability |
| A goal that takes several Capabilities | A [Journey](./journeys.md) |
| A rule shared by two or more behaviors, or any "who may" | A [Business Rule](./business-rules.md) |
| A constraint true of one behavior only (not a "who may") | A condition Step in its Scenario |
| A navigation section with two or more Capabilities | A [Domain](./domains.md#when-you-create-one) |
| A flag, plan or setting that switches between supported ways (not one that only decides who may) | A [Variation](./variations.md) |
| Looks, layout, copy | Nothing: design, attached as a [Reference](./references.md), a link to a file or page |

## Authoring conventions

- **Compact or expanded.** A resource is `<id>.md`. When it gains children or
  files of its own, move it to `<id>/<type>.md`: `place-order.md` becomes
  `place-order/capability.md`. Never both.
- **The path is the id**, and owns every parent: a Scenario never names its
  Capability. Interfaces, Experiences and Screens join their path with `::`,
  as in `customer-web::storefront::order-status`.
- **The H1 is the title**, and the paragraph under it the description (Journeys
  and Scenarios use their own sections instead).
- **Frontmatter holds relations; prose holds meaning.** Unknown frontmatter keys
  are errors, not ignored.
- **`## Intent`** says why a resource exists and which outcome it protects
  ("Complete a purchase without confirming an unpaid order"), not what it does.
- **The model holds the present.** No plans, priorities, metrics, or rejected
  options; those stay in the conversation or your planning tool.

### Naming

- **Things that happen are verb-noun**: Capabilities, Journeys and Scenarios
  (`browse-catalog`, not `catalog-browsing`).
- **Everything else is a bare noun**: `shopper`, `ordering`, `customer-web`. A
  Business Rule reads as a statement, never a command:
  `refunds-need-an-operator`.
- **Use the Product's own words**, from its screens and menus, never API values
  or code names: a role the screens call Editor is `editor`, even if the API
  sends `member`.
- **Name a Capability after its button** (Archive, Share, Publish). Where the
  button only says Save, never use `update`: a Profile page in Settings saved
  with one button is `change-profile-settings`; a form editing one thing's own
  facts is `edit-<thing>`.
- **The title may read naturally; the id stays verb-noun**: the Capability
  titled *Catalog browsing* has the id `browse-catalog`.
- **Reuse declared nouns**: `install-agent-skills`, not `install-skills`, when
  `agent-skills` is already an Interface.

If lint mistakes one of the Product's verbs for a noun, add it to
`config.yaml`. A shop reconciles each refund its payment gateway settles, so
`reconcile-a-refund-settlement` is verb-noun. But lint doesn't know `reconcile`,
`refund` is an Entity here rather than the verb, and `settlement` reads as a
noun, so the id gets a noun-phrase warning until `reconcile` is declared:

```yaml [config.yaml]
schema: 11
sdd:
  paths: []
lint:
  verbs: [reconcile]
```

`lint.verbs` only adds words to the built-in vocabulary, so list real verbs,
never a noun to silence a warning. Omit it when the defaults suffice.

## Is this replacing my PRD?

No. **A PRD argues for a change; a Product Model describes the product.** A PRD
is future tense, one initiative, and history once the decision is made. The
model is present tense, covers the whole product, and is either true now or
wrong.

The model holds no timeline, priority, metrics, market case or risk: real
product work, but not what the product does. The PRD's requirements section is
the overlap, and [`pdd-ideate`](./skill-pdd-ideate.md) writes
it straight into the model. Attach the PRD itself as a `prd`
[Reference](./references.md) with `role: intent`.

## Coverage

**Coverage is about code, not the product.** `coverage.md` says which of the
repository's code the model accounts for, at the highest level that still
tells an agent where to look and what to ignore. What the Product is or is not
belongs in [`product.md`](./product.md).

```md [coverage.md]
---
scope: The storefront and order services.
method: Static inspection of source and documentation.
covered:
  - description: Checkout and order tracking code.
    paths: [src/checkout/, src/orders/]
exclusions:
  - description: The design system and email templates.
    paths: [src/ui/, emails/]
unmapped:
  - description: Background fulfillment jobs.
    paths: [server/jobs/]
limitations: []
---

# Coverage
```

| Field | Says |
| --- | --- |
| `scope` | How much of the code the model accounts for |
| `method` | How the code was inspected, in one line, or `""` |
| `covered` | Code whose behavior the model describes |
| `exclusions` | Code that is not product behavior, such as presentation or packaging |
| `unmapped` | Code with behavior the model does not describe yet |
| `limitations` | Code whose behavior could not be established |

Every field is required, and every entry names its code: a unique one-line
`description` of the code area and its `paths`, usually folders.
[`pdd-map`](./skill-pdd-map.md) writes coverage when it maps
a repository. A model with no code yet — a Blueprint, or one you design first
with [`pdd-ideate`](./skill-pdd-ideate.md) — has empty
coverage until something maps its code. Known gaps never relax any other
check.

## What lint checks

All of these are errors:

- `product.md` (or `product/product.md`), `coverage.md`, `config.yaml`,
  `taxonomies.yaml`, `README.md`
  and a `.gitignore` ignoring `build/` and `cache/` exist; there is at least one Interface and one Capability.
- A resource has one shape: `<id>.md` and `<id>/<type>.md` never both, and an
  expanded folder has its `<type>.md`.
- No unknown frontmatter keys, and each recognized `##` section at most once.
- `config.yaml` has only supported keys; optional `lint.verbs` is a list of
  distinct lowercase words.
- `coverage.md` has every field, unique descriptions, and only `# Coverage` in
  its body; every entry names at least one path, and `scope` is set whenever
  there is an entry. With no entry, `scope` and `method` are both `""`.

Warnings:

- An expanded folder with nothing in it yet.
- A behavioral id that reads as a noun phrase, a cross-cutting id that opens
  with a verb, or a noun the model already declares more fully.
- A `lint.verbs` word that is already built in.
