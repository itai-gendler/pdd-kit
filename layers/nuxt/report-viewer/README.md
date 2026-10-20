# pdd-kit Product Report

The stable Product Report v19 renderer used by `pdd-kit view` and exported
from the `pdd-kit` package. It projects the complete portable report into
six main resource collections: Entities, Interfaces, Domains, Capabilities,
Journeys, and Business Rules. Overview sits above Resources. Experiences and
Screens are reached through Interfaces, with ownership shown inside their resource readings.

Inline definitions and the Vocabulary panel share a registry generated from
the documentation's `terms:` frontmatter.

A collection row, relation, search result, or topology resource opens one complete
resource slideover. The underlying collection or comparison keeps its heading,
rail selection, Rows/Graph/Matrix drawing, filters, expansion, scroll and graph viewport.
The modal reading dims and blocks the underlying view; narrow screens use the
full width. Expand fills the window with the same resource reading; Restore
returns to the panel width while retaining the drawing, selection and viewport.
Back restores the previous resource and its tab and reading position.
Close, Escape or a click outside returns to the preserved working view. Resource links support the
browser's new-tab and copy-link actions. The compact header keeps the resource's
identity on the left and named-view actions beside Expand and Close.
Under the title, one short line says where the resource belongs: its type, then
the nearest place containing it with that place's own mark — `Screen in [Screen]
Add source` — and its related Domains as marks. The full containing path is the
nearest place's tooltip, and the place opens. The first Domain mark opens its
Domain and names it on hover; any remaining Domains open from a `+N` count, and
a single Domain needs none. The popover preserves normal resource links;
Escape dismisses it before the resource reading.
Entities and Capabilities show their assigned Domain; other resources show the
Domains reached through their Capabilities or Rule targets. A Scenario uses its
own Capabilities, so it does not borrow Domains from its parent's other cases.

Overview contains identity facts, authored detail, Contexts and supporting material,
with contextual links beside the facts they explain. Capability
and Journey readings add Scenarios.
Every place reads itself: what is authored on it and what happens exactly
there, never a sum of the places nested inside it. An Interface or Experience
Overview carries no Delivery list; its facts strip counts the Capabilities
available inside it, and where each is delivered reads in its containment tree.
The facts strip adds
the Languages an Interface serves: its own list where it narrows the Product's,
otherwise the Product's list marked "all of the Product's", so an Interface that
narrows nothing never reads as serving none. It is absent only when the Product
declares no languages. The Product Overview's About reading lists the Product's
languages. `node scripts/check-languages.mjs <viewer-url>` checks both against
the Fixture Shop.
A Screen Overview separates Presents (facts the Product shows) from Collects
(input the Actor supplies), grouping each by Entity and omitting empty sections.
A prefilled editable fact appears in both; a bare Entity entry appears only in
Presents. Section counts name Entities, not facts. A Screen's facts strip counts
Entities under Presents and Collects separately, omitting empty groups, and the
Capabilities it exposes. There are no Information presented,
Available actions, View states or Capability boundary readings, and References
carry no state badge.
Screens never nest: a Screen's header trail names its Interface and Experience.
The Interfaces tree says what each place delivers, as ordinary items in its
own branch, exactly as the Delivery map does: a Screen lists its own
Capabilities; an
Experience or Interface lists Capabilities with Steps placed exactly there,
plus availability gaps exposed on no relevant Screen. Exposure on a Screen
never removes behavior placed directly on its container. They are ordinary rows beside the place's Screens, so
where they sit says they are on no Screen; no group heads them. The Delivery map
draws the same leaves under the same nodes, so it needs no note to say so.
Under each Capability sit its own Capability Scenarios with a Step placed
exactly on that place. A Journey Scenario belongs to its Journey, never to a
Capability its Steps use, so it sits under its Journey instead: after the
place's Capabilities come the Journeys passing through it, each holding its
Scenarios with a Step placed there, once each; where it sits says it has Steps
there, so no row repeats which. Scenarios start folded, under a Capability or
a Journey alike. A nested place reads its own; nothing is summed. Every item opens its
reading.
On the Interfaces collection the Capabilities filter marks the matching items.
Interfaces, Experiences and Screens have a Delivery tab (`delivery`) after
Overview: the place's own branch of that tree, with the collection's tree rows,
chevrons, resource links and expansion controls. The selected resource is
already named in the header, so each tree starts with its children. Shared
Screens occur once under their Interface in the full tree; an Experience's
Delivery tab shows shared references with “From” and an owner link.
A Business Rule's Overview is its statement, read once as the lead. Where the
Rule is a permission, Who may follows it, because the grants restate the
statement in structured form. It lists each operation the Rule selects, one row
per Entity target — the Entity's chip, then the operation in the present with
the Steps' State badges (`[Collection] change to [Published]`), then its governed
facts as fact tags and its places as a Step's Where breadcrumb — and then each grant from its parts, alternatives joined by a
visible or: acting Entities as chips; a `related` path as words over one hop
(`[Reader] who owns it`) and in the format's own arrows past it; the thing
itself; the Product's own schedule; whoever a settings Entity configures; and
each condition as while and a State badge, or when, the Entity's chip, the
fact, the operator and the value — a threshold as its settings Entity's chip.
A permission may target several Entities; a grant that needs one “it” — a
`related` path, a State condition, the target's own fact — needs exactly one.
Its Rationale and Intent close the Overview. An Applies to tab (`applies-to`)
follows, counting the Rule's targets, drawn with the same tree rows: targets
grouped by type in rail order. A target holds only the places the Rule itself
names — the Contexts it narrows the target to, noted “Only in”, each noted with
the Interface and Experience it sits in because places repeat titles across
Interfaces. A target the Rule does not narrow is noted “Every supported
Context” and holds nothing: those places are the target's own, read on its
page. An Entity target notes its operation and governed facts; a Context target
is the place itself. Groups start open and targets folded.
Every edge that tree draws is read at its other end. A Capability, Journey,
Entity, Interface, Experience or Screen has a Business Rules tab (`rules`)
before Connections, counting the Rules that name it — by targeting it or one of
its Scenarios, or, for a place, by narrowing a target to it or targeting it as
a Context. Each is the Business Rules collection's row — name and statement —
whose hook line says how it names the resource: Where, Selects, On, or Here,
for — an operation drawn as Who may draws it, the Entity left out where the page
is that Entity. The row carries no metrics: the Rule's reach is its own reading's. A
place's Connections list the same Rules. On an
Entity, a fact a Rule governs keeps its place in the Information kept grid and
carries one small badge per Rule naming the kind of claim — Read restricted,
Change restricted, Never read or changed, or Constraint for a Rule that grants
nothing. Clicking the badge opens the claim: who alone may read or change it and
where (`Read only by [Reader] who owns it in [Personal library › Collection
workspace]`), that no one may, or the Rule's statement, with the Rule's chip as
its source. The Overview signals; the Rule and the Business Rules tab explain.
A fact reads as one tag wherever it stands: a Step cites it, a Screen presents
it, a Rule governs it. Reach through targets is not naming, so a Rule on a Capability is not
listed on every place that Capability is available in; the Rule reach graph
draws that.
An Entity target selects Steps — the format's own reading, decided by the
selector lint and the report validator share — so a Rule also governs the
Steps doing its operation, in their own places or, where a Step names none, in
its Scenario's. Each such Step names its Rules under Governed by, in both Steps
drawings. A Capability lists the Rule in its Business Rules tab when it owns a
governed Step — its Capability Scenarios' Steps and the Journey Steps naming it
— and a Journey when one of its Journey Scenarios does, with the hook Governs
its Steps and the Rule's selectors that select them: “changes Collection”,
“reads Collection · Public address · Only in Collection workspace”. Their
Connections list these Rules as Governing its Steps, and a Rule's Connections
list what owns the Steps it selects, all marked derived. An Entity target
without an operation selects every Step touching the Entity.
An Entity's Overview contains Information
kept; its Lifecycle reading switches between Rows and Graph. Rows groups changes
under their starting State, using the collection list's parent/child styling.
Each State carries its definition, including States with no outgoing changes.
Creation and changes without a starting State have separate groups. Groups and
changes expand and collapse individually or together, with expansion remembered.
Rows expand each change's Capabilities, co-effects and supporting Scenarios.
A change reads as it does in a Capability's What it changes and a Step's
Entity effects — `changed [Unlisted] → [Published]` through the same component
— in the details heading and under Changes involving this state. A Rows change
sits under the State it leaves, so it names only where it goes (`changed
[Published]`, `created [Private]`), with its Capabilities as chips. A State
wears the same badge wherever it stands: in a change, heading its Rows group,
and heading its details.
A change is read by what makes it: the Rules governing it are read on the Steps
they select, never on the transition. A change no Rule permits anyone to make
is the exception, since no Capability makes it: it is drawn dashed and names
its forbidding Rule. A Graph edge's label is a badge, the report's chip wearing
the Capability's mark, or a Forbidden mark. Hovering or focusing a label or
its line dims what is unrelated, as hovering a State does: it lights that one
change and the two States it joins, never another change the same Capability
makes. Clicking a label selects its
change; the details head each part in the badge's order and marks — Made
through its Capabilities, or Forbidden by its Rule — and briefly mark the part
whose badge was clicked, scrolling it into view. Graph nodes and edges open those details in a local inspector;
selecting a State explains it and lists the Scenarios that leave the Entity
there. Changes without specified states remain accessible beside the graph.
The inspector sits below the drawing in a narrow panel and beside it when
there is room. Drawing, selection and viewport survive tab changes, linked
resource lookups and refresh.
Connections follows whenever relationships exist and gives the complete
relationship list, including links also explained in Overview. References comes
last when attachments exist, with its count, roles and image previews. Attachments
use the same Nuxt UI Tree styling as Domains and Interfaces, grouped by their
authored reference type. Groups start open; image previews expand beneath their
reference. Expansion is remembered per resource across tab changes, Back and
refresh. A Scenario URL selects and
expands that Scenario inside its parent. Named-view actions explicitly change
the working view and close the panel. Ownership remains visible inside the
resource reading and is separate from its return trail. Selecting Connections
from a Scenario reading opens its parent's Connections tab. References stays
scoped to the inspected resource: a Scenario address always opens its parent at
Scenarios, whatever its `rt`, and the Scenario's own attachments are read on its
card.

The Product Overview's References reading is read by where references point,
not one row per attachment, because many resources cite the same file. It works
like Coverage. One neutral card per kind of material the format defines counts
its citations and is the only kind filter; a kind the model does not use reads
zero rather than vanishing, and the kinds share one tone, since their icons tell
them apart. Repository paths are drawn once each in a repository tree under
**In this repository**, and external pages once each under their site under
**External** — and on a code host such as github.com under their repository
too, named by their title or their path within it. A repository file opens in
this report and is left behind when a Blueprint is exported, while an external
link opens in a new tab and travels with it. Each section counts its paths or
links and its citations, and the two sit side by side where the reading has
room for both.

A location's row carries the icon of every kind cited at it and, when there are
several, how many citations; those marks and the chevron are its one control,
disclosing the citations in place. A closed folder or site says what opening it
would find, faded, as a way in. Each citation names the resource that cites it,
linking to that resource's References tab over the current reading, with its
role and, when it points at a symbol, line or fragment, a link to exactly that.
The whole location opens from its row. A title every citation shares is written
once beside the location; otherwise citations sit under each distinct title.
Search finds paths and links by name, never titles, and opens the folders above
what it found. Folders and sites start open and citations closed; Expand all and
Collapse all cover both, and the reading remembers its own expansion separately
from resource trees.

A resource's own References tab keeps a short list: it separates **In this
repository** from **External**, each with its own count and grouped by kind. A
section with nothing in it is not drawn. The Overview ends with its last reading.
Local References always lead with the file path; a distinct authored title follows
inline as muted context. External References use their authored title with the URL
below it, or the URL alone when untitled. A title identical to the target is not repeated.
Local References open inside the same slideover, with Back restoring the prior
document or resource reading, including scroll and expansion. Close returns to
the working view. The `f` query parameter carries the local preview URL, independent
of the resource and its tab; refresh and browser Back/Forward preserve the reading.
External HTTP(S) References show an external-link icon and open in a new tab.
Code References use `/_pdd-kit/code?target=<encoded-target>#reference`.
The local viewer returns structured preview data and renders source with Nuxt UI
Prose components, Shiki syntax colors in both themes, line numbers, and highlights
an authored line range or the first textual match for a symbol (trying its final
qualified name when the full name is not present). Missing locators are explained
beside the file. This endpoint serves only exact Code Reference targets in the
current workspace report, from regular UTF-8 files up to 2 MiB inside the repository;
symlinks and binary files are refused. Source bytes stay outside the Product Report.
Hosts serving workspace reports must provide this endpoint alongside the local
asset mount; portable reports have no Code References.
The asset mount renders `.md`
files as documents with headings, tables, lists, code blocks and heading anchors;
frontmatter stays in a collapsed Document metadata section. View source adds
`?raw=1` to the same URL. Relative links and images resolve from the document's
directory within the repository; linked Markdown uses the same preview. Raw HTML
is displayed as text and executable URLs are refused. Markdown previews share
the source preview's 2 MiB UTF-8 limit, repository boundary and symlink guard.
The local server parses Markdown with Comark, with HTML and component plugins
disabled, and colors code blocks with Shiki. Only standard Markdown elements and
validated presentation attributes reach the Vue reader. Source and Markdown
previews return JSON; direct browser visits open the report slideover. The reader
uses Nuxt UI Prose components, intercepts local links for report navigation, and
inherits the report theme. Parsing and language grammars stay on the server.
Unknown languages and large grammar inputs remain readable as plain text.
Images and plain text open in the same reading; PDF uses the browser's local viewer.

