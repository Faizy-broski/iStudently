import { Response } from 'express'
import { supabase } from '../config/supabase'
import type { AuthRequest } from '../middlewares/auth.middleware'

// Past marking periods and the grades a student earned in them (web: /admin/grades/history-marking-periods,
// /admin/grades/historical-grades; tables in migrations/historical_grades.sql). Ids in params and bodies are
// checked against the caller's school family by the routes.

const MP_TYPES = ['year', 'semester', 'quarter']
const MP_FIELDS = ['mp_type', 'name', 'short_name', 'post_end_date', 'school_year', 'sort_order'] as const
const GRADE_FIELDS = ['course_period_id', 'course_title', 'grade_letter', 'grade_percent', 'gp_scale', 'unweighted_gp', 'credit_attempted', 'credit_earned', 'comment', 'class_rank'] as const

function pick<K extends string>(body: Record<string, unknown>, keys: readonly K[]) {
  const out: Partial<Record<K, unknown>> = {}
  for (const k of keys) if (k in body) out[k] = body[k] === '' ? null : body[k]
  return out
}

function fail(res: Response, err: unknown) {
  res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Internal server error' })
}

async function studentSchool(studentId: string): Promise<string | null> {
  const { data } = await supabase.from('students').select('school_id').eq('id', studentId).maybeSingle()
  return (data as { school_id: string } | null)?.school_id ?? null
}

// ---------------------------------------------------------------------------
// History marking periods
// ---------------------------------------------------------------------------

/** GET /history-marking-periods?campus_id= : school-wide periods plus the campus's own. */
export async function listHistoryMarkingPeriods(req: AuthRequest, res: Response) {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const campusId = typeof req.query.campus_id === 'string' && req.query.campus_id ? req.query.campus_id : null
    let q = supabase.from('history_marking_periods').select('*').eq('school_id', schoolId)
    q = campusId ? q.or(`campus_id.is.null,campus_id.eq.${campusId}`) : q.is('campus_id', null)
    const { data, error } = await q.order('school_year', { ascending: false }).order('post_end_date', { ascending: true, nullsFirst: false }).order('name')
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    fail(res, err)
  }
}

/** POST /history-marking-periods */
export async function createHistoryMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const schoolId = req.profile?.school_id
    const body = pick(req.body ?? {}, MP_FIELDS)
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    if (typeof body.name !== 'string' || !body.name.trim()) return res.status(400).json({ success: false, error: 'name is required' })
    if (body.mp_type != null && !MP_TYPES.includes(body.mp_type as string)) return res.status(400).json({ success: false, error: 'Invalid mp_type' })
    const { data, error } = await supabase
      .from('history_marking_periods')
      .insert({ ...body, name: body.name.trim(), school_year: body.school_year ?? '', school_id: schoolId, campus_id: req.body?.campus_id || null })
      .select()
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** PUT /history-marking-periods/:id */
export async function updateHistoryMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const body = pick(req.body ?? {}, MP_FIELDS)
    if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) return res.status(400).json({ success: false, error: 'name is required' })
    if (body.mp_type != null && !MP_TYPES.includes(body.mp_type as string)) return res.status(400).json({ success: false, error: 'Invalid mp_type' })
    if ('school_year' in body && body.school_year == null) body.school_year = ''
    const { data, error } = await supabase
      .from('history_marking_periods')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** DELETE /history-marking-periods/:id (its student links and grades go with it) */
export async function deleteHistoryMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const { error } = await supabase.from('history_marking_periods').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    fail(res, err)
  }
}

// ---------------------------------------------------------------------------
// A student's historical grades
// ---------------------------------------------------------------------------

type GradeRow = { marking_period_id: string; gp_scale: number | null; unweighted_gp: number | null }
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100 : 0)

/**
 * GET /historical-grades/student/:studentId/marking-periods
 * The student's past marking periods, oldest first, with GPA (mean grade points of the period's graded
 * courses) and cumulative GPA (all graded courses up to and including the period). Unweighted uses
 * `unweighted_gp`, falling back to `gp_scale`.
 */
