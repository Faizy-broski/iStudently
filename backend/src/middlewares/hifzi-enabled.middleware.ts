import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

// Whether Hifzi is enabled for a (school, campus) pair changes only when an
// admin toggles the module — cached with a short TTL so this check, which
// runs on every single Hifzi request, doesn't cost a Supabase round trip
// (or two) each time. No invalidation hook: a ~60s staleness window after a
// toggle is an explicit, acceptable trade-off (see settings.service.ts for
// the equivalent, invalidated cache where staleness isn't acceptable).
const pluginGateCache = new TtlCache<boolean>(60_000)

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

  const cacheKey = `${schoolId}:${campusId ?? ''}`
  try {
    let pluginActive = pluginGateCache.get(cacheKey)
    if (pluginActive === undefined) {
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
      pluginActive = !!campusResult.data?.active_plugins?.hifzi || !!schoolResult.data?.active_plugins?.hifzi
      pluginGateCache.set(cacheKey, pluginActive)
    }

    if (!pluginActive) {
      // Display name only ("School Khalwa") — active_plugins.hifzi, every
      // hifzi_* table, and this module's routes/identifiers are unchanged.
      return res.status(403).json({ success: false, error: 'The School Khalwa module is not enabled for this school' })
    }

    return next()
  } catch (err) {
    console.error('requireHifziEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify School Khalwa module status' })
  }
}
