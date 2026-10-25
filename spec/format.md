# The `product-model/` Format

> **This is engineering documentation, not a docs-site page.** It is the
> contract the parser, the linter, and the Blueprint release must agree on, and
> it changes *before* their behavior does.
>
> The user-facing explanation of the same resource types lives in the Product
> model group under `docs/` — one page per resource type, each carrying its file
> shape and the `lint` findings that constrain it. Keep the two consistent.
>
> This document defines the **authored folder**. The wire contract that
> serializes it — the Product Report, its portable projection, and expansion —
> is [`report.md`](./report.md). Shapes considered for either and chosen against
> are in [`rejected.md`](./rejected.md).

This document is the contract for the pdd-kit PDD folder: the git-tracked
product model that lives inside a repository. Everything the public CLI lints is
defined here. `pdd-kit lint` checks whether this folder is structurally
sound; it does not claim that the model and implementation agree.

Planning uses the same files: approved intended behavior is written into the
model before implementation. Implementing is the user's own workflow.
`pdd-verify` performs the separate, semantic comparison with the
implementation and owns the resolution of the findings the user chooses. Only
when the user opts in does it own implementation too: what the model
describes that the code does not do yet is then a gap it closes in phases,
through the agent the user asked to implement, checking each slice. Git may
narrow that inspection to a branch, but a diff never decides which side is
authoritative. The technical *how* of a change (specs, designs, task lists)
still belongs to your SDD tool of choice and may be attached through
`references`.

Each step of the loop changes one side:

| Step | May change | Never changes |
| --- | --- | --- |
| `pdd-ideate` | product meaning, after approval | code |
| implementation, by the agent the user asked to implement | code | `product-model/` |
| `pdd-verify` | neither by itself: it routes model changes through approval and code changes to the builder | anything without approval |

A product question that arises while implementing goes back to approval; it is
never settled in code.

**The model holds current product meaning.** Do not persist alternatives
considered, rejected approaches, explanations of why another option was not
selected, or deliberation history anywhere in `product-model/`. This includes
resource prose, supporting sections, limitations, README, and additional files.
Keep discussion needed to reach a decision in the conversation; record the
resulting approved behavior without replaying settled discussion on later runs.
An unchosen option does not become a product exclusion: record exclusions only
when they are established or approved product constraints. Preserve observable
refusal and failure behavior, current constraints, and material unresolved
questions or missing evidence. These are authoring requirements; structural
lint does not determine whether prose contains deliberation history.

## Terms

| Term | Meaning |
| --- | --- |
| **Product Model** | `product-model/` — the git-tracked folder this document defines. May cite the repository's code. |
| **Resource** | one authored file in a Product Model — `capabilities/lint-product-model/capability.md` is one. |
| **Resource type** | a category of resource determined by its path. This document defines twelve: Product, Interface, Experience, Screen, Domain, Entity, Capability, Capability Scenario, Journey, Journey Scenario, Business Rule, and Variation. |
| **Actor** | the role an Entity plays where it acts — a Step's `actor`, an Interface's, Experience's or Journey's `actors`, a Business Rule grant's `actors`. Not a resource type: an Entity that `acts` is an Actor in that position. |
| **Product Report** | the portable serialization of a Product Model. One format, two profiles. |
| — *workspace* | `referenceProfile: workspace`. Repository-relative references and entry points intact, as optional navigation. For a full product instance inside the boundary that owns the code. |
| — *portable* | `referenceProfile: portable`. No `kind: code`, no repository-relative targets or entry points. Required whenever a report crosses an ownership boundary. |
| **Blueprint** | a portable Product Report. Publishing it — merging it into `blueprints/` of the Blueprint repository — is a separate step. |

**Redaction is a property a report has, never a category it belongs to.** A
report carrying repository navigation is still a Product Report; it is simply
not a Blueprint. Nothing about where a file is stored may be decided by whether
it would survive publication — the profile filters at serialization time, and
that is the only place the distinction lives.

**A resource never states its own type in frontmatter; its path does.**
`capabilities/checkout.md` is a Capability because of where it sits, and
`capabilities/checkout/capability.md` says it a second time in the type
filename — both are the path. No file carries a `kind: capability` header, and a
model is read from its folders.

That leaves `kind` free to mean something narrower, and it does: five unrelated
closed sets, each local to where it appears, none of them naming a resource
type.

| `kind` on | Values |
| --- | --- |
| a `references` item | `code`, `prd`, `spec`, `proposal`, `doc`, `adr`, `visual`, `research` |
| an Entity that `acts` | `person`, `system` |
| a Capability Scenario | one `scenarioKinds` id from `taxonomies.yaml` |
| a Journey Scenario | one `scenarioKinds` id from `taxonomies.yaml` |
| a Scenario Step | `actor`, `product`, `condition` |

Each is required wherever it appears. At the top level of a file only the two
Scenario types require one, and an Entity carries one exactly when it `acts`.
**Every other resource type has no `kind` at all** — Product, Interface,
Experience, Screen, Domain, Capability, Journey, and Business Rule never carry
one. An Interface's `type` is a different field with a different job.

This document therefore never writes *kind* to mean a resource type, and neither
should `docs/`. The code does — `ReportResourceKind` is the discriminator a
report consumer switches on — and that is the only register where the word
carries that meaning.

## Folder layout

A resource uses the smallest shape that can hold it:

- **compact** — `<id>.md` when the resource has no assets or child resources;
- **expanded** — `<id>/<type>.md` when it owns assets or a typed child
  collection.

The two shapes represent the same resource and derive the same id. Adding the
first asset or child promotes the Markdown file with `git mv`; removing the last
one compacts it again. Both shapes must never exist for the same id. This keeps
leaf-heavy collections readable without giving up co-location or path-owned
parent relations.

Every resource follows that rule; only its type filename and permitted child
collection differ:

| Resource type | Compact | Expanded | Typed children |
| --- | --- | --- | --- |
| Product | `product.md` | `product/product.md` beside `logo.svg` | — |
| Interface | `interfaces/<id>.md` | `interfaces/<id>/interface.md` | `screens/`, `experiences/`, or both |
| Experience | `interfaces/<interface-id>/experiences/<id>.md` | `interfaces/<interface-id>/experiences/<id>/experience.md` | `screens/` |
| Screen | `<screen-parent>/screens/<id>.md` | `<screen-parent>/screens/<id>/screen.md` | — |
| Domain | `domains/<id>.md` | `domains/<id>/domain.md` | — |
| Entity | `entities/<id>.md` | `entities/<id>/entity.md` | — |
| Capability | `capabilities/<id>.md` | `capabilities/<id>/capability.md` | `scenarios/` |
| Capability Scenario | `capabilities/<capability-id>/scenarios/<id>.md` | `capabilities/<capability-id>/scenarios/<id>/capability-scenario.md` | — |
| Journey | `journeys/<id>.md` | `journeys/<id>/journey.md` | `scenarios/` |
| Journey Scenario | `journeys/<journey-id>/scenarios/<id>.md` | `journeys/<journey-id>/scenarios/<id>/journey-scenario.md` | — |
| Business Rule | `business-rules/<id>.md` | `business-rules/<id>/business-rule.md` | — |
| Variation | `variations/<id>.md` | `variations/<id>/variation.md` | — |

Here `<screen-parent>` is the Interface or Experience folder that contains the
Screen. Screens never nest: an expanded Screen holds assets, never `screens/`.
A representative model can therefore look like this:

```
product-model/
├── config.yaml              # tool config (committed)
├── taxonomies.yaml          # scenario kinds (committed)
├── coverage.md              # which code the model accounts for (committed)
├── product.md               # compact Product when it has no logo
├── product/                 # expanded Product alternative
│   ├── product.md
│   ├── logo.svg             # optional locally; required for a public Blueprint
│   └── cover.webp           # optional listing cover
│
│   ── Interface → Experience → Screen: where Actors meet the Product ──
├── interfaces/<interface-id>/
│   ├── interface.md
│   ├── screens/<screen-id>.md                    # compact Screen
│   └── experiences/<experience-id>/
│       ├── experience.md
│       └── screens/
│           ├── <screen-id>.md                    # compact Screen
│           └── <illustrated-screen-id>/          # expanded Screen
│               ├── screen.md
│               └── mockup.svg
│
│   ── subject axis: what it is about ──
├── domains/<domain-id>.md                       # optional
├── entities/<entity-id>.md                       # the Entities that act are named by every Interface
│
│   ── behavior tree: what the Product does ──
├── capabilities/<capability-id>/
│   ├── capability.md
│   └── scenarios/<scenario-id>.md
├── journeys/<journey-id>/                       # optional
│   ├── journey.md
│   └── scenarios/<scenario-id>.md
│
├── business-rules/<rule-id>.md                  # optional
├── variations/<variation-id>.md                 # optional: supported alternatives
├── README.md                # canonical agent orientation
├── .gitignore               # generated paths only
├── build/                   # generated Product Report — never committed
└── cache/                   # generated artifacts — never committed
```

The model has **two hierarchies and two axes**. The Interface → Experience →
Screen hierarchy says where Actors meet the Product; the Capability → Scenario
and Journey → Scenario hierarchy says what the Product does. `availability` is
the join between them. Domain classifies members of both by subject. Entity
names what the Product keeps or reasons about — the people and systems that act
on it included — and Steps say what happens to each. Business Rules attach
across everything, and are the only place a permission claim appears.

## Contexts and places

A **Context** states where behavior is available, occurs, or is constrained. It
is a strict object whose required `place` names one Interface, Experience, or
Screen:

```yaml
- place: customer-web::storefront
```

The use of the Context determines how specific its place must be. A Capability
availability Context names an undivided Interface or an Experience. A Scenario
Context is a concrete occurrence and names the most-specific available place:
a Screen when the Step occurs on one; otherwise the leaf Experience or
undivided Interface, even if it also contains Screens. A Business Rule Context
is a selector and may name any of the three; an Interface or Experience
selector includes its descendant places.

Filesystem paths supply containment, and containment is read by id prefix at
every depth. For example, `customer-web::storefront::checkout` is contained by
`customer-web::storefront`, so a Step there is inside that Capability
availability Context. Authors never repeat the containing Interface or
Experience in another field.

**Two conditions decide whether an Interface is divided.** It must hold
Experiences when either holds, and must not when neither does:

- it serves more than one `access` value, read from who reaches its places:
  places reached without signing in are `public`, places reached once signed in
  `authenticated`, and the administration area — places only the roles that
  administer the Product, its settings or members, may enter — `restricted`; or
- its Actors split into groups no Capability available there bridges — more
  than one connected component in the graph of Actors and Capabilities, an edge
  wherever a Capability's Scenario Steps name the Actor. Roles that each relate
  one-to-one to the same Account, an Entity that does not act, are one audience.

An Interface declares no access mode, so `lint` sees the first condition only
once Experiences exist; the second it checks on every Interface. Two
Experiences of one Interface with the same `access` share no Actor, unless they
are alternatives of one Variation; sharing one is a `lint` error. A page closed
only to some non-administrative roles stays `authenticated`, and an admin-only
page inside administration is a Screen there: grants say who may act.

**Counterparts and Variations justify existing Experiences.** An Experience whose
name also exists under another Interface is the same context on another
platform — `customer-web::storefront` and `customer-mobile::storefront` — and
keeps its Experience even where the conditions alone would flatten it; so does
an Experience that is an alternative in a Variation, even when audiences and
access modes coincide. Both findings are `lint` errors: an Interface that must
divide and does not, and one that holds Experiences it must not.

An Interface holds `experiences/`, or `screens/`, or **both** — the last when a
Screen is genuinely shared across its Experiences rather than belonging to one.
A Screen beside `experiences/` is reachable from every Experience of that
Interface, and two Screens with the same name below different Experiences of one
Interface are counterparts exactly as they are across Interfaces.

**A shared Screen is inside every Experience of its Interface.** Its id is
`interface::screen`, and its Interface is never an availability place, so
containment reads the Interface as the set of its Experiences: a Capability the
Screen exposes must be available in each of them, a Step that occurs on it is
inside a Capability's availability only when every Experience is, and that
Step counts as Scenario coverage for each. `lint` names the Experiences a
Capability is missing from. A view whose Capabilities differ by Experience is
not shared: it is two Screens, one under each Experience, which are
counterparts.

Contexts are closed to unknown keys; Context is not a metadata bag.

## Universal conventions

- **The committed shell is complete.** `README.md` and `.gitignore` are
  required alongside the semantic files. `.gitignore` must ignore `build/`
  and `cache/`; those generated directories are never part of the committed
  model.

- **`README.md` is the canonical orientation, owned by pdd-kit.** It is
  for an agent that opens `product-model/` without a pdd-kit skill
  running: it leaves implementation to the user's usual way unless they
  opted in to `pdd-verify` orchestrating it, routes checks to `pdd-verify`
  and product changes to `pdd-ideate`, says how to install them, and states which
  parts of the model bind the code and which do not. It is not a second
  explanation of the format. Its text is `MODEL_README` in `src/core/model-readme.ts`, embedded
  verbatim in every skill's format reference.

- **Compact and expanded are exclusive.** `<id>.md` and `<id>/<type>.md` may
  not coexist. An expanded resource must own at least one asset or child
  resource; otherwise it is needless structure and must be compacted. A compact
  resource has no asset or child namespace.

  Coexisting shapes, and an expanded folder missing its `<type>.md`, are `lint`
  errors. An expanded folder that owns nothing yet is a `lint` warning, since
  an author reaches the expanded shape in two steps; the report round trip
  compacts it.

