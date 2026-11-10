// Jahbadh grades — Wave 5 insight and administration (brief B6-30 … B6-50, B6-62; backend:
// jahbadh-insight.controller.ts, routes in jahbadh-grades.routes.ts and jahbadh-verify.routes.ts).
// The figures are computed by @studently/shared-utils (insight.ts, infographics.ts); infographic pages
// are rendered on the device from `infographics().model` with the shared functions (subjectOverview …).
import type {
  JgAllocStudent,
  JgAuditIssue,
  JgAuditThresholds,
  JgCertificateKind,
  JgCertificateRow,
  JgCommentRow,
  JgEdgeRow,
  JgInfModel,
  JgInflationRow,
  JgNeed,
  JgPhrase,
  JgPredictionRow,
  JgPrincipalRow,
  JgProgressStatus,
  JgRemedyKind,
  JgWhatIfScenario,
} from '@studently/shared-utils'

import type { ApiClient } from '../client'
import { qs } from '../query'
import type { JgSectionRef } from './jahbadh-grades'

interface JgInsightBase {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  grade_code: number
  grade_name: string
  no_fail: boolean
  stage_names: (string | null)[]
}

export interface JgInsightSettings {
  edge_margin: number
  edge_need_max: number
  inflation_gap: number
  audit_far: number
  audit_jump: number
  plan_weeks: number
  fairness_threshold: number
  support_actions: { school: string[]; home: string[] }
}

/** `final` | `todate` | `stage:N` | `month:N:I`. */
export type JgInfScopeValue = string

export interface JgInfographics extends JgInsightBase {
  scopes: { value: JgInfScopeValue; title: string }[]
  model: JgInfModel
  /** The «قارن مع» period, when asked. */
  compare: JgInfModel | null
}

export interface JgWorkflow extends JgInsightBase {
  mode: 'admin' | 'teacher' | 'reader'
  steps: { step: number; key: string; title: string; items: string[] }[]
  badges: { entry_pct: number | null; late: number | null; audit_errors: number | null; audit_warnings: number | null; approved_at: string | null }
}

