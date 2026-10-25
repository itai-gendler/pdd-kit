# Rejected and Deferred

> **This is engineering documentation, not a docs-site page, and not a
> contract.** [`format.md`](./format.md) and [`report.md`](./report.md) say what
> must be true. This file says what was considered and chosen against, so the
> next reader does not spend the same argument twice.

**What belongs here:** a shape that was designed far enough to be costed, and
then rejected or deferred, with the reason it lost. Nothing else. No plans, no
status, no work item, no file or line reference — those go stale, and a stale
record is worse than no record.

**How it changes:** decisions are appended. Reopening one means adding an entry
that supersedes the old one and says why the reason no longer holds; it never
means editing the old entry into agreement. Entries may be filed under the right
heading, merged when they record one argument, or trimmed to the costed shape.
Consult it before proposing a change to either contract.

## The model as a whole

**Tags, labels, or free-form key/value metadata.** Nothing could consume it — a
facet is only ever an id array the projection already holds, so filtering on a
key/value pair would need a second, non-relational facet path built first.
`lint` could only ever say "unknown key". And unvalidated per-model vocabulary
defeats a catalog whose whole value is that models are comparable. Grouping that
is not subject matter — team ownership, compliance scope, maturity — stays in
whatever system already tracks it. If real pressure appears, the answer is a
modelled field a checker can speak about, not a generic bag.

**A glossary resource type.** Vocabulary a model uses and never defines is
modelling debt. A glossary would compete with the resource type that should own
the term: `cart` appeared fifteen times in the fixture and was nothing, so it
became an Entity.

**A reference kind for a schema.** An ERD is `kind: visual`, a schema document
`kind: spec`, a migration `kind: code` — each with `role: implementation`, which
already says *realization, not meaning*. A dedicated kind would invite treating
the schema as the authority for what the Product keeps.

**A `lint` warning on undefined vocabulary** — words a model's prose keeps using
that match no Entity id. Built, measured, abandoned for noise: narrowed to
Screen `## Information presented` bullets and Scenario Step text, the top hits
were still verbs and generics. A warning authors learn to ignore is worse than
no warning. What shipped instead is the narrow form — a Step whose text names a
known Entity **title** it does not declare — and the check itself carries the
reasoning.

**Silencing a naming warning instead of declaring a verb** — a per-resource
`<!-- pdd-lint-disable naming -->` comment, or an `--allow-verb` flag. The
comment hides genuine noun phrases one file at a time, and the flag leaves the
vocabulary behind when the model moves, so the same Blueprint lints differently
in another repository. What shipped is `lint.verbs` in `config.yaml`: lint input,
never product meaning, carried through the report so it travels with the model.
It only adds words, and a word the defaults already know is a warning. This does
not reopen per-model vocabulary in general: a verb a product needs often enough
belongs in the defaults instead, as `undo` and `redo` did.

## Entities and their lifecycle

**Two collections, `actors/` beside `entities/`.** Fails on one question: what
happens when a thing starts acting? A payroll Employee who gains a login would
change file, id namespace, and every reference — the wrong cost for one product
fact. The objection that a payment gateway would then be an Entity with nothing
kept about it was against a definition the format does not have: an Entity is
what the Product keeps *or reasons about*.

**`kind` optional under `acts`.** An Entity that acts without saying whether it
is a person or a system is a regression from the Actor it replaced, and the
report's facet would have nothing to group it by.

**An `operations` table on the Entity**, enumerating every Capability that may
create, change, remove, or read it, deny by default. It is the deleted
Capability `entities` list moved to the other side and enriched: it restates
what Steps already say, and its gate catches only internal inconsistency. A Step
claiming a false `creates` is a *truth* error, which is `verify`'s domain
against source, not `lint`'s against the model.

**`transitions` declared on the Entity.** It stated a second time what a Step
states, and a per-Entity list cannot express a combined lifecycle — *settling a
payment confirms an Order and creates a Shipment* is one act on two things,
which only a Step can say.

**Deriving an arc's origin from Step order**, and **a wildcard `from`** for
*archive from any state*. Both are inference from a neighbour, which is exactly
the implicit reading explicit state keys exist to remove, and the composition
findings would have nothing to check the arc against.

**A bare mention after an alias**, letting `collection` beside
`collection (source)` mean a third, unnamed instance. It is the silent reading
aliases exist to remove, and the explicit spelling costs one word.

**Making an unreached state an error for a model that claims complete coverage.** Proposed to pull
two independent authors back together on coverage. Surfacing what the composed
machine is missing is the honest version; coercing coverage is not.

