import { Router } from 'express'

import { jahbadhInsightController as i } from '../controllers/jahbadh-insight.controller'
import { createProfileRateLimit } from '../middlewares/rate-limit.middleware'

/**
 * Public report-card verification (brief B6-39): the QR on a printed Jahbadh card opens
 * /verify-report-card/:code on the web, which calls this. No sign-in; per-IP rate limit; it returns
 * only the summary printed on the card and whether it still matches the current marks.
 */
const router = Router()

router.get('/:code', createProfileRateLimit(15 * 60 * 1000, 60), i.publicVerify)

export default router