Authored Capability Context has one dedicated Overview reading instead of being
repeated as a resource fact. Derived Journey and Scenario Contexts stay with
their concrete routes, Screen placement stays in identity, contextual Rule
selectors stay with applicability, and a Journey shows only its typed starting
places. Raw entry-point routes remain report data but are omitted from the
human Product Report.

The report is the sole source of Product identity and content. The separate
`logoSrc` prop resolves the Product's optional
`product-model/product/logo.svg`; the shared `PddKitProductLogo`
component falls back to a packaged neutral placeholder. Hosts own navigation
and actions outside the report.

The layer renders the report and nothing around it. Site chrome — the header,
the footer, and any brand or legal links — belongs to the host, which already
has the navigation, routing, and legal context the report does not. The report's
sidebar holds search, Vocabulary and sections, with Overview as the way home.
A Product picker below the host brand shows the current Product's logo and name.
It uses Nuxt UI's DropdownMenu with keyboard navigation and a selected-item check.
The trigger uses the selected Hairline treatment: a faint outline and transparent
background. Menu rows center the logo, Product name and checkmark vertically.
The local viewer lists its single Product. Hosts can supply `products` as
`{ label, to, logoSrc?, active? }[]`, marking the current destination `active`;
the current report remains the selected entry even while the host's list loads.
Other entries are native links, with the menu's keyboard type-ahead navigation.
Hosts can supply `productCatalog: { label, to }` to add a link to the full
catalog below the Product choices, separated from them by a divider.
Catalog hosts should key the viewer by Blueprint identity so switching Products
starts a fresh reading. In the collapsed rail, the picker shows a 17px Product
logo in a 32px trigger and a name tooltip; the mobile drawer keeps its full label.
An icon-only Search button sits beside Overview, stacking directly below it
when collapsed. Navigation rows are 36px high with 4px gaps, starting 20px below
the Product picker. Whitespace and the Resources label separate the navigation
groups. Vocabulary leads the bottom reference group above Documentation and
GitHub, with one divider above the whole group.
Hosts with Vocabulary in their own header can set `sidebarVocabulary` to
`false` to omit the sidebar entry and its empty reference group. That header
must keep the Vocabulary panel's tooltip controls available for report readers.
The working view's header serves as its navbar: the heading shares it with the
generation date, above a bottom divider. The report schema version is not shown;
it identifies a data format, not anything a reader of the Product acts on. A
host's `status` slot replaces the generation date with its live connection state. Header metadata wraps onto a second line
on narrow screens. The bundled local viewer puts its problems chip in the same
slot, before the pulse; the chip and the problems drawer it opens belong to the
host, not to the report.
Hosts can pass `resourceNotices`, keyed by resource key, as `{ title,
description, detail? }`. A resource's reading shows its notice, or its parent's
for a Scenario, above the reading as given. The local viewer uses it to say a
resource is shown without part of its file.
Hosts can supply `sidebar-header` and `sidebar-footer` slots for branding and
utilities; both also appear in the mobile navigation drawer. The bundled local
viewer places its version beside the brand in the sidebar header, followed by
an icon-only Theme lab button and the color-mode switch at the right edge,
aligned with Search. The switch is hidden while dark mode is off (see the
theme README). Header controls stack below the mark when collapsed.
Documentation and GitHub stay in the sidebar footer. There is no
separate host navbar; the theme lab bar appears above the report only when
opened. Desktop navigation uses Nuxt UI's
`DashboardSidebar` and `DashboardSidebarCollapse`, expanding to 288px or
collapsing to a 64px icon rail. The choice is saved in local storage. Navigation and
utility icons keep accessible labels and tooltips; the mobile drawer always
shows the full menu. Collapsing keeps the current reading and its state.
Collapsed navigation and utility icons use 17px glyphs. Navigation, Search and
reference rows have 36px-high targets; brand controls and the picker retain 32px.
The `sidebar-header`, `sidebar-footer` and `navigation` slots receive
`{ collapsed }`, so host branding and utilities can follow the rail's width.

