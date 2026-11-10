import { supabase } from '../../config/supabase'
import { pushNotificationsService } from '../push-notifications.service'
import {
  competitionRanks,
  computeSubject,
  decisionWithDetail,
  estimateFor,
  genderForm,
  JG_ACTIVITY_SUBJECTS,
  learnerWord,
  stats,
  subjectCountWord,
  type JgCell,
  type JgStudentResult,
  type JgSubjectResult,
} from '../../lib/jahbadh'
import { logJgAudit } from './audit.service'
import {
  computeSection,
  engineComponents,
  JgError,
  ruleInput,
  sectionStudents,
  type JgActor,
  type JgLoadedSubject,
  type JgSectionContext,
} from './grades.service'
import { JG_REPORT_CARD_DEFAULTS, printHeader, type JgReportCardData, type JgReportCardOptions, type JgStageMode } from './print.service'
import { cardReference, fmtPct2, qrSvgOf, schoolExtras, signCode, yearLine } from './print-layout'

/** Activity levels allowed for art / music / PE (brief B6-9). */
export const JG_ACTIVITY_LEVELS = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول'] as const

export const JG_DEFAULT_GUARDIAN_TIPS = [
  'تنظيم وقت الأبناء خارج المدرسة ومتابعة واجباتهم اليومية.',
  'التواصل مع المدرسة والاستفسار عن المستوى والسلوك.',
  'إفادة المدرسة بأسباب الغياب أولاً بأول.',
  'تشجيع الأبناء على المشاركة في النشاط المدرسي.',
]

/** Rotated per student (list number), as in the prototype. */
export const JG_DEFAULT_QUOTES = [
  'النجاح رحلة تبدأ بخطوة، وكل يوم تتعلم فيه خطوة جديدة.',
  'اجعل شغفك بالمعرفة أكبر من خوفك من الصعوبة.',
  'العلم نورٌ، والاجتهاد طريقه، والمثابرة مفتاحه.',
  'تفوّقك اليوم يصنع غدك المشرق.',
  'كن على يقين أن النجاح الحقيقي هو نجاح الخلق والدين.',
  'من جدّ وجد، ومن زرع حصد.',
]

export type JgScope = 'stage1' | 'stage2' | 'stage3' | 'final'
export const JG_SCOPES: JgScope[] = ['stage1', 'stage2', 'stage3', 'final']

export const gradeStages = (ctx: JgSectionContext) =>
  [...new Set(ctx.grade.subjects.flatMap((s) => s.meta.stages))].sort((a, b) => a - b)

/** Validates a scope against the grade (stage3 only where the grade has one). */
export function parseScope(ctx: JgSectionContext, raw: unknown): JgScope {
  const scope = (typeof raw === 'string' ? raw : 'final') as JgScope
  if (!JG_SCOPES.includes(scope)) throw new JgError(400, 'Unknown scope')
  if (scope !== 'final' && !gradeStages(ctx).includes(Number(scope.slice(5)))) throw new JgError(400, 'This stage does not exist in this grade')
  return scope
}

// ---- activities, absence, notes, school days --------------------------------------------------

export interface JgActivityRow {
  student_id: string
  art: string | null
  music: string | null
  pe: string | null
  excused_days: number | null
  unexcused_days: number | null
  teacher_note: string | null
}

export async function loadActivities(ctx: JgSectionContext): Promise<(JgActivityRow & { stage: number })[]> {
  const { data, error } = await supabase
    .from('jg_activity_records')
    .select('student_id, stage, art, music, pe, excused_days, unexcused_days, teacher_note')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  if (error) throw error
  return data ?? []
}

export async function loadSchoolDays(ctx: JgSectionContext): Promise<Record<number, number>> {
  const { data, error } = await supabase
    .from('jg_school_days')
    .select('stage, days')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r: any) => [r.stage, r.days]))
}

