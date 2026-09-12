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

// campus_id is threaded through explicitly on every requireMiqatEnabled-gated
// call because that middleware resolves it from req.query.campus_id — admin
// accounts don't get campus_id auto-populated on req.profile the way
// teacher/student/parent/staff/librarian accounts do (see auth.middleware.ts).
// Without it, an admin's requests only ever check the school-wide
// (campus_id IS NULL) active_plugins row, even when the module was enabled
// on one specific campus — the exact bug this already caused for Qirtasi
// (see qirtasi-curriculum.ts's identical comment) and would otherwise repeat
// here. /miqat/schools is the one exception: gated by requireAdmin only, no
// requireMiqatEnabled, since school configuration must be reachable before
// the plugin is even turned on.
function withCampus(path: string, campusId?: string): string {
  if (!campusId) return path
  return `${path}${path.includes('?') ? '&' : '?'}campus_id=${campusId}`
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

export async function generateEnrolmentCode(
  role: 'gate' | 'teacher' | 'admin',
  token: string,
  personId?: string,
  campusId?: string
): Promise<ApiResponse<{ code: string; expires_at: string }>> {
  const res = await authedFetch(withCampus('/miqat/devices/generate-code', campusId), token, {
    method: 'POST',
    body: JSON.stringify({ role, person_id: personId, campus_id: campusId }),
  })
  return res.json()
}

export async function listDevices(token: string, campusId?: string): Promise<ApiResponse<MiqatDevice[]>> {
  const res = await authedFetch(withCampus('/miqat/devices', campusId), token)
  return res.json()
}

export async function revokeDevice(deviceId: string, token: string, campusId?: string): Promise<ApiResponse> {
  const res = await authedFetch(withCampus(`/miqat/devices/${deviceId}/revoke`, campusId), token, { method: 'POST' })
  return res.json()
}

export async function issueCard(personId: string, token: string, campusId?: string): Promise<ApiResponse<{ card_id: string; revision: number; qr_payload: string }>> {
  const res = await authedFetch(withCampus('/miqat/cards/issue', campusId), token, { method: 'POST', body: JSON.stringify({ person_id: personId }) })
  return res.json()
}

export async function reportCardLost(personId: string, token: string, campusId?: string): Promise<ApiResponse<{ card_id: string; revision: number; qr_payload: string }>> {
  const res = await authedFetch(withCampus('/miqat/cards/report-lost', campusId), token, { method: 'POST', body: JSON.stringify({ person_id: personId }) })
  return res.json()
}

export interface MiqatChild {
  studentId: string
  profileId: string
  firstName: string
  lastName: string
}

export interface MiqatDayRow {
  id: string
  date: string
  status: string
  first_check_in: string | null
  last_check_out: string | null
  lateness_minutes: number
}

export async function getMyChildren(token: string, campusId?: string): Promise<ApiResponse<MiqatChild[]>> {
  const res = await authedFetch(withCampus('/miqat/attendance/my-children', campusId), token)
  return res.json()
}

export async function getChildDays(personId: string, dateFrom: string, dateTo: string, token: string, campusId?: string): Promise<ApiResponse<MiqatDayRow[]>> {
  const res = await authedFetch(withCampus(`/miqat/attendance/child-days?person_id=${personId}&date_from=${dateFrom}&date_to=${dateTo}`, campusId), token)
  return res.json()
}

export interface MiqatDaySummaryRow {
  status: string
  lateness_minutes: number
  early_departure_minutes: number
}

export async function getSummary(dateFrom: string, dateTo: string, token: string, campusId?: string): Promise<ApiResponse<MiqatDaySummaryRow[]>> {
  const res = await authedFetch(withCampus(`/miqat/attendance/summary?date_from=${dateFrom}&date_to=${dateTo}`, campusId), token)
  return res.json()
}

export async function getDay(date: string, token: string, classId?: string, campusId?: string): Promise<ApiResponse<any[]>> {
  const qs = classId ? `?class_id=${classId}` : ''
  const res = await authedFetch(withCampus(`/miqat/attendance/day/${date}${qs}`, campusId), token)
  return res.json()
}

export interface MiqatPermission {
  id: string
  person_id: string
  requested_by: string
  type: 'late_arrival' | 'early_departure' | 'full_day'
  date_from: string
  date_to: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles?: { first_name: string; last_name: string }
}

export async function listPermissions(status: 'pending' | 'approved' | 'rejected' | undefined, token: string, campusId?: string): Promise<ApiResponse<MiqatPermission[]>> {
  const qs = status ? `?status=${status}` : ''
  const res = await authedFetch(withCampus(`/miqat/permissions${qs}`, campusId), token)
  return res.json()
}

export async function createPermission(
  payload: { person_id: string; type: 'late_arrival' | 'early_departure' | 'full_day'; date_from: string; date_to: string; reason?: string },
  token: string,
  campusId?: string
): Promise<ApiResponse> {
  const res = await authedFetch(withCampus('/miqat/permissions', campusId), token, { method: 'POST', body: JSON.stringify(payload) })
  return res.json()
}

export async function decidePermission(id: string, status: 'approved' | 'rejected', token: string, campusId?: string): Promise<ApiResponse> {
  const res = await authedFetch(withCampus(`/miqat/permissions/${id}`, campusId), token, { method: 'PATCH', body: JSON.stringify({ status }) })
  return res.json()
}

export interface MiqatPatternFlag {
  id: string
  person_id: string
  flag_type: string
  details: Record<string, unknown>
  detected_at: string
  profiles?: { first_name: string; last_name: string }
}

export async function listPatternFlags(token: string, campusId?: string): Promise<ApiResponse<MiqatPatternFlag[]>> {
  const res = await authedFetch(withCampus('/miqat/reports/flags', campusId), token)
  return res.json()
}

export async function acknowledgeFlag(id: string, token: string, campusId?: string): Promise<ApiResponse> {
  const res = await authedFetch(withCampus(`/miqat/reports/flags/${id}/acknowledge`, campusId), token, { method: 'POST' })
  return res.json()
}

async function downloadFile(path: string, token: string, filename: string): Promise<void> {
  const res = await authedFetch(path, token)
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadTimesheet(month: string, token: string, campusId?: string): Promise<void> {
  return downloadFile(withCampus(`/miqat/reports/timesheet?month=${month}`, campusId), token, `Miqat_Timesheet_${month}.xlsx`)
}

export async function downloadMinistryReport(dateFrom: string, dateTo: string, token: string, campusId?: string): Promise<void> {
  return downloadFile(withCampus(`/miqat/reports/ministry?date_from=${dateFrom}&date_to=${dateTo}`, campusId), token, `Miqat_Ministry_${dateFrom}_${dateTo}.xlsx`)
}
