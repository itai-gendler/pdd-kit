import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileReport } from '../src/commands/export.js'
import { loadModel } from '../src/core/model.js'

const utility = (name: string) => import(`../layers/nuxt/report-viewer/app/utils/${name}.ts`)
const { projectReportWorkspace } = await utility('reportWorkspace')
const { rowChildren, treeCards, structureChildren, treeBranchKeys, insideSummary, insideLabel, ruleScope, TREE_CARD_KINDS, hiddenTreeKinds, TREE_KIND_CHOICES } = await utility('collectionChildren')
const { resourceFacts } = await utility('resourceFacts')
const { resourceAncestors } = await utility('reportDestinations')
const { attachedRules } = await utility('topologyTargets')
const { tabsFor } = await utility('pageSections')
const { interfaceProjection, placesOf } = await utility('topologyProjections')
const workspace = projectReportWorkspace(compileReport(loadModel(join(__dirname, '../blueprints/content-feed-reader')), '2026-09-12'))
const flatten = (rows: any[]): any[] => rows.flatMap(row => [row, ...flatten(row.children)])

describe('collection rows that expand', () => {
  it('draws Interfaces and Domains as tree cards, and every other collection as plain rows', () => {
    expect(TREE_CARD_KINDS).toEqual(['interface', 'domain'])
    for (const kind of ['entity', 'capability', 'journey', 'rule']) {
      for (const resource of workspace.byKey.values()) if (resource.kind === kind) expect(rowChildren(workspace, resource)).toEqual([])
    }
    /* A Domain card groups Capabilities then Entities; the grid ends with what
       no Domain claims, unless a filter narrowed it. */
    const domainCards = treeCards(workspace, 'domain', workspace.domains, false)
    expect(domainCards.map((card: any) => card.key)).toEqual([...workspace.domains.map((item: any) => item.key), ...(workspace.capabilities.some((item: any) => !item.domainId) || workspace.entities.some((item: any) => !item.domainId) ? ['unassigned'] : [])])
    expect(treeCards(workspace, 'domain', workspace.domains, true).some((card: any) => card.key === 'unassigned')).toBe(false)
    for (const card of domainCards.filter((item: any) => item.resource)) {
      expect(card.children.map((group: any) => group.title)).toEqual(
        [['capability', 'Capabilities'], ['entity', 'Entities']]
          .filter(([kind]) => rowChildren(workspace, card.resource).some((row: any) => row.resource.kind === kind)).map(([, title]) => title))
      expect(card.children.flatMap((group: any) => group.children.map((node: any) => node.resource.key)).sort())
        .toEqual(rowChildren(workspace, card.resource).map((row: any) => row.resource.key).sort())
    }
    /* An Interface card groups its Experiences, each with its Screens, and its direct Screens. */
    for (const card of treeCards(workspace, 'interface', workspace.interfaces, false)) {
      expect(card.children.map((group: any) => group.title)).toEqual(
        [['experience', 'Experiences'], ['screen', rowChildren(workspace, card.resource).some((row: any) => row.resource.kind === 'experience') ? 'Shared Screens' : 'Screens']]
          .filter(([kind]) => rowChildren(workspace, card.resource).some((row: any) => row.resource.kind === kind)).map(([, title]) => title))
      const screens = flatten(card.children).filter((node: any) => node.resource?.kind === 'screen').map((node: any) => node.resource.key)
      expect(screens.sort()).toEqual(flatten(rowChildren(workspace, card.resource)).filter((row: any) => row.resource.kind === 'screen').map((row: any) => row.resource.key).sort())
    }
    for (const kind of ['entity', 'rule']) {
      for (const resource of workspace.byKey.values()) if (resource.kind === kind) expect(rowChildren(workspace, resource)).toEqual([])
    }
  })

  it('omits empty folders while keeping the resource card and populated Unassigned groups', () => {
    const empty = { ...workspace, capabilities: [], entities: [], experiences: [], screens: [] }
    const domains = treeCards(empty, 'domain', empty.domains, false)
    expect(domains.map((card: any) => card.key)).toEqual(empty.domains.map((domain: any) => domain.key))
    for (const card of domains) {
      expect(card.children).toEqual([])
      expect(card.resource).toBeDefined()
    }
    const interfaces = treeCards(empty, 'interface', empty.interfaces, false)
    expect(interfaces.map((card: any) => card.key)).toEqual(empty.interfaces.map((iface: any) => iface.key))
    for (const card of interfaces) {
      expect(card.children).toEqual([])
      expect(card.resource).toBeDefined()
    }
    const unassignedEntity = { ...workspace.entities[0], domainId: null }
    const partlyUnassigned = { ...empty, entities: [unassignedEntity] }
    const unassigned = treeCards(partlyUnassigned, 'domain', empty.domains, false).at(-1)
    expect(unassigned.key).toBe('unassigned')
    expect(unassigned.children.map((group: any) => [group.title, group.children.length]))
      .toEqual([['Entities', 1]])
    expect(unassigned.children[0].children[0].resource).toBe(unassignedEntity)
    expect(treeCards(partlyUnassigned, 'domain', empty.domains, true).some((card: any) => card.key === 'unassigned')).toBe(false)
  })

  it('files each Screen once under its Interface, inside its Experience where it has one', () => {
    for (const iface of workspace.interfaces) {
      const rows = rowChildren(workspace, iface)
      const screens = flatten(rows).filter(row => row.resource.kind === 'screen').map(row => row.resource.key)
      expect(new Set(screens).size).toBe(screens.length)
      const drawn = flatten(interfaceProjection(workspace).find((item: any) => item.id === iface.key).children)
        .filter((item: any) => item.resource?.kind === 'screen').map((item: any) => item.resource.key)
      expect(screens.sort()).toEqual(drawn.sort())
      for (const row of rows) {
        if (row.resource.kind === 'experience') expect(row.children.every((child: any) => child.resource.kind === 'screen')).toBe(true)
      }
    }
  })

  it('uses the identical containment tree in an Interface card and its Delivery tab', () => {
    for (const card of treeCards(workspace, 'interface', workspace.interfaces, false)) {
      expect(structureChildren(workspace, card.resource)).toEqual(card.children)
      const nodes = flatten(card.children)
      expect(nodes.some(node => node.sharedFrom)).toBe(false)
      expect(new Set(nodes.map(node => node.id)).size).toBe(nodes.length)
      expect(treeBranchKeys(card.children)).toEqual(nodes.filter(node => node.children.length).map(node => node.id))
      expect(tabsFor(workspace, card.resource).map((tab: any) => tab.id).includes('delivery')).toBe(card.children.length > 0)
    }
  })

  it('shows an Experience’s own Screens and shared references without changing ownership', () => {
    const experience = workspace.experiences.find((item: any) => item.id === 'reader-web::personal-library')
    const groups = structureChildren(workspace, experience)
    expect(groups.map((group: any) => [group.title, group.children.length])).toEqual([['Screens', 8], ['Shared Screens', 1]])
    expect(groups[0].children.every((node: any) => !node.sharedFrom)).toBe(true)
    const shared = groups[1].children[0]
    expect(shared.resource.title).toBe('Item reader')
    expect(shared.sharedFrom.title).toBe('Reader web application')
    expect(shared.resource.experienceIds).toEqual([])
    const owner = shared.sharedFrom
    const canonical = flatten(structureChildren(workspace, owner)).filter((node: any) => node.resource?.key === shared.resource.key)
    expect(canonical).toHaveLength(1)
    expect(canonical[0].sharedFrom).toBeUndefined()
    expect(tabsFor(workspace, experience).map((tab: any) => tab.id)).toEqual(['overview', 'delivery', 'connections'])
    /* A Screen's own Delivery tab is its branch of the tree: its Capabilities with their Scenarios. */
    expect(structureChildren(workspace, shared.resource).map((node: any) => node.resource.key)).toEqual(shared.children.map((node: any) => node.resource.key))
    expect(tabsFor(workspace, shared.resource).map((tab: any) => tab.id)).toContain('delivery')
  })

  it('omits containment tabs and their empty groups on childless places', () => {
    const empty = { ...workspace, experiences: [], screens: [] }
    for (const resource of [...workspace.interfaces, ...workspace.experiences]) {
      /* With no place inside, what is left is what it delivers directly, as its own rows: Capabilities, or a Variation's node holding them. */
      const children = structureChildren(empty, resource)
      const unfold = (nodes: any[]): any[] => nodes.flatMap(item => item.resource?.kind === 'variation' ? item.children : [item])
      expect(children.every((node: any) => !node.groupKind)).toBe(true)
      expect(unfold(children).every((item: any) => item.resource.kind === 'capability' || item.resource.kind === 'journey')).toBe(true)
      expect(tabsFor(empty, resource).map((tab: any) => tab.id).includes('delivery')).toBe(children.length > 0)
    }
  })

  it('lists a Domain as its Capabilities and then its Entities, as the Domain map grouped them', () => {
    for (const domain of workspace.domains) {
      const rows = rowChildren(workspace, domain)
      const kinds = rows.map((row: any) => row.resource.kind)
      expect(kinds.indexOf('entity')).toBeGreaterThanOrEqual(kinds.lastIndexOf('capability') === -1 ? 0 : kinds.lastIndexOf('capability'))
      expect(rows.filter((row: any) => row.resource.kind === 'capability').map((row: any) => row.resource.id))
        .toEqual(workspace.capabilities.filter((item: any) => item.domainId === domain.id).map((item: any) => item.id))
      expect(rows.filter((row: any) => row.resource.kind === 'entity').map((row: any) => row.resource.id))
        .toEqual(workspace.entities.filter((item: any) => item.domainId === domain.id).map((item: any) => item.id))
    }
  })

  it('says what a closed row would find: distinct resources below it, by kind, in rail order', () => {
    const order = ['experience', 'screen', 'capability', 'journey', 'capability-scenario', 'journey-scenario']
    for (const card of treeCards(workspace, 'interface', workspace.interfaces, false)) {
      for (const node of flatten([{ id: card.key, title: card.title, resource: card.resource, children: card.children }])) {
        const summary = insideSummary(node)
        const below = flatten(node.children).filter((item: any) => item.resource && item.resource.kind !== node.groupKind && item.resource.kind !== 'variation')
        expect(summary.map((entry: any) => entry.kind)).toEqual(order.filter(kind => below.some((item: any) => item.resource.kind === kind)))
        for (const entry of summary) {
          expect(entry.count).toBe(new Set(below.filter((item: any) => item.resource.kind === entry.kind).map((item: any) => item.resource.key)).size)
        }
        if (!node.children.length) expect(summary).toEqual([])
      }
    }
    /* A Capability exposed on two Screens of one Experience counts once there. */
    const experience = workspace.experiences.find((item: any) => item.id === 'reader-web::personal-library')
    const node = { id: experience.key, title: experience.title, resource: experience, children: structureChildren(workspace, experience) }
    const occurrences = flatten(node.children).filter((item: any) => item.resource?.kind === 'capability')
    const capabilities = insideSummary(node).find((entry: any) => entry.kind === 'capability')
    expect(capabilities.count).toBe(new Set(occurrences.map((item: any) => item.resource.key)).size)
    expect(capabilities.count).toBeLessThan(occurrences.length)
    /* A group already counts its own kind, so it names only what lies deeper. */
    const screens = node.children.find((item: any) => item.groupKind === 'screen')
    expect(insideSummary(screens).some((entry: any) => entry.kind === 'screen')).toBe(false)
    expect(insideLabel([{ kind: 'screen', count: 1 }, { kind: 'capability', count: 3 }])).toBe('1 Screen, 3 Capabilities')
  })

  it('draws what a Rule applies to as a tree: targets by kind, holding only the places the Rule names', () => {
    const rule = workspace.rules.find((item: any) => item.id === 'collection-membership-never-saves-or-unsaves-an-item')
    const tree = ruleScope(workspace, rule)
    expect(tree.map((group: any) => [group.title, group.groupKind, group.children.length])).toEqual([['Capabilities', 'capability', 4], ['Journeys', 'journey', 1]])
    /* No Context named: the target's own places are read on its page, not drawn here. */
    for (const node of tree.flatMap((group: any) => group.children)) expect([node.note, node.children]).toEqual(['Every supported Context', []])
    /* An Entity target notes its operation, and holds places only where the Rule narrows it, each saying where it sits. */
    const narrowed = workspace.rules.find((item: any) => item.id === 'public-addresses-are-the-owners')
    const [entities] = ruleScope(workspace, narrowed)
    expect(entities.children.map((node: any) => [node.resource.key, node.note, node.children.length])).toEqual([['entity:collection', 'reads · Public address · Only in 1 place', 1]])
    const [place] = entities.children[0].children
    expect(place.id).toBe(`${entities.children[0].id}>${place.resource.key}`)
    expect(place.note).toBe(resourceAncestors(workspace, place.resource).map((item: any) => item.title).join(' · ') || undefined)
    const open = workspace.rules.find((item: any) => item.id === 'only-the-owner-reads-an-unpublished-collection')
    expect(ruleScope(workspace, open)[0].children.map((node: any) => [node.note, node.children.length])).toEqual([['reads', 0]])
    /* A Context target is the place itself; a narrowed behaviour holds only the places named. Groups follow rail order. */
    const screen = workspace.screens.find((item: any) => item.id === 'reader-web::personal-library::source-list')
    const capability = workspace.capabilities.find((item: any) => item.id === 'follow-source')
    const synthetic = { ...rule, appliesTo: [
      { type: 'capability', id: capability.id, contexts: [{ placeId: screen.id }] },
      { type: 'context', context: { placeId: screen.id } }
    ] }
    expect(ruleScope(workspace, synthetic).map((group: any) => [group.title, group.children.map((node: any) => [node.resource.key, node.note, node.children.map((child: any) => child.resource.key)])])).toEqual([
      ['Screens', [[screen.key, 'Everything done here', []]]],
      ['Capabilities', [[capability.key, 'Only in 1 place', [screen.key]]]]
    ])
  })

  it('reads every edge of a Rule\'s Applies to tree at its other end', () => {
    const rule = workspace.rules.find((item: any) => item.id === 'collection-membership-never-saves-or-unsaves-an-item')
    const saving = workspace.capabilities.find((item: any) => item.id === 'add-collection-item')
    expect(attachedRules(workspace, saving).filter((item: any) => item.rule.key === rule.key).map((item: any) => [item.hookLabel, item.hook])).toEqual([['Where', 'Every supported Context']])
    /* The Rules that name it are a tab of their own, before Connections, never Overview blocks. */
    const tabs = tabsFor(workspace, saving)
    expect(tabs.find((tab: any) => tab.id === 'rules')).toMatchObject({ label: 'Business Rules', count: attachedRules(workspace, saving).length, blocks: ['rules'] })
    expect(tabs.map((tab: any) => tab.id).slice(-2)).toEqual(['rules', 'connections'])
    expect(tabs[0].blocks).not.toContain('rules')
    /* Reach is not naming: a place the Capability is available in does not list the Rule. */
    for (const context of saving.contexts) {
      const place = placesOf(workspace, [context])[0]
      expect(attachedRules(workspace, place).some((item: any) => item.rule.key === rule.key)).toBe(false)
    }
    const narrowed = workspace.rules.find((item: any) => item.id === 'public-addresses-are-the-owners')
    const collection = workspace.entities.find((item: any) => item.id === 'collection')
    const [named] = ruleScope(workspace, narrowed)[0].children[0].children
    expect(attachedRules(workspace, collection).find((item: any) => item.rule.key === narrowed.key)).toMatchObject({ hookLabel: 'Selects', hook: `reads · Public address · Only in ${named.resource.title}` })
    expect(attachedRules(workspace, named.resource).find((item: any) => item.rule.key === narrowed.key)).toMatchObject({ hookLabel: 'Here, for', hook: 'Collection · reads · Public address' })
    expect(tabsFor(workspace, named.resource).map((tab: any) => tab.id)).toContain('rules')
    /* A Context target and a Scenario target are read at their other end too. */
    const screen = workspace.screens.find((item: any) => item.id === 'reader-web::personal-library::source-list')
    const scenario = workspace.scenarios.find((item: any) => item.scenarioType === 'capability' && item.capabilityId === 'follow-source')
    const synthetic = { ...rule, appliesTo: [
      { type: 'context', context: { placeId: screen.id } },
      { type: 'capability-scenario', id: scenario.id, contexts: [] }
    ] }
    const withSynthetic = { ...workspace, rules: [synthetic] }
    expect(attachedRules(withSynthetic, screen).map((item: any) => [item.hookLabel, item.hook])).toEqual([['Where', 'Everything done here']])
    const follow = workspace.capabilities.find((item: any) => item.id === 'follow-source')
    expect(attachedRules(withSynthetic, follow).map((item: any) => [item.hookLabel, item.hook])).toEqual([['On', scenario.title]])
  })

  it('reads a Rule as its statement and who may, then an Applies to tab', () => {
    for (const rule of workspace.rules) {
      const tabs = tabsFor(workspace, rule)
      expect(tabs.map((tab: any) => tab.id).slice(0, 2)).toEqual(['overview', 'applies-to'])
      expect(tabs[1]).toMatchObject({ label: 'Applies to', count: rule.appliesTo.length, blocks: ['rule-scope'] })
      /* The count is the tab's; the Overview does not repeat it. */
      expect(resourceFacts(workspace, rule)).toEqual([])
      expect(tabs[0].blocks.includes('detail')).toBe(Boolean(rule.rationale || rule.intent || rule.permits !== null))
    }
  })
})

