// Jahbadh exam control (backend: /jahbadh-control). Generated from
// packages/api-client/src/modules/jahbadh-control.ts (same paths); types are imported type-only
// (the web does not import packages at runtime). Keep both in step.
import type {
  JcStatus, JcRole, JcSettings, JcSessionSummary, JcSubject, JcGrade, JcOverview, JcStudent, JcCommittee, JcCommitteeStatus, JcAlert, JcDay, JcInvigilator, JcDuty, JcDayStudent, JcEnvelope, JcDayDashboard, JcViolation, JcEntryGrid, JcGate, JcAppeal, JcQuality, JcResults, JcExport, JcDoc, JcAttendanceState, JcEnvelopeCheck, JcTimerFeed, JcTimerMinutes, JcScanResult,
} from "@studently/api-client/modules/jahbadh-control";
import { jgRequest, jgOpenPdfPath } from "./jahbadh-grades";

export type * from "@studently/api-client/modules/jahbadh-control";

const q = (params: Record<string, string | number | null | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
};
const get = <T,>(path: string) => jgRequest<T>(path);
const post = <T,>(path: string, body: unknown) => jgRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
const put = <T,>(path: string, body: unknown) => jgRequest<T>(path, { method: "PUT", body: JSON.stringify(body) });
const del = <T,>(path: string) => jgRequest<T>(path, { method: "DELETE" });

