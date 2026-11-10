// Jahbadh grades — Wave 2 official outputs (brief B6 #17–24, #27, #28, #47; backend:
// jahbadh-official.controller.ts, routes in jahbadh-grades.routes.ts). JSON for the screens; the PDFs are
// opened through `jgOfficialPdfPath` like `jgPdfPath`.
import type { JgRound2Need } from '@studently/shared-utils'

import type { ApiClient } from '../client'
import { qs } from '../query'
import type { JgResults, JgScope, JgSectionRef, JgStudent } from './jahbadh-grades'

export interface JgSplit { m: number; f: number; total: number }

interface JgOfficialBase {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  grade_code: number
  grade_name: string
  no_fail: boolean
  stage_names: (string | null)[]
}

/** «الإحصائية» (B6-17): per subject and overall, split boys / girls / total. */
export interface JgStatistics extends JgOfficialBase {
  subjects: { subject_id: string; name: string; enrolled: JgSplit; recorded: JgSplit; passed: JgSplit; round2: JgSplit; failed: JgSplit; pass_rate: number | null }[]
  overall: { enrolled: JgSplit; recorded: JgSplit; passed: JgSplit; round2: JgSplit; failed: JgSplit; incomplete: JgSplit; pass_rate: number | null }
  estimates: { label: string; counts: JgSplit }[]
  indicators: {
    average_pct: number | null; highest_pct: number | null; lowest_pct: number | null
    average_pct_boys: number | null; average_pct_girls: number | null
    best_subject: string | null; weakest_subject: string | null
  }
}

/** «كشف الأوائل» (B6-22): complete students only; ties share a rank. */
export interface JgTopStudents extends JgOfficialBase {
  n: number
  students: { rank: number; student: JgStudent; total: number | null; max: number; pct: number | null; estimate: string | null; decision: string }[]
}

/** «كشف النتيجة النهائية» (B6-28). */
export interface JgFinalSheet {
  results: JgResults
  summary: { enrolled: number; passed: number; round2: number; failed: number; incomplete: number; pass_rate: number | null }
}

/** Cell flags of the review sheet: «؟» missing (orange), over max, jump > 50 points (red frame), below FollowRate (red). */
export type JgReviewFlag = 'missing' | 'over_max' | 'jump' | 'low'

/** «كشف المراجعة» (B6-19). */
export interface JgReviewSheet extends JgOfficialBase {
  stages: number[]
  subjects: { id: string; name: string; stage_max: Record<number, number>; subject_max: number }[]
  missing_cells: number
  students: {
    student: JgStudent
    stages: Record<number, Record<string, { value: number | null; max: number; flags: JgReviewFlag[] }>>
    totals: Record<string, { value: number | null; max: number }>
    results: Record<string, { label: string | null; trend: '▲' | '▼' | '●' | null }>
    activities: Record<number, { art: string | null; music: string | null; pe: string | null; excused: number | null; unexcused: number | null }>
    missing: number
    total: number | null
    max: number
    pct: number | null
    estimate: string | null
    rank: number | null
    decision: string
  }[]
  footer: Record<string, { average: number | null; passed: number; round2: number; failed: number }>
}

export interface JgRound2Cell { works: number | null; exam: number | null; total: number | null }

/** «كشف رصد درجات الدور الثاني» (B6-20): referred students only. */
export interface JgRound2EntrySheet extends JgOfficialBase {
  stages: number[]
  subjects: { id: string; name: string; subject_max: number; exam_max: number }[]
  students: {
    student: JgStudent
    round2_subjects: string[]
    stages: Record<number, Record<string, JgRound2Cell>>
    year: Record<string, JgRound2Cell>
    after: Record<string, JgRound2Cell>
  }[]
}

export interface JgRound2TimetableRow { jg_subject_id: string; subject_name: string; exam_date: string | null; exam_time: string | null; place: string | null; day: string | null }

/** «إشعارات الدور الثاني» (B6-18). Article 51 over-limit students are left out. */
export interface JgRound2Notices extends JgOfficialBase {
  notices: {
    student: JgStudent
    learner: string
    greeting: string
    subjects: { subject_id: string; name: string; need: JgRound2Need; exam_max: number; exam_date: string | null; day: string | null; exam_time: string | null; place: string | null }[]
  }[]
}

