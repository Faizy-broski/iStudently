import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

// ============================================================================
// TIMETABLE GENERATION JOB API
// Typed client for the FET-style CSP generator's job lifecycle: start, poll
// status, list history, cancel, rollback. Follows the same fetch + Bearer
// token + { success, data, error } convention as `lib/api/timetable.ts`.
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  existing_job_id?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type TimetableGenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TimetableGenerationJobScope = 'all' | 'sections'

export interface TimetableGenerationJob {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  status: TimetableGenerationJobStatus
  scope: TimetableGenerationJobScope
  section_ids: string[] | null
  progress_percent: number
  total_activities: number | null
  placed_activities: number | null
  unplaced_activities: number | null
  hard_violations: number
  soft_score: number | null
  result_summary: {
    unplaced?: Array<{
      activity_id: string
      reason: string
      section_id?: string
      section_name?: string
      subject_id?: string
      subject_name?: string
      teacher_id?: string
      teacher_name?: string
    }>
    warnings?: string[]
    [key: string]: any
  } | null
  error_message: string | null
  cancel_requested: boolean
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface StartGenerationDTO {
  school_id?: string
  campus_id?: string
  academic_year_id: string
  scope: TimetableGenerationJobScope
  section_ids?: string[]
}

export interface StartGenerationResult {
  success: boolean
  job_id?: string
  error?: string
  existing_job_id?: string
}

class GenerationConflictError extends Error {
  existing_job_id: string
  constructor(message: string, existingJobId: string) {
    super(message)
    this.name = 'GenerationConflictError'
    this.existing_job_id = existingJobId
  }
}

export { GenerationConflictError }

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getAuthToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

export async function startGeneration(data: StartGenerationDTO): Promise<{ job_id: string }> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<{ job_id: string }> = await response.json()

  if (response.status === 409 && result.existing_job_id) {
    throw new GenerationConflictError(result.error || 'A generation job is already running', result.existing_job_id)
  }
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to start timetable generation')
  }
  return result.data
}

export async function getJobStatus(jobId: string): Promise<TimetableGenerationJob> {
  const headers = await authHeaders(false)
  const response = await fetch(`${API_URL}/timetable/generate/${jobId}/status`, { headers })
  const result: ApiResponse<TimetableGenerationJob> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch job status')
  return result.data
}

export async function listJobs(
  academicYearId: string,
  page = 1,
  limit = 20
): Promise<{ jobs: TimetableGenerationJob[]; pagination?: ApiResponse['pagination'] }> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({
    academic_year_id: academicYearId,
    page: page.toString(),
    limit: limit.toString()
  })
  const response = await fetch(`${API_URL}/timetable/generate/jobs?${params}`, { headers })
  const result: ApiResponse<TimetableGenerationJob[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch generation jobs')
  return { jobs: result.data || [], pagination: result.pagination }
}

export async function cancelJob(jobId: string): Promise<void> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/generate/${jobId}/cancel`, {
    method: 'POST',
    headers
  })
  const result: ApiResponse = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to cancel generation job')
}

export async function rollbackJob(jobId: string): Promise<{ rolled_back_count: number }> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/generate/${jobId}/rollback`, {
    method: 'POST',
    headers
  })
  const result: ApiResponse<{ rolled_back_count: number }> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to rollback generation job')
  return result.data || { rolled_back_count: 0 }
}
