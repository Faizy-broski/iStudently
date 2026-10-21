// Jahbadh exam control («كنترول جهبذ», brief Part C; backend: jahbadh-control.routes.ts; web:
// /admin/exam-control, /teacher/exam-control). Admins act as control chief; teachers and staff work in
// the sessions where they are members. Score endpoints are blind (secret numbers only) until unmasking.
import type { ApiClient } from '../client'
import { qs } from '../query'

export type JcAttendanceState = 'present' | 'absent' | 'late' | 'exit'

export type JcStatus = 'draft' | 'registration' | 'committees_locked' | 'exam_running' | 'grading' | 'unmasked' | 'published' | 'archived'
export type JcRole = 'control' | 'entry' | 'invigilator' | 'secret'

export interface JcSettings {
  distribution: 'mixed' | 'sequential'
  order: 'alphabetical' | 'entry'
  secret_mode: 'random' | 'encrypted' | 'simple'
  q_count: number
  show_names: boolean
  weak_rate: number
  paper_models: boolean
  special_last: boolean
  obs_per_committee: number
  reserve_per_day: number
  double_entry: boolean
  chief_name: string
  exam_pass: number
  audit_percent: number
  audit_seed: string
  max_list: number
  simple_add: number
  number_multiplier: number
  number_start: number
  number_prefix: number
  top_n: number
  qr_enabled: boolean
  qr_on_covers: boolean
  qr_on_stubs: boolean
  qr_on_cards: boolean
  qr_size_mm: number
  camera_scanning: boolean
  message_template: string
}

export interface JcSessionSummary {
  id: string
  name: string
  round: 'first' | 'second'
  status: JcStatus
  issue_date: string
  stage: number
  campus_id: string | null
  academic_year_id: string
  created_at: string
  parent_session_id: string | null
}

export interface JcSession extends JcSessionSummary {
  school_id: string
  session_code: string
  settings: JcSettings
  committees_locked_at: string | null
  numbers_generated_at: string | null
}

export interface JcSubject {
  key: string
  name: string
  max: number
  component_id: string | null
}

export interface JcGrade {
  grade_level_id: string
  grade_level_name: string
  grade_code: number
  number_code: number
  subjects: JcSubject[]
}

export interface JcOverview {
  session: JcSession
  rights: { chief: boolean; roles: JcRole[]; manage: boolean; secret: boolean; entry: boolean; examday: boolean; view: boolean; unmasked: boolean }
  key_set: boolean
  grades: JcGrade[]
  counts: { students: number; participating: number; numbered: number; placed: number; committees: number; capacity: number; special: number }
}

export interface JcStudent {
  id: string
  student_id: string
  name: string
  gender: string | null
  student_number: string | null
  grade_level_id: string
  grade_level_name: string
  grade_code: number
  number_code: number
  section_id: string | null
  section_name: string | null
  status: 'participating' | 'exempt' | 'withdrawn' | 'transferred'
  special_case: 'extra_time' | 'reader' | 'scribe' | 'other' | null
  special_note: string | null
  extra_minutes: number | null
  rank_in_grade: number | null
  seat_number: number | null
  global_order: number | null
  committee_id: string | null
  seat_index: number | null
  paper_model: 'A' | 'B' | null
}

export interface JcCommittee {
  id: string
  name: string
  room_label: string | null
  capacity: number
  seat_columns: number
  order_index: number
  is_special_needs: boolean
  invigilator1_id: string | null
  invigilator2_id: string | null
  notes: string | null
}

export interface JcCommitteeStatus extends JcCommittee {
  count: number
  from_seat: number | null
  to_seat: number | null
  grades: string[]
  occupancy: number | null
  special: number
  flags: string[]
}

export interface JcAlert {
  key: string
  phase: 'before' | 'examday' | 'after'
  count: number
  status: 'ok' | 'error' | 'info'
  details?: string[]
}

export interface JcDay {
  id: string
  exam_date: string
  subject_key: string
  subject_name: string
  grade_codes: number[]
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
}

export interface JcInvigilator {
  staff_id: string
  name: string
  specialization: string | null
  available: boolean
  unavailable_days: string[]
}