**An activity entry created on every audited Step.** Complete, and the only
encoding the composed lifecycle could check, but it repeats one fact on every
Step that changes an audited thing, and a model that skips it still lints clean.
One Rule naming the recorded operations says it once, and `verify` holds the
code to it. **Not modelling a log the Product shows its users** fails the other
way: an administrator points at *this entry*, so it passes the Entity test.

**A `singleton` inferred from structure** — an Entity no Step creates, or one
nothing relates to. Settings a setup Step creates would be refused, and a
Catalog product whose instances pre-exist would pass. One explicit key is
cheaper than a guess `lint` would sometimes get wrong.

## Business Rules and permission

**`permits: []` as an error**, on the ground that a lifecycle without the
operation already says nobody may. Reversed once the lifecycle became composed
from Steps: an absent arc is silence, and silence must not read as prohibition.

**OR across Rules.** Adding a Rule could then only widen, and a broad Rule would
silently loosen a narrow one. Under AND, adding a Rule can only restrict, and
the split-grant trap that creates is caught by the identical-selector warning.

**Forbidding overlap between permission Rules**, one place per operation. A
broad Rule and a narrow one composing is the ordinary case, not the mistake.

**Verb-only `related` paths.** `related: [owns]` reads well and fails where a
Workspace and a Folder both *contain* Documents. Resolving that by renaming a
verb serves `lint` at the expense of the product's own words.

**Implicit AND/OR** — `actors` and `related` OR-ing while `when` AND-ed, with
the rule stated only in prose. Unknowable from the file.

**A `when`-only grant**, meaning *anyone, when*. *Anyone* already has an
encoding, and a grant with no who is indistinguishable from a forgotten one.

**A single-mapping `when`**, one condition per grant. The list is one shape for
every count, and it matches *keys within a grant are AND*.

**`over`/`under` as the only operators.** The off-by-one argument holds for
integers; facts are untyped, and `over: 99.99` is the wrong rule for money and
for time.

**`permits` on a Capability target.** An operation is an Entity effect,
Interface `actors` already records who uses a surface, and the Step check would
duplicate the Entity one.

**Current state only in `when.state`, with no `from` on the target.** Could not
say *a Refunded order is never cancelled*: a prohibition has no grant to carry a
`when`, so the only spelling enumerated every other state and every actor that
stays allowed, turning one narrow claim into a policy for the whole operation.

**`when.state` on `reads` targets only.** Could not say *edit delivery details
only while Pending*: an information change is `changes` with neither `from` nor
`to`, so it carries no state to select by, exactly like a read.

**`from` alone on an information-change Step.** It pushes the claim onto every
such Step, and a Step that omits it silently escapes the Rule.

**Typed facts.** The operator carries the comparison, so thresholds stay
checkable without the Entity becoming a schema.

**Rule-level `when`, `asserts`, and `derives` — deferred, not rejected.** A
structured derivation needs defined behaviour for types, units, money, rounding,
collections, missing values, and time, and that is not added casually. If it
comes, `appliesTo.facts` identifies the result and the derivation names its
inputs without repeating the target.

**Off-path conditions read only a settings Entity.** The first reading of a
condition `entity` off the `related` path: one instance, the Product's
settings, with no way to say so. It gave no meaning to *the Quiz this Question
is in*, *the Owner of this Habit*, a Workspace's plan or a customer's consent to
support access, which shipped models already wrote, and it could not be
checked. Superseded by reading the instance the target reaches through to-one
relations, with `singleton` marking the settings case.

**Two equally short to-one walks as a `lint` error.** A suggestion's Habit and
its Reflection each have one Owner, and it is the same Owner. Refusing the
diamond leaves an `unattended` grant, which cannot walk `related`, with no way
out; the model's claim that the walks meet is `verify`'s to check. The claim
does not stretch to two relations joining one pair: an Account that sends and
receives Transfers is two Accounts by construction, so that walk is refused
rather than trusted. **A condition naming the relation verbs it walks** would
let it say which; it was not added, because no shipped model needs it and
`related` already names verbs where an Actor ends the path.

**A plan or flag gate carried only by the gated resource's lead.** Refunds that
exist only on paid plans are also *nobody may refund on a free plan*, and only
the grant form lets `lint` check every Step. Kept only where no grant can carry
it: a read-only feature, or an operation ungated behaviour also performs.

