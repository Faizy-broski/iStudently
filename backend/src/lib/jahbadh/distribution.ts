// GENERATED from packages/shared-utils/src/jahbadh/distribution.ts by scripts/sync-jahbadh-engine.sh — do not edit.
/**
 * Official grade distribution for basic and secondary education, 2024-2025
 * (Curriculum and Educational Research Center, Libya) — Jahbadh brief, Appendix A.
 *
 * Single source of truth: the seed SQL (scripts/jahbadh-seed-sql.ts), the backend and the web
 * read copies of this file (scripts/sync-jahbadh-engine.sh). Arabic labels are official wording:
 * do not rephrase.
 */

export type JgStage = 1 | 2 | 3

export interface JgComponentDef {
  name: string
  max: number
  /** Counts toward the exam threshold and is replaced by the second-round exam. */
  exam?: boolean
}

export interface JgSubjectDef {
  /** Stable slug, shared across grades (islamic, arabic, …). */
  key: JgSubjectKey
  /** Official subject name as printed on report cards. */
  name: string
  weeklyPeriods: number
  /** Components of stage 1, 2 and 3 (an empty array = the stage does not exist for this grade). */
  stages: [JgComponentDef[], JgComponentDef[], JgComponentDef[]]
}

export interface JgGradeDef {
  /** 1–14 (brief A3). */
  code: number
  name: string
  level: 'basic' | 'secondary'
  track: 'science' | 'humanities' | null
  systemName: string
  noFail: boolean
  /** Minimum share of the subject total to pass a subject (0 when no failing). */
  totalMin: number
  /** Minimum share of the subject's exam marks (0 = no exam condition). */
  examMin: number
  stageNames: [string, string, string | null]
  ruleText: string
  certificateName: string | null
  /** Used in «ينقل إلى الصف …»; null for certificate years. */
  nextGradeName: string | null
  subjects: JgSubjectDef[]
}

/** The 18 subjects of the prototype, in its display order, with their short Arabic names. */
export const JG_SUBJECT_KEYS = [
  'islamic', 'arabic', 'writing', 'english', 'math', 'science', 'social', 'history', 'geography',
  'computer', 'it', 'physics', 'chemistry', 'biology', 'statistics', 'philosophy', 'sociology', 'psychology',
] as const
export type JgSubjectKey = (typeof JG_SUBJECT_KEYS)[number]

export const JG_SUBJECT_SHORT_NAMES: Record<JgSubjectKey, string> = {
  islamic: 'التربية الإسلامية',
  arabic: 'اللغة العربية',
  writing: 'الكتابة',
  english: 'اللغة الإنجليزية',
  math: 'الرياضيات',
  science: 'العلوم',
  social: 'الاجتماعيات',
  history: 'التاريخ',
  geography: 'الجغرافيا',
  computer: 'الحاسوب',
  it: 'تقنية المعلومات',
  physics: 'الفيزياء',
  chemistry: 'الكيمياء',
  biology: 'الأحياء',
  statistics: 'الإحصاء',
  philosophy: 'الفلسفة',
  sociology: 'علم الاجتماع',
  psychology: 'علم النفس',
}

/** Non-graded activity subjects on report cards (brief B6-9). */
export const JG_ACTIVITY_SUBJECTS = ['التربية الفنية', 'التربية الموسيقية', 'التربية البدنية'] as const

// ---- component helpers -------------------------------------------------------------------------

const c = (name: string, max: number, exam = false): JgComponentDef => (exam ? { name, max, exam } : { name, max })
const subject = (
  key: JgSubjectKey,
  name: string,
  weeklyPeriods: number,
  s1: JgComponentDef[],
  s2: JgComponentDef[],
  s3: JgComponentDef[] = [],
): JgSubjectDef => ({ key, name, weeklyPeriods, stages: [s1, s2, s3] })
/** Same components in stage 1 and 2 (semester and period systems). */
const twice = (key: JgSubjectKey, name: string, p: number, comps: JgComponentDef[], s3: JgComponentDef[] = []) =>
  subject(key, name, p, comps, comps.map((x) => ({ ...x })), s3)

