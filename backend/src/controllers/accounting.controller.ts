import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { accountingService } from '../services/accounting.service'
import { salaryService } from '../services/salary.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { parseMoney } from '../utils/money'

/**
 * Resolves the campus_id to use for a request: always trusts req.profile.school_id
 * (the caller's own school/campus) for non-super-admins. A client-supplied campus_id
 * is only honored after verifying (via validateCampusAccess) that it actually belongs
 * to the caller's school — closing the cross-tenant IDOR the audit found on every
 * handler in this controller. super_admin may target any campus_id directly.
 */
async function resolveCampusId(
    req: AuthRequest,
    requestedCampusId?: string | null
): Promise<{ campusId: string | null; error?: string; status?: number }> {
    const profileSchoolId = req.profile?.school_id ?? null
    const role = req.profile?.role

    if (role === 'super_admin') {
        return { campusId: requestedCampusId || profileSchoolId }
    }

    if (!profileSchoolId) {
        return { campusId: null, error: 'Not authenticated', status: 403 }
    }

    if (!requestedCampusId || requestedCampusId === profileSchoolId) {
        return { campusId: profileSchoolId }
    }

    const hasAccess = await validateCampusAccess(profileSchoolId, requestedCampusId)
    if (!hasAccess) {
        return { campusId: null, error: 'Forbidden: campus does not belong to your school', status: 403 }
    }

    return { campusId: requestedCampusId }
}

/** Logs the full error server-side but never leaks raw driver/DB error text to the client. */
function handleError(res: Response, context: string, error: any, status = 500) {
    console.error(context, error)
    return res.status(status).json({ success: false, error: status === 500 ? 'Internal server error' : (error?.message || 'Request failed') })
}

export class AccountingController {
    // ==========================================
    // CATEGORIES
    // ==========================================

    async getCategories(req: AuthRequest, res: Response) {
        try {
            const type = req.query.type as 'incomes' | 'expenses' | 'common' | undefined
            const activeOnly = req.query.active !== 'false'
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const categories = await accountingService.getCategories(campusId, type, activeOnly)
            return res.json({ success: true, data: categories })
        } catch (error: any) {
            return handleError(res, 'Error getting accounting categories:', error)
        }
    }

