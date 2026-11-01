---
domain: model-inspection
availability: [{ place: pdd-kit-cli }, { place: local-report-web }]
references:
  - kind: code
    role: implementation
    target: src/core/local-viewer-server.ts
    title: Loopback report server
  - kind: code
    role: implementation
    target: layers/nuxt/report-viewer/app/components/ReportShell.vue
    title: Report shell
  - kind: code
    role: implementation
    target: src/core/report-comparison.ts
    title: Model comparison
  - kind: code
    role: implementation
    target: src/core/git-history.ts
    title: Earlier versions read from Git
---

# View the Product Model

Serves the current Product Model as a private, read-only report on the
Developer's own machine and keeps it current while they edit. The reader browses
resources by kind, opens any resource’s reading, reads a thing's lifecycle as the
Steps compose it, searches by name, and keeps their place across a save and a
reload.

Coverage in Overview shows which of the repository's code the model accounts
for, by location, with recorded paths linking to related context and
References; a model tied to no code yet says so instead. Reading never records
inspection or changes the repository.

In a Git repository, the report also shows what changed in the model since an
earlier version of it: by default the last commit, or the point where the
branch left the default branch. The Developer picks the version from a few
named choices. Every changed resource is marked, and each one shows its own
change. The earlier version is read from Git without changing the repository.

## Intent

A model that is only read as a file diff is read once. This is somewhere to
return to during authoring, so it has to survive a recompile and a refresh, and
it has to stay private: it listens on the loopback address only and sends
nothing anywhere.