export async function getActivities(ctx: JgSectionContext, stage: number) {
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'This stage does not exist in this grade')
  const [students, records, days] = await Promise.all([sectionStudents(ctx.section.id), loadActivities(ctx), loadSchoolDays(ctx)])
  return {
    stage,
    stage_names: ctx.grade.rule.stage_names,
    stages: gradeStages(ctx),
    levels: JG_ACTIVITY_LEVELS,
    activity_subjects: JG_ACTIVITY_SUBJECTS,
    school_days: days[stage] ?? null,
    rows: students.map((student) => {
      const r = records.find((x) => x.student_id === student.id && x.stage === stage)
      return {
        student,
        art: r?.art ?? null,
        music: r?.music ?? null,
        pe: r?.pe ?? null,
        excused_days: r?.excused_days ?? null,
        unexcused_days: r?.unexcused_days ?? null,
        teacher_note: r?.teacher_note ?? null,
      }
    }),
  }
}

export async function saveActivities(
  ctx: JgSectionContext,
  stage: number,
  body: { school_days?: number | null; entries?: JgActivityRow[] },
  actor: JgActor,
) {
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'This stage does not exist in this grade')
  const days = body.school_days
  if (days !== undefined && days !== null && !(Number.isInteger(Number(days)) && Number(days) >= 0 && Number(days) <= 366)) {
    throw new JgError(400, 'School days must be a whole number')
  }
  const enrolled = new Set((await sectionStudents(ctx.section.id)).map((s) => s.id))
  const level = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null
    if (!(JG_ACTIVITY_LEVELS as readonly string[]).includes(String(v))) throw new JgError(400, `Activity level must be one of: ${JG_ACTIVITY_LEVELS.join('، ')}`)
    return String(v)
  }
  const daysOf = (v: unknown, label: string) => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0) throw new JgError(400, `${label} must be a whole number`)
    if (days != null && n > Number(days)) throw new JgError(400, `${label} cannot exceed the school days (${days})`)
    return n
  }
  const now = new Date().toISOString()
  const rows = (body.entries ?? []).map((e) => {
    if (!enrolled.has(e.student_id)) throw new JgError(400, 'Student is not in this section')
    return {
      school_id: ctx.section.school_id,
      academic_year_id: ctx.yearId,
      section_id: ctx.section.id,
      student_id: e.student_id,
      stage,
      art: level(e.art),
      music: level(e.music),
      pe: level(e.pe),
      excused_days: daysOf(e.excused_days, 'Excused absence'),
      unexcused_days: daysOf(e.unexcused_days, 'Unexcused absence'),
      teacher_note: e.teacher_note?.trim() ? e.teacher_note.trim().slice(0, 500) : null,
      updated_by: actor.profileId,
      updated_at: now,
    }
  })
  if (rows.length) {
    const { error } = await supabase.from('jg_activity_records').upsert(rows, { onConflict: 'student_id,academic_year_id,stage' })
    if (error) throw error
  }
  if (days !== undefined) {
    if (days === null) {
      const { error } = await supabase.from('jg_school_days').delete().eq('section_id', ctx.section.id).eq('academic_year_id', ctx.yearId).eq('stage', stage)
      if (error) throw error
    } else {
      const { error } = await supabase.from('jg_school_days').upsert(
        { school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, stage, days: Number(days) },
        { onConflict: 'section_id,academic_year_id,stage' },
      )
      if (error) throw error
    }
  }
  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'activities.update', entity: 'jg_activity_records',
    sectionId: ctx.section.id, after: { stage, school_days: days, count: rows.length },
  })
  return getActivities(ctx, stage)
}

// ---- report card settings ------------------------------------------------------------------------

export interface JgReportCardSettings {
  options: JgReportCardOptions
  guardian_tips: string[]
  quotes: string[]
}

export async function getReportCardSettings(ctx: JgSectionContext): Promise<JgReportCardSettings> {
  const { data, error } = await supabase
    .from('jg_report_card_settings')
    .select('options, guardian_tips, quotes')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .maybeSingle()
  if (error) throw error
  const saved = (data?.options ?? {}) as Partial<JgReportCardOptions>
  // The 12 B7 elements default on; the Wave 2 toggles (bw, prediction, autoNotes) default off.
  const options = Object.fromEntries(
    (Object.keys(JG_REPORT_CARD_DEFAULTS) as (keyof JgReportCardOptions)[]).map((k) => [k, typeof saved[k] === 'boolean' ? saved[k] : JG_REPORT_CARD_DEFAULTS[k]]),
  ) as unknown as JgReportCardOptions
  const tips = Array.isArray(data?.guardian_tips) && data.guardian_tips.length ? data.guardian_tips : JG_DEFAULT_GUARDIAN_TIPS
  const quotes = Array.isArray(data?.quotes) && data.quotes.length ? data.quotes : JG_DEFAULT_QUOTES
  return { options, guardian_tips: tips, quotes }
}

