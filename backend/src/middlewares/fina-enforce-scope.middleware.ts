import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth.middleware'

/**
 * Applied once to the whole /fina router prefix (spec §5 Layer 2/§10/§22):
 * every Al-Fina' response carries the no-indexing headers the spec requires
 * on every single response, and the route is confirmed to sit behind
 * `authenticate` (registered before this in the router chain — this
 * middleware does not itself authenticate, `authenticate` already ran).
 * A dedicated file (not folded into role.middleware.ts) because this is a
 * response-shaping concern applied blanket across the module, not a
 * per-route role check.
 */
export function finaEnforceScope(req: AuthRequest, res: Response, next: NextFunction) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, noimageindex')
  res.setHeader('Cache-Control', 'private, no-store')

  if (!req.profile) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  return next()
}
