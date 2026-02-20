import { Request, Response } from 'express'
import { accountingService } from '../services/accounting.service'

export class AccountingController {
    // ==========================================
    // CATEGORIES
    // ==========================================

    async getCategories(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const type = req.query.type as 'incomes' | 'expenses' | 'common' | undefined
            const activeOnly = req.query.active !== 'false'

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const categories = await accountingService.getCategories(campusId, type, activeOnly)
            return res.json({ success: true, data: categories })
        } catch (error: any) {
            console.error('Error getting accounting categories:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createCategory(req: Request, res: Response) {
        try {
            const { campus_id, name, category_type, description, display_order } = req.body

            if (!campus_id || !name || !category_type) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, name, and category_type are required' 
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
            console.error('Error creating accounting category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.body.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const category = await accountingService.updateCategory(id, campusId, req.body)
            return res.json({ success: true, data: category })
        } catch (error: any) {
            console.error('Error updating accounting category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deleteCategory(id, campusId)
            return res.json({ success: true, message: 'Category deleted' })
        } catch (error: any) {
            console.error('Error deleting accounting category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // INCOMES
    // ==========================================

    async getIncomes(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const incomes = await accountingService.getIncomes(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: incomes })
        } catch (error: any) {
            console.error('Error getting incomes:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createIncome(req: Request, res: Response) {
        try {
            const { campus_id, academic_year, title, category_id, amount, income_date, comments, file_attached } = req.body
            // @ts-ignore - user is attached by auth middleware
            const userId = req.user?.id

            if (!campus_id || !academic_year || !title || amount === undefined || !income_date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, academic_year, title, amount, and income_date are required' 
                })
            }

            const income = await accountingService.createIncome({
                campus_id,
                academic_year,
                title,
                category_id,
                amount: parseFloat(amount),
                income_date,
                comments,
                file_attached,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: income })
        } catch (error: any) {
            console.error('Error creating income:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateIncome(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.body.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const income = await accountingService.updateIncome(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined
            })
            return res.json({ success: true, data: income })
        } catch (error: any) {
            console.error('Error updating income:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteIncome(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deleteIncome(id, campusId)
            return res.json({ success: true, message: 'Income deleted' })
        } catch (error: any) {
            console.error('Error deleting income:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // EXPENSES
    // ==========================================

    async getExpenses(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const expenses = await accountingService.getExpenses(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: expenses })
        } catch (error: any) {
            console.error('Error getting expenses:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createExpense(req: Request, res: Response) {
        try {
            const { campus_id, academic_year, title, category_id, amount, payment_date, comments, file_attached } = req.body
            // @ts-ignore
            const userId = req.user?.id

            if (!campus_id || !academic_year || !title || amount === undefined || !payment_date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, academic_year, title, amount, and payment_date are required' 
                })
            }

            const expense = await accountingService.createExpense({
                campus_id,
                academic_year,
                title,
                category_id,
                amount: parseFloat(amount),
                payment_date,
                comments,
                file_attached,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: expense })
        } catch (error: any) {
            console.error('Error creating expense:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateExpense(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.body.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const expense = await accountingService.updateExpense(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined
            })
            return res.json({ success: true, data: expense })
        } catch (error: any) {
            console.error('Error updating expense:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteExpense(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deleteExpense(id, campusId)
            return res.json({ success: true, message: 'Expense deleted' })
        } catch (error: any) {
            console.error('Error deleting expense:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STAFF PAYMENTS
    // ==========================================

    async getStaffPayments(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const payments = await accountingService.getStaffPayments(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            console.error('Error getting staff payments:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getStaffPaymentsByStaff(req: Request, res: Response) {
        try {
            const { staffId } = req.params
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string | undefined

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payments = await accountingService.getStaffPaymentsByStaff(campusId, staffId, academicYear)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            console.error('Error getting staff payments by staff:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createStaffPayment(req: Request, res: Response) {
        try {
            const { campus_id, academic_year, staff_id, title, category_id, amount, payment_date, comments, file_attached, receipt_number } = req.body
            // @ts-ignore
            const userId = req.user?.id

            if (!campus_id || !academic_year || !staff_id || !title || amount === undefined || !payment_date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, academic_year, staff_id, title, amount, and payment_date are required' 
                })
            }

            const payment = await accountingService.createStaffPayment({
                campus_id,
                academic_year,
                staff_id,
                title,
                category_id,
                amount: parseFloat(amount),
                payment_date,
                comments,
                file_attached,
                receipt_number,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error creating staff payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateStaffPayment(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.body.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payment = await accountingService.updateStaffPayment(id, campusId, {
                ...req.body,
                amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : undefined
            })
            return res.json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error updating staff payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteStaffPayment(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deleteStaffPayment(id, campusId)
            return res.json({ success: true, message: 'Staff payment deleted' })
        } catch (error: any) {
            console.error('Error deleting staff payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // TOTALS / REPORTS
    // ==========================================

    async getTotals(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string
            const startDate = req.query.start_date as string | undefined
            const endDate = req.query.end_date as string | undefined

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const totals = await accountingService.getTotals(campusId, academicYear, startDate, endDate)
            return res.json({ success: true, data: totals })
        } catch (error: any) {
            console.error('Error getting totals:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getDailyTransactions(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string
            const date = req.query.date as string

            if (!campusId || !academicYear || !date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, academic_year, and date are required' 
                })
            }

            const transactions = await accountingService.getDailyTransactions(campusId, academicYear, date)
            return res.json({ success: true, data: transactions })
        } catch (error: any) {
            console.error('Error getting daily transactions:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getStaffBalances(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const balances = await accountingService.getStaffBalances(campusId, academicYear)
            return res.json({ success: true, data: balances })
        } catch (error: any) {
            console.error('Error getting staff balances:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SALARIES
    // ==========================================

    async getSalaries(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const salaries = await accountingService.getSalaries(campusId, academicYear)
            return res.json({ success: true, data: salaries })
        } catch (error: any) {
            console.error('Error getting salaries:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getSalariesByStaff(req: Request, res: Response) {
        try {
            const staffId = req.params.staffId
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string | undefined

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const salaries = await accountingService.getSalariesByStaff(campusId, staffId, academicYear)
            return res.json({ success: true, data: salaries })
        } catch (error: any) {
            console.error('Error getting staff salaries:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createSalary(req: Request, res: Response) {
        try {
            const { campus_id, academic_year, staff_id, title, amount, assigned_date, due_date, comments, file_attached } = req.body
            const createdBy = (req as any).profile?.id

            if (!campus_id || !academic_year || !staff_id || !title || amount === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, academic_year, staff_id, title, and amount are required' 
                })
            }

            const salary = await accountingService.createSalary({
                campus_id,
                academic_year,
                staff_id,
                title,
                amount: parseFloat(amount),
                assigned_date: assigned_date || new Date().toISOString().split('T')[0],
                due_date,
                comments,
                file_attached,
                created_by: createdBy
            })
            return res.status(201).json({ success: true, data: salary })
        } catch (error: any) {
            console.error('Error creating salary:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateSalary(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { campus_id, title, amount, assigned_date, due_date, comments, file_attached } = req.body

            if (!campus_id) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const salary = await accountingService.updateSalary(id, campus_id, {
                title,
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                assigned_date,
                due_date,
                comments,
                file_attached
            })
            return res.json({ success: true, data: salary })
        } catch (error: any) {
            console.error('Error updating salary:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteSalary(req: Request, res: Response) {
        try {
            const { id } = req.params
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deleteSalary(id, campusId)
            return res.json({ success: true, message: 'Salary deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting salary:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getStaffSalaryTotals(req: Request, res: Response) {
        try {
            const staffId = req.params.staffId
            const campusId = req.query.campus_id as string
            const academicYear = req.query.academic_year as string

            if (!campusId || !academicYear) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and academic_year are required' 
                })
            }

            const totals = await accountingService.getStaffSalaryTotals(campusId, staffId, academicYear)
            return res.json({ success: true, data: totals })
        } catch (error: any) {
            console.error('Error getting staff salary totals:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // TEACHER HOURS
    // ==========================================

    async getTeachersList(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const teachers = await accountingService.getTeachersWithHours(campusId)
            return res.json({ success: true, data: teachers })
        } catch (error: any) {
            console.error('Error getting teachers list:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getTeacherHoursDetail(req: Request, res: Response) {
        try {
            const teacherId = req.params.teacherId
            const campusId = req.query.campus_id as string
            const startDate = req.query.start_date as string
            const endDate = req.query.end_date as string
            const academicYearId = req.query.academic_year_id as string

            if (!campusId || !startDate || !endDate || !academicYearId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, start_date, end_date, and academic_year_id are required' 
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
            console.error('Error getting teacher hours detail:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateTeacherHourlyRates(req: Request, res: Response) {
        try {
            const teacherId = req.params.teacherId
            const { campus_id, rates } = req.body

            if (!campus_id || !rates || !Array.isArray(rates)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and rates array are required' 
                })
            }

            await accountingService.updateTeacherHourlyRates(campus_id, teacherId, rates)
            return res.json({ success: true, message: 'Hourly rates updated successfully' })
        } catch (error: any) {
            console.error('Error updating teacher hourly rates:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // PAYEES
    // ==========================================

    async getPayees(req: Request, res: Response) {
        try {
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payees = await accountingService.getPayees(campusId)
            return res.json({ success: true, data: payees })
        } catch (error: any) {
            console.error('Error getting payees:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getPayeeById(req: Request, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payee = await accountingService.getPayeeById(campusId, payeeId)
            return res.json({ success: true, data: payee })
        } catch (error: any) {
            console.error('Error getting payee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createPayee(req: Request, res: Response) {
        try {
            const { campus_id, ...payeeData } = req.body
            const creatorId = (req as any).user?.id

            if (!campus_id || !payeeData.name) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id and name are required' 
                })
            }

            const payee = await accountingService.createPayee(campus_id, payeeData, creatorId)
            return res.status(201).json({ success: true, data: payee })
        } catch (error: any) {
            console.error('Error creating payee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updatePayee(req: Request, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campus_id, ...payeeData } = req.body

            if (!campus_id) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payee = await accountingService.updatePayee(campus_id, payeeId, payeeData)
            return res.json({ success: true, data: payee })
        } catch (error: any) {
            console.error('Error updating payee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deletePayee(req: Request, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deletePayee(campusId, payeeId)
            return res.json({ success: true, message: 'Payee deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting payee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getPayeePayments(req: Request, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            const payments = await accountingService.getPayeePayments(campusId, payeeId)
            return res.json({ success: true, data: payments })
        } catch (error: any) {
            console.error('Error getting payee payments:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createPayeePayment(req: Request, res: Response) {
        try {
            const payeeId = req.params.payeeId
            const { campus_id, ...paymentData } = req.body
            const creatorId = (req as any).user?.id

            if (!campus_id || !paymentData.amount || !paymentData.payment_date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'campus_id, amount, and payment_date are required' 
                })
            }

            const payment = await accountingService.createPayeePayment(
                campus_id, 
                { ...paymentData, payee_id: payeeId }, 
                creatorId
            )
            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error creating payee payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deletePayeePayment(req: Request, res: Response) {
        try {
            const paymentId = req.params.paymentId
            const campusId = req.query.campus_id as string

            if (!campusId) {
                return res.status(400).json({ success: false, error: 'campus_id is required' })
            }

            await accountingService.deletePayeePayment(campusId, paymentId)
            return res.json({ success: true, message: 'Payment deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting payee payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }
}

export const accountingController = new AccountingController()