describe('resource types a tree card collection leaves undrawn', () => {
  const kinds = (cards: any[]) => new Set(flatten(cards.flatMap((card: any) => card.children)).flatMap((node: any) => node.resource ? [node.resource.kind] : []))
  const screensOf = (cards: any[]) => flatten(cards.flatMap((card: any) => card.children)).filter((node: any) => node.resource?.kind === 'screen').map((node: any) => node.resource.key).sort()
  const all = treeCards(workspace, 'interface', workspace.interfaces, false)

  it('offers each tree card collection the types its trees hold, a dependent type hiding with its parent', () => {
    expect(TREE_KIND_CHOICES.interface.map((choice: any) => choice.kind)).toEqual(['experience', 'screen', 'capability', 'capability-scenario', 'journey', 'journey-scenario'])
    expect(TREE_KIND_CHOICES.domain.map((choice: any) => choice.kind)).toEqual(['capability', 'entity'])
    expect([...hiddenTreeKinds('interface', ['capability'])].sort()).toEqual(['capability', 'capability-scenario'])
    expect([...hiddenTreeKinds('interface', ['rule'])]).toEqual([])
  })

  it('leaves the Screens alone when Capabilities are hidden, and counts only what is drawn', () => {
    expect(kinds(all).has('capability')).toBe(true)
    const places = treeCards(workspace, 'interface', workspace.interfaces, false, hiddenTreeKinds('interface', ['capability', 'journey']))
    expect(['capability', 'capability-scenario', 'journey', 'journey-scenario'].some(kind => kinds(places).has(kind))).toBe(false)
    expect(screensOf(places)).toEqual(screensOf(all))
    for (const group of flatten(places.flatMap((card: any) => card.children)).filter((node: any) => node.groupKind)) {
      /* A Variation's node counts the alternatives it draws, as the unfiltered tree counts them. */
      expect(group.count).toBe(group.children.reduce((total: number, child: any) => total + (child.resource?.kind === 'variation' ? child.children.filter((each: any) => !each.absentFrom).length : 1), 0))
    }
    for (const card of places) expect(insideSummary({ id: card.key, title: card.title, children: card.children }).map((item: any) => item.kind)).not.toContain('capability')
  })

  it('lifts what a hidden Experience held, each lifted row noting the Experience', () => {
    const lifted = treeCards(workspace, 'interface', workspace.interfaces, false, hiddenTreeKinds('interface', ['experience']))
    expect(kinds(lifted).has('experience')).toBe(false)
    expect(screensOf(lifted)).toEqual(screensOf(all))
    const experienceTitles = new Set(workspace.experiences.map((item: any) => item.title))
    const owned = flatten(all.flatMap((card: any) => card.children)).filter((node: any) => node.resource?.kind === 'experience')
      .flatMap((experience: any) => flatten(experience.children).filter((node: any) => node.resource?.kind === 'screen' && !node.sharedFrom).map((node: any) => node.resource.key))
    const notes = flatten(lifted.flatMap((card: any) => card.children)).filter((node: any) => owned.includes(node.resource?.key)).map((node: any) => node.note)
    expect(notes.length).toBe(owned.length)
    expect(notes.every((note: any) => experienceTitles.has(note))).toBe(true)
  })

  it('drops a Domain card\'s group of a hidden type and keeps the card', () => {
    const domains = treeCards(workspace, 'domain', workspace.domains, false, hiddenTreeKinds('domain', ['entity']))
    expect(domains.map((card: any) => card.key)).toEqual(treeCards(workspace, 'domain', workspace.domains, false).map((card: any) => card.key))
    expect(domains.flatMap((card: any) => card.children).some((group: any) => group.groupKind === 'entity')).toBe(false)
  })
})
