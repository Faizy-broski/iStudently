import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { feesService } from '../services/fees.service'

export class FeesController {
    // ==========================================
    // FEE SETTINGS
    // ==========================================

    async getFeeSettings(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const settings = await feesService.getFeeSettings(schoolId)
            return res.json({ success: true, data: settings })
        } catch (error: any) {
            console.error('Error getting fee settings:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateFeeSettings(req: Request, res: Response) {
        try {
            const schoolId = req.body.school_id as string
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const settings = await feesService.upsertFeeSettings(schoolId, req.body)
            return res.json({ success: true, data: settings })
        } catch (error: any) {
            console.error('Error updating fee settings:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // FEE CATEGORIES
    // ==========================================

    async getFeeCategories(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const activeOnly = req.query.active !== 'false'

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const categories = await feesService.getFeeCategories(schoolId, activeOnly)
            return res.json({ success: true, data: categories })
        } catch (error: any) {
            console.error('Error getting fee categories:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createFeeCategory(req: Request, res: Response) {
        try {
            const { school_id, name, code, description, is_mandatory, is_discountable, display_order } = req.body

            if (!school_id || !name || !code) {
                return res.status(400).json({ success: false, error: 'school_id, name, and code are required' })
            }

            const category = await feesService.createFeeCategory({
                school_id,
                name,
                code,
                description,
                is_mandatory,
                is_discountable,
                display_order
            })

            return res.status(201).json({ success: true, data: category })
        } catch (error: any) {
            console.error('Error creating fee category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateFeeCategory(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.body.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const category = await feesService.updateFeeCategory(id, schoolId, req.body)
            return res.json({ success: true, data: category })
        } catch (error: any) {
            console.error('Error updating fee category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteFeeCategory(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.query.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            await feesService.deleteFeeCategory(id, schoolId)
            return res.json({ success: true, message: 'Category deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting fee category:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // FEE STRUCTURES
    // ==========================================

    async getFeeStructures(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const academicYear = req.query.academic_year as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const structures = await feesService.getFeeStructures(schoolId, academicYear)
            return res.json({ success: true, data: structures })
        } catch (error: any) {
            console.error('Error getting fee structures:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async createFeeStructure(req: Request, res: Response) {
        try {
            const { school_id, academic_year, grade_level_id, fee_category_id, period_type, amount, due_date } = req.body

            if (!school_id || !academic_year || !grade_level_id || !fee_category_id || !amount || !due_date) {
                return res.status(400).json({
                    success: false,
                    error: 'school_id, academic_year, grade_level_id, fee_category_id, amount, and due_date are required'
                })
            }

            const structure = await feesService.createFeeStructure(req.body)
            return res.status(201).json({ success: true, data: structure })
        } catch (error: any) {
            console.error('Error creating fee structure:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateFeeStructure(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.body.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const structure = await feesService.updateFeeStructure(id, schoolId, req.body)
            return res.json({ success: true, data: structure })
        } catch (error: any) {
            console.error('Error updating fee structure:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async deleteFeeStructure(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.query.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            await feesService.deleteFeeStructure(id, schoolId)
            return res.json({ success: true, message: 'Fee structure deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting fee structure:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // SIBLING DISCOUNT TIERS
    // ==========================================

    async getSiblingDiscountTiers(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const tiers = await feesService.getSiblingDiscountTiers(schoolId)
            return res.json({ success: true, data: tiers })
        } catch (error: any) {
            console.error('Error getting sibling discount tiers:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async updateSiblingDiscountTiers(req: Request, res: Response) {
        try {
            const { school_id, tiers } = req.body

            if (!school_id || !Array.isArray(tiers)) {
                return res.status(400).json({ success: false, error: 'school_id and tiers array are required' })
            }

            const updated = await feesService.upsertSiblingDiscountTiers(school_id, tiers)
            return res.json({ success: true, data: updated })
        } catch (error: any) {
            console.error('Error updating sibling discount tiers:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STUDENT FEES
    // ==========================================

    async getStudentFees(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const studentId = req.query.student_id as string
            const academicYear = req.query.academic_year as string
            const status = req.query.status as string
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 20

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const result = await feesService.getStudentFees(schoolId, {
                studentId,
                academicYear,
                status,
                page,
                limit
            })

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
            console.error('Error getting student fees:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async getStudentFeeById(req: Request, res: Response) {
        try {
            const { id } = req.params
            const schoolId = req.query.school_id as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const fee = await feesService.getStudentFeeById(id, schoolId)
            if (!fee) {
                return res.status(404).json({ success: false, error: 'Fee not found' })
            }

            const payments = await feesService.getPaymentHistory(id, schoolId)

            return res.json({ success: true, data: { ...fee, payments } })
        } catch (error: any) {
            console.error('Error getting student fee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // PAYMENTS
    // ==========================================

    async recordPayment(req: Request, res: Response) {
        try {
            const { school_id, student_fee_id, amount, payment_method, payment_reference, received_by, notes } = req.body

            if (!school_id || !student_fee_id || !amount) {
                return res.status(400).json({ success: false, error: 'school_id, student_fee_id, and amount are required' })
            }

            const payment = await feesService.recordPayment(school_id, {
                student_fee_id,
                amount,
                payment_method,
                payment_reference,
                received_by,
                notes
            })

            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error recording payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // FEE GENERATION
    // ==========================================

    async generateFee(req: Request, res: Response) {
        try {
            const { school_id, student_id, academic_year, fee_structure_id } = req.body

            if (!school_id || !student_id || !academic_year || !fee_structure_id) {
                return res.status(400).json({
                    success: false,
                    error: 'school_id, student_id, academic_year, and fee_structure_id are required'
                })
            }

            const fee = await feesService.generateFeesForStudent(student_id, school_id, academic_year, fee_structure_id)
            return res.status(201).json({ success: true, data: fee })
        } catch (error: any) {
            console.error('Error generating fee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // ADMIN ACTIONS
    // ==========================================

    async restoreDiscount(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { school_id, admin_id } = req.body

            if (!school_id || !admin_id) {
                return res.status(400).json({ success: false, error: 'school_id and admin_id are required' })
            }

            const fee = await feesService.restoreDiscount(id, school_id, admin_id)
            return res.json({ success: true, data: fee })
        } catch (error: any) {
            console.error('Error restoring discount:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    async waiveFee(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { school_id, notes } = req.body

            if (!school_id) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const fee = await feesService.waiveFee(id, school_id, notes)
            return res.json({ success: true, data: fee })
        } catch (error: any) {
            console.error('Error waiving fee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // DASHBOARD
    // ==========================================

    async getDashboardStats(req: Request, res: Response) {
        try {
            const schoolId = req.query.school_id as string
            const academicYear = req.query.academic_year as string

            if (!schoolId) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const stats = await feesService.getFeeDashboardStats(schoolId, academicYear)
            return res.json({ success: true, data: stats })
        } catch (error: any) {
            console.error('Error getting dashboard stats:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // LATE FEE AUTOMATION (CRON ENDPOINTS)
    // ==========================================

    /**
     * Apply late fees for a specific school
     * POST /api/fees/apply-late-fees
     * Can be triggered manually by admin
     */
    async applyLateFees(req: Request, res: Response) {
        try {
            const { school_id } = req.body

            if (!school_id) {
                return res.status(400).json({ success: false, error: 'school_id is required' })
            }

            const result = await feesService.applyLateFees(school_id)
            return res.json({
                success: true,
                message: `Applied late fees to ${result.feesUpdated} fees, forfeited ${result.discountsForfeited} discounts`,
                data: result
            })
        } catch (error: any) {
            console.error('Error applying late fees:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Apply late fees for ALL schools
     * POST /api/fees/cron/apply-late-fees
     * Called by external cron job (e.g., cron-job.org, GitHub Actions, Supabase Edge Function)
     */
    async applyLateFeesGlobal(req: Request, res: Response) {
        try {
            // Optional: Add secret key validation for cron security
            const cronSecret = req.headers['x-cron-secret']
            const expectedSecret = process.env.CRON_SECRET

            if (expectedSecret && cronSecret !== expectedSecret) {
                return res.status(401).json({ success: false, error: 'Unauthorized' })
            }

            const result = await feesService.applyLateFeesGlobal()
            return res.json({
                success: true,
                message: `Processed ${result.schoolsProcessed} schools, updated ${result.totalFeesUpdated} fees`,
                data: result
            })
        } catch (error: any) {
            console.error('Error applying late fees globally:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Generate monthly fees for a specific school
     * POST /api/fees/generate-monthly
     */
    async generateMonthlyFees(req: AuthRequest, res: Response) {
        try {
            const { school_id, month, year, academic_year, grade_level_id, section_id, category_ids, campus_id } = req.body

            // Get admin's school ID
            const adminSchoolId = req.profile?.school_id
            if (!adminSchoolId) {
                return res.status(403).json({ success: false, error: 'No school associated' })
            }

            // Determine effective school ID for campus-specific operations
            let effectiveSchoolId = adminSchoolId
            
            // If campus_id is provided, use it (assuming proper access validation)
            if (campus_id) {
                effectiveSchoolId = campus_id
            } else if (school_id) {
                effectiveSchoolId = school_id
            }

            // Provide default academic year if not specified
            let effectiveAcademicYear = academic_year
            if (!effectiveAcademicYear) {
                // Generate default academic year based on current date
                const now = new Date()
                if (now.getMonth() >= 6) { // July onwards (month is 0-based)
                    effectiveAcademicYear = `${now.getFullYear()}-${now.getFullYear() + 1}`
                } else {
                    effectiveAcademicYear = `${now.getFullYear() - 1}-${now.getFullYear()}`
                }
            }

            const result = await feesService.generateMonthlyFees(
                adminSchoolId, // Admin's school for validation
                month, 
                year,
                effectiveAcademicYear,
                grade_level_id,
                section_id,
                category_ids,
                effectiveSchoolId // Campus-specific school ID
            )

            return res.json({
                success: true,
                message: `Generated ${result.feesCreated} fees for ${result.studentsProcessed} students`,
                data: result
            })
        } catch (error: any) {
            console.error('Error generating monthly fees:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Generate monthly fees for ALL schools (cron job)
     * POST /api/fees/cron/generate-monthly
     */
    async generateMonthlyFeesGlobal(req: Request, res: Response) {
        try {
            const cronSecret = req.headers['x-cron-secret']
            const expectedSecret = process.env.CRON_SECRET

            if (expectedSecret && cronSecret !== expectedSecret) {
                return res.status(401).json({ success: false, error: 'Unauthorized' })
            }

            const { month, year } = req.body
            const result = await feesService.generateMonthlyFeesAllSchools(month, year)

            return res.json({
                success: true,
                message: `Generated ${result.totalFeesCreated} fees across ${result.schools.length} schools`,
                data: result
            })
        } catch (error: any) {
            console.error('Error generating monthly fees globally:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Get fees for the currently logged-in student
     * GET /api/fees/my
     */
    async getMyFees(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.id
            const schoolId = req.profile?.school_id

            if (!userId || !schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            // Get student ID from profile
            const { data: student, error: studentError } = await (await import('../config/supabase')).supabase
                .from('students')
                .select('id')
                .eq('profile_id', userId)
                .single()

            if (studentError || !student) {
                return res.status(404).json({ success: false, error: 'Student record not found' })
            }

            // Get fees for this student
            const { data: fees, error } = await (await import('../config/supabase')).supabase
                .from('student_fees')
                .select(`
                    *,
                    fee_structure:fee_structures(
                        fee_category:fee_categories(
                            name,
                            code
                        )
                    )
                `)
                .eq('student_id', student.id)
                .eq('school_id', schoolId)
                .order('fee_month', { ascending: false })

            if (error) {
                throw new Error(error.message)
            }

            return res.json({ success: true, data: fees || [] })
        } catch (error: any) {
            console.error('Error getting my fees:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // FEE ADJUSTMENTS (Admin Overrides)
    // ==========================================

    /**
     * Apply an adjustment to a fee (remove late fee, add discount, waive, etc.)
     * PUT /api/fees/:id/adjust
     */
    async adjustFee(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const adminId = req.user?.id

            if (!schoolId || !adminId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const { type, newLateFee, customDiscount, reason } = req.body

            if (!type || !reason) {
                return res.status(400).json({ success: false, error: 'type and reason are required' })
            }

            const fee = await feesService.adjustFee(id, schoolId, adminId, {
                type,
                newLateFee,
                customDiscount,
                reason
            })

            return res.json({ success: true, data: fee })
        } catch (error: any) {
            console.error('Error adjusting fee:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Get adjustment history for a fee
     * GET /api/fees/:id/adjustments
     */
    async getFeeAdjustments(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params
            const schoolId = (req.query.school_id as string) || req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const adjustments = await feesService.getFeeAdjustments(id, schoolId)
            return res.json({ success: true, data: adjustments })
        } catch (error: any) {
            console.error('Error getting fee adjustments:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STUDENT FEE HISTORY
    // ==========================================

    /**
     * Get complete fee history for a specific student
     * GET /api/fees/history/:studentId
     */
    async getStudentFeeHistory(req: AuthRequest, res: Response) {
        try {
            const { studentId } = req.params
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const academicYear = req.query.academic_year as string
            const status = req.query.status as string
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 50

            const result = await feesService.getStudentFeeHistory(studentId, schoolId, {
                academicYear,
                status,
                page,
                limit
            })

            return res.json({
                success: true,
                data: result.data,
                summary: result.summary,
                pagination: {
                    page,
                    limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / limit)
                }
            })
        } catch (error: any) {
            console.error('Error getting student fee history:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // ON-THE-SPOT FEE GENERATION
    // ==========================================

    /**
     * Generate a fee challan for a new student immediately
     * POST /api/fees/generate-for-student
     */
    async generateFeeForNewStudent(req: AuthRequest, res: Response) {
        try {
            const schoolId = req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const { student_id, grade_id, service_ids, category_ids, academic_year, fee_month, due_date } = req.body

            if (!student_id || !grade_id || !academic_year || !fee_month || !due_date) {
                return res.status(400).json({
                    success: false,
                    error: 'student_id, grade_id, academic_year, fee_month, and due_date are required'
                })
            }

            const fee = await feesService.generateFeeForNewStudent(
                student_id,
                schoolId,
                grade_id,
                service_ids || [],
                { academicYear: academic_year, feeMonth: fee_month, dueDate: due_date, categoryIds: category_ids }
            )

            return res.status(201).json({ success: true, data: fee })
        } catch (error: any) {
            console.error('Error generating fee for new student:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // BROWSE BY GRADE
    // ==========================================

    /**
     * Browse fees by grade/section/month
     * GET /api/fees/by-grade
     */
    async getFeesByGrade(req: AuthRequest, res: Response) {
        try {
            // Use query param school_id if provided, otherwise fall back to profile
            const schoolId = (req.query.school_id as string) || req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const gradeLevelId = req.query.grade_level_id as string
            const sectionId = req.query.section_id as string
            const feeMonth = req.query.fee_month as string
            const status = req.query.status as string
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 30

            const result = await feesService.getFeesByGrade(schoolId, {
                gradeLevelId,
                sectionId,
                feeMonth,
                status,
                page,
                limit
            })

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
            console.error('Error getting fees by grade:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STUDENT PAYMENTS MODULE
    // ==========================================

    /**
     * Get all students for payment selection
     * GET /api/fees/payments/students
     */
    async getStudentsForPayments(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const search = req.query.search as string
            const gradeLevelId = req.query.grade_level_id as string
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 50

            const result = await feesService.getStudentsWithPaymentSummary(schoolId, {
                search,
                gradeLevelId,
                page,
                limit
            })

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
            console.error('Error getting students for payments:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Get payments for a specific student
     * GET /api/fees/payments/student/:studentId
     */
    async getStudentPayments(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const { studentId } = req.params

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!studentId) {
                return res.status(400).json({ success: false, error: 'studentId is required' })
            }

            const payments = await feesService.getStudentPayments(studentId, schoolId)
            const summary = await feesService.getStudentFeeSummary(studentId, schoolId)

            return res.json({
                success: true,
                data: {
                    payments,
                    summary
                }
            })
        } catch (error: any) {
            console.error('Error getting student payments:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Record a direct payment for a student
     * POST /api/fees/payments/record
     */
    async recordDirectPayment(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.body.school_id as string) || req.profile?.school_id
            const userId = req.profile?.id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const { student_id, amount, payment_date, comment, is_lunch_payment, file_url } = req.body

            if (!student_id || amount === undefined) {
                return res.status(400).json({ success: false, error: 'student_id and amount are required' })
            }

            const payment = await feesService.recordDirectPayment(schoolId, {
                student_id,
                amount: parseFloat(amount),
                payment_date: payment_date || new Date().toISOString(),
                comment,
                is_lunch_payment: is_lunch_payment || false,
                file_url,
                created_by: userId
            })

            return res.status(201).json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error recording direct payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Delete a payment
     * DELETE /api/fees/payments/:paymentId
     */
    async deletePayment(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const { paymentId } = req.params

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!paymentId) {
                return res.status(400).json({ success: false, error: 'paymentId is required' })
            }

            await feesService.deletePayment(paymentId, schoolId)

            return res.json({ success: true, message: 'Payment deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Update a payment
     * PUT /api/fees/payments/:paymentId
     */
    async updatePayment(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.body.school_id as string) || req.profile?.school_id
            const { paymentId } = req.params

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!paymentId) {
                return res.status(400).json({ success: false, error: 'paymentId is required' })
            }

            const { amount, payment_date, comment, is_lunch_payment, file_url } = req.body

            const payment = await feesService.updatePayment(paymentId, schoolId, {
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                payment_date,
                comment,
                is_lunch_payment,
                file_url
            })

            return res.json({ success: true, data: payment })
        } catch (error: any) {
            console.error('Error updating payment:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    // ==========================================
    // STUDENT FEE OVERRIDES
    // ==========================================

    /**
     * Create a student fee override
     * POST /api/fees/overrides
     */
    async createStudentFeeOverride(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.body.school_id as string) || req.profile?.school_id

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const { student_id, fee_category_id, academic_year, override_amount, reason } = req.body

            if (!student_id || !fee_category_id || !academic_year || override_amount === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'student_id, fee_category_id, academic_year, and override_amount are required'
                })
            }

            const override = await feesService.createStudentFeeOverride({
                school_id: schoolId,
                student_id,
                fee_category_id,
                academic_year,
                override_amount: parseFloat(override_amount),
                reason,
                created_by: req.profile?.id
            })

            return res.status(201).json({ success: true, data: override })
        } catch (error: any) {
            console.error('Error creating fee override:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Get fee overrides for a student
     * GET /api/fees/overrides/student/:studentId
     */
    async getStudentFeeOverrides(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const { studentId } = req.params
            const academicYear = req.query.academic_year as string | undefined

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!studentId) {
                return res.status(400).json({ success: false, error: 'studentId is required' })
            }

            const overrides = await feesService.getStudentFeeOverrides(studentId, schoolId, academicYear)

            return res.json({ success: true, data: overrides })
        } catch (error: any) {
            console.error('Error getting fee overrides:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Get all fee overrides for a school
     * GET /api/fees/overrides
     */
    async getAllSchoolFeeOverrides(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const academicYear = req.query.academic_year as string | undefined
            const feeCategoryId = req.query.fee_category_id as string | undefined
            const isActive = req.query.is_active !== 'false'
            const page = parseInt(req.query.page as string) || 1
            const limit = parseInt(req.query.limit as string) || 50

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            const result = await feesService.getAllSchoolFeeOverrides(schoolId, {
                academicYear,
                feeCategoryId,
                isActive,
                page,
                limit
            })

            return res.json({ success: true, data: result.data, total: result.total })
        } catch (error: any) {
            console.error('Error getting school fee overrides:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Update a fee override
     * PUT /api/fees/overrides/:id
     */
    async updateStudentFeeOverride(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.body.school_id as string) || req.profile?.school_id
            const { id } = req.params

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!id) {
                return res.status(400).json({ success: false, error: 'Override ID is required' })
            }

            const { override_amount, reason, is_active } = req.body

            const override = await feesService.updateStudentFeeOverride(id, schoolId, {
                override_amount: override_amount !== undefined ? parseFloat(override_amount) : undefined,
                reason,
                is_active
            })

            return res.json({ success: true, data: override })
        } catch (error: any) {
            console.error('Error updating fee override:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Delete a fee override
     * DELETE /api/fees/overrides/:id
     */
    async deleteStudentFeeOverride(req: AuthRequest, res: Response) {
        try {
            const schoolId = (req.query.school_id as string) || req.profile?.school_id
            const { id } = req.params

            if (!schoolId) {
                return res.status(403).json({ success: false, error: 'Not authenticated' })
            }

            if (!id) {
                return res.status(400).json({ success: false, error: 'Override ID is required' })
            }

            await feesService.deleteStudentFeeOverride(id, schoolId)

            return res.json({ success: true, message: 'Fee override deleted successfully' })
        } catch (error: any) {
            console.error('Error deleting fee override:', error)
            return res.status(500).json({ success: false, error: error.message })
        }
    }
}

export const feesController = new FeesController()