const N = JG_SUBJECT_SHORT_NAMES

// Component names (exact memo wording).
const DAILY = 'الأنشطة اليومية'
const MONTHLY = 'التطبيقات الشهرية'
const AVG_APPS = 'متوسط التطبيقات'
const AVG_APPS_DEGREE = 'متوسط درجة التطبيقات'
const MIDTERM_BASIC = 'الامتحان النصفي'
const MIDTERM_SEC = 'اختبار منتصف الفصل'
const END_SEM = 'امتحان نهاية الفصل'
const END_SEM_THEORY = 'امتحان نهاية الفصل (نظري)'
const PRACTICAL = 'التجارب العملية'
const PERIOD_EXAM = 'امتحان الفترة'
const PERIOD_END_EXAM = 'امتحان نهاية الفترة'
const YEAR_END = 'امتحان نهاية العام'
const YEAR_END_THEORY = 'امتحان نهاية العام (نظري)'
const WRITTEN = 'درجة الاختبارات التحريرية'
const AVG_WRITTEN = 'متوسط درجة الاختبارات التحريرية'

// ---- grades 1–3: three periods, no exam, automatic promotion --------------------------------------

const NO_FAIL_RULE = 'يُنقل التلميذ إلى الصف التالي حسب مستواه ولا يبقى للإعادة إلا في حالة الانقطاع عن الدراسة.'
const THREE_PERIODS: JgGradeDef['stageNames'] = ['الفترة الأولى', 'الفترة الثانية', 'الفترة الثالثة']

function earlyGradeSubjects(withScience: boolean): JgSubjectDef[] {
  const daily = (a: number, b: number) => [c(DAILY, a), c(MONTHLY, b)]
  const list = [
    subject('islamic', N.islamic, 3, daily(18, 18), daily(18, 18), daily(24, 24)),
    subject('arabic', N.arabic, 6, daily(36, 36), daily(36, 36), daily(48, 48)),
    subject('english', N.english, 3,
      [c('كتاب النشاط', 20), c('المشاركة اليومية', 16)],
      [c('كتاب النشاط', 20), c('المشاركة اليومية', 16)],
      [c('كتاب النشاط', 30), c('المشاركة اليومية', 18)]),
    subject('math', N.math, 5,
      [c('كراسة التلميذ', 15), c('التدريبات', 30), c('المشاركة اليومية', 15)],
      [c('كراسة التلميذ', 15), c('التدريبات', 30), c('المشاركة اليومية', 15)],
      [c('كراسة التلميذ', 20), c('التدريبات', 40), c('المشاركة اليومية', 20)]),
  ]
  if (withScience) {
    const sci = (w: number) => [c('كراسة التلميذ', 8), c('الاختبارات التحريرية', w), c('المشاركة اليومية', 8), c('كراسة الأنشطة', 8)]
    list.push(subject('science', N.science, 3, sci(12), sci(12), sci(24)))
  }
  list.push(subject('computer', N.computer, 1, [c('درجة الفترة', 12)], [c('درجة الفترة', 12)], [c('درجة الفترة', 16)]))
  return list
}

const earlyGrade = (code: number, name: string, next: string, withScience: boolean): JgGradeDef => ({
  code, name, level: 'basic', track: null,
  systemName: 'ثلاث فترات', noFail: true, totalMin: 0, examMin: 0,
  stageNames: THREE_PERIODS, ruleText: NO_FAIL_RULE, certificateName: null, nextGradeName: next,
  subjects: earlyGradeSubjects(withScience),
})

// ---- grades 4–5: two periods (30% + 30%) + final exam (40%) ---------------------------------------