export interface JcDuty {
  id: string
  exam_day_id: string
  committee_id: string | null
  staff_id: string
  slot: number
  is_reserve: boolean
  is_manual: boolean
}

export interface JcDayStudent {
  id: string
  name: string
  seat_number: number | null
  grade_level_name: string
  committee_id: string | null
  seat_index: number | null
  special_case: string | null
  extra_minutes: number | null
}

export interface JcEnvelope {
  committee_id: string
  committee_name: string
  students: number
  present: number
  booklet_count: number | null
  received_at: string | null
  sealed: boolean
  match: boolean | null
}

export interface JcDayDashboard {
  day: JcDay
  tiles: { students: number; present: number; absent: number; late: number; envelopes: number; envelopes_total: number; violations: number }
  committees: (JcEnvelope & { absent: number; late: number; violations: number })[]
}

export interface JcViolation {
  id: string
  exam_day_id: string
  session_student_id: string
  type: string
  action_taken: string | null
  invigilator_id: string | null
  notes: string | null
  recorded_at: string
  seat_number: number | null
  name: string
  grade_level_name: string
  committee_id: string | null
  repeat: boolean
}

export interface JcEntryGrid {
  grade: { grade_level_id: string; name: string; subjects: JcSubject[] }
  entry: 1 | 2
  unmasked: boolean
  rows: {
    secret: number
    committee: string | null
    name?: string
    seat_number?: number | null
    cells: Record<string, { score: number | null; absent: boolean; entered: boolean; mismatch: boolean; single: boolean }>
  }[]
}

export interface JcGate {
  open: boolean
  missing: ('all_entered' | 'double_entry_match' | 'chief_approved' | 'show_names')[]
  input: { expected: number; entered: number; doubleEntry: boolean; mismatches: number; pendingSecond: number; chiefApproved: boolean; showNames: boolean }
  unmasked: boolean
  events: { kind: string; approved_by: string | null; created_at: string }[]
}

export interface JcAppeal {
  id: string
  secret: number | null
  name?: string
  seat_number?: number | null
  subject_key: string
  before: number | null
  after: number
  reason: string
  approved_by: string | null
  created_at: string
  applied: boolean
}

export interface JcQuality {
  grades: {
    grade_level_id: string
    name: string
    tiles: { students: number; completion: number | null; average: number | null; top: number; support: number; errors: number }
    subjects: {
      key: string; name: string; max: number; teachers: string[]; entered: number; missing: number; mean: number | null; meanPct: number | null
      bands: Record<string, number>; passRate: number | null; excellenceRate: number | null; weakRate: number | null; verdict: string | null
      clustering: { threshold: number; atThreshold: number; justBelow: number; flagged: boolean }
    }[]
    top: { label: string; pct: number | null }[]
    support: { label: string; pct: number | null }[]
  }[]
  bias: { subjectKey: string; graderId: string; grader: string; committees: string[]; students: number; deviation: number; verdict: 'strict' | 'lenient' | 'normal' }[]
  teacher_performance: { staff_id: string; name: string; students: number; meanPct: number | null }[]
}

export interface JcResults {
  grades: { grade_level_id: string; name: string; subjects: JcSubject[] }[]
  students: { id: string; student_id: string; name: string; seat_number: number | null; grade_level_id: string; grade_level_name: string; scores: Record<string, { score: number | null; absent: boolean } | null>; pct: number | null }[]
  honor_board: { id: string; place: number; pct: number | null; name: string; grade_level_name: string }[]
  second_round_candidates: { id: string; name: string; subjects: string[] }[]
}

export interface JcExport {
  committed: boolean
  summary: { new: number; change: number; same: number }
  changes: { student: string; name: string; subject: string; target: string; before: string | null; after: string; action: 'new' | 'change' | 'same' }[]
}

export interface JcEnvelopeCheck {
  expected: number
  received: number[]
  duplicates: number[]
  wrongCommittee: { secret: number; committee: string | null }[]
  absent: number[]
  notToday: number[]
  unknown: number[]
  missing: number[]
  invalid: { index: number; reason: string }[]
}

