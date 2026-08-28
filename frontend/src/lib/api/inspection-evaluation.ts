import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type EvaluationStatus = 'draft' | 'submitted' | 'finalized'
export type EvidenceFileType = 'photo' | 'audio'

export interface EvaluationScore {
  id: string
  evaluation_id: string
  criterion_id: string
  score: number
  comment: string | null
}

export interface EvidenceFile {
  id: string
  evaluation_id: string
  criterion_id: string | null
  file_name: string
  file_type: EvidenceFileType
  created_at: string
}

export interface EvaluationDetail {
  id: string
  visit_id: string
  teacher_profile_id: string
  rubric_template_id: string
  status: EvaluationStatus
  overall_score: number | null
  inspector_notes: string | null
  submitted_at: string | null
  rubric_template: {
    id: string
    name: string
    categories: Array<{
      id: string
      name: string
      weight: number
      criteria: Array<{ id: string; name: string; description: string | null }>
    }>
  } | null
  scores: EvaluationScore[]
  evidence: EvidenceFile[]
  teacher: { id: string; first_name: string; last_name: string } | null
}

export interface CoursePeriodListItem {
  id: string
  title: string | null
  short_name: string | null
  section_name: string | null
}

export interface GradeSampleRow {
  student_id: string
  student_name: string
  assignment_title: string | null
  points: number | null
  letter_grade: string | null
  comment: string | null
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })

    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }

    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// ============================================================================
// INSPECTOR
// ============================================================================

export const getOrCreateDraftEvaluation = (visitId: string, teacherProfileId: string) =>
  apiFetch<EvaluationDetail>('/inspection-evaluations', {
    method: 'POST',
    body: JSON.stringify({ visit_id: visitId, teacher_profile_id: teacherProfileId }),
  })

export const saveScore = (evaluationId: string, criterionId: string, score: number, comment?: string) =>
  apiFetch<EvaluationScore>(`/inspection-evaluations/${evaluationId}/scores`, {
    method: 'POST',
    body: JSON.stringify({ criterion_id: criterionId, score, comment }),
  })

export const submitEvaluation = (evaluationId: string) =>
  apiFetch<EvaluationDetail>(`/inspection-evaluations/${evaluationId}/submit`, { method: 'POST' })

export const removeEvidence = (evidenceId: string) =>
  apiFetch<null>(`/inspection-evaluations/evidence/${evidenceId}`, { method: 'DELETE' })

export const listCoursePeriodsForTeacher = (teacherId: string, schoolId: string) =>
  apiFetch<CoursePeriodListItem[]>(`/inspection-evaluations/course-periods/teacher/${teacherId}?school_id=${schoolId}`)

export const getGradeSampleForComparison = (coursePeriodId: string, sampleSize = 5) =>
  apiFetch<GradeSampleRow[]>(`/inspection-evaluations/grade-sample/${coursePeriodId}?sample_size=${sampleSize}`)

/** Multipart upload — cannot use the shared JSON apiFetch helper above. */
export async function uploadEvidence(
  evaluationId: string,
  file: File,
  criterionId?: string
): Promise<ApiResponse<EvidenceFile>> {
  const token = await getAuthToken()
  if (!token) return { data: null, error: 'Authentication required' }

  const formData = new FormData()
  formData.append('file', file)
  if (criterionId) formData.append('criterion_id', criterionId)

  try {
    const res = await fetch(`${API_URL}/inspection-media/${evaluationId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeaders() },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) return { data: null, error: json?.error || 'Upload failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// ============================================================================
// SHARED (inspector, admin, teacher — server enforces per-role access)
// ============================================================================

export const getEvaluation = (id: string) =>
  apiFetch<EvaluationDetail>(`/inspection-evaluations/${id}`)

export const listEvaluationsForVisit = (visitId: string) =>
  apiFetch<Array<{ id: string; status: EvaluationStatus; overall_score: number | null; teacher: { id: string; first_name: string; last_name: string } }>>(
    `/inspection-evaluations/visit/${visitId}`
  )

export const getEvidenceSignedUrl = (evidenceId: string) =>
  apiFetch<{ url: string; file_name: string }>(`/inspection-evaluations/evidence/${evidenceId}/signed-url`)

// ============================================================================
// TEACHER
// ============================================================================

export const getEvaluationForTeacher = (visitId: string) =>
  apiFetch<EvaluationDetail | null>(`/inspection-evaluations/teacher/visit/${visitId}`)
