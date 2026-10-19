<script setup lang="ts">
import type { ReportResourceKind, ReportWorkspace } from '../utils/reportWorkspace'
import type { ReportProductCatalogLink, ReportProductLink } from '../utils/reportProducts'

withDefaults(defineProps<{
  workspace: ReportWorkspace
  logoSrc?: string | null
  products?: ReportProductLink[]
  productCatalog?: ReportProductCatalogLink
  activeSection: string
  counts: Record<ReportResourceKind, number>
  tools?: boolean
  vocabulary?: boolean
  collapsed?: boolean
}>(), { vocabulary: true })

const emit = defineEmits<{
  kind: [kind: ReportResourceKind]
  changes: [kind?: ReportResourceKind]
  search: []
  vocabulary: [originId: string]
  navigate: []
}>()
</script>

<template>
  <div data-report-sidebar :data-collapsed="Boolean(collapsed)" class="report-pane flex h-full flex-col py-4" :class="collapsed ? 'px-2' : 'px-3'">
    <div v-if="$slots.brand || $slots.close" class="mb-4 flex min-h-7 shrink-0 items-start gap-2" :class="collapsed ? 'justify-center' : 'justify-between'">
      <slot name="brand" />
      <slot name="close" />
    </div>

    <div class="mb-5 shrink-0">
      <ReportProductPicker
        :title="workspace.identity.title"
        :logo-src="logoSrc"
        :products="products"
        :product-catalog="productCatalog"
        :collapsed="collapsed"
        @navigate="emit('navigate')"
      />
    </div>

    <ReportRail
      :workspace="workspace"
      :collapsed="collapsed"
      :active-section="activeSection"
      :counts="counts"
      class="shrink-0"
      @kind="emit('kind', $event)"
      @changes="emit('changes', $event)"
    >
      <template v-if="tools" #overview-action>
        <ReportTools tool="search" :collapsed="collapsed" @search="emit('search')" />
      </template>
      <template v-if="$slots.navigation" #navigation>
        <slot name="navigation" :collapsed="collapsed" />
      </template>
    </ReportRail>

    <div v-if="(tools && vocabulary !== false) || $slots.footer" data-report-sidebar-footer class="mt-auto shrink-0 pt-6">
      <div class="grid gap-1 border-t border-default pt-3">
        <div v-if="tools && vocabulary !== false" data-report-sidebar-vocabulary>
          <ReportTools tool="vocabulary" :collapsed="collapsed" @vocabulary="emit('vocabulary', $event)" />
        </div>
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
