// Jahbadh grades, Wave 2 data workflows (backend: jahbadh-data.controller.ts, routes in
// jahbadh-grades.routes.ts): name import (B6 #25), daily attendance per stage (#26), rollover to
// next year (#29), homeroom teacher (B9). Every route is under /jahbadh-grades.
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { UploadFile } from '../types'
import type { JgStudent } from './jahbadh-grades'

// ---- name import -------------------------------------------------------------------------------

export type JgImportField =
  | 'name' | 'gender' | 'nationality' | 'registration_number' | 'mother_name' | 'place_of_birth'
  | 'birth_date' | 'national_id' | 'enrollment_status' | 'registration_type' | 'guardian_phone'

/** 1-based column per field; 0 = not used. */
export type JgImportMapping = Partial<Record<JgImportField, number>>

export interface JgImportIssue { level: 'error' | 'warning'; field?: JgImportField; message: string }

export interface JgImportRow {
  line: number
  values: Partial<Record<JgImportField, string>>
  name_parts: { first: string; father: string; grandfather: string; last: string } | null
  gender: 'male' | 'female' | null
  birth_date: string | null
  match: { student_id: string; by: 'registration_number' | 'national_id' | 'name' } | null
  action: 'create' | 'update' | 'skip'
  issues: JgImportIssue[]
}

export interface JgImportPreview {
  has_header: boolean
  headers: string[]
  columns: number
  detected: Record<JgImportField, number>
  mapping: Record<JgImportField, number>
  first_values: Partial<Record<JgImportField, string>>
  fields: { key: JgImportField; label: string }[]
  rows: JgImportRow[]
  counts: { total: number; create: number; update: number; skip: number; errors: number; warnings: number }
}

export interface JgImportResult {
  created: number
  updated: number
  skipped: number
  failed: { line: number; message: string }[]
  credentials: { line: number; student_id: string; name: string; username: string | null; password: string | null }[]
  not_stored: JgImportField[]
}

/** Pasted text (TSV/CSV), or a .csv/.xlsx file. */
export interface JgImportRequest {
  text?: string
  file?: UploadFile
  has_header?: boolean
  mapping?: JgImportMapping
}

// ---- daily attendance --------------------------------------------------------------------------

export type JgDayCode = 'غ' | 'ع' | 'ت'

export interface JgAttendanceCalendar {
  configured: boolean
  stage_starts: [string | null, string | null, string | null]
  year_end: string | null
  /** 0 = Sunday … 6 = Saturday (default Friday + Saturday). */
  weekend_days: number[]
  holidays: string[]
  alert_limit: number
}

export interface JgStageDays { stage: number; name: string; start: string | null; end: string | null; days: string[] }

export interface JgAttendanceCell { code: JgDayCode | null; source: 'jahbadh' | 'platform' | null }

export interface JgAttendanceRow {
  student: JgStudent
  days: Record<string, JgAttendanceCell>
  totals: Record<number, Record<JgDayCode, number>>
  unexcused_total: number
  alert: boolean
}

export interface JgDailyAttendance {
  calendar: JgAttendanceCalendar
  stage: number
  stages: JgStageDays[]
  days: string[]
  codes: JgDayCode[]
  rows: JgAttendanceRow[]
  alert_count: number
  can_edit: boolean
}

/** `null` = present (also over a platform absence); `'auto'` = back to the platform's attendance. */
export interface JgAttendanceEntry { student_id: string; date: string; code: JgDayCode | null | 'auto' }

// ---- rollover ----------------------------------------------------------------------------------

export type JgRolloverKind = 'promote' | 'repeat' | 'graduate' | 'hold'

export interface JgRolloverRow {
  student: JgStudent
  decision: string
  kind: JgRolloverKind
  status: 'promoted' | 'retained' | 'graduated' | 'pending'
  enrollment_label: 'مستجد' | 'معيد' | null
  next_grade_id: string | null
  pct: number | null
  no_enrollment: boolean
}

export interface JgRolloverPreview {
  grade_code: number
  next_grade_options: { id: string; name: string; grade_code: number }[]
  rows: JgRolloverRow[]
  counts: Record<JgRolloverKind, number>
}

