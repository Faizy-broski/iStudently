import { supabase } from '../../config/supabase'
import { logJgAudit } from './audit.service'
import { computeSection, JgError, type JgActor, type JgSectionContext, type JgStudent } from './grades.service'

/**
 * Rollover to next year («النقل للعام القادم», brief B6 #29). From the section's final decisions:
 * passed → next grade (status «مستجد»), failed → repeat the grade («معيد»), second round still
 * pending or results incomplete → held («لم تُحسم») until the marks are in, last secondary grade
 * passed → graduated. It writes the platform's own rollover plan (student_enrollment.rollover_status
 * and next_grade_id), which the school's year-end rollover (/rollover/execute) then carries out;
 * students are not moved mid-year, so this year's results stay intact. Admin only.
 */

export type JgRolloverStatus = 'promoted' | 'retained' | 'graduated' | 'pending'
export type JgRolloverKind = 'promote' | 'repeat' | 'graduate' | 'hold'

/** Next official grade code: the 1st secondary branches into the scientific (11) or literary (12) track. */
export const JG_NEXT_CODES: Record<number, number[]> = {
  1: [2], 2: [3], 3: [4], 4: [5], 5: [6], 6: [7], 7: [8], 8: [9], 9: [10],
  10: [11, 12], 11: [13], 12: [14], 13: [], 14: [],
}

export interface JgRolloverRow {
  student: JgStudent
  decision: string
  kind: JgRolloverKind
  status: JgRolloverStatus
  /** «مستجد» in the next grade, «معيد» when repeating. */
  enrollment_label: 'مستجد' | 'معيد' | null
  next_grade_id: string | null
  pct: number | null
  /** No current-year enrollment row: the platform rollover can't plan this student. */
  no_enrollment: boolean
}

export interface JgRolloverPreview {
  grade_code: number
  next_grade_options: { id: string; name: string; grade_code: number }[]
  rows: JgRolloverRow[]
  counts: Record<JgRolloverKind, number>
}

function kindOf(ctx: JgSectionContext, s: Awaited<ReturnType<typeof computeSection>>['students'][number]): JgRolloverKind {
  const r = s.resolved
  if (r.decision === null || r.incomplete) return 'hold'
  const c = r.overall.counts
  if (ctx.grade.rule.no_fail) return 'promote'
  if (c.fail > 0) return 'repeat'
  if (c.round2 > 0) return 'hold'
  return (JG_NEXT_CODES[ctx.grade.rule.grade_code] ?? []).length ? 'promote' : 'graduate'
}

const STATUS: Record<JgRolloverKind, JgRolloverStatus> = { promote: 'promoted', repeat: 'retained', graduate: 'graduated', hold: 'pending' }

async function nextGradeOptions(ctx: JgSectionContext) {
  const codes = JG_NEXT_CODES[ctx.grade.rule.grade_code] ?? []
  if (!codes.length) return []
  const { data, error } = await supabase
    .from('jg_grade_level_map')
    .select('grade_level_id, grade_code, grade_level:grade_levels(name)')
    .eq('school_id', ctx.section.school_id)
    .in('grade_code', codes)
  if (error) throw error
  return (data ?? []).map((m: any) => {
    const gl = Array.isArray(m.grade_level) ? m.grade_level[0] : m.grade_level
    return { id: m.grade_level_id as string, name: (gl?.name as string) ?? '', grade_code: m.grade_code as number }
  })
}

async function enrollmentRows(ctx: JgSectionContext, studentIds: string[]): Promise<Map<string, { id: string; next_grade_id: string | null; rollover_status: string | null }>> {
  if (!studentIds.length) return new Map()
  const { data, error } = await supabase
    .from('student_enrollment')
    .select('id, student_id, next_grade_id, rollover_status')
    .eq('academic_year_id', ctx.yearId)
    .in('student_id', studentIds)
    .is('end_date', null)
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) {
    throw new JgError(409, 'The platform enrollment history is not set up on this database', 'no_enrollment')
  }
  if (error) throw error
  return new Map((data ?? []).map((r: any) => [r.student_id, { id: r.id, next_grade_id: r.next_grade_id ?? null, rollover_status: r.rollover_status ?? null }]))
}