Extend the layer from a Nuxt application:

```ts
export default defineNuxtConfig({
  extends: ['pdd-toolkit/nuxt/report-viewer']
})
```

Wrap the host in Nuxt UI's `UApp` (for its tooltip/overlay providers), then render
the canonical report inside a page:

```vue
<PddKitReportViewer :report="report" :logo-src="logoSrc" />
```

`report` must be a `ProductReport` from `pdd-toolkit/report`. There is
no second, lossy public view-model contract.

Where the reader is, is bindable, so a host can keep it in its own router and
give the report deep links, a working back button, and a refresh that lands
where it left:

```vue
<PddKitReportViewer
  v-model:section="section"
  v-model:resource="resource"
  v-model:tab="tab"
  v-model:resource-tab="resourceTab"
  v-model:scenario-route="scenarioRoute"
  v-model:route-columns="routeColumns"
  v-model:topology="topology"
  v-model:coverage="coverage"
  :report="report"
/>
```

| Model | Value | Default |
| --- | --- | --- |
| `section` | `overview` or a collection: `entity`, `interface`, `domain`, `capability`, `journey`, `rule`, or `variation` | `overview` |
| `resource` | the stable key of the inspected resource (`screen:reader-web::…`), or `null` for the section's collection | `null` |
| `tab` | underlying collection: `overview` (Rows), `graph`, or `matrix` (Entities, Capabilities and Business Rules); Product Overview: `overview` (About), `coverage`, or `references` | `overview` |
| `resourceTab` | resource reading: `overview`, `alternatives`, `applies-to`, `delivery`, `scenarios`, `lifecycle` (or `lifecycle/<change>` to select one change), `rules`, `connections`, or `references`; independent of `tab` | `overview` |
| `scenarioRoute` | the first route in the visible Scenario route window, or `null` | `null` |
| `routeColumns` | `auto`, or the reader's preferred number of visible route columns | `auto` |
| `coverage` | `{ path: string \| null }` | No path |
| `topology` | selected view, Journey, Scenario window, matrix column, focus, hidden kinds, expanded/collapsed groups, directory search | Domain map; no filters |

