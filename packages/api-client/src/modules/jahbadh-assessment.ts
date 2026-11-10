// Jahbadh assessment tools (Wave 6; brief B6 #53–61). Exam control: answer keys per paper/part and
// version, auto-grading + copy into blind score entry, item analysis + KR-20, answer similarity,
// objectives mastery, marking fairness between sections, test archive, error slips, bubble sheets
// (backend: jahbadh-control.routes.ts). Grades: teacher quiz auto-grading into a grade column
// (jahbadh-grades.routes.ts). Answer rows are keyed by secret number; names appear only after unmasking.
import type { ApiClient } from '../client'
import { qs } from '../query'

export type JaHandling = 'normal' | 'all' | 'excluded'
export type JaVersion = 'A' | 'B'
/** Canonical answer cell: 'أ' … 'ه', '' blank, '?' unreadable. */
export type JaAnswer = 'أ' | 'ب' | 'ج' | 'د' | 'ه' | '' | '?'
export type JaQuestionMark = 'correct' | 'wrong' | 'blank' | 'excluded' | 'credited'

export interface JcAnswerKey {
  id: string
  session_id: string
  grade_level_id: string
  subject_key: string
  /** Exam part (بند) label; '' = the whole paper. */
  part_key: string
  question_count: number
  options: 4 | 5
  /** Accepted options per question, e.g. "أ" or "أب". */
  key_a: string[]
  /** Version B key; '' = same as A for that question. */
  key_b: string[]
  points: number[]
  handling: JaHandling[]
  max_score: number
  objective_names: string[]
  /** Objective index per version-A question (null = untagged). */
  objectives: (number | null)[]
  /** Version-B question → equivalent version-A question (1-based; null = same number). */
  b_to_a: (number | null)[]
  similarity_min: number
  similarity_ratio: number
  updated_at: string
}

export interface JcAnswerKeyInput {
  grade_level_id: string
  subject_key: string
  part_key?: string
  question_count: number
  options?: 4 | 5
  key_a?: string[]
  key_b?: string[]
  points?: number[]
  handling?: JaHandling[]
  max_score?: number
  objective_names?: string[]
  objectives?: (number | null)[]
  b_to_a?: (number | null)[]
  similarity_min?: number
  similarity_ratio?: number
}

export interface JaGradedResult {
  score: number | null
  raw: number
  possible: number
  correct: number
  wrong: number
  blank: number
  wrong_questions: number[]
  marks: JaQuestionMark[]
}

export interface JaQuestionSummary {
  question: number
  pctCorrect: number | null
  answered: number
  commonWrong: string | null
  commonWrongCount: number
}

export interface JcAnswerSheetRow {
  secret: number
  committee: string | null
  /** Only after unmasking. */
  name?: string
  seat_number?: number | null
  version: JaVersion
  seat_version: 'A' | 'B' | null
  answers: JaAnswer[] | null
  source: 'typed' | 'omr' | null
  result: JaGradedResult | null
  transferred: { score: number | null; entry: number | null; at: string } | null
  needs_transfer: boolean
}

export interface JcAnswerSheets {
  key: JcAnswerKey
  unmasked: boolean
  rows: JcAnswerSheetRow[]
  questions: JaQuestionSummary[]
  counts: { students: number; entered: number; not_transferred: number }
}

export interface JaItemStat {
  question: number
  shares: Record<string, number>
  key: string[]
  p: number
  d: number
  verdict: 'check_key' | 'too_hard' | 'too_easy' | 'weak' | 'good' | 'excluded'
  notes: ('misconception' | 'ambiguous' | 'unused')[]
  noteOptions: Record<string, string[]>
}

export interface JcItemAnalysis {
  version: 'A' | 'B' | 'all'
  items: JaItemStat[]
  kr20: number | null
  n: number
  groupSize: number
}

export interface JaSimilarityResult {
  identicalWrong: number
  wrongA: number
  wrongB: number
  ratio: number
  flagged: boolean
  questions: number[]
}

export interface JcSimilarity {
  thresholds?: { min: number; ratio: number }
  compared?: number
  flagged?: (JaSimilarityResult & { committee: string; relation: 'beside' | 'two_along' | 'behind'; a: number; b: number; a_name?: string; b_name?: string })[]
  manual?: JaSimilarityResult & { a: number; b: number }
}