export interface JcTimerFeed {
  session: { id: string; name: string }
  committees: { id: string; name: string }[]
  days: (JcDay & { grade_names: string[] })[]
  extras: { seat: number; minutes: number; day_id: string; special_case: string | null }[]
}

export interface JcTimerMinutes {
  id: number
  created_at: string
  committee_id: string | null
  committee_name: string | null
  text: string
}

export type JcScanResult = { kind: 'booklet' | 'stub' | 'card'; secret?: number; student?: JcDayStudent & { committee_name: string | null } }

export const JC_DOCS = [
  'general_list', 'secret_lists', 'committee_mirror', 'envelope_mirror', 'delivery_sheet', 'student_cards', 'booklet_covers',
  'seating_map', 'timetable', 'invigilation', 'attendance_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident',
  'results', 'honor_board', 'certificates',
] as const
export type JcDoc = (typeof JC_DOCS)[number]

/** Path of a printable document (authenticated download). */
export const jcPrintPath = (sessionId: string, doc: JcDoc, opts: { committeeId?: string | null; dayId?: string | null } = {}) =>
  `/jahbadh-control/sessions/${encodeURIComponent(sessionId)}/print/${doc}${qs({ committee_id: opts.committeeId ?? undefined, day_id: opts.dayId ?? undefined })}`