- **ID = the logical path from the collection root.** Behavior-hierarchy ids
  (Capability, Journey, both Scenario types) and cross-cutting ids (Entity,
  Domain, Business Rule) are the bare file or folder name and are globally
  unique within their collection. Qualified ids for Interfaces, Experiences, and Screens carry the
  path that distinguishes them, joined by `::`:

  ```
  reader-web
  reader-web::personal-library
  reader-web::personal-library::unread-library
  ```

  Each segment is lowercase kebab-case, `^[a-z0-9]+(?:-[a-z0-9]+)*$`. The id
  says the whole placement, so containment is a prefix test. Never
  write `id:` in frontmatter — the filesystem is the id authority. The one
  exception is `product.md`, whose `id:` names the Product Model (it may differ
  from the repo name) and is limited to 64 characters. Compacting or expanding
  a resource never changes its logical path or id.

  Interfaces, Experiences, and Screens share one place-id namespace. Each
  qualified id must identify exactly one place across all three types. In
  particular, a shared Screen and an Experience under the same Interface must
  not have the same name: both would resolve to `interface-id::name`. `lint`
  rejects the collision and names both files.

  **Behavioral ids are verb-noun; cross-cutting ids are the bare noun.** A
  Capability, Capability Scenario, Journey, and Journey Scenario name something
  the Product or an Actor *does*, so their ids begin with a verb:
  `browse-catalog`, not `catalog-browsing`; `refund-order`, not
  `order-refund`. A Domain, Entity, Interface, Experience, and Screen name
  something that *is*, so their ids are noun phrases: `shopper`, `ordering`,
  `listing`, `customer-web`.

  **Names come from the Product's own words.** A resource's id and H1 use the
  words the Product shows the people who use it — its screens, menus and
  messages — never its API values, code identifiers, or the wording of a
  request: a role the screens call Editor is `editor` even where the API sends
  `member`. A planned Product uses the words its plan shows people. A
  Capability's verb is the one its control shows — Archive, Share, Publish;
  where the control says only Save or Done, it is `edit-<thing>` for a thing's
  own facts and `change-<section>-settings` for a page in the Product's
  settings, the section named as its menu shows it, never `update`. `lint`
  cannot see the Product's screens; review and `verify` hold the name to them.

  Ids are the format's identity mechanism: two models that name the same
  behavior differently cannot be diffed, merged or compared. `lint` checks the
  verb-noun shape heuristically, as warnings: a behavioural id whose last
  segment is a nominalisation (`-ing`, `-ment`, `-tion`, …) while no segment is
  a product verb. A segment that names a thing this model declares is read as
  that thing, not as a verb — `order-line` is a fine Entity id beside an Entity
  `order`, and `order-management` carries no verb for the same reason.

  Optional `lint.verbs` in `config.yaml` adds product-specific words to the
  built-in verb vocabulary for behavioral and cross-cutting id checks; declared
  nouns still take precedence. `reconcile-a-refund-settlement` needs
  `reconcile` declared: `refund` is an Entity, and `settlement` is
  nominalised. Listing a built-in verb is a warning.

  **A behavioral id's noun half names something the model declares.** When the
  noun half is the suffix of an Entity, Domain, or Interface id in the same
  model, use the declared name — `install-agent-skills`, not `install-skills`.
  `lint` warns otherwise. It stays silent when two declared names share the
  noun half, which then names their category (`send-message` beside channel and
  direct messages). Experience and Screen names are never suggested: they are
  places, not the things a behavior acts on.

  **A cross-cutting id never opens with a verb.** Entity, Domain, and Business
  Rule ids name what something *is* or what must remain true:
  `refunds-apply-only-to-existing-orders`, not `refund-existing-orders`. A
  single-segment id such as `order` is never flagged. `lint` warns on an id
  whose first word is a verb followed by something the model declares —
  `cancel-unpaid-orders` with an Order Entity — and leaves compound nouns such
  as `pull-request` or `sign-in` alone.

  Experience and Screen names repeat across Interfaces on purpose:
  `personal-library` on web and on mobile pursue the same goal and are different
  resources. Two resources of the same type sharing a path suffix below their
  Interface are **counterparts**
  — the same thing on two Interfaces. Nothing has to declare that; the path
  already says it.

- **The path owns every parent relation.** An Experience never writes
  `interfaces:`, a Capability Scenario never writes `capability:`, a Journey
  Scenario never writes `journey:`, and a Screen never writes `availability:`.
  One authority instead of two that can disagree, and reparenting becomes a
  `git mv` that reads correctly in a pull request.
- **Assets expand a resource.** Authored assets sit beside `<type>.md` in the
  expanded resource folder. Files under its reserved `implementation/`
  subdirectory describe this repository's realization instead. Typed child
  directories (`experiences/`, `screens/`, and `scenarios/`) are structural,
  not assets, and each is valid only under the types the layout table names: a
  `screens/` directory under a Screen is a `lint` error, because Screens never
  nest. Any other nested directory is invalid. Plain asset files need no
  declaration. Optional `assets:` frontmatter annotates files already present:

  ```yaml
  assets:
    - file: mockup.svg
      title: Approved product record
  ```

  `file` is relative to the expanded resource folder and cannot escape it.
  Metadata entries are unique and must name an existing asset. `title` is
  optional, and there is no other key. Unlisted assets remain valid so external
  tools can write captures without editing pdd-kit frontmatter.
- **H1 = title/name.** The first `# Heading` in the body is the resource's
  title (domains call it `name`) and is the file's only H1. Lead and
  section-body Markdown fragments cannot contain another H1 or H2; an H2 begins
  a new section instead.
- **Lead paragraph = description.** Prose between the H1 and the first `##`
  heading is the description for entities, domains, experiences, and the product.
  Journeys and both Scenario types instead use the required structured sections
  specified below and must not carry lead prose.
- **Frontmatter = relations and entry points, with one relational-prose
  exception.** Both Scenario types keep their structured `steps` in
  frontmatter so each single-line statement stays beside its kind, responsible
  Actor, Capability qualification, the Entities it touches, and route-specific
  Contexts. Other prose remains in the Markdown body.
- **Intent and Goal = recognized prose sections.** `## Intent` explains why the
  product or resource exists and which outcome it protects. `## Goal` states the
  stable Actor intent of a Journey. Both are structured prose, not separate
  resources.
- **Structured sections are unambiguous.** A recognized H2 may appear only once.
  Journey-only sections (`## Goal`, `## Success criterion`) are invalid on both
  Scenario types, and Scenario-only sections (`## Trigger`, `## Steps`,
  `## Decision points`, `## Outcome`, `## Edge cases`) are invalid on Journeys.
  `## Steps` is invalid on both Scenario types, whose one ordered path is the
  frontmatter `steps` list.
  Unrecognized H2 sections are supporting content and retain their heading and
  body through report export and expansion.
- **Structured list items are single-line.** Every item in `## Edge cases` must
  occupy one physical line. Prose and continuation lines are invalid because
  they cannot be represented as report list items.
- **Set-valued lists are unique.** Product `tags` and every frontmatter relation
  list contain no duplicate value. Ordered content lists such as Scenario
  `steps` are not relation sets and may repeat when the meaning calls for it.
- Scenario IDs are globally unique across every `scenarios/` folder.

## Variations

A Variation is a named set of currently supported alternatives of one resource
type: Interface, Experience, Screen, Entity, Capability, Capability Scenario,
Journey, Journey Scenario or Business Rule. Product, Domain and Variation itself
cannot vary.
The set is its own resource, `variations/<id>.md`; its alternatives stay
ordinary, independently complete resources that carry no Variation keys.

`variations/refund-review.md`:

```markdown
---
kind: configuration          # experiment | configuration | version
of: business-rule            # the one member type
settings:
  - { entity: store-settings, fact: Refund review mode }
takesEffect: When a refund is requested. A settings change applies to subsequent requests.
stability: A refund already under review keeps the policy captured when it was requested.
alternatives:
  - id: refund-review-standard
    selectedWhen: Refund review mode is Standard. Missing mode uses Standard.
  - id: refund-review-strict
    selectedWhen: Refund review mode is Strict.
---

# Refund review

Stores choose how strictly refunds are reviewed; both policies are supported.
```

The H1 names the choice and the lead says why the alternatives coexist. `## Intent`
is optional; other H2 sections are supporting content.

**Vary the smallest resource that fully contains the difference.** Two
Scenarios of one owner when what an Actor does differs; Capabilities when the
contract differs — who may do it, its verb — or where it is offered; Screens or
Experiences when the place differs; Entities when the facts or States kept
differ; Business Rules when a setting switches between whole policies, below.
The
alternatives of a Scenario Variation share their Capability or Journey;
alternatives spread over several owners are a `lint` error. A Step has no id and
is never an alternative.

Steps, Screens and Rules name concrete resources, so a varying Entity carries
into what touches it: a Step that creates one alternative sits in a Scenario
selected the same way. When only the path a thing takes differs, the Scenarios
vary and the Entity keeps every State.

**What selects decides whether it is a Variation.** A Variation chooses by a
fact that exists to choose — a setting, an experiment assignment, a version
discriminator — or by the deployment, fixed before the behavior starts:

- A fact describing the thing acted on — a page's own editor format — is
  state, even when someone set it earlier; a `condition` Step or decision point
  reads it.
- A choice that changes what an Actor does — a Step skipped, added, or at
  another place — selects Scenario alternatives, even when several settings
  combine into that one choice (a person's preference falling back to the
  workspace's): sign-in that starts at the only provider drops the Actor's
  choice of provider. A choice the Actor makes on a page outside the Product,
  such as a connector at an identity provider, is still an Actor Step.
- A choice that changes only the Product's own Steps (group sync replacing or
  adding Roles), and any choice made during a run, is a decision point in one
  Scenario — unless a Step must name a different alternative of another
  Variation, which then varies with it (issuing a VAT invoice or a sales tax
  receipt).
- A choice that changes only the outcome makes separate Scenarios, each with a
  `condition` Step reading it: registration that leaves the account
  unconfirmed, an unknown social account registered or refused. A branch ending
  in a refusal counts. The unconfirmed account sign-in later meets is state,
  and confirming through the emailed link is a later act of its own.
- When two or more independent settings or assignments would each vary or split
  one Scenario (a captcha and a provider password on one registration), each is
  a decision point instead, so no Scenario needs a set per combination. State
  the Scenario meets, such as whether an account exists, is not a setting.

**A resource that exists only under some alternatives, or only while a setting,
plan or licence enables it,** stays an ordinary resource, mapped even where the
running edition hides it. Its lead names what it exists under — registration
exists only while the sign-in method is password — and `verify` checks it. No
field or Variation carries the dependency. **What it does to Entities is
closed by the switch through grants as well:** every grant that admits only
the gated behaviour's Steps carries the switch as a `when` condition, so
`lint` checks every Step against it — each grant of the Rule for refunds, the
only behaviour moving an Order to Refunded, and the `unattended` grant through
which the Product sends what a Pro workspace scheduled, even inside an ungated
Capability. A gated operation no Rule governs yet gets one: picking a send date
changes a fact nothing else changes. A read-only feature, or one whose Steps
pass only grants ungated behaviour passes too — archiving many Cards at once
beside archiving one — has its lead alone. The lead names the switch either
way.

**Membership lives only on the set.** `alternatives` lists at least two distinct
resources of the type `of` names, spelled as that type's ordinary ids — a
Business Rule's id, or a Screen's qualified `interface::experience::screen`.
Every entry resolves. A resource belongs to at most one Variation. No member
file names its set, and no field on a member repeats selection. The list is a
set: its order carries no priority, default or allocation, and the report orders
it by id. A set left with one alternative is removed.

**Each selection field has exactly one level.** The set carries the mechanism,
`takesEffect` and `stability`; each alternative carries `selectedWhen` and, on a
Version, `label`. Nothing is inherited or overridden. All text fields are
non-empty Markdown fragments without H1/H2.

| Field | Level | Meaning |
| --- | --- | --- |
| `selectedWhen` | alternative | Eligibility and the choice selecting this alternative, including missing/unsupported choices, defaults and precedence where relevant |
| `takesEffect` | set | When selection is made or re-evaluated, including changes during use |
| `stability` | set | How long the choice remains fixed and what happens to existing clients, sessions or records when it changes |

`kind` determines the remaining fields. A field outside the subtype is a `lint`
error. A fact reference is exactly `{ entity: <id>, fact: <name> }` and must
resolve to an Entity and one of its Information kept facts.

| `kind` | Set fields | Alternative fields |
| --- | --- | --- |
| `experiment` | Required `assignmentUnit`: `{ entity: <id> }` for an existing Entity, otherwise `{ description: <non-empty explanation> }` for an unmodeled unit such as a session. Required `assignmentMethod`. Optional `assignmentFact` (a kept assignment fact) and `allocation` (a known allocation promise). | — |
| `configuration` | Optional non-empty `settings`: distinct fact references that choose between the alternatives. A fact that only parameterizes one alternative's behavior does not belong here. When selection uses unrecorded context, omit it and name that context in `selectedWhen`. | — |
| `version` | Optional `discriminator`: the kept fact identifying the selected version. Header or path selection is explained in `selectedWhen`. | Required `label`, unique across the set ignoring case. |

For an Experiment, the assignment unit is the thing receiving the choice; the
assignment fact may be held by a different Entity, and the unit need not act.
The subtype states why alternatives coexist: Experiment evaluates outcomes;
Configuration selects through a setting or operating context; Version keeps
contracts or forms live together. Versions selected by a setting remain
Version; experiments enabled by a setting remain Experiment.

**A Variation is a relation, never containment.** Folders, Domain classification,
Experience ownership, Screen placement and Scenario parents stay authoritative.
Ordinary Rule targets, Steps and Contexts reference concrete resources and never
acquire "all alternatives" meaning. A Variation neither duplicates nor grants
permission.

A Business Rule that is an alternative applies only under its `selectedWhen`;
it is never unconditional policy. Rules vary only when a setting switches
between whole policies — refund review that is Standard or Strict, a password
rule of a minimum length or of a length plus required kinds of character; a
value one policy reads stays content of that Rule. A setting that changes only
who may perform one operation is a grant's `when` on one Rule.

