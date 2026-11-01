---
kind: edge
routes:
  local: Local
steps:
  - text: The Developer opens the report on a model kept in a Git repository
    kind: actor
    actor: developer
    entities:
      - { entity: product-model, effect: reads, facts: [] }
    contexts:
      local:
        place: pdd-kit-cli
  - text: The Product compares the model with its last commit, marks every changed resource, and names what it is compared with
    kind: product
    entities:
      - { entity: product-model, effect: reads, facts: [Product, Coverage, Method] }
    contexts:
      local:
        place: local-report-web::resource-collection
  - text: The Developer picks another version to compare with — since the branch left the default branch, not pushed yet, the latest release, or when the model was created
    kind: actor
    actor: developer
    entities:
      - { entity: product-model, effect: reads, facts: [] }
    contexts:
      local:
        place: local-report-web::resource-collection
  - text: The Developer opens Changes and reads each changed resource as a sentence, grouped by Domain
    kind: actor
    actor: developer
    entities:
      - { entity: product-model, effect: reads, facts: [Product, Coverage, Method] }
      - { entity: domain, effect: reads, facts: [Region] }
    contexts:
      local:
        place: local-report-web::model-changes
  - text: The Developer opens a changed resource and reads its Changes, before and after
    kind: actor
    actor: developer
    entities:
      - { entity: capability, effect: reads, facts: [Purpose, Availability, Domain] }
      - { entity: capability-scenario, effect: reads, facts: [Trigger and outcome, Steps] }
    contexts:
      local:
        place: local-report-web::resource-reading
---

# Read what changed since a Git version

## Trigger

The Developer wants to review what a change does to the product before it is
committed or merged, rather than read it as lines of Markdown.

## Outcome

The Developer has read every resource added, removed or modified since the
version they chose, each change in the model's own terms, and nothing in the
repository has been checked out, stashed or written.

## Edge cases

- A resource is identified by its type and id: changing an id reads as a removal and an addition, and moving its file without changing its id changes nothing.
- Turning the comparison off removes every change mark until it is turned back on.
- Saves, commits, checkouts and fetches move the comparison along without restarting the report.
- Outside a Git repository, and for a model opened from a GitHub branch or pull request, the report offers no comparison.
- When the default branch has no Product Model yet, the choices include when the model was created on the branch.
- A comparison says what changed in the model, never whether the code changed too.
