import { API_URL } from '@/config/api'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface MiqatSchoolConfig {
  school_id: string
  lat: number | null
  lng: number | null
  radius_m: number
  max_accuracy_m: number
  photo_retention_days: number
  policy_json: Record<string, unknown>
}

export interface MiqatDevice {
  id: string
  school_id: string
  label?: string
  role: 'gate' | 'teacher' | 'admin'
  status: 'active' | 'revoked'
  last_seen_at: string | null
  enrolled_at: string
}

async function authedFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
}

export async function getSchoolConfig(token: string): Promise<ApiResponse<MiqatSchoolConfig | null>> {
  const res = await authedFetch('/miqat/schools', token)
  return res.json()
}

export async function upsertSchoolConfig(
  payload: {
    lat: number
    lng: number
    radius_m?: number
    max_accuracy_m?: number
    photo_retention_days?: number
    policy_json?: Record<string, unknown>
    rotate_signing_key?: boolean
  },
  token: string
): Promise<ApiResponse<MiqatSchoolConfig>> {
  const res = await authedFetch('/miqat/schools', token, { method: 'PUT', body: JSON.stringify(payload) })
  return res.json()
}

export async function generateEnrolmentCode(role: 'gate' | 'teacher' | 'admin', token: string): Promise<ApiResponse<{ code: string; expires_at: string }>> {
  const res = await authedFetch('/miqat/devices/generate-code', token, { method: 'POST', body: JSON.stringify({ role }) })
  return res.json()
}

export async function listDevices(token: string): Promise<ApiResponse<MiqatDevice[]>> {
  const res = await authedFetch('/miqat/devices', token)
  return res.json()
}

export async function revokeDevice(deviceId: string, token: string): Promise<ApiResponse> {
  const res = await authedFetch(`/miqat/devices/${deviceId}/revoke`, token, { method: 'POST' })
  return res.json()
}

export async function issueCard(personId: string, token: string): Promise<ApiResponse<{ card_id: string; revision: number; qr_payload: string }>> {
  const res = await authedFetch('/miqat/cards/issue', token, { method: 'POST', body: JSON.stringify({ person_id: personId }) })
  return res.json()
}

export async function reportCardLost(personId: string, token: string): Promise<ApiResponse<{ card_id: string; revision: number; qr_payload: string }>> {
  const res = await authedFetch('/miqat/cards/report-lost', token, { method: 'POST', body: JSON.stringify({ person_id: personId }) })
  return res.json()
}

export interface MiqatDaySummaryRow {
  status: string
  lateness_minutes: number
  early_departure_minutes: number
}

export async function getSummary(dateFrom: string, dateTo: string, token: string): Promise<ApiResponse<MiqatDaySummaryRow[]>> {
  const res = await authedFetch(`/miqat/attendance/summary?date_from=${dateFrom}&date_to=${dateTo}`, token)
  return res.json()
}

export async function getDay(date: string, token: string, classId?: string): Promise<ApiResponse<any[]>> {
  const qs = classId ? `?class_id=${classId}` : ''
  const res = await authedFetch(`/miqat/attendance/day/${date}${qs}`, token)
  return res.json()
}

export async function createPermission(
  payload: { person_id: string; type: 'late_arrival' | 'early_departure' | 'full_day'; date_from: string; date_to: string; reason?: string },
  token: string
): Promise<ApiResponse> {
  const res = await authedFetch('/miqat/permissions', token, { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

export async function decidePermission(id: string, status: 'approved' | 'rejected', token: string): Promise<ApiResponse> {
  const res = await authedFetch(`/miqat/permissions/${id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) })
  return res.json()
}