function periodsPlusFinal(code: number, name: string, next: string): JgGradeDef {
  const s = (key: JgSubjectKey, full: string, p: number, a: number, e: number) =>
    twice(key, full, p, [c('الأنشطة الصفية والمشاركة', a), c('متوسط التطبيقات الشهرية', a)], [c('الامتحان النهائي', e, true)])
  return {
    code, name, level: 'basic', track: null,
    systemName: 'فترتان 30% + امتحان نهائي 40%', noFail: false, totalMin: 0.4, examMin: 0,
    stageNames: ['الفترة الأولى (30%)', 'الفترة الثانية (30%)', 'الفترة الثالثة — الامتحان (40%)'],
    ruleText: 'يُشترط للنجاح الحصول على 40% من الدرجة الكبرى للمادة، وامتحان الدور الثاني يحل محل امتحان الفترة الثالثة.',
    certificateName: null, nextGradeName: next,
    subjects: [
      s('islamic', N.islamic, 3, 18, 48),
      s('arabic', 'اللغة العربية (النحو والقراءة والنصوص)', 4, 24, 64),
      s('writing', 'الكتابة (التعبير والإملاء والخط)', 2, 12, 32),
      s('english', N.english, 3, 18, 48),
      s('math', N.math, 5, 30, 80),
      s('science', N.science, 3, 18, 48),
      s('social', 'الاجتماعيات (التاريخ والجغرافيا)', 2, 12, 32),
      s('computer', N.computer, 1, 6, 16),
    ],
  }
}

// ---- grades 6–8: two semesters --------------------------------------------------------------------

const BASIC_SEM_RULE =
  'يُشترط للنجاح: 40% من مجموع درجات امتحاني نهاية الفصلين، و50% من الدرجة المقررة للمادة. امتحان الدور الثاني يحل محل امتحاني نهاية الفصلين.'
const TWO_SEMESTERS: JgGradeDef['stageNames'] = ['الفصل الأول', 'الفصل الثاني', null]

/** Basic semester subject: daily a, applications a, midterm 2a, end of semester 6a (exam). */
const basicSem = (key: JgSubjectKey, name: string, p: number, a: number) =>
  twice(key, name, p, [c(DAILY, a), c(AVG_APPS, a), c(MIDTERM_BASIC, 2 * a), c(END_SEM, 6 * a, true)])

function basicSemesterGrade(code: number, name: string, next: string, subjects: JgSubjectDef[]): JgGradeDef {
  return {
    code, name, level: 'basic', track: null,
    systemName: 'نظام الفصلين الدراسيين', noFail: false, totalMin: 0.5, examMin: 0.4,
    stageNames: TWO_SEMESTERS, ruleText: BASIC_SEM_RULE, certificateName: null, nextGradeName: next, subjects,
  }
}

const grade6Subjects = [
  basicSem('islamic', N.islamic, 3, 6),
  basicSem('arabic', 'اللغة العربية (النحو والقراءة والنصوص)', 4, 8),
  basicSem('writing', 'الكتابة (التعبير والإملاء والخط)', 2, 4),
  basicSem('english', N.english, 4, 8),
  basicSem('math', N.math, 5, 10),
  basicSem('science', N.science, 3, 6),
  basicSem('social', 'الاجتماعيات (التاريخ والجغرافيا)', 2, 4),
  basicSem('computer', N.computer, 2, 4),
]

const grade78Subjects = () => [
  basicSem('islamic', N.islamic, 2, 4),
  basicSem('arabic', 'اللغة العربية (النحو والقراءة والنصوص)', 4, 8),
  basicSem('writing', 'الكتابة (التعبير والإملاء والخط)', 2, 4),
  basicSem('english', N.english, 4, 8),
  basicSem('math', N.math, 5, 10),
  basicSem('science', N.science, 4, 8),
  basicSem('history', N.history, 2, 4),
  basicSem('geography', N.geography, 2, 4),
  basicSem('computer', N.computer, 2, 4),
]

