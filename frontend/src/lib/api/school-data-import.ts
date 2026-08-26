import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { getImpersonationHeaders } from './abortable-fetch'

// ============================================================================
// Full School Data Import — API client
//
// Mirrors media-upload.ts's multipart-upload convention for /validate (the
// only endpoint that takes a file). Everything else is plain JSON, matching
// the rest of the API client modules.
// ============================================================================

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

export interface SheetResult {
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

export interface ImportResultSummary {
  sheets: SheetResult[]
  generated_credentials: GeneratedCredential[]
}

export type ImportJobStatus =
  | 'queued' | 'validating' | 'awaiting_confirmation' | 'running'
  | 'completed' | 'failed' | 'cancelled' | 'rolled_back'

export interface SchoolDataImportJob {
  id: string
  school_id: string
  status: ImportJobStatus
  current_phase: string | null
  progress_percent: number
  original_filename: string | null
  validation_report: ValidationReport | null
  result_summary: ImportResultSummary | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken()
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() }
}

async function handle<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 401) {
    handleSessionExpiry()
    return { success: false, error: 'Session expired. Please log in again.' }
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { success: false, error: data.error || `Request failed (${response.status})` }
  return data
}

export function downloadTemplateUrl(): string {
  return `${API_URL}/school-data-import/template`
}

/** Triggers a browser download of the template workbook (needs the auth header, so it's fetched then saved rather than a plain <a href>). */
export async function downloadTemplate(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(downloadTemplateUrl(), { headers: await authHeaders() })
    if (!response.ok) return { success: false, error: 'Failed to download template' }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'studently-school-data-import-template.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export async function validateWorkbook(
  file: File,
  campusId?: string
): Promise<ApiResult<{ token: string; report: ValidationReport }>> {
  try {
    const formData = new FormData()
    formData.append('file', file, file.name)
    if (campusId) formData.append('campus_id', campusId)

    const response = await fetch(`${API_URL}/school-data-import/validate`, {
      method: 'POST',
      headers: await authHeaders(),
      body: formData
    })
    return handle(response)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export async function commitImport(
  token: string,
  originalFilename?: string,
  campusId?: string
): Promise<ApiResult<{ job_id: string }>> {
  try {
    const response = await fetch(`${API_URL}/school-data-import/commit`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, original_filename: originalFilename, campus_id: campusId })
    })
    return handle(response)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export async function getImportJob(jobId: string, campusId?: string): Promise<ApiResult<SchoolDataImportJob>> {
  try {
    const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
    const response = await fetch(`${API_URL}/school-data-import/jobs/${jobId}${qs}`, { headers: await authHeaders() })
    return handle(response)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export async function listImportJobs(campusId?: string): Promise<ApiResult<SchoolDataImportJob[]>> {
  try {
    const qs = campusId ? `?school_id=${encodeURIComponent(campusId)}` : ''
    const response = await fetch(`${API_URL}/school-data-import/jobs${qs}`, { headers: await authHeaders() })
    return handle(response)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export async function rollbackImportJob(jobId: string, campusId?: string): Promise<ApiResult<{ rolled_back: boolean; errors: string[] }>> {
  try {
    const response = await fetch(`${API_URL}/school-data-import/jobs/${jobId}/rollback`, {
      method: 'POST',
      headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ campus_id: campusId })
    })
    return handle(response)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}
