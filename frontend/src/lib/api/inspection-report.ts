import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type ReportStatus = 'pending_signatures' | 'fully_signed'
export type SignerRole = 'teacher' | 'principal' | 'inspector'

export interface ReportSignature {
  id: string
  signer_role: SignerRole
  signer_profile_id: string
  typed_full_name: string
  attested_at: string
}

export interface InspectionReport {
  id: string
  evaluation_id: string
  visit_id: string
  school_id: string
  teacher_profile_id: string
  inspector_profile_id: string
  status: ReportStatus
  pdf_file_url: string | null
  generated_at: string | null
  fully_signed_at: string | null
  created_at: string
}

export interface ReportDetail extends InspectionReport {
  signatures: ReportSignature[]
  teacher: { id: string; first_name: string; last_name: string } | null
  inspector: { id: string; first_name: string; last_name: string } | null
  school: { id: string; name: string } | null
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

export const getOrCreateReport = (evaluationId: string) =>
  apiFetch<InspectionReport>('/inspection-reports', { method: 'POST', body: JSON.stringify({ evaluation_id: evaluationId }) })

export const listReportsForInspector = () =>
  apiFetch<Array<InspectionReport & { school: { id: string; name: string }; teacher: { id: string; first_name: string; last_name: string } }>>(
    '/inspection-reports/inspector/mine'
  )

// ============================================================================
// SHARED (inspector, admin, teacher)
// ============================================================================

export const getReport = (id: string) =>
  apiFetch<ReportDetail>(`/inspection-reports/${id}`)

export const getReportForEvaluation = (evaluationId: string) =>
  apiFetch<ReportDetail | null>(`/inspection-reports/evaluation/${evaluationId}`)

export const getReportPdfSignedUrl = (id: string) =>
  apiFetch<{ url: string }>(`/inspection-reports/${id}/pdf-url`)

/** Multipart upload of the client-generated PDF Blob — cannot use the shared JSON apiFetch helper. */
export async function uploadReportPdf(reportId: string, pdfBlob: Blob): Promise<ApiResponse<InspectionReport>> {
  const token = await getAuthToken()
  if (!token) return { data: null, error: 'Authentication required' }

  const formData = new FormData()
  formData.append('file', pdfBlob, 'report.pdf')

  try {
    const res = await fetch(`${API_URL}/inspection-media/reports/${reportId}/upload`, {
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
// ADMIN
// ============================================================================

export const listReportsForSchool = (schoolId: string) =>
  apiFetch<Array<InspectionReport & { teacher: { id: string; first_name: string; last_name: string }; inspector: { id: string; first_name: string; last_name: string } }>>(
    `/inspection-reports/school/${schoolId}`
  )

// ============================================================================
// TEACHER
// ============================================================================

export const listReportsForTeacher = () =>
  apiFetch<Array<InspectionReport & { school: { id: string; name: string } }>>('/inspection-reports/mine')