Every one is optional; bind the ones the host wants in its URL. A Scenario key
opens its parent's reading at Scenarios with that Scenario's card open, its own
References on the card, while the section stays on the originating working view.

The layer auto-imports `useReportNavigation()` for hosts that use Vue Router.
It returns these eight models and encodes `s`, `e`, `t`, `rt`, `r`, `rc`, plus reading
key `cp` for Coverage, and `tv`, `tj`, `ts`, `tm`, `tf`, `th`, `tx`, and `tc`. Set
`useReportNavigation({ sectionKey: 'tab' })` for the catalog's section URLs.
Defaults are omitted; array keys repeat, preserving qualified resource IDs.
Navigation pushes history; reading filters and expansion replace the current entry.
`rt` selects the resource tab independently of the working view's `t`. For example,
`?s=entity&t=graph&e=entity:order&rt=lifecycle` keeps Entity relationships behind
Order's Lifecycle. A resource-only address defaults to its owning collection.
The return trail lives in browser history state, survives reload, and follows
Back/Forward; shared URLs carry the current reading without the sender's trail.
The composable also supplies native resource URLs to descendant viewer links.
Hosts providing their own routing should adopt `resourceTab` independently of
`tab`; uncontrolled embedded readers retain a local return trail.
Hosts can instead bind their own state. Containment tree expansion is stored per resource, separately from the underlying collection or graph.
Collection facets, collapsed groups,
expanded tree nodes, scroll anchors and graph position use session storage when
available, isolated by report and host path. They survive refresh and
recompilation without entering the Product Model; removed facet IDs are pruned.
Reader preferences live in local storage and set no cookies:
`pdd-kit:tooltips` (whether term tooltips are drawn), `pdd-kit:columns` (how
many columns each collection's Rows use, keyed by collection, one to four; rows
start at one, tree cards at three), `pdd-kit:resource-expanded` (whether the
resource slideover fills the window) and the sidebar's collapsed rail. No host
renders the report per request, so a prerendered page draws the defaults and
applies the stored choices once hydration finishes; the client-only local
viewer reads them before its first paint. A browser keys local storage by
origin, port included, and `pdd-kit view` listens on a new port each run, so
the CLI also keeps the first three in the reader's configuration folder: the
local viewer copies them into storage before the report reads them, and saves
each change, which the theme Layer passes to `onPddKitPreferenceChange`
listeners. Without storage, as in some private
windows, a choice lasts as long as the page. Nothing else is kept, because
nothing else is configurable: the reading and its grouping are decided by the
report rather than auditioned on every visit.

A collection is one set with shared drawings, selected with `section` and `tab`
and no resource key. The rail lists Overview and seven collections. The filters
narrow the collection, and a dropdown beside them changes how
that set is drawn. Its preview cards name each view and explain it with a short
subtitle, without a separate help button or About section. The picker stays at
the right edge; the desktop legend and list controls sit to its left. On phones,
list expansion and the legend are available inside the picker. The heading, count, collection filters and chips stay the same.
Matrix is offered only by the three collections whose resources supply its rows.

| Section | Rows (`overview`) | Graph (`graph`) | Matrix (`matrix`) |
| --- | --- | --- | --- |
| `entity` | one row per Entity, grouped by Domain; Actors lead | Entity relationships | What changes what: Entities × Capabilities |
| `interface` | one tree card per Interface or Interface Variation, alternatives retaining their delivery trees | Delivery map | — |
| `domain` | one tree card per Domain, its Capabilities and Entities | Domain reach | — |
| `capability` | one row per Capability, grouped by Domain | Capability reach | Compare delivery: Capabilities × Interfaces |
| `journey` | one row per Journey | Journey reach | — |
| `rule` | one row per Business Rule, grouped by Domain | Rule reach | Rule attachments: Business Rules × attachment targets |

Each Matrix keeps the collection heading. Its preview card names the view and
states its question in the subtitle. One toolbar owns the scope in all three
drawings: primary resource selection, Domains and other existing axes, plus
Changed by (Entities), Available in (Capabilities), or Attached to (Business Rules).
Relationship selections narrow the primary resources and the Matrix columns using
the same authored relationship. With no selections, disconnected subjects remain.
Selections persist per collection across drawings and refresh; contextual links
select the same shared scope.

Entities offer only Entities, Domains and Changed by. Changed by uses the
Capabilities icon and includes creation, change and removal, never reads. Actor
access through Interfaces or Experiences and Journey participation remain in
resource readings. Available in uses
the authored delivery routes shown by the Matrix, with one grouped picker for
Interfaces, Experiences and Screens. An Interface includes delivery through its
Experiences and Screens; an Experience includes its Screens. Parent availability
does not invent delivery on every Screen inside. Whole types and exact locations
combine with OR. The Matrix keeps Interface columns and shows only matching
routes. Capabilities have no separate Screen or Scenario filter. Attached to is one searchable
picker grouped by resource type, with whole-type and individual-resource choices.
These choices combine with OR; different axes combine with AND. Attachments mean
exact authored targets, excluding inherited reach and context restrictions on
another target. Rows carry compact relationship summaries explaining the filters.
Every selection has a removable chip; Clear resets the complete collection scope.

Matrices scroll vertically with the reading; edge controls, horizontal trackpad
gestures, and touch swipes move one column
at a time beside a fixed subject column. The first visible column uses `tm`;
moving between columns preserves vertical position and cell details. Each matrix's
shared toolbar offers a Legend popover with every possible badge color and meaning for
that view, regardless of report data, filters or the current column window.
The header and reading render together on the server. Body cells mount only for the
visible columns and one neighbour on each side; the browser animates their offset. A collection Graph
draws the facet-filtered set and honours `tf` as a neighbourhood; branch
expansion uses `tx`/`tc`. Entity Lifecycle and resource Connections each keep
their own tab and reading position, including after following a link and returning.

