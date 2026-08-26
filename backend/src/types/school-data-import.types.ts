// ============================================================================
// Full School Data Import — shared types
//
// Backs a single consolidated workbook upload that migrates an entire school
// in from an outside system: Grades, Sections, Subjects, Fee Categories, Fee
// Structures, Teachers, Staff, Students, Parents, historical Invoices, and
// historical Payments — all cross-referenced by natural keys (names/external
// ids) instead of the internal UUIDs the source system never had.
//
// See backend/src/services/school-data-import.service.ts for the orchestrator
// and C:\Users\hp\.claude\plans\quirky-leaping-willow.md for the full design.
// ============================================================================

export const IMPORT_SHEET_NAMES = [
  'Grades',
  'Sections',
  'Subjects',
  'FeeCategories',
  'FeeStructures',
  'Teachers',
  'Staff',
  'Students',
  'Parents',
  'Invoices',
  'Payments'
] as const

export type ImportSheetName = typeof IMPORT_SHEET_NAMES[number]

// Dependency order the commit phase (and validation's ID-map building) must
// follow — each phase can reference natural keys resolved by every phase
// before it, never after.
export const IMPORT_PHASE_ORDER: ImportSheetName[] = [
  'Grades',
  'Sections',
  'Subjects',
  'FeeCategories',
  'FeeStructures',
  'Teachers',
  'Staff',
  'Students',
  'Parents',
  'Invoices',
  'Payments'
]

export type ImportJobStatus =
  | 'queued'
  | 'validating'
  | 'awaiting_confirmation'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolled_back'

export interface ImportRowError {
  row: number
  error: string
}

export interface SheetValidationResult {
  sheet: ImportSheetName
  valid_count: number
  invalid_count: number
  errors: ImportRowError[]
}

export interface ValidationReport {
  sheets: SheetValidationResult[]
  total_valid: number
  total_invalid: number
  // True only when every sheet present in the workbook had zero invalid rows —
  // the frontend uses this to gate the "Confirm & Import" button.
  ok_to_commit: boolean
}

export interface SheetResult {
  sheet: ImportSheetName
  created: number
  skipped: number
  failed: number
  errors: ImportRowError[]
}

export interface GeneratedCredential {
  entity: 'teacher' | 'staff' | 'student' | 'parent'
  row: number
  name: string
  username: string
  password?: string
}

export interface ImportResultSummary {
  sheets: SheetResult[]
  generated_credentials: GeneratedCredential[]
}

export interface SchoolDataImportJob {
  id: string
  school_id: string
  status: ImportJobStatus
  current_phase: string | null
  progress_percent: number
  file_ref: string | null
  original_filename: string | null
  validation_report: ValidationReport | null
  result_summary: ImportResultSummary | null
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}
