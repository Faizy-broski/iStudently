import { Router } from 'express'
import * as ctrl from '../controllers/withdrawal-analytics.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// GET /api/analytics/withdrawal/cumulative?academicYearId=&granularity=annual|semester&campusId=&semester=1|2
router.get('/cumulative', requireAdmin, ctrl.getCumulative)

// GET /api/analytics/withdrawal/comparison?academicYearIds=id1,id2&granularity=annual&campusId=
router.get('/comparison', requireAdmin, ctrl.getComparison)

// GET /api/analytics/withdrawal/summary?academicYearId=&campusId=
router.get('/summary', requireAdmin, ctrl.getSummary)

export default router
