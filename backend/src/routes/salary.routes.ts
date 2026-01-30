import { Router } from 'express'
import { salaryController } from '../controllers/salary.controller'
import { cronService } from '../services/cron.service'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// Payroll Settings
router.get('/settings', (req, res) => salaryController.getPayrollSettings(req, res))
router.put('/settings', (req, res) => salaryController.updatePayrollSettings(req, res))

// Salary Structures
router.get('/structures', (req, res) => salaryController.getSalaryStructures(req, res))
router.get('/structures/:staffId', (req, res) => salaryController.getSalaryStructureByStaff(req, res))
router.post('/structures', (req, res) => salaryController.createSalaryStructure(req, res))

// Staff Attendance
router.post('/attendance', (req, res) => salaryController.recordAttendance(req, res))
router.get('/attendance/:staffId', (req, res) => salaryController.getMonthlyAttendance(req, res))

// Salary Advances
router.post('/advances', (req, res) => salaryController.requestAdvance(req, res))
router.get('/advances/pending', (req, res) => salaryController.getPendingAdvances(req, res))
router.put('/advances/:id', (req, res) => salaryController.processAdvance(req, res))

// Salary Generation
router.post('/generate', (req, res) => salaryController.generateSalary(req, res))
router.post('/generate-bulk', (req, res) => salaryController.generateBulkSalaries(req, res))

// Automated Monthly Generation - Manual Trigger (for testing or retry)
router.post('/automation/trigger', async (req, res) => {
    try {
        const { school_id } = req.body
        const result = await cronService.manualTriggerMonthlySalary(school_id)
        res.json({ success: true, data: result })
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// Salary Records
router.get('/records', (req, res) => salaryController.getSalaryRecords(req, res))
router.get('/records/:id/payslip', (req, res) => salaryController.getPaySlip(req, res))
router.put('/records/:id/approve', (req, res) => salaryController.approveSalary(req, res))
router.put('/records/:id/paid', (req, res) => salaryController.markSalaryPaid(req, res))

// Dashboard
router.get('/dashboard', (req, res) => salaryController.getDashboardStats(req, res))

export default router