export async function saveReportCardSettings(ctx: JgSectionContext, body: Partial<JgReportCardSettings>, actor: JgActor) {
  const current = await getReportCardSettings(ctx)
  const options = { ...current.options }
  for (const k of Object.keys(JG_REPORT_CARD_DEFAULTS) as (keyof JgReportCardOptions)[]) {
    if (body.options && typeof body.options[k] === 'boolean') options[k] = body.options[k]
  }
  const list = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 300)) : fallback
  const row = {
    school_id: ctx.section.school_id,
    academic_year_id: ctx.yearId,
    section_id: ctx.section.id,
    options,
    guardian_tips: list(body.guardian_tips, current.guardian_tips),
    quotes: list(body.quotes, current.quotes),
    updated_by: actor.profileId,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('jg_report_card_settings').upsert(row, { onConflict: 'section_id,academic_year_id' })
  if (error) throw error
  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'report_card_settings.update',
    entity: 'jg_report_card_settings', sectionId: ctx.section.id, before: current, after: row,
  })
  return getReportCardSettings(ctx)
}

// ---- building report cards -----------------------------------------------------------------------

export interface ReportStudent {
  id: string
  name: string
  gender: string | null
  nationality: string | null
  mother_name: string | null
  place_of_birth: string | null
  registration_number: string | null
  date_of_birth: string | null
  /** «الرقم الوطني» (profiles.national_id). */
  national_id: string | null
  /** «مستجد» / «معيد» (Wave 2 column; null before the migration). */
  enrollment_status: string | null
  /** «صفة القيد»: «نظامي» / «منازل». */
  registration_type: string | null
  guardian_phone: string | null
}

const STUDENT_EXTRA = 'id, nationality, mother_name, place_of_birth, registration_number, custom_fields, enrollment_status, registration_type, profile:profiles(date_of_birth, national_id)'
const STUDENT_EXTRA_V1 = 'id, nationality, mother_name, place_of_birth, registration_number, custom_fields, profile:profiles(date_of_birth, national_id)'

/** Card fields of a section's students, in list order (before jahbadh_wave2.sql the new columns read as null). */
export async function reportStudents(sectionId: string): Promise<ReportStudent[]> {
  const ordered = await sectionStudents(sectionId)
  if (!ordered.length) return []
  const ids = ordered.map((s) => s.id)
  let res: { data: any[] | null; error: any } = await supabase.from('students').select(STUDENT_EXTRA).in('id', ids)
  // 42703 = undefined column: the Wave 2 migration has not been run yet.
  if (res.error?.code === '42703') res = await supabase.from('students').select(STUDENT_EXTRA_V1).in('id', ids)
  const { data, error } = res
  if (error) throw error
  const extra = new Map((data ?? []).map((r: any) => [r.id, r]))
  return ordered.map((s) => {
    const r: any = extra.get(s.id) ?? {}
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return {
      id: s.id, name: s.name, gender: s.gender,
      nationality: r.nationality ?? null, mother_name: r.mother_name ?? null, place_of_birth: r.place_of_birth ?? null,
      registration_number: r.registration_number ?? null, date_of_birth: p?.date_of_birth ?? null,
      national_id: p?.national_id ?? null,
      enrollment_status: r.enrollment_status ?? null,
      registration_type: r.registration_type ?? null,
      guardian_phone: (r.custom_fields && typeof r.custom_fields === 'object' ? r.custom_fields.guardian_phone : null) ?? null,
    }
  })
}

export const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '/') : '')

export function stageSplit(subject: JgLoadedSubject, cells: Record<string, JgCell>, stage: number) {
  const comps = subject.components.filter((c) => c.stage === stage)
  const max = comps.reduce((a, c) => a + c.max_score, 0)
  let works: number | null = null
  let exam: number | null = null
  for (const c of comps) {
    const cell = cells[c.id]
    if (!cell || (!cell.absent && (cell.value === null || cell.value === undefined))) continue
    const v = cell.absent ? 0 : Number(cell.value)
    if (c.is_exam) exam = (exam ?? 0) + v
    else works = (works ?? 0) + v
  }
  const total = works === null && exam === null ? null : (works ?? 0) + (exam ?? 0)
  return { works, exam, total, max }
}

