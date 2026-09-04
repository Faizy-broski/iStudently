import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

// Whether Qirtasi is enabled for a (school, campus) pair changes only when an
// admin toggles the module — cached with a short TTL so this check, which
// runs on every Qirtasi request, doesn't cost a Supabase round trip (or two)
// each time. Byte-for-byte the same pattern as hifzi-enabled.middleware.ts —
// see that file's comments for the full rationale (campus-row-first lookup,
// 60s TTL, campus_id resolution convention).
const pluginGateCache = new TtlCache<boolean>(60_000)

/**
 * Gates every Qirtasi route behind school_settings.active_plugins.qirtasi —
 * the entitlements decision for this module (see the plan): a school turns
 * Qirtasi on, everyone in that school gets full access — no per-user paid
 * tiers, matching how Hifzi is gated rather than the spec's original
 * per-individual freemium model (which would need a payment system that
 * doesn't exist in this codebase).
 *
 * campus_id resolution: req.profile.campus_id is only auto-populated for
 * campus-FIXED roles (teacher/student/parent/staff/librarian). Admin is not
 * pinned to one campus — the frontend passes campus_id explicitly per
 * request instead, tied to whichever campus is selected in CampusContext
 * (see every Qirtasi API call in frontend/src/lib/api/{worksheets,
 * qirtasi-curriculum,qirtasi-facets}.ts). Missing this was a real bug: an
 * admin who toggled Qirtasi on for a specific campus got 403'd on every
 * Qirtasi route, because this check only ever looked at the org-wide
 * (campus_id IS NULL) row.
 */
export async function requireQirtasiEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  const schoolId = req.profile?.school_id
  const campusId = (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id

  if (!schoolId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No school context' })
  }

  const cacheKey = `${schoolId}:${campusId ?? ''}`
  try {
    let pluginActive = pluginGateCache.get(cacheKey)
    if (pluginActive === undefined) {
      const [campusResult, schoolResult] = await Promise.all([
        campusId
          ? supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).eq('campus_id', campusId).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).is('campus_id', null).maybeSingle(),
      ])
      pluginActive = !!campusResult.data?.active_plugins?.qirtasi || !!schoolResult.data?.active_plugins?.qirtasi
      pluginGateCache.set(cacheKey, pluginActive)
    }

    if (!pluginActive) {
      return res.status(403).json({ success: false, error: 'The Qirtasi (My Worksheet) module is not enabled for this school' })
    }

    return next()
  } catch (err) {
    console.error('requireQirtasiEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Qirtasi module status' })
  }
}
