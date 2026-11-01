/**
 * How many rows sit side by side, per collection.
 *
 * The one thing about a drawing a reader may set: a scanner wants one wide row
 * per resource, a comparer wants three narrow ones. It is kept in this
 * browser's local storage, like the tooltips preference, and it is keyed by
 * collection, because five Entities and forty Capabilities are not read the
 * same way. A prerendered page draws the defaults until hydration finishes,
 * then the stored choice. The control always says a number: an "Auto" that
 * meant one thing for rows and another for cards told the reader nothing.
 */
import type { ReportResourceKind } from '../utils/reportWorkspace'

export const COLUMN_CHOICES = [1, 2, 3, 4] as const
export type ColumnChoice = typeof COLUMN_CHOICES[number]

/** A collection, or the Changes a comparison lists. */
export type ColumnsKey = ReportResourceKind | 'changes'
type Preference = Partial<Record<ColumnsKey, number>>

/* Keep only well-formed entries; `columnsFor` still checks each choice. */
function parsePreference(stored: unknown): Preference | undefined {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined
  return Object.fromEntries(
    Object.entries(stored).filter(([, value]) => COLUMN_CHOICES.includes(value as ColumnChoice))
  ) as Preference
}

export function useColumns() {
  const preference = usePddKitStoredPreference<Preference>('pdd-kit:columns', () => ({}), parsePreference)

  /** The reader's choice for this collection, else the drawing's own default. */
  const columnsFor = (kind: ColumnsKey, fallback: ColumnChoice = 1): ColumnChoice => {
    const value = preference.value?.[kind]
    return COLUMN_CHOICES.includes(value as ColumnChoice) ? value as ColumnChoice : fallback
  }

  const setColumns = (kind: ColumnsKey, columns: ColumnChoice) => {
    preference.value = { ...preference.value, [kind]: columns }
  }

  return { columnsFor, setColumns }
}