/**
 * Report card data for every student of a section (optionally a list-number range), for one scope:
 * a single stage (its marks, estimate and rank on that stage) or the final year result (all stages,
 * second round, official decision).
 */
export async function buildReportCards(
  ctx: JgSectionContext,
  scope: JgScope,
  opts: { from?: number; to?: number; studentIds?: string[] } = {},
): Promise<{ cards: JgReportCardData[]; options: JgReportCardOptions }> {
  const subjects = ctx.grade.subjects
  const rule = ruleInput(ctx.grade.rule)
  const allStages = gradeStages(ctx)
  const scopeStages = scope === 'final' ? allStages : [Number(scope.slice(5))]
  const stageNames = scopeStages.map((s) => ctx.grade.rule.stage_names[s - 1] ?? String(s))
  const [students, activities, schoolDays, settings, header] = await Promise.all([
    reportStudents(ctx.section.id),
    loadActivities(ctx),
    loadSchoolDays(ctx),
    getReportCardSettings(ctx),
    printHeader(ctx.section.school_id, ctx.settings, { sectionId: ctx.section.id, yearId: ctx.yearId }),
  ])
  // Same computation as the results sheet: months, sub-items, Article 122 / 51, completeness.
  const computed = await computeSection(ctx, students.map((s) => ({ id: s.id, name: s.name, gender: s.gender, student_number: null })))
  // Brief B6-39: a verification code per printed card (unchanged cards keep theirs); the QR opens the
  // public verification page. Before jahbadh_wave5.sql runs no code is issued and the QR keeps the reference.
  const verifyMod = await import('./insight/insight.service')
  const verifyCodes: Record<string, string> = await verifyMod.issueCodes(ctx, scope, null, opts.studentIds).catch(() => ({}))

  // Per student × subject figures for this scope.
  const per = students.map((st, i) => {
    const sec = computed.students[i]
    const cells = sec.marks.cells as Record<string, JgCell>
    const subjectsOut = subjects.map((s, j) => {
      const comps = engineComponents(s)
      const round2 = sec.round2[s.id] ?? null
      const res = scope === 'final'
        ? sec.resolved.subjects[j].result
        : computeSubject(comps, cells, round2, rule, ctx.settings.grading_scale, { jabrKasur: ctx.settings.jabr_kasur })
      const split = Object.fromEntries(allStages.map((n) => [n, stageSplit(s, cells, n)]))
      const pctOf = (n: number) => (split[n]?.max && split[n].total !== null ? split[n].total! / split[n].max : null)
      let final: number | null
      let max: number
      let pct: number | null
      let estimate: string | null
      if (scope === 'final') {
        final = res.final
        max = s.meta.subjectMax
        pct = res.finalPct
        estimate = res.estimate
      } else {
        const n = scopeStages[0]
        final = split[n].total
        max = split[n].max
        pct = pctOf(n)
        estimate = estimateFor(pct, ctx.settings.grading_scale)
      }
      // Trend between the last stage in scope and the one before it (final: stage 2 vs stage 1).
      const k = scope === 'final' ? allStages[1] : scopeStages[0]
      const prev = allStages[allStages.indexOf(k) - 1]
      const a = prev ? pctOf(prev) : null
      const b = k ? pctOf(k) : null
      const trend = a !== null && b !== null ? (b - a) * 100 : null
      return { subject: s, res, split, final, max, pct, estimate, trend, round2: scope === 'final' ? res.round2 : null }
    })
    return { st, subjectsOut }
  })

  const averages = subjects.map((_, j) => stats(per.map((p) => p.subjectsOut[j].final)).mean)
  const overall = per.map(({ subjectsOut }) => {
    let total: number | null = null
    let recorded = 0
    for (const x of subjectsOut) {
      if (x.final === null || !x.max) continue
      total = (total ?? 0) + x.final
      recorded += x.max
    }
    return { total, pct: total === null || !recorded ? null : total / recorded }
  })
  // Final year: ranks among complete students only (brief F1-6); a stage: by that stage's share.
  const ranks = scope === 'final' ? computed.students.map((x) => x.rank) : competitionRanks(overall.map((o) => o.pct))
  const maxAll = subjects.reduce((a, s) => a + (scope === 'final' ? s.meta.subjectMax : s.meta.stageMax[scopeStages[0]] ?? 0), 0)

  const title = scope === 'final' ? 'صحيفة النتيجة النهائية للعام الدراسي' : `صحيفة نتائج ${stageNames[0]}`
  const cards: JgReportCardData[] = []
  const extras = schoolExtras(ctx.settings)
  const modes = stageModesOf(ctx, scopeStages)
  const printedOn = new Date()
  for (const [i, { st, subjectsOut }] of per.entries()) {
    const listNumber = i + 1
    if (opts.from && listNumber < opts.from) continue
    if (opts.to && listNumber > opts.to) continue
    if (opts.studentIds && !opts.studentIds.includes(st.id)) continue
    const ov = overall[i]
    const est = estimateFor(ov.pct, ctx.settings.grading_scale)
    const decision =
      scope === 'final'
        ? decisionWithDetail(computed.students[i].resolved) ?? '—'
        : `نتيجة ${stageNames[0]}: ${est ?? '—'}`
    const rec = (n: number) => activities.find((a) => a.student_id === st.id && a.stage === n)
    const resolved = computed.students[i].resolved
    // Stage estimate (start of each stage note) and the stage share used by the auto note / projection.
    const stageShare = scopeStages.map((n) => {
      let tot = 0, mx = 0
      for (const x of subjectsOut) if (x.split[n]?.max && x.split[n].total !== null) { tot += x.split[n].total!; mx += x.split[n].max }
      return mx ? tot / mx : null
    })
    const allShare = allStages.map((n) => {
      let tot = 0, mx = 0
      for (const x of subjectsOut) if (x.split[n]?.max && x.split[n].total !== null) { tot += x.split[n].total!; mx += x.split[n].max }
      return mx ? tot / mx : null
    })
    const notes = scopeStages.map((n, k) => {
      const manual = rec(n)?.teacher_note ?? null
      if (manual || !settings.options.autoNotes) return manual
      const prevIdx = allStages.indexOf(n) - 1
      return autoNote(st.gender, subjectsOut.map((x) => ({ name: x.subject.short_name || x.subject.name, pct: x.split[n]?.max && x.split[n].total !== null ? x.split[n].total! / x.split[n].max : null })), stageShare[k], prevIdx >= 0 ? allShare[prevIdx] : null, ctx)
    })
    const reference = cardReference(extras.schoolNumber, st.registration_number ?? '', printedOn)
    const code = signCode(`${reference}|${ov.total ?? ''}|${resolved.decision ?? ''}`)
    const recorded = allShare.filter((x): x is number => x !== null)
    const current = resolved.overall.pct
    const projection = scope !== 'final' && settings.options.prediction && current !== null
      ? (() => { const pct = recorded.length >= 2 ? 0.5 * current + 0.5 * recorded[recorded.length - 1] : current; return { pct, estimate: estimateFor(pct, ctx.settings.grading_scale) } })()
      : null
    cards.push({
      header,
      title,
      yearName: ctx.yearName ?? '',
      gradeCode: ctx.grade.rule.grade_code,
      gradeName: ctx.grade.rule.name,
      sectionName: ctx.section.name,
      systemName: ctx.grade.rule.system_name,
      stageNames,
      ruleText: ctx.grade.rule.rule_text,
      student: {
        name: st.name,
        gender: st.gender,
        nationality: st.nationality ?? '',
        registrationNumber: st.registration_number ?? '',
        motherName: st.mother_name ?? '',
        birth: [st.place_of_birth, fmtDate(st.date_of_birth)].filter(Boolean).join(' — '),
        listNumber,
        nationalId: st.national_id ?? '',
        enrollmentStatus: st.enrollment_status ?? '',
        registrationType: st.registration_type ?? '',
      },
      subjects: subjectsOut.map((x, j) => ({
        name: x.subject.name,
        weeklyPeriods: x.subject.weekly_periods,
        stages: scopeStages.map((n) => x.split[n]),
        max: x.max,
        minPass: ctx.grade.rule.no_fail ? null : Number(ctx.grade.rule.total_min) * x.max,
        final: x.final,
        round2: x.round2,
        pct: x.pct,
        estimate: x.estimate,
        classAverage: averages[j] === null ? null : Math.round(averages[j]! * 10) / 10,
        trend: x.trend,
        firstRound: scope === 'final' ? resolved.subjects[j].result.total : null,
        jabr: scope === 'final' ? resolved.subjects[j].jabr : false,
        need: scope !== 'final' && settings.options.prediction ? needToPass(resolved.subjects[j].result, x.subject, ctx) : undefined,
      })),
      total: ov.total,
      max: maxAll,
      pct: ov.pct,
      estimate: est,
      rank: ranks[i],
      classSize: students.length,
      decision,
      showRound2: scope === 'final' && !ctx.grade.rule.no_fail,
      activities: JG_ACTIVITY_SUBJECTS.map((name, k) => ({
        name,
        levels: scopeStages.map((n) => {
          const r = rec(n)
          return (k === 0 ? r?.art : k === 1 ? r?.music : r?.pe) ?? null
        }),
      })),
      attendance: {
        excused: scopeStages.map((n) => rec(n)?.excused_days ?? null),
        unexcused: scopeStages.map((n) => rec(n)?.unexcused_days ?? null),
        schoolDays: scopeStages.map((n) => schoolDays[n] ?? null),
      },
      notes,
      guardianTips: settings.guardian_tips,
      quote: settings.quotes[(listNumber - 1) % settings.quotes.length],
      excelRate: ctx.settings.excel_rate,
      followRate: ctx.settings.follow_rate,
      cardName: `بطاقة تقدير درجات — مرحلة التعليم ${ctx.grade.rule.level === 'secondary' ? 'الثانوي' : 'الأساسي'}`,
      yearLine: yearLine(ctx.settings, ctx.yearName),
      school: { number: extras.schoolNumber, locatedAt: extras.locatedAt, coordinator: extras.examsCoordinator, subOffice: extras.subOffice },
      stageModes: modes,
      stageEstimates: stageShare.map((p) => estimateFor(p, ctx.settings.grading_scale)),
      rounds: scope === 'final' ? roundSentences(ctx, st, resolved) : null,
      signatureRoles: ctx.grade.rule.grade_code <= 5 ? ['منسق الامتحانات', 'مدير المدرسة', 'ولي الأمر'] : ['رائد الفصل', 'مدير المدرسة', 'ولي الأمر'],
      activityPeriods: ctx.grade.rule.grade_code >= 6 && ctx.grade.rule.grade_code <= 8 ? [2, 1, 2] : null,
      projection,
      reference,
      verifyCode: verifyCodes[st.id] ?? null,
      qrSvg: await qrSvgOf(verifyCodes[st.id] ? verifyMod.verifyUrl(verifyCodes[st.id]) : `JGRC|${reference}|${code}`, 15),
    })
  }
  return { cards, options: settings.options }
}