export interface JgPrediction extends JgInsightBase { rows: JgPredictionRow[] }
export interface JgEdge extends JgInsightBase { margin: number; need_max: number; rows: JgEdgeRow[] }
export interface JgInflation extends JgInsightBase {
  threshold: number
  subjects: (JgInflationRow & { teacher: string | null })[]
  top_gaps: { student_id: string; name: string; subject: string; works: number; exam: number; gap: number }[]
  by_teacher: { teacher: string; subjects: string[]; mean_gap: number }[]
  note: string
}
export interface JgAutoComments extends JgInsightBase { stage: number; phrases: JgPhrase[]; rows: JgCommentRow[] }
export interface JgWeakItems extends JgInsightBase {
  subject_id: string
  subject: string
  stage: number
  has_subitems: boolean
  items: { id: string; name: string; component: string; max: number; avg: number | null; recorded: number; below_share: number | null; below_names: string[] }[]
  grid: { student_id: string; name: string; cells: (number | null)[] }[]
  weakest: { id: string; name: string; avg: number | null; below_share: number | null; below_names: string[]; plan: JgRemedyKind; plan_label: string }[]
}
export interface JgWhatIfResult extends JgInsightBase {
  current: { totalMin: number; examMin: number; jabrPlusOne: boolean }
  scenario: JgWhatIfScenario
  considered: number
  now: { pass: number; round2: number; fail: number }
  after: { pass: number; round2: number; fail: number }
  changed: { student_id: string; name: string; before: string; after: string; failing_before: number; failing_after: number }[]
}
export interface JgWhatIfSaved { id: string; name: string; params: JgWhatIfScenario; created_by: string | null; created_at: string; updated_at: string }
export interface JgEntryAudit extends JgInsightBase { thresholds: JgAuditThresholds; issues: JgAuditIssue[]; errors: number; warnings: number; roster: number }
export interface JgApproval extends JgInsightBase {
  migrated: boolean
  approved: { id: string; at: string; by: string | null; note: string | null } | null
  status: 'not_approved' | 'matches' | 'changed'
  status_label?: string
  changes: { student_id: string; subject_id: string; name: string; subject: string; stage: number | 'round2' | 'cells'; approved: number | string | null; current: number | string | null }[]
  log: { actor_id: string | null; actor_role: string | null; action: string; entity: string; student_id: string | null; before: unknown; after: unknown; created_at: string }[]
}
export interface JgVerificationArchive extends JgInsightBase {
  codes: { code: string; student_id: string; scope: string; summary: Record<string, unknown>; issued_at: string; url: string }[]
}
export interface JgVerificationCheck { status: 'matches' | 'outdated' | 'not_found'; summary?: Record<string, unknown>; issued_at?: string }
export interface JgPublicVerification {
  status: 'matches' | 'outdated' | 'not_found'
  school?: string | null
  name?: string | null
  grade?: string | null
  section?: string | null
  year?: string | null
  result?: string | null
  issued_at?: string
}
export interface JgCertificates extends JgInsightBase { scope: number | 'final'; scope_name: string; basic: boolean; certificates: Record<JgCertificateKind, JgCertificateRow[]> }
export interface JgSupportPlanRow {
  student_id: string
  name: string
  current: number | null
  projected: number | null
  current_band: string | null
  projected_band: string | null
  subjects: { subject_id: string; name: string; pct: number | null; to_pass: JgNeed; weakest: { name: string; pct: number } | null; weekly_goal: string }[]
  weeks: number
  school_actions: string[]
  home_actions: string[]
}
export interface JgSupportPlans extends JgInsightBase { weeks: number; plans: JgSupportPlanRow[] }
export interface JgAbsenceImpact extends JgInsightBase {
  rows: { student_id: string; name: string; days: number; unexcused: number; pct: number }[]
  bands: { label: string; count: number; avg: number | null }[]
  r: number | null
  slope_points_per_day: number | null
  line: { a: number; b: number } | null
  parent_message: string
  note: string
}
export interface JgEntryProgress extends JgInsightBase {
  deadlines: Record<number, string | null>
  current_stage: number
  current_pct: number | null
  rows: { subject_id: string; subject: string; stage: number; stage_name: string; required: number; done: number; pct: number; status: JgProgressStatus; status_label: string; deadline: string | null; teacher: string | null; reminder: string | null }[]
}
export interface JgExcellence extends JgInsightBase {
  period: { from?: string; to?: string }
  categories: string[]
  log: { id: string; student_id: string; name: string; awarded_on: string; category: number; category_name: string; points: number; note: string | null; awarded_by: string | null; created_at: string }[]
  rows: { student_id: string; name: string; per_category: number[]; total: number; rank: number; medal: 'gold' | 'silver' | 'bronze' | null }[]
  top10: { student_id: string; name: string; per_category: number[]; total: number; rank: number }[]
  stars: { category: string; points: number; students: string[] }[]
}
type Split = { m: number; f: number; total: number }
export interface JgEndOfYear extends JgInsightBase {
  totals: { enrolled: Split; examined: Split; passed: Split; round2: Split; failed: Split; undecided: Split }
  rates: Record<'passed' | 'round2' | 'failed' | 'undecided', number | null>
  averages: { all: number | null; boys: number | null; girls: number | null }
  attendance_rate: number | null
  subjects: { subject_id: string; name: string; count: number; average: number | null; highest: number | null; lowest: number | null; pass_rate: number | null; excellent: number; band: string | null }[]
  top5: { name: string; pct: number | null; rank: number | null }[]
  most_improved: { name: string; gain: string }[]
  recommendations: string[]
  /** Last year's figures and the free line, typed by the school. */
  manual: Record<string, number | string>
  approval: { at: string; note: string | null } | null
}
export interface JgPrincipalDashboard {
  campus_id: string
  rows: (JgPrincipalRow & { rank: number })[]
  totals: { enrolled: number; examined: number; passed: number; round2: number; failed: number; undecided: number; excellent: number; needs_support: number; entry_errors: number; pass_rate: number | null }
  reading: string[]
}
export interface JgSectionAllocation {
  campus_id: string
  from_grade_level_id: string
  repeat_grade_level_id: string | null
  pool: number
  overall?: number | null
  sections: { name: string; count: number; boys: number; girls: number; repeaters: number; average: number | null; gap: number | null; excellent: number; weak: number }[]
  list: (JgAllocStudent & { section: string })[]
}
export interface JgMarkingFairness {
  campus_id: string
  grade_level_id: string
  threshold: number
  subjects: { id: string; name: string }[]
  sections: string[]
  teachers: Record<string, Record<string, string | null>>
  cells: { section: string; subject: string; mean: number | null; gap: number | null; count: number; flagged: boolean }[]
  grade_mean: Record<string, number | null>
  top_gaps: { section: string; subject: string; subject_name: string; teacher: string | null; gap: number | null; recommendation: string }[]
}

