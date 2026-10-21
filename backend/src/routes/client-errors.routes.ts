import { Router, Request, Response } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

/**
 * POST /api/client-errors: crash and error reports from the mobile app (until a hosted crash
 * service is chosen). Public on purpose: a crash can happen before or during sign-in. Nothing is
 * stored; each report is one structured line in the server log, with every field length-capped and
 * per-IP rate limiting so the endpoint cannot be used to flood the logs.
 */
const router = Router()

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  message: { success: false, error: 'Too many reports', code: 'RATE_LIMITED' },
})

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)

router.post('/', limiter, (req: Request, res: Response) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {}
  const message = str(b.message, 1000)
  if (!message) return res.status(400).json({ success: false, error: 'message is required' })
  const report = {
    message,
    name: str(b.name, 200),
    stack: str(b.stack, 4000),
    fatal: b.fatal === true,
    context: str(b.context, 200),
    route: str(b.route, 300),
    app_version: str(b.app_version, 40),
    build: str(b.build, 40),
    platform: str(b.platform, 20),
    os_version: str(b.os_version, 40),
    // Who the app says was signed in: for triage only, not trusted.
    profile_id: str(b.profile_id, 64),
    role: str(b.role, 40),
    // Reference shown to the user on the error screen ("Error ref: STU-1234"), to find this report.
    ref: str(b.ref, 20),
    at: new Date().toISOString(),
  }
  console.error(`[client-error] ${JSON.stringify(report)}`)
  return res.status(202).json({ success: true })
})

export default router
