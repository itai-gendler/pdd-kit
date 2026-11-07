---
title: Capabilities
description: The things your product lets someone do, where each is offered, and the Capability Scenarios that show each one working.
section: open-source
group: Product Model
order: 11
terms:
  - term: Capability
    definition: "A durable thing the Product lets someone do, such as checkout or order cancellation, independent of any one route, command or module."
  - term: Capability Scenario
    anchor: capability-scenarios
    definition: "One acceptance case for a Capability: what starts it, its Steps, and the outcome."
  - term: Context
    anchor: availability
    definition: "A place where behavior is offered or happens: one Interface, Experience or Screen."
  - term: Step
    anchor: what-a-step-does-to-the-products-things
    definition: "One action or condition in a Scenario, by an Actor or the Product, saying what it does to the Product's Entities."
  - term: Ends with
    anchor: what-a-step-does-to-the-products-things
    definition: "Where each Entity a Scenario touches is left: its last creation, change or removal, with the resulting State when there is one."
  - term: Scenario kind
    anchor: the-capability-scenario-file
    definition: "A category for a Scenario, such as primary or edge, defined in the model's taxonomies.yaml."
  - term: Trigger
    on: capability-scenario
    anchor: the-capability-scenario-file
    definition: "What starts the Scenario."
  - term: Outcome
    on: capability-scenario
    anchor: the-capability-scenario-file
    definition: "What is true once the Scenario has run."
  - term: Route
    on: capability-scenario
    anchor: routes-steps-and-context-places
    definition: "One named way the same Steps play out in different places, such as web and mobile. Different Steps mean a different Scenario."
  - term: Decision point
    on: capability-scenario
    anchor: capability-scenario-decision-points
    definition: "A question inside a Scenario whose branches all reach the same outcome. A different outcome is another Scenario."
  - term: Edge case
    on: capability-scenario
    anchor: the-capability-scenario-file
    definition: "A condition and its consequence noted within a Scenario, without changing its path."
---

# Capabilities

**A Capability is something your product lets someone do, and keeps letting them
do.** It completes the sentence "the Product can …", and it outlives any one
route, button or code module.