// ---- grade 9: basic education certificate (two periods + end-of-year exam) -------------------------

const g9 = (key: JgSubjectKey, name: string, p: number, d: number, a: number, pe: number, e: number) =>
  twice(key, name, p, [c(DAILY, d), c(AVG_APPS, a), c(PERIOD_EXAM, pe)], [c(YEAR_END, e, true)])

const BASIC_CERT = 'شهادة إتمام مرحلة التعليم الأساسي'
const SECONDARY_CERT = 'شهادة إتمام مرحلة التعليم الثانوي'
const PERIODS_AND_YEAR_END: JgGradeDef['stageNames'] = ['الفترة الأولى', 'الفترة الثانية', 'امتحان نهاية العام']

const grade9: JgGradeDef = {
  code: 9, name: 'التاسع', level: 'basic', track: null,
  systemName: BASIC_CERT, noFail: false, totalMin: 0.5, examMin: 0.4,
  stageNames: PERIODS_AND_YEAR_END,
  ruleText: 'يُشترط للنجاح: 40% من امتحان نهاية العام، و50% من الدرجة المقررة للمادة. امتحان الدور الثاني يحل محل امتحان نهاية العام.',
  certificateName: BASIC_CERT, nextGradeName: null,
  subjects: [
    g9('islamic', N.islamic, 2, 3, 3, 6, 56),
    g9('arabic', 'اللغة العربية (النحو والصرف والقراءة والنصوص)', 4, 6, 6, 12, 112),
    g9('writing', 'الكتابة (التعبير والإملاء والخط)', 2, 3, 3, 6, 56),
    g9('english', N.english, 4, 6, 6, 12, 112),
    g9('math', N.math, 5, 8, 7, 15, 140),
    g9('science', N.science, 5, 8, 7, 15, 140),
    g9('history', N.history, 2, 3, 3, 6, 56),
    g9('geography', N.geography, 2, 3, 3, 6, 56),
    g9('computer', N.computer, 2, 3, 3, 6, 56),
  ],
}

// ---- secondary grades 10–11: two semesters --------------------------------------------------------

const SEC_SEM_RULE =
  'تُحسب الدرجة النهائية من مجموع الفصلين. يُشترط للنجاح: 40% من مجموع درجات امتحاني نهاية الفصلين، و50% من الدرجة المقررة للمادة. امتحان الدور الثاني يحل محل امتحاني نهاية الفصلين (نظري فقط في المواد العملية) ويحتفظ الطالب بدرجات أعمال الفصلين.'

/** Daily a, applications a, midterm 2a, end of semester 6a (exam). `appsFirst` follows the memo's column order. */
const secSem = (key: JgSubjectKey, p: number, a: number, appsFirst = false) => {
  const pair = appsFirst ? [c(AVG_APPS_DEGREE, a), c(DAILY, a)] : [c(DAILY, a), c(AVG_APPS_DEGREE, a)]
  return twice(key, N[key], p, [...pair, c(MIDTERM_SEC, 2 * a), c(END_SEM, 6 * a, true)])
}
/** Practical subject: practical, then the two coursework components in memo order, midterm, theory exam. */
const lab = (key: JgSubjectKey, p: number, pr: number, works: [string, number][], mid: number, exam: number) =>
  twice(key, N[key], p, [c(PRACTICAL, pr), ...works.map(([n, m]) => c(n, m)), c(MIDTERM_SEC, mid), c(END_SEM_THEORY, exam, true)])

function secondarySemesterGrade(
  code: number, name: string, track: JgGradeDef['track'], next: string, subjects: JgSubjectDef[],
): JgGradeDef {
  return {
    code, name, level: 'secondary', track,
    systemName: 'نظام الفصلين الدراسيين (الثانوي)', noFail: false, totalMin: 0.5, examMin: 0.4,
    stageNames: TWO_SEMESTERS, ruleText: SEC_SEM_RULE, certificateName: null, nextGradeName: next, subjects,
  }
}