function build() {
  const id = (v: string) => encodeURIComponent(v)
  const s = (sessionId: string) => `/jahbadh-control/sessions/${id(sessionId)}`
  return {
    sessions: (campusId?: string | null) => get<JcSessionSummary[]>(`/jahbadh-control/sessions${q({ campus_id: campusId ?? undefined })}`),
    createSession: (body: { name: string; campus_id?: string | null; stage?: number; issue_date?: string; grade_level_ids?: string[]; settings?: Partial<JcSettings> }) =>
      post<JcOverview>('/jahbadh-control/sessions', body),
    overview: (sessionId: string) => get<JcOverview>(s(sessionId)),
    updateSession: (sessionId: string, body: { name?: string; stage?: number; issue_date?: string; status?: JcStatus; settings?: Partial<JcSettings> }) => put<JcOverview>(s(sessionId), body),
    deleteSession: (sessionId: string) => del<{ deleted: boolean }>(s(sessionId)),
    setKey: (sessionId: string, key: number, offset: number) => put<{ key_set: boolean }>(`${s(sessionId)}/key`, { key, offset }),
    members: (sessionId: string) => get<{ profile_id: string; role: JcRole; name: string; user_role: string | null }[]>(`${s(sessionId)}/members`),
    setMembers: (sessionId: string, members: { profile_id: string; role: JcRole }[]) => put<unknown>(`${s(sessionId)}/members`, { members }),
    gradeChoices: (sessionId: string) => get<{ grade_level_id: string; name: string; grade_code: number | null }[]>(`${s(sessionId)}/grade-choices`),
    grades: (sessionId: string) => get<JcGrade[]>(`${s(sessionId)}/grades`),
    setGrades: (sessionId: string, gradeLevelIds: string[], overrides: { grade_level_id: string; number_code?: number; subjects?: JcSubject[] }[] = []) =>
      put<JcGrade[]>(`${s(sessionId)}/grades`, { grade_level_ids: gradeLevelIds, overrides }),
    students: (sessionId: string) => get<JcStudent[]>(`${s(sessionId)}/students`),
    pullStudents: (sessionId: string) => post<{ added: number; students: JcStudent[] }>(`${s(sessionId)}/students/pull`, {}),
    updateStudents: (sessionId: string, students: Partial<JcStudent>[]) => put<JcStudent[]>(`${s(sessionId)}/students`, { students }),
    generateNumbers: (sessionId: string) => post<{ generated: number }>(`${s(sessionId)}/numbers/generate`, {}),
    committees: (sessionId: string) => get<JcCommittee[]>(`${s(sessionId)}/committees`),
    saveCommittees: (sessionId: string, committees: Partial<JcCommittee>[]) => put<JcCommittee[]>(`${s(sessionId)}/committees`, { committees }),
    committeeStatus: (sessionId: string) => get<JcCommitteeStatus[]>(`${s(sessionId)}/committees/status`),
    distribute: (sessionId: string) => post<{ placed: number; unassigned: number }>(`${s(sessionId)}/distribution`, {}),
    lock: (sessionId: string) => post<{ locked: boolean }>(`${s(sessionId)}/committees/lock`, {}),
    unlock: (sessionId: string) => post<{ locked: boolean }>(`${s(sessionId)}/committees/unlock`, {}),
    alerts: (sessionId: string) => get<JcAlert[]>(`${s(sessionId)}/alerts`),
    schedule: (sessionId: string) => get<JcDay[]>(`${s(sessionId)}/schedule`),
    saveSchedule: (sessionId: string, days: Partial<JcDay>[]) => put<JcDay[]>(`${s(sessionId)}/schedule`, { days }),
    invigilators: (sessionId: string) => get<JcInvigilator[]>(`${s(sessionId)}/invigilators`),
    saveInvigilators: (sessionId: string, invigilators: Partial<JcInvigilator>[]) => put<JcInvigilator[]>(`${s(sessionId)}/invigilators`, { invigilators }),
    staff: (sessionId: string) => get<{ id: string; profile_id: string; name: string; role: string }[]>(`${s(sessionId)}/staff`),
    invigilation: (sessionId: string) => get<JcDuty[]>(`${s(sessionId)}/invigilation`),
    generateInvigilation: (sessionId: string) =>
      post<{ duties: JcDuty[]; short_days: { dayId: string; needed: number; eligible: number }[]; loads: Record<string, { duties: number; reserves: number }> }>(`${s(sessionId)}/invigilation/generate`, {}),
    setDuty: (sessionId: string, body: { exam_day_id: string; committee_id: string | null; slot: number; is_reserve?: boolean; staff_id: string | null }) =>
      put<JcDuty[]>(`${s(sessionId)}/invigilation/duty`, body),
    dayDashboard: (sessionId: string, dayId: string) => get<JcDayDashboard>(`${s(sessionId)}/examday/${id(dayId)}/dashboard`),
    attendance: (sessionId: string, dayId: string, committeeId?: string | null) =>
      get<{ day: JcDay; rows: (JcDayStudent & { state: JcAttendanceState; minutes_late: number | null })[] }>(`${s(sessionId)}/examday/${id(dayId)}/attendance${q({ committee_id: committeeId ?? undefined })}`),
    saveAttendance: (sessionId: string, dayId: string, entries: { id: string; state: JcAttendanceState; minutes_late?: number | null }[]) =>
      put<unknown>(`${s(sessionId)}/examday/${id(dayId)}/attendance`, { entries }),
    envelopes: (sessionId: string, dayId: string) => get<JcEnvelope[]>(`${s(sessionId)}/examday/${id(dayId)}/envelopes`),
    saveEnvelope: (sessionId: string, dayId: string, body: { committee_id: string; booklet_count: number | null; sealed?: boolean; scanned?: number[] }) =>
      put<JcEnvelope[]>(`${s(sessionId)}/examday/${id(dayId)}/envelopes`, body),
    bySeat: (sessionId: string, seat: number) => get<JcDayStudent & { committee_name: string | null }>(`${s(sessionId)}/seat/${seat}`),
    violations: (sessionId: string, dayId?: string | null) => get<JcViolation[]>(`${s(sessionId)}/violations${q({ day_id: dayId ?? undefined })}`),
    addViolation: (sessionId: string, body: { exam_day_id: string; seat_number: number; type: string; action_taken?: string; invigilator_id?: string | null; notes?: string }) =>
      post<JcViolation[]>(`${s(sessionId)}/violations`, body),
    deleteViolation: (sessionId: string, violationId: string) => del<JcViolation[]>(`${s(sessionId)}/violations/${id(violationId)}`),
    entryGrid: (sessionId: string, gradeLevelId: string, entry: 1 | 2) => get<JcEntryGrid>(`${s(sessionId)}/scores${q({ grade_level_id: gradeLevelId, entry })}`),
    saveEntry: (sessionId: string, entry: 1 | 2, cells: { secret: number; subject_key: string; score: number | null; absent?: boolean }[]) =>
      put<{ saved: number; cleared: number }>(`${s(sessionId)}/scores`, { entry, cells }),
    mismatches: (sessionId: string) =>
      get<{ double_entry: boolean; mismatches: { secret: number; subject_key: string; first: string; second: string }[]; only_first: { secret: number; subject_key: string }[]; only_second: { secret: number; subject_key: string }[]; agreed: number }>(`${s(sessionId)}/scores/mismatches`),
    gate: (sessionId: string) => get<JcGate>(`${s(sessionId)}/unmask`),
    approveUnmask: (sessionId: string) => post<JcGate>(`${s(sessionId)}/unmask/approve`, {}),
    unmask: (sessionId: string) => post<JcGate>(`${s(sessionId)}/unmask`, {}),
    revokeUnmask: (sessionId: string) => post<JcGate>(`${s(sessionId)}/unmask/revoke`, {}),
    appeals: (sessionId: string) => get<JcAppeal[]>(`${s(sessionId)}/appeals`),
    addAppeal: (sessionId: string, body: { secret: number; subject_key: string; after: number; reason: string }) => post<JcAppeal[]>(`${s(sessionId)}/appeals`, body),
    auditSample: (sessionId: string) => get<{ secret: number | null; reviewed: boolean; notes: string | null }[]>(`${s(sessionId)}/audit-sample`),
    drawAuditSample: (sessionId: string) => post<{ secret: number | null; reviewed: boolean; notes: string | null }[]>(`${s(sessionId)}/audit-sample/draw`, {}),
    reviewAuditSample: (sessionId: string, body: { secret: number; reviewed: boolean; notes?: string }) => put<unknown>(`${s(sessionId)}/audit-sample`, body),
    graders: (sessionId: string) => get<{ subject_key: string; committee_id: string; staff_id: string }[]>(`${s(sessionId)}/graders`),
    saveGraders: (sessionId: string, graders: { subject_key: string; committee_id: string; staff_id: string | null }[]) => put<unknown>(`${s(sessionId)}/graders`, { graders }),
    quality: (sessionId: string, gradeLevelId?: string | null) => get<JcQuality>(`${s(sessionId)}/quality${q({ grade_level_id: gradeLevelId ?? undefined })}`),
    results: (sessionId: string) => get<JcResults>(`${s(sessionId)}/results`),
    createSecondRound: (sessionId: string) => post<{ session_id: string; students: number }>(`${s(sessionId)}/second-round`, {}),
    messages: (sessionId: string, note?: string) => get<{ id: string; name: string; phone: string | null; text: string; whatsapp: string | null }[]>(`${s(sessionId)}/messages${q({ note })}`),
    sendMessages: (sessionId: string, note?: string) => post<unknown>(`${s(sessionId)}/messages/send`, { note }),
    exportPreview: (sessionId: string) => get<JcExport>(`${s(sessionId)}/export-to-grades`),
    exportCommit: (sessionId: string) => post<JcExport>(`${s(sessionId)}/export-to-grades`, {}),
    scan: (sessionId: string, payload: string, expect?: 'booklet' | 'stub' | 'card', dayId?: string | null) =>
      post<JcScanResult>(`${s(sessionId)}/scan`, { payload, expect, day_id: dayId ?? undefined }),
    regenerateCode: (sessionId: string) => post<JcOverview>(`${s(sessionId)}/session-code`, {}),
    envelopeCheck: (sessionId: string, dayId: string, committeeId: string, payloads: string[]) =>
      post<JcEnvelopeCheck>(`${s(sessionId)}/examday/${id(dayId)}/envelopes/check`, { committee_id: committeeId, payloads }),
    timerFeed: (sessionId: string, date?: string | null, committeeId?: string | null) =>
      get<JcTimerFeed>(`${s(sessionId)}/timer-feed${q({ date: date ?? undefined, committee_id: committeeId ?? undefined })}`),
    timerMinutes: (sessionId: string, dayId: string) => get<JcTimerMinutes[]>(`${s(sessionId)}/examday/${id(dayId)}/timer-minutes`),
    saveTimerMinutes: (sessionId: string, dayId: string, body: { committee_id?: string | null; text: string; events?: unknown[] }) =>
      post<JcTimerMinutes[]>(`${s(sessionId)}/examday/${id(dayId)}/timer-minutes`, body),
    audit: (sessionId: string) => get<{ id: number; action: string; entity: string; entity_id: string | null; actor_role: string | null; actor_name: string; created_at: string; after: unknown }[]>(`${s(sessionId)}/audit`),
  }
}

export const jcApi = build();

/** Opens a printable control document (PDF) in a new tab. */
export function openJcDoc(sessionId: string, doc: JcDoc, opts: { committeeId?: string | null; dayId?: string | null } = {}) {
  return jgOpenPdfPath(
    `/jahbadh-control/sessions/${encodeURIComponent(sessionId)}/print/${doc}${q({ committee_id: opts.committeeId ?? undefined, day_id: opts.dayId ?? undefined })}`,
  );
}
