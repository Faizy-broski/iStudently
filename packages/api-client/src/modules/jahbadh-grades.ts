// Jahbadh grades plugin: official Libyan grade distribution, grade entry per section × subject,
// second round, stage locks, results (backend: jahbadh-grades.routes.ts; web: /admin/jahbadh-grades,
// /teacher/jahbadh-grades). Totals and results come computed from the server; clients recompute
// live with the same engine (@studently/shared-utils jahbadh).
import type { JgActMode, JgBloomLevel, JgItemAnalysis, JgMonthlyKind, JgQuestion, JgRisk, JgRound2Need, JgRubricCriterion, JgScaleStep, JgSubjectAnalysis, JgSubjectMeta, JgSubjectResult, JgSubjectSummary, JgResult, JgTrend } from '@studently/shared-utils'

import type { ApiClient } from '../client'
import { qs } from '../query'

export interface JgRule {
  id: string
  school_id: string | null
  version_label: string
  grade_code: number
  name: string
  level: 'basic' | 'secondary'
  track: 'science' | 'humanities' | null
  system_name: string
  no_fail: boolean
  total_min: number
  exam_min: number
  stage_names: (string | null)[]
  rule_text: string
  certificate_name: string | null
  next_grade_name: string | null
  /** Article 51: second round only up to this many failed subjects (0 = no limit). */
  max_round2_subjects: number
}

/** A sub-item (brief Appendix B). `component_id` null = a branch of the second-round exam. */
export interface JgSubItem {
  id: string
  subject_id: string
  component_id: string | null
  sort_order: number
  name: string
  max_score: number
}

export interface JgComponent {
  id: string
  subject_id: string
  stage: number
  sort_order: number
  name: string
  max_score: number
  is_exam: boolean
  /** Entered month by month in «سجل الأنشطة الشهري»; null = entered once in the grid. */
  monthly_kind: JgMonthlyKind | null
  /** Component = ROUND(Σ sub-items ÷ divisor, 2). */
  divisor: number
  /** Non-empty = computed from these (read-only in the grid; sub-items entered instead). */
  subitems: JgSubItem[]
}

export interface JgSubject {
  id: string
  key: string
  name: string
  short_name: string
  weekly_periods: number
  display_order: number
  components: JgComponent[]
  /** Branches of the second-round exam (Σ = the second-round mark). */
  round2_subitems: JgSubItem[]
  meta: JgSubjectMeta
}

export interface JgGrade {
  rule: JgRule
  subjects: JgSubject[]
}

export interface JgSettings {
  version_label: string
  follow_rate: number
  excel_rate: number
  grading_scale: JgScaleStep[]
  /** school_name, education_office, municipality, principal, homeroom_teacher, logo_url */
  header: Record<string, string>
  /** م 122 «جبر الكسور لصالح الطالب» (default true). */
  jabr_kasur: boolean
  /** م 122 «درجة واحدة في مادة واحدة للنجاح» (default true). */
  jabr_plus_one: boolean
  /** «حساب الأنشطة الشهرية» (default 'average'). */
  act_mode: JgActMode
  /** 3 stages × 4 month names; «—» = month not used. */
  month_names: string[][]
  /** Stage the grid and prints open on; null = «كل الكشف». */
  default_stage: number | null
}

export interface JgSectionRef {
  id: string
  name: string
  school_id: string
  grade_level_id: string
  grade_level_name: string
}

export interface JgSectionListItem {
  id: string
  name: string
  grade_level_id: string
  grade_level_name: string
  grade_code: number
}

export interface JgSectionSubject {
  id: string
  key: string
  name: string
  short_name: string
  weekly_periods: number
  subject_max: number
  exam_max: number
  can_enter: boolean
}

export interface JgSectionOverview {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  rule: JgRule
  settings: JgSettings
  subjects: JgSectionSubject[]
}

export interface JgStudent {
  id: string
  name: string
  gender: string | null
  student_number: string | null
}