export function jahbadhControlApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const s = (sessionId: string) => `/jahbadh-control/sessions/${id(sessionId)}`
  return {
    sessions: (campusId?: string | null) => api.get<JcSessionSummary[]>(`/jahbadh-control/sessions${qs({ campus_id: campusId ?? undefined })}`),
    createSession: (body: { name: string; campus_id?: string | null; stage?: number; issue_date?: string; grade_level_ids?: string[]; settings?: Partial<JcSettings> }) =>
      api.post<JcOverview>('/jahbadh-control/sessions', body),
    overview: (sessionId: string) => api.get<JcOverview>(s(sessionId)),
    updateSession: (sessionId: string, body: { name?: string; stage?: number; issue_date?: string; status?: JcStatus; settings?: Partial<JcSettings> }) => api.put<JcOverview>(s(sessionId), body),
    deleteSession: (sessionId: string) => api.del<{ deleted: boolean }>(s(sessionId)),
    setKey: (sessionId: string, key: number, offset: number) => api.put<{ key_set: boolean }>(`${s(sessionId)}/key`, { key, offset }),
    members: (sessionId: string) => api.get<{ profile_id: string; role: JcRole; name: string; user_role: string | null }[]>(`${s(sessionId)}/members`),
    setMembers: (sessionId: string, members: { profile_id: string; role: JcRole }[]) => api.put<unknown>(`${s(sessionId)}/members`, { members }),
    gradeChoices: (sessionId: string) => api.get<{ grade_level_id: string; name: string; grade_code: number | null }[]>(`${s(sessionId)}/grade-choices`),
    grades: (sessionId: string) => api.get<JcGrade[]>(`${s(sessionId)}/grades`),
    setGrades: (sessionId: string, gradeLevelIds: string[], overrides: { grade_level_id: string; number_code?: number; subjects?: JcSubject[] }[] = []) =>
      api.put<JcGrade[]>(`${s(sessionId)}/grades`, { grade_level_ids: gradeLevelIds, overrides }),
    students: (sessionId: string) => api.get<JcStudent[]>(`${s(sessionId)}/students`),
    pullStudents: (sessionId: string) => api.post<{ added: number; students: JcStudent[] }>(`${s(sessionId)}/students/pull`, {}),
    updateStudents: (sessionId: string, students: Partial<JcStudent>[]) => api.put<JcStudent[]>(`${s(sessionId)}/students`, { students }),
    generateNumbers: (sessionId: string) => api.post<{ generated: number }>(`${s(sessionId)}/numbers/generate`, {}),
    committees: (sessionId: string) => api.get<JcCommittee[]>(`${s(sessionId)}/committees`),
    saveCommittees: (sessionId: string, committees: Partial<JcCommittee>[]) => api.put<JcCommittee[]>(`${s(sessionId)}/committees`, { committees }),
    committeeStatus: (sessionId: string) => api.get<JcCommitteeStatus[]>(`${s(sessionId)}/committees/status`),
    distribute: (sessionId: string) => api.post<{ placed: number; unassigned: number }>(`${s(sessionId)}/distribution`, {}),
    lock: (sessionId: string) => api.post<{ locked: boolean }>(`${s(sessionId)}/committees/lock`, {}),
    unlock: (sessionId: string) => api.post<{ locked: boolean }>(`${s(sessionId)}/committees/unlock`, {}),
    alerts: (sessionId: string) => api.get<JcAlert[]>(`${s(sessionId)}/alerts`),
    schedule: (sessionId: string) => api.get<JcDay[]>(`${s(sessionId)}/schedule`),
    saveSchedule: (sessionId: string, days: Partial<JcDay>[]) => api.put<JcDay[]>(`${s(sessionId)}/schedule`, { days }),
    invigilators: (sessionId: string) => api.get<JcInvigilator[]>(`${s(sessionId)}/invigilators`),
    saveInvigilators: (sessionId: string, invigilators: Partial<JcInvigilator>[]) => api.put<JcInvigilator[]>(`${s(sessionId)}/invigilators`, { invigilators }),
    staff: (sessionId: string) => api.get<{ id: string; profile_id: string; name: string; role: string }[]>(`${s(sessionId)}/staff`),
    invigilation: (sessionId: string) => api.get<JcDuty[]>(`${s(sessionId)}/invigilation`),
    generateInvigilation: (sessionId: string) =>
      api.post<{ duties: JcDuty[]; short_days: { dayId: string; needed: number; eligible: number }[]; loads: Record<string, { duties: number; reserves: number }> }>(`${s(sessionId)}/invigilation/generate`, {}),
    setDuty: (sessionId: string, body: { exam_day_id: string; committee_id: string | null; slot: number; is_reserve?: boolean; staff_id: string | null }) =>
      api.put<JcDuty[]>(`${s(sessionId)}/invigilation/duty`, body),
    dayDashboard: (sessionId: string, dayId: string) => api.get<JcDayDashboard>(`${s(sessionId)}/examday/${id(dayId)}/dashboard`),
    attendance: (sessionId: string, dayId: string, committeeId?: string | null) =>
      api.get<{ day: JcDay; rows: (JcDayStudent & { state: JcAttendanceState; minutes_late: number | null })[] }>(`${s(sessionId)}/examday/${id(dayId)}/attendance${qs({ committee_id: committeeId ?? undefined })}`),
    saveAttendance: (sessionId: string, dayId: string, entries: { id: string; state: JcAttendanceState; minutes_late?: number | null }[]) =>
      api.put<unknown>(`${s(sessionId)}/examday/${id(dayId)}/attendance`, { entries }),
    envelopes: (sessionId: string, dayId: string) => api.get<JcEnvelope[]>(`${s(sessionId)}/examday/${id(dayId)}/envelopes`),
    saveEnvelope: (sessionId: string, dayId: string, body: { committee_id: string; booklet_count: number | null; sealed?: boolean; scanned?: number[] }) =>
      api.put<JcEnvelope[]>(`${s(sessionId)}/examday/${id(dayId)}/envelopes`, body),
    bySeat: (sessionId: string, seat: number) => api.get<JcDayStudent & { committee_name: string | null }>(`${s(sessionId)}/seat/${seat}`),
    violations: (sessionId: string, dayId?: string | null) => api.get<JcViolation[]>(`${s(sessionId)}/violations${qs({ day_id: dayId ?? undefined })}`),
    addViolation: (sessionId: string, body: { exam_day_id: string; seat_number: number; type: string; action_taken?: string; invigilator_id?: string | null; notes?: string }) =>
      api.post<JcViolation[]>(`${s(sessionId)}/violations`, body),
    deleteViolation: (sessionId: string, violationId: string) => api.del<JcViolation[]>(`${s(sessionId)}/violations/${id(violationId)}`),
    entryGrid: (sessionId: string, gradeLevelId: string, entry: 1 | 2) => api.get<JcEntryGrid>(`${s(sessionId)}/scores${qs({ grade_level_id: gradeLevelId, entry })}`),
    saveEntry: (sessionId: string, entry: 1 | 2, cells: { secret: number; subject_key: string; score: number | null; absent?: boolean }[]) =>
      api.put<{ saved: number; cleared: number }>(`${s(sessionId)}/scores`, { entry, cells }),
    mismatches: (sessionId: string) =>
      api.get<{ double_entry: boolean; mismatches: { secret: number; subject_key: string; first: string; second: string }[]; only_first: { secret: number; subject_key: string }[]; only_second: { secret: number; subject_key: string }[]; agreed: number }>(`${s(sessionId)}/scores/mismatches`),
    gate: (sessionId: string) => api.get<JcGate>(`${s(sessionId)}/unmask`),
    approveUnmask: (sessionId: string) => api.post<JcGate>(`${s(sessionId)}/unmask/approve`, {}),
    unmask: (sessionId: string) => api.post<JcGate>(`${s(sessionId)}/unmask`, {}),
    revokeUnmask: (sessionId: string) => api.post<JcGate>(`${s(sessionId)}/unmask/revoke`, {}),
    appeals: (sessionId: string) => api.get<JcAppeal[]>(`${s(sessionId)}/appeals`),
    addAppeal: (sessionId: string, body: { secret: number; subject_key: string; after: number; reason: string }) => api.post<JcAppeal[]>(`${s(sessionId)}/appeals`, body),
    auditSample: (sessionId: string) => api.get<{ secret: number | null; reviewed: boolean; notes: string | null }[]>(`${s(sessionId)}/audit-sample`),
    drawAuditSample: (sessionId: string) => api.post<{ secret: number | null; reviewed: boolean; notes: string | null }[]>(`${s(sessionId)}/audit-sample/draw`, {}),
    reviewAuditSample: (sessionId: string, body: { secret: number; reviewed: boolean; notes?: string }) => api.put<unknown>(`${s(sessionId)}/audit-sample`, body),
    graders: (sessionId: string) => api.get<{ subject_key: string; committee_id: string; staff_id: string }[]>(`${s(sessionId)}/graders`),
    saveGraders: (sessionId: string, graders: { subject_key: string; committee_id: string; staff_id: string | null }[]) => api.put<unknown>(`${s(sessionId)}/graders`, { graders }),
    quality: (sessionId: string, gradeLevelId?: string | null) => api.get<JcQuality>(`${s(sessionId)}/quality${qs({ grade_level_id: gradeLevelId ?? undefined })}`),
    results: (sessionId: string) => api.get<JcResults>(`${s(sessionId)}/results`),
    createSecondRound: (sessionId: string) => api.post<{ session_id: string; students: number }>(`${s(sessionId)}/second-round`, {}),
    messages: (sessionId: string, note?: string) => api.get<{ id: string; name: string; phone: string | null; text: string; whatsapp: string | null }[]>(`${s(sessionId)}/messages${qs({ note })}`),
    sendMessages: (sessionId: string, note?: string) => api.post<unknown>(`${s(sessionId)}/messages/send`, { note }),
    exportPreview: (sessionId: string) => api.get<JcExport>(`${s(sessionId)}/export-to-grades`),
    exportCommit: (sessionId: string) => api.post<JcExport>(`${s(sessionId)}/export-to-grades`, {}),
    scan: (sessionId: string, payload: string, expect?: 'booklet' | 'stub' | 'card', dayId?: string | null) =>
      api.post<JcScanResult>(`${s(sessionId)}/scan`, { payload, expect, day_id: dayId ?? undefined }),
    regenerateCode: (sessionId: string) => api.post<JcOverview>(`${s(sessionId)}/session-code`, {}),
    envelopeCheck: (sessionId: string, dayId: string, committeeId: string, payloads: string[]) =>
      api.post<JcEnvelopeCheck>(`${s(sessionId)}/examday/${id(dayId)}/envelopes/check`, { committee_id: committeeId, payloads }),
    timerFeed: (sessionId: string, date?: string | null, committeeId?: string | null) =>
      api.get<JcTimerFeed>(`${s(sessionId)}/timer-feed${qs({ date: date ?? undefined, committee_id: committeeId ?? undefined })}`),
    timerMinutes: (sessionId: string, dayId: string) => api.get<JcTimerMinutes[]>(`${s(sessionId)}/examday/${id(dayId)}/timer-minutes`),
    saveTimerMinutes: (sessionId: string, dayId: string, body: { committee_id?: string | null; text: string; events?: unknown[] }) =>
      api.post<JcTimerMinutes[]>(`${s(sessionId)}/examday/${id(dayId)}/timer-minutes`, body),
    audit: (sessionId: string) => api.get<{ id: number; action: string; entity: string; entity_id: string | null; actor_role: string | null; actor_name: string; created_at: string; after: unknown }[]>(`${s(sessionId)}/audit`),
  }
}