Capabilities and Journeys have one Scenarios tab, using expandable cards.
Direct Scenario links open and scroll to the matching card inside its parent.
Scenario cards separate Trigger and Outcome from the Entities they leave behind.
The whole summary, including its title, toggles the ordered Steps followed by
any decision points and edge cases inside the same contained card. The single
expansion control includes the Step and detail counts; there is no separate
details toggle. Resource links and definitions work independently of expansion.
Each Entity appears once in the terminal reading, with its
last creation, change or removal, and Entities only read sit separately.
Every Entity effect — a Step's Entity effects, Ends with, Leaves behind,
Changes made here and a Capability's What it changes — reads Entity first: the
Entity chip, a plain verb, then each State as a badge, as in
`[Source] created [Reachable]`, `[Item] changed [Read] → [Unread]` or
`[Collection] read`. An ending names where the thing rests: `[Item] in [Unread]`.
What it changes names each Entity once and each distinct move on a row of its
own, with the number of Scenarios making it; moves are never joined into a
run, since two moves that meet are made by different Scenarios and a chain
would tell a story none of them tells. The moves read in the Entity's Lifecycle
Rows order — creation, then by starting State in declared order — and each
opens that change in the Entity's Lifecycle (`rt=lifecycle/<change>`), selected
in whichever drawing is on screen.
The facts a Step cites on a read, change or creation follow the phrase; the terminal
reading names none.
Scenario titles use 16px semibold text, section labels 13px semibold, and body
text 14px regular. Step cards use the selected Guided flow layout: visible labels for
Action or Condition, Who, Entity effects, Where and Capability. Where reuses the original Context breadcrumbs — Interface,
Experience and Screen — without route-name prefixes. The Step card variant
selector has been retired.
Scenario Steps are read in authored order, with their Actors, Entity effects,
places, Capabilities and governing Rules. Decisions, edge cases and attachments
remain inside the Scenario reading.

Resource readings and the Product Overview share Nuxt UI's link-style tabs on a
transparent header. The slideover places the resource tab strip above its scroll
pane, with a subtle upper divider and a full-width lower separator aligned with
the active underline. It stays available without a filled sticky backdrop or a nested
scrollbar. Scenarios keeps Expand all, Collapse all and the per-row selector
on the right of that strip. The controls wrap when the screen is too narrow
for one row. Tabs scroll horizontally when needed, retain Nuxt UI's arrow-key
navigation and visible focus, and bring the selected tab into view after a
refresh or resize.
Expand all and Collapse all use diagonal outward and inward arrows across
page and graph toolbars.

Domain and Interface cards are trees inside translucent containers, without a
separate header. Their borderless tree rows fill each card's width and use the
parent's background, with a subtle row highlight on hover. The Delivery tabs use the
same component. Each group has its matching resource-type icon and a count beside
its name: Experiences, Screens, Shared Screens, Capabilities or Entities. Resource
roots have no mixed total while open. A closed row says what opening it would
find, faded after its name, as a closed folder does in Coverage: the distinct
resources anywhere below it, one type icon and count per kind in rail order,
so a Capability exposed on two Screens counts once. A group names only what
lies deeper than its own count. The summary disappears once the row opens,
clicking it opens the row, and the chevron's label reads it aloud, so the row
keeps one tab stop. Expansion chevrons sit before the type icons. A nested
Screen sits directly under its parent Screen with no group between, and an
always-reachable Screen carries its mark after its name.

A resource name opens its reading directly, including roots with no children.
Chevrons toggle expansion; group labels also toggle their group. Arrow keys
navigate the tree and expand or collapse branches; Enter opens a resource or
toggles a group. There are no synthetic Overview children. Closing a root
preserves its folders' expansion state. Empty groups are omitted. Unassigned
appears only when it contains resources and has no resource link.
Scenarios v3 and its table drawing have been retired.

Backgrounds follow the item's role, independently of which levels are visible:

| Role | Examples | Background |
| --- | --- | --- |
| Group | Domain groups in Entities and Capabilities | Translucent `bg-elevated/20` |
| Resource | Entity, Capability, Journey and Scenario cards | Solid `bg-default` |
| Detail | Steps inside a Scenario | Opaque `--report-bg-detail`: 80% resource background, 20% elevated tone |

Scenarios therefore starts at the resource level and expands to detail-level
Steps. Its summary keeps the soft hover. Step cards and their number markers
use the detail background; the cards keep a steady background and border on
hover, while resource links remain interactive.
The detail tint is half the summary's 40% hover treatment, keeping the third
level subtle and distinct from an interaction highlight in both themes.

There is no URL migration. Every standalone `topology` and named-destination
shape changed with the restructure, and an address naming a destination this
report has no home for opens the Overview rather than landing the reader
somewhere else without saying so. Resource links retain their ids, and
Inspecting an Experience or Screen preserves the originating rail selection.

The four reach graphs follow a containment tree: measured nodes in horizontal
tiers, parents above children, shared orthogonal branches, and a distinct
Product root. A reach graph draws occurrences, so a Screen reached by three
Capabilities appears under each of them.

The Interfaces Graph is the delivery map: containment rooted at the Product,
like the reach trees, with each Screen's own Capabilities as leaves, a gap
leaf under an Experience or Interface for a Capability available there and on
no Screen of its own, plus direct leaves for behavior with Steps placed exactly
on that Interface or Experience, even when the same Capability uses a Screen.
A Capability exposed on five Screens is a leaf under each.

The renderer never runs Diagram Design or generates model-controlled HTML.
HTML readings remain available while graph geometry loads. A locally bundled
ELK worker arranges Entity relationships and Lifecycle; it loads on demand and
its returned routes and label positions are drawn by Vue Flow. Layout uses the
measured dimensions of the rendered cards and labels. Hover never rearranges the
graph; resizing preserves zoom, and Back and refresh restore the viewport.
The initial fit is capped at actual size; narrow screens retain a minimum zoom
and allow panning, with an explicit Fit control for the complete graph.
See [third-party notices](THIRD_PARTY.md).

The Product Report needs a bounded viewport. By default it fills the browser
height. A host with persistent chrome can set `--pdd-kit-report-chrome`
to the chrome height. The bundled local viewer fills a bounded flex viewport,
with only the optional theme lab bar above it.

The report viewer extends the stable pdd-kit theme because the Product
Report is the canonical pdd-kit report experience. The theme remains a
separately exported layer for other pdd-kit Nuxt surfaces. Hosts retain
final authority over configuration and CSS.

Nuxt, Vue, Nuxt UI, Comark Vue (`@comark/vue`), Tailwind, Vue Flow (`@vue-flow/core` and
`@vue-flow/background`), ELK (`elkjs`), icons, and fonts remain optional
peer dependencies of the CLI package; Nuxt consumers install the UI peers they
use.

Run `node scripts/check-reference-previews.mjs` after building to check Markdown
and source previews in an isolated fixture at desktop and mobile widths.