    async createCategory(req: AuthRequest, res: Response) {
        try {
            const { name, category_type, description, display_order } = req.body
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !name || !category_type) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, name, and category_type are required'
                })
            }

            if (!['incomes', 'expenses', 'common'].includes(category_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'category_type must be one of: incomes, expenses, common'
                })
            }

            const category = await accountingService.createCategory({
                campus_id,
                name,
                category_type,
                description,
                display_order
            })

            return res.status(201).json({ success: true, data: category })
        } catch (error: any) {
            return handleError(res, 'Error creating accounting category:', error)
        }
    }

    async updateCategory(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const category = await accountingService.updateCategory(id, campusId, req.body)
            return res.json({ success: true, data: category })
        } catch (error: any) {
            return handleError(res, 'Error updating accounting category:', error)
        }
    }

    async deleteCategory(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deleteCategory(id, campusId)
            return res.json({ success: true, message: 'Category deleted' })
        } catch (error: any) {
            // deleteCategory throws a friendly validation error when the category is still referenced
            return handleError(res, 'Error deleting accounting category:', error, error?.message?.startsWith('Cannot delete') ? 400 : 500)
        }
    }

    // ==========================================
    // INCOMES
    // ==========================================

    async getIncomes(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const incomes = await accountingService.getIncomes(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: incomes })
        } catch (error: any) {
            return handleError(res, 'Error getting incomes:', error)
        }
    }

    async createIncome(req: AuthRequest, res: Response) {
        try {
            const { academic_year, title, category_id, amount, income_date, comments, file_attached } = req.body
            const userId = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !academic_year || !title || amount === undefined || !income_date) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, academic_year, title, amount, and income_date are required'
                })
            }

            const parsedAmount = parseMoney(amount)

            const income = await accountingService.createIncome({
                campus_id,
                academic_year,
                title,
                category_id,
                amount: parsedAmount,
                income_date,
                comments,
                file_attached,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: income })
        } catch (error: any) {
            return handleError(res, 'Error creating income:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async updateIncome(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const income = await accountingService.updateIncome(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseMoney(req.body.amount) : undefined
            })
            return res.json({ success: true, data: income })
        } catch (error: any) {
            return handleError(res, 'Error updating income:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async deleteIncome(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deleteIncome(id, campusId)
            return res.json({ success: true, message: 'Income deleted' })
        } catch (error: any) {
            return handleError(res, 'Error deleting income:', error)
        }
    }

    // ==========================================
    // EXPENSES
    // ==========================================

    async getExpenses(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const expenses = await accountingService.getExpenses(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: expenses })
        } catch (error: any) {
            return handleError(res, 'Error getting expenses:', error)
        }
    }

    async createExpense(req: AuthRequest, res: Response) {
        try {
            const { academic_year, title, category_id, amount, payment_date, comments, file_attached } = req.body
            const userId = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !academic_year || !title || amount === undefined || !payment_date) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, academic_year, title, amount, and payment_date are required'
                })
            }

            const parsedAmount = parseMoney(amount)

            const expense = await accountingService.createExpense({
                campus_id,
                academic_year,
                title,
                category_id,
                amount: parsedAmount,
                payment_date,
                comments,
                file_attached,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: expense })
        } catch (error: any) {
            return handleError(res, 'Error creating expense:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async updateExpense(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const expense = await accountingService.updateExpense(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseMoney(req.body.amount) : undefined
            })
            return res.json({ success: true, data: expense })
        } catch (error: any) {
            return handleError(res, 'Error updating expense:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async deleteExpense(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deleteExpense(id, campusId)
            return res.json({ success: true, message: 'Expense deleted' })
        } catch (error: any) {
            return handleError(res, 'Error deleting expense:', error)
        }
    }

    // ==========================================
    // STAFF PAYMENTS
    // ==========================================

    async getStaffPayments(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const payments = await accountingService.getStaffPayments(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            return handleError(res, 'Error getting staff payments:', error)
        }
    }

    async getStaffPaymentsByStaff(req: AuthRequest, res: Response) {
        try {
            const { staffId } = req.params
            const academicYear = req.query.academic_year as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payments = await accountingService.getStaffPaymentsByStaff(campusId, staffId, academicYear)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            return handleError(res, 'Error getting staff payments by staff:', error)
        }
    }

    async createStaffPayment(req: AuthRequest, res: Response) {
        try {
            const { academic_year, staff_id, title, category_id, amount, payment_date, comments, file_attached, receipt_number, payment_method } = req.body
            const userId = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !academic_year || !staff_id || !title || amount === undefined || !payment_date) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, academic_year, staff_id, title, amount, and payment_date are required'
                })
            }

            const parsedAmount = parseMoney(amount)

            const payment = await accountingService.createStaffPayment({
                campus_id,
                academic_year,
                staff_id,
                title,
                category_id,
                amount: parsedAmount,
                payment_date,
                comments,
                file_attached,
                receipt_number,
                payment_method,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            return handleError(res, 'Error creating staff payment:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async updateStaffPayment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payment = await accountingService.updateStaffPayment(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseMoney(req.body.amount) : undefined
            })
            return res.json({ success: true, data: payment })
        } catch (error: any) {
            return handleError(res, 'Error updating staff payment:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async deleteStaffPayment(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deleteStaffPayment(id, campusId)
            return res.json({ success: true, message: 'Staff payment deleted' })
        } catch (error: any) {
            return handleError(res, 'Error deleting staff payment:', error)
        }
    }

    // ==========================================
    // TOTALS / REPORTS
    // ==========================================

    async getTotals(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const totals = await accountingService.getTotals(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: totals })
        } catch (error: any) {
            return handleError(res, 'Error getting totals:', error)
        }
    }

    async getDailyTransactions(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const date = req.query.date as string
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear || !date) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, academic_year, and date are required'
                })
            }

            const transactions = await accountingService.getDailyTransactions(campusId, academicYear, date)
            return res.json({ success: true, data: transactions })
        } catch (error: any) {
            return handleError(res, 'Error getting daily transactions:', error)
        }
    }

    async getStaffBalances(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const balances = await accountingService.getStaffBalances(campusId, academicYear)
            return res.json({ success: true, data: balances })
        } catch (error: any) {
            return handleError(res, 'Error getting staff balances:', error)
        }
    }

    /**
     * Minimum-viable P&L-shaped report: category-level income/expense rollup for a date range.
     * GET /api/accounting/reports/category-rollup
     */
    async getCategoryRollup(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const rollup = await accountingService.getCategoryRollup(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: rollup })
        } catch (error: any) {
            return handleError(res, 'Error getting category rollup:', error)
        }
    }

    // ==========================================
    // SALARIES
    // ==========================================

    async getSalaries(req: AuthRequest, res: Response) {
        try {
            const academicYear = req.query.academic_year as string
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const salaries = await accountingService.getSalaries(campusId, academicYear)
            return res.json({ success: true, data: salaries })
        } catch (error: any) {
            return handleError(res, 'Error getting salaries:', error)
        }
    }

    async getSalariesByStaff(req: AuthRequest, res: Response) {
        try {
            const staffId = req.params.staffId
            const academicYear = req.query.academic_year as string | undefined
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const salaries = await accountingService.getSalariesByStaff(campusId, staffId, academicYear)
            return res.json({ success: true, data: salaries })
        } catch (error: any) {
            return handleError(res, 'Error getting staff salaries:', error)
        }
    }

    async createSalary(req: AuthRequest, res: Response) {
        try {
            const { academic_year, staff_id, title, amount, assigned_date, due_date, comments, file_attached } = req.body
            const createdBy = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !academic_year || !staff_id || !title || amount === undefined) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, academic_year, staff_id, title, and amount are required'
                })
            }

            const parsedAmount = parseMoney(amount)

            const salary = await accountingService.createSalary({
                campus_id,
                academic_year,
                staff_id,
                title,
                amount: parsedAmount,
                assigned_date: assigned_date || new Date().toISOString().split('T')[0],
                due_date,
                comments,
                file_attached,
                created_by: createdBy
            })
            return res.status(201).json({ success: true, data: salary })
        } catch (error: any) {
            return handleError(res, 'Error creating salary:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async updateSalary(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { title, amount, assigned_date, due_date, comments, file_attached } = req.body
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const salary = await accountingService.updateSalary(id, campus_id, {
                title,
                amount: amount !== undefined ? parseMoney(amount) : undefined,
                assigned_date,
                due_date,
                comments,
                file_attached
            })
            return res.json({ success: true, data: salary })
        } catch (error: any) {
            return handleError(res, 'Error updating salary:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async deleteSalary(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deleteSalary(id, campusId)
            return res.json({ success: true, message: 'Salary deleted successfully' })
        } catch (error: any) {
            return handleError(res, 'Error deleting salary:', error)
        }
    }

    async getStaffSalaryTotals(req: AuthRequest, res: Response) {
        try {
            const staffId = req.params.staffId
            const academicYear = req.query.academic_year as string
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !academicYear) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and academic_year are required'
                })
            }

            const totals = await accountingService.getStaffSalaryTotals(campusId, staffId, academicYear)
            return res.json({ success: true, data: totals })
        } catch (error: any) {
            return handleError(res, 'Error getting staff salary totals:', error)
        }
    }

    // ==========================================
    // TEACHER HOURS
    // ==========================================

    async getTeachersList(req: AuthRequest, res: Response) {
        try {
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const teachers = await accountingService.getTeachersWithHours(campusId)
            return res.json({ success: true, data: teachers })
        } catch (error: any) {
            return handleError(res, 'Error getting teachers list:', error)
        }
    }

    async getTeacherHoursDetail(req: AuthRequest, res: Response) {
        try {
            const teacherId = req.params.teacherId
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string
            const academicYearId = req.query.academic_year_id as string
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId || !startDate || !endDate || !academicYearId) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, start_date, end_date, and academic_year_id are required'
                })
            }

            const hours = await accountingService.getTeacherHoursDetail(
                campusId,
                teacherId,
                startDate,
                endDate,
                academicYearId
            )
            return res.json({ success: true, data: hours })
        } catch (error: any) {
            return handleError(res, 'Error getting teacher hours detail:', error)
        }
    }

    async updateTeacherHourlyRates(req: AuthRequest, res: Response) {
        try {
            const teacherId = req.params.teacherId
            const { rates } = req.body
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !rates || !Array.isArray(rates)) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and rates array are required'
                })
            }

            await accountingService.updateTeacherHourlyRates(campus_id, teacherId, rates)
            return res.json({ success: true, message: 'Hourly rates updated successfully' })
        } catch (error: any) {
            return handleError(res, 'Error updating teacher hourly rates:', error)
        }
    }

    // ==========================================
    // PAYEES
    // ==========================================

    async getPayees(req: AuthRequest, res: Response) {
        try {
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payees = await accountingService.getPayees(campusId)
            return res.json({ success: true, data: payees })
        } catch (error: any) {
            return handleError(res, 'Error getting payees:', error)
        }
    }

    async getPayeeById(req: AuthRequest, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payee = await accountingService.getPayeeById(campusId, payeeId)
            return res.json({ success: true, data: payee })
        } catch (error: any) {
            return handleError(res, 'Error getting payee:', error)
        }
    }

    async createPayee(req: AuthRequest, res: Response) {
        try {
            const { campus_id: _ignored, ...payeeData } = req.body
            const creatorId = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !payeeData.name) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id and name are required'
                })
            }

            const payee = await accountingService.createPayee(campus_id, payeeData, creatorId)
            return res.status(201).json({ success: true, data: payee })
        } catch (error: any) {
            return handleError(res, 'Error creating payee:', error)
        }
    }

    async updatePayee(req: AuthRequest, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campus_id: _ignored, ...payeeData } = req.body
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payee = await accountingService.updatePayee(campus_id, payeeId, payeeData)
            return res.json({ success: true, data: payee })
        } catch (error: any) {
            return handleError(res, 'Error updating payee:', error)
        }
    }

    async deletePayee(req: AuthRequest, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deletePayee(campusId, payeeId)
            return res.json({ success: true, message: 'Payee deleted successfully' })
        } catch (error: any) {
            return handleError(res, 'Error deleting payee:', error)
        }
    }

    async getPayeePayments(req: AuthRequest, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            const payments = await accountingService.getPayeePayments(campusId, payeeId)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            return handleError(res, 'Error getting payee payments:', error)
        }
    }

    async createPayeePayment(req: AuthRequest, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campus_id: _ignored, ...paymentData } = req.body
            const creatorId = req.profile?.id
            const { campusId: campus_id, error, status } = await resolveCampusId(req, req.body.campus_id as string)

            if (!campus_id || !paymentData.amount || !paymentData.payment_date) {
                return res.status(status || 400).json({
                    success: false,
                    error: error || 'campus_id, amount, and payment_date are required'
                })
            }

            const payment = await accountingService.createPayeePayment(
                campus_id,
                { ...paymentData, amount: parseMoney(paymentData.amount), payee_id: payeeId },
                creatorId
            )
            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            return handleError(res, 'Error creating payee payment:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    async deletePayeePayment(req: AuthRequest, res: Response) {
        try {
            const paymentId = req.params.paymentId
            const { campusId, error, status } = await resolveCampusId(req, req.query.campus_id as string)

            if (!campusId) {
                return res.status(status || 400).json({ success: false, error: error || 'campus_id is required' })
            }

            await accountingService.deletePayeePayment(campusId, paymentId)
            return res.json({ success: true, message: 'Payee payment deleted successfully' })
        } catch (error: any) {
            return handleError(res, 'Error deleting payee payment:', error)
        }
    }

    // ==========================================
    // ZERO-TRUST STAFF ROUTES (Teachers)
    // ==========================================
    async getTeacherOwnSalaries(req: AuthRequest, res: Response) {
        try {
            const profile = req.profile
            if (!profile?.staff_id) return res.status(403).json({ success: false, error: 'Valid staff context required' })

            // Self-service: campus is always the caller's own, never client-supplied
            const campusId = profile.campus_id || profile.school_id
            const academicYear = req.query.academic_year as string | undefined

            const salaries = await accountingService.getSalariesByStaff(campusId as string, profile.staff_id, academicYear)
            return res.json({ success: true, data: salaries })
        } catch (error: any) {
            return handleError(res, 'Error getting own salaries:', error)
        }
    }

    async getTeacherOwnPayments(req: AuthRequest, res: Response) {
        try {
            const profile = req.profile
            if (!profile?.staff_id) return res.status(403).json({ success: false, error: 'Valid staff context required' })

            // Self-service: campus is always the caller's own, never client-supplied
            const campusId = profile.campus_id || profile.school_id
            const academicYear = req.query.academic_year as string | undefined

            const payments = await accountingService.getStaffPaymentsByStaff(campusId as string, profile.staff_id, academicYear)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            return handleError(res, 'Error getting own payments:', error)
        }
    }

    /**
     * Self-service payslip breakdown for the logged-in staff/teacher, for a given month/year.
     * Reuses salaryService.getPaySlipByPeriod (normally admin-only via /api/salary) with the
     * identity forced from req.profile — never from client input.
     */
    async getTeacherOwnPayslip(req: AuthRequest, res: Response) {
        try {
            const profile = req.profile
            if (!profile?.staff_id) return res.status(403).json({ success: false, error: 'Valid staff context required' })

            const campusId = (profile.campus_id || profile.school_id) as string
            const month = parseInt(req.query.month as string, 10)
            const year = parseInt(req.query.year as string, 10)

            if (!month || !year) {
                return res.status(400).json({ success: false, error: 'month and year are required' })
            }

            const payslip = await salaryService.getPaySlipByPeriod(profile.staff_id, month, year, campusId)
            return res.json({ success: true, data: payslip })
        } catch (error: any) {
            return handleError(res, 'Error getting own payslip:', error, error?.statusCode === 404 ? 404 : 500)
        }
    }

    /**
     * Self-service salary advance request for the logged-in staff/teacher.
     * Reuses salaryService.requestAdvance (normally admin-only via /api/salary) with the
     * identity forced from req.profile — never from client input.
     */
    async requestMyAdvance(req: AuthRequest, res: Response) {
        try {
            const profile = req.profile
            if (!profile?.staff_id) return res.status(403).json({ success: false, error: 'Valid staff context required' })

            const campusId = (profile.campus_id || profile.school_id) as string
            const { amount, reason } = req.body

            if (amount === undefined) {
                return res.status(400).json({ success: false, error: 'amount is required' })
            }

            const parsedAmount = parseMoney(amount)
            const advance = await salaryService.requestAdvance(campusId, profile.staff_id, parsedAmount, reason)
            return res.status(201).json({ success: true, data: advance })
        } catch (error: any) {
            return handleError(res, 'Error requesting advance:', error, error?.message?.startsWith('Invalid') ? 400 : 500)
        }
    }

    /**
     * Self-service hourly-pay breakdown for the logged-in staff/teacher, for a given date range.
     * Reuses accountingService.getTeacherHoursDetail (normally admin-only) with the identity
     * forced from req.profile — never from client input.
     */
    async getTeacherOwnHours(req: AuthRequest, res: Response) {
        try {
            const profile = req.profile
            if (!profile?.staff_id) return res.status(403).json({ success: false, error: 'Valid staff context required' })

            const campusId = (profile.campus_id || profile.school_id) as string
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string
            const academicYearId = req.query.academic_year_id as string

            if (!startDate || !endDate || !academicYearId) {
                return res.status(400).json({ success: false, error: 'start_date, end_date, and academic_year_id are required' })
            }

            const hours = await accountingService.getTeacherHoursDetail(campusId, profile.staff_id, startDate, endDate, academicYearId)
            return res.json({ success: true, data: hours })
        } catch (error: any) {
            return handleError(res, 'Error getting own hours:', error)
        }
    }
}

export const accountingController = new AccountingController()