export type JcArea = 'overview' | 'setup' | 'students' | 'committees' | 'planning' | 'alerts' | 'prints' | 'examday' | 'entry' | 'quality' | 'results' | 'audit'

/** Areas a member may open, from the rights the server computed (same rule as the web tabs). */
export function jcAreas(o: JcOverview): JcArea[] {
  const r = o.rights
  const out: JcArea[] = ['overview']
  if (r.manage || r.secret) out.push('setup')
  if (r.manage) out.push('students', 'committees', 'planning', 'alerts')
  if (r.manage || r.secret) out.push('prints')
  if (r.examday) out.push('examday')
  if (r.entry) out.push('entry')
  if (r.manage || r.entry) out.push('quality')
  if ((r.manage || r.entry) && r.unmasked) out.push('results')
  if (r.chief) out.push('audit')
  return out
}

export const JC_STATUSES: JcStatus[] = ['draft', 'registration', 'committees_locked', 'exam_running', 'grading', 'unmasked', 'published', 'archived']

/** The C12 workflow as a checklist; `done` is null where it cannot be measured. */
export function jcSteps(o: JcOverview): { key: string; area: JcArea; done: boolean | null }[] {
  const c = o.counts
  const s = o.session
  const after = (status: JcStatus) => JC_STATUSES.indexOf(s.status) >= JC_STATUSES.indexOf(status)
  const steps: { key: string; area: JcArea; done: boolean | null }[] = [
    { key: 'grades', area: 'setup', done: o.grades.length > 0 },
    { key: 'students', area: 'students', done: c.participating > 0 },
    { key: 'numbers', area: 'students', done: c.participating > 0 && c.numbered === c.participating },
    { key: 'committees', area: 'committees', done: c.committees > 0 && c.capacity >= c.participating && c.participating > 0 },
    { key: 'distribution', area: 'committees', done: c.participating > 0 && c.placed === c.participating },
    { key: 'lock', area: 'committees', done: !!s.committees_locked_at },
    { key: 'planning', area: 'planning', done: null },
    { key: 'prints', area: 'prints', done: null },
    { key: 'examday', area: 'examday', done: after('grading') },
    { key: 'entry', area: 'entry', done: after('unmasked') },
    { key: 'unmask', area: 'quality', done: o.rights.unmasked },
    { key: 'results', area: 'results', done: after('published') },
  ]
  const areas = jcAreas(o)
  return steps.filter((x) => areas.includes(x.area))
}

/** Parses one typed score: "" clears, غ / A = absent, else a number in 0..max (Arabic digits accepted). */
export function jcParseScore(raw: string, max: number): { ok: true; score: number | null; absent: boolean } | { ok: false } {
  const v = raw.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.').replace(',', '.')
  if (v === '') return { ok: true, score: null, absent: false }
  if (/^(غ|a|abs)$/i.test(v)) return { ok: true, score: null, absent: true }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false }
  return { ok: true, score: n, absent: false }
}

/** Violation types and actions are stored in Arabic (they print on the official minutes). */
export const JC_VIOLATION_AR = {
  cheating: 'محاولة غش', phone: 'حيازة هاتف أو جهاز', talking: 'التحدث مع زميل', notes: 'حيازة أوراق أو قصاصات', disorder: 'إثارة الفوضى', other: 'أخرى',
} as const
export const JC_ACTION_AR = { warning: 'تنبيه شفهي', paper_taken: 'سحب الورقة', minutes: 'تحرير محضر', removed: 'إخراج من اللجنة' } as const
