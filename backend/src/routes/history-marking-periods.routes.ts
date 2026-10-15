import express from 'express'
import * as controller from '../controllers/historical-grades.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { requireRowInSchoolFamily } from '../middlewares/row-school-scope.middleware'

// Past marking periods used by historical grades (web: /admin/grades/history-marking-periods).
const router = express.Router()
router.use(authenticate, requireAdmin)

const mpRow = requireRowInSchoolFamily('history_marking_periods')

router.get('/', controller.listHistoryMarkingPeriods)
router.post('/', controller.createHistoryMarkingPeriod)
router.put('/:id', mpRow, controller.updateHistoryMarkingPeriod)
router.delete('/:id', mpRow, controller.deleteHistoryMarkingPeriod)

export default router