/** One cell as computed by the server. `derived` cells are read-only. */
export interface JgEffectiveCell {
  value: number | null
  absent: boolean
  source: 'teacher' | 'control_import'
  /** 'monthly' = from the monthly log; 'subitems' = Σ sub-items ÷ divisor. */
  derived?: 'monthly' | 'subitems'
  /** Some sub-items still empty: show the value in orange. */
  partial?: boolean
  /** ▲ ▼ ● first vs last month entered. */
  trend?: JgTrend | null
}

export interface JgGridRow {
  student: JgStudent
  /** Per component id. */
  cells: Record<string, JgEffectiveCell>
  /** Per sub-item id (entered once, or derived from months). */
  subitem_cells: Record<string, JgEffectiveCell>
  round2: number | null
  result: JgSubjectResult
  need: JgRound2Need
}

export interface JgGrid {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  /** Memo year this academic year follows. */
  version: string
  rule: JgRule
  subject: JgSubject
  settings: JgSettings
  can_enter: boolean
  locked_stages: number[]
  /** Stage shown (?stage= or the school default); null = «كل الكشف». Rows always carry every stage. */
  stage: number | null
  rows: JgGridRow[]
  summary: JgSubjectSummary
}

export interface JgSubItemCellInput {
  student_id: string
  subitem_id: string
  /** null clears the cell (unless absent). */
  value: number | null
  absent?: boolean
}

/** ?stage= of grids, saves and the grid PDF: 1–3 or 'all'; omit for the school default. */
export type JgStageParam = 1 | 2 | 3 | 'all'

// ---- monthly activities log («سجل الأنشطة الشهري») ---------------------------------------------------

export type JgMonthlyKindFilter = JgMonthlyKind | 'all'

export interface JgMonthlyColumn {
  /** Component id, or sub-item id when the component is split (send it as `target_id`). */
  id: string
  kind: 'component' | 'subitem'
  component_id: string
  component_name: string
  name: string
  max: number
  monthly_kind: JgMonthlyKind
}

export interface JgMonthlyRow {
  student: JgStudent
  values: Record<string, { value: number | null; absent: boolean; source: string } | null>
  months: Record<string, (number | null)[]>
  marks: Record<string, number | null>
  trends: Record<string, JgTrend | null>
  component_month: Record<string, number | null>
  month_total: number | null
  components: Record<string, JgEffectiveCell | null>
}

export interface JgMonthlyLog {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  version: string
  grade_code: number
  subject: { id: string; key: string; name: string; short_name: string }
  stage: number
  stage_name: string
  month_idx: number
  month_name: string
  months: { idx: number; name: string }[]
  kind: JgMonthlyKindFilter
  kinds: JgMonthlyKind[]
  can_enter: boolean
  locked: boolean
  act_mode: JgActMode
  components: { id: string; name: string; max: number; monthly_kind: JgMonthlyKind; divisor: number; subitems: number }[]
  columns: JgMonthlyColumn[]
  rows: JgMonthlyRow[]
}

export interface JgMonthlyQuery {
  /** 1–3; default the first stage with monthly components. */
  stage?: number
  /** 0–3; default the first month in use. */
  month?: number
  kind?: JgMonthlyKindFilter
}

export interface JgMonthlyCellInput {
  student_id: string
  target_id: string
  value: number | null
  absent?: boolean
}

// ---- memo upgrade ------------------------------------------------------------------------------------

export interface JgUpgradeGradeDiff {
  grade_code: number
  name: string
  total_before: number | null
  total_after: number
  subjects_added: string[]
  subjects_removed: string[]
  components_changed: { subject: string; stage: number; sort_order: number; before: string; after: string }[]
  marks: number
  marks_unmapped: number
}

export interface JgUpgradePreview {
  from: string
  to: string
  academic_year: { id: string; name: string | null }
  already_linked: string | null
  grades: JgUpgradeGradeDiff[]
}

export interface JgUpgradeResult {
  from: string
  to: string
  academic_year_id: string
  marks_moved: number
  marks_unmapped: number
}