For browser regression checks, install Playwright Chromium and run
`node scripts/check-topology-diagrams.mjs <CLI viewer URL> [more URLs]` from the
repository root. The publish workflow also runs
`scripts/check-packed-diagrams.mjs` against built npm and pnpm consumers to check
SSR, hydration, worker loading, multiple instances, and navigation from the
actual packed layer.

Run `node scripts/check-comparison-tables.mjs <CLI viewer URL>` against this
repository's report or fixture-shop to check badge-to-panel keyboard focus,
bounded cell rendering on a large matrix, column navigation and mobile resizing.

### Coverage

Coverage records which of the repository's code the model accounts for, so
every statement names at least one path. A model tied to no code yet — every
Blueprint, any model decided before its code — has empty coverage, and the
reading says so in one plain statement ("This model isn't tied to code yet.")
instead of drawing a panel, cards or a tree.

Otherwise, Coverage opens with one summary panel: **Scope**, then **Method** when
recorded, under the model's own field names, then the four category cards as the
panel's last row. Method is one short line by format, so it is read rather than
disclosed. The search and the location tree follow the panel. There is no
Coverage status badge or derived completeness indicator, in the navbar or the
Coverage reading, and no separate Rationale or Mapping details.

The reading takes the four authored lists as one set of statements whose
category is an attribute. Four compact cards count Covered, Exclusions, Unmapped and Limitations,
and are the only category filter; selecting
a card activates it, selecting it again restores every category. Card totals
never change with search or filtering.

Each category has one mark, drawn wherever the category appears — on its card,
beside a path and on a statement's chip — and each has its own outline, so a
category reads by shape as well as colour: Covered a checked circle, Exclusions
a square with a minus, Unmapped a dashed circle and Limitations a warning
triangle. Their colours keep the green, blue, orange and red families at
saturations chosen to stay apart from one another at icon size.

Every statement is written under the path it names, and there is no path panel.
A row carries the mark of each category recorded at that **exact** path, beside
how many statements that is when there are several — one mark already says
there is one, so a lone `1` is not printed, though the control still names the
count to a screen reader. Those marks, that count and the chevron are the row's one
control: a row's own marks are what a reader reaches for to read it, and they
exist exactly when it has something to disclose. The row's path is a larger
pointer target for the same control, not a second tab stop. Selecting either
reads its statements in place; selecting again puts them away. Selecting the
path of a folder with nothing recorded at it opens or closes the folder.

A folder never inherits meaning from beneath it, because a count of "entries at
or below" presented as a folder's own annotation is neither files nor a share of
what the folder contains. A **closed** folder additionally says how many
distinct statements are recorded inside it, drawn as faded marks and a muted
`N inside`. That is a way in, not a claim about the folder: it disappears when
the folder opens, selecting it expands the folder rather than reading anything,
and one statement recorded at three paths below counts once. Opening a folder
reveals the paths inside it and nothing else, so structure stays browsable
without the prose that would bury it.

A statement recorded at several paths is written in full under each of them,
with its other locations listed as **also recorded at** — one claim about
several places, printed where each place is read. Recognizable Product Model
icons and the `product-model` mark still mark authored model paths.

Search finds recorded paths, as a file finder would: it keeps the paths whose
name, as written, contains what was typed, and opens every folder above them —
a hidden answer is not an answer. It never matches statement prose, and it
narrows paths rather than statements, so a statement recorded at a matched path
and elsewhere does not bring its other locations into the result; reading it
still lists them. A matched path's explanation waits to be asked for like any
other. The reveal does not rewrite remembered expansion: a folder put away
during a search stays away until the search changes, and clearing the search
restores the expansion the reader had. Expand all and Collapse all sit beside
it and cover both axes: the folders and the explanations. A card filter or a
search only narrows what is drawn: Expand all and Collapse all change what is on
screen, and whatever the narrowing hides keeps its own state for when it
returns. The References catalog shares this expansion. Expansion is
remembered per report. Model References are not repeated here — they have their home in the
Product Overview's own References reading. No live repository inventory is
added.

`coverage.path` is navigation state, encoded as `cp`, and deep-links one
location: its ancestors open, its explanation is read, and the row is marked
current — on a fresh load too, with no expansion remembered. Selecting that row
again clears it. Tree expansion is
remembered for the report. Narrow screens scroll the reading within its frame.

## Navigation regression checks

Against a running built fixture-shop report, run
`node scripts/check-entity-lifecycle.mjs <url>` for state and change inspection,
Rows/Graph parity, panel expansion, keyboard access and saved reading state.
`node scripts/check-resource-slideover.mjs <url>` for desktop and mobile
inspection, independent Graph/Lifecycle state, nested Back/Forward, Scenario
position, direct links and keyboard dismissal.
`node scripts/check-resource-references.mjs <url>` covers reference ownership,
counts, previews, browser history and scrolling tabs on desktop and narrow screens.
`node scripts/check-report-navigation.mjs <url>` covers the collections, trees,
filters and named-view exits. Set `PDD_KIT_NAV_SCREENSHOTS` to a directory outside
the Product Model to save layout captures.
`node scripts/check-report-sidebar.mjs <url>` checks desktop collapse, keyboard
access, tooltips, saved state, utilities and the independent mobile drawer.


Check the collection preview picker against a running local viewer with
`node scripts/check-collection-views.mjs <viewer-url>`. This covers all seven
collections, desktop and phone layouts, subtitles without About, saved filters,
keyboard selection and the fixed position beside the legend.

## Changes

A host that compares passes `comparison` — the baseline report, or `null` when
the baseline holds no Product Model, and a label naming the baseline — and the
report compares it with `report` itself through `pdd-toolkit/report/compare`,
so the comparison follows every recompile. Without `comparison` nothing below
is drawn, and a `s=changes` address reads as the Overview.

The header names the comparison in a button beside the host's status, on
every page: the scope and its count, `Since origin/main 282` or `Uncommitted
3`, so a change mark never has to say what it is measured from. It opens a
popover holding a Show changes switch, the scopes, what the scope is measured
from, and Open Changes; choosing keeps it open. Changes' own header only names
what is compared. Off, nothing is compared or marked, the rail has no Changes
row, `s=changes` reads as the Overview, and the button reads Changes off. The choice is a display
preference, `pdd-kit:changes`, on by default. `pdd-kit view` is
the host that compares: whenever the model is in Git, it reads versions from
Git and the reader picks one in the report; the working tree is always the
other side.

The rest of `comparison` is optional:

- `pending` says the host is reading a newly chosen version. Nothing is
  compared, counted or marked until it arrives, so a new choice never draws
  under the previous one's name. `unavailable` says the baseline cannot be
  read, and why, in its place.
