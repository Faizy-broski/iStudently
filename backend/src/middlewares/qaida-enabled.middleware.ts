import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

const pluginGateCache = new TtlCache<boolean>(60_000)

export async function requireQaidaEnabled(req: AuthRequest, res: Response, next: NextFunction) {
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
      pluginActive = !!campusResult.data?.active_plugins?.qaida || !!schoolResult.data?.active_plugins?.qaida
      pluginGateCache.set(cacheKey, pluginActive)
    }

    if (!pluginActive) {
      return res.status(403).json({ success: false, error: 'The Qaidat Al-Jahabidha module is not enabled for this school' })
    }

    return next()
  } catch (err) {
    console.error('requireQaidaEnabled check failed:', err)
    return res.status(500).json({ success: false, error: 'Failed to verify Qaida module status' })
  }
}