/** «إشعار ولي الأمر» (B6-27): students with a subject below FollowRate in the stage. */
export interface JgGuardianNotices extends JgOfficialBase {
  stage: number
  stage_name: string
  follow_rate: number
  notices: {
    student: JgStudent
    learner: string
    guardian_phone: string | null
    subjects: { subject_id: string; name: string; score: number; max: number; pct: number; estimate: string | null; tip: string }[]
    message: string
    /** https://wa.me/… with the message (shortened when too long); null without a phone. */
    whatsapp_url: string | null
  }[]
}

/** «الصحيفة الشهرية» (B6-21): stage + month; month mark = monthly applications (grades 1–3: Σ items). */
export interface JgMonthlyCards extends JgOfficialBase {
  stage: number
  stage_name: string
  month_idx: number
  month_name: string
  months: { idx: number; name: string }[]
  cards: {
    student: JgStudent
    learner: string
    list_number: number
    subjects: { subject_id: string; name: string; max: number; mark: number | null; absent: boolean; estimate: string | null; previous: number | null; trend: '▲' | '▼' | '●' | null }[]
    total: number | null
    max: number
    level: string | null
    pct: number | null
    /** From «الحضور اليومي» (غ + ع in that month); null when unknown. */
    absence_days: number | null
  }[]
}

/** «المنحنى الشهري»: month mark as share (0–1) of its max, every month in use. */
export interface JgMonthlyCurve extends JgOfficialBase {
  months: { stage: number; idx: number; name: string }[]
  students: {
    student: JgStudent
    subjects: { subject_id: string; name: string; points: (number | null)[]; trend: '▲' | '▼' | '●' | null }[]
    overall: (number | null)[]
  }[]
}

export interface JgSheetColumn {
  kind: 'component' | 'subitem' | 'month' | 'works' | 'exam' | 'total'
  label: string
  max: number | null
  group: string
  group_label: string
}

/** «كشف رصد المعلم» (B6-23): blank A4 sheets, fixed geometry, QR per sheet. */
export interface JgMarkingSheets extends JgOfficialBase {
  students: { list_number: number; student: JgStudent; registration_number: string | null }[]
  geometry: { page: 'A4 portrait'; serial_mm: number; name_mm: number; reg_mm: number; mark_mm: number; notes_mm: number; row_mm: number; rows_per_page: number }
  sheets: { subject_id: string; subject_name: string; stage: number; stage_name: string; page: number; pages: number; columns: JgSheetColumn[]; notes_column: boolean; qr: string }[]
}

export interface JgNoticesSent { sent: number; recipients: number }

type Range = { from?: number; to?: number; studentId?: string }

const sec = (sectionId: string) => `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}`
const cid = (campusId?: string | null) => campusId ?? undefined