All alternatives are currently supported; none is a default, parent or
historical version. Do not create alternatives for every parameter value,
Scenario outcome or visual treatment, and do not invent settings, allocations,
defaults or timing: an optional field the evidence does not establish is
omitted, a required one says so, and in a model mapped from code, Coverage
`limitations` records that code. `lint` checks
structure and references, never whether conditions are exhaustive.

## References

`references` is an optional extension on every semantic resource: Product,
Interface, Experience, Screen, Domain, Entity, Capability, Journey, Capability
Scenario, Journey Scenario, Business Rule, and Variation. It is not accepted in
`config.yaml`, `coverage.md`, or `taxonomies.yaml`.

```yaml
references:
  - kind: prd
    role: intent
    target: docs/prds/checkout.md
    title: Checkout PRD
  - kind: visual
    role: intent
    target: https://design.example.com/checkout
    title: Approved checkout direction
  - kind: code
    role: implementation
    target: src/checkout/handler.ts#CheckoutHandler.submit
```

Every item requires exactly `kind`, `role`, and `target`; `title` is optional.
Unknown keys are invalid.

- `kind` is `code`, `prd`, `spec`, `proposal`, `doc`, `adr`, `visual`, or `research`.
  It identifies the artifact, not what the model concludes from it.
- `role` is `intent`, `implementation`, or `context`. It explains why the
  artifact is attached to this resource. It is not a verification result or a
  freshness claim.
- `target` is the artifact address. Duplicate targets on one resource are
  invalid, even when their kinds or roles differ.
- `title` is an optional non-empty display label.

For `kind: code`, `target` uses the compact
`path[#symbol][:start[-end]]` grammar. The line suffix is the last `:` whose
remainder matches `^\d+(-\d+)?$`; the symbol is everything after the first `#`
of what remains. The path must be repository-relative and tracked according to
`git ls-files`. Code references may use any role, including `intent`, but they
remain navigation rather than proof and never replace the resource's prose.

All other kinds accept either an HTTP(S) URL or a repository-relative path.
`lint` ignores a local target's query and fragment when checking the tracked
file set and warns when the path is missing. HTTP(S) targets are syntax-checked
but never fetched. Absolute filesystem paths, `file:` URLs, other URL schemes,
and backslash paths are invalid.

No reference or asset carries a `state`. A capture of a view in one condition
— empty, unauthorized, validation failed, completed — attaches to the Scenario
that reaches that condition; a Screen's own `references` show the view as
such. A light and a dark capture of one condition are two references on the
same resource, told apart by `title`.

References connect the self-contained Product Model to material maintained
outside it. A model may contain no references.
The deterministic CLI does not copy, download, generate, execute, or assess
referenced content. pdd-kit skills may follow curated References as leads,
but the artifact remains evidence to assess rather than proof to trust.

## Resource files

> **Illustrative examples.** The resource snippets below are non-normative
> fragments from one fictional Acme Shop model. Their names and product story
> are not required; they exist only to make the required Markdown, frontmatter,
> and cross-resource identifiers concrete.

### `config.yaml`

```yaml
schema: 11                         # folder-format version
sdd:
  paths: [openspec/]               # detected/declared SDD roots; empty if none
lint:                              # optional
  verbs: [reconcile]               # additional product verbs
```

`lint`, when present, is a mapping with only optional `verbs`: a list of
distinct lowercase alphabetic words (`a`–`z`), each matching one id segment. An
omitted `lint` or `verbs`, or an empty list, keeps the built-in vocabulary. The
list adds verbs; it never replaces the defaults or disables naming checks.
Unknown keys, invalid mappings, invalid verb lists and repeated verbs are
errors.

`config.yaml` has no other keys. Schema 11 is the only supported folder format.

### `product.md` or `product/product.md`

```markdown
---
id: acme-shop
summary: Discover products and complete purchases with confidence.
category: commerce
tags: [commerce]
authors:
  - name: Acme
    url: https://example.com
license: MIT
limitations: []
languages: [en, de-DE]
---

# Acme Shop

One-paragraph description of the product.

## Intent

Why this product should exist and the outcome it protects.

## Anything else

Kept in the repo as supporting context.
```

`## Intent` is compiled into the report's product intent. Other unrecognized
sections are preserved as ordered `{ heading, content }` supporting sections so
a report can be expanded without silently losing authored context.

The Product frontmatter may also carry portable identity and attribution used
by every report host. `summary` is a single-line short description (400
characters maximum), `category` is a lowercase kebab-case classification,
`authors` is a list of `{ name, url? }` records, and `license` is an SPDX
license identifier. The H1 remains the Product title and the lead prose remains
its full description.

`languages` is an optional unique list of the language tags the Product
serves, each matching `^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$` — `en`, `de-DE`,
`pt-BR`. A malformed tag is a `lint` error. A language is product, not design;
`verify` holds the tags against the repository's i18n configuration. An
Interface may narrow the list; Experiences and Screens never carry one.

`languages` names the languages the Product's interfaces are delivered in.
Neighbouring meanings are ordinary content, not this field: content the
Product keeps in several languages is an Entity fact (*Name and description —
in each language the store sells in*); translation work is Capabilities when
the Product manages it; how a language is chosen for someone — a saved
preference, the device locale — is a kept fact such as *Preferred language*
and the Steps that set and read it. None is a Variation: each language is the
same resource, not an alternative form of it.