export type JaMasteryLevel = 'mastered' | 'close' | 'support'

export interface JcMastery {
  objectives: string[]
  students: { secret: number; name?: string; seat_number?: number | null; version: JaVersion; pct: (number | null)[]; levels: (JaMasteryLevel | null)[]; weakest: number | null }[]
  classSummary: { objective: number; name: string; pct: number | null; level: JaMasteryLevel | null; questions: number[] }[]
}

export interface JcFairness {
  threshold: number
  subjects: { key: string; name: string }[]
  sections: string[]
  grade_mean: Record<string, number | null>
  cells: { section: string; subject: string; mean: number | null; gap: number | null; count: number; flagged: boolean }[]
  flagged: { section: string; subject: string; mean: number | null; gap: number | null; count: number; flagged: boolean }[]
}

export interface JcArchivedTest {
  id: string
  name: string
  grade_code: number | null
  subject_key: string | null
  part_key: string
  test_date: string | null
  question_count: number
  options: number
  max_score: number | null
  created_at: string
}

// ---- grades: teacher quiz auto-grading (#61) -------------------------------------------------------

export interface JgQuizTarget {
  subject_id: string
  subject_name: string
  kind: 'component' | 'subitem'
  id: string
  stage: number
  label: string
  max: number
}

export interface JgQuizKey {
  id: string
  section_id: string
  academic_year_id: string
  jg_subject_id: string
  component_id: string | null
  subitem_id: string | null
  title: string
  question_count: number
  options: 4 | 5
  key_a: string[]
  points: number[]
  handling: JaHandling[]
  platform_quiz_id: string | null
  updated_at: string
  target?: JgQuizTarget
}

export interface JgQuizKeyInput {
  id?: string
  jg_subject_id: string
  target_kind: 'component' | 'subitem'
  target_id: string
  title?: string
  question_count: number
  options?: 4 | 5
  key_a?: string[]
  points?: number[]
  handling?: JaHandling[]
  platform_quiz_id?: string | null
}

export interface JgQuizGrading {
  key: JgQuizKey
  target: JgQuizTarget
  rows: {
    student_id: string
    name: string
    answers: JaAnswer[] | null
    result: { correct: number; wrong: number; blank: number; wrong_questions: number[]; raw: number; possible: number } | null
    platform: { earned: number; possible: number } | null
    score: number | null
    /** Current mark in the target column ('غ' = absent). */
    current: number | 'غ' | null
  }[]
  questions: JaQuestionSummary[]
  counts: { students: number; graded: number }
}

export interface JgQuizCommitPreview {
  target: JgQuizTarget
  changes: { student_id: string; name: string; from: number | 'غ' | null; to: number | null }[]
  unchanged: number
}

/** Authenticated PDF paths (open with the platform's PDF helper). */
export const jaPdfPath = {
  errorSlips: (sessionId: string, keyId: string) => `/jahbadh-control/sessions/${encodeURIComponent(sessionId)}/answer-keys/${encodeURIComponent(keyId)}/error-slips.pdf`,
  /** One A4 page per seated student; batches of 40 (`offset`); response header X-Total-Count. */
  bubbleSheets: (sessionId: string, keyId: string, opts: { committeeId?: string | null; offset?: number } = {}) =>
    `/jahbadh-control/sessions/${encodeURIComponent(sessionId)}/answer-keys/${encodeURIComponent(keyId)}/bubble-sheets.pdf${qs({ committee_id: opts.committeeId ?? undefined, offset: opts.offset || undefined })}`,
}