export interface JgRolloverResult { planned: number; held: number; missing_next_grade: string[]; no_enrollment: string[] }

// ---- homeroom ----------------------------------------------------------------------------------

export interface JgHomeroom { section_id: string; academic_year_id: string; staff_id: string | null; name: string | null }

export function jahbadhDataApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const cq = (campusId?: string | null, academicYearId?: string | null) => qs({ campus_id: campusId ?? undefined, academic_year_id: academicYearId ?? undefined })

  const importBody = (body: JgImportRequest, campusId?: string | null) => {
    if (!body.file) return { text: body.text, has_header: body.has_header, mapping: body.mapping, campus_id: campusId ?? undefined }
    const form = new FormData()
    form.append('file', body.file as Blob)
    if (body.text) form.append('text', body.text)
    if (body.has_header !== undefined) form.append('has_header', String(body.has_header))
    if (body.mapping) form.append('mapping', JSON.stringify(body.mapping))
    if (campusId) form.append('campus_id', campusId)
    return form
  }

  return {
    /** Columns recognised from the headers + every row's match and issues; nothing is written. */
    importPreview: (sectionId: string, body: JgImportRequest, campusId?: string | null) =>
      api.post<JgImportPreview>(`/jahbadh-grades/sections/${id(sectionId)}/import/preview${cq(campusId)}`, importBody(body, campusId), { timeout: 60_000 }),
    /** Creates new students and updates matched ones (names of matched students are kept). */
    importApply: (sectionId: string, body: JgImportRequest, campusId?: string | null) =>
      api.post<JgImportResult>(`/jahbadh-grades/sections/${id(sectionId)}/import/apply${cq(campusId)}`, importBody(body, campusId), { timeout: 180_000 }),

    attendanceCalendar: (campusId?: string | null, academicYearId?: string | null) =>
      api.get<JgAttendanceCalendar>(`/jahbadh-grades/attendance-calendar${cq(campusId, academicYearId)}`),
    saveAttendanceCalendar: (
      body: Partial<{ stage_starts: (string | null)[]; year_end: string | null; weekend_days: number[]; holidays: string[]; alert_limit: number }>,
      campusId?: string | null,
      academicYearId?: string | null,
    ) => api.put<JgAttendanceCalendar>(`/jahbadh-grades/attendance-calendar${cq(campusId, academicYearId)}`, body),
    /** One stage's school days (or one month of it: `month` = YYYY-MM) with every student's codes. */
    dailyAttendance: (sectionId: string, opts: { stage?: number; month?: string } = {}, campusId?: string | null) =>
      api.get<JgDailyAttendance>(`/jahbadh-grades/sections/${id(sectionId)}/daily-attendance${qs({ stage: opts.stage, month: opts.month, campus_id: campusId ?? undefined })}`),
    /** Saves codes and writes each stage's absence totals into the report cards. */
    saveDailyAttendance: (sectionId: string, entries: JgAttendanceEntry[], campusId?: string | null) =>
      api.put<{ saved: number }>(`/jahbadh-grades/sections/${id(sectionId)}/daily-attendance${cq(campusId)}`, { entries }),

    rolloverPreview: (sectionId: string, campusId?: string | null) =>
      api.get<JgRolloverPreview>(`/jahbadh-grades/sections/${id(sectionId)}/rollover${cq(campusId)}`),
    /** Writes the plan used by the school's year-end rollover; `students` chooses the next grade or holds students. */
    rolloverApply: (sectionId: string, students: { student_id: string; next_grade_id?: string | null; hold?: boolean }[] = [], campusId?: string | null) =>
      api.post<JgRolloverResult>(`/jahbadh-grades/sections/${id(sectionId)}/rollover${cq(campusId)}`, { students }),

    homeroom: (sectionId: string, campusId?: string | null) =>
      api.get<JgHomeroom>(`/jahbadh-grades/sections/${id(sectionId)}/homeroom${cq(campusId)}`),
    setHomeroom: (sectionId: string, staffId: string | null, campusId?: string | null) =>
      api.put<JgHomeroom>(`/jahbadh-grades/sections/${id(sectionId)}/homeroom${cq(campusId)}`, { staff_id: staffId }),
  }
}
