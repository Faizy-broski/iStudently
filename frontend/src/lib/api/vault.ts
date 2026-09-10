/**
 * AdminVault API client (Phase 1 — Foundation Slice). All endpoints require
 * auth + the caller's role in (super_admin, admin, financial_admin) + the
 * 'vault' plugin active for the school — any other caller gets a uniform
 * 404 from the backend (see vault-access.middleware.ts), never a 403.
 */
import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { getImpersonationHeaders } from './abortable-fetch'

export type VaultCategory =
  | 'facility_utilities'
  | 'legal_licensing'
  | 'financial_procurement'
  | 'it_security'
  | 'hr_confidential'

export const VAULT_CATEGORIES: { value: VaultCategory; label: string }[] = [
  { value: 'facility_utilities', label: 'Facility & Utilities' },
  { value: 'legal_licensing', label: 'Legal & Licensing' },
  { value: 'financial_procurement', label: 'Financial & Procurement' },
  { value: 'it_security', label: 'IT & Security' },
  { value: 'hr_confidential', label: 'HR Confidential' },
]

export type VaultFieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'encrypted_text' | 'file'

export interface VaultFieldDefinition {
  id: string
  school_id: string
  category: VaultCategory
  field_key: string
  label_en: string
  label_ar: string
  field_type: VaultFieldType
  options: string[]
  is_required: boolean
  is_secret: boolean
  sort_order: number
  created_at: string
}

export interface VaultRecord {
  id: string
  school_id: string
  campus_id: string | null
  category: VaultCategory
  sub_category: string
  title: string
  default_fields: Record<string, unknown>
  custom_fields: Record<string, unknown>
  attachments: string[]
  expiry_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Appends `campus_id` as a query param on every vault request (GET included)
 * — requireVaultAccess resolves which school_settings row to check the
 * 'vault' plugin flag against from req.query.campus_id, since profiles has
 * no campus_id column to fall back on. Without this, a school that enabled
 * vault only for one campus (via the campus-scoped Plugins settings page)
 * gets a uniform 404 on every vault call, matching the sibling discipline.ts/
 * hifzi.ts pattern of threading the selected campus through explicitly.
 */
function withCampus(path: string, campusId?: string | null): string {
  if (!campusId) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}campus_id=${encodeURIComponent(campusId)}`
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...getImpersonationHeaders(),
        ...(options.headers || {}),
      },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }
    // A 404 here means either the record truly doesn't exist OR the caller
    // isn't allowed in at all (see vault-access.middleware.ts) — the UI
    // treats both the same way, by design.
    const json = await res.json()
    if (!res.ok) return { success: false, error: json.error || `Request failed (${res.status})` }
    return json
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

// ── Field definitions ──────────────────────────────────────────────────────

export async function listFieldDefinitions(category?: VaultCategory, campusId?: string | null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : ''
  return authFetch<VaultFieldDefinition[]>(withCampus(`/vault/field-definitions${query}`, campusId))
}

export async function createFieldDefinition(
  input: {
    category: VaultCategory
    field_key: string
    label_en: string
    label_ar: string
    field_type: VaultFieldType
    options?: string[]
    is_required?: boolean
    is_secret?: boolean
    sort_order?: number
  },
  campusId?: string | null
) {
  return authFetch<VaultFieldDefinition>(withCampus('/vault/field-definitions', campusId), { method: 'POST', body: JSON.stringify(input) })
}

export async function deleteFieldDefinition(id: string, campusId?: string | null) {
  return authFetch<void>(withCampus(`/vault/field-definitions/${id}`, campusId), { method: 'DELETE' })
}

// ── Records ──────────────────────────────────────────────────────────────

export async function listRecords(category?: VaultCategory, campusId?: string | null) {
  const query = category ? `?category=${encodeURIComponent(category)}` : ''
  return authFetch<VaultRecord[]>(withCampus(`/vault/records${query}`, campusId))
}

export async function getRecord(id: string, campusId?: string | null) {
  return authFetch<VaultRecord>(withCampus(`/vault/records/${id}`, campusId))
}

export async function createRecord(
  input: {
    category: VaultCategory
    sub_category: string
    title: string
    default_fields?: Record<string, unknown>
    custom_fields?: Record<string, unknown>
    attachments?: string[]
    expiry_date?: string | null
  },
  campusId?: string | null
) {
  return authFetch<VaultRecord>(withCampus('/vault/records', campusId), { method: 'POST', body: JSON.stringify(input) })
}

export async function updateRecord(
  id: string,
  input: Partial<{
    title: string
    sub_category: string
    default_fields: Record<string, unknown>
    custom_fields: Record<string, unknown>
    attachments: string[]
    expiry_date: string | null
  }>,
  campusId?: string | null
) {
  return authFetch<VaultRecord>(withCampus(`/vault/records/${id}`, campusId), { method: 'PUT', body: JSON.stringify(input) })
}

export async function deleteRecord(id: string, campusId?: string | null) {
  return authFetch<void>(withCampus(`/vault/records/${id}`, campusId), { method: 'DELETE' })
}

export async function revealSecret(recordId: string, fieldKey: string, campusId?: string | null) {
  return authFetch<{ value: string }>(withCampus(`/vault/records/${recordId}/reveal-secret`, campusId), {
    method: 'POST',
    body: JSON.stringify({ field_key: fieldKey }),
  })
}

// ── Media ────────────────────────────────────────────────────────────────

export async function uploadAttachment(file: File, campusId?: string | null): Promise<{ success: boolean; data?: { storageKey: string }; error?: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch(`${API_URL}${withCampus('/vault/media/upload', campusId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeaders() },
      body: formData,
    })
    const json = await res.json()
    if (!res.ok) return { success: false, error: json.error || `Upload failed (${res.status})` }
    return json
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/**
 * Fetches one attachment (watermarked server-side for images) as a blob URL
 * — a plain <img src> can't carry the Authorization header this
 * auth+role-gated endpoint requires, so the caller fetches the bytes
 * directly and the browser holds them in-memory as an object URL. Caller
 * must URL.revokeObjectURL() when done to avoid leaking memory.
 */
export async function getAttachmentBlobUrl(recordId: string, index: number, campusId?: string | null): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  try {
    const res = await fetch(`${API_URL}${withCampus(`/vault/media/${recordId}/attachments/${index}`, campusId)}`, {
      headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeaders() },
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { success: false, error: json.error || `Failed to load attachment (${res.status})` }
    }
    const blob = await res.blob()
    return { success: true, url: URL.createObjectURL(blob) }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
