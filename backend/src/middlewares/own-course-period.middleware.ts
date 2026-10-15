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
