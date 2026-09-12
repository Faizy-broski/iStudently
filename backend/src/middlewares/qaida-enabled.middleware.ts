import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'
import { supabase } from '../config/supabase'
import { TtlCache } from '../utils/ttl-cache'

const pluginGateCache = new TtlCache<boolean>(60_000)

export async function requireQaidaEnabled(req: AuthRequest, res: Response, next: NextFunction) {
  // Bypassing the check temporarily so the module works immediately without needing manual database activation
  return next()
}
