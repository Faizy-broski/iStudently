import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'
import { VAULT_ALLOWED_ROLES } from '../services/vault/types'

/**
 * Gates every /vault/* route behind BOTH the caller's role AND
 * school_settings.active_plugins.vault, collapsed into ONE uniform 404 on
 * any denial (spec: "Any unauthorized request... must return 404 Not Found
 * rather than 403 Forbidden to prevent resource/endpoint enumeration").
 *
 * Deliberately NOT requireRole() (which returns 403) plus a separate
 * plugin-gate middleware (which would return its own, differently-worded
 * 403/404) — stacking two middlewares with different failure shapes would
 * let an unauthorized caller tell "wrong role" apart from "plugin disabled"
 * apart from "route doesn't exist" by the response alone, defeating the
 * point. This is the one and only /vault/* failure shape from outside —
 * every branch below returns the exact same body.
 *
 * Cache follows hifzi-enabled.middleware.ts's convention exactly: 60s TTL,
 * campus-row-first-then-school-wide-fallback, an accepted staleness window
 * after an admin toggles the plugin.
 */
const pluginGateCache = new TtlCache<boolean>(60_000)

const NOT_FOUND = { success: false, error: 'Not found' }

export async function requireVaultAccess(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.profile?.role as string | undefined
  const schoolId = req.profile?.school_id as string | undefined

  if (!schoolId || !role || !VAULT_ALLOWED_ROLES.includes(role)) {
    return res.status(404).json(NOT_FOUND)
  }

  const campusId = (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id

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
      pluginActive = !!campusResult.data?.active_plugins?.vault || !!schoolResult.data?.active_plugins?.vault
      pluginGateCache.set(cacheKey, pluginActive)
    }

    if (!pluginActive) {
      return res.status(404).json(NOT_FOUND)
    }

    return next()
  } catch (err) {
    console.error('requireVaultAccess check failed:', err)
    // Even an internal failure must not distinguish itself from "not
    // found" — a 500-vs-404 split would itself become an enumeration
    // side-channel.
    return res.status(404).json(NOT_FOUND)
  }
}