Each Capability is shown working by its [Capability Scenarios](#capability-scenarios):
concrete acceptance cases, each with a start, Steps and an outcome.

## In practice

| In the shop | The Capability |
| --- | --- |
| A shopper looks through products and reads one | Catalog browsing (`browse-catalog`) |
| A shopper turns a cart into an order | Checkout (`place-order`) |
| A shopper or the store withdraws an order before it ships | Order cancellation (`cancel-order`) |
| The payment gateway reports what has been paid | Payment settlement (`settle-payment`) |

The title reads naturally; the id is verb-noun. A Capability needs no
[Journey](./journeys.md).

## When you create one

Create one for each durable thing the Product lets someone do, not for a
function, an endpoint, a button label or one step of a flow.

### Split by verb, permission and place

Make separate Capabilities when the **verb** differs, when **who may** do it
differs (a permission of its own), or when **where it is offered** differs.
Everything else stays one Capability with several Scenarios: the same verb done
different ways, from different starting states, or chosen by a setting. See
[What selects decides it](./variations.md#what-selects-decides-it).

| What you see | Capabilities |
| --- | --- |
| Create, configure, archive and delete repositories | Four: different verbs |
| Switching an item's format needs a permission editing does not | Two: a permission of its own |
| Restoring from the archive or from the trash | One: the starting state doesn't split it |
| Notification settings on one settings page | One, however the page saves them |
| Adding, changing and removing members of a group | Three: each list entry is a thing of its own |
| Requesting a password reset, then choosing the new password from the emailed link | One: the request has no outcome without the link, so it is one run |
| Signing up, then confirming the email from a link | Two: the account exists without the link, so confirming is its own Capability, joined by a [Journey](./journeys.md) |
| Entering a second factor after any sign-in method | Its own Capability |
| Searching, filtering or sorting the catalog | Part of browsing |
| A shopper and an operator both cancel orders | One: a different Actor is not a permission of its own |
| Publishing and unpublishing a collection | Two: opposite verbs, even behind one toggle button |
| Republishing a collection that was unpublished | Part of publishing: the same verb from another state |
| Setting a snippet to private, unlisted or public with one control | One: `change-snippet-visibility` |
| Changing your vote before the poll closes | Part of voting: the same control changes your own submission |
| Tagging a note and taking a tag off, both in the note's edit form | Two: each tag is an entry of its own |

The same verb reached from somewhere else (changing your password when sign-in
demands it) is the same Capability, offered there too.

## The file

`capabilities/<id>.md`, or `capabilities/<id>/capability.md` once it owns
Scenarios. The H1 names it; the lead says what it lets someone do.

```md [capabilities/place-order/capability.md]
---
domain: ordering
availability:
  - place: customer-web::storefront
  - place: customer-mobile::storefront
---

# Checkout

Turns a valid cart into an order awaiting settlement.
```

| Field | Says |
| --- | --- |
| `availability` (required) | Where it is offered, at least one place |
| `domain` | The one [Domain](./domains.md) it belongs to, if any |
| `references` | Code or docs behind it, as [References](./references.md) |

An optional `## Intent` section says why the Product offers it.

A Capability lists no Actors, Entities, Rules or Scenarios. Its Scenarios sit in
its folder, and what it changes is what their Steps say.

## Availability

Each `place` is an Interface without Experiences, or one
[Experience](./interfaces.md#experiences) as `interface::experience`, never a
Screen. List every place where someone uses the Capability: if guests browse in
a public Experience and shoppers in a signed-in one, name both.

Every place listed needs a Capability Scenario that happens there. Availability
is what the Product intends;
[`pdd-verify`](./skill-pdd-verify.md) checks the code against it.

## Capability Scenarios

**A Capability Scenario is one acceptance case for one Capability:** what starts
it, the Steps, and the outcome. It belongs to the Capability whose folder holds
it; one owned by a Journey is a [Journey Scenario](./journeys.md#journey-scenarios).

Write one for each outcome worth checking: the usual success, a refused
permission, a failed validation, an external failure. For example, checkout
rejected because stock ran out, not checkout succeeding on a Tuesday.

### The Capability Scenario file

`capabilities/<capability-id>/scenarios/<id>.md`. The ids are unique across the
whole model.

```md [capabilities/cancel-order/scenarios/cancel-your-own-unpaid-order.md]
---
kind: primary
routes:
  web: Web
  mobile: Mobile
steps:
  - text: The shopper cancels an order that has not been paid
    kind: actor
    actor: shopper
    entities:
      - { entity: order, effect: reads, facts: [Items ordered, Total charged] }
    contexts:
      web:
        place: customer-web::storefront::order-status
      mobile:
        place: customer-mobile::storefront::order-status
  - text: The Product cancels the order and releases its stock
    kind: product
    actor: shopper
    entities:
      - { entity: order, effect: changes, from: Pending, to: Cancelled, facts: [] }
    contexts:
      web:
        place: customer-web::storefront::order-status
      mobile:
        place: customer-mobile::storefront::order-status
---

# Cancel your own unpaid order

## Trigger

A shopper changes their mind before payment has settled.

## Outcome

The order is cancelled and nothing is charged.
```

| Field or section | Says |
| --- | --- |
| `kind` (required) | The Scenario kind, such as `primary` or `edge`, from `taxonomies.yaml` |
| `routes` (required) | Each route's id and name |
| `steps` (required) | The ordered Steps, each with `text`, `kind` and `entities` |
| `## Trigger` (required) | What starts it |
| `## Outcome` (required) | What is true at the end |
| `## Decision points` | Questions whose branches reach the same outcome |
| `## Edge cases` | One-line bullets: a condition and its consequence |

### What a Step does to the Product's things

A Step's `kind` is `actor` (an Actor does it), `product` (the Product does it)
or `condition` (something holds). An `actor` Step names its `actor`; a Product
or condition Step may name the Actor it is done for.

Every Step lists what it does to the Product's [Entities](./entities.md) in
`entities`, or writes `entities: []`. Each entry has an `effect` (`creates`,
`changes`, `removes` or `reads`), the States it moves between, where the
Entity has States, and the `facts` it reads, changes or fills in. The facts list
is exhaustive: `[]` means none, never "unspecified".

```yaml
- text: The Product stores the order as pending and empties the cart
  kind: product
  actor: shopper
  entities:
    - { entity: order, effect: creates, to: Pending, facts: [Items ordered, Delivery details, Subtotal, Tax, Discount, Total charged, Margin, When placed] }
    - { entity: cart, effect: removes }
```

When removing one thing removes others with it — a card's comments go with
the card — each of those entries says `with: card`. Only the removal it goes
with needs permission, so *only its author deletes a comment* still holds.

A Scenario's **Ends with** is where each thing it touched is left. Across the
whole model, Step entries make up each Entity's lifecycle.

A Step at a public place names the person who isn't signed in, even if about to.

### Behavior nobody triggers

A schedule, expiry or retry the Product runs alone starts with a `condition`
Step carrying `unattended: true` and no Actor; its Capability is available where
someone sees the result. Every Step in that Scenario remains actorless.

An Actor may also request work the Product continues under its own authority.
For example, a person requests a retry, the Product settles admitted work, and
the person reads the result in the same Scenario. Mark only that later,
actorless `product` Step with `unattended: true`. The flag applies to that Step
alone, and its governed operations need an unattended grant. Omitting an Actor
does not grant authority.

### Routes, Steps, and Context places

Each Step's `contexts` says where it happens, per route: the Screen, Experience
or Interface. A route is the same Steps in different places (web and mobile
above); different Steps are another Scenario.

### Capability Scenario decision points

A decision point is an H3 under `## Decision points` with one question and at
least two `condition → outcome` branches, all reaching the Scenario's outcome. A
branch with a different outcome is another Scenario.

## How it connects

Entities change only through Steps, so each Entity's lifecycle comes from the
Scenarios. Screens offer the Capabilities whose Steps happen on them.
[Business Rules](./business-rules.md) saying who may are checked against the
Steps that act, and [Journeys](./journeys.md) name the Capability, never one of
its Scenarios.

## What lint checks

Errors:

- A Capability needs an H1, a lead, and `availability` places that exist, each
  with a Scenario happening there. It never carries `entities`.
- An availability place never names a Screen, nor a divided Interface instead
  of one of its Experiences.
- A Scenario needs `kind`, `routes`, `steps`, `## Trigger` and `## Outcome`, and
  its id is used once; every Step has `text`, `kind` and `entities`, and an
  `actor` Step names its actor.
- Each `entities` entry names a real Entity and its real States and facts;
  `facts` is required, except on `removes`, which has none; a `from` matches
  where an earlier Step left the thing.
- `with` sits only on a `creates` or `removes` entry, names another entry of the
  same Step and effect whose Entity holds this one (it declares a `one-to-many` or `one-to-one`
  relation to it), and never loops back; no two entries of a Step share an
  `as`-or-`entity` reference.
- Step text that names an Entity's title must list that Entity.
- `contexts` maps every route, stays inside the Capability's availability, and
  supports the Step's Actor; no two routes visit the same places.
- A Scenario has an `actor` Step or an unattended first Step.

Warnings:

- A Capability or Scenario id that reads as a noun phrase instead of starting
  with a verb, or that shortens the name of an Entity the model declares.
- A Step that creates or removes a thing and what it holds with no `with` on
  either.
- A Capability Scenario that opens with the opposite of its Capability's verb,
  such as `enable-a-disabled-link` under `disable-link`: opposite verbs are
  separate Capabilities.
- A Capability named with an umbrella verb, such as `manage-orders`: name each
  verb its controls show.
