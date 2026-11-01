---
entities:
  - { entity: product-model, shows: [Product] }
  - { entity: product, shows: [Identity, Publishing metadata, Limitations] }
  - { entity: interface, shows: [Type, Variation, Actors, Entry points, Languages] }
  - { entity: experience, shows: [Container, Variation, Audience, Entry points] }
  - { entity: screen, shows: [Container, Variation, Exposure, Presents, Addresses] }
  - { entity: domain, shows: [Region, Boundary, Colour] }
  - { entity: entity, shows: [Kind, Variation, Relations, States, Kept information, Acts] }
  - { entity: capability, shows: [Domain, Variation, Availability, Purpose] }
  - { entity: capability-scenario, shows: [Classification, Routes and Contexts, Trigger and outcome, Steps] }
  - { entity: journey, shows: [Actors, Variation, Goal, Success criterion] }
  - { entity: journey-scenario, shows: [Classification, Routes and Contexts, Result, Trigger and outcome, Steps] }
  - { entity: business-rule, shows: [Reach, Assertion, Variation, Permission, Rationale] }
  - { entity: variation, shows: [Member type, Subtype, Alternatives, Choice, Selection, Takes effect, Stability] }
entryPoints:
  - local-report-web: /?s=capability&e=capability:lint-product-model
references:
  - kind: code
    role: implementation
    target: layers/nuxt/report-viewer/app/components/ReportResourcePage.vue
  - kind: code
    role: implementation
    target: layers/nuxt/report-viewer/app/components/ReportVariationAlternatives.vue
---

# Resource reading

One resource's complete reading, opened over the current working view. Its
title and type are stated once above the reading, with actual ownership shown
separately from the trail through previously inspected resources, the first
related Domain on the header line and a way to reveal the rest. Opening a
related resource preserves the underlying collection or comparison, its
filters, drawing, expansion and viewport. The resource and its selected reading
have their own address, which survives refresh and valid recompilation. Back
restores the previous resource and its reading position; Close returns to the
working view. A fresh resource address opens over its owning collection when it
names no working view. A resource with a single reading shows no tab strip.
From the heading row the Developer opens a named view of another subject
focused on this resource, opens the link in another browser tab, or searches
the whole model by name. Every comparison across resources belongs to the
owning collection.

## Readings

### Overview

The resource's authored meaning: its identifying facts, its description,
Intent and supporting sections, its Contexts where the type carries them, and
the contextual links that sit beside the facts they explain. For an Entity that
includes its named facts with the Rules that govern each; for a Business Rule,
who may perform each operation it governs, as sentences. Every link opens that
resource's reading.

A Variation's Overview says once how one alternative is chosen: what chooses,
when the choice takes effect and how long it holds. An alternative's Overview
says only how it is chosen — what chooses and its own condition — and names its
set on the title, whose pill opens a switcher between the alternatives. Also on
remains a separate contextual relation.

### Changes

While the report compares the model with an earlier version, a resource that
changed — itself or one of its Scenarios — reads what changed, field by field,
before and after, with a Scenario's Steps lined up against their earlier
version. The reading follows Overview and is offered only for a changed
resource.

### Scenarios

A Capability's or Journey's Scenarios, one selected at a time, with its Steps,
routes, Context places, and what each Step does to the Product's things. The
Developer compares a Scenario's named routes side by side. The selected
Scenario and route stay in the address.

### Lifecycle

An Entity's composed state machine: its states, the arcs every Step that
creates, moves or removes it draws, the Capability on each arc, the Rules that
restrict or forbid it, and what leaves a thing in each state. Rows and Graph
draw the same machine. Selecting an arc reads its Rules and supporting
Scenarios; selecting a state reads its definition and the Scenarios that leave
it there.

### Alternatives

A Variation's alternatives, each read in its own words: its statement or
description, its Version label, and the condition that selects it, in stable
title order. Alternatives under different owners each say where they sit;
membership moves nothing. Selecting an alternative opens its own reading, and
Back returns here with the reading position kept. The reading exists only for a
Variation.

### Delivery

A place's own branch of the Interfaces tree, as the same expandable tree the
Interfaces collection draws: a Screen's own Capabilities, each holding the
Scenarios with a Step for it placed exactly there; an Interface's Experiences
and Screens, or an Experience's own Screens and the shared Screens it reaches.
An Experience or Interface lists a Capability of its own only as a gap, or,
with no Screens, as delivered directly. Each place reads its own; nothing is
summed. Chevrons expand and
collapse, every item opens its complete reading, a Capability's Scenarios start
folded, and expansion is retained across reading changes, related-resource
lookups, refresh and valid recompilation.

### Connections

The resource's complete relationship list, grouped by direction and
relationship, including links that also appear in Overview. It is offered only
when relationships exist, and each target opens its own reading. Selecting
Connections while reading a Scenario opens its parent's Connections.

### Resource references

The inspected resource's attached documents, designs, code references and
images, separated into material in this repository and external links, each
grouped by reference type in an expandable tree with counts, each with
the role that says why it is attached. Local images expand into an inline
preview; a Code Reference opens the source file inside the reading with the
located lines highlighted; a Markdown Reference opens as a formatted document
whose links and images resolve within the repository. Opening one preserves the
resource's selected reading, expansion and scroll, and Back restores it. The
reading names its count, is offered only when attachments exist, and a
Scenario's References belongs to that Scenario.