export async function previewRollover(ctx: JgSectionContext): Promise<JgRolloverPreview> {
  const [{ students }, options] = await Promise.all([computeSection(ctx), nextGradeOptions(ctx)])
  const enrolled = await enrollmentRows(ctx, students.map((s) => s.student.id))
  const single = options.length === 1 ? options[0].id : null
  const rows: JgRolloverRow[] = students.map((s) => {
    const kind = kindOf(ctx, s)
    const e = enrolled.get(s.student.id)
    return {
      student: s.student,
      decision: s.resolved.decision ?? '',
      kind,
      status: STATUS[kind],
      enrollment_label: kind === 'promote' ? 'مستجد' : kind === 'repeat' ? 'معيد' : null,
      // A plan already saved wins over the suggestion (the admin may have chosen the track).
      next_grade_id: kind === 'promote' ? (e?.next_grade_id ?? single) : kind === 'repeat' ? ctx.section.grade_level_id : null,
      pct: s.resolved.overall.pct,
      no_enrollment: !e,
    }
  })
  const counts = { promote: 0, repeat: 0, graduate: 0, hold: 0 }
  for (const r of rows) counts[r.kind]++
  return { grade_code: ctx.grade.rule.grade_code, next_grade_options: options, rows, counts }
}

/**
 * Saves the plan. `overrides` sets the next grade per student (required when the next grade has
 * two tracks) or holds a student back from the plan (`hold: true`). Held students keep «pending».
 */
export async function applyRollover(
  ctx: JgSectionContext,
  overrides: { student_id: string; next_grade_id?: string | null; hold?: boolean }[] = [],
  actor: JgActor,
): Promise<{ planned: number; held: number; missing_next_grade: string[]; no_enrollment: string[] }> {
  const preview = await previewRollover(ctx)
  const allowed = new Set([...preview.next_grade_options.map((o) => o.id), ctx.section.grade_level_id])
  const byStudent = new Map(overrides.map((o) => [o.student_id, o]))
  for (const o of overrides) {
    if (!preview.rows.some((r) => r.student.id === o.student_id)) throw new JgError(400, 'Student is not in this section')
    if (o.next_grade_id && !allowed.has(o.next_grade_id)) throw new JgError(400, 'The next grade must be the next official grade of this school', 'invalid_next_grade')
  }
  const enrolled = await enrollmentRows(ctx, preview.rows.map((r) => r.student.id))
  const missingNext: string[] = []
  const noEnrollment: string[] = []
  let planned = 0
  let held = 0
  const now = new Date().toISOString()
  for (const r of preview.rows) {
    const o = byStudent.get(r.student.id)
    const e = enrolled.get(r.student.id)
    if (!e) { noEnrollment.push(r.student.name); continue }
    const hold = o?.hold === true || r.kind === 'hold'
    const status: JgRolloverStatus = hold ? 'pending' : r.status
    const next = hold ? null : r.kind === 'promote' ? (o?.next_grade_id ?? r.next_grade_id) : r.kind === 'repeat' ? ctx.section.grade_level_id : null
    if (!hold && r.kind === 'promote' && !next) { missingNext.push(r.student.name); continue }
    const { error } = await supabase
      .from('student_enrollment')
      .update({
        rollover_status: status,
        next_grade_id: next,
        rollover_notes: `جهبذ: ${r.decision || 'لم تُحسم'}${r.enrollment_label && !hold ? ` — ${r.enrollment_label}` : ''}`,
        updated_at: now,
      })
      .eq('id', e.id)
    if (error) throw error
    if (hold) held++
    else planned++
  }
  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'rollover.plan', entity: 'student_enrollment',
    sectionId: ctx.section.id, after: { planned, held, missing_next_grade: missingNext.length, no_enrollment: noEnrollment.length, counts: preview.counts },
  })
  return { planned, held, missing_next_grade: missingNext, no_enrollment: noEnrollment }
}
