import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

// Plugin on/off changes only when an admin toggles it: cached 60s (see hifzi-enabled.middleware.ts).
const pluginGateCache = new TtlCache<boolean>(60_000)

/**
 * Gates every Jahbadh grades route behind school_settings.active_plugins.jahbadh_grades (campus row
 * first, then the school-wide row). Same pattern and cache as qirtasi-enabled.middleware.ts.
 */
/** Whether the plugin is on for a school: the campus row first, then the school-wide row. */
export async function jahbadhPluginActive(schoolId: string, campusId: string | null | undefined): Promise<boolean> {
  const cacheKey = `${schoolId}:${campusId ?? ''}`
  let active = pluginGateCache.get(cacheKey)
  if (active === undefined) {
    const [campusResult, schoolResult] = await Promise.all([
      campusId
        ? supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).eq('campus_id', campusId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).is('campus_id', null).maybeSingle(),
    ])
    active = !!campusResult.data?.active_plugins?.jahbadh_grades || !!schoolResult.data?.active_plugins?.jahbadh_grades
    pluginGateCache.set(cacheKey, active)
  }
  return active
}

/**
 * Gates every Jahbadh grades route behind school_settings.active_plugins.jahbadh_grades (campus row
 * first, then the school-wide row). Same pattern and cache as qirtasi-enabled.middleware.ts.
 */
export async function requireJahbadhGradesEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  const schoolId = req.profile?.school_id
  const campusId = (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id
  if (!schoolId) return res.status(401).json({ success: false, error: 'Unauthorized: No school context' })
  try {
    if (!(await jahbadhPluginActive(schoolId, campusId))) {
      return res.status(403).json({ success: false, error: 'The Jahbadh grades module is not enabled for this school' })
    }
    return next()
  } catch (err) {
    console.error('requireJahbadhGradesEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Jahbadh grades module status' })
  }
}

const sessionCampusCache = new TtlCache<{ campus: string | null }>(60_000)
const SESSION_PATH = /^\/sessions\/([0-9a-f-]{36})(?:\/|$)/i

/**
 * Exam control gate: requests inside a session (/sessions/:id/…) carry no campus_id, so the campus
 * comes from the session itself. A session without a campus passes when the plugin is on for the
 * school or for any of its campuses.
 */
export async function requireJahbadhControlEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  const schoolId = req.profile?.school_id
  if (!schoolId) return res.status(401).json({ success: false, error: 'Unauthorized: No school context' })
  try {
    let campusId: string | null | undefined = (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id
    const m = req.path.match(SESSION_PATH)
    let anyCampus = false
    if (!campusId && m) {
      let hit = sessionCampusCache.get(m[1])
      if (!hit) {
        const { data } = await supabase.from('jc_sessions').select('campus_id').eq('id', m[1]).maybeSingle()
        hit = { campus: (data?.campus_id as string | null) ?? null }
        sessionCampusCache.set(m[1], hit)
      }
      campusId = hit.campus
      anyCampus = !hit.campus
    }
    let active = await jahbadhPluginActive(schoolId, campusId)
    if (!active && anyCampus) {
      const { data } = await supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId)
      active = (data ?? []).some((r: any) => !!r.active_plugins?.jahbadh_grades)
    }
    if (!active) return res.status(403).json({ success: false, error: 'The Jahbadh grades module is not enabled for this school' })
    return next()
  } catch (err) {
    console.error('requireJahbadhControlEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Jahbadh grades module status' })
  }
}
