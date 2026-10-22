<script setup lang="ts">
/** A version's mark: a branch, a tag or a commit. */
import type { ComparisonVersion } from '../utils/reportComparison'

const props = defineProps<{ kind: ComparisonVersion['kind'] }>()
const ICONS: Record<ComparisonVersion['kind'], string> = {
  head: 'i-lucide-git-commit-horizontal',
  'branch-base': 'i-lucide-git-branch',
  branch: 'i-lucide-git-branch',
  tag: 'i-lucide-tag',
  commit: 'i-lucide-git-commit-horizontal'
}
const icon = computed(() => ICONS[props.kind])
</script>

<template>
  <UIcon :name="icon" class="size-4 shrink-0 text-muted" />
</template>