export interface JgCellInput {
  student_id: string
  component_id: string
  /** null clears the cell (unless absent). */
  value: number | null
  absent?: boolean
}

export interface JgLock {
  id: string
  jg_subject_id: string | null
  stage: number
  locked_by: string | null
  locked_at: string
}

export interface JgResultSubject {
  id: string
  key: string
  name: string
  short_name: string
  subject_max: number
  exam_max: number
}

export interface JgResultStudent {
  student: JgStudent
  /** `jabr` = the Article 122 extra mark went to this subject; `missing` = stages not entered yet. */
  subjects: Record<string, { result: JgSubjectResult; need: JgRound2Need; jabr: boolean; missing: number[] | 'all' | null }>
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  /** Among complete students only. */
  rank: number | null
  support_subjects: string[]
  /** '' when nothing is entered for the student. */
  decision: string
  /** Decision plus «لم يُرصد بعد: …» when incomplete. */
  decision_detail: string
  missing_text: string | null
  incomplete: boolean
  rankable: boolean
  /** Article 51: «راسب», left out of the second round. */
  over_round2_limit: boolean
}

export interface JgResults {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  version: string
  rule: JgRule
  settings: JgSettings
  subjects: JgResultSubject[]
  grand_max: number
  students: JgResultStudent[]
}

export interface JgSecondRound {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  rule: JgRule
  no_fail: boolean
  subjects: JgResultSubject[]
  tiles: { referred: number; awaiting: number; passed_after: number; failed: number; pass_rate: number | null; top_subject: string | null }
  per_subject: { subject_id: string; referred: number; awaiting: number; passed_after: number; failed: number }[]
  students: { student: JgStudent; cells: Record<string, JgRound2Need>; subject_count: number; decision: string }[]
}

export interface JgGradeMapEntry {
  grade_level_id: string
  name: string
  grade_code: number | null
  suggested_code: number | null
}

export interface JgSubjectLinks {
  grade_code: number
  platform_subjects: { id: string; name: string; code?: string | null }[]
  links: { jg_subject_id: string; key: string; name: string; subject_id: string | null; suggested_subject_id: string | null }[]
}

export interface JgAuditEntry {
  id: number
  actor_id: string | null
  actor_role: string | null
  action: string
  entity: string
  entity_id: string | null
  student_id: string | null
  before: unknown
  after: unknown
  created_at: string
}

export type JgRuleUpdate = Partial<Pick<JgRule, 'system_name' | 'no_fail' | 'total_min' | 'exam_min' | 'stage_names' | 'rule_text' | 'certificate_name' | 'next_grade_name'>> & {
  subjects?: {
    id: string
    name?: string
    weekly_periods?: number
    components?: (Omit<JgComponent, 'id' | 'subject_id' | 'monthly_kind' | 'divisor' | 'subitems'> & { id?: string })[]
  }[]
}

export type JgScope = 'stage1' | 'stage2' | 'stage3' | 'final'
export type JgActivityLevel = 'ممتاز' | 'جيد جداً' | 'جيد' | 'مقبول'

export interface JgActivityRow {
  student: JgStudent
  art: JgActivityLevel | null
  music: JgActivityLevel | null
  pe: JgActivityLevel | null
  excused_days: number | null
  unexcused_days: number | null
  teacher_note: string | null
}

export interface JgActivities {
  stage: number
  stage_names: (string | null)[]
  stages: number[]
  levels: JgActivityLevel[]
  activity_subjects: string[]
  school_days: number | null
  rows: JgActivityRow[]
}

export interface JgActivityInput {
  student_id: string
  art: JgActivityLevel | null
  music: JgActivityLevel | null
  pe: JgActivityLevel | null
  excused_days: number | null
  unexcused_days: number | null
  teacher_note: string | null
}

