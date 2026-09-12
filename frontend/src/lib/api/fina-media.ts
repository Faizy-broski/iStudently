import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type FinaMediaKind = 'image' | 'video'
export type FinaProcessingState = 'pending_tagging' | 'pending_variants' | 'ready' | 'failed'
export type FinaMediaVariant = 'thumb' | 'sm' | 'md' | 'lg' | 'blurred'

export interface FinaMedia {
  id: string
  school_id: string
  uploader_id: string
  kind: FinaMediaKind
  width: number | null
  height: number | null
  duration_sec: number | null
  bytes: number | null
  processing_state: FinaProcessingState
  no_identifiable_students: boolean
  min_consent_level: number | null
  has_unconsented: boolean
  uploaded_at: string
  confirmed_at: string | null
  confirmed_by: string | null
}

export interface FinaFaceTag {
  id: string
  media_id: string
  student_id: string | null
  bbox: { x: number; y: number; w: number; h: number }
  source: 'manual' | 'corrected'
  student?: { id: string; profile: { first_name: string | null; last_name: string | null } } | null
}

export interface CandidateStudent {
  id: string
  profile: { first_name: string | null; last_name: string | null } | null
  section: { name: string } | null
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
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

export const uploadFinaMedia = async (file: File): Promise<ApiResponse<FinaMedia>> => {
  try {
    const token = await getAuthToken()
    const formData = new FormData()
    formData.append('file', file)

    // No Content-Type header here — the browser sets multipart/form-data
    // with the correct boundary itself when the body is a FormData instance.
    const res = await fetch(`${API_URL}${withCampusParam('/fina/media/upload')}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
      },
      body: formData,
    })

    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }

    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Upload failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export const listPendingTagging = () => apiFetch<FinaMedia[]>('/fina/media/pending')

export const listMyReadyMedia = () => apiFetch<FinaMedia[]>('/fina/media/mine/ready')

export const getMediaForTagging = (mediaId: string) =>
  apiFetch<{ media: FinaMedia; tags: FinaFaceTag[]; candidateStudents: CandidateStudent[] }>(`/fina/media/${mediaId}/tagging`)

export const addFaceTag = (mediaId: string, studentId: string) =>
  apiFetch<FinaFaceTag>(`/fina/media/${mediaId}/face-tags`, { method: 'POST', body: JSON.stringify({ student_id: studentId }) })

export const removeFaceTag = (mediaId: string, tagId: string) =>
  apiFetch<null>(`/fina/media/${mediaId}/face-tags/${tagId}`, { method: 'DELETE' })

export const setNoIdentifiableStudents = (mediaId: string, value: boolean) =>
  apiFetch<FinaMedia>(`/fina/media/${mediaId}/no-identifiable-students`, { method: 'POST', body: JSON.stringify({ value }) })

export const confirmTagging = (mediaId: string) =>
  apiFetch<FinaMedia>(`/fina/media/${mediaId}/confirm-tagging`, { method: 'POST' })

/**
 * Deletes an unused media asset. The backend refuses if the asset is already
 * attached to any post or story — so this is safe to call without extra
 * guards on the caller side. Only the uploader (or an admin) can delete.
 */
export const deleteFinaMedia = (mediaId: string) =>
  apiFetch<null>(`/fina/media/${mediaId}`, { method: 'DELETE' })

/**
 * Fetches the gate-protected raw preview of a not-yet-confirmed media item
 * (staff-only, used by the tagging screen) as a same-origin object URL.
 * Can't be a plain `<img src>` to a backend URL — the endpoint requires a
 * Bearer token, which <img> tags cannot attach. Caller MUST revoke the
 * returned URL (URL.revokeObjectURL) when done to avoid leaking memory.
 *
 * Pass `thumb: true` for small on-screen uses (the "needs tagging" grid) —
 * pending media has no generated variants yet (those only exist once
 * confirmTagging enqueues the variant job), so without this the grid was
 * downloading the full, un-resized original for every little 80px square,
 * which is what made "add photos" feel like it hung. `thumb` asks the
 * backend to resize before sending instead of after. Leave it off for the
 * single big tagging photo, which does need full resolution to identify faces.
 */
export async function getRawMediaPreviewUrl(mediaId: string, opts?: { thumb?: boolean }): Promise<{ url: string | null; error: string | null }> {
  try {
    const token = await getAuthToken()
    const path = `/fina/media/${mediaId}/raw${opts?.thumb ? '?thumb=1' : ''}`
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { url: null, error: 'Session expired' }
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { url: null, error: json.error || 'Failed to load media' }
    }
    const blob = await res.blob()
    return { url: URL.createObjectURL(blob), error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/**
 * Fetches a gate-protected, watermarked media variant (post-confirmation,
 * general viewing) as a same-origin object URL. Same rationale as
 * getRawMediaPreviewUrl — the endpoint needs a Bearer token and returns a
 * per-viewer watermarked image, so it can never be a static, cacheable
 * <img src> URL. Caller MUST revoke the returned URL when done.
 */
export async function getFinaMediaVariantUrl(
  mediaId: string,
  variant: FinaMediaVariant
): Promise<{ url: string | null; error: string | null }> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(`/fina/media/${mediaId}/${variant}`)}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...getImpersonationHeaders() },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { url: null, error: 'Session expired' }
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { url: null, error: json.error || 'Not available' }
    }
    const blob = await res.blob()
    return { url: URL.createObjectURL(blob), error: null }
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}
