import { supabase } from '../../config/supabase'
import { pushNotificationsService } from '../push-notifications.service'
import {
  competitionRanks,
  computeSubject,
  decisionFor,
  estimateFor,
  JG_ACTIVITY_SUBJECTS,
  stats,
  studentOverall,
  type JgCell,
} from '../../lib/jahbadh'
import { logJgAudit } from './audit.service'
import {
  cellsFor,
  engineComponents,
  JgError,
  loadMarks,
  loadRound2,
  ruleInput,
  sectionStudents,
  type JgActor,
  type JgLoadedSubject,
  type JgSectionContext,
} from './grades.service'
import { JG_REPORT_CARD_ALL_ON, printHeader, type JgReportCardData, type JgReportCardOptions } from './print.service'

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

const gradeStages = (ctx: JgSectionContext) =>
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

async function loadActivities(ctx: JgSectionContext): Promise<(JgActivityRow & { stage: number })[]> {
  const { data, error } = await supabase
    .from('jg_activity_records')
    .select('student_id, stage, art, music, pe, excused_days, unexcused_days, teacher_note')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  if (error) throw error
  return data ?? []
}

async function loadSchoolDays(ctx: JgSectionContext): Promise<Record<number, number>> {
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
  const options = Object.fromEntries(
    Object.keys(JG_REPORT_CARD_ALL_ON).map((k) => [k, saved[k as keyof JgReportCardOptions] !== false]),
  ) as unknown as JgReportCardOptions
  const tips = Array.isArray(data?.guardian_tips) && data.guardian_tips.length ? data.guardian_tips : JG_DEFAULT_GUARDIAN_TIPS
  const quotes = Array.isArray(data?.quotes) && data.quotes.length ? data.quotes : JG_DEFAULT_QUOTES
  return { options, guardian_tips: tips, quotes }
}

export async function saveReportCardSettings(ctx: JgSectionContext, body: Partial<JgReportCardSettings>, actor: JgActor) {
  const current = await getReportCardSettings(ctx)
  const options = { ...current.options }
  for (const k of Object.keys(JG_REPORT_CARD_ALL_ON) as (keyof JgReportCardOptions)[]) {
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

interface ReportStudent {
  id: string
  name: string
  gender: string | null
  nationality: string | null
  mother_name: string | null
  place_of_birth: string | null
  registration_number: string | null
  date_of_birth: string | null
}

async function reportStudents(sectionId: string): Promise<ReportStudent[]> {
  const ordered = await sectionStudents(sectionId)
  if (!ordered.length) return []
  const { data, error } = await supabase
    .from('students')
    .select('id, nationality, mother_name, place_of_birth, registration_number, profile:profiles(date_of_birth)')
    .in('id', ordered.map((s) => s.id))
  if (error) throw error
  const extra = new Map((data ?? []).map((r: any) => [r.id, r]))
  return ordered.map((s) => {
    const r: any = extra.get(s.id) ?? {}
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile
    return {
      id: s.id, name: s.name, gender: s.gender,
      nationality: r.nationality ?? null, mother_name: r.mother_name ?? null, place_of_birth: r.place_of_birth ?? null,
      registration_number: r.registration_number ?? null, date_of_birth: p?.date_of_birth ?? null,
    }
  })
}

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '/') : '')

function stageSplit(subject: JgLoadedSubject, cells: Record<string, JgCell>, stage: number) {
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
  const [students, marks, r2, activities, schoolDays, settings, header] = await Promise.all([
    reportStudents(ctx.section.id),
    loadMarks(ctx, subjects.flatMap((s) => s.components.map((c) => c.id))),
    loadRound2(ctx, subjects.map((s) => s.id)),
    loadActivities(ctx),
    loadSchoolDays(ctx),
    getReportCardSettings(ctx),
    printHeader(ctx.section.school_id, ctx.settings),
  ])

  // Per student × subject figures for this scope.
  const per = students.map((st) => {
    const cells = cellsFor(marks, st.id)
    const subjectsOut = subjects.map((s) => {
      const comps = engineComponents(s)
      const round2 = r2.find((x) => x.student_id === st.id && x.jg_subject_id === s.id)?.value ?? null
      const res = computeSubject(comps, cells, round2, rule, ctx.settings.grading_scale)
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
  const ranks = competitionRanks(overall.map((o) => o.pct))
  const maxAll = subjects.reduce((a, s) => a + (scope === 'final' ? s.meta.subjectMax : s.meta.stageMax[scopeStages[0]] ?? 0), 0)

  const title = scope === 'final' ? 'صحيفة النتيجة النهائية للعام الدراسي' : `صحيفة نتائج ${stageNames[0]}`
  const cards: JgReportCardData[] = []
  per.forEach(({ st, subjectsOut }, i) => {
    const listNumber = i + 1
    if (opts.from && listNumber < opts.from) return
    if (opts.to && listNumber > opts.to) return
    if (opts.studentIds && !opts.studentIds.includes(st.id)) return
    const ov = overall[i]
    const est = estimateFor(ov.pct, ctx.settings.grading_scale)
    const decision =
      scope === 'final'
        ? decisionFor(
            { noFail: ctx.grade.rule.no_fail, certificateName: ctx.grade.rule.certificate_name, nextGradeName: ctx.grade.rule.next_grade_name },
            studentOverall(subjectsOut.map((x) => ({ name: x.subject.short_name, result: x.res })), rule),
            subjects.length,
          )
        : `نتيجة ${stageNames[0]}: ${est ?? '—'}`
    const rec = (n: number) => activities.find((a) => a.student_id === st.id && a.stage === n)
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
      notes: scopeStages.map((n) => rec(n)?.teacher_note ?? null),
      guardianTips: settings.guardian_tips,
      quote: settings.quotes[(listNumber - 1) % settings.quotes.length],
      excelRate: ctx.settings.excel_rate,
      followRate: ctx.settings.follow_rate,
    })
  })
  return { cards, options: settings.options }
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
async function audienceProfiles(sectionId: string): Promise<string[]> {
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