Product `limitations` are deliberate constraints of the Product, including what
it leaves to other systems ("People sign in with their existing account"),
stated as product facts. [`coverage.md`](#coveragemd) says nothing about what
the Product is or is not: it records which of the repository's code the model
accounts for.

The compact form is `product-model/product.md`. Adding a Product logo expands
it to `product-model/product/product.md`, with the identity asset at
`product-model/product/logo.svg`.

The Product may have one visual identity asset, `logo.svg`.
It is a self-contained, UTF-8 SVG with a `viewBox`, at most 256 KiB, and cannot
contain active content, event handlers, embedded documents, imports, or network
references. It is rendered only as an image and is not embedded in the Product
Report. Public Blueprints require it; general local Product Models may omit it.

Beside the logo, `product/` may hold one optional `cover.webp`: an illustration
a catalog shows on the Product's card. It is presentation, never product
meaning, so nothing in the model refers to it and the Product Report does not
carry it. It is a WebP image, 16:9 within one percent, at least 1200 and at
most 4096 pixels wide and at most 2304 high, and at most 1 MiB — four times the
logo's limit because it is a raster picture, and one format so that a catalog
serves every cover the same way. It must be a well-formed still WebP: the RIFF
size matches the file, every chunk lies inside it, and it holds exactly one
image — a lone lossy `VP8 ` or lossless `VP8L` chunk, or a `VP8X` header whose
canvas matches that one image, with only `ICCP`, `ALPH`, `EXIF` and `XMP `
beside it. An animated WebP is not a cover. Only the folder form can hold it: a
compact `product.md` has no `product/` beside it.

General Product Models may omit this metadata. The public Blueprint publication
profile requires a category, at least one tag, at least one
author, a license, and `logo.svg`. There is no separate Blueprint manifest.

### `taxonomies.yaml`

```yaml
scenarioKinds:
  - id: primary
    name: Primary
    description: Expected observable behavior path.
    colorSlot: 1
  - id: edge
    name: Edge case
    description: Alternative or failure path.
    colorSlot: 6
  - id: validation
    name: Validation
    description: Input or an act the Product refuses while preserving the Actor's work.
    colorSlot: 3
```

### `interfaces/<id>.md` or `interfaces/<id>/interface.md`

An Interface is a supported way for Actors to interact with the Product.
Product behavior can be independently required and verified for each Interface.
Every model has at least one: a model with no Interface is a `lint` error.
A customer web application, mobile application, operator CLI, partner API, and
inbound webhook endpoint are Interfaces. Frameworks, internal adapters, and
private component APIs are not.

An Interface is **inbound**: something arrives at the Product through it. An
outbound connection the Product opens to a third party is not an Interface,
even when the integration is stable, versioned, and vendor-supported.

```markdown
---
type: web
actors: [shopper, guest]
entryPoints:
  - web: /
languages: [en]
---

# Customer web application

The browser interface through which shoppers use the store.
```

`type` is required and is one of `web`, `mobile-app`, `desktop-app`, `cli`,
`api`, `webhook`, `messaging`, `voice`, `device`, or `agent`. It states the
supported interaction contract, never its implementation technology: `web` is
valid; `react` is not. `agent` is the surface an AI coding harness reaches
through installed skills or tools — a contract with its own Actors, boundary,
and independently verifiable behavior, not the harness's own interface. An
Interface has exactly one type; independently supported
types are separate Interfaces. `actors` names at least one Entity that `acts`:
**who uses** the Interface. The list is descriptive — a permission claim lives
only in a Business Rule — and `lint` holds every Step to it as consistency
between the Steps and the surface they happen on. `entryPoints` is optional and
contains product-facing root addresses. On an
Interface a key is one of two things: **that Interface's own `type`**, for an
address in its own vocabulary, or **the id of another Interface**, for a surface
a reader arrives from. A local web report opened by an operator command declares
`operator-cli: shop report` beside its own `web: /` — where you reach it from is
a fact about the surface reached, and it has nowhere else to live. Its own id is
not a key: that is what `type` already says. On an Experience or a Screen the key
names the containing Interface's id, unchanged. One field,
one rule per resource type, both checked by `lint`. H1 and lead
description are required; `## Intent` is optional. An Interface has no
access mode.

**`## Capability boundary` is a `lint` error** on an Interface, an Experience
and a Screen. `availability` on each Capability is the positive claim of what a
surface offers; what it does not offer is what no Capability is available on.

`languages` is optional and, when present, is a unique list of language tags
that is a subset of the Product's `languages`; an Interface listing languages
while the Product declares none is a `lint` error, as is a tag outside the
Product's list. It narrows the Product's list to what this surface serves. An
Interface that omits it serves every language the Product declares.

### Outbound dependencies

An external system the Product calls — a syndicated feed it polls, a payment
processor it charges, a mail provider it sends through, a model API it queries —
does not act and gets no Interface. It may still be an Entity, when the Product
keeps or reasons about instances of it.

Model it where its result is observed:

- the Capability that makes the call names the external system in its prose and
  states what triggers the call;
- its `availability` names the Interfaces where an Actor observes the outcome,
  never a synthetic Interface;
- product-significant failure behavior — what the Actor sees when the external
  system is unavailable, slow, or wrong — is a Capability Scenario;
- the provider's published contract attaches as a `references` entry with
  `kind: spec` or `kind: doc` and `role: context`.

Direction decides. When the same third party also calls the Product — a webhook,
callback, or push subscription — that inbound interaction is through an Interface
and the third party is an Entity that `acts`. A feed provider the Product polls
is a dependency; a feed provider that pushes updates to the Product acts.

There is no external-system resource type. An outbound dependency shared by several
Capabilities is described by each Capability that depends on it.

### AI in a Product

AI enters a model in exactly one of two ways, decided by who initiates:

- **A model the Product calls is an outbound dependency.** Drafting,
  summarizing or classifying that a person asks for, or that the Product runs on
  its own schedule, is a Product Step; the Capability names the language model
  and what triggers the call, and the model gets no Entity that acts and no
  Interface. What the person sees while the model is unavailable is an `edge`
  Capability Scenario.
- **The person's own agent harness acts.** It is `ai-agent`, the
  acting Entity the acts table names, reaching the Product through an `agent` Interface.
  Every grant naming it reaches the person it acts for through `related` — a
  relation such as *a Member connects an AI agent* — because a bare
  `actors: [ai-agent]` grants every agent, and `lint` warns.

Either way, what the AI produces to change something a person owns, and the
Product keeps, is a draft until that person decides it; a summary that
changes nothing is not a draft. A kept draft is its own Entity when it keeps facts its target never
has — a reason, a source passage — and otherwise a `Proposed` State of the
target. A draft Entity's States are `Proposed`, then `Accepted` or `Dismissed`,
and `Outdated` where the Product closes it because its target changed.
Accepting and dismissing a kept draft are each a Capability, being later acts on
something a run produced — `accept-<draft>` and `dismiss-<draft>` for a draft
Entity, `accept-proposed-<thing>` and `dismiss-proposed-<thing>` for a State, where
dismissing removes the proposed thing; a Business Rule says only the person decides it, and
another that the draft changes nothing until accepted. A draft that only fills
an editor the person has not saved is not kept: saving is the acceptance, and it
needs no Capability of its own.

### `interfaces/<interface-id>/experiences/<id>.md` or `<id>/experience.md`

An Experience is a coherent context of Product use with a stable audience,
access boundary, and set of available Capabilities. It says who is there and
what they can do, never what it looks like. **It belongs to exactly one
Interface** — the one whose folder holds it. Experiences are optional: create
them only when named contexts distinguish meaningful Product behavior inside an
Interface.

The same context on two Interfaces is two Experiences, not one shared resource.
They differ in screens, reach and affordances even when they pursue the same
goal, and one file cannot describe both without hiding where they diverge.
Give them the same file or folder name and they are counterparts by
construction.

```markdown
---
actors: [store-admin]
access: restricted              # public | authenticated | restricted
entryPoints:
  - admin-web: /admin
---

# Administration

Where authorized operators manage the store and its orders.
```

`actors` is a non-empty list of Entities that `acts` — who uses the Experience —
and every one must be supported by the owning Interface. `access` is required,
`public`, `authenticated` or `restricted` as the division conditions read them,
including wherever people sign in as public. It is the most open the context can
be: a setting
that closes it — content public only while the store allows guests — or opens
it, such as anonymous access, is a grant's `when` on the operations it
restricts and never justifies an Experience of its own. Optional `entryPoints`
key the owning Interface only. H1 and lead description are required;
`## Intent` is optional. The path names the Interface.

Experiences form an exhaustive, potentially overlapping cover of the Interface
that holds them. The union of their Actors must equal that Interface's Actor
list, so no Interface Actor becomes unreachable when Screens move under
Experiences.

### Availability

Capabilities declare `availability`: a unique, non-empty list of Contexts.

```yaml
availability:
  - place: operator-cli
  - place: customer-web::storefront
  - place: customer-mobile::storefront
```

Availability states intended Product meaning, never implementation status.

**A Capability is available in every Experience in which one of its Actors uses
it**, never only in the most open one. Guests reading pages in a public
Experience and signed-in Users reading them in an authenticated one make the
Capability list both, and each Experience holds its own counterpart Screen —
unless the Screen is shared by every Experience of the Interface, which puts it
beside `experiences/`. A Screen an Actor reaches both before and after signing
in exists in each Experience that reaches it.

Screens, Scenarios and Journeys declare no availability: a Screen's path is its
placement, and a Scenario Step names one concrete Context per route.

### Where the model stops

**The model says what an Actor can reach, see, do and trigger at each place. It
never says how that looks or is built.** The test:

> Rebuild the surface from scratch: a web or mobile view with a different
> component library, layout, typography, colors, spacing, icons, motion and
> copy; a CLI with a different command style; an API in a different style, CRUD
> or RPC. Everything that would still have to be true is the model's: who can
> reach the place, what facts it shows, what abilities it offers, what
> conditions change that, and what happens next. Everything the rebuild is free
> to change is design's, and the model says nothing about it.

In the model: which surfaces exist and their interaction type; which languages
they serve; who is in each context and with what access; which views exist and
what facts and abilities each has, including the facts an Actor enters; where
behavior moves between views; the conditions and outcomes an Actor meets; who
may act; and the Product's own vocabulary for all of it. Each has a field or a
Step that `lint` checks; nothing else about a view does.

Out of the model: component libraries, theming, layout, typography, color,
radius and borders, iconography, motion, microcopy and tone, gestures versus
buttons, modal versus page, tabs versus one page, a wizard versus one form,
breakpoints, loading and hover states, menus and what they contain, and
quality attributes such as accessibility or performance; a CLI's command
names, syntax, flags and output format; and an API's style (CRUD or RPC),
paths and payload shapes. These live in a design system, design files, help
text or an API description, attached as `kind: visual`, `doc` or `spec`
References with `role: intent`.

**Commitments.** A quality the Product commits to whatever the design — a
stated accessibility conformance level, a response-time promise in a contract —
is a Business Rule that names the authoritative Reference and requires it, the
same pattern as contractual wording below. How a design meets it stays design.
A quality nobody has committed to is not a Rule.

**Text.** The model says that an Actor is told something and under which
condition — a Step, an Edge case, or a Rule outcome. Ordinary copy stays outside
the model. When exact wording is contractual, a
Business Rule identifies the authoritative Reference and explicitly requires
that wording. Verification compares it; an unavailable Reference makes that
requirement unverifiable, not satisfied.

An outbound message — a confirmation email, a push, an SMS — is a Product Step
that `reads` what it carries, and its content beyond those facts is copy.
Messages may have a lifecycle when the Product manages them. Flags and
experiments follow **Flags, experiments and dynamic configuration** under
Business Rules: one encoding per case.

### `domains/<id>.md` or `domains/<id>/domain.md`

A Domain is a coherent region of the Product's subject matter — its own
vocabulary and its own invariants. It is not code architecture, not Journey
ownership, and not a folder for Capabilities that had nowhere else to go.

```markdown
---
colorSlot: 3
---

# Ordering

Everything between a full cart and a fulfilled order.

## Boundary

Owns cart contents, order state, and the transition between them. It does not
own catalog information, payment instruments, or fulfilment logistics.
```

Optional `colorSlot` and `references` frontmatter. H1 = name, lead paragraph =
description. `## Boundary` is required and must state both what the region
covers **and** something it explicitly does not own; a Boundary that only
asserts inclusion is a label, not a region, and is a `lint` error. A Domain
naming fewer than two Capabilities is a `lint` warning. The entire Domain
collection is optional to `lint`.

**Domains follow the Product's own sections** — the areas its navigation,
settings and administration group things under — one per section holding two
or more Capabilities, named in the Product's words. The section is the finest
navigation level that still holds two or more Capabilities; a parent menu is a
section only when none of its direct children is. A Capability no section
reaches, such as signing in or one only an emailed link or a schedule starts,
joins the section whose Capabilities change the same Entities, or has no Domain
when more than one section or none does; one alone on a page beside a sibling
section has none either. A Capability several sections reach — a document
opened from Home, Recent and its collection — has no Domain, and nothing that is
not a section becomes a Domain. For a Product planned before its code, the
sections are the planned ones. Domains an author has written or regrouped are
the author's: mapping adds new Capabilities to them and never re-cuts, merges
or renames them.

**Domain is an axis, not a level.** It classifies members of both hierarchies,
so it neither contains nor is contained by anything. `domain` on a Capability
and on an Entity are the only *authored* Domain edges; every other Domain
relation is derived — a Screen, Experience or Journey is about the Domains its
Capabilities are about. Only Capabilities count toward the two-Capability
threshold: an Entity's `domain` classifies the thing, it does not make a
region.

`domain` is optional and single.

### `entities/<id>.md` or `entities/<id>/entity.md`

An Entity is a thing the Product keeps or reasons about, which an Actor can
point at and the Product can tell apart from another one — an order, a listing,
a saved item, and the Reader who saved it. Capabilities name the Product's
verbs; Entities name its nouns, the people and systems that act on it included.

**The test is identity, not storage.** A draft recommendation the Product never
persists is still an Entity when a reader points at it and the Product
distinguishes it from another. A database row no Actor can name is not.

**The unit is the naming test**: a thing an Actor would call *"this one"*. A
shopper says *"this order"*, never *"this order line"* — that is "The items
ordered" inside Order. A reader says *"this item"* and *"this collection"*, but
"library" is simply all of them. Containers and parts are not Entities.

Three more things are not Entities, and each is something the Product genuinely
handles, which is why the naming test alone lets them through.

**Not a representation of another Entity.** A serialization, export or rendering
is that thing in another shape, not a second thing beside it. If you can
regenerate it from an Entity, it belongs in that Entity's information and in the
Capability that produces it.

**Not a receipt the Product keeps for itself.** A marker file, a lock, an index
the Product needs in order to work safely — ask who the record is *for*. An
Actor never points at these; the Product does.

**A record of what happened that the Product shows an Actor is an Entity.** An
activity or audit log a customer's administrators read passes the naming test
— *this entry* — and is one Entity whose facts name who acted, what changed and
when, presented by the Screen that shows it. What it records is said once, by
a Business Rule without `permits` that targets the recorded operations and the
log Entity, the log's target a bare `{ type: entity, id }` with no `effect`:
*every change to an Order is recorded in its activity*. No Step
lists the entry its operation causes — the Rule makes it for every Step it
selects, the one exception to [exhaustive Step lists](#scenario-sections). A
Step reading the log lists the entries it reads, like any read. A log no Actor reads,
kept for the team running the Product, is a receipt and is not modelled.

**Not the Product itself.** Its surfaces, its shipped content, and its closed
vocabularies are what the Product *is*, not what it keeps. A Product keeps
information about *instances* of an Entity; where there are no instances, only
members of a fixed list, that is a vocabulary.

Apply this to the thing you would name, never to the classification above it. A
closed list of kinds is a vocabulary; the things those kinds classify are not,
and a Product holding a folder full of them is holding instances. "Payment
method" may be a fixed list of four while every payment is its own thing.

The third is the one that traps a modelling tool, and the discriminator is
worth stating: **does the Product keep information about instances of this, or
is this the Product itself?** A tool whose subject is product models keeps
`capabilities/` full of them, so Capability is an Entity for it. The same tool
ships its own skills rather than keeping records about them, so a skill is not.

**How many: write `## Information kept` before you decide.** Candidates that
share a family name — document types, event kinds, payment methods — are one
Entity when a single list of kept facts is true of all of them, and several when
it is not. Write the list first. If it needs *"depending on the kind"*, or
carries facts that hold for some members and not others, the shared name is a
category and its members are the Entities. The test reads facts, not effects: a
fact whose effect differs by kind, such as a permission level that also covers a
folder's contents, is a Rule and never splits the Entity.

Being stored, parsed and rendered the same way does not make them one. That is
how the Product *handles* them; this asks what it *keeps* about them.

**When the call is close, split.** Anyone can merge two Entities later. A
collapse deletes the difference and leaves nothing in the model saying it was
ever there, so a reader cannot tell there was a question. An author with nobody
to ask splits, and records the choice.

**When one list is contained in another, the intersection is not the answer.** A
shared list can always be produced by discarding whatever differs, so the
procedure above says nothing useful about a candidate whose kept information is
a subset of another's. Ask a different question: **does the smaller one have an
address of its own?**

Being kept inside the larger thing is not the test. That is storage, and storage
is never the test here. Ask what can name it on its own — a file, a route, a
scope a command accepts, an id another resource cites. "The items ordered" has
none of those and lives inside Order. Something with any of them is its own
Entity, however much its information overlaps and however firmly the larger
thing contains it.

```markdown
---
domain: ordering                 # optional
relations:
  - entity: catalog-product
    verb: was placed for
    cardinality: many-to-many
---

# Order

A shopper's confirmed intent to buy.

## Information kept

- **Items ordered** — the items and their quantities
- **Total charged** — the amount taken from the shopper
- **When placed** — when the shopper submitted it

## States

### Pending

Submitted and awaiting payment settlement.

### Confirmed

Paid and accepted; stock is committed.

### Refunded

Reversed after confirmation.
```

```markdown
---
kind: person
acts: external
relations:
  - entity: order
    verb: owns
    cardinality: one-to-many
---

# Shopper

A person who browses the catalog and buys products.

## Information kept

- **Delivery address** — where their orders are sent
```

```markdown
---
kind: system
acts: external
---

# Payment gateway

The processor that posts settlement results back to the Product.
```

**At least one of `## Information kept`, `## States`, and `acts` must be
present.** A thing may have information and no lifecycle worth naming, a
lifecycle with almost nothing kept about it, or — a payment gateway — nothing
kept at all and a reason to exist because it acts.

**An Entity that acts.** `acts` is optional and, when present, is `external` or
`internal`, relative to the Product boundary: whether the thing acts
independently outside the Product owner's boundary, or on the Product owner's
behalf. A staff operator is usually internal even when working remotely; a
partner system is usually external even when connected over a private network.
`kind` is `person` or `system`, is **required when `acts` is set**, and is
invalid otherwise: an Order says nothing, because *it's a thing* is the
default, and an Entity that acts always says which of the two it is.

Two independent questions decide, neither ranking the other. *Does the Product
keep or reason about instances of it?* — everything modelled does; that is why
everything is an Entity. *Does it initiate, with a goal or privilege of its own,
and must the Product keep a stable inbound contract for it?* — then it `acts`.

| | keeps / reasons about | initiates under a contract | |
| --- | --- | --- | --- |
| Reader | yes | yes | Entity + `acts` |
| Store admin | yes | yes | Entity + `acts` |
| Payment gateway | reasons about | yes — posts webhooks | Entity + `acts` |
| AI agent harness | reasons about | yes | Entity + `acts` |
| Order | yes | no | Entity |
| Employee (payroll) | yes | no — never signs in | Entity |
| Feed source the Product polls | yes | no | Entity |
| An internal service with its own credentials | no | no — the Product keeps no contract with its own component | not modelled |
| The Product's own scheduler | no | no — that is `unattended` | not modelled |

The third clause is what bounds *privilege*. **A privilege that exists only in
code is authorization, not product meaning**, so *service X may cancel orders,
service Y may not* is deliberately unsayable. If two roles have the same goals
and permissions, they are one Entity. A thing that starts acting gains one
field and keeps its file and id.

An external system acts only when it **initiates**. A system the Product calls
out to is a dependency of the Capability that calls it: it has no goal inside
the Product, no privilege to grant, and no inbound interaction contract the
Product must keep stable for it. Direction decides, not ownership — the same
third party can be a dependency in one direction and act in the other when it
also calls back. See [Outbound dependencies](#outbound-dependencies).

**An AI agent harness acts**, with the id `ai-agent`, `kind: system` and
`acts: external`. It initiates, it holds a privilege nobody else has — it reads
and writes on the person's behalf — and what it does is not fully determined by
the person who invoked it: it chooses what to inspect, what to propose, and when
to stop. A browser makes no such choices, which is why a harness is not merely
the runtime an `agent` Interface is delivered through. Name it `ai-agent`
rather than after one use of it, since the same participant appears in products
that have nothing to do with code. This promotes nothing else by analogy: a CI
runner executing a fixed command has no latitude of its own.

**The word Actor names a role, not a type.** An Entity that acts is *an Actor*
in the position where it acts — a Step's `actor`, an Interface's, Experience's
or Journey's `actors`, a Business Rule grant's `actors`. Every such reference
must name an Entity that `acts`, and `lint` errors otherwise.

**`## Information kept`** is a bullet list of **named** single-line facts the
Product keeps about the thing. Each is `- **Name** — prose`: the name in bold,
an em dash with a space on each side and nothing else as the separator, and
non-empty prose after it. Names are unique within the Entity and are cited by
exact match — by a Business Rule's `facts` target and its `when` condition, by
a Screen's `entities` entry, and by a Step's `entities` entry, and a name that
does not resolve is a `lint` error wherever it is cited. The idiom is the one
`## States` already uses, where an H3 titled `Pending` is cited as
`from: Pending`.

It is **what the Product keeps, never how it is stored**: *When placed*, not
`created_at TIMESTAMP`. No types, no cardinality, no keys, and **no structured
relations between Entities** — *Items ordered* is prose, never `hasMany`. A fact
is addressable, never typed: addressable is what a field-level Rule and a
derivation need; typed is a data model. A cache is out of the model; the data it
holds is in when the Product promises it. The word *kept* means held, not
persisted, and computed information is still a fact.

`relations` is optional and declares edges to other Entities — an Entity that
acts included, which is how ownership is said: the Shopper above `owns` Orders,
and a Business Rule walks that edge back to find who may. Each is
`{ entity, verb, cardinality }`: `verb` is the product's own word for the
relationship, and `cardinality` states **both ends**, reading source to target.

```yaml
relations:
  - entity: item
    verb: publishes
    cardinality: one-to-many       # one Source publishes many Items,
                                   # and an Item comes from exactly one Source
```

Both ends are stated because whether an Item may come from two feeds is a
product decision a single end cannot hold.

`cardinality` is `one-to-one`, `one-to-many`, or `many-to-many`.
**`many-to-one` does not exist**: declare that relationship from the other
Entity, where it reads `one-to-many`, so one `1:N` has one encoding.

**A relation is declared on one side only** — the inverse is derived. Two
Entities that declare relations *at each other* are a `lint` warning naming
both files; it stays a warning because two genuinely different relationships
between one pair are legal.

A relation may target this same Entity — a Comment replies to another Comment, a
Task blocks another Task — and only a duplicate edge is invalid. A relation
never satisfies the no-orphans rule below, because a cluster of Entities
referencing each other while no behaviour touches any of them is still
vocabulary nobody uses.

**`## States`** contains H3 state names, each followed by non-empty prose. The
first listed state is the one a thing starts in. **The Entity declares its
states and nothing about the moves between them.** The lifecycle is composed
from Scenario Steps: a Step's `entities` entry says which Entity it creates,
changes or removes, and from and to which state, and the report draws the
machine from every Scenario in the model. A `transitions` key is a `lint` error
pointing to the Step `entities` entry, and `## Transitions` and `## Relations`
are invalid sections: the frontmatter and the Steps are the one authority.

`lint` composes every Scenario and reports what the composition is missing:

- **Unreached state** — a warning: a state other than the first that no Step
  ever leaves anything in.
- **Unproduced origin** — a warning: a Step declares `from: Confirmed`, nothing
  produces Confirmed, and it is not the first state.
- **No creation** and **no termination** — notes the report shows on the Entity
  page, never `lint` findings: an Entity with states that no Step creates, or
  that nothing ever removes. A Catalog product no Capability creates is a real
  Entity whose instances pre-exist the model.

`domain` is optional and single. H1 = name and the lead paragraph = description.

**`singleton: true`** says the Product keeps exactly one of this Entity — its
own settings, such as Store settings with the refund threshold every store
operator works under. It is optional, valid only as `true`, and invalid on an
Entity that `acts`. A grant condition reads a `singleton` Entity's one
instance from anywhere; settings each Workspace or Organization keeps are not
`singleton`, because there are as many as there are containers, and a
condition reaches them through the targeted instance. A relation with a
`singleton` on a `many` end — the target of a `one-to-many`, either end of a
`many-to-many` — is an error.

**No orphans.** An Entity must be changed by a Step, presented by a Screen,
named as an actor — on a Step, an Interface, an Experience, a Journey, or a
Business Rule grant — read by a Business Rule, as a condition's `entity` or
a `configuredBy`, which is how a settings Entity earns its place — or chosen by,
as a Variation's assignment unit or the holder of a fact it chooses by. A Step's
read never counts, and neither does a relation. An Entity nothing points at is
a `lint` error: it is either unused vocabulary or a relation somebody forgot to
declare.

An Entity never declares Capabilities, Screens, availability, or who may act on
it. Steps say what changes it, a Screen says what presents it, a Business Rule
says who may; every other Entity relation is derived. Entity states are the
only states in the model: a Screen has none of its own, because the condition
a view meets is a `condition` Step, an Edge case, or a Rule outcome.

### `capabilities/<id>.md` or `capabilities/<id>/capability.md`

A Capability is a stable ability of the Product. It has no necessary beginning
or end and may support several Journeys, Experiences, Screens, and Interfaces.
Capabilities and their observable Capability Scenarios are the behavioral core
of the model; Journey composition is optional.

```markdown
---
domain: ordering                 # optional
availability:
  - place: customer-web::storefront
references:
  - kind: code
    role: implementation
    target: src/services/orders.ts#OrderService.submit
---

# Checkout

Turns a valid cart into a confirmed order.

## Intent

Let a shopper complete a purchase without losing cart state on a recoverable
failure.
```

**A Capability declares nothing about Entities.** What it changes is what the
Steps of its Scenarios say it changes, and a report derives the aggregate —
*Order · creates → Pending · changes → Confirmed · 3 Scenarios*. An `entities`
key on a Capability is a `lint` error pointing to the Step `entities` list. A
Capability that only presents or inspects a thing has Steps that `reads` it,
and the Screen that shows it carries `entities`.

`availability` is required and needs at least one Context, each naming an
undivided Interface or one Experience of a divided Interface. `domain` is
optional and, when present, names exactly one Domain. A Capability lists no
Actors, Rules or Scenarios: Steps, Business Rules and Scenario folders own
those relations. A Capability Scenario is the only direct acceptance coverage
for a Capability; Journey Scenario use does not satisfy it. Missing coverage is
always an error.

A Capability is the smallest durable behavior that remains independently
meaningful, not necessarily the smallest UI action or code operation. Capability
Scenarios vary the conditions, route, or observable result of that one
behavior; they never hide sub-capabilities.

**The split test is the contract.** Parts of an ability are separate
Capabilities when they differ in who may do them (a permission of their own: a
separate grant), where they are offered (availability), or in verb —
`manage-repositories` is too broad when its cases are create, configure,
archive and delete. Nothing else splits one: not a different Actor, since one
Capability is offered in every Experience it is used from; not a Business Rule
that only constrains one part, such as a time limit; not which grant applies,
told apart by a fact of the thing acted on, which is a grant's `when`; not the
Entity a way creates or the State it starts from — adding an authenticator app
or backup codes, restoring from the archive or the trash, are Scenarios of one;
and not filtering, sorting or searching within a browsing ability. Nor does a
setting or the deployment: the ways it selects between stay in one Capability,
as Scenario alternatives, separate Scenarios or decision points by
[What selects](#variations), and a way it adds beside the others, the Actor
choosing among them, is an ordinary Scenario. Splitting neither creates nor
removes a Domain.

The Steps of one run are one Capability, including a link or code the run sends
when it has no outcome for the Actor without it — requesting a password reset
and choosing the new password. A later act on something a run produced —
confirming the email of an existing account — is its own. Settings in one
section of the Product's navigation are one Capability however the screen saves
them, and different sections are separate Capabilities; entries of a list, such
as permission entries or members, are things of their own, each added, changed
and removed by its own Capability, even through an API call that replaces the
whole list. The same verb reached from another context is
the same Capability, available there too. A continuation several Capabilities
share — a second factor after any sign-in method — is its own Capability: the
ones it continues end their Scenarios at the hand-off, and a Journey joins them.

**Opposite verbs are separate Capabilities.** An opposing pair — publish and
unpublish, enable and disable, follow and unfollow, pause and resume, accept and
dismiss, share and stop sharing, open and close — is two Capabilities, because
each control shows its own verb, even where one button toggles between them.
Returning to an earlier State with the *same* verb is a Scenario of that verb:
republishing an unpublished collection is `publish-collection`, reopening a
closed form is `reopen-form` only because the control says *reopen*. One
control that sets one fact to one of several values — a visibility of private,
unlisted or public — is one Capability, `change-<thing>-<fact>`, with a Scenario
per value worth distinguishing. Changing one's own earlier submission through
the control that made it — changing a vote, changing an RSVP — is a Scenario of
the submitting Capability, not a Capability of its own; withdrawing it through a
control of its own is. Putting an entry on a thing's list and taking it off — a
tag, an assignee, a member — are two Capabilities even inside the thing's edit
form, when each entry is a thing of its own: an Entity, or a person. A value
inside one fact of the thing — a choice question's options, a snippet's tags
kept as a fact — changes with that fact. An on/off switch among a
settings section's settings stays part of that section's one Capability.

### `business-rules/<id>.md` or `business-rules/<id>/business-rule.md`

A Business Rule states a durable constraint, derivation, or authorization policy
that must hold across the Product. Permission is a kind of Business Rule; not
every Business Rule is a permission. **Permission claims appear only in Business
Rules.**

```markdown
---
appliesTo:
  - type: capability
    id: checkout
    contexts:
      - place: customer-web::storefront
  - type: journey
    id: browse-and-buy
references:
  - kind: code
    role: implementation
    target: src/services/orders.ts#OrderService.submit
---

# Stock must be available

An order can be confirmed only while every requested item has sufficient
available stock.

## Intent

Never accept an order the product cannot fulfill.

## Rationale

Inventory may change between browsing and final submission, so checkout must
revalidate it.
```

```markdown
---
appliesTo:
  - type: entity
    id: order
    effect: changes
    to: Refunded
permits:
  - actors: [store-admin]
    when:
      - { fact: Total charged, at-most: 100 }
  - configuredBy: store-settings
    when:
      - { fact: Total charged, over: { entity: store-settings, fact: Refund approval threshold } }
---

# Refunds need an operator

A refund is issued by a store operator, and above the store's approval threshold
only by whoever the store configures.
```

```markdown
---
appliesTo:
  - type: entity
    id: order
    facts: [Total charged]
---

# Total charged equals subtotal plus tax minus discount

Total charged always equals Subtotal plus Tax minus Discount.
```

The lead paragraph is the rule statement; `## Intent` and `## Rationale` are
optional prose. The H1 states the assertion itself, about what the targets
select: a permission names the operation and who may perform it ("Only the
owner reads an unpublished collection"), an invariant names what always holds
("Total charged equals subtotal plus tax minus discount"). A consequence of the
Rule, a feature, or the mechanism that motivates it is not its title; it belongs
in the lead or the Rationale. Read with only the title and `appliesTo`, the
grants' who should be no surprise. Rationale explains the current condition or
consequence that makes the constraint necessary; it never recounts alternative
designs or why they were rejected. `appliesTo` is a required non-empty list of
typed targets, and targets are additive: the Rule governs their union. Business
Rule owns these relations; consumers derive every backlink.

**Behavioural and Context targets.** A behavioural target uses `type` =
`capability`, `capability-scenario`, `journey`, or `journey-scenario`, requires
`id`, and may use a non-empty `contexts` list to narrow that target. Without
`contexts`, the Rule applies to all supported Contexts of the target. A direct
Context target uses `type: context` plus one nested `context` object instead of
`id`:

```yaml
- type: context
  context:
    place: operator-cli
```

A Context selector on a behavioural target must match at least one Context
supported by that target. A selector naming an Interface or Experience matches
descendant places; a Screen selector matches that Screen. Duplicate selectors
and a parent selector paired with its redundant descendant are invalid. Do not
target both a Capability and one of its Capability Scenarios, or both a Journey
and one of its Journey Scenarios; the ancestor already governs the child.
Domains remain navigation-only, so Rule Domain backlinks are derived through
targeted behaviour rather than authored.

**A Business Rule governs two or more behaviours, a Context independent of any
single behaviour, or a thing.** Anything true of exactly one Capability is that
Capability's business — a `condition` Step or its Scenario Outcome — not a
Rule. The boundary is checkable and `lint` enforces it: a Rule whose
`appliesTo` resolves to exactly one behavioural resource, with no `contexts`
narrowing it, is a `lint` warning naming the Capability that should own it
instead. A Rule with a `type: context` target is always valid, because a
constraint on an interaction context belongs to no behaviour. **A Rule with an
Entity target is always valid**: a durable invariant or permission on a thing is
a Rule even when it selects a single operation, because the two homes the
warning suggests do not exist for a permission.

**Entity targets.** An Entity target uses `type: entity`, requires `id`, and may
carry `effect`, `from`, `to`, `facts`, and `contexts`:

```yaml
appliesTo:
  - type: entity
    id: order
    effect: changes            # optional — creates | changes | removes | reads
    from: Confirmed            # optional — the state the operation leaves
    to: Refunded               # optional — the state it lands in
    facts: [Margin]            # optional — the facts it governs
    contexts: [{ place: admin-web::order-console::order-detail }]   # optional
```

**A target selects; a grant conditions.** `effect`, `from` and `to` select
Steps by the keys their `entities` entry already carries: `from` is valid with
`changes` and `removes`, `to` with `creates` and `changes`, and neither with
`reads`. Every state named is one the Entity declares. Whether the instance is
in some state *when the operation happens* is a condition and lives in a grant's
`when`. `facts` names facts of this Entity by their exact name and narrows the
selection to Steps whose entry cites one of them. With `effect` `reads` or
absent, a fact-scoped Rule governs information — a derivation, or field-level
visibility — and also selects Screens, below; with `creates`, `changes` or
`removes` it governs that operation on those facts only — a field-level edit,
such as delivery details editable while an order is unpaid. `contexts` scopes
the Rule to existing places. For a Rule without
`permits`, each selected place must be a Screen presenting the Entity (and at
least one governed fact when fact-scoped), or an ancestor of one. A permission
Rule needs only to resolve: neither a grant nor a prohibition requires a
matching operation, Screen disclosure or fact use to exist, and a prohibition
never needs an example of the prohibited behavior.

**One permission Rule per operation.** Each `effect` Actors perform on an
Entity — `creates`, `changes`, `removes`, and `reads` where a grant restricts
it — is governed by a Rule of its own, its target naming that `effect`, even
where two operations happen to share a grant: a `related` grant starts from one
Entity target, and a target without `effect` would also select reads.
Deciding a draft is a `changes` or `removes` from its `Proposed` State and
needs no Rule beyond these unless its grant differs.

**A place-scoped Rule is not escaped by omitting `contexts`.** A Step that omits
them is shared by every route, which puts its operations inside the Scenario's
own places — the union of the places its contextualized Steps name — and a
place-scoped Rule selects it there.

**The minimal selector is canonical.** A `from` that every Step landing in `to`
already leaves from is a `lint` warning, as is a `when` state condition every
selected Step already satisfies. Refunds only ever leave Confirmed, so
`{ changes, to: Refunded }` is the Rule and `{ changes, from: Confirmed, to:
Refunded }` is flagged: a refund added later from Pending would silently escape
the second.

**`permits`** is optional and has three states:

| `permits` | Says |
| --- | --- |
| omitted | this Rule makes no authorization claim |
| `[]` | the selected operation is forbidden to everyone |
| a list of grants | the operation is permitted through any one of them |

Silence is not a claim. A lifecycle composed from Steps can be incomplete, so a
Step that never appears cannot be read as *nobody may*. `permits: []` is the one
way to say it, and it is checkable: a Step performing that operation is a
`lint` error naming the Rule, and `verify` confirms the code refuses it.

```yaml
# a Refunded order is never cancelled — and nothing else is claimed
appliesTo: [{ type: entity, id: order, effect: changes, from: Refunded, to: Cancelled }]
permits: []
```

**A Rule with `permits` targets Entities only.** An operation is an Entity
effect on a Step. *Who may perform this Capability* with no Entity in sight is
what Interface `actors` already records as *who uses it*, and checking it over
Steps would duplicate the Entity checks. A Rule carrying `permits` with a
behavioural or Context target is an error.

**The algebra.**

- Targets within one Rule select the union of governed operations.
- Grants within one Rule are **OR**.
- Keys within one grant are **AND**.
- Permission Rules that select the same operation are **AND** — every matching
  Rule with `permits` must allow it.
- An operation no Rule with `permits` selects is open.

```yaml
# the owner, or an admin
permits:
  - { actors: [store-admin] }
  - { related: [{ verb: owns, entity: shopper }] }

# an admin, and only while the Order is still Confirmed
permits:
  - { actors: [store-admin], when: [{ state: Confirmed }] }

# the owner under 100; at 100 and above, an admin
permits:
  - { related: [{ verb: owns, entity: shopper }], when: [{ fact: Total charged, under: 100 }] }
  - { actors: [store-admin],                      when: [{ fact: Total charged, at-least: 100 }] }
```

AND across Rules is what lets a broad Rule and a narrow one compose: *owner or
admin may change an Order* plus *admin may refund* yields admin-only refunds
without either Rule knowing about the other. Its cost is the split-grant trap:
*the owner may read a Collection* and *a Visitor may read a Published
Collection* written as two Rules AND to owner-only. Grants meant as alternatives
sit in one Rule, and `lint` warns when two permission Rules carry identical
target selectors.

**Every grant names a who.** A grant needs at least one of `actors`, `related`,
`self`, `unattended`, `configuredBy`. An empty grant, or a grant with only
`when`, is an error: *anyone* already has an encoding — list every Entity that
acts — and a second one would be silent. A grant may carry more than one
who-key, but only one of them can do work: `related` and `self` already fix
which Entity the actor is, so an `actors` list beside either restates it when it
names that endpoint and contradicts it when it does not — the second can never
be satisfied and is an error. *An admin who is also the owner* is not a grant
shape; it is an `owns` relation whose endpoint is the admin Entity. AND within a
grant is for a who-key and its `when` conditions.

| Grant key | Says | Value |
| --- | --- | --- |
| `actors` | these may | ids of Entities that `acts` |
| `related` | whoever stands in this relation to the instance may | a path of `{ verb, entity }` segments |
| `self` | the instance itself may | `true` |
| `when` | only while these conditions hold | a list of conditions, AND-ed |
| `unattended` | the Product's own schedule may | `true` — nothing else |
| `configuredBy` | gated, by data the Product does not own | the id of the Entity holding the configuration |

**`related`** is a path from the Rule's one Entity target, walking declared
relations and their derived inverses. Each segment names the verb and the
Entity it arrives at, so a hop is never ambiguous — a Workspace *contains*
Documents and a Folder *contains* Documents, and both keep the product's own
word for it:

```yaml
# document  ←—contains—  workspace  —has member→  user
appliesTo: [{ type: entity, id: document, effect: changes }]
permits:   [{ related: [{ verb: contains, entity: workspace }, { verb: has member, entity: user }] }]
```

`lint` checks that the Rule has exactly one Entity target to start from, that
each segment matches exactly one relation, declared or inverse, from the Entity
the path is currently at, and that the last segment lands on an Entity that
`acts`. A hop through a self-relation — a Comment that replies to a Comment — is
refused: naming the Entity does not give it a direction. `related: []` is an
error. **`lint` never touches an instance.**

**`self: true`** is the zero-hop path: the instance itself may. *Shoppers keep
their own address* targets the Shopper's *Delivery address* fact and permits
`self`; `actors: [shopper]` would have said any Shopper. It requires the
targeted Entity to `acts`.

**`when`** is a list of conditions, AND-ed, so a one-condition grant and a
three-condition grant have one shape. Each condition names a `fact` with exactly
one operator, or a `state`:

```yaml
when:
  - { fact: Total charged, over: 100 }                                            # hard-coded
  - { fact: Total charged, over: { entity: workspace, fact: Approval threshold } } # customer-set
  - { entity: workspace, fact: Approval required, is: true }                      # feature flag
  - { state: Published }                                                          # the instance's state
```

| Operator | Meaning |
| --- | --- |
| `over` | > |
| `under` | < |
| `at-least` | ≥ |
| `at-most` | ≤ |
| `is` | = |
| `is-not` | ≠ |
| `present` | the fact has a value |
| `absent` | it does not |

`present` and `absent` take only `true` (`{ fact: Coupon code, present: true }`);
any other value is a `lint` error.

**The operator implies the comparison; the fact declares no type.** `at-least`
and `at-most` exist because the off-by-one argument holds only for integers and
facts are untyped: `over: 99.99` is the wrong rule for money and for time.
`lint` checks the fact and any named Entity resolve, and that a named Entity
is read as one instance (below), and nothing more — whether
*Total charged* holds a number is `verify`'s job against code. A threshold is a
scalar, or the fact that holds it, `{ entity: <entity-id>, fact: <fact name> }`:
the fact must be one that Entity keeps, and its instance is resolved exactly as
a condition's `entity` is, below — a threshold of the targeted Entity itself
names that Entity. There is no other way to say *the threshold the customer
set*.

`fact` defaults to a fact of the targeted Entity and may name another through
`entity`, which is how thresholds, feature flags and a container's own settings
work: the value is a fact of another Entity and the Rule reads it. A condition
on the targeted thing itself names no `entity`. **Which instance a named
`entity` reads is fixed by the model**, and the first of these that applies
decides:

1. **The acting Entity** — the one Entity the grant's `actors` names, or where
   its `related` path ends: the instance acting, so `actors: [member]` with
   `{ entity: member, fact: Verified, is: true }` reads the member who acts. A
   grant whose `actors` lists several Entities fixes none of them; a condition
   on one of them is a grant of its own.
2. **On the grant's `related` path:** the instance the path reaches — the one
   nearest the acting Entity where the type repeats — so a per-board role reads
   the acting person's own Board membership, never the membership being
   changed.
3. **The targeted instance's own:** the one instance the targeted instance has,
   reached from the Rule's one Entity target by walking declared relations and
   their inverses where every hop leaves exactly one — the Quiz a Question is in,
   the Owner of the Habit a Check-in records, the Workspace a Document belongs
   to. A hop is to-one from the `many` side of a `one-to-many` relation and
   both ways of a `one-to-one`; `many-to-many` and self-relations are never
   walked. Where two walks through different Entities reach it — a
   suggestion's Habit and its Reflection both have an Owner — the model says
   they meet at one instance, and `verify` checks it. Two relations joining the
   same pair never meet — an Account that sends and receives Transfers is two
   Accounts — so a walk through them reads nothing.
4. **A `singleton` Entity:** the Product's settings, its one instance.

An `entity` none of these reaches, a walk through two relations joining one
pair, and an `entity` naming the target itself with no path passing it again
are `lint` errors: a condition that could read any of many instances says
nothing. Walk to it with `related`, give it a
to-one relation, or, when the Product keeps exactly one, declare it
`singleton`. `state` says *the instance is in state
X when the operation happens*: it must be a state of the targeted Entity, it is
valid on every target but `creates`, and it cannot be combined with `entity`.
It exists because two kinds of Step carry no state for a target to select by — a
`reads` Step, and an information change, which is `changes` with neither `from`
nor `to`. *Anyone may read a Published collection* and *the shopper edits
delivery details only while Pending* are both `when` state conditions. A
defaulted `fact` or a `state` needs exactly one Entity target to resolve against.

**Flags, experiments and dynamic configuration.** What differs decides the
encoding, and each case has exactly one:

| What differs | How it is modeled |
| --- | --- |
| Only who may perform one Entity operation | A settings fact read by a permission grant's `when`. One Rule; no Variation |
| Whether a resource exists at all — a feature a plan, flag or licence turns off | An ordinary resource whose lead names the switch; every grant only it passes also carries the switch as a `when` ([Variations](#variations)) |
| Which of two or more complete, supported forms of one resource applies, chosen by a setting, an assignment or a version | A [Variation](#variations) of the smallest resource containing the difference: Configuration, Experiment or Version. Business Rules vary only between whole policies. An A/B test whose arms differ in one Step is an Experiment of two Scenarios |
| Only how something looks | Design: `visual` References with `role: intent`. Not modeled |
| A branch on state the behavior meets — out of stock, payment declined | Scenario conditions and outcomes; a Business Rule states constraints shared by several behaviors |

There is no structured `when` on a Capability-targeting Rule. Who is in which
cohort is an Actor or tenant fact, cited as the Variation's `assignmentFact`.
The experiment engine — allocation, metrics, results — is outside the model
unless running experiments is the Product's purpose, when it is ordinary
Entities and Capabilities.

**A modelled product's own RBAC** is product behaviour, not this layer. Each
shipped role is an Entity that acts, granted through `permits.actors`, even
where configuration also defines roles or assigns people to them. Roles created
at runtime are instances of one `Role` Entity with its own lifecycle and
Capabilities such as `assign-role` — never one Entity per customer role. Roles
operators define in configuration outside the Product are one Role Entity
granted through `configuredBy`, with no Capability creating it; the people
holding them are one acting Entity, and a configuration that also grants
directly to people stays an Entity of its own. A role held per container, such
as an organization or a project, is held through a membership Entity that does
not act, whose Role fact names it. Such a role administers its container, not
the Product: the container's settings and member pages are `authenticated`
places, and the membership's Role in a grant's `when` decides who changes them;
`restricted` is only the Product's own administration area. A relation any role holder can hold — a
message's sender — is declared to each role Entity, with one `related` grant
per role. Facts of the person whatever their role live once on an Account
Entity that does not act, related one-to-one to each role Entity. A Step any of
several roles sharing an Account may take names the least privileged role the Product's
default permissions allow, ignoring grants made on a single resource. ABAC
policies are likewise a `Policy` Entity and the Capabilities that define and
evaluate it.

**What `lint` checks.** `lint` checks structural eligibility. It cannot prove
runtime ownership, a fact's value, or customer configuration, and never claims a
runtime grant is satisfied. A Step's actor has a **possible grant** in a Rule
when some grant of that Rule could admit it — which reads the grant's keys the
way the algebra above does, **AND**, so every key the grant carries must hold at
once, and a key it omits constrains nothing:

- `actors`, when present, lists the Step's actor;
- `related`, when present, ends on the actor's Entity;
- `self`, when set, requires the actor to be the targeted Entity;
- `unattended` is set exactly when the Scenario is unattended;
- `configuredBy` constrains nothing structurally, because the value is the
  customer's;
- and every `state` condition in that grant equals the Step's `from` when the
  Step has one.

Structure — errors unless marked:

- `permits` on a Rule with a behavioural or Context target.
- A grant with none of `actors`, `related`, `self`, `unattended`,
  `configuredBy`; `unattended` or `self` other than `true`; `related: []`.
- `permits.actors`, a `related` endpoint, or a `self` target naming an Entity
  that does not `acts`; `configuredBy` naming a missing Entity.
- `related`, a defaulted `fact`, or a `state` condition on a Rule with other
  than exactly one Entity target.
- A `related` segment matching no relation, declared or inverse, from the
  current Entity; matching more than one; or passing through a self-relation.
- A grant whose `actors` excludes the type its `related` path ends on — it can
  never be satisfied.
- `when` not a list; a condition with no operator or two; an operator outside
  the eight; a `fact` that does not resolve on the targeted Entity or on
  `entity`; a `state` that is not a state of the targeted Entity, on a
  `creates` target, or combined with `entity`.
- A condition `entity` that is not the acting Entity, lies off the `related`
  path, is not `singleton`, and is reached from the target by no to-one walk,
  or only through two relations joining one pair; an `entity` naming the
  target itself.
- An Entity target whose `id`, `from`, `to`, `facts` entry, or `contexts` place
  does not resolve; `from` on a `creates` or `reads` target; `to` on a
  `removes` or `reads` target.
- **Warning:** two permission Rules with identical target selectors.
- **Warning:** a target `from`, or a grant `state` condition, that every Step
  the target selects already satisfies.

Rules against Steps and Screens — errors:

- A Step performing an operation a Rule closes with `permits: []`, naming the
  Rule.
- A Step performing a governed operation whose actor has no possible grant in
  some Rule selecting it.
- A governed operation on a Step with no `actor` in an attended Scenario.
- An unattended Scenario performing a governed operation that no `unattended`
  grant permits.
- A Screen presenting an Entity whose `reads` are governed, where no Actor using
  the Screen's container has a possible grant.

A permission Rule that is a [Variation](#variations) alternative holds only
while selected, and `lint` cannot tell which alternative a Step runs under, so
it is exempt from both warnings above and from every check against Steps and
Screens; `verify` holds it.

**A fact-scoped read Rule** — an Entity target with `facts` whose `effect` is
`reads` or absent — is checked against Screen facts and Step facts, never
against Entity presence alone. A Screen is selected when its `entities` entry
for that Entity `shows` a governed fact, and the check above then runs on it; a
bare entry, one with no named facts, is never selected, which is why a model may
not write one for an Entity with named facts. A Step whose `entities`
entry cites a governed fact is selected like any other governed operation and
needs an actor with a possible grant. The rest is `verify`'s. A derivation is
prose plus `facts`; there is no machine-readable arithmetic.

### `.../screens/<id>.md` or `.../screens/<id>/screen.md`

A Screen is a meaningful user-visible view where product information or
capabilities are exposed. It is platform-neutral: it need not be a web page,
have a URL, fill a device display, or correspond to one implementation module.
The whole `screens/` collection is optional so non-visual products remain valid.

```markdown
---
entities:
  - { entity: catalog-product, shows: [Name, Price, Availability] }
  - { entity: cart, shows: [Item count] }
entryPoints:
  - customer-web: /products/:id
  - customer-mobile: acme-shop://products/:id
references:
  - kind: visual
    role: intent
    target: docs/ui/product-record.png
    title: Current visual reference
---

# Product record

Shows what a shopper needs to evaluate one product.

## Intent

Help a shopper decide whether to add the product to the cart.
```

**A Screen declares its information; its behavior is derived.** Its body is an
H1, lead description and optional `## Intent`. `## Information presented`, `##
Available actions` and `## View states` are invalid: information is in
`entities`, behavior in Steps, and conditions in Scenarios and Rules. Other H2
sections remain supporting content.

A Screen never authors `capabilities`. Its Capabilities are the distinct
Capabilities exercised by Steps placed exactly on that Screen, across both
Scenario kinds. A Capability Scenario's owner supplies its Step Capability;
a Journey Step names its own. A Screen needs at least one such Capability.
Each derived Capability
must be available in the containing Interface or Experience (every Experience
for a shared Screen). A Capability need not have a Screen: nonvisual behavior
and coverage gaps do not become contradictions when another Screen is modeled.

`entities` is optional. Each entry is a bare Entity id, only for an Entity with
no named facts, or `{ entity, shows?, collects? }`. Each present list is unique,
non-empty, and names that Entity's `## Information kept` facts. A structured
entry needs at least one list. `shows` means information disclosed by the
Product; `collects` means input supplied by the Actor. A prefilled editable
value can appear in both. A fact with input but no disclosure belongs only in
`collects`; read-permission checks apply only to `shows`. Collecting a value
never grants permission to read an existing value.

An Actor Step reading named facts on a Screen must name them in that Screen's
`shows`. A presence-only read (`facts: []`) requires a Screen entry; a bare
Actor mention is exempt. Product and condition Steps may consult facts that
are not on screen. Creates and changes describe the operation's initialized
or changed facts; they are not inferred from Screen input fields, because
operations may initialize defaults or run without any Screen.

`entryPoints` is optional; entry-point keys must name the Interface containing
the Screen. Scenario participation is derived from Scenario Step Contexts whose
place names the Screen; a Screen never authors Scenario ids.

Model-owned visuals expand the Screen and sit beside `screen.md`; generated
captures live under its `implementation/` directory. External or separately
maintained visuals attach as `kind: visual` References.

**A Screen is one working context: one selected subject, or one process in
progress.** Everything that works on the same subject or the same draft is that
one Screen — its tabs, sections, side panels, and the stages of a wizard alike —
so its `shows` and `collects` are the union of them. Whether those parts are
tabs or one long page, a wizard or one form, is design: a redesign may merge or
split them, and the model must not change when it does. Where order matters,
the Scenario Steps on that Screen carry it. **Screens never nest**: a Screen's
structural parent is the Interface or Experience whose folder holds it, and a
`screens/` directory under a Screen is a `lint` error.

A destination that establishes its own subject is its own Screen, placed once
at the Interface or Experience that holds the views it is opened from; opening
it over another view does not make that view its owner. Selection,
co-visibility, URLs, modal versus page, and component boundaries alone decide
nothing. A different drawing of the same information remains one Screen.

Confirmation is behavior on its host unless the confirmation establishes a
distinct working context; visual presentation is not the test. Preserving the
underlying view on close is a Scenario Outcome. A generic settings/category
selector is not itself a selected subject: each settings page it leads to with
its own subject is a Screen. A completion message, generated credential reveal
or read-only result is an Outcome on the process Screen, not a Screen.

The same view on another Interface is another Screen with the same name — a
counterpart, stated separately so a divergence stays visible.

**Places are authored; transitions are derived.** Screens are the places. A
transition is a place change between consecutive contextualized Steps on a
Scenario route; a transition no Scenario records is not a product commitment.
Entry points state where an Actor arrives from outside; they assert no
transition, and they are the only structural addition. Screens never author a
sitemap, menus, a transition graph, a `next`, a `parent`, or an `over`. UX
sitemaps may be external `doc` or `visual` references.

### `journeys/<id>.md` or `journeys/<id>/journey.md`

A Journey is an optional, coherent Actor goal whose successful
completion requires several Capabilities working together. It owns only its
high-level Goal and Success criterion. Concrete Capability selection, order,
branches, repetition, and failure belong to Journey Scenarios.

```markdown
---
actors: [shopper]
references:
  - kind: doc
    role: context
    target: docs/shopping.md
---

# Browse and buy

## Goal

A shopper wants to purchase a suitable product.

## Success criterion

A confirmed order exists for the selected product.
```

`actors` is a non-empty unique list of the Entities that `acts` and pursue the
goal, not every system that participates in its implementation. A Step in any
of its Scenarios that names an actor, performing or attributed, names one of
them. A Journey has no lead prose;
its first content after the H1 is an H2 section.

`## Goal` states the stable Actor intent. `## Success criterion` states how an
achieved attempt is recognized without prescribing one route. `references` is
optional. Consumers derive Domains and Interface/Experience contexts from
Journey Scenario Capability-bearing steps. A Journey has no `entryPoints`; concrete Product
routes remain on Interfaces, Experiences, and Screens.

A consumer that presents a Journey entry route starts with the first placed
`actor` Step of each achieved Journey Scenario, then resolves the entry points
of that Step's Experience, or of its Interface when the place is undivided or
the Experience declares none. This is derived navigation, not authored Journey
data.

Consumers derive the Journey's primary Capability set from achieved Scenarios
and mark Capabilities observed only in not-achieved Scenarios as failure-only.
These are coverage projections, not authored Journey meaning or proof that
mapping is exhaustive.

A Journey has no `availability`, Trigger, Steps, decisions, concrete Outcome,
authored Capability list, or authored Scenario list. At least one Journey
Scenario must name it with `result: achieved` and exercise at least two distinct
Capabilities. Every Journey Actor must appear in at least one achieved Scenario.
This is Journey acceptance coverage, not the source of its identity.

**A Journey exists when an achieved Journey Scenario carries its Actor through
two or more Capabilities toward one outcome.** The Product itself carries the
Actor across — a redirect such as into the editor of what was just created, a
required next Step, an emailed link to follow — where an Actor merely choosing
what to do next carries nobody. Returning the Actor to where they were already
going after signing in is not a hand-off, and neither is a continuation the
Product runs without the Actor, such as merging automatically once checks pass.
Neither is a hand-off to a different Actor, such as an invitation another person
follows: the Actor carried must be the same one. Every goal this test finds is a
Journey, and nothing else is: the test is structural, so it reads the same way
for a model mapped from code and one decided before any code exists. An
orchestration, shared state, or a cross-Interface hand-off is not required, and
a merely plausible sequence of independent Product actions is not a Journey. A
wizard is one Screen and says nothing about Journeys: the Scenario walking it is a Journey Scenario only where it crosses
Capabilities. The carrying Step belongs to the run that ends with it, so it
names the Capability that carries — `create-board` for the redirect into the
new board — and the next Capability is the first one the Actor then uses where
they were carried. A result or a pending decision shown where the Actor already
is carries nobody: drafted cards appearing in the editor the Actor is working
in are the drafting Capability's outcome, not a hand-off. Steps of other Actors
may sit between, but only the Journey Actor's Steps — performed, or attributed
to them — count toward its two Capabilities, and `lint` errors when they do
not. An emailed link carries only when the Journey Actor's own run sent it; a
message another Actor's run or the Product's schedule sends starts a new
visit, not a Journey. Returning from a thing created inline to the act already
in progress — creating a notebook while filing a note — is not a hand-off. Whether the repository implements the Journey is `verify`'s
finding. One achieved Journey Scenario is valid coverage. A goal with no
achieved multi-Capability path belongs to Capability behavior.

### `capabilities/<capability-id>/scenarios/<id>.md` or `<id>/capability-scenario.md`

A Capability Scenario is one concrete observable acceptance case for exactly
one Capability. It describes local ability behavior rather than an end-to-end
Journey goal.

```markdown
---
kind: validation
routes:
  web-shopper: Web shopper
  mobile-shopper: Mobile shopper
steps:
  - text: The shopper submits a cart containing an unavailable product
    kind: actor
    actor: shopper
    entities:
      - { entity: cart, effect: reads, facts: [Quantity chosen] }
      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }
    contexts:
      web-shopper:
        place: customer-web::storefront::product-record
      mobile-shopper:
        place: customer-mobile::storefront::product-record
  - text: The Product validates current stock
    kind: product
    entities:
      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }
    contexts:
      web-shopper:
        place: customer-web::storefront::product-record
      mobile-shopper:
        place: customer-mobile::storefront::product-record
  - text: The Product rejects checkout before charging payment
    kind: product
    actor: shopper
    entities: []
    contexts:
      web-shopper:
        place: customer-web::storefront::product-record
      mobile-shopper:
        place: customer-mobile::storefront::product-record
references:
  - kind: code
    role: implementation
    target: src/services/orders.ts#OrderService.submit
---

# Reject checkout with unavailable stock

## Trigger

A shopper submits a cart containing an unavailable product.

## Outcome

No order is created, the cart is retained, and the unavailable item is
identified.
```

`kind` must exist in `taxonomies.yaml`. The containing Capability directory
names the Scenario's one parent; no `capability` field is authored. `routes`
and `steps` are non-empty. Capability Scenario availability, Actors, Screens,
Experiences, and Interfaces are derived from its Step Contexts.

A Capability Scenario cannot declare `journey`, `result`, `actors`, or
`availability`. Business Rules own its Rule relations, so it does not duplicate
Rule IDs.

### Scenario sections

Both Scenario types have no lead prose and require non-empty `## Trigger` and
`## Outcome` sections. Both require structured frontmatter `routes` and `steps`
and cannot author a Markdown `## Steps` section. `## Edge cases` is an optional
non-empty bullet list whose items are also single-line.

Each Scenario route is one named supported traversal of Contexts through
an unchanged Scenario. `routes` maps a lowercase kebab-case route id to a
unique, non-empty, human-readable name. A route changes only where the same
Steps occur. If Trigger, ordered Step text, Step kind, responsible Actor,
Capability sequence, Decision behavior, Outcome, or Journey result changes,
author another Scenario instead.

Every Step is a mapping with required single-line `text`, `kind`, and
`entities`. `kind` is `actor`, `product`, or `condition`. Product-side behavior
uses `product`; a fact, state, prerequisite, or seam nobody performs uses
`condition`.

An `actor` Step requires exactly one `actor`, the id of an Entity that `acts`,
who performs it. A `product` or `condition` Step **may** carry `actor`, meaning
*the Actor this Step is attributable to* — the Product did it for them, or the
condition holds for them; `kind` says which. A Product Step with no `actor` is
the Product acting on its own. Every `actor` a Step names, of any kind, joins
the Scenario's derived Actor set and must be supported by the place the Step
occurs in. A Step at a place in a public context names the Actor who is not
signed in — someone accepting an invitation, or any role holder before signing
in, is that Actor until signed in — and a Step that ends a session, such as
signing out or deleting one's own account, stays where the session was, never
on the public page the person is sent to. A Business Rule reads a Step's actor
as *who did*, against a grant's *who may*; the Business Rule section defines a
possible grant.

**Support acting as a customer is still support.** While staff act in a
customer's account — logged in as them, or through access the customer grants
— the Steps they take name the support Entity as `actor`, at the customer's own
places, whose `actors` therefore include it; there is no Experience of its own
for it. Support entering and leaving the account is not a Capability: what
they do there is. The customer's consent is a setting of theirs, turned on and
off like any other, opposite verbs and all. Each Rule
whose operation support may perform there gains a grant for support,
conditioned on the customer's consent when the Product asks for it —
`{ actors: [support-agent], when: [{ entity: shopper, fact: Support access, is: On }] }`
reads the Shopper who owns the targeted Order — and a Rule support must never
pass, such as changing the customer's password, gains none. An activity entry
recorded meanwhile names the support Entity as who acted.

A Scenario needs at least one `actor` Step **or** an unattended trigger: a first
Step of `kind: condition` carrying `unattended: true`, for behavior with no
Actor to name — a schedule the Product owns, an expiry, a retry. An unattended
Scenario derives an empty Actor set, and no Step of it carries `actor`: its
permission is a Rule's `unattended` grant, not a person. `unattended` is valid
only on the first Step and only when its `kind` is `condition`.

Availability for a Capability whose behavior is unattended names the Contexts
where an Actor **observes the outcome**, never a synthetic Interface. A
Capability with only unattended Scenarios still requires at least one
availability Context.

**`entities` is required on every Step**, and a Step that touches nothing
writes `entities: []`. Silence is impossible; an omission is a claim that can
be reviewed, linted, and contradicted by code. The one thing a Step never
lists is the activity or audit entry a Business Rule records for it
([Entities](#entitiesidmd-or-entitiesidentitymd)). Each entry is
`{ entity, as, effect, from, to, facts, with }`:

```yaml
- text: The Reader moves the item from one collection to another
  kind: actor
  actor: reader
  entities:
    - { entity: collection, as: source, effect: changes, facts: [Item order] }
    - { entity: collection, as: target, effect: changes, facts: [Item order] }
    - { entity: item,                   effect: reads, facts: [] }

- text: The Product refunds the order
  kind: product
  actor: store-admin
  entities:
    - { entity: order,  effect: changes, from: Confirmed, to: Refunded, facts: [] }
    - { entity: refund, effect: creates, to: Requested, facts: [Amount, Reason] }
```

`effect` is `creates`, `changes`, `removes`, or `reads`, defaulting to
`changes`. State keys are explicit and never inferred from an adjacent Step:

| effect | keys | required |
| --- | --- | --- |
| `creates` | `to` | when the Entity declares states |
| `changes` | `from` + `to`, or neither | both or neither — never one |
| `removes` | `from` | when the Entity declares states |
| `reads` | — | never carries state |

`changes` with neither key is an information change — the rename case. Every
`from` and `to` names a state the Entity declares. **There is no wildcard
`from`**: *archive from any state* is one Scenario per origin state, because an
origin the author did not write is an inference.

**A Step changes as many Entities as it changes.** One observable act can move
two things at once — a transfer debits one account and credits the other — and
stays one Step. An `(entity, as)` pair appears at most once in one Step's list.

**`as` is a scenario-local instance alias**, optional, lowercase kebab-case, its
id its own label. Entries without one are a single unnamed instance. Once an
Entity is aliased anywhere in a Scenario, every mention of it in that Scenario
is aliased: a bare `collection` beside a `collection (source)` is an error, not
a third instance.

**`with` says a creation or removal goes with another.** A `creates` or
`removes` entry may carry `with`, naming another entry of the same Step and the
same effect — by its `as` when it has one, otherwise by its `entity` — that it
is created or removed because of:

```yaml
- text: The Teammate deletes the card and every comment on it
  kind: actor
  actor: teammate
  entities:
    - { entity: card,    effect: removes, from: Active }
    - { entity: comment, effect: removes, with: card }

- text: The Teammate creates a board by naming it and becomes its first admin
  kind: actor
  actor: teammate
  entities:
    - { entity: board,            effect: creates, facts: [Name] }
    - { entity: board-membership, effect: creates, facts: [Role], with: board }
```

**It goes `with` the Entity that holds it:** the Entity it names must
declare a `one-to-many` or `one-to-one` relation to the dependent's Entity, so
the direction is read from the relation's declared side. A Card that declares
`one-to-many` Comments lets `comment` go `with: card`; `card` going `with:
comment` is an error, because Comment declares nothing to Card, and a
`many-to-many` relation holds nothing. Two entries of the same Entity need that
Entity to declare such a relation to itself. A `with` chain never returns to
where it started; `lint` errors otherwise, and on `with` outside a `creates`
or `removes` entry or naming no entry of the Step with the same effect. Within one Step every entry's
reference — its `as`, otherwise its `entity` — is unique, so a `with` names
exactly one entry. **The
creation or removal it goes with is what needs permission:** a permission Rule
on the dependent Entity's `creates` or `removes` never selects a `with` entry,
so *only its author deletes a comment* and *a member deletes a card, comments
and all* hold together, and so do *only a board's admins add members* and *any
Teammate creates a board, becoming its first admin* — the first membership
needs no grant of its own, and none may be written to admit it. A thing
created only because another is goes in the same Step as that creation. A Step
that creates or removes two Entities where one holds the other, with no `with`
on either, is a `lint` warning: the held one almost always goes because of the
other.

**Steps chain, per instance.** Where a prior Step in the same Scenario left an
`(entity, as)` pair in a state, this Step's `from` for that pair must equal it.
The message names the way out: *if these are different collections, give them
aliases.*

**A read is a bare mention.** `reads` carries no state, is never counted as a
change, and never saves an Entity from being an orphan.

**`facts` is required on `reads`, `changes` and `creates`.** It is the
exhaustive unique list of named Product facts read, changed or initialized by
that operation, including product-defined defaults on creation. Every name
resolves to the Entity's `## Information kept`. `[]` explicitly claims no
named facts (for example, an existence check or state-only move); it never
means unspecified or all facts. Internal storage fields and incidental logging
are not Product facts. `removes` carries no authored `facts`: it removes the
whole Entity; clearing one fact is a change. Verification checks that every
named Product fact affected is listed. A Scenario's Entity set is derived from
its Steps, as its Actor set is.

**A Step whose `text` names a known Entity title and declares it nowhere** is a
`lint` error. The Step's own `actor` is exempt, and so is the phrase *"the
Product"*, which every Product Step opens with by convention. A title inside a
longer title the Step declares is covered by it: with `product-model` declared,
*Product Model* in the text says nothing about an Entity titled *Product*.

A Step may author `contexts`, mapping every declared route id to exactly one
strict Context whose place follows [Contexts and places](#contexts-and-places).
A Step either maps every route or omits `contexts` completely when it is shared
by all routes and has no specific Context. Every route must have a Context on
at least one Step, and two routes cannot repeat the same place sequence. A place
change between consecutive contextualized Steps is an explicit transition,
including Screen-to-Screen movement inside one Experience. Conditions such as
empty, unauthorized or blocked are `condition` Steps and Rule outcomes, and
appear as the Scenario branch that meets them.

`## Decision points` is optional. Each decision uses an H3 title, a non-empty
question paragraph, then at least two bullet branches. Each branch uses
`condition → outcome` with the Unicode arrow or `condition -> outcome` with
ASCII characters. Its branches stay within and converge on that Scenario's one
observable outcome. A branch with a materially different outcome belongs in a
separate Scenario of the same type. Decision points remain embedded rather than
becoming standalone resources.

### `journeys/<journey-id>/scenarios/<id>.md` or `<id>/journey-scenario.md`

A Journey Scenario is one concrete end-to-end variation of exactly one Journey.
It begins with the Journey Actor's Goal and ends with that goal achieved or not
achieved. It verifies Capability composition and Context transitions
rather than replacing local Capability Scenarios.

```markdown
---
kind: primary
result: achieved
routes:
  web-shopper: Web shopper
  mobile-shopper: Mobile shopper
steps:
  - text: The shopper finds an available product in the catalog
    kind: actor
    actor: shopper
    capability: browse-catalog
    entities:
      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }
    contexts:
      web-shopper:
        place: customer-web::storefront::product-record
      mobile-shopper:
        place: customer-mobile::storefront::product-record
  - text: The shopper adds the product to the cart and submits checkout
    kind: actor
    actor: shopper
    capability: checkout
    entities:
      - { entity: cart, effect: changes, facts: [Quantity chosen] }
    contexts:
      web-shopper:
        place: customer-web::storefront::product-record
      mobile-shopper:
        place: customer-mobile::storefront::product-record
  - text: The Product validates stock and charges payment
    kind: product
    entities:
      - { entity: catalog-product, effect: reads, facts: [Name and description, Price, Stock remaining] }
  - text: The Product persists and confirms the order
    kind: product
    actor: shopper
    capability: checkout
    entities:
      - { entity: order, effect: creates, to: Confirmed, facts: [Items ordered, Total charged] }
      - { entity: cart, effect: removes }
references:
  - kind: code
    role: implementation
    target: src/services/orders.ts#OrderService.submit
---

# Browse and complete checkout

## Trigger

The shopper wants to find and purchase an available product.

## Decision points

### Fulfillment path

Does the cart contain physical items?

- physical items → collect a delivery address before payment
- digital only → continue to payment without delivery details

## Outcome

Order is stored and a confirmation is shown.

## Edge cases

- Receipt delivery unavailable → order remains confirmed and the receipt is available in the account
```

`kind` must exist in `taxonomies.yaml`. The containing Journey directory names
the Scenario's one parent; no `journey` field is authored. `result` is
`achieved` or `not-achieved`. `kind` classifies the nature
of the variation while `result` records its terminal Journey-goal outcome; they
are orthogonal. `routes` and `steps` are non-empty. At least one Step must name
an Actor from the Journey, performing or attributed. Each route's first
Actor-owned placed Step must name a Journey Actor supported by that Context.
Other Steps may name other Actors — a store admin cancelling inside a shopper's
Journey — because `actors` on a Journey says who pursues the goal, not every
participant.

A Journey Step may name exactly one existing `capability`, independently of its
Step kind. **A Journey Step whose `entities` carries a `creates`, `changes` or
`removes` effect must name one**: a change no Capability owns has nothing to
label its arc with. A Step that only `reads` needs none. A capability-bearing
Context must be contained by an availability
Context declared by that Capability; a Screen place must additionally expose
it. A Journey Step without a Capability can still name Contexts when an observable condition or
Product behavior occurs somewhere without claiming another Capability.

The Journey Scenario owns the complete ordered path. Capability-bearing steps
may repeat or stop; unqualified steps make conditions, transitions, and
Product-side behavior first-class without claiming another Capability. An
achieved Journey Scenario must use at least two distinct Capabilities. A
not-achieved Journey Scenario may stop after one Capability, but its Outcome
must state the Journey-level reason the goal was not achieved.

Steps reference Capabilities, never Capability Scenarios, so refining local
behavior never rewrites a Journey path. A local permission, validation,
conflict, or failure contract remains a separate Capability Scenario when it is
independently observable; the Journey Scenario states its own end-to-end
consequence for the Goal.

The path is linear. A Decision point may vary detail while preserving the same
Steps and terminal Outcome. A branch that changes either belongs in another
Journey Scenario. Add a named route when only Context places change. Split
Journey Scenarios when the Step sequence, Actor responsibility, Capability
sequence, observable behavior, or Journey-level Outcome changes. Journey
Scenarios cannot declare `actors` or `availability`. Business Rules own Scenario
applicability, so Journey Scenarios do not duplicate Rule IDs.

### `variations/<id>.md` or `variations/<id>/variation.md`

A named set of supported alternatives of one resource type. Frontmatter:
required `kind`, `of`, `takesEffect`, `stability` and `alternatives`, plus the
subtype's set fields; each `alternatives` entry is `{ id, selectedWhen, label? }`.
Body: H1 title and a lead saying why the alternatives coexist; optional
`## Intent`. The full contract, including every `lint` rule, is in
[Variations](#variations). A Variation has no Domain: its alternatives keep
theirs.

### `coverage.md`

**Coverage records which of the repository's code the model accounts for**, at
the highest level that still guides an agent: which code areas the model
describes, which are deliberately not product behavior, which hold behavior the
model does not describe yet, and where behavior could not be established. It is
about code and nothing else. What the Product is or is not belongs in
`product.md` — its description, Intent and limitations — and never here.

```markdown
---
scope: The storefront and order services.
method: Static inspection of source and supporting documentation.
covered:
  - description: Checkout and order tracking code.
    paths: [src/checkout/, src/orders/]
exclusions:
  - description: The design system and email templates.
    paths: [src/ui/, emails/]
unmapped:
  - description: Background fulfillment jobs.
    paths: [server/jobs/]
limitations:
  - description: Delivery retries, whose policy lives in runtime configuration.
    paths: [src/orders/retry.ts]
---

# Coverage
```

Every key is required and unknown keys are errors. The body is only
`# Coverage`; `coverage.json` is not accepted.

- `scope` — the breadth of code the model accounts for: single-line Markdown,
  non-empty whenever any list has an entry and `""` when none does.
- `method` — one short single-line note on how the code was inspected, or `""`;
  always `""` when no list has an entry.
- `covered` — code areas whose product behavior the model describes.
- `exclusions` — code deliberately outside the model because it is not product
  behavior: presentation layers, packaging, plugin manifests, tooling. An
  oversight or unfinished inspection never becomes an exclusion without
  approval.
- `unmapped` — code holding product behavior the model does not describe yet.
- `limitations` — code whose behavior could not be established. Missing
  behavior belongs in `unmapped`, and not executing code belongs in `method`.

Each entry is exactly `description` and `paths`, and **every entry names its
code**: `paths` is non-empty, at folder level wherever a folder is the area and
a single file only when that file is the area. Coverage never maps file by
file; the model's resources and their References carry the detail.
Descriptions name the code area, not product features — "Checkout and order
tracking code", not "Shoppers can track orders" — as non-empty single-line
Markdown without an H1 or H2, unique across all four lists. Paths are unique
repository-relative POSIX paths, directories ending in `/`. Absolute paths,
URLs, backslashes, `*` and `?` wildcards, `.` or `..` segments, empty segments,
surrounding whitespace, control characters, and fragment or line suffixes are
invalid; brackets and braces are ordinary file-name characters, as in
`pages/[id].vue`. A missing workspace path is not an error.

**A model tied to no code yet has empty coverage**: all four lists empty, and
`scope` and `method` then `""` — a scope or method with no entry is an error,
so an empty model has one spelling, and the first entry written brings its
`scope` with it. That is every Blueprint and every model
decided before its code exists. Coverage is written by mapping — mapping an
established repository, or verification mapping behavior it found the model
missing — and never by deciding intended behavior, so a model designed and then
implemented keeps empty coverage until something maps its code. Empty coverage
claims nothing; it means only that no mapping has recorded which code the model
accounts for.

```markdown
---
scope: ""
method: ""
covered: []
exclusions: []
unmapped: []
limitations: []
---

# Coverage
```

Coverage has no status. An empty `unmapped` list means only that no gaps are
recorded, and known gaps never relax the structural requirements: every model
has at least one Capability, every Capability availability Context is selected
by at least one Capability Scenario, and every Journey Actor appears in at least
one achieved Journey Scenario. Coverage, References and silence never establish
file-level completeness or implementation alignment.

A model may describe planned, implemented or mixed behavior, contain zero
References, and be exported with known gaps. Proposing it as a Blueprint is a
separate, explicit action; merging that proposal is the maintainer's decision.

## Serialization

`build/` and `cache/` hold generated artifacts, and the Product Report that
`blueprint export` writes into them is defined by [`report.md`](./report.md) —
including the portable projection, the validation the report schema applies on
top of the rules above, and the `open`/`pull` expansion round trip.