export function jahbadhAssessmentApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const s = (sessionId: string) => `/jahbadh-control/sessions/${id(sessionId)}`
  const k = (sessionId: string, keyId: string) => `/jahbadh-control/sessions/${id(sessionId)}/answer-keys/${id(keyId)}`
  const q = (sectionId: string) => `/jahbadh-grades/sections/${id(sectionId)}/quiz-grading`
  return {
    // exam control
    keys: (sessionId: string) => api.get<JcAnswerKey[]>(`${s(sessionId)}/answer-keys`),
    saveKey: (sessionId: string, body: JcAnswerKeyInput) => api.post<JcAnswerKey>(`${s(sessionId)}/answer-keys`, body),
    key: (sessionId: string, keyId: string) => api.get<JcAnswerKey>(k(sessionId, keyId)),
    deleteKey: (sessionId: string, keyId: string) => api.del<{ deleted: boolean }>(k(sessionId, keyId)),
    sheets: (sessionId: string, keyId: string) => api.get<JcAnswerSheets>(`${k(sessionId, keyId)}/sheets`),
    /** `answers`: one string («أبجد-بج», dash = blank) or one cell per question; null clears the row. */
    saveSheets: (sessionId: string, keyId: string, entries: { secret: number; answers: string | (string | null)[] | null; version?: JaVersion | null }[]) =>
      api.put<JcAnswerSheets>(`${k(sessionId, keyId)}/sheets`, { entries }),
    transferPreview: (sessionId: string, keyId: string, entry: 1 | 2 = 1) =>
      api.get<{ entry: 1 | 2; cells: { secret: number; subject_key: string; score: number | null }[]; count: number }>(`${k(sessionId, keyId)}/transfer${qs({ entry })}`),
    transfer: (sessionId: string, keyId: string, entry: 1 | 2 = 1) => api.post<{ entry: 1 | 2; transferred: number; saved: number; cleared: number }>(`${k(sessionId, keyId)}/transfer`, { entry }),
    analysis: (sessionId: string, keyId: string, version: 'A' | 'B' | 'all' = 'all') => api.get<JcItemAnalysis>(`${k(sessionId, keyId)}/analysis${qs({ version })}`),
    /** Neighbour scan of the seating map, or a manual comparison of two secret numbers. */
    similarity: (sessionId: string, keyId: string, pair?: { a: number; b: number } | null) =>
      api.get<JcSimilarity>(`${k(sessionId, keyId)}/similarity${qs({ a: pair?.a, b: pair?.b })}`),
    mastery: (sessionId: string, keyId: string) => api.get<JcMastery>(`${k(sessionId, keyId)}/mastery`),
    archiveKey: (sessionId: string, keyId: string, body: { name?: string; test_date?: string | null } = {}) => api.post<{ id: string }>(`${k(sessionId, keyId)}/archive`, body),
    fairness: (sessionId: string, gradeLevelId: string, threshold?: number) => api.get<JcFairness>(`${s(sessionId)}/fairness${qs({ grade_level_id: gradeLevelId, threshold })}`),
    archive: (sessionId: string) => api.get<JcArchivedTest[]>(`${s(sessionId)}/test-archive`),
    archivedTest: (sessionId: string, archiveId: string) => api.get<JcArchivedTest & Record<string, unknown>>(`${s(sessionId)}/test-archive/${id(archiveId)}`),
    recallArchive: (sessionId: string, archiveId: string, target: { grade_level_id: string; subject_key: string; part_key?: string }) =>
      api.post<JcAnswerKey>(`${s(sessionId)}/test-archive/${id(archiveId)}/recall`, target),
    deleteArchive: (sessionId: string, archiveId: string) => api.del<{ deleted: boolean }>(`${s(sessionId)}/test-archive/${id(archiveId)}`),

    // grades: teacher quiz auto-grading
    quizTargets: (sectionId: string) => api.get<JgQuizTarget[]>(`${q(sectionId)}/targets`),
    quizKeys: (sectionId: string) => api.get<JgQuizKey[]>(q(sectionId)),
    saveQuizKey: (sectionId: string, body: JgQuizKeyInput) => api.post<JgQuizGrading>(q(sectionId), body),
    quizKey: (sectionId: string, quizKeyId: string) => api.get<JgQuizGrading>(`${q(sectionId)}/${id(quizKeyId)}`),
    deleteQuizKey: (sectionId: string, quizKeyId: string) => api.del<{ deleted: boolean }>(`${q(sectionId)}/${id(quizKeyId)}`),
    saveQuizAnswers: (sectionId: string, quizKeyId: string, entries: { student_id: string; answers: string | (string | null)[] | null }[]) =>
      api.put<JgQuizGrading>(`${q(sectionId)}/${id(quizKeyId)}/answers`, { entries }),
    quizCommitPreview: (sectionId: string, quizKeyId: string) => api.get<JgQuizCommitPreview>(`${q(sectionId)}/${id(quizKeyId)}/commit`),
    quizCommit: (sectionId: string, quizKeyId: string) => api.post<{ written: number; target: JgQuizTarget }>(`${q(sectionId)}/${id(quizKeyId)}/commit`, {}),
  }
}
