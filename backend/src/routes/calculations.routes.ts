import { Router } from 'express'
import { CalculationsController } from '../controllers/calculations.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new CalculationsController()


// ---- Calculations ----
router.get('/calculations', authenticate, (req, res) => controller.listCalculations(req, res))
router.get('/calculations/:id', authenticate, (req, res) => controller.getCalculation(req, res))
router.post('/calculations/:id/run', authenticate, (req, res) => controller.runCalculation(req, res))
// run an unsaved formula without creating a calculation record
router.post('/calculations/run', authenticate, (req, res) => controller.runFormula(req, res))
router.post('/calculations', authenticate, requireRole('admin'), (req, res) => controller.createCalculation(req, res))
router.put('/calculations/:id', authenticate, requireRole('admin'), (req, res) => controller.updateCalculation(req, res))
router.delete('/calculations/:id', authenticate, requireRole('admin'), (req, res) => controller.deleteCalculation(req, res))

// ---- Calculation Reports ----
router.get('/calculation-reports', authenticate, (req, res) => controller.listReports(req, res))
router.get('/calculation-reports/:id', authenticate, (req, res) => controller.getReport(req, res))
router.post('/calculation-reports/:id/run', authenticate, (req, res) => controller.runReport(req, res))
router.post('/calculation-reports', authenticate, requireRole('admin'), (req, res) => controller.createReport(req, res))
router.put('/calculation-reports/:id', authenticate, requireRole('admin'), (req, res) => controller.updateReport(req, res))
router.delete('/calculation-reports/:id', authenticate, requireRole('admin'), (req, res) => controller.deleteReport(req, res))

export default router