**An "on behalf of" qualifier on a Step, or the customer as the actor while
support acts for them.** The qualifier gives `lint` nothing it could check that
the support Actor plus a consent condition on its grants does not already, and
naming the customer hides exactly what a support-access policy is about. A
support Experience duplicating the customer's Screens was rejected with them:
Experiences divide by audience and access, and impersonation is neither.

## The Product Report

**A provenance field.** `derivedFrom: implementation | intent | mixed`, carried
through the portable projection so a catalog reader could tell a Blueprint
mapped from a working product from one authored as intent. Neutrality is the
product decision, not an omission: such a field becomes a ranking signal —
"battle-tested" against "merely designed" — and a design mapped from a mediocre
shipped product is not better than a well-reasoned one nobody has built.
Stripping every `kind: code` reference and every repository-relative target is
therefore the point rather than a lossy compromise.

## Interfaces, Experiences and Screens

**Authored transitions beside Scenario Steps.** A separate `next` or transition
list would repeat movement already expressed by consecutive contextualized
Steps. Entry points and always-reachable destinations state different facts.

**Visual layout fields on Screens.** Layout, styling and presentation belong
in visual References. The model records displayed facts, collected inputs and
behavior independently of those designs. Contractual wording remains an
explicit Rule with an authoritative Reference and is verified when required.

**A bare Entity id meaning all facts.** Bare Screen entries mean only presence
of an Entity without named facts. Named facts use explicit shows/collects lists.

**Authored Screen capabilities beside placed Steps.** The current contract
requires supporting behavior, so the list has no valid independent meaning.
Derive it from placed Steps instead; missing behavior belongs in Coverage.

**Counterpart inheritance for twin Screens — deferred.** Separate authored
information makes divergence visible. A shared declaration needs a precise
rule for overrides before it could replace that property.

**A dedicated messages collection — deferred.** Ordinary notifications can be
Product Steps. When messages are things the Product schedules, sends, retries
or revokes, model them with ordinary Entities and Capabilities. There is no
claim that messages cannot have behavior or a lifecycle.

**A Capability only in the most open Experience that admits its Actors.**
Placing page reading once in a public Experience avoids counterpart Screens,
but makes "public" also mean "where signed-in Users read". A Capability is
available in every Experience in which one of its Actors uses it instead.

**`restricted` as any area only some signed-in roles may enter.** Superseded.
Pages closed to guests and pages only administrators open both qualified, and
two independent maps of one product cut different restricted Experiences.
`restricted` is the administration area alone; other pages stay
`authenticated`, with grants saying who may act.

**Nested Screens for tabs and wizard stages.** Superseded. A child Screen per tab
of one subject or per stage of one wizard made the model change when a redesign
turned tabs into one long page or a wizard into one form — a layout decision
the model must survive. One working context is one Screen; the order of stages
lives in its Scenario Steps.

**`navigation` on Interfaces and Experiences.** Superseded. Listing the Screens
reachable from everywhere recorded menu structure, which a redesign may change,
and `lint` could only check that each entry resolved. What an Actor reaches is
already said by entry points, Screens and Scenario Steps.

## Capabilities

**A setting-driven Product side effect as a Capability of its own.** Moving
group sync into its own Capability keeps its setting from crossing sign-in's,
but creates Capabilities the split test would not make, only to host a
Variation.

**A reversible pair as one Capability.** Folding publish and unpublish, or
enable and disable, into one toggle Capability reads naturally, but fifteen
Blueprints authored in parallel folded some pairs and split others, and both
linted clean. The verb each control shows decides it the same way every time;
the cost is a few more Capabilities.

**Changing one's own submission as a Capability of its own.** Changing a vote
or an RSVP goes through the control that made it, under the same grant, so a
separate Capability would split on nothing the split test names.

## Journeys

**Naming a carrying Step after the destination Capability.** Parallel authors
named the redirect after the creating Capability, after the destination, or
after nothing, and all three linted clean. The redirect ends the creating run,
so it names that Capability.

**A Journey carried by a different Actor's Step.** An invitation another
person follows, or an AI agent's proposal a person then accepts, joins two
Capabilities in sequence but carries nobody: the goal changes hands.

**A role condition read from the thing being changed.** When an admin changes a
member's role, reading Role from the targeted membership grants by the victim's
role, not the actor's. A condition on a path Entity reads the instance the path
reaches; a condition on the target names no Entity.

**Granting a cascade through the container.** Deleting a card removes other
people's comments, and a grant wide enough to admit that cascade also admits
removing any one of them directly; no condition tells the two apart. A
`removes` entry says `with` what it goes instead, and only the removal it goes
with needs permission. **Granting a container's first membership** failed the
same way from the other side: a grant admitting the creator's own Owner
membership — the holder of a new membership, or anyone while a member count is
zero — also admits making oneself Owner elsewhere, or needs a fact that exists
only to say *being created*. A `creates` entry goes `with` the container instead.

