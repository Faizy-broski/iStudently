import { Router } from 'express'
import { accountingController } from '../controllers/accounting.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin, requireStaff } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ==========================================
// CATEGORIES
// ==========================================
router.get('/categories', requireAdmin, (req, res) => accountingController.getCategories(req, res))
router.post('/categories', requireAdmin, (req, res) => accountingController.createCategory(req, res))
router.put('/categories/:id', requireAdmin, (req, res) => accountingController.updateCategory(req, res))
router.delete('/categories/:id', requireAdmin, (req, res) => accountingController.deleteCategory(req, res))

// ==========================================
// INCOMES
// ==========================================
router.get('/incomes', requireAdmin, (req, res) => accountingController.getIncomes(req, res))
router.post('/incomes', requireAdmin, (req, res) => accountingController.createIncome(req, res))
router.put('/incomes/:id', requireAdmin, (req, res) => accountingController.updateIncome(req, res))
router.delete('/incomes/:id', requireAdmin, (req, res) => accountingController.deleteIncome(req, res))

// ==========================================
// EXPENSES (General - staff_id IS NULL)
// ==========================================
router.get('/expenses', requireAdmin, (req, res) => accountingController.getExpenses(req, res))
router.post('/expenses', requireAdmin, (req, res) => accountingController.createExpense(req, res))
router.put('/expenses/:id', requireAdmin, (req, res) => accountingController.updateExpense(req, res))
router.delete('/expenses/:id', requireAdmin, (req, res) => accountingController.deleteExpense(req, res))

// ==========================================
// STAFF PAYMENTS
// ==========================================
router.get('/staff-payments', requireAdmin, (req, res) => accountingController.getStaffPayments(req, res))
router.get('/staff-payments/:staffId', requireAdmin, (req, res) => accountingController.getStaffPaymentsByStaff(req, res))
router.post('/staff-payments', requireAdmin, (req, res) => accountingController.createStaffPayment(req, res))
router.put('/staff-payments/:id', requireAdmin, (req, res) => accountingController.updateStaffPayment(req, res))
router.delete('/staff-payments/:id', requireAdmin, (req, res) => accountingController.deleteStaffPayment(req, res))

// ==========================================
// TOTALS / REPORTS
// ==========================================
router.get('/totals', requireAdmin, (req, res) => accountingController.getTotals(req, res))
router.get('/daily-transactions', requireAdmin, (req, res) => accountingController.getDailyTransactions(req, res))
router.get('/staff-balances', requireAdmin, (req, res) => accountingController.getStaffBalances(req, res))
router.get('/reports/category-rollup', requireAdmin, (req, res) => accountingController.getCategoryRollup(req, res))

// ==========================================
// TEACHER HOURS
// ==========================================
router.get('/teacher-hours', requireAdmin, (req, res) => accountingController.getTeachersList(req, res))
router.get('/teacher-hours/:teacherId', requireAdmin, (req, res) => accountingController.getTeacherHoursDetail(req, res))
router.put('/teacher-hours/:teacherId/rates', requireAdmin, (req, res) => accountingController.updateTeacherHourlyRates(req, res))

// ==========================================
// PAYEES
// ==========================================
router.get('/payees', requireAdmin, (req, res) => accountingController.getPayees(req, res))
router.get('/payees/:payeeId', requireAdmin, (req, res) => accountingController.getPayeeById(req, res))
router.post('/payees', requireAdmin, (req, res) => accountingController.createPayee(req, res))
router.put('/payees/:payeeId', requireAdmin, (req, res) => accountingController.updatePayee(req, res))
router.delete('/payees/:payeeId', requireAdmin, (req, res) => accountingController.deletePayee(req, res))

// Payee Payments
router.get('/payees/:payeeId/payments', requireAdmin, (req, res) => accountingController.getPayeePayments(req, res))
router.post('/payees/:payeeId/payments', requireAdmin, (req, res) => accountingController.createPayeePayment(req, res))
router.delete('/payee-payments/:paymentId', requireAdmin, (req, res) => accountingController.deletePayeePayment(req, res))

// NOTE: Salaries are managed via the main /api/salary module with cron job auto-generation
// Use /api/salary/records endpoints for salary management

// ==========================================
// ZERO-TRUST STAFF ROUTES
// ==========================================
router.get('/staff/salaries', requireStaff, (req, res) => accountingController.getTeacherOwnSalaries(req, res))
router.get('/staff/payments', requireStaff, (req, res) => accountingController.getTeacherOwnPayments(req, res))
router.get('/staff/payslip', requireStaff, (req, res) => accountingController.getTeacherOwnPayslip(req, res))
router.post('/staff/advances', requireStaff, (req, res) => accountingController.requestMyAdvance(req, res))
router.get('/staff/hours', requireStaff, (req, res) => accountingController.getTeacherOwnHours(req, res))

export default router
