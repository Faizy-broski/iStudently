import { NextFunction, Response } from 'express'

import { supabase } from '../config/supabase'
import { campusIdsAllowed } from '../utils/campus-validation'
import { AuthRequest } from './auth.middleware'

/**
 * For routes that act on a row by id (no school_id in the request): load the row's school and
 * require it to be in the caller's school family. `select` must return `school_id`, either as a
 * column or through an embedded parent (e.g. 'automatic_records!inner(school_id)'). Super admins
 * may act on any school. Responds 404 for missing rows and rows of other schools alike.
 * `from` reads the id from the query or body instead of the route params; there a missing
 * value is left to the handler's own validation.
 */
export function requireRowInSchoolFamily(table: string, param = 'id', select = 'school_id', from: 'params' | 'query' | 'body' = 'params') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role === 'super_admin') return next()
    const raw = from === 'params' ? req.params[param] : (from === 'query' ? req.query : req.body ?? {})[param]
    const id = typeof raw === 'string' ? raw : undefined
    if (!id && from !== 'params') return next()
    try {
      const { data, error } = await supabase.from(table).select(select).eq('id', id).maybeSingle()
      if (error) throw error
      const row = data as Record<string, any> | null
      const schoolId: string | undefined = row?.school_id ?? (row ? Object.values(row).find((v) => v && typeof v === 'object' && 'school_id' in v)?.school_id : undefined)
      if (!schoolId || !(await campusIdsAllowed(req.profile?.school_id, [schoolId]))) {
        return res.status(404).json({ success: false, error: 'Not found' })
      }
      return next()
    } catch (err) {
      console.error(`Row scope check failed (${table}):`, err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}

/**
 * Body variant for one id or a list of ids (e.g. `student_ids` on bulk enroll): every id given must
 * be a row of the caller's school family. Absent fields are left to the handler's own validation.
 */
/** `column` is the row's school column (`campus_id` for campus-keyed tables such as accounting_categories). */
export function requireBodyRowsInSchoolFamily(table: string, field: string | ((body: any) => unknown), column = 'school_id') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.profile?.role === 'super_admin') return next()
    const raw = typeof field === 'function' ? field(req.body ?? {}) : (req.body ?? {})[field]
    const ids = [...new Set((Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === 'string' && v.length > 0))]
    if (!ids.length) return next()
    try {
      const { data, error } = await supabase.from(table).select(`id, ${column}`).in('id', ids)
      if (error) throw error
      const rows = ((data ?? []) as unknown as Record<string, string | null>[]).map((r) => ({ id: r.id, school_id: r[column] }))
      const schools = [...new Set(rows.map((r) => r.school_id).filter((s): s is string => !!s))]
      if (rows.length !== ids.length || rows.some((r) => !r.school_id) || !(await campusIdsAllowed(req.profile?.school_id, schools))) {
        return res.status(404).json({ success: false, error: 'Not found' })
      }
      return next()
    } catch (err) {
      console.error(`Row scope check failed (${table}):`, err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}

/**
 * Routes that return one student's data by id: the student must be in the caller's school family;
 * a student may only read their own record and a parent only a linked child's. Staff roles pass
 * once the family check holds.
 */
export function requireStudentAccess(param = 'studentId') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.profile?.role
    if (role === 'super_admin') return next()
    const id = req.params[param]
    try {
      const { data, error } = await supabase.from('students').select('id, school_id, profile_id').eq('id', id).maybeSingle()
      if (error) throw error
      const row = data as { id: string; school_id: string | null; profile_id: string | null } | null
      const notFound = () => res.status(404).json({ success: false, error: 'Not found' })
      if (!row?.school_id || !(await campusIdsAllowed(req.profile?.school_id, [row.school_id]))) return notFound()
      if (role === 'student') return row.id === req.profile?.student_id || row.profile_id === req.profile?.id ? next() : notFound()
      if (role === 'parent') {
        const { data: link } = await supabase
          .from('parent_student_links')
          .select('id, parent:parents!inner(profile_id)')
          .eq('student_id', row.id)
          .eq('is_active', true)
          .eq('parent.profile_id', req.profile?.id)
          .maybeSingle()
        return link ? next() : notFound()
      }
      return next()
    } catch (err) {
      console.error('Student access check failed:', err)
      return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
    }
  }
}

/**
 * `school_id` / `campus_id` given in the query or body (when present) must be the caller's school or one
 * of its campuses: for routers whose handlers take these as-is (quiz, exams).
 */
export async function requireRequestSchoolsInFamily(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.profile?.role === 'super_admin') return next()
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const ids = [...new Set([req.query.school_id, req.query.campus_id, body.school_id, body.campus_id].filter((v): v is string => typeof v === 'string' && v.length > 0))]
  if (!ids.length) return next()
  try {
    if (!(await campusIdsAllowed(req.profile?.school_id, ids))) return res.status(404).json({ success: false, error: 'Not found' })
    return next()
  } catch (err) {
    console.error('School scope check failed:', err)
    return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
  }
}