**`with` accepted in either direction of a relation.** `comment with card` and
`card with comment` both linted clean, and the second let a card's removal
escape every Rule on removing cards, a prohibition included. The removal goes
with the Entity that declares the holding relation, so one cascade has one
encoding.

## AI

**A built-in AI assistant as an Entity that acts.** It reads like a
collaborator, and authors modelled it so, but it is the Product's own component
calling a model: it keeps no inbound contract and its privileges are
authorization, not product meaning. Its work is a Product Step; only a harness
the person brings acts.

**An AI draft always as its own Entity, or always as a State.** Either rule is
simpler, but each mis-models half the cases: a drafted question is the question
it becomes, while a filing suggestion keeps a reason no bookmark has.

## Coverage

**Coverage as the model's breadth, with optional paths.** Superseded. One file
said both what the model left out of the product — "accounts are not modelled"
— and which code it was derived from, so a Blueprint carried product scope that
belonged in its limitations, a pulled Blueprint carried prose about another
repository's code, and a model designed before its code showed an empty file
tree. Coverage now records only which code the model accounts for, every entry
names its paths, and a model tied to no code has none.

**Mapping coverage file by file.** Tried and reverted: the file outgrew its
reader, drifted with every move, and repeated what resources and their
References already locate. Coverage stays at the highest level that still tells
an agent where to look and what to ignore.

**Recording coverage paths after verification aligns an implemented area.**
Every flow would converge on located coverage, but verification would start
writing model metadata after each run, and the detail invites the file-by-file
mapping already reverted. Coverage is written by mapping only.

## Domains

**Domains cut by "the thing the Actor works on".** Two independent maps of one
product cut the same Capabilities into three Domains and into seven, both
following the wording. The Product's own sections are found the same way by
two readers.

**Domains only when an author asks, or only as a derived report grouping.**
A model that never proposes Domains stays ungrouped, and a report-only grouping
cannot be reviewed or edited as a file.

## Variation

**Member-side Variation keys.** An anchor member carrying the kind and others
pointing at it spread one product choice across several files with no name of
its own; the set is its own resource instead.

**A designated anchor or default member.** It made deleting one alternative
mean something different from deleting another, and read as a default the
model never claimed. A default belongs in an alternative's `selectedWhen`.

**Usage repeated on every alternative.** It copied timing and stability onto
each member and let a fact that only tunes one alternative sit among the
settings that choose. Each selection field has exactly one level.

**Free-form applicability prose as the only encoding.** A When used section
would duplicate the typed selection fields.

**Historical version archives and version-driven containment — deferred.**
Older contracts still used by current clients or records are supported
behavior and a Version Variation, not history. Addresses and headers alone do
not determine resource boundaries.

**A general experiment/configuration engine — deferred.** Variations state
Product meaning and applicability; they do not run allocations, combine flags,
negotiate versions or persist results. Permission grants cannot stand in for
selecting whole resources.

**Cohorts as a dedicated resource type — deferred.** Actor or tenant facts
record membership; experiment-management Products model assignment and
measurement with ordinary Entities, Capabilities and Scenarios.

**Steps as Variation alternatives.** Varying a Step needs Step ids, a way to
say which Step replaces which in an ordered list, and route rules across the
swap: a patch language inside Scenarios. Two Scenarios of one owner say the same
with no new mechanism.

**A Scenario in more than one Variation, or a Variation per setting shaping
one Scenario.** Two settings on one run — a captcha and a provider password on
registration — would each select Scenario alternatives; enumerating their
combinations multiplies Scenarios with every setting, and choosing the setting
that "most changes" the Steps is a judgment. Each is a decision point instead.

**A structured `enabledBy` field for switched-on behavior.** Naming the setting
that enables a Capability as a fact reference would let `lint` resolve it, but
deployment settings have no Entity to reference, and the grant-less Business
Rule already carries the same claim for `verify`.

**A grant-less Business Rule saying a resource exists only while enabled.**
Superseded. It targeted one resource, which `lint` itself warns belongs to that
resource; the resource's lead names the dependency instead, and `verify` checks
it.

**One Capability per sign-in method a deployment selects.** Superseded. The
methods share verb, permission and availability, so the split test makes them
one Capability; the Variation rules decide whether they are Scenario
alternatives, separate Scenarios or decision points.
