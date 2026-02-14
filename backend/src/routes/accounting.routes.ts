import { Router } from 'express'
import { accountingController } from '../controllers/accounting.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ==========================================
// CATEGORIES
// ==========================================
router.get('/categories', (req, res) => accountingController.getCategories(req, res))
router.post('/categories', (req, res) => accountingController.createCategory(req, res))
router.put('/categories/:id', (req, res) => accountingController.updateCategory(req, res))
router.delete('/categories/:id', (req, res) => accountingController.deleteCategory(req, res))

// ==========================================
// INCOMES
// ==========================================
router.get('/incomes', (req, res) => accountingController.getIncomes(req, res))
router.post('/incomes', (req, res) => accountingController.createIncome(req, res))
router.put('/incomes/:id', (req, res) => accountingController.updateIncome(req, res))
router.delete('/incomes/:id', (req, res) => accountingController.deleteIncome(req, res))

// ==========================================
// EXPENSES (General - staff_id IS NULL)
// ==========================================
router.get('/expenses', (req, res) => accountingController.getExpenses(req, res))
router.post('/expenses', (req, res) => accountingController.createExpense(req, res))
router.put('/expenses/:id', (req, res) => accountingController.updateExpense(req, res))
router.delete('/expenses/:id', (req, res) => accountingController.deleteExpense(req, res))

// ==========================================
// STAFF PAYMENTS
// ==========================================
router.get('/staff-payments', (req, res) => accountingController.getStaffPayments(req, res))
router.get('/staff-payments/:staffId', (req, res) => accountingController.getStaffPaymentsByStaff(req, res))
router.post('/staff-payments', (req, res) => accountingController.createStaffPayment(req, res))
router.put('/staff-payments/:id', (req, res) => accountingController.updateStaffPayment(req, res))
router.delete('/staff-payments/:id', (req, res) => accountingController.deleteStaffPayment(req, res))

// ==========================================
// TOTALS / REPORTS
// ==========================================
router.get('/totals', (req, res) => accountingController.getTotals(req, res))
router.get('/daily-transactions', (req, res) => accountingController.getDailyTransactions(req, res))
router.get('/staff-balances', (req, res) => accountingController.getStaffBalances(req, res))

// ==========================================
// TEACHER HOURS
// ==========================================
router.get('/teacher-hours', (req, res) => accountingController.getTeachersList(req, res))
router.get('/teacher-hours/:teacherId', (req, res) => accountingController.getTeacherHoursDetail(req, res))
router.put('/teacher-hours/:teacherId/rates', (req, res) => accountingController.updateTeacherHourlyRates(req, res))

// ==========================================
// PAYEES
// ==========================================
router.get('/payees', (req, res) => accountingController.getPayees(req, res))
router.get('/payees/:payeeId', (req, res) => accountingController.getPayeeById(req, res))
router.post('/payees', (req, res) => accountingController.createPayee(req, res))
router.put('/payees/:payeeId', (req, res) => accountingController.updatePayee(req, res))
router.delete('/payees/:payeeId', (req, res) => accountingController.deletePayee(req, res))

// Payee Payments
router.get('/payees/:payeeId/payments', (req, res) => accountingController.getPayeePayments(req, res))
router.post('/payees/:payeeId/payments', (req, res) => accountingController.createPayeePayment(req, res))
router.delete('/payee-payments/:paymentId', (req, res) => accountingController.deletePayeePayment(req, res))

// NOTE: Salaries are managed via the main /api/salary module with cron job auto-generation
// Use /api/salary/records endpoints for salary management

export default router
