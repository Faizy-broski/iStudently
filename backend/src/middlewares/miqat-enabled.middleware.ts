import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

// Byte-for-byte the same pattern as qirtasi-enabled.middleware.ts /
// hifzi-enabled.middleware.ts — see qirtasi-enabled.middleware.ts's comments
// for the full rationale (campus-row-first lookup, 60s TTL, campus_id
// resolution convention, and the admin-not-pinned-to-one-campus bug those
// two modules already hit and fixed).
const pluginGateCache = new TtlCache<boolean>(60_000)

export async function requireMiqatEnabled(req: AuthRequest, res: Response, next: NextFunction) {
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
      pluginActive = !!campusResult.data?.active_plugins?.miqat || !!schoolResult.data?.active_plugins?.miqat
      pluginGateCache.set(cacheKey, pluginActive)
    }

    if (!pluginActive) {
      return res.status(403).json({ success: false, error: 'The Miqat attendance module is not enabled for this school' })
    }

    return next()
  } catch (err) {
    console.error('requireMiqatEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Miqat module status' })
  }
}
