import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { AuthRequest } from './auth.middleware'

/**
 * Generic, reusable rate-limit factory — no rate limiting existed anywhere
 * on this platform before the Al-Fina' module's §22 security checklist
 * ("rate limiting on media and on login") called for it, so this is built
 * fresh rather than reused from an existing middleware. In-memory store
 * (express-rate-limit's default): fine for this single-process deployment,
 * but resets on restart and isn't shared across instances if this app is
 * ever horizontally scaled — a documented limitation, not silently assumed
 * away, matching this session's practice of flagging every infra shortcut.
 *
 * "Login" itself has no backend route to rate-limit: this platform's sign-in
 * goes directly from the frontend to Supabase Auth's own signInWithPassword
 * (see frontend/src/app/auth/login/page.tsx) and never touches this Express
 * app, so login brute-force protection is Supabase's own responsibility —
 * out of this codebase's control. Only `/fina/media/*` gets applied here.
 *
 * Keyed by the authenticated caller's profile id (this middleware always
 * runs after `authenticate` on every route it's mounted on in this module),
 * falling back to IP for the rare case no profile is attached — matches the
 * spec's own framing of the limit as "per account", not "per network".
 */
export function createFinaRateLimit(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
      const profileId = (req as AuthRequest).profile?.id
      return profileId ? `profile:${profileId}` : ipKeyGenerator(req.ip || '')
    },
    message: { success: false, error: 'Too many requests. Please try again later.' },
  })
}
