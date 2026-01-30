import { Router } from 'express'
import { feesController } from '../controllers/fees.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireTeacher, requireStaff } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Fee Settings
router.get('/settings', (req, res) => feesController.getFeeSettings(req, res))
router.put('/settings', (req, res) => feesController.updateFeeSettings(req, res))

// Fee Categories
router.get('/categories', (req, res) => feesController.getFeeCategories(req, res))
router.post('/categories', (req, res) => feesController.createFeeCategory(req, res))
router.put('/categories/:id', (req, res) => feesController.updateFeeCategory(req, res))
router.delete('/categories/:id', (req, res) => feesController.deleteFeeCategory(req, res))

// Sibling Discount Tiers
router.get('/sibling-discounts', (req, res) => feesController.getSiblingDiscountTiers(req, res))
router.put('/sibling-discounts', (req, res) => feesController.updateSiblingDiscountTiers(req, res))

// Fee Structures CRUD
router.get('/structures', (req, res) => feesController.getFeeStructures(req, res))
router.post('/structures', (req, res) => feesController.createFeeStructure(req, res))
router.put('/structures/:id', (req, res) => feesController.updateFeeStructure(req, res))
router.delete('/structures/:id', (req, res) => feesController.deleteFeeStructure(req, res))

// Student Fees
router.get('/students', (req, res) => feesController.getStudentFees(req, res))
router.get('/students/:id', (req, res) => feesController.getStudentFeeById(req, res))

// Student Fee History
router.get('/history/:studentId', (req, res) => feesController.getStudentFeeHistory(req, res))

// Browse Fees by Grade
router.get('/by-grade', (req, res) => feesController.getFeesByGrade(req, res))

// Fee Adjustments (Admin Overrides)
router.put('/:id/adjust', (req, res) => feesController.adjustFee(req, res))
router.get('/:id/adjustments', (req, res) => feesController.getFeeAdjustments(req, res))

// Payments
router.post('/payments', (req, res) => feesController.recordPayment(req, res))

// Fee Generation
router.post('/generate', (req, res) => feesController.generateFee(req, res))
router.post('/generate-for-student', (req, res) => feesController.generateFeeForNewStudent(req, res))

// Admin Actions
router.post('/students/:id/restore-discount', (req, res) => feesController.restoreDiscount(req, res))
router.post('/students/:id/waive', (req, res) => feesController.waiveFee(req, res))

// Dashboard
router.get('/dashboard', (req, res) => feesController.getDashboardStats(req, res))

// Late Fee Automation
router.post('/apply-late-fees', (req, res) => feesController.applyLateFees(req, res))
router.post('/cron/apply-late-fees', (req, res) => feesController.applyLateFeesGlobal(req, res))

// Monthly Fee Generation
router.post('/generate-monthly', (req, res) => feesController.generateMonthlyFees(req, res))
router.post('/cron/generate-monthly', (req, res) => feesController.generateMonthlyFeesGlobal(req, res))

// Student Self-Service
router.get('/my', (req, res) => feesController.getMyFees(req, res))

export default router