export async function listStudentMarkingPeriods(req: AuthRequest, res: Response) {
  try {
    const studentId = req.params.studentId
    const [links, grades] = await Promise.all([
      supabase
        .from('student_history_marking_periods')
        .select('grade_level, mp:history_marking_periods(id, name, post_end_date, school_year)')
        .eq('student_id', studentId),
      supabase.from('historical_grades').select('marking_period_id, gp_scale, unweighted_gp').eq('student_id', studentId),
    ])
    if (links.error) throw links.error
    if (grades.error) throw grades.error
    const rows = (links.data ?? []) as unknown as { grade_level: string | null; mp: { id: string; name: string; post_end_date: string | null; school_year: string } | null }[]
    const mps = rows
      .filter((r) => r.mp)
      .map((r) => ({ ...r.mp!, grade_level: r.grade_level }))
      .sort((a, b) => a.school_year.localeCompare(b.school_year) || (a.post_end_date ?? '9999').localeCompare(b.post_end_date ?? '9999') || a.name.localeCompare(b.name))
    const byMp = new Map<string, GradeRow[]>()
    for (const g of (grades.data ?? []) as GradeRow[]) byMp.set(g.marking_period_id, [...(byMp.get(g.marking_period_id) ?? []), g])
    const weighted = (gs: GradeRow[]) => gs.filter((g) => g.gp_scale != null).map((g) => Number(g.gp_scale))
    const unweighted = (gs: GradeRow[]) => gs.map((g) => g.unweighted_gp ?? g.gp_scale).filter((v): v is number => v != null).map(Number)
    const seen: GradeRow[] = []
    const data = mps.map((mp) => {
      const gs = byMp.get(mp.id) ?? []
      seen.push(...gs)
      return {
        mp_id: mp.id,
        mp_name: mp.name,
        posted: mp.post_end_date ?? '',
        school_year: mp.school_year,
        grade_level: mp.grade_level,
        weighted_gpa: avg(weighted(gs)),
        weighted_cum: avg(weighted(seen)),
        unweighted_gpa: avg(unweighted(gs)),
        unweighted_cum: avg(unweighted(seen)),
      }
    })
    res.json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** POST /historical-grades/student/:studentId/marking-periods  { marking_period_id, grade_level? } */
export async function addStudentMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const { studentId } = req.params
    const mpId = req.body?.marking_period_id
    if (typeof mpId !== 'string' || !mpId) return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    const schoolId = await studentSchool(studentId)
    if (!schoolId) return res.status(404).json({ success: false, error: 'Not found' })
    const { data, error } = await supabase
      .from('student_history_marking_periods')
      .upsert({ school_id: schoolId, student_id: studentId, marking_period_id: mpId, grade_level: req.body?.grade_level || null, updated_at: new Date().toISOString() }, { onConflict: 'student_id,marking_period_id' })
      .select()
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** PUT /historical-grades/student/:studentId/marking-periods/:mpId  { grade_level } */
export async function updateStudentMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const { data, error } = await supabase
      .from('student_history_marking_periods')
      .update({ grade_level: req.body?.grade_level || null, updated_at: new Date().toISOString() })
      .eq('student_id', req.params.studentId)
      .eq('marking_period_id', req.params.mpId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ success: false, error: 'Not found' })
    res.json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** DELETE /historical-grades/student/:studentId/marking-periods/:mpId (and the student's grades in it) */
export async function removeStudentMarkingPeriod(req: AuthRequest, res: Response) {
  try {
    const { studentId, mpId } = req.params
    const g = await supabase.from('historical_grades').delete().eq('student_id', studentId).eq('marking_period_id', mpId)
    if (g.error) throw g.error
    const l = await supabase.from('student_history_marking_periods').delete().eq('student_id', studentId).eq('marking_period_id', mpId)
    if (l.error) throw l.error
    res.json({ success: true })
  } catch (err) {
    fail(res, err)
  }
}

/** GET /historical-grades/student/:studentId?marking_period_id= */
export async function listStudentGrades(req: AuthRequest, res: Response) {
  try {
    const mpId = req.query.marking_period_id
    if (typeof mpId !== 'string' || !mpId) return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    const { data, error } = await supabase
      .from('historical_grades')
      .select('id, course_period_id, course_title, grade_letter, grade_percent, gp_scale, unweighted_gp, credit_attempted, credit_earned, comment, class_rank')
      .eq('student_id', req.params.studentId)
      .eq('marking_period_id', mpId)
      .order('created_at')
    if (error) throw error
    res.json({ success: true, data: data ?? [] })
  } catch (err) {
    fail(res, err)
  }
}

/** POST /historical-grades/student/:studentId  { marking_period_id, course_title, ... } (the period must be added to the student first) */
export async function createStudentGrade(req: AuthRequest, res: Response) {
  try {
    const { studentId } = req.params
    const mpId = req.body?.marking_period_id
    const body = pick(req.body ?? {}, GRADE_FIELDS)
    if (typeof mpId !== 'string' || !mpId) return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    if (typeof body.course_title !== 'string' || !body.course_title.trim()) return res.status(400).json({ success: false, error: 'course_title is required' })
    const link = await supabase.from('student_history_marking_periods').select('school_id').eq('student_id', studentId).eq('marking_period_id', mpId).maybeSingle()
    if (link.error) throw link.error
    if (!link.data) return res.status(400).json({ success: false, error: 'Add the marking period to the student first' })
    const { data, error } = await supabase
      .from('historical_grades')
      .insert({ ...body, course_title: body.course_title.trim(), school_id: (link.data as { school_id: string }).school_id, student_id: studentId, marking_period_id: mpId })
      .select()
      .single()
    if (error) throw error
    res.status(201).json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** PUT /historical-grades/:id */
export async function updateGrade(req: AuthRequest, res: Response) {
  try {
    const body = pick(req.body ?? {}, GRADE_FIELDS)
    if ('course_title' in body && (typeof body.course_title !== 'string' || !body.course_title.trim())) return res.status(400).json({ success: false, error: 'course_title is required' })
    const { data, error } = await supabase
      .from('historical_grades')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single()
    if (error) throw error
    res.json({ success: true, data })
  } catch (err) {
    fail(res, err)
  }
}

/** DELETE /historical-grades/:id */
export async function deleteGrade(req: AuthRequest, res: Response) {
  try {
    const { error } = await supabase.from('historical_grades').delete().eq('id', req.params.id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    fail(res, err)
  }
}
