/**
 * `pdd-toolkit/report/compare` — what changed between two Product Reports.
 *
 * A separate entry point from `pdd-toolkit/report` so a browser bundle can
 * compare two reports without the report schemas behind it. The comparison is
 * a derived view model, not part of the Product Report contract.
 */

export {
  COMPARED_KINDS,
  comparedKindLabel,
  compareReports,
  diffWords,
  phraseText
} from './core/report-comparison.js'

export type {
  ChangeCounts,
  ChangeStatus,
  ComparedItem,
  ComparedKind,
  ComparedRef,
  FieldChange,
  ListChange,
  Phrase,
  PhrasePart,
  ReportComparison,
  ResourceChange,
  StepChange,
  StepsChange,
  TextChange,
  TextSegment,
  ValueChange
} from './core/report-comparison.js'