const itSem = () => lab('it', 2, 2, [[DAILY, 3], [MONTHLY, 3]], 8, 24)

const grade10 = secondarySemesterGrade(10, 'الأول الثانوي', null, 'الثاني الثانوي (علمي أو أدبي)', [
  secSem('islamic', 2, 4),
  secSem('arabic', 4, 8),
  secSem('english', 4, 8, true),
  itSem(),
  secSem('math', 5, 10),
  lab('chemistry', 3, 4, [[MONTHLY, 4], [DAILY, 4]], 12, 36),
  lab('physics', 3, 4, [[MONTHLY, 4], [DAILY, 4]], 12, 36),
  lab('biology', 3, 4, [[MONTHLY, 4], [DAILY, 4]], 12, 36),
  secSem('history', 2, 4, true),
  secSem('geography', 2, 4, true),
  secSem('sociology', 1, 2, true),
])

const physics11 = twice('physics', N.physics, 5, [
  c('التجارب العملية ج1', 4),
  c('الأنشطة اليومية ج1+ج2', 8),
  c('التطبيقات الشهرية ج1+ج2', 8),
  c('اختبار منتصف الفصل ج1+ج2', 20),
  c('امتحان نهاية الفصل ج1 (نظري)', 36, true),
  c('امتحان نهاية الفصل ج2', 24, true),
])

const grade11Science = secondarySemesterGrade(11, 'الثاني الثانوي — علمي', 'science', 'الثالث الثانوي — علمي', [
  secSem('islamic', 2, 4),
  secSem('arabic', 4, 8),
  secSem('english', 4, 8, true),
  itSem(),
  secSem('math', 4, 8, true),
  secSem('statistics', 2, 4),
  physics11,
  lab('chemistry', 4, 4, [[DAILY, 6], [MONTHLY, 6]], 16, 48),
  lab('biology', 3, 4, [[DAILY, 4], [MONTHLY, 4]], 12, 36),
])

const grade11Humanities = secondarySemesterGrade(12, 'الثاني الثانوي — أدبي', 'humanities', 'الثالث الثانوي — أدبي', [
  secSem('islamic', 2, 4),
  secSem('arabic', 7, 14),
  secSem('english', 5, 10, true),
  itSem(),
  secSem('statistics', 2, 4),
  secSem('history', 3, 6),
  secSem('geography', 3, 6),
  secSem('philosophy', 2, 4, true),
  secSem('sociology', 2, 4, true),
  secSem('psychology', 2, 4, true),
])

// ---- secondary grade 12 (codes 13–14): secondary certificate ---------------------------------------

const SEC_CERT_RULE =
  'تُحسب الدرجة النهائية من مجموع الفترتين وامتحان نهاية العام. يُشترط للنجاح: 50% من الدرجة المقررة لامتحان نهاية العام، و50% من الدرجة المقررة للمادة. امتحان الدور الثاني يحل محل امتحان نهاية العام ويحتفظ الطالب بدرجات أعمال السنة.'

/** Period coursework (in memo order) + one end-of-year exam. */
const cert = (key: JgSubjectKey, p: number, period: [string, number][], yearEnd: number, yearEndName = YEAR_END) =>
  twice(key, N[key], p, period.map(([n, m]) => c(n, m)), [c(yearEndName, yearEnd, true)])

function secondaryCertificateGrade(code: number, name: string, track: JgGradeDef['track'], subjects: JgSubjectDef[]): JgGradeDef {
  return {
    code, name, level: 'secondary', track,
    systemName: SECONDARY_CERT, noFail: false, totalMin: 0.5, examMin: 0.5,
    stageNames: PERIODS_AND_YEAR_END, ruleText: SEC_CERT_RULE, certificateName: SECONDARY_CERT, nextGradeName: null, subjects,
  }
}