// ---- Wave 2 card helpers (brief B7, B6-30, B6-33) -----------------------------------------------------

/** How each stage prints: works/exam/total when it has both, else max/score (periods) or the exam alone. */
function stageModesOf(ctx: JgSectionContext, stages: number[]): JgStageMode[] {
  return stages.map((n) => {
    const comps = ctx.grade.subjects.flatMap((s) => s.components.filter((c) => c.stage === n))
    const exam = comps.some((c) => c.is_exam)
    const works = comps.some((c) => !c.is_exam)
    return exam && works ? 'semester' : exam ? 'exam' : 'period'
  })
}

const FIRST_ROUND_FAIL = ['round2', 'pass_round2', 'fail']

/** The official first / second round sentences, gender-aware (brief B7). */
function roundSentences(ctx: JgSectionContext, st: ReportStudent, res: JgStudentResult): { first: string | null; second: string | null; single: boolean } {
  const g = st.gender ?? undefined
  const word = learnerWord(ctx.grade.rule.grade_code, g)
  const who = `${genderForm(g, 'يعتبر', 'تعتبر')} ${word} (${st.name})`
  const pct = res.overall.pct === null ? '' : ` (${fmtPct2(res.overall.pct)})`
  const est = res.overall.estimate ? ` بتقدير عام ${res.overall.estimate}` : ''
  const next = ctx.grade.rule.next_grade_name
  const passText = ctx.grade.rule.certificate_name
    ? `${who} ${genderForm(g, 'ناجحاً وحاصلاً', 'ناجحة وحاصلة')} على ${ctx.grade.rule.certificate_name}${est}${pct}`
    : `${who} ${genderForm(g, 'ناجحاً ومنقولاً', 'ناجحة ومنقولة')} للصف ${next ?? ''}${est}${pct}`
  const failText = `${who} ${genderForm(g, 'راسباً', 'راسبة')}`
  if (!res.decision) return { first: null, second: null, single: ctx.grade.rule.no_fail }
  if (res.incomplete) return { first: decisionWithDetail(res), second: null, single: ctx.grade.rule.no_fail }
  if (ctx.grade.rule.no_fail) return { first: `${genderForm(g, 'ينقل', 'تنقل')} ${word} (${st.name}) إلى الصف ${next ?? ''}${est}${pct}`, second: null, single: true }
  if (res.overRound2Limit) return { first: failText, second: null, single: false }
  const referred = res.subjects.filter((x) => x.result.result && FIRST_ROUND_FAIL.includes(x.result.result))
  if (!referred.length) return { first: passText, second: null, single: false }
  const first = `${who} ${genderForm(g, 'مؤجلاً', 'مؤجلة')} للدور الثاني في ${subjectCountWord(referred.length)}: ${referred.map((x) => x.name).join('، ')}`
  const pending = referred.some((x) => x.result.result === 'round2')
  const second = pending ? 'بانتظار رصد درجات الدور الثاني' : res.subjects.some((x) => x.result.result === 'fail') ? failText : passText
  return { first, second, single: false }
}