const sec = (sectionId: string) => `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}`
const cid = (campusId?: string | null) => campusId ?? undefined

/** PDF paths (open with the authenticated download helper, like `jgPdfPath`). */
export const jgInsightPdfPath = {
  prediction: (sectionId: string, studentId?: string, campusId?: string | null) => `${sec(sectionId)}/prediction.pdf${qs({ student_id: studentId, campus_id: cid(campusId) })}`,
  edge: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/edge-students.pdf${qs({ campus_id: cid(campusId) })}`,
  inflation: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/inflation.pdf${qs({ campus_id: cid(campusId) })}`,
  autoComments: (sectionId: string, stage: number, campusId?: string | null) => `${sec(sectionId)}/auto-comments.pdf${qs({ stage, campus_id: cid(campusId) })}`,
  weakItems: (sectionId: string, subject: string, stage: number, campusId?: string | null) => `${sec(sectionId)}/weak-items.pdf${qs({ subject, stage, campus_id: cid(campusId) })}`,
  audit: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/entry-audit.pdf${qs({ campus_id: cid(campusId) })}`,
  approval: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/approval.pdf${qs({ campus_id: cid(campusId) })}`,
  verification: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/verification.pdf${qs({ campus_id: cid(campusId) })}`,
  certificates: (sectionId: string, kind: JgCertificateKind, scope: number | 'final' = 'final', campusId?: string | null) => `${sec(sectionId)}/certificates.pdf${qs({ kind, scope, campus_id: cid(campusId) })}`,
  supportPlans: (sectionId: string, studentId?: string, campusId?: string | null) => `${sec(sectionId)}/support-plans.pdf${qs({ student_id: studentId, campus_id: cid(campusId) })}`,
  absenceImpact: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/absence-impact.pdf${qs({ campus_id: cid(campusId) })}`,
  entryProgress: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/entry-progress.pdf${qs({ campus_id: cid(campusId) })}`,
  excellence: (sectionId: string, period: { from?: string; to?: string } = {}, campusId?: string | null) => `${sec(sectionId)}/excellence.pdf${qs({ from: period.from, to: period.to, campus_id: cid(campusId) })}`,
  endOfYear: (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/end-of-year.pdf${qs({ campus_id: cid(campusId) })}`,
  principalDashboard: (campusId?: string | null) => `/jahbadh-grades/principal-dashboard.pdf${qs({ campus_id: cid(campusId) })}`,
  allocation: (q: { from: string; repeat?: string | null; names: string[] }, campusId?: string | null) =>
    `/jahbadh-grades/section-allocation.pdf${qs({ from: q.from, repeat: q.repeat ?? undefined, names: q.names.join(','), campus_id: cid(campusId) })}`,
  fairness: (gradeLevelId: string, threshold?: number, campusId?: string | null) => `/jahbadh-grades/marking-fairness.pdf${qs({ grade_level_id: gradeLevelId, threshold, campus_id: cid(campusId) })}`,
}

/** POST body → PDF (what-if scenario); fetch with the authenticated client as a blob. */
export const jgWhatIfPdfPath = (sectionId: string, campusId?: string | null) => `${sec(sectionId)}/what-if.pdf${qs({ campus_id: cid(campusId) })}`

