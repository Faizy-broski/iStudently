import type { NextFunction, Request, Response } from 'express'

import { supabase } from '../config/supabase'
import { parentChildSectionIds } from '../utils/parent-access'
import { canViewStudent } from '../utils/student-access'
import type { AuthRequest } from './auth.middleware'

/**
 * Guards for section-level reads that parents used to reach for ANY section of the school family.
 * Every guard only acts on role 'parent'; students, teachers, admins and the rest pass unchanged
 * (the row-school-scope middleware still limits them to their school family).
 */
const isParent = (req: Request) => (req as AuthRequest).profile?.role === 'parent'
const unavailable = (res: Response, err: unknown) => {
  console.error('Parent section check failed:', err)
  return res.status(503).json({ success: false, retryable: true, error: 'Could not verify access' })
}

/** A parent may address only their actively linked children (e.g. GET /courses/student/:studentId). */
export function parentOwnChild(pick: (req: Request) => unknown) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isParent(req)) return next()
    try {
      const id = pick(req)
      if (typeof id === 'string' && id && (await canViewStudent(req as AuthRequest, id))) return next()
      return res.status(403).json({ success: false, error: 'Access denied' })
    } catch (err) {
      return unavailable(res, err)
    }
  }
}

/**
 * List filtered by `?section_id=`: a parent's section must be one of their children's. With none
 * given, a parent whose children all sit in one section gets it forced; otherwise they must name one.
 */
export function parentOwnSectionQuery(param = 'section_id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isParent(req)) return next()
    try {
      const sections = await parentChildSectionIds((req as AuthRequest).profile!.id)
      const asked = req.query[param]
      if (typeof asked === 'string' && asked) {
        return sections.includes(asked) ? next() : res.status(403).json({ success: false, error: 'Access denied' })
      }
      if (sections.length === 1) {
        req.query[param] = sections[0]
        return next()
      }
      return res.status(sections.length ? 400 : 403).json({ success: false, error: sections.length ? `${param} is required` : 'Access denied' })
    } catch (err) {
      return unavailable(res, err)
    }
  }
}

/** A single row addressed by `:id` whose `section_id` must be one of the parent's children's sections (404 otherwise). */
export function parentOwnSectionRow(table: 'class_diary_entries' | 'learning_resources', idParam = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isParent(req)) return next()
    try {
      const sections = await parentChildSectionIds((req as AuthRequest).profile!.id)
      const { data, error } = await supabase.from(table).select('section_id').eq('id', req.params[idParam]).maybeSingle()
      if (error) throw error
      if (!data?.section_id || !sections.includes(data.section_id as string)) return res.status(404).json({ success: false, error: 'Not found' })
      return next()
    } catch (err) {
      return unavailable(res, err)
    }
  }
}