/** Marks still needed to pass from the remaining capacity: 'ok' secured, 'impossible' out of reach (brief B6-30). */
function needToPass(res: JgSubjectResult, subject: JgLoadedSubject, ctx: JgSectionContext): number | 'ok' | 'impossible' | null {
  if (ctx.grade.rule.no_fail) return null
  const max = subject.meta.subjectMax
  const minPass = Number(ctx.grade.rule.total_min) * max
  const have = res.total ?? 0
  const remaining = max - res.recordedMax
  const need = Math.round((minPass - have) * 100) / 100
  if (need <= 0) return 'ok'
  return need > remaining + 1e-9 ? 'impossible' : need
}

/** Short generated note when the teacher left it empty (phrase bank, gender-aware; brief B6-33). */
function autoNote(gender: string | null, subjects: { name: string; pct: number | null }[], share: number | null, prev: number | null, ctx: JgSectionContext): string | null {
  if (share === null) return null
  const g = gender ?? undefined
  const band = estimateFor(share, ctx.settings.grading_scale)
  const ranked = subjects.filter((x) => x.pct !== null).sort((a, b) => b.pct! - a.pct!)
  const parts = [`${genderForm(g, 'مستواه', 'مستواها')} العام ${band ?? ''}`.trim()]
  if (ranked[0] && ranked[0].pct! >= ctx.settings.excel_rate) parts.push(`${genderForm(g, 'يتميز', 'تتميز')} في ${ranked[0].name}`)
  const weak = ranked[ranked.length - 1]
  if (weak && weak.pct! < ctx.settings.follow_rate) parts.push(`${genderForm(g, 'يحتاج', 'تحتاج')} إلى تعزيز في ${weak.name}`)
  if (prev !== null) {
    const d = (share - prev) * 100
    if (d >= 5) parts.push(`${genderForm(g, 'تحسّن أداؤه', 'تحسّن أداؤها')} عن المرحلة السابقة`)
    else if (d <= -5) parts.push(`${genderForm(g, 'تراجع أداؤه', 'تراجع أداؤها')} عن المرحلة السابقة`)
  }
  return parts.join('، ') + '.'
}

