<script setup lang="ts">
import type { ProductReport } from 'pdd-toolkit/report'

const route = useRoute()
const { section, resource, tab, resourceTab, scenarioRoute, routeColumns, topology, coverage } = useReportNavigation({ sectionKey: route.query.catalog === '1' ? 'tab' : 's' })

const report: ProductReport = {
  schemaVersion: '20.0.0',
  id: 'packed-layer-smoke',
  title: 'Packed Layer Smoke Test',
  summary: 'Builds the public Nuxt layer from the packed pdd-kit artifact.',
  description: 'The canonical Product Report and stable theme resolve together.',
  category: 'developer-tool',
  authors: [{ name: 'pdd-kit' }],
  license: 'MIT',
  intent: 'Catch missing files, invalid exports, and host-owned dependency mistakes before publication.',
  supportingSections: [],
  references: [],
  referenceProfile: 'portable',
  tags: ['smoke-test'],
  languages: ['en'],
  lintVerbs: [],
  generatedAt: '2026-08-09',
  generator: { name: 'pdd-kit', version: '0.9.0' },
  counts: {
    interfaces: 1,
    experiences: 0,
    screens: 0,
    domains: 0,
    entities: 1,
    capabilities: 0,
    capabilityScenarios: 0,
    journeys: 0,
    journeyScenarios: 0,
    businessRules: 0,
    variations: 0
  },
  limitations: [],
  model: {
    taxonomies: { scenarioKinds: [] },
    entities: [{
      id: 'reader',
      title: 'Reader',
      description: 'A person viewing the report.',
      kind: 'person',
      acts: 'external',
      singleton: false,
      informationKept: [],
      relations: [{ entityId: 'reader', verb: 'knows', cardinality: 'many-to-many' }],
      states: [{ name: 'Active', content: 'The Reader is active.' }, { name: 'Unreached', content: 'No Step reaches this State.' }],
      intent: '',
      supportingSections: [],
      references: []
    }],
    interfaces: [{
      id: 'web',
      title: 'Web',
      description: 'The browser interface.',
      type: 'web',
      actorIds: ['reader'],
      entryPoints: [],
      languages: ['en'],
      intent: '',
      supportingSections: [],
      references: []
    }],
    experiences: [],
    screens: [],
    domains: [],
    capabilities: [],
    capabilityScenarios: [],
    journeys: [],
    journeyScenarios: [],
    businessRules: [],
    variations: []
  },
  coverage: {
    scope: '',
    exclusions: [],
    method: '',
    covered: [],
    unmapped: [],
    limitations: []
  }
}
// Opt in to comparison data without changing the graph/lifecycle smoke fixture.
if (route.query.matrices === '1') {
  const content = { intent: '', supportingSections: [], references: [] }
  report.model.taxonomies.scenarioKinds.push({ id: 'success', name: 'Success', description: 'The intended outcome.' })
  report.model.capabilities.push({ id: 'register-reader', title: 'Register a Reader', description: 'Create a Reader.', availability: [{ placeId: 'web' }], ...content })
  report.model.capabilityScenarios.push({
    id: 'register-reader', capabilityId: 'register-reader', title: 'Register a Reader', kindId: 'success', actorIds: ['reader'],
    routes: [{ id: 'web', name: 'Web' }], trigger: 'A Reader registers.', outcome: 'The Reader is active.', decisionPoints: [], edgeCases: [],
    steps: [{ text: 'Create the Reader.', kind: 'product', actorId: 'reader', capabilityId: null, unattended: false,
      entities: [{ entityId: 'reader', as: null, effect: 'creates', from: null, to: 'Active', facts: [], with: null }], contexts: [{ routeId: 'web', placeId: 'web' }] }],
    ...content
  })
  report.model.businessRules.push({ id: 'readers-start-active', title: 'Readers start active', statement: 'A new Reader is active.', rationale: '', permits: null,
    appliesTo: [{ type: 'entity', entityId: 'reader', effect: 'creates', from: null, to: 'Active', facts: [], contexts: [] }], ...content })
  Object.assign(report.counts, { capabilities: 1, capabilityScenarios: 1, businessRules: 1 })
}
</script>

<template>
  <div>
    <PddKitReportViewer v-for="index in route.query.multi === '1' ? 2 : 1" :key="index" v-model:section="section" v-model:resource="resource" v-model:tab="tab" v-model:resource-tab="resourceTab" v-model:scenario-route="scenarioRoute" v-model:route-columns="routeColumns" v-model:topology="topology" v-model:coverage="coverage" :report="report" />
  </div>
</template>
