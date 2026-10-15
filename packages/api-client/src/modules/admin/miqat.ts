// Miqat (school admin): school config, devices + enrolment codes, cards, live/day summaries,
// permissions, pattern flags and Excel reports. Same endpoints as frontend/src/lib/api/miqat.ts;
// routers: miqat/*.routes.ts. campus_id goes in the query on every plugin-gated call (the
// requireMiqatEnabled middleware reads it there); /miqat/schools is admin-only and not gated.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface MiqatSchoolConfig {
  school_id: string
  lat: number | null
  lng: number | null
  radius_m: number
  max_accuracy_m: number
  photo_retention_days: number
  policy_json: Record<string, unknown>
}

export interface MiqatSchoolConfigInput {
  lat: number
  lng: number
  radius_m?: number
  max_accuracy_m?: number
  photo_retention_days?: number
  policy_json?: Record<string, unknown>
  rotate_signing_key?: boolean
}

export type MiqatDeviceRole = 'gate' | 'teacher' | 'admin'

export interface MiqatDevice {
  id: string
  school_id: string
  label?: string
  role: MiqatDeviceRole
  status: 'active' | 'revoked'
  last_seen_at: string | null
  enrolled_at: string
}

export interface MiqatIssuedCard {
  card_id: string
  revision: number
  qr_payload: string | null
  signing_key_error?: string
}

export interface MiqatQrBatch {
  qr: Record<string, string>
  failed: Record<string, string>
  not_allowed: string[]
  signing_key_error?: string
}

export interface MiqatDaySummaryRow {
  status: string
  lateness_minutes: number
  early_departure_minutes: number
}

export interface MiqatLiveSummary {
  present: number
  late: number
}

export interface MiqatDayEvent {
  id: string
  person_id: string
  event_type: 'check_in' | 'check_out' | 'period_present' | 'period_absent'
  device_time: string
  profiles: { id: string; first_name: string; last_name: string } | null
}

export type MiqatPermissionType = 'late_arrival' | 'early_departure' | 'full_day'
export type MiqatPermissionStatus = 'pending' | 'approved' | 'rejected'

export interface MiqatPermission {
  id: string
  person_id: string
  requested_by: string
  type: MiqatPermissionType
  date_from: string
  date_to: string
  reason?: string
  status: MiqatPermissionStatus
  created_at: string
  profiles?: { first_name: string; last_name: string }
}

export interface MiqatPatternFlag {
  id: string
  person_id: string
  flag_type: string
  details: Record<string, unknown>
  detected_at: string
  profiles?: { first_name: string; last_name: string }
}

/** GET paths of the Excel reports (downloaded with the auth token and shared). */
export const miqatDownloads = {
  timesheet: (month: string, campusId?: string) => `/miqat/reports/timesheet${qs({ month, campus_id: campusId })}`,
  ministry: (dateFrom: string, dateTo: string, campusId?: string) => `/miqat/reports/ministry${qs({ date_from: dateFrom, date_to: dateTo, campus_id: campusId })}`,
}

export function adminMiqatApi(api: ApiClient) {
  return {
    schoolConfig: () => api.get<MiqatSchoolConfig | null>('/miqat/schools'),
    saveSchoolConfig: (body: MiqatSchoolConfigInput) => api.put<MiqatSchoolConfig>('/miqat/schools', body),

    generateCode: (role: MiqatDeviceRole, personId?: string, campusId?: string) =>
      api.post<{ code: string; expires_at: string }>(`/miqat/devices/generate-code${qs({ campus_id: campusId })}`, { role, person_id: personId, campus_id: campusId }),
    devices: (campusId?: string) => api.get<MiqatDevice[]>(`/miqat/devices${qs({ campus_id: campusId })}`),
    revokeDevice: (deviceId: string, campusId?: string) => api.post(`/miqat/devices/${deviceId}/revoke${qs({ campus_id: campusId })}`),

    issueCard: (personId: string, campusId?: string) => api.post<MiqatIssuedCard>(`/miqat/cards/issue${qs({ campus_id: campusId })}`, { person_id: personId }),
    cardQrBatch: (personIds: string[], campusId?: string) => api.post<MiqatQrBatch>(`/miqat/cards/qr${qs({ campus_id: campusId })}`, { person_ids: personIds }),
    reportCardLost: (personId: string, campusId?: string) => api.post<MiqatIssuedCard>(`/miqat/cards/report-lost${qs({ campus_id: campusId })}`, { person_id: personId }),

    summary: (dateFrom: string, dateTo: string, campusId?: string) => api.get<MiqatDaySummaryRow[]>(`/miqat/attendance/summary${qs({ date_from: dateFrom, date_to: dateTo, campus_id: campusId })}`),
    liveSummary: (date: string, campusId?: string) => api.get<MiqatLiveSummary>(`/miqat/attendance/live-summary${qs({ date, campus_id: campusId })}`),
    day: (date: string, classId?: string, campusId?: string) => api.get<MiqatDayEvent[]>(`/miqat/attendance/day/${date}${qs({ class_id: classId, campus_id: campusId })}`),

    permissions: (status?: MiqatPermissionStatus, campusId?: string) => api.get<MiqatPermission[]>(`/miqat/permissions${qs({ status, campus_id: campusId })}`),
    /** Parent role: linked children with their profile ids (web: /parent/miqat). */
    myChildren: (campusId?: string) => api.get<{ studentId: string; profileId: string; firstName: string; lastName: string }[]>(`/miqat/attendance/my-children${qs({ campus_id: campusId })}`),
    /** Parent role: one child's Miqat days between two dates. */
    childDays: (personId: string, dateFrom: string, dateTo: string, campusId?: string) =>
      api.get<{ id: string; date: string; status: string; first_check_in: string | null; last_check_out: string | null; lateness_minutes: number }[]>(
        `/miqat/attendance/child-days${qs({ person_id: personId, date_from: dateFrom, date_to: dateTo, campus_id: campusId })}`,
      ),
    createPermission: (body: { person_id: string; type: MiqatPermissionType; date_from: string; date_to: string; reason?: string }, campusId?: string) =>
      api.post(`/miqat/permissions${qs({ campus_id: campusId })}`, body),
    decidePermission: (id: string, status: 'approved' | 'rejected', campusId?: string) => api.patch(`/miqat/permissions/${id}${qs({ campus_id: campusId })}`, { status }),

    flags: (campusId?: string) => api.get<MiqatPatternFlag[]>(`/miqat/reports/flags${qs({ campus_id: campusId })}`),
    acknowledgeFlag: (id: string, campusId?: string) => api.post(`/miqat/reports/flags/${id}/acknowledge${qs({ campus_id: campusId })}`),
  }
}