// ---- publishing ------------------------------------------------------------------------------------

export async function listPublications(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_publications')
    .select('id, scope, published_by, published_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  if (error) throw error
  return data ?? []
}

/** Profiles of the section's students and their linked parents (for the release notification). */
export async function audienceProfiles(sectionId: string): Promise<string[]> {
  const { data: students } = await supabase.from('students').select('id, profile_id').eq('section_id', sectionId)
  const ids = (students ?? []).map((s: any) => s.id)
  const profiles = new Set((students ?? []).map((s: any) => s.profile_id).filter(Boolean))
  if (ids.length) {
    const { data: links } = await supabase.from('parent_student_links').select('parent:parents(profile_id)').in('student_id', ids).eq('is_active', true)
    for (const l of links ?? []) {
      const p: any = Array.isArray((l as any).parent) ? (l as any).parent[0] : (l as any).parent
      if (p?.profile_id) profiles.add(p.profile_id)
    }
  }
  return [...profiles] as string[]
}

export async function publish(ctx: JgSectionContext, scope: JgScope, actor: JgActor) {
  const { error } = await supabase.from('jg_publications').upsert(
    { school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, scope, published_by: actor.profileId, published_at: new Date().toISOString() },
    { onConflict: 'section_id,academic_year_id,scope' },
  )
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'publish', entity: 'jg_publications', sectionId: ctx.section.id, after: { scope } })
  const label = scope === 'final' ? 'النتيجة النهائية' : ctx.grade.rule.stage_names[Number(scope.slice(5)) - 1] ?? ''
  // Never block publishing on notification delivery.
  audienceProfiles(ctx.section.id)
    .then((ids) => pushNotificationsService.sendToProfiles(ids, { title: 'صحيفة النتائج متاحة', body: `صدرت صحيفة ${label} — ${ctx.gradeLevelName} ${ctx.section.name}`, tag: `jg-${ctx.section.id}-${scope}` }))
    .catch((err) => console.error('jg publish notification failed', err))
  return listPublications(ctx)
}