- `choices` lets the reader switch the comparison: a few named scopes as one
  segmented control in the header's popover, each with a one-line description and,
  when the host knows it, a `count` of the changes it holds — the scope on
  screen counts its own. A scope is named for what it measures from, `Since
  origin/main`, and one may carry a `base`: a caret beside it opens a short list
  of branches, the default first, then releases (tags), then the host's
  `extra` versions, such as when the model was created. A search appears only
  when the list is long. One line under the scopes says exactly what is
  compared, commit included. The other side is always `report`. The host owns
  the versions and their names; the report only draws them.

The comparison identifies a resource by kind and id. An id that changes is a
removal and an addition; a file that moves without changing its id changes
nothing. Fields are compared as the report states them, so generation metadata
never counts and a derived relation, such as the Capabilities a Screen
exposes, changes when the Steps it derives from do.

**Changes** leads the rail, above Overview, with the number of changed
resources, which its accessible name also carries; collapsed, the number sits
in a muted line under its icon, in full up to 999 and then shortened without
rounding up (1.2k), within the same 36px row. Each collection row in
the rail with changes adds a dot in the
tone of their kind, neutral when they are mixed: the rail says where to look.
Hovering the dot opens a popover with the counts by kind and the changed
resources, each opening its Changes reading. Clicking the dot, or the
popover's Show these in Changes, opens Changes with its Type filter narrowed to
that collection's types, as removable chips. Collapsed,
the dot sits on the collection's icon, and hovering the icon opens the same
popover, in place of the label tooltip the other rows keep. A Screen counts under Interfaces
and a Scenario under its parent's collection.
Changes is one collection, drawn as a list, with the usual filter bar: Change
(Added, Modified, Removed) and Type, each offering only what the set holds. The
heading counts `shown / all` when narrowed. It has no graph: drawing changes
beside their unchanged neighbours buried the changes in context.

The list groups changes by Domain, the Product's own first and the undomained
last; a change in several Domains is listed under each. Three foldings make a
row say what happened instead of repeating it:

- What is added or removed with its container reads inside it: a new
  Capability with its new Scenarios is one row, `with 3 Scenarios`, and a new
  Interface carries its new Experiences and Screens.
- A resource whose only change is its Domain is part of a move, one row per
  Domain left and joined — `Moved from Runs to Briefs: Browse Runs, Cancel a
  Run and Inspect a Run` — listed in the Domain it joined. A removed Domain
  whose resources all went to one other is read there, `Domain Runs merged
  into Briefs`. A resource that moved and changed otherwise keeps its own row,
  noting the move.
- Two or more resources of one type whose only change is their References
  read as one row, `References updated on 6 Screens`.

Within a group, Domain changes lead, then moves, then each resource, then
References rows. When the baseline holds no Product Model, every row reads as
added. `pdd-kit view` then offers When the model was created in the scope's
menu, the first commit on the branch to touch `product-model/`, which reads how
the model changed since, moves included. A row leads with a
fixed-template sentence — `New Capability Bookmark archiving, for Owner`,
`Bookmark gains the fact Archived at`, `Save a link adds 1 Step and changes 1
Step and its outcome in Bookmark saving` — then its type and the place or
parent it sits in, and a mark: `+ Added`, `~ N fields`, `− Removed`. A row
opens its resource on the Changes tab; a Scenario opens its parent's. In the
sentence, the changed resource's name, or a Scenario's parent's, opens that
same reading; any other name opens its resource.
The Product's changes and removals have no reading to open, so their rows
disclose the difference in place: the Product's changed fields, or what the
baseline said of a removed resource; a move or a References row lists its
resources in place, each opening its Changes reading. Rows are compact: the
sentence, then the type and place on the same line. Density and
Expand/Collapse all work as in any collection.

A resource with changes — its own, or its Scenarios' — gains a **Changes** tab
after Overview, counting them. It names the baseline and reads the difference
as Before, Changes or After: prose word by word, with inserted words underlined
and removed words struck, and lines inside a paragraph joined first, so a
rewrapped paragraph is not a change; a value as before → after; a list as what joined, what
left and what changed, with what changed about a member kept under its name; Steps lined up as a code diff lines up lines, a new Step
read as an insertion and a Step that keeps most of its wording read as a
rewrite, with its changed Entity effects, actor and places beneath. A Capability
or Journey reads its Scenarios' changes there, each in its own card, without
naming the parent again. A Domain's Changes tab also says what it now holds
and no longer holds: the resources authored in it that moved in, were added,
moved out or were removed.

Wherever else a changed resource is drawn as a row or a tree node, it carries the same mark
beside its title and the change's tone on its leading edge; a Capability or
Journey whose Scenarios changed says `~ N Scenarios`.

Every mark is a glyph and a word as well as a tone, and the tones are the
mutation palette's. The comparison says what changed between two authored
models; it never says the code does either, and Changes says so once, below
the list.

## Variations

A Variation is a resource: a named set of same-type alternatives with how one
is chosen written once on the set. It has its own rail collection, **Variations**,
marked with the variation glyph in ink — a Variation modifies a type, so it
takes no hue — drawn at 14px inside the usual 16px slot, since the glyph reaches
the corners of its box. Its rows group by the type each set varies —
Interfaces, Screens, Business Rules, Scenarios and so on — and show the set's mark, name,
picker, purpose, alternatives and what chooses between them (`Chosen by`,
`Assigned per` or `Discriminator`). A Scenario is never read without its owner,
so a Scenario set sits under a one-line link to the Capability or Journey its
alternatives share (`variationsByOwner`); `lint` keeps them under one. The
collection has Rows only: a set has no derivation of its own to draw.

**A set reads as the type it varies.** Its mark is the member type's mark with
the variation sub-icon in the corner the viewer badges an Interface's type or an
Entity's facet with (`ReportVariationMark`, through `ReportKind`'s `memberKind`). On
an Interface set the sub-icon takes the type's corner; each alternative keeps
its own type where it is read. The reading's subtitle names it the same way,
with its subtype and, where all its alternatives sit in one place, that place
and its Domains: `Capability Scenario variation · Experiment in Checkout`
(`resourceAncestors` and `resourceDomains` of a set).

