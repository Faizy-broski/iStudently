import { Request, Response } from 'express'
import { salaryService } from '../services/salary.service'

export class SalaryController {
    // ==========================================
    // PAYROLL SETTINGS
    // ==========================================

    async getPayrollSettings(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const campusId = req.query.campus_id as string | undefined
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const settings = await salaryService.getPayrollSettings(schoolId, campusId ?? null)
            return res.json({ success: true, data: settings })
        } catch (error: any) {
            console.error('Error getting payroll settings:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updatePayrollSettings(req: Request, res: Response) {
        try {
            const schoolId = req.body.school_id as string
            const campusId = req.body.campus_id as string | undefined
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const payload: any = { ...req.body }
            if (campusId) payload.campus_id = campusId
            else payload.campus_id = null

            const settings = await salaryService.upsertPayrollSettings(schoolId, payload)
            return res.json({ success: true, data: settings })
        } catch (error: any) {
            console.error('Error updating payroll settings:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SALARY STRUCTURES
    // ==========================================

    async getSalaryStructures(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const structures = await salaryService.getAllSalaryStructures(schoolId)
            return res.json({ success: true, data: structures })
        } catch (error: any) {
            console.error('Error getting salary structures:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getSalaryStructureByStaff(req: Request, res: Response) {
        try {
            const { staffId } = req.params
            const schoolId = req.query.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const structure = await salaryService.getSalaryStructure(staffId, schoolId)
            return res.json({ success: true, data: structure })
        } catch (error: any) {
            console.error('Error getting salary structure:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createSalaryStructure(req: Request, res: Response) {
        try {
            const { school_id, staff_id, base_salary, allowances, fixed_deductions, effective_from } = req.body

            if (!school_id || !staff_id || !base_salary) {
                return res.status(400).json({ success: false, error: 'school_id, staff_id, and base_salary are required' })
            }

            const structure = await salaryService.createSalaryStructure({
                school_id,
                staff_id,
                base_salary,
                allowances: allowances || {},
                fixed_deductions: fixed_deductions || {},
                effective_from: effective_from || new Date().toISOString().split('T')[0],
                is_current: true
            })

            return res.status(201).json({ success: true, data: structure })
        } catch (error: any) {
            console.error('Error creating salary structure:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STAFF ATTENDANCE
    // ==========================================

    async recordAttendance(req: Request, res: Response) {
        try {
            const { school_id, staff_id, attendance_date, check_in_time, check_out_time, expected_time, status, notes } = req.body

            if (!school_id || !staff_id || !attendance_date) {
                return res.status(400).json({ success: false, error: 'school_id, staff_id, and attendance_date are required' })
            }

            const attendance = await salaryService.recordAttendance({
                school_id,
                staff_id,
                attendance_date,
                check_in_time,
                check_out_time,
                expected_time: expected_time || '08:00',
                late_minutes: 0,
                status: status || 'present',
                notes
            })

            return res.status(201).json({ success: true, data: attendance })
        } catch (error: any) {
            console.error('Error recording attendance:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getMonthlyAttendance(req: Request, res: Response) {
        try {
            const { staffId } = req.params
            const schoolId = req.query.school_id as string
            const month = parseInt(req.query.month as string)
            const year = parseInt(req.query.year as string)

            if (!schoolId || !month || !year) {
                return res.status(400).json({ success: false, error: 'school_id, month, and year are required' })
            }

            const attendance = await salaryService.getMonthlyAttendance(staffId, schoolId, month, year)
            return res.json({ success: true, data: attendance })
        } catch (error: any) {
            console.error('Error getting monthly attendance:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SALARY ADVANCES
    // ==========================================

    async requestAdvance(req: Request, res: Response) {
        try {
            const { school_id, staff_id, amount, reason } = req.body

            if (!school_id || !staff_id || !amount) {
                return res.status(400).json({ success: false, error: 'school_id, staff_id, and amount are required' })
            }

            const advance = await salaryService.requestAdvance(school_id, staff_id, amount, reason)
            return res.status(201).json({ success: true, data: advance })
        } catch (error: any) {
            console.error('Error requesting advance:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getPendingAdvances(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const advances = await salaryService.getPendingAdvances(schoolId)
            return res.json({ success: true, data: advances })
        } catch (error: any) {
            console.error('Error getting pending advances:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async processAdvance(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { school_id, action, admin_id, recovery_month, recovery_year } = req.body

            if (!school_id || !action || !admin_id) {
                return res.status(400).json({ success: false, error: 'school_id, action, and admin_id are required' })
            }

            if (action !== 'approve' && action !== 'reject') {
                return res.status(400).json({ success: false, error: 'action must be approve or reject' })
            }

            const advance = await salaryService.processAdvanceRequest(id, school_id, action, admin_id, recovery_month, recovery_year)
            return res.json({ success: true, data: advance })
        } catch (error: any) {
            console.error('Error processing advance:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SALARY GENERATION
    // ==========================================

    async generateSalary(req: Request, res: Response) {
        try {
            const { school_id, staff_id, month, year } = req.body

            if (!school_id || !staff_id || !month || !year) {
                return res.status(400).json({ success: false, error: 'school_id, staff_id, month, and year are required' })
            }

            const salary = await salaryService.generateMonthlySalary(staff_id, school_id, month, year)
            return res.status(201).json({ success: true, data: salary })
        } catch (error: any) {
            console.error('Error generating salary:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async generateBulkSalaries(req: Request, res: Response) {
        try {
            console.log('📊 Bulk salary generation request received:', {
                body: req.body,
                headers: {
                    authorization: req.headers.authorization?.substring(0, 20) + '...',
                    contentType: req.headers['content-type']
                }
            })

            const { school_id, month, year, campus_id } = req.body

            if (!school_id || !month || !year) {
                console.error('❌ Missing required fields:', { school_id, month, year })
                return res.status(400).json({ success: false, error: 'school_id, month, and year are required' })
            }

            console.log('✅ Starting bulk salary generation:', { school_id, month, year, campus_id })
            const result = await salaryService.generateBulkSalaries(school_id, month, year, campus_id)
            console.log('✅ Bulk salary generation completed:', result)
            return res.json({ success: true, data: result })
        } catch (error: any) {
            console.error('❌ Error generating bulk salaries:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SALARY RECORDS
    // ==========================================

    async getSalaryRecords(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const campus_id = req.query.campus_id as string
            const staff_id = req.query.staff_id as string
            const month = req.query.month ? parseInt(req.query.month as string) : undefined
            const year = req.query.year ? parseInt(req.query.year as string) : undefined
            const status = req.query.status as string
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 20

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const result = await salaryService.getSalaryRecords(schoolId, { month, year, status, page, limit, campus_id, staff_id })

            return res.json({
                success: true,
                data: result.data,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            })
        } catch (error: any) {
            console.error('Error getting salary records:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getPaySlip(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.query.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const payslip = await salaryService.getPaySlip(id, schoolId)
            return res.json({ success: true, data: payslip })
        } catch (error: any) {
            console.error('Error getting pay slip:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async approveSalary(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { school_id } = req.body

            if (!school_id) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const salary = await salaryService.approveSalary(id, school_id)
            return res.json({ success: true, data: salary })
        } catch (error: any) {
            console.error('Error approving salary:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async markSalaryPaid(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { school_id, payment_method, payment_reference } = req.body

            if (!school_id) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const salary = await salaryService.markSalaryPaid(id, school_id, payment_method, payment_reference)
            return res.json({ success: true, data: salary })
        } catch (error: any) {
            console.error('Error marking salary paid:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    async getDashboardStats(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const month = req.query.month ? parseInt(req.query.month as string) : undefined
            const year = req.query.year ? parseInt(req.query.year as string) : undefined

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const stats = await salaryService.getSalaryDashboardStats(schoolId, month, year)
            return res.json({ success: true, data: stats })
        } catch (error: any) {
            console.error('Error getting dashboard stats:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }
}

export const salaryController = new SalaryController()
