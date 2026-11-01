---
entities:
  - { entity: product-model, shows: [Product, Coverage, Method] }
  - { entity: domain, shows: [Region] }
entryPoints:
  - local-report-web: /?s=changes
references:
  - kind: code
    role: implementation
    target: layers/nuxt/report-viewer/app/components/ReportChanges.vue
---

# Model changes

Where the Developer reads everything that changed in the model since the
version the report is compared with. It exists only while the report compares,
and leads the report's navigation then. Every changed resource is one entry,
grouped by Domain, saying in a sentence whether it was added, removed or
modified and what changed; a Domain reorganisation reads as moves. The
Developer narrows the entries by kind of change and by resource type, and
opens any entry's resource on its Changes reading. Every page of the report
names what it is compared with, and from there the Developer picks another
version, turns the comparison off, or opens this place.
