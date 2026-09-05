import { Router } from 'express'
import * as ctrl from '../../controllers/quran/reference.controller'
import { authenticate } from '../../middlewares/auth.middleware'

// Tenant-agnostic, read-only — no requireHifziEnabled gate: the reference
// data is shared platform infrastructure, useful even to preview before a
// school turns the Hifzi module on.
const router = Router()
router.use(authenticate)

router.get('/riwayat', ctrl.listRiwayat)
router.get('/surahs', ctrl.listSurahs)
router.get('/editions', ctrl.listEditions)
router.get('/resolve-range', ctrl.resolveRange)
router.get('/ayahs-in-range', ctrl.ayahsInRange)
router.get('/page/:edition/:page/ayat', ctrl.ayatOnPage)
router.get('/similar', ctrl.similarPassages)

export default router