/** The 12 optional elements of a report card (B7). */
export interface JgReportCardOptions {
  rank: boolean
  minPass: boolean
  subjectEstimate: boolean
  classAverage: boolean
  performanceBar: boolean
  trend: boolean
  badges: boolean
  insight: boolean
  activities: boolean
  attendance: boolean
  guardianTips: boolean
  quote: boolean
  /** Wave 2 (default off): black-and-white printing. */
  bw?: boolean
  /** Wave 2 (default off): «التوقع المبكر» at stage scope («يحتاج للنجاح» column, year-end projection). */
  prediction?: boolean
  /** Wave 2 (default off): «الملاحظات التلقائية» when the stage note is empty. */
  autoNotes?: boolean
}

/** The three Wave 2 toggles, shown after the 12 B7 elements. */
export const JG_REPORT_CARD_EXTRA_KEYS = ['bw', 'prediction', 'autoNotes'] as const

/** The 12 B7 elements (always present in `options`). */
export type JgReportCardOptionKey = Exclude<keyof JgReportCardOptions, (typeof JG_REPORT_CARD_EXTRA_KEYS)[number]>

export const JG_REPORT_CARD_OPTION_KEYS: JgReportCardOptionKey[] = [
  'rank', 'minPass', 'subjectEstimate', 'classAverage', 'performanceBar', 'trend',
  'badges', 'insight', 'activities', 'attendance', 'guardianTips', 'quote',
]

export interface JgReportCardSettings {
  options: JgReportCardOptions
  guardian_tips: string[]
  quotes: string[]
}

/** Preview data of one card (the PDF is rendered by the server). */
export interface JgReportCardPreview {
  title: string
  stageNames: string[]
  student: { name: string; gender: string | null; listNumber: number; nationality: string; registrationNumber: string; motherName: string; birth: string }
  subjects: { name: string; final: number | null; max: number; pct: number | null; estimate: string | null }[]
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  classSize: number
  decision: string
}

export interface JgPublication {
  id: string
  scope: JgScope
  published_by: string | null
  published_at: string
}

export interface JgMyReportCard {
  student_id: string
  student_name: string
  section_id: string
  scope: JgScope
  published_at: string
  academic_year: string | null
}
// ---- analytics (Phase 3) ----

export interface JgDashboardSubject {
  id: string
  name: string
  max: number
  recorded: number
  mean: number | null
  meanPct: number | null
  median: number | null
  stdev: number | null
  highest: number | null
  lowest: number | null
  passRate: number | null
  levels: Record<string, number>
  stageAverages: Record<string, number | null>
  worksMastery: number | null
  examMastery: number | null
  gap: number | null
  boysPct: number | null
  girlsPct: number | null
}

export interface JgDashboard {
  section: JgSectionRef
  rule: JgRule
  settings: JgSettings
  stage_names: (string | null)[]
  stages: number[]
  tiles: { students: number; recorded: number; average: number | null; passRate: number | null; excellent: number; needSupport: number }
  subjects: JgDashboardSubject[]
  strongest: string | null
  weakest: string | null
  levels: Record<string, number>
}

export interface JgStudentProfile {
  student: JgStudent
  list_number: number
  section: JgSectionRef
  rule: JgRule
  stage_names: (string | null)[]
  stages: number[]
  subjects: { id: string; name: string; stages: Record<string, number | null>; round2: number | null; final: number | null; max: number; pct: number | null; estimate: string | null; result: JgResult | null; classAvgPct: number | null; trend: number | null }[]
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  class_size: number
  support_subjects: string[]
  decision: string
  feedback: string
}

export interface JgEarlyWarningRow {
  student: JgStudent
  pct: number | null
  struggling: number
  stage1: number | null
  stage2: number | null
  change: number | null
  gap: number | null
  risk: JgRisk | null
}

export interface JgEarlyWarning {
  section: JgSectionRef
  rule: JgRule
  stage_names: (string | null)[]
  stages: number[]
  tiles: { high: number; medium: number; low: number; averageChange: number | null }
  rows: JgEarlyWarningRow[]
  mostImproved: JgEarlyWarningRow[]
  priority: JgEarlyWarningRow[]
}