export async function unpublish(ctx: JgSectionContext, publicationId: string, actor: JgActor) {
  const list = await listPublications(ctx)
  const pub = list.find((p) => p.id === publicationId)
  if (!pub) throw new JgError(404, 'Publication not found')
  const { error } = await supabase.from('jg_publications').delete().eq('id', publicationId)
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'unpublish', entity: 'jg_publications', sectionId: ctx.section.id, before: pub })
  return listPublications(ctx)
}

/** Students the caller may see (a student: themselves; a parent: linked children). */
export async function ownStudents(role: string, profileId: string): Promise<{ id: string; section_id: string | null; name: string }[]> {
  if (role === 'student') {
    const { data } = await supabase.from('students').select('id, section_id, profile:profiles(first_name, father_name, last_name)').eq('profile_id', profileId)
    return (data ?? []).map(toOwn)
  }
  if (role === 'parent') {
    const { data: parent } = await supabase.from('parents').select('id').eq('profile_id', profileId).maybeSingle()
    if (!parent) return []
    const { data: links } = await supabase.from('parent_student_links').select('student_id').eq('parent_id', parent.id).eq('is_active', true)
    const ids = (links ?? []).map((l: any) => l.student_id)
    if (!ids.length) return []
    const { data } = await supabase.from('students').select('id, section_id, profile:profiles(first_name, father_name, last_name)').in('id', ids)
    return (data ?? []).map(toOwn)
  }
  return []
}

function toOwn(s: any) {
  const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
  return { id: s.id, section_id: s.section_id, name: [p?.first_name, p?.father_name, p?.last_name].filter(Boolean).join(' ') }
}

/** Published report cards of the caller's students (current academic year). */
export async function myReportCards(role: string, profileId: string) {
  const students = await ownStudents(role, profileId)
  const sectionIds = [...new Set(students.map((s) => s.section_id).filter(Boolean))] as string[]
  if (!sectionIds.length) return []
  const { data, error } = await supabase
    .from('jg_publications')
    .select('id, section_id, scope, published_at, academic_year:academic_years!inner(id, name, is_current)')
    .in('section_id', sectionIds)
    .eq('academic_year.is_current', true)
  if (error) throw error
  return students.flatMap((s) =>
    (data ?? [])
      .filter((p: any) => p.section_id === s.section_id)
      .map((p: any) => {
        const y = Array.isArray(p.academic_year) ? p.academic_year[0] : p.academic_year
        return { student_id: s.id, student_name: s.name, section_id: s.section_id, scope: p.scope as JgScope, published_at: p.published_at, academic_year: y?.name ?? null }
      }),
  )
}