const itCert = () => cert('it', 2, [[MONTHLY, 3], [DAILY, 3], [PERIOD_END_EXAM, 6]], 56, YEAR_END_THEORY)
const avgWritten = (key: JgSubjectKey, p: number, a: number, pe: number, e: number) =>
  cert(key, p, [[AVG_WRITTEN, a], [DAILY, a], [PERIOD_END_EXAM, pe]], e)

const grade12Science = secondaryCertificateGrade(13, 'الثالث الثانوي — علمي', 'science', [
  cert('islamic', 2, [[DAILY, 3], [WRITTEN, 3], [PERIOD_EXAM, 6]], 56),
  cert('arabic', 4, [[DAILY, 6], [WRITTEN, 6], [PERIOD_EXAM, 12]], 112),
  cert('english', 4, [[WRITTEN, 6], [DAILY, 6], [PERIOD_END_EXAM, 12]], 112),
  itCert(),
  avgWritten('math', 5, 7.5, 15, 140),
  avgWritten('statistics', 2, 3, 6, 56),
  twice('physics', N.physics, 5,
    [c('التطبيقات والاختبارات التحريرية ج1+ج2', 7.5), c('الأنشطة اليومية ج1+ج2', 7.5), c('امتحان نهاية الفترة ج1', 9), c('امتحان نهاية الفترة ج2', 6)],
    [c('امتحان نهاية العام ج1', 84, true), c('امتحان نهاية العام ج2', 56, true)]),
  cert('chemistry', 4, [[MONTHLY, 6], [DAILY, 6], [PERIOD_END_EXAM, 12]], 112),
  cert('biology', 4, [[MONTHLY, 6], [DAILY, 6], [PERIOD_END_EXAM, 12]], 112),
])

const grade12Humanities = secondaryCertificateGrade(14, 'الثالث الثانوي — أدبي', 'humanities', [
  cert('islamic', 2, [[DAILY, 3], [WRITTEN, 3], [PERIOD_EXAM, 6]], 56),
  cert('arabic', 7, [[DAILY, 10], [WRITTEN, 11], [PERIOD_EXAM, 21]], 196),
  avgWritten('english', 5, 7.5, 15, 140),
  itCert(),
  avgWritten('statistics', 2, 3, 6, 56),
  cert('history', 3, [[WRITTEN, 5], [DAILY, 4], [PERIOD_END_EXAM, 9]], 84),
  cert('geography', 3, [[WRITTEN, 5], [DAILY, 4], [PERIOD_END_EXAM, 9]], 84),
  cert('philosophy', 3, [[WRITTEN, 4.5], [DAILY, 4.5], [PERIOD_END_EXAM, 9]], 84),
  avgWritten('sociology', 2, 3, 6, 56),
  avgWritten('psychology', 2, 3, 6, 56),
])

// ---- the 14 grades ---------------------------------------------------------------------------------

export const JG_DISTRIBUTION_VERSION = '2024-2025'

export const JG_DISTRIBUTION: JgGradeDef[] = [
  earlyGrade(1, 'الأول', 'الثاني', false),
  earlyGrade(2, 'الثاني', 'الثالث', false),
  earlyGrade(3, 'الثالث', 'الرابع', true),
  periodsPlusFinal(4, 'الرابع', 'الخامس'),
  periodsPlusFinal(5, 'الخامس', 'السادس'),
  basicSemesterGrade(6, 'السادس', 'السابع', grade6Subjects),
  basicSemesterGrade(7, 'السابع', 'الثامن', grade78Subjects()),
  basicSemesterGrade(8, 'الثامن', 'التاسع', grade78Subjects()),
  grade9,
  grade10,
  grade11Science,
  grade11Humanities,
  grade12Science,
  grade12Humanities,
]

export function jgGrade(code: number): JgGradeDef | undefined {
  return JG_DISTRIBUTION.find((g) => g.code === code)
}