export interface JgLearningGroups {
  subject: { id: string; name: string }
  subjects: { id: string; name: string }[]
  follow_rate: number
  excel_rate: number
  groups: Record<'enrichment' | 'reinforcement' | 'remedial', { student: JgStudent; pct: number }[]>
}

export interface JgSubjectAnalysisResponse {
  section: JgSectionRef
  academic_year: { id: string; name: string | null }
  rule: JgRule
  subject: { id: string; name: string }
  subjects: { id: string; name: string }[]
  measures: { value: string; label: string }[]
  measure: { value: string; label: string; max: number }
  compare: { value: string; label: string; max: number } | null
  pass_rate: number
  learners: string
  analysis: JgSubjectAnalysis
  reading: string[]
}

export interface JgTestSummary {
  id: string
  name: string
  test_date: string | null
  jg_subject_id: string | null
  updated_at: string
}

export interface JgTest extends JgTestSummary {
  questions: JgQuestion[]
  scores: Record<string, (number | null)[]>
  students: { student: JgStudent; total: number; pct: number; rank: number }[]
  analysis: JgItemAnalysis
}

export interface JgTestInput {
  name: string
  test_date?: string | null
  jg_subject_id?: string | null
  questions: { max: number; level?: JgBloomLevel | null }[]
  scores: Record<string, (number | null)[]>
}

export interface JgRubricSummary {
  id: string
  name: string
  max_score: number
  updated_at: string
}

export interface JgRubric extends JgRubricSummary {
  criteria: JgRubricCriterion[]
  levels: Record<string, (number | null)[]>
  weights_total: number
  rows: { student: JgStudent; levels: (number | null)[]; mark: number | null; level: string | null }[]
}

