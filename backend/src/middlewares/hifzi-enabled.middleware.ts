import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'

/**
 * Gates every Hifzi route behind school_settings.active_plugins.hifzi —
 * the existing module-toggle mechanism used by every other optional module
 * (discipline_score, calendar_schedule_view, icalendar, public_pages, ...).
 * Checks the campus-level row first, falling back to the school-wide
 * (campus_id IS NULL) default, matching discipline-score.service.ts's
 * two-step lookup exactly.
 *
 * campus_id resolution: req.profile.campus_id is only auto-populated for
 * campus-FIXED roles (teacher/student/parent/staff/librarian). Admin (and
 * super_admin/media_officer) are not pinned to one campus — they pass
 * campus_id explicitly per-request instead, tied to whichever campus is
 * selected in the frontend's CampusContext, exactly like every other
 * plugin-gated controller in this codebase (see e.g.
 * discipline.controller.ts's `req.query.campus_id as string | undefined`).
 * Missing this was the actual cause of a real bug: an admin who toggled
 * Hifzi on for a specific campus got 403'd on every Hifzi route, because
 * this check only ever looked at the org-wide (campus_id IS NULL) row.
 */
export async function requireHifziEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  const schoolId = req.profile?.school_id
  const campusId = (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id

  if (!schoolId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No school context' })
  }

  try {
    // Both rows are independent reads (campus-level override vs. the
    // school-wide default) — fetching them concurrently instead of
    // sequentially (campus check, then only-if-that-missed school check)
    // saves one full round trip per request. Each round trip to this
    // project's Supabase instance measured ~150-500ms, so on a
    // request path already chained through several middleware checks,
    // this is a real, cheap win.
    const [campusResult, schoolResult] = await Promise.all([
      campusId
        ? supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).eq('campus_id', campusId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).is('campus_id', null).maybeSingle(),
    ])
    const pluginActive = !!campusResult.data?.active_plugins?.hifzi || !!schoolResult.data?.active_plugins?.hifzi

    if (!pluginActive) {
      return res.status(403).json({ success: false, error: 'The Hifzi module is not enabled for this school' })
    }

    return next()
  } catch (err) {
    console.error('requireHifziEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Hifzi module status' })
  }
}