/** PDF / ZIP paths (open with the authenticated download helper, like `jgPdfPath`). */
export const jgOfficialPdfPath = {
  statistics: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/statistics.pdf${qs({ campus_id: cid(campusId) })}`,
  topStudents: (sectionId: string, n?: number, campusId?: string | null) => `${sec(sectionId)}/top-students.pdf${qs({ n, campus_id: cid(campusId) })}`,
  finalSheet: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/final-sheet.pdf${qs({ campus_id: cid(campusId) })}`,
  reviewSheet: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/review-sheet.pdf${qs({ campus_id: cid(campusId) })}`,
  round2EntrySheet: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/second-round/entry-sheet.pdf${qs({ campus_id: cid(campusId) })}`,
  round2Notices: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/second-round/notices.pdf${qs({ campus_id: cid(campusId) })}`,
  guardianNotices: (sectionId: string, stage: number, campusId?: string | null) => `${sec(sectionId)}/guardian-notices.pdf${qs({ stage, campus_id: cid(campusId) })}`,
  monthlyCards: (sectionId: string, q: { stage?: number; month?: number } & Range = {}, campusId?: string | null) =>
    `${sec(sectionId)}/monthly-cards.pdf${qs({ stage: q.stage, month: q.month, from: q.from, to: q.to, student_id: q.studentId, campus_id: cid(campusId) })}`,
  monthlyCurve: (sectionId: string, studentId?: string, campusId?: string | null) => `${sec(sectionId)}/monthly-curve.pdf${qs({ student_id: studentId, campus_id: cid(campusId) })}`,
  /** subject = a memo subject id or 'all' («كل المواد»). */
  markingSheets: (sectionId: string, stage: number, subject: string = 'all', campusId?: string | null) =>
    `${sec(sectionId)}/marking-sheets.pdf${qs({ stage, subject, campus_id: cid(campusId) })}`,
  /** ZIP: «PDF/NN - name.pdf» per student plus the merged PDF (B6-47). */
  reportCardsZip: (sectionId: string, scope: JgScope, range: Range = {}, campusId?: string | null) =>
    `${sec(sectionId)}/report-cards.zip${qs({ scope, from: range.from, to: range.to, student_id: range.studentId, campus_id: cid(campusId) })}`,
}

export function jahbadhOfficialApi(api: ApiClient) {
  const q = (campusId?: string | null) => qs({ campus_id: cid(campusId) })
  return {
    statistics: (sectionId: string, campusId?: string | null) => api.get<JgStatistics>(`${sec(sectionId)}/statistics${q(campusId)}`),
    topStudents: (sectionId: string, n?: number, campusId?: string | null) => api.get<JgTopStudents>(`${sec(sectionId)}/top-students${qs({ n, campus_id: cid(campusId) })}`),
    finalSheet: (sectionId: string, campusId?: string | null) => api.get<JgFinalSheet>(`${sec(sectionId)}/final-sheet${q(campusId)}`),
    reviewSheet: (sectionId: string, campusId?: string | null) => api.get<JgReviewSheet>(`${sec(sectionId)}/review-sheet${q(campusId)}`),
    round2EntrySheet: (sectionId: string, campusId?: string | null) => api.get<JgRound2EntrySheet>(`${sec(sectionId)}/second-round/entry-sheet${q(campusId)}`),
    round2Timetable: (sectionId: string, campusId?: string | null) => api.get<JgRound2TimetableRow[]>(`${sec(sectionId)}/second-round/timetable${q(campusId)}`),
    /** Admin: date (YYYY-MM-DD), time and place per subject; filled once per grade and year. */
    saveRound2Timetable: (sectionId: string, entries: { jg_subject_id: string; exam_date?: string | null; exam_time?: string | null; place?: string | null }[], campusId?: string | null) =>
      api.put<JgRound2TimetableRow[]>(`${sec(sectionId)}/second-round/timetable${q(campusId)}`, { entries }),
    round2Notices: (sectionId: string, campusId?: string | null) => api.get<JgRound2Notices>(`${sec(sectionId)}/second-round/notices${q(campusId)}`),
    /** Admin: in-app push of the notices to each student's guardians. */
    sendRound2Notices: (sectionId: string, campusId?: string | null) => api.post<JgNoticesSent>(`${sec(sectionId)}/second-round/notices/send${q(campusId)}`, {}),
    guardianNotices: (sectionId: string, stage: number, campusId?: string | null) => api.get<JgGuardianNotices>(`${sec(sectionId)}/guardian-notices${qs({ stage, campus_id: cid(campusId) })}`),
    sendGuardianNotices: (sectionId: string, stage: number, campusId?: string | null) => api.post<JgNoticesSent>(`${sec(sectionId)}/guardian-notices/send${q(campusId)}`, { stage }),
    monthlyCards: (sectionId: string, query: { stage?: number; month?: number } & Range = {}, campusId?: string | null) =>
      api.get<JgMonthlyCards>(`${sec(sectionId)}/monthly-cards${qs({ stage: query.stage, month: query.month, from: query.from, to: query.to, student_id: query.studentId, campus_id: cid(campusId) })}`),
    monthlyCurve: (sectionId: string, studentId?: string, campusId?: string | null) =>
      api.get<JgMonthlyCurve>(`${sec(sectionId)}/monthly-curve${qs({ student_id: studentId, campus_id: cid(campusId) })}`),
    markingSheets: (sectionId: string, stage: number, subject: string = 'all', campusId?: string | null) =>
      api.get<JgMarkingSheets>(`${sec(sectionId)}/marking-sheets${qs({ stage, subject, campus_id: cid(campusId) })}`),
  }
}