export function jahbadhInsightApi(api: ApiClient) {
  const q = (campusId?: string | null) => qs({ campus_id: cid(campusId) })
  return {
    // school-wide settings
    insightSettings: () => api.get<JgInsightSettings>('/jahbadh-grades/insight-settings'),
    saveInsightSettings: (body: Partial<JgInsightSettings>) => api.put<JgInsightSettings>('/jahbadh-grades/insight-settings', body),
    phraseBank: () => api.get<JgPhrase[]>('/jahbadh-grades/phrase-bank'),
    savePhraseBank: (phrases: { key: string; m: string; f: string }[]) => api.put<JgPhrase[]>('/jahbadh-grades/phrase-bank', { phrases }),
    excellenceCategories: () => api.get<string[]>('/jahbadh-grades/excellence-categories'),
    saveExcellenceCategories: (names: string[]) => api.put<string[]>('/jahbadh-grades/excellence-categories', { names }),

    // campus-wide (admins, coordinators, inspectors)
    principalDashboard: (campusId?: string | null) => api.get<JgPrincipalDashboard>(`/jahbadh-grades/principal-dashboard${q(campusId)}`),
    sectionAllocation: (query: { from: string; repeat?: string | null; names: string[] }, campusId?: string | null) =>
      api.get<JgSectionAllocation>(`/jahbadh-grades/section-allocation${qs({ from: query?.from, repeat: query?.repeat ?? undefined, names: ([] as string[]).concat(query?.names ?? []).join(','), campus_id: cid(campusId) })}`),
    markingFairness: (gradeLevelId: string, threshold?: number, campusId?: string | null) =>
      api.get<JgMarkingFairness>(`/jahbadh-grades/marking-fairness${qs({ grade_level_id: gradeLevelId, threshold, campus_id: cid(campusId) })}`),

    // section pages
    workflow: (sectionId: string, campusId?: string | null) => api.get<JgWorkflow>(`${sec(sectionId)}/workflow${q(campusId)}`),
    /** `scope` / `compare`: `final` | `todate` | `stage:N` | `month:N:I` (see `scopes`). */
    infographics: (sectionId: string, scope: JgInfScopeValue = 'final', compare?: JgInfScopeValue | null, campusId?: string | null) =>
      api.get<JgInfographics>(`${sec(sectionId)}/infographics${qs({ scope, compare: compare ?? undefined, campus_id: cid(campusId) })}`),
    prediction: (sectionId: string, studentId?: string | null, campusId?: string | null) => api.get<JgPrediction>(`${sec(sectionId)}/prediction${qs({ student_id: studentId ?? undefined, campus_id: cid(campusId) })}`),
    edgeStudents: (sectionId: string, opts: { margin?: number; need?: number } = {}, campusId?: string | null) => api.get<JgEdge>(`${sec(sectionId)}/edge-students${qs({ margin: opts.margin, need: opts.need, campus_id: cid(campusId) })}`),
    inflation: (sectionId: string, gap?: number, campusId?: string | null) => api.get<JgInflation>(`${sec(sectionId)}/inflation${qs({ gap, campus_id: cid(campusId) })}`),
    autoComments: (sectionId: string, stage: number, campusId?: string | null) => api.get<JgAutoComments>(`${sec(sectionId)}/auto-comments${qs({ stage, campus_id: cid(campusId) })}`),
    weakItems: (sectionId: string, subject: string, stage: number, campusId?: string | null) => api.get<JgWeakItems>(`${sec(sectionId)}/weak-items${qs({ subject, stage, campus_id: cid(campusId) })}`),
    /** Admin: runs a scenario (never writes grades). */
    whatIf: (sectionId: string, scenario: JgWhatIfScenario, campusId?: string | null) => api.post<JgWhatIfResult>(`${sec(sectionId)}/what-if${q(campusId)}`, scenario),
    whatIfScenarios: (sectionId: string, campusId?: string | null) => api.get<JgWhatIfSaved[]>(`${sec(sectionId)}/what-if/scenarios${q(campusId)}`),
    createWhatIfScenario: (sectionId: string, body: { name: string; params: JgWhatIfScenario }, campusId?: string | null) => api.post<JgWhatIfSaved[]>(`${sec(sectionId)}/what-if/scenarios${q(campusId)}`, body),
    updateWhatIfScenario: (sectionId: string, scenarioId: string, body: { name: string; params: JgWhatIfScenario }, campusId?: string | null) =>
      api.put<JgWhatIfSaved[]>(`${sec(sectionId)}/what-if/scenarios/${encodeURIComponent(scenarioId)}${q(campusId)}`, body),
    deleteWhatIfScenario: (sectionId: string, scenarioId: string, campusId?: string | null) => api.del<JgWhatIfSaved[]>(`${sec(sectionId)}/what-if/scenarios/${encodeURIComponent(scenarioId)}${q(campusId)}`),
    /** Errors block publishing report cards (409 `audit_errors`). */
    entryAudit: (sectionId: string, campusId?: string | null) => api.get<JgEntryAudit>(`${sec(sectionId)}/entry-audit${q(campusId)}`),
    approval: (sectionId: string, campusId?: string | null) => api.get<JgApproval>(`${sec(sectionId)}/approval${q(campusId)}`),
    approve: (sectionId: string, note?: string | null, campusId?: string | null) => api.post<JgApproval>(`${sec(sectionId)}/approval${q(campusId)}`, { note: note ?? null }),
    verificationArchive: (sectionId: string, campusId?: string | null) => api.get<JgVerificationArchive>(`${sec(sectionId)}/verification${q(campusId)}`),
    /** `scope`: 'final' or 'stageN' (as report cards). Returns student id → code. */
    issueVerificationCodes: (sectionId: string, scope: string = 'final', campusId?: string | null) => api.post<{ codes: Record<string, string> }>(`${sec(sectionId)}/verification${q(campusId)}`, { scope }),
    checkVerificationCode: (sectionId: string, code: string, studentNumber?: string | null, campusId?: string | null) =>
      api.get<JgVerificationCheck>(`${sec(sectionId)}/verification/check${qs({ code, student_number: studentNumber ?? undefined, campus_id: cid(campusId) })}`),
    certificates: (sectionId: string, scope: number | 'final' = 'final', campusId?: string | null) => api.get<JgCertificates>(`${sec(sectionId)}/certificates${qs({ scope, campus_id: cid(campusId) })}`),
    supportPlans: (sectionId: string, opts: { weeks?: number; studentId?: string } = {}, campusId?: string | null) =>
      api.get<JgSupportPlans>(`${sec(sectionId)}/support-plans${qs({ weeks: opts.weeks, student_id: opts.studentId, campus_id: cid(campusId) })}`),
    saveSupportPlan: (sectionId: string, studentId: string, body: { weeks?: number; school_actions?: string[]; home_actions?: string[] }, campusId?: string | null) =>
      api.put<JgSupportPlans>(`${sec(sectionId)}/support-plans/${encodeURIComponent(studentId)}${q(campusId)}`, body),
    absenceImpact: (sectionId: string, campusId?: string | null) => api.get<JgAbsenceImpact>(`${sec(sectionId)}/absence-impact${q(campusId)}`),
    entryProgress: (sectionId: string, campusId?: string | null) => api.get<JgEntryProgress>(`${sec(sectionId)}/entry-progress${q(campusId)}`),
    /** Admin: reminders to the teachers of late subjects (`all`: every unfinished one). */
    sendEntryReminders: (sectionId: string, all = false, campusId?: string | null) => api.post<{ sent: number; rows: number }>(`${sec(sectionId)}/entry-progress/reminders${q(campusId)}`, { all }),
    stageDeadlines: (sectionId: string, campusId?: string | null) => api.get<Record<number, string | null>>(`${sec(sectionId)}/stage-deadlines${q(campusId)}`),
    saveStageDeadlines: (sectionId: string, deadlines: Record<number, string | null>, campusId?: string | null) => api.put<Record<number, string | null>>(`${sec(sectionId)}/stage-deadlines${q(campusId)}`, deadlines),
    excellence: (sectionId: string, period: { from?: string; to?: string } = {}, campusId?: string | null) => api.get<JgExcellence>(`${sec(sectionId)}/excellence${qs({ from: period.from, to: period.to, campus_id: cid(campusId) })}`),
    addExcellencePoints: (sectionId: string, body: { student_id: string; category: number; points: number; note?: string; awarded_on?: string }, campusId?: string | null) =>
      api.post<JgExcellence>(`${sec(sectionId)}/excellence${q(campusId)}`, body),
    deleteExcellencePoints: (sectionId: string, entryId: string, campusId?: string | null) => api.del<JgExcellence>(`${sec(sectionId)}/excellence/${encodeURIComponent(entryId)}${q(campusId)}`),
    endOfYear: (sectionId: string, campusId?: string | null) => api.get<JgEndOfYear>(`${sec(sectionId)}/end-of-year${q(campusId)}`),
    saveEndOfYear: (sectionId: string, manual: Record<string, number | string>, campusId?: string | null) => api.put<JgEndOfYear>(`${sec(sectionId)}/end-of-year${q(campusId)}`, { manual }),

    /** Public (no sign-in): the page behind the QR printed on report cards. */
    publicVerify: (code: string) => api.get<JgPublicVerification>(`/jahbadh-verify/${encodeURIComponent(code)}`),
  }
}
