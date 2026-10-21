import { NextFunction, Response } from 'express'

import { supabase } from '../config/supabase'
import { AuthRequest } from './auth.middleware'

type Ids = unknown | Promise<unknown>
const toIds = (v: unknown): string[] =>
  [...new Set((Array.isArray(v) ? v : [v]).flat().filter((x): x is string => typeof x === 'string' && x.length > 0))]

/**
 * Teachers may only work on course periods they teach (course_periods.teacher_id or
 * secondary_teacher_id = their staff id). Admins and super admins pass; ids that resolve to
 * nothing are left to the handler's own validation. `pick` may be async (to read a row's period).
 */
export function requireOwnCoursePeriods(pick: (req: AuthRequest) => Ids) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role !== 'teacher') return next()
    try {
      const ids = toIds(await pick(req))
      if (!ids.length) return next()
      const staffId = (req.profile as { staff_id?: string | null }).staff_id
      if (!staffId) return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
      const { data, error } = await supabase.from('course_periods').select('id, teacher_id, secondary_teacher_id').in('id', ids)
      if (error) throw error
      const rows = (data ?? []) as { id: string; teacher_id: string | null; secondary_teacher_id: string | null }[]
      if (rows.length !== ids.length || rows.some((r) => r.teacher_id !== staffId && r.secondary_teacher_id !== staffId)) {
        return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
      }
      return next()
    } catch (err) {
      console.error('Course period ownership check failed:', err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}

/** The course period of a row (e.g. a gradebook assignment) addressed by id. */
export async function coursePeriodOf(table: string, id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null
  const { data } = await supabase.from(table).select('course_period_id').eq('id', id).maybeSingle()
  return (data as { course_period_id?: string | null } | null)?.course_period_id ?? null
}

/** Teachers may only read their own staff record's data (query `staff_id`). */
export function requireOwnStaffQuery(param = 'staff_id') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role !== 'teacher') return next()
    const v = req.query[param]
    if (typeof v === 'string' && v && v !== (req.profile as { staff_id?: string | null }).staff_id) {
      return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
    }
    return next()
  }
}

/**
 * Teachers may only take class attendance for their own classes: a timetable entry is theirs when
 * `timetable_entries.teacher_id` is their staff id; a section is theirs when they have a timetable
 * entry or a course period (primary or secondary) in it. Admins and super admins pass; a missing
 * id is left to the handler's own validation. Pair with `requireRowInSchoolFamily` for the school check.
 */
export function requireOwnClass(kind: 'entry' | 'section', pick: (req: AuthRequest) => Ids) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role !== 'teacher') return next()
    try {
      const id = toIds(await pick(req))[0]
      if (!id) return next()
      const staffId = (req.profile as { staff_id?: string | null }).staff_id
      let owns = false
      if (staffId && kind === 'entry') {
        const { data, error } = await supabase.from('timetable_entries').select('teacher_id').eq('id', id).maybeSingle()
        if (error) throw error
        owns = !data || (data as { teacher_id: string | null }).teacher_id === staffId
      } else if (staffId) {
        const [tt, cp] = await Promise.all([
          supabase.from('timetable_entries').select('id', { count: 'exact', head: true }).eq('section_id', id).eq('teacher_id', staffId),
          supabase.from('course_periods').select('id', { count: 'exact', head: true }).eq('section_id', id).or(`teacher_id.eq.${staffId},secondary_teacher_id.eq.${staffId}`),
        ])
        if (tt.error) throw tt.error
        if (cp.error) throw cp.error
        owns = (tt.count ?? 0) > 0 || (cp.count ?? 0) > 0
      }
      if (!owns) return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
      return next()
    } catch (err) {
      console.error('Class ownership check failed:', err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}

/** The timetable entry of an attendance record addressed by id. */
export async function timetableEntryOfAttendance(id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null
  const { data } = await supabase.from('attendance_records').select('timetable_entry_id').eq('id', id).maybeSingle()
  return (data as { timetable_entry_id?: string | null } | null)?.timetable_entry_id ?? null
}

/**
 * Teachers may only act as themselves: a `teacher_id` given in the query or body must be their own
 * staff id (admins may name any teacher). A missing value is left to the handler's own validation.
 */
export function requireSelfTeacherId(from: 'query' | 'body', field = 'teacher_id') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role !== 'teacher') return next()
    const v = (from === 'query' ? req.query : req.body ?? {})[field]
    const staffId = (req.profile as { staff_id?: string | null }).staff_id
    if (typeof v === 'string' && v && v !== staffId) {
      return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
    }
    return next()
  }
}

/**
 * Teachers may only act on rows they own: `select` must return the owner's staff id as
 * `teacher_id`, either as a column or through an embedded parent (e.g.
 * 'assignment:assignments!inner(teacher_id)'). Admins and super admins pass; missing rows are
 * left to the handler (pair with `requireRowInSchoolFamily` for the school check).
 */
export function requireOwnRow(table: string, param = 'id', from: 'params' | 'query' | 'body' = 'params', select = 'teacher_id') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role !== 'teacher') return next()
    const raw = from === 'params' ? req.params[param] : (from === 'query' ? req.query : req.body ?? {})[param]
    if (typeof raw !== 'string' || !raw) return next()
    try {
      const { data, error } = await supabase.from(table).select(select).eq('id', raw).maybeSingle()
      if (error) throw error
      if (!data) return next()
      const row = data as unknown as Record<string, any>
      const owner: string | null | undefined = 'teacher_id' in row ? row.teacher_id : Object.values(row).find((v) => v && typeof v === 'object' && 'teacher_id' in v)?.teacher_id
      if (!owner || owner !== (req.profile as { staff_id?: string | null }).staff_id) {
        return res.status(403).json({ success: false, error: 'You can only manage your own classes' })
      }
      return next()
    } catch (err) {
      console.error(`Ownership check failed (${table}):`, err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}
