import { Router } from 'express'
import { feesController } from '../controllers/fees.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireStaff } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Fee Settings
router.get('/settings', requireStaff, (req, res) => feesController.getFeeSettings(req, res))
router.put('/settings', requireAdmin, (req, res) => feesController.updateFeeSettings(req, res))

// Fee Categories
router.get('/categories', requireStaff, (req, res) => feesController.getFeeCategories(req, res))
router.post('/categories', requireAdmin, (req, res) => feesController.createFeeCategory(req, res))
router.put('/categories/:id', requireAdmin, (req, res) => feesController.updateFeeCategory(req, res))
router.delete('/categories/:id', requireAdmin, (req, res) => feesController.deleteFeeCategory(req, res))

// Sibling Discount Tiers
router.get('/sibling-discounts', requireStaff, (req, res) => feesController.getSiblingDiscountTiers(req, res))
router.put('/sibling-discounts', requireAdmin, (req, res) => feesController.updateSiblingDiscountTiers(req, res))

// Fee Structures CRUD
router.get('/structures', requireStaff, (req, res) => feesController.getFeeStructures(req, res))
router.post('/structures', requireAdmin, (req, res) => feesController.createFeeStructure(req, res))
router.put('/structures/:id', requireAdmin, (req, res) => feesController.updateFeeStructure(req, res))
router.delete('/structures/:id', requireAdmin, (req, res) => feesController.deleteFeeStructure(req, res))

// Student Fees
router.get('/students', requireStaff, (req, res) => feesController.getStudentFees(req, res))
router.get('/students/:id', requireStaff, (req, res) => feesController.getStudentFeeById(req, res))

// Student Fee History
router.get('/history/:studentId', requireStaff, (req, res) => feesController.getStudentFeeHistory(req, res))

// Browse Fees by Grade
router.get('/by-grade', requireStaff, (req, res) => feesController.getFeesByGrade(req, res))

// Fee Adjustments (Admin Overrides)
router.put('/:id/adjust', requireAdmin, (req, res) => feesController.adjustFee(req, res))
router.get('/:id/adjustments', requireStaff, (req, res) => feesController.getFeeAdjustments(req, res))

// Payments
router.post('/payments', requireStaff, (req, res) => feesController.recordPayment(req, res))

// Student Payments Module
router.get('/payments/students', requireStaff, (req, res) => feesController.getStudentsForPayments(req, res))
router.get('/payments/all-with-students', requireStaff, (req, res) => feesController.getAllPaymentsWithStudents(req, res))
router.get('/payments/student/:studentId', requireStaff, (req, res) => feesController.getStudentPayments(req, res))
router.post('/payments/record', requireStaff, (req, res) => feesController.recordDirectPayment(req, res))
router.put('/payments/:paymentId', requireAdmin, (req, res) => feesController.updatePayment(req, res))
router.delete('/payments/:paymentId', requireAdmin, (req, res) => feesController.deletePayment(req, res))

// Fee Generation
router.post('/generate', requireAdmin, (req, res) => feesController.generateFee(req, res))
router.post('/generate-for-student', requireAdmin, (req, res) => feesController.generateFeeForNewStudent(req, res))

// Admin Actions
router.post('/students/:id/restore-discount', requireAdmin, (req, res) => feesController.restoreDiscount(req, res))
router.post('/students/:id/waive', requireAdmin, (req, res) => feesController.waiveFee(req, res))

// Dashboard
router.get('/dashboard', requireStaff, (req, res) => feesController.getDashboardStats(req, res))

// Late Fee Automation
router.post('/apply-late-fees', requireAdmin, (req, res) => feesController.applyLateFees(req, res))
// Called by external cron with no user session — gated by CRON_SECRET header check inside the controller
router.post('/cron/apply-late-fees', (req, res) => feesController.applyLateFeesGlobal(req, res))

// Monthly Fee Generation
router.post('/generate-monthly', requireAdmin, (req, res) => feesController.generateMonthlyFees(req, res))
// Called by external cron with no user session — gated by CRON_SECRET header check inside the controller
router.post('/cron/generate-monthly', (req, res) => feesController.generateMonthlyFeesGlobal(req, res))

// Student Fee Overrides (Pre-Generation Custom Fees)
router.get('/overrides', requireAdmin, (req, res) => feesController.getAllSchoolFeeOverrides(req, res))
router.post('/overrides', requireAdmin, (req, res) => feesController.createStudentFeeOverride(req, res))
router.get('/overrides/student/:studentId', requireAdmin, (req, res) => feesController.getStudentFeeOverrides(req, res))
router.put('/overrides/:id', requireAdmin, (req, res) => feesController.updateStudentFeeOverride(req, res))
router.delete('/overrides/:id', requireAdmin, (req, res) => feesController.deleteStudentFeeOverride(req, res))

// Student Self-Service
router.get('/my', (req, res) => feesController.getMyFees(req, res))

export default router
