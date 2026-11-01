import type { ReportResourceKind } from './reportWorkspace'
import type { ColumnChoice } from '../composables/useColumns'

export type CollectionDrawing = 'rows' | 'graph' | 'matrix'
export interface CollectionControlsProps {
  kind: ReportResourceKind
  drawing: CollectionDrawing
  columns: ColumnChoice
  expandsAnything: boolean
  /** A tree card collection whose resource types the reader may hide, and the ones hidden. */
  kindsOf?: ReportResourceKind
  hiddenKinds?: ReportResourceKind[]
}
