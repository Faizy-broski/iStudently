// Whole-school data import (one workbook: grades … payments). Same endpoints as
// frontend/src/lib/api/school-data-import.ts; router: school-data-import.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { UploadFile } from '../../types'

export interface ImportRowError {
  row: number
  error: string
}

export interface SheetValidationResult {
  sheet: string
  valid_count: number
  invalid_count: number
  errors: ImportRowError[]
}

export interface ValidationReport {
  sheets: SheetValidationResult[]
  total_valid: number
  total_invalid: number
  ok_to_commit: boolean
}

export interface ImportSheetResult {
  sheet: string
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

export type ImportJobStatus = 'queued' | 'validating' | 'awaiting_confirmation' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rolled_back'

export interface SchoolDataImportJob {
  id: string
  school_id: string
  status: ImportJobStatus
  current_phase: string | null
  progress_percent: number
  original_filename: string | null
  validation_report: ValidationReport | null
  result_summary: { sheets: ImportSheetResult[]; generated_credentials: GeneratedCredential[] } | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/** Statuses after which the job no longer changes (web stops polling). */
export const IMPORT_DONE: ImportJobStatus[] = ['completed', 'failed', 'rolled_back', 'cancelled']

export function adminSchoolDataImportApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** Template workbook (binary, needs the auth header): download it with this path. */
    templatePath: '/school-data-import/template',
    validate: (file: UploadFile, campusId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      if (campusId) form.append('campus_id', campusId)
      return api.post<{ token: string; report: ValidationReport }>('/school-data-import/validate', form, { timeout: 180_000 })
    },
    commit: (token: string, originalFilename?: string, campusId?: string) =>
      api.post<{ job_id: string }>('/school-data-import/commit', { token, original_filename: originalFilename, campus_id: campusId }),
    job: (jobId: string, campusId?: string) => api.get<SchoolDataImportJob>(`/school-data-import/jobs/${id(jobId)}${qs({ school_id: campusId })}`),
    jobs: (campusId?: string) => api.get<SchoolDataImportJob[]>(`/school-data-import/jobs${qs({ school_id: campusId })}`),
    rollback: (jobId: string, campusId?: string) =>
      api.post<{ rolled_back: boolean; errors: string[] }>(`/school-data-import/jobs/${id(jobId)}/rollback`, { campus_id: campusId }),
  }
}