**The set is the title; the picker names the alternative.** Wherever an
alternative is a title — a reading header, a row, a tree node, a Scenario card —
the title names its Variation (`titledBy`) and the picker beside it
(`ReportVariationPicker`) names the alternative being read: its title, or a
Version's label (`v2`). On a set's own title the picker counts the alternatives
(`2 alternatives`). There are no position numbers: alternatives are a set.
Pressing the picker opens a switcher. Its first row is the set — the variation
glyph in its own ink, the set's name with an arrow, its subtype and what
chooses — and opens the set's own reading; it is checked while that reading is
open. Every alternative follows with its condition, the one being read checked.
The set is named once in the menu. The picker has three modes. In a row or tree
node it opens the picked alternative; in a reading header it replaces the
reading under the same title, with no Back step (`ResourceNavigation.replace`);
on a Scenario card it switches the card in place. Nothing switches alternatives
with tabs. The picker is its own button beside the row's full-card link, never
inside it. References inside a reading — Step places, Rule targets, relation
chips — stay concrete.

**Where alternatives meet, they are one row.** `collapseVariations` replaces two
or more alternatives of one set in a list with the set's row, at the first one's
place; a lone alternative keeps its own row, titled by its set. This applies to
every collection list and to the Business Rules tab. Heading counts stay
concrete — `Business Rules 14` while thirteen rows show. A set row never
expands. Trees are the exception: `foldVariations` puts every alternative —
Screens, Experiences, the Capabilities and Journeys a place delivers, and their
Scenarios — under its set's node, even where it is the only one there. The node
expands to them by their own titles because each keeps its own children. At a
place, an alternative that happens nowhere in its branch follows them struck
through, muted, with a dashed `Not on this Screen` badge (`Not in this
Experience`, `Not in this Interface`) and no children, so a place holding one
alternative still reads as a choice; it still opens its reading. One delivered
on a place nested inside, or on a Screen its Interface shares, is not struck:
it is in the place, read where it happens. The node's picker draws it the
same way, after the alternatives that are here, with its condition. Counts and a
closed row's summary never include a struck alternative or the set node.

**Scenarios are read in their parent.** A Scenario address opens its parent's
reading at Scenarios, with its card open and in view; its own References are read
on the card. Alternative Scenarios are one card at the first one's place, titled
by their set, with **Selected when** leading it. The card reads the alternative
the address asked for, else the reader's last pick for this parent, else the
first by title; switching in place follows an address that names the set,
without a history entry. The Scenarios tab still counts every Scenario.

**Readings.** A Variation's Overview carries its purpose and **How one is
chosen** (`ReportVariationSelection`): the Entities and facts it chooses by, any
assignment, Takes effect and Stability. Its Alternatives tab reads each
alternative in its own words with its label and Selected when, and where each
sits when owners differ. An alternative's Overview carries **How this one is
chosen** (`ReportVariationChoice`): what chooses and its own condition, with a link
to the set for timing and stability. There is no Variations tab on an
alternative. Connections reads a set's Alternatives and what it chooses by
(`chooses by setting: …`), and an alternative's `alternative in` its set —
never alternatives to each other.

A Business Rule that is an alternative is conditional: its lifecycle
prohibitions are never drawn as unconditional, and its fact badges read
`Conditional Rule`. Also on keeps its own meaning.

Interface root cards fold alternatives under their Variation, including a lone
alternative left by a filter. Each alternative keeps its concrete name and
children. Counts remain concrete. New set roots retain the old alternative
cards' saved expansion until the set has its own saved choice.

A Lifecycle State's conditional styling uses the union of all incoming Scenario
supporters. Complementary alternatives on different incoming changes can make
the State unconditional while those changes stay conditional individually.

**In the drawings.** Nodes, rows, columns and relations stay concrete; the
Variation is added around them, the way each drawing's lines already read.
- *Graph trees* — the four reach graphs and the Delivery map — fold as the
  Interfaces tree does (`foldBranches`): sibling alternatives sit under their
  Variation's node, drawn in the member type's color with its mark and the
  sub-icon, subtitled `Capability variation`, which opens the set. Its lines to
  its alternatives are dashed — "one of", never containment — and say
  `alternatives` once where they fork, on a chip with the split mark, as every
  dashed line that depends on a Variation carries it. When a focus or filter
  hides some, the chip says `1 of 2 alternatives`. The
  Delivery map folds at every level, from Interfaces at the root to Scenarios at
  a place, and at a place an alternative that does not happen there follows the
  others struck, with the same badge as the tree. Reach trees fold their
  subjects and what each reaches — places, Rules and targets — the same way; a
  subject is not a place, so nothing under it is struck. The `+N` on a closed
  node counts concrete resources only (`concreteBranches`). Only the Entity
  graph and the matrices draw an alternative on its own, naming its set.
- *Entity relationships* — every line is an authored relation, so an Entity
  Variation is a frame around its alternatives, headed by the set; relations
  keep their concrete ends. A frame holding fewer than two alternatives in scope
  is dropped.
- *Lifecycle* — a change is conditional when some choice of alternatives leaves
  no Scenario making it (`variationCondition`): a Scenario runs only when it,
  or its Capability or Journey, is chosen. A conditional change is dashed and
  its Capability badge leads with the sub-icon; a State only conditional
  changes reach is dashed and says `Only under Cancellation request`. Every
  change's details group its Scenarios by alternative, `Always` first. The
  Entity's own Variation is never counted again.
- *Matrices* — alternatives on an axis sit side by side at the first one's
  place (`adjacentAlternatives`) under one band naming the Variation once, as a
  collection list's group header does, tinted a step darker than the cells: a
  one-line band row above its rows — name, subtype and size, and a chevron into
  it — and one band across its columns' tops, named on the first of them in view
  so paging never hides it; a Version's columns carry their labels before their
  names (`v1 Payment webhook`). A lone alternative sits under its band too, as in
  the trees; when the table holds only some of a set's alternatives, the band
  says how many (`Experiment · 1/2 in table`). A cell held only under some alternatives beyond its own
  row's and column's is dashed, and its details say which first; in What
  changes what, a single change inside a solid cell says so on its own line.
  Rule attachments are authored, so their cells are never dashed.

Search keeps the name that matched: a Variation wears its set mark, and an
alternative adds a chip naming its Variation.

Search (⌘K or Ctrl+K) also lists Pages, ahead of the resources: Overview and
the seven collections, under the rail's labels and icons, from the same list
the rail draws. Choosing a page closes the palette and opens it as the rail
does, so the address and Back behave the same.

Check it against the Fixture Shop with `node scripts/check-variations.mjs
<viewer-url>`; set `PDD_KIT_VARIATION_SCREENSHOTS` to save captures. It covers the
collection and its owner lines, set rows in a list and a tab, the switcher by
keyboard, set-first titles, switching in a header without a Back step, the set's
readings, the Scenario card and a Scenario address, Escape, the tree, the
graphs, the Lifecycle, the matrices and phone width.