export interface JgRubricInput {
  name: string
  max_score: number
  criteria: JgRubricCriterion[]
  levels: Record<string, (number | null)[]>
}
/** Paths of the server PDFs (relative to the API base, for authenticated downloads). */
export const jgPdfPath = {
  results: (sectionId: string, campusId?: string | null) => `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/results.pdf${qs({ campus_id: campusId ?? undefined })}`,
  secondRound: (sectionId: string, campusId?: string | null) => `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/second-round.pdf${qs({ campus_id: campusId ?? undefined })}`,
  reportCards: (sectionId: string, scope: JgScope, range: { from?: number; to?: number; studentId?: string } = {}, campusId?: string | null) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/report-cards.pdf${qs({ scope, from: range.from, to: range.to, student_id: range.studentId, campus_id: campusId ?? undefined })}`,
  studentProfile: (sectionId: string, studentId: string, campusId?: string | null) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/students/${encodeURIComponent(studentId)}/profile/pdf${qs({ campus_id: campusId ?? undefined })}`,
  subjectAnalysis: (sectionId: string, q: { subject?: string; measure?: string; compare?: string; pass?: number }, campusId?: string | null) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/subject-analysis/pdf${qs({ ...q, campus_id: campusId ?? undefined })}`,
  test: (sectionId: string, testId: string, campusId?: string | null) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/tests/${encodeURIComponent(testId)}/pdf${qs({ campus_id: campusId ?? undefined })}`,
  myReportCard: (studentId: string, scope: JgScope) => `/jahbadh-grades/my/report-cards/${encodeURIComponent(studentId)}/${scope}`,
  sampleReportCard: (campusId?: string | null) => `/jahbadh-grades/sample-report-card.pdf${qs({ campus_id: campusId ?? undefined })}`,
  /** Subject sheet; follows the stage (1–3 | 'all'; omitted = the school default). */
  grid: (sectionId: string, subjectId: string, campusId?: string | null, stage?: JgStageParam) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/subjects/${encodeURIComponent(subjectId)}/grid.pdf${qs({ stage, campus_id: campusId ?? undefined })}`,
  /** «سجل الأنشطة الشهري»: one subject × month on A4; blank = for pen entry. */
  monthly: (sectionId: string, subjectId: string, q: JgMonthlyQuery & { blank?: boolean } = {}, campusId?: string | null) =>
    `/jahbadh-grades/sections/${encodeURIComponent(sectionId)}/subjects/${encodeURIComponent(subjectId)}/monthly.pdf${qs({ stage: q.stage, month: q.month, kind: q.kind, blank: q.blank ? 1 : undefined, campus_id: campusId ?? undefined })}`,
}

export function jahbadhGradesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const sec = (sectionId: string) => `/jahbadh-grades/sections/${id(sectionId)}`
  // campus_id: the plugin may be enabled for one campus only (the gate checks the campus row first).
  const cq = (campusId?: string | null) => qs({ campus_id: campusId ?? undefined })
  return {
    rules: (campusId?: string | null) => api.get<{ source: 'school' | 'template'; grades: JgGrade[] }>(`/jahbadh-grades/rules${qs({ campus_id: campusId ?? undefined })}`),
    rule: (gradeCode: number, campusId?: string | null) => api.get<JgGrade>(`/jahbadh-grades/rules/${gradeCode}${qs({ campus_id: campusId ?? undefined })}`),
    updateRule: (gradeCode: number, body: JgRuleUpdate, campusId?: string | null) => api.put<JgGrade>(`/jahbadh-grades/rules/${gradeCode}`, { ...body, campus_id: campusId ?? undefined }),
    setup: (campusId?: string | null) => api.post<{ created: boolean; grades: number }>('/jahbadh-grades/setup', { campus_id: campusId ?? undefined }),
    /** What moving to another memo year (default the current one, 2026-2027) would change; nothing is written. */
    upgradePreview: (target?: string, academicYearId?: string | null) =>
      api.get<JgUpgradePreview>(`/jahbadh-grades/setup/upgrade-preview${qs({ target, academic_year_id: academicYearId ?? undefined })}`),
    upgrade: (target?: string, academicYearId?: string | null) =>
      api.post<JgUpgradeResult>('/jahbadh-grades/setup/upgrade', { target, academic_year_id: academicYearId ?? undefined }),

    settings: (campusId?: string | null) => api.get<JgSettings>(`/jahbadh-grades/settings${qs({ campus_id: campusId ?? undefined })}`),
    saveSettings: (body: Partial<JgSettings>, campusId?: string | null) => api.put<JgSettings>('/jahbadh-grades/settings', { ...body, campus_id: campusId ?? null }),
    gradeMap: (campusId?: string | null) => api.get<JgGradeMapEntry[]>(`/jahbadh-grades/grade-map${qs({ campus_id: campusId ?? undefined })}`),
    saveGradeMap: (entries: { grade_level_id: string; grade_code: number | null }[], campusId?: string | null) =>
      api.put<JgGradeMapEntry[]>('/jahbadh-grades/grade-map', { entries, campus_id: campusId ?? undefined }),
    subjectLinks: (gradeLevelId: string, campusId?: string | null) =>
      api.get<JgSubjectLinks>(`/jahbadh-grades/subject-links${qs({ grade_level_id: gradeLevelId, campus_id: campusId ?? undefined })}`),
    saveSubjectLinks: (gradeLevelId: string, entries: { jg_subject_id: string; subject_id: string | null }[], campusId?: string | null) =>
      api.put<JgSubjectLinks>('/jahbadh-grades/subject-links', { grade_level_id: gradeLevelId, entries, campus_id: campusId ?? undefined }),

    sections: (campusId?: string | null) => api.get<JgSectionListItem[]>(`/jahbadh-grades/sections${qs({ campus_id: campusId ?? undefined })}`),
    sectionSubjects: (sectionId: string, campusId?: string | null) => api.get<JgSectionOverview>(`${sec(sectionId)}/subjects${cq(campusId)}`),
    grid: (sectionId: string, subjectId: string, campusId?: string | null, stage?: JgStageParam) =>
      api.get<JgGrid>(`${sec(sectionId)}/subjects/${id(subjectId)}/grid${qs({ stage, campus_id: campusId ?? undefined })}`),
    saveSubItemMarks: (sectionId: string, subjectId: string, cells: JgSubItemCellInput[], campusId?: string | null, stage?: JgStageParam) =>
      api.put<JgGrid>(`${sec(sectionId)}/subjects/${id(subjectId)}/subitem-marks${qs({ stage, campus_id: campusId ?? undefined })}`, { cells }),
    monthly: (sectionId: string, subjectId: string, q: JgMonthlyQuery = {}, campusId?: string | null) =>
      api.get<JgMonthlyLog>(`${sec(sectionId)}/subjects/${id(subjectId)}/monthly${qs({ stage: q.stage, month: q.month, kind: q.kind, campus_id: campusId ?? undefined })}`),
    saveMonthly: (sectionId: string, subjectId: string, body: { stage: number; month_idx: number; kind?: JgMonthlyKindFilter; cells: JgMonthlyCellInput[] }, campusId?: string | null) =>
      api.put<JgMonthlyLog>(`${sec(sectionId)}/subjects/${id(subjectId)}/monthly${cq(campusId)}`, body),

    saveMarks: (sectionId: string, subjectId: string, cells: JgCellInput[], campusId?: string | null, stage?: JgStageParam) =>
      api.put<JgGrid>(`${sec(sectionId)}/subjects/${id(subjectId)}/marks${qs({ stage, campus_id: campusId ?? undefined })}`, { cells }),
    saveRound2: (sectionId: string, subjectId: string, entries: { student_id: string; value: number | null }[], campusId?: string | null, stage?: JgStageParam) =>
      api.put<JgGrid>(`${sec(sectionId)}/subjects/${id(subjectId)}/round2${qs({ stage, campus_id: campusId ?? undefined })}`, { entries }),
    locks: (sectionId: string, campusId?: string | null) => api.get<JgLock[]>(`${sec(sectionId)}/locks${cq(campusId)}`),
    addLock: (sectionId: string, stage: number, subjectId?: string | null, campusId?: string | null) =>
      api.post<JgLock[]>(`${sec(sectionId)}/locks${cq(campusId)}`, { stage, subject_id: subjectId ?? null }),
    removeLock: (sectionId: string, lockId: string, campusId?: string | null) => api.del<JgLock[]>(`${sec(sectionId)}/locks/${id(lockId)}${cq(campusId)}`),
    results: (sectionId: string, campusId?: string | null) => api.get<JgResults>(`${sec(sectionId)}/results${cq(campusId)}`),
    secondRound: (sectionId: string, campusId?: string | null) => api.get<JgSecondRound>(`${sec(sectionId)}/second-round${cq(campusId)}`),
    activities: (sectionId: string, stage: number, campusId?: string | null) => api.get<JgActivities>(`${sec(sectionId)}/activities${qs({ stage, campus_id: campusId ?? undefined })}`),
    saveActivities: (sectionId: string, stage: number, body: { school_days?: number | null; entries: JgActivityInput[] }, campusId?: string | null) =>
      api.put<JgActivities>(`${sec(sectionId)}/activities${cq(campusId)}`, { ...body, stage }),
    reportCardSettings: (sectionId: string, campusId?: string | null) => api.get<JgReportCardSettings>(`${sec(sectionId)}/report-card-settings${cq(campusId)}`),
    saveReportCardSettings: (sectionId: string, body: Partial<JgReportCardSettings>, campusId?: string | null) =>
      api.put<JgReportCardSettings>(`${sec(sectionId)}/report-card-settings${cq(campusId)}`, body),
    reportCards: (sectionId: string, scope: JgScope, campusId?: string | null) =>
      api.get<{ cards: JgReportCardPreview[]; options: JgReportCardOptions }>(`${sec(sectionId)}/report-cards${qs({ scope, campus_id: campusId ?? undefined })}`),
    publications: (sectionId: string, campusId?: string | null) => api.get<JgPublication[]>(`${sec(sectionId)}/publications${cq(campusId)}`),
    publish: (sectionId: string, scope: JgScope, campusId?: string | null) => api.post<JgPublication[]>(`${sec(sectionId)}/publications${cq(campusId)}`, { scope }),
    unpublish: (sectionId: string, publicationId: string, campusId?: string | null) =>
      api.del<JgPublication[]>(`${sec(sectionId)}/publications/${id(publicationId)}${cq(campusId)}`),
    dashboard: (sectionId: string, campusId?: string | null) => api.get<JgDashboard>(`${sec(sectionId)}/dashboard${cq(campusId)}`),
    earlyWarning: (sectionId: string, campusId?: string | null) => api.get<JgEarlyWarning>(`${sec(sectionId)}/early-warning${cq(campusId)}`),
    learningGroups: (sectionId: string, subjectId?: string | null, campusId?: string | null) =>
      api.get<JgLearningGroups>(`${sec(sectionId)}/groups${qs({ subject: subjectId ?? undefined, campus_id: campusId ?? undefined })}`),
    studentProfile: (sectionId: string, studentId: string, campusId?: string | null) =>
      api.get<JgStudentProfile>(`${sec(sectionId)}/students/${id(studentId)}/profile${cq(campusId)}`),
    subjectAnalysis: (sectionId: string, q: { subject?: string; measure?: string; compare?: string; pass?: number }, campusId?: string | null) =>
      api.get<JgSubjectAnalysisResponse>(`${sec(sectionId)}/subject-analysis${qs({ ...q, campus_id: campusId ?? undefined })}`),
    tests: (sectionId: string, campusId?: string | null) => api.get<JgTestSummary[]>(`${sec(sectionId)}/tests${cq(campusId)}`),
    test: (sectionId: string, testId: string, campusId?: string | null) => api.get<JgTest>(`${sec(sectionId)}/tests/${id(testId)}${cq(campusId)}`),
    createTest: (sectionId: string, body: JgTestInput, campusId?: string | null) => api.post<JgTest>(`${sec(sectionId)}/tests${cq(campusId)}`, body),
    updateTest: (sectionId: string, testId: string, body: JgTestInput, campusId?: string | null) => api.put<JgTest>(`${sec(sectionId)}/tests/${id(testId)}${cq(campusId)}`, body),
    deleteTest: (sectionId: string, testId: string, campusId?: string | null) => api.del<JgTestSummary[]>(`${sec(sectionId)}/tests/${id(testId)}${cq(campusId)}`),
    rubrics: (sectionId: string, campusId?: string | null) => api.get<JgRubricSummary[]>(`${sec(sectionId)}/rubrics${cq(campusId)}`),
    rubric: (sectionId: string, rubricId: string, campusId?: string | null) => api.get<JgRubric>(`${sec(sectionId)}/rubrics/${id(rubricId)}${cq(campusId)}`),
    createRubric: (sectionId: string, body: JgRubricInput, campusId?: string | null) => api.post<JgRubric>(`${sec(sectionId)}/rubrics${cq(campusId)}`, body),
    updateRubric: (sectionId: string, rubricId: string, body: JgRubricInput, campusId?: string | null) =>
      api.put<JgRubric>(`${sec(sectionId)}/rubrics/${id(rubricId)}${cq(campusId)}`, body),
    deleteRubric: (sectionId: string, rubricId: string, campusId?: string | null) =>
      api.del<JgRubricSummary[]>(`${sec(sectionId)}/rubrics/${id(rubricId)}${cq(campusId)}`),
    applyRubric: (sectionId: string, rubricId: string, subjectId: string, componentId: string, campusId?: string | null) =>
      api.post<{ applied: number; component: string }>(`${sec(sectionId)}/rubrics/${id(rubricId)}/apply${cq(campusId)}`, { subject_id: subjectId, component_id: componentId }),
    myReportCards: () => api.get<JgMyReportCard[]>('/jahbadh-grades/my/report-cards'),
    audit: (sectionId: string, campusId?: string | null, limit = 200) => api.get<JgAuditEntry[]>(`${sec(sectionId)}/audit${qs({ limit, campus_id: campusId ?? undefined })}`),
  }
}
