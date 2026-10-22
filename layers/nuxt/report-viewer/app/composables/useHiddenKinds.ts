/**
 * Which resource types a tree card collection leaves undrawn, per collection.
 *
 * A drawing choice like the number per row: kept in this browser's local
 * storage and keyed by collection, so hiding Capabilities while going over an
 * Interface's Screens leaves the Domains tree as it was. Only the types the
 * collection offers are kept; a prerendered page draws every type until
 * hydration finishes, then the stored choice.
 */
import type { ReportResourceKind } from '../utils/reportWorkspace'
import { TREE_KIND_CHOICES } from '../utils/collectionChildren'

type Preference = Partial<Record<ReportResourceKind, ReportResourceKind[]>>

const offered = (collection: ReportResourceKind) => new Set((TREE_KIND_CHOICES[collection] ?? []).map(choice => choice.kind))

/* Keep only lists of types each collection offers. */
function parsePreference(stored: unknown): Preference | undefined {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined
  return Object.fromEntries(Object.entries(stored).flatMap(([collection, kinds]) => {
    if (!Array.isArray(kinds)) return []
    const choices = offered(collection as ReportResourceKind)
    return [[collection, kinds.filter(kind => choices.has(kind))]]
  })) as Preference
}

export function useHiddenKinds() {
  const preference = usePddKitStoredPreference<Preference>('pdd-kit:hidden-kinds', () => ({}), parsePreference)

  /** The types the reader hid in this collection. */
  const hiddenFor = (collection: ReportResourceKind): ReportResourceKind[] => {
    const choices = offered(collection)
    return (preference.value?.[collection] ?? []).filter(kind => choices.has(kind))
  }

  const setHidden = (collection: ReportResourceKind, kinds: ReportResourceKind[]) => {
    const choices = offered(collection)
    preference.value = { ...preference.value, [collection]: [...new Set(kinds.filter(kind => choices.has(kind)))] }
  }

  return { hiddenFor, setHidden }
}
