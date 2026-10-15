import type { NextFunction, Request, Response } from 'express'

import { canViewStudent } from '../utils/student-access'
import type { AuthRequest } from './auth.middleware'

type PickStudent = (req: Request) => unknown

/**
 * Students may only address themselves and parents only their linked children (canViewStudent).
 * Other roles pass: the row-school-scope middleware already limits them to their school family.
 * With `required`, a student or parent must name a student (e.g. a list filtered by student_id).
 */
export function requireOwnStudent(pick: PickStudent, opts: { required?: boolean } = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const role = (req as AuthRequest).profile?.role
    if (role !== 'student' && role !== 'parent') return next()
    const id = pick(req)
    if (typeof id !== 'string' || !id) {
      if (!opts.required) return next()
      return res.status(403).json({ success: false, error: 'Access denied' })
    }
    if (await canViewStudent(req as AuthRequest, id)) return next()
    return res.status(403).json({ success: false, error: 'Access denied' })
  }
}

/**
 * Students and parents may run a report for their own record(s) only: every id from `pick` must be
 * one they can view (the student themselves, a linked child). Every other role goes through `others`
 * (e.g. requireAdmin), unchanged.
 */
export function ownStudentsOr(others: (req: Request, res: Response, next: NextFunction) => unknown, pick: (req: Request) => unknown) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const role = (req as AuthRequest).profile?.role
    if (role !== 'student' && role !== 'parent') return others(req, res, next)
    const raw = pick(req)
    const ids = Array.isArray(raw) ? raw : [raw]
    if (!ids.length || ids.some((id) => typeof id !== 'string' || !id)) return res.status(403).json({ success: false, error: 'Access denied' })
    for (const id of ids as string[]) {
      if (!(await canViewStudent(req as AuthRequest, id))) return res.status(403).json({ success: false, error: 'Access denied' })
    }
    return next()
  }
}
