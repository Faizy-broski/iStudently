import { Router } from 'express'
import { CalculationsController } from '../controllers/calculations.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new CalculationsController()

router.use(authenticate)

// ---- Calculations ----
router.get('/calculations', (req, res) => controller.listCalculations(req, res))
router.get('/calculations/:id', (req, res) => controller.getCalculation(req, res))
router.post('/calculations/:id/run', (req, res) => controller.runCalculation(req, res))
// run an unsaved formula without creating a calculation record
router.post('/calculations/run', (req, res) => controller.runFormula(req, res))
router.post('/calculations', requireRole('admin'), (req, res) => controller.createCalculation(req, res))
router.put('/calculations/:id', requireRole('admin'), (req, res) => controller.updateCalculation(req, res))
router.delete('/calculations/:id', requireRole('admin'), (req, res) => controller.deleteCalculation(req, res))

// ---- Calculation Reports ----
router.get('/calculation-reports', (req, res) => controller.listReports(req, res))
router.get('/calculation-reports/:id', (req, res) => controller.getReport(req, res))
router.post('/calculation-reports/:id/run', (req, res) => controller.runReport(req, res))
router.post('/calculation-reports', requireRole('admin'), (req, res) => controller.createReport(req, res))
router.put('/calculation-reports/:id', requireRole('admin'), (req, res) => controller.updateReport(req, res))
router.delete('/calculation-reports/:id', requireRole('admin'), (req, res) => controller.deleteReport(req, res))

export default router
