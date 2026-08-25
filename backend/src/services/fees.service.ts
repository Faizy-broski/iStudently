import { supabase } from '../config/supabase'
import { round2 } from '../utils/money'

export interface FeeCategory {
    id: string
    school_id: string
    name: string
    code: string
    description?: string
    is_mandatory: boolean
    is_discountable: boolean
    display_order: number
    is_active: boolean
}

export interface SiblingDiscountTier {
    id: string
    school_id: string
    sibling_count: number
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    applies_to_categories: string[]
    is_active: boolean
}

export interface FeeSettings {
    id: string
    school_id: string
    enable_late_fees: boolean
    late_fee_type: 'percentage' | 'fixed'
    late_fee_value: number
    grace_days: number
    enable_sibling_discounts: boolean
    discount_forfeiture_enabled: boolean
    admin_can_restore_discounts: boolean
    allow_partial_payments: boolean
    min_partial_payment_percent: number
}

export interface StudentFee {
    id: string
    school_id: string
    student_id: string
    fee_structure_id: string
    academic_year: string
    base_amount: number
    sibling_discount: number
    custom_discount: number
    late_fee_applied: number
    final_amount: number
    amount_paid: number
    balance: number
    status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
    due_date: string
    discount_forfeited: boolean
}

export interface CreateFeeCategoryDTO {
    school_id: string
    name: string
    code: string
    description?: string
    is_mandatory?: boolean
    is_discountable?: boolean
    display_order?: number
}

export interface CreateSiblingDiscountTierDTO {
    school_id: string
    sibling_count: number
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    applies_to_categories?: string[]
}

export interface RecordPaymentDTO {
    student_fee_id: string
    amount: number
    payment_method?: string
    payment_reference?: string
    received_by?: string
    notes?: string
    comment?: string
    is_lunch_payment?: boolean
    file_url?: string
    created_by?: string
    manual_receipt_number?: string
}

export interface DirectPaymentDTO {
    student_id: string
    amount: number
    payment_date: string
    comment?: string
    is_lunch_payment?: boolean
    file_url?: string
    receipt_number?: string
    created_by?: string
    payment_method?: string
    manual_receipt_number?: string
}

export interface StudentFeeOverride {
    id: string
    school_id: string
    student_id: string
    fee_category_id: string
    academic_year: string
    override_amount: number
    reason?: string
    is_active: boolean
    created_by?: string
    created_at: string
    updated_at: string
    // Joined fields
    fee_categories?: { name: string; code: string }
    students?: { profiles: { first_name: string; last_name: string } }
}

export interface CreateStudentFeeOverrideDTO {
    school_id: string
    student_id: string
    fee_category_id: string
    academic_year: string
    override_amount: number
    reason?: string
    created_by?: string
}

export interface UpdateStudentFeeOverrideDTO {
    override_amount?: number
    reason?: string
    is_active?: boolean
}

class FeesService {
    // ==========================================
    // FEE SETTINGS
    // ==========================================

    async getFeeSettings(schoolId: string): Promise<FeeSettings | null> {
        const { data, error } = await supabase
            .from('fee_settings')
            .select('*')
            .eq('school_id', schoolId)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get fee settings: ${error.message}`)
        }

        return data
    }

    async upsertFeeSettings(schoolId: string, settings: Partial<FeeSettings>): Promise<FeeSettings> {
        const { data, error } = await supabase
            .from('fee_settings')
            .upsert({
                school_id: schoolId,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'school_id' })
            .select()
            .single()

        if (error) throw new Error(`Failed to update fee settings: ${error.message}`)
        return data
    }

    // ==========================================
    // FEE CATEGORIES
    // ==========================================

    async getFeeCategories(schoolId: string, activeOnly = true): Promise<FeeCategory[]> {
        let query = supabase
            .from('fee_categories')
            .select('*')
            .eq('school_id', schoolId)
            .order('display_order', { ascending: true })

        if (activeOnly) {
            query = query.eq('is_active', true)
        }

        const { data, error } = await query

        if (error) throw new Error(`Failed to get fee categories: ${error.message}`)
        return data || []
    }

    async createFeeCategory(categoryData: CreateFeeCategoryDTO): Promise<FeeCategory> {
        const { data, error } = await supabase
            .from('fee_categories')
            .insert(categoryData)
            .select()
            .single()

        if (error) throw new Error(`Failed to create fee category: ${error.message}`)
        return data
    }

    async updateFeeCategory(categoryId: string, schoolId: string, updates: Partial<FeeCategory>): Promise<FeeCategory> {
        const { data, error } = await supabase
            .from('fee_categories')
            .update(updates)
            .eq('id', categoryId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to update fee category: ${error.message}`)
        return data
    }

    async deleteFeeCategory(categoryId: string, schoolId: string): Promise<void> {
        const { error } = await supabase
            .from('fee_categories')
            .update({ is_active: false })
            .eq('id', categoryId)
            .eq('school_id', schoolId)

        if (error) throw new Error(`Failed to delete fee category: ${error.message}`)
    }

    // ==========================================
    // SIBLING DISCOUNT TIERS
    // ==========================================

    async getSiblingDiscountTiers(schoolId: string): Promise<SiblingDiscountTier[]> {
        const { data, error } = await supabase
            .from('sibling_discount_tiers')
            .select('*')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('sibling_count', { ascending: true })

        if (error) throw new Error(`Failed to get sibling discount tiers: ${error.message}`)
        return data || []
    }

    async upsertSiblingDiscountTiers(schoolId: string, tiers: CreateSiblingDiscountTierDTO[]): Promise<SiblingDiscountTier[]> {
        // First, deactivate all existing tiers
        await supabase
            .from('sibling_discount_tiers')
            .update({ is_active: false })
            .eq('school_id', schoolId)

        // Insert new tiers
        const tiersWithSchool = tiers.map(tier => ({
            ...tier,
            school_id: schoolId,
            is_active: true
        }))

        const { data, error } = await supabase
            .from('sibling_discount_tiers')
            .upsert(tiersWithSchool, { onConflict: 'school_id,sibling_count' })
            .select()

        if (error) throw new Error(`Failed to update sibling discount tiers: ${error.message}`)
        return data || []
    }

    // ==========================================
    // FEE STRUCTURES
    // ==========================================

    async getFeeStructures(schoolId: string, academicYear?: string): Promise<any[]> {
        let query = supabase
            .from('fee_structures')
            .select(`
                *,
                grade_level:grade_levels(name),
                fee_category:fee_categories(name, code)
            `)
            .eq('school_id', schoolId)
            .eq('is_active', true)

        if (academicYear) {
            query = query.eq('academic_year', academicYear)
        }

        const { data, error } = await query.order('academic_year', { ascending: false })

        if (error) throw new Error(`Failed to get fee structures: ${error.message}`)
        return data || []
    }

    async createFeeStructure(structureData: any): Promise<any> {
        const { data, error } = await supabase
            .from('fee_structures')
            .insert({
                ...structureData,
                is_active: true
            })
            .select(`
                *,
                grade_level:grade_levels(name),
                fee_category:fee_categories(name, code)
            `)
            .single()

        if (error) throw new Error(`Failed to create fee structure: ${error.message}`)
        return data
    }

    async updateFeeStructure(structureId: string, schoolId: string, updates: any): Promise<any> {
        const { data, error } = await supabase
            .from('fee_structures')
            .update(updates)
            .eq('id', structureId)
            .eq('school_id', schoolId)
            .select(`
                *,
                grade_level:grade_levels(name),
                fee_category:fee_categories(name, code)
            `)
            .single()

        if (error) throw new Error(`Failed to update fee structure: ${error.message}`)
        return data
    }

    async deleteFeeStructure(structureId: string, schoolId: string): Promise<void> {
        const { error } = await supabase
            .from('fee_structures')
            .update({ is_active: false })
            .eq('id', structureId)
            .eq('school_id', schoolId)

        if (error) throw new Error(`Failed to delete fee structure: ${error.message}`)
    }

    // ==========================================
    // SIBLING COUNT CALCULATION
    // ==========================================

    async countSiblings(studentId: string, schoolId: string): Promise<number> {
        // Get all parents of this student
        const { data: parentLinks, error: parentError } = await supabase
            .from('parent_student_links')
            .select('parent_id')
            .eq('student_id', studentId)
            .eq('is_active', true)

        if (parentError) throw new Error(`Failed to get parent links: ${parentError.message}`)
        if (!parentLinks || parentLinks.length === 0) return 1

        const parentIds = parentLinks.map(p => p.parent_id)

        // Get all students linked to these parents (siblings)
        const { data: siblingLinks, error: siblingError } = await supabase
            .from('parent_student_links')
            .select(`
        student_id,
        students!inner(id, school_id)
      `)
            .in('parent_id', parentIds)
            .eq('is_active', true)

        if (siblingError) throw new Error(`Failed to get sibling links: ${siblingError.message}`)

        // Filter to only students in the same school and count unique
        const uniqueSiblings = new Set(
            siblingLinks
                ?.filter((link: any) => link.students?.school_id === schoolId)
                .map((link: any) => link.student_id) || []
        )

        return uniqueSiblings.size || 1
    }

    // ==========================================
    // DISCOUNT CALCULATION
    // ==========================================

    async calculateSiblingDiscount(
        studentId: string,
        schoolId: string,
        feeCategoryId: string,
        baseAmount: number
    ): Promise<number> {
        // Check if sibling discounts are enabled
        const settings = await this.getFeeSettings(schoolId)
        if (!settings?.enable_sibling_discounts) return 0

        // Get sibling count
        const siblingCount = await this.countSiblings(studentId, schoolId)
        if (siblingCount <= 1) return 0

        // Get applicable discount tier
        const tiers = await this.getSiblingDiscountTiers(schoolId)
        const applicableTier = tiers.find(
            tier => tier.sibling_count === siblingCount &&
                (tier.applies_to_categories.length === 0 || tier.applies_to_categories.includes(feeCategoryId))
        )

        if (!applicableTier) return 0

        // Calculate discount
        if (applicableTier.discount_type === 'percentage') {
            return round2((baseAmount * applicableTier.discount_value) / 100)
        }
        return round2(applicableTier.discount_value)
    }

    // ==========================================
    // STUDENT FEES
    // ==========================================

    async getStudentFees(
        schoolId: string,
        options: {
            studentId?: string
            academicYear?: string
            status?: string
            page?: number
            limit?: number
        } = {}
    ): Promise<{ data: StudentFee[]; total: number }> {
        const { studentId, academicYear, status, page = 1, limit = 20 } = options
        const offset = (page - 1) * limit

        let query = supabase
            .from('student_fees')
            .select(`
        *,
        students!inner(
          id,
          student_number,
          grade_level,
          grade_levels(name),
          profiles!inner(first_name, last_name)
        ),
        fee_structures(
          fee_categories(name, code)
        )
      `, { count: 'exact' })
            .eq('school_id', schoolId)
            .order('due_date', { ascending: false })
            .range(offset, offset + limit - 1)

        if (studentId) query = query.eq('student_id', studentId)
        if (academicYear) query = query.eq('academic_year', academicYear)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query

        if (error) throw new Error(`Failed to get student fees: ${error.message}`)

        // Parse fee_breakdown JSON for each record
        const parsedData = (data || []).map(fee => {
            if (fee.fee_breakdown) {
                try {
                    fee.fee_breakdown = typeof fee.fee_breakdown === 'string'
                        ? JSON.parse(fee.fee_breakdown)
                        : fee.fee_breakdown;
                } catch (e) {
                    console.error('Failed to parse fee_breakdown:', e);
                    fee.fee_breakdown = null;
                }
            }
            return fee;
        });

        return { data: parsedData, total: count || 0 }
    }

    async getStudentFeeById(feeId: string, schoolId: string): Promise<StudentFee | null> {
        const { data, error } = await supabase
            .from('student_fees')
            .select(`
        *,
        students!inner(
          id,
          student_number,
          profiles!inner(first_name, last_name, email)
        ),
        fee_structures(
          fee_categories(name, code),
          period_type,
          period_name
        )
      `)
            .eq('id', feeId)
            .eq('school_id', schoolId)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get student fee: ${error.message}`)
        }

        // Parse fee_breakdown JSON if it exists
        if (data && data.fee_breakdown) {
            try {
                data.fee_breakdown = typeof data.fee_breakdown === 'string'
                    ? JSON.parse(data.fee_breakdown)
                    : data.fee_breakdown;
            } catch (e) {
                console.error('Failed to parse fee_breakdown:', e);
                data.fee_breakdown = null;
            }
        }

        return data
    }

    // ==========================================
    // PAYMENTS
    // ==========================================

    async recordPayment(schoolId: string, payment: RecordPaymentDTO): Promise<any> {
        // Get the student fee to validate
        const { data: fee, error: feeError } = await supabase
            .from('student_fees')
            .select('*')
            .eq('id', payment.student_fee_id)
            .eq('school_id', schoolId)
            .single()

        if (feeError || !fee) throw new Error('Student fee not found')

        if (fee.status === 'waived') throw new Error('Cannot record payment against a waived fee')

        // Check if payment amount is valid
        const balance = fee.final_amount - fee.amount_paid
        if (payment.amount > balance) {
            throw new Error(`Payment amount (${payment.amount}) exceeds balance (${balance})`)
        }

        // Check minimum payment if partial payments are restricted
        const settings = await this.getFeeSettings(schoolId)
        if (settings && !settings.allow_partial_payments && payment.amount < balance) {
            throw new Error('Partial payments are not allowed. Please pay the full balance.')
        }

        if (settings?.allow_partial_payments && settings.min_partial_payment_percent > 0) {
            const minPayment = (fee.final_amount * settings.min_partial_payment_percent) / 100
            if (payment.amount < minPayment && payment.amount < balance) {
                throw new Error(`Minimum payment is ${minPayment.toFixed(2)} (${settings.min_partial_payment_percent}%)`)
            }
        }

        // Record the payment
        const { data, error } = await supabase
            .from('fee_payments')
            .insert({
                school_id: schoolId,
                student_fee_id: payment.student_fee_id,
                amount: payment.amount,
                payment_method: payment.payment_method || 'cash',
                payment_reference: payment.payment_reference,
                received_by: payment.received_by,
                notes: payment.notes,
                comment: payment.comment,
                is_lunch_payment: payment.is_lunch_payment || false,
                file_url: payment.file_url,
                created_by: payment.created_by,
                manual_receipt_number: payment.manual_receipt_number || null
            })
            .select()
            .single()

        if (error) throw new Error(`Failed to record payment: ${error.message}`)
        return data
    }

    async getPaymentHistory(studentFeeId: string, schoolId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('fee_payments')
            .select(`
        *,
        profiles:received_by(first_name, last_name),
        created_by_profile:created_by(first_name, last_name)
      `)
            .eq('student_fee_id', studentFeeId)
            .eq('school_id', schoolId)
            .order('payment_date', { ascending: false })

        if (error) throw new Error(`Failed to get payment history: ${error.message}`)
        return data || []
    }

    // ==========================================
    // STUDENT PAYMENTS MODULE
    // ==========================================

    /**
     * Get all students with their fee/payment summary (expanded data + parent links for family grouping)
     */
    async getStudentsWithPaymentSummary(
        schoolId: string,
        options: {
            search?: string
            gradeLevelId?: string
            gradeLevelIds?: string[]
            sectionIds?: string[]
            page?: number
            limit?: number
        } = {}
    ): Promise<{ data: any[]; total: number }> {
        const { search, gradeLevelId, gradeLevelIds, sectionIds, page = 1, limit = 50 } = options
        const offset = (page - 1) * limit

        // Build the query for students with expanded data + parent links
        let query = supabase
            .from('students')
            .select(`
                id,
                student_number,
                grade_level,
                custom_fields,
                profiles!inner(first_name, last_name, email, phone),
                grade_levels(id, name),
                sections(id, name),
                parent_student_links(
                    parent_id,
                    relationship,
                    parents(
                        id,
                        address,
                        city,
                        state,
                        zip_code,
                        profiles(first_name, last_name)
                    )
                )
            `, { count: 'exact' })
            .eq('school_id', schoolId)
            .order('student_number', { ascending: true })

        if (gradeLevelIds && gradeLevelIds.length > 0) {
            query = query.in('grade_level_id', gradeLevelIds)
        } else if (gradeLevelId && gradeLevelId !== 'all') {
            query = query.eq('grade_level_id', gradeLevelId)
        }

        if (sectionIds && sectionIds.length > 0) {
            query = query.in('section_id', sectionIds)
        }

        if (search) {
            // Search by student_number only at database level, frontend will handle name filtering
            query = query.ilike('student_number', `%${search}%`)
        }

        query = query.range(offset, offset + limit - 1)

        const { data: students, error, count } = await query

        if (error) throw new Error(`Failed to get students: ${error.message}`)

        return { data: students || [], total: count || 0 }
    }

    /**
     * Get all payments for a specific student (direct payments)
     */
    async getStudentInfo(studentId: string, schoolId: string): Promise<any> {
        const { data, error } = await supabase
            .from('students')
            .select('id, student_number, profiles(first_name, last_name)')
            .eq('id', studentId)
            .eq('school_id', schoolId)
            .single()

        if (error) return null

        // Normalize profiles (can be object or array depending on Supabase version)
        const profileData = Array.isArray(data?.profiles)
            ? data.profiles[0]
            : data?.profiles

        return {
            id: data.id,
            student_number: data.student_number,
            first_name: profileData?.first_name || '',
            last_name: profileData?.last_name || ''
        }
    }

    async getAllPaymentsWithStudents(
        schoolId: string,
        gradeIds?: string[],
        sectionIds?: string[]
    ): Promise<any[]> {
        // Build students query
        let studentsQuery = supabase
            .from('students')
            .select(`
                id,
                student_number,
                profiles(first_name, last_name),
                grade_levels(id, name),
                sections(name),
                parent_student_links(
                    parent_id,
                    relationship,
                    parents(
                        id,
                        profiles(first_name, last_name)
                    )
                )
            `)
            .eq('school_id', schoolId)
            .order('student_number')

        if (gradeIds && gradeIds.length > 0) {
            studentsQuery = studentsQuery.in('grade_level_id', gradeIds) as any
        }
        if (sectionIds && sectionIds.length > 0) {
            studentsQuery = studentsQuery.in('section_id', sectionIds) as any
        }

        const { data: students } = await studentsQuery
        if (!students || students.length === 0) return []

        const studentIds = students.map((s: any) => s.id)

        // final_amount/amount_paid are pulled here (not just id/student_id) so we can also
        // surface each student's current outstanding balance alongside their payment history —
        // used by the printed receipt to show "remaining balance", not just what was paid.
        const { data: fees } = await supabase
            .from('student_fees')
            .select('id, student_id, final_amount, amount_paid')
            .eq('school_id', schoolId)
            .in('student_id', studentIds)

        if (!fees || fees.length === 0) {
            return students.map((s: any) => ({ ...s, payments: [], balance: 0 }))
        }

        const feeIds = fees.map((f: any) => f.id)
        const feeToStudent = new Map(fees.map((f: any) => [f.id, f.student_id]))

        const balanceByStudent = new Map<string, number>()
        fees.forEach((f: any) => {
            const bal = Number(f.final_amount || 0) - Number(f.amount_paid || 0)
            balanceByStudent.set(f.student_id, (balanceByStudent.get(f.student_id) || 0) + bal)
        })

        const { data: payments } = await supabase
            .from('fee_payments')
            .select(`
                id,
                student_fee_id,
                amount,
                payment_date,
                payment_method,
                comment,
                is_lunch_payment,
                receipt_number,
                created_at,
                created_by_profile:created_by(first_name, last_name)
            `)
            .in('student_fee_id', feeIds)
            .order('payment_date', { ascending: false })

        const studentPayments = new Map<string, any[]>()
        payments?.forEach((p: any) => {
            const studentId = feeToStudent.get(p.student_fee_id)
            if (studentId) {
                if (!studentPayments.has(studentId)) studentPayments.set(studentId, [])
                studentPayments.get(studentId)!.push(p)
            }
        })

        return students.map((s: any) => ({
            ...s,
            payments: studentPayments.get(s.id) || [],
            balance: balanceByStudent.get(s.id) || 0
        }))
    }

    async getStudentPayments(
        studentId: string,
        schoolId: string
    ): Promise<any[]> {
        // Get all student_fees for this student
        const { data: studentFees, error: feesError } = await supabase
            .from('student_fees')
            .select('id')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)

        if (feesError) throw new Error(`Failed to get student fees: ${feesError.message}`)

        if (!studentFees || studentFees.length === 0) {
            return []
        }

        const feeIds = studentFees.map(f => f.id)

        // Get all payments for these fees. Scoping through student_fee_id IN feeIds
        // (feeIds already filtered by student_id + school_id above) is sufficient —
        // do NOT additionally filter fee_payments by school_id here. Some historical
        // fee_payments rows have a school_id that drifted from their parent
        // student_fees row (the same campus_id/school_id inconsistency seen
        // elsewhere in this codebase); the FK to student_fee_id is what actually
        // guarantees correct ownership, and an extra .eq('school_id', ...) here
        // was silently hiding genuine old payments. getAllPaymentsWithStudents
        // (below) already does it this way, which is why it doesn't have this bug.
        const { data: payments, error: paymentsError } = await supabase
            .from('fee_payments')
            .select(`
                *,
                created_by_profile:created_by(first_name, last_name)
            `)
            .in('student_fee_id', feeIds)
            .order('payment_date', { ascending: false })

        if (paymentsError) throw new Error(`Failed to get payments: ${paymentsError.message}`)

        return payments || []
    }

    /**
     * Get fee summary for a student
     */
    async getStudentFeeSummary(
        studentId: string,
        schoolId: string
    ): Promise<{ totalFees: number; totalPayments: number; balance: number }> {
        // Get all student_fees for this student
        const { data: studentFees, error: feesError } = await supabase
            .from('student_fees')
            .select('final_amount, amount_paid')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)

        if (feesError) throw new Error(`Failed to get student fees: ${feesError.message}`)

        const totalFees = studentFees?.reduce((sum, f) => sum + Number(f.final_amount || 0), 0) || 0
        const totalPayments = studentFees?.reduce((sum, f) => sum + Number(f.amount_paid || 0), 0) || 0
        const balance = totalFees - totalPayments

        return { totalFees, totalPayments, balance }
    }

    /**
     * Record a direct payment for a student (creates or finds fee record)
     */
    async recordDirectPayment(schoolId: string, payment: DirectPaymentDTO): Promise<any> {
        // Find or create a general fee record for this student
        let { data: existingFee, error: feeError } = await supabase
            .from('student_fees')
            .select('*')
            .eq('student_id', payment.student_id)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (feeError && feeError.code !== 'PGRST116') {
            // Not a "no rows" error
            throw new Error(`Failed to find student fee: ${feeError.message}`)
        }

        if (!existingFee) {
            // Determine a default fee_structure for the school (use first available)
            let defaultStructureId: string | null = null
            const { data: structs, error: structErr } = await supabase
                .from('fee_structures')
                .select('id')
                .eq('school_id', schoolId)
                .limit(1)

            if (!structErr && Array.isArray(structs) && structs.length > 0) {
                defaultStructureId = structs[0].id
            }

            // Create a new "general" student fee record
            const insertObj: any = {
                school_id: schoolId,
                student_id: payment.student_id,
                academic_year: new Date().getFullYear().toString(),
                base_amount: 0,
                sibling_discount: 0,
                custom_discount: 0,
                late_fee_applied: 0,
                final_amount: 0,
                amount_paid: 0,
                status: 'pending',
                due_date: new Date().toISOString()
            }
            if (defaultStructureId) {
                insertObj.fee_structure_id = defaultStructureId
            }

            const { data: newFee, error: createError } = await supabase
                .from('student_fees')
                .insert(insertObj)
                .select()
                .single()

            if (createError) throw new Error(`Failed to create student fee: ${createError.message}`)
            existingFee = newFee
        }

        if (existingFee.status === 'waived') throw new Error('Cannot record payment against a waived fee')

        // Record the payment
        const receipt = payment.receipt_number || `RP-${crypto.randomUUID().split('-')[0]}`
        const { data, error } = await supabase
            .from('fee_payments')
            .insert({
                school_id: schoolId,
                student_fee_id: existingFee.id,
                amount: payment.amount,
                payment_method: payment.payment_method || 'cash',
                payment_date: payment.payment_date || new Date().toISOString(),
                comment: payment.comment,
                is_lunch_payment: payment.is_lunch_payment || false,
                file_url: payment.file_url,
                receipt_number: receipt,
                created_by: payment.created_by,
                manual_receipt_number: payment.manual_receipt_number || null
            })
            .select(`
                *,
                created_by_profile:created_by(first_name, last_name)
            `)
            .single()

        if (error) throw new Error(`Failed to record payment: ${error.message}`)
        return data
    }

    /**
     * Recompute a student_fee's amount_paid/status from the remaining fee_payments rows.
     * Mirrors the logic of the DB trigger `update_fee_after_payment`, which only fires
     * on INSERT — this keeps balances correct after payment edits/deletes too.
     */
    private async recomputeFeeBalance(studentFeeId: string, schoolId: string): Promise<void> {
        const { data: payments, error: paymentsError } = await supabase
            .from('fee_payments')
            .select('amount')
            .eq('student_fee_id', studentFeeId)

        if (paymentsError) throw new Error(`Failed to recompute fee balance: ${paymentsError.message}`)

        const { data: fee, error: feeError } = await supabase
            .from('student_fees')
            .select('final_amount')
            .eq('id', studentFeeId)
            .eq('school_id', schoolId)
            .single()

        if (feeError || !fee) throw new Error('Failed to recompute fee balance: student fee not found')

        const totalPaid = round2((payments || []).reduce((sum, p: any) => sum + Number(p.amount || 0), 0))
        const status = totalPaid >= fee.final_amount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending'

        const { error: updateError } = await supabase
            .from('student_fees')
            .update({ amount_paid: totalPaid, status, updated_at: new Date().toISOString() })
            .eq('id', studentFeeId)
            .eq('school_id', schoolId)

        if (updateError) throw new Error(`Failed to update fee balance: ${updateError.message}`)
    }

    /**
     * Delete a payment
     */
    async deletePayment(paymentId: string, schoolId: string): Promise<void> {
        const { data: payment, error: fetchError } = await supabase
            .from('fee_payments')
            .select('student_fee_id')
            .eq('id', paymentId)
            .eq('school_id', schoolId)
            .single()

        if (fetchError || !payment) throw new Error('Payment not found')

        const { error } = await supabase
            .from('fee_payments')
            .delete()
            .eq('id', paymentId)
            .eq('school_id', schoolId)

        if (error) throw new Error(`Failed to delete payment: ${error.message}`)

        await this.recomputeFeeBalance(payment.student_fee_id, schoolId)
    }

    /**
     * Update a payment
     */
    async updatePayment(
        paymentId: string,
        schoolId: string,
        updates: {
            amount?: number
            payment_date?: string
            comment?: string
            is_lunch_payment?: boolean
            file_url?: string
            receipt_number?: string
            payment_method?: string
            manual_receipt_number?: string
        }
    ): Promise<any> {
        const { data, error } = await supabase
            .from('fee_payments')
            .update({ ...updates })
            .eq('id', paymentId)
            .eq('school_id', schoolId)
            .select(`
                *,
                created_by_profile:created_by(first_name, last_name)
            `)
            .single()

        if (error) throw new Error(`Failed to update payment: ${error.message}`)

        if (data?.student_fee_id) {
            await this.recomputeFeeBalance(data.student_fee_id, schoolId)
        }

        return data
    }

    // ==========================================
    // FEE GENERATION
    // ==========================================

    /**
     * Load active student_fee_overrides for a student/academic year as a
     * fee_category_id -> override_amount map. Shared by all fee-generation
     * paths so overrides are honored consistently everywhere.
     */
    private async getActiveOverrideMap(studentId: string, academicYear: string, schoolId: string): Promise<Map<string, number>> {
        const { data, error } = await supabase
            .from('student_fee_overrides')
            .select('fee_category_id, override_amount')
            .eq('student_id', studentId)
            .eq('academic_year', academicYear)
            .eq('is_active', true)

        if (error) throw new Error(`Failed to load fee overrides: ${error.message}`)

        const map = new Map<string, number>()
        for (const row of data || []) map.set(row.fee_category_id, row.override_amount)
        return map
    }

    async generateFeesForStudent(
        studentId: string,
        schoolId: string,
        academicYear: string,
        feeStructureId: string
    ): Promise<StudentFee> {
        // Get fee structure
        const { data: structure, error: structError } = await supabase
            .from('fee_structures')
            .select('*, fee_categories!inner(*)')
            .eq('id', feeStructureId)
            .single()

        if (structError || !structure) throw new Error('Fee structure not found')

        const overrideMap = await this.getActiveOverrideMap(studentId, academicYear, schoolId)
        const hasOverride = overrideMap.has(structure.fee_category_id)
        const baseAmount = hasOverride ? overrideMap.get(structure.fee_category_id)! : structure.amount

        // Calculate sibling discount
        const siblingDiscount = await this.calculateSiblingDiscount(
            studentId,
            schoolId,
            structure.fee_category_id,
            baseAmount
        )

        const finalAmount = baseAmount - siblingDiscount

        // Create student fee record
        const { data, error } = await supabase
            .from('student_fees')
            .insert({
                school_id: schoolId,
                student_id: studentId,
                fee_structure_id: feeStructureId,
                academic_year: academicYear,
                base_amount: baseAmount,
                sibling_discount: siblingDiscount,
                custom_discount: 0,
                late_fee_applied: 0,
                final_amount: finalAmount,
                amount_paid: 0,
                status: 'pending',
                due_date: structure.due_date
            })
            .select()
            .single()

        if (error) throw new Error(`Failed to generate fee: ${error.message}`)
        return data
    }

    // ==========================================
    // DISCOUNT MANAGEMENT
    // ==========================================

    async restoreDiscount(feeId: string, schoolId: string, adminId: string): Promise<StudentFee> {
        // Check if admin can restore discounts
        const settings = await this.getFeeSettings(schoolId)
        if (!settings?.admin_can_restore_discounts) {
            throw new Error('Discount restoration is disabled for this school')
        }

        const { data, error } = await supabase
            .from('student_fees')
            .update({
                discount_forfeited: false,
                discount_restored_by: adminId,
                updated_at: new Date().toISOString()
            })
            .eq('id', feeId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to restore discount: ${error.message}`)
        return data
    }

    async waiveFee(feeId: string, schoolId: string, notes?: string): Promise<StudentFee> {
        const { data, error } = await supabase
            .from('student_fees')
            .update({
                status: 'waived',
                notes: notes || 'Fee waived by admin',
                updated_at: new Date().toISOString()
            })
            .eq('id', feeId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to waive fee: ${error.message}`)
        return data
    }

    // ==========================================
    // DASHBOARD STATS
    // ==========================================

    async getFeeDashboardStats(schoolId: string, academicYear?: string): Promise<any> {
        let query = supabase
            .from('student_fees')
            .select('status, final_amount, amount_paid')
            .eq('school_id', schoolId)

        if (academicYear) {
            query = query.eq('academic_year', academicYear)
        }

        const { data, error } = await query

        if (error) throw new Error(`Failed to get fee stats: ${error.message}`)

        const stats = {
            total_fees: 0,
            total_collected: 0,
            total_pending: 0,
            total_overdue: 0,
            counts: {
                pending: 0,
                partial: 0,
                paid: 0,
                overdue: 0,
                waived: 0
            }
        }

        data?.forEach((fee: any) => {
            stats.total_fees += fee.final_amount
            stats.total_collected += fee.amount_paid
            stats.counts[fee.status as keyof typeof stats.counts]++

            if (fee.status === 'pending' || fee.status === 'partial') {
                stats.total_pending += fee.final_amount - fee.amount_paid
            }
            if (fee.status === 'overdue') {
                stats.total_overdue += fee.final_amount - fee.amount_paid
            }
        })

        return stats
    }

    // ==========================================
    // LATE FEE AUTOMATION
    // ==========================================

    /**
     * Apply late fees for a specific school
     * Can be triggered manually by admin or via cron
     */
    async applyLateFees(schoolId: string): Promise<{ feesUpdated: number; discountsForfeited: number }> {
        const settings = await this.getFeeSettings(schoolId)
        if (!settings?.enable_late_fees) {
            return { feesUpdated: 0, discountsForfeited: 0 }
        }

        const today = new Date()
        const graceDate = new Date()
        graceDate.setDate(today.getDate() - settings.grace_days)

        // Get overdue fees that haven't had late fee applied
        const { data: overdueFees, error } = await supabase
            .from('student_fees')
            .select('*')
            .eq('school_id', schoolId)
            .in('status', ['pending', 'partial'])
            .lt('due_date', graceDate.toISOString().split('T')[0])
            .eq('late_fee_applied', 0)

        if (error) throw new Error(`Failed to get overdue fees: ${error.message}`)

        let feesUpdated = 0
        let discountsForfeited = 0

        for (const fee of overdueFees || []) {
            // Calculate late fee
            let lateFee = 0
            if (settings.late_fee_type === 'percentage') {
                lateFee = round2((fee.final_amount * settings.late_fee_value) / 100)
            } else {
                lateFee = round2(settings.late_fee_value)
            }

            // Apply late fee
            const updates: any = {
                late_fee_applied: lateFee,
                final_amount: round2(fee.final_amount + lateFee),
                status: 'overdue',
                updated_at: new Date().toISOString()
            }

            // Forfeit discount if enabled
            if (settings.discount_forfeiture_enabled && !fee.discount_forfeited) {
                updates.discount_forfeited = true
                discountsForfeited++
            }

            await supabase
                .from('student_fees')
                .update(updates)
                .eq('id', fee.id)

            feesUpdated++
        }

        return { feesUpdated, discountsForfeited }
    }

    /**
     * Apply late fees for ALL schools
     * Called by global cron job
     */
    async applyLateFeesGlobal(): Promise<{
        schoolsProcessed: number
        totalFeesUpdated: number
        totalDiscountsForfeited: number
    }> {
        // Get all schools with late fees enabled
        const { data: feeSettings, error } = await supabase
            .from('fee_settings')
            .select('school_id')
            .eq('enable_late_fees', true)

        if (error) throw new Error(`Failed to get schools: ${error.message}`)

        let totalFeesUpdated = 0
        let totalDiscountsForfeited = 0

        for (const setting of feeSettings || []) {
            try {
                const result = await this.applyLateFees(setting.school_id)
                totalFeesUpdated += result.feesUpdated
                totalDiscountsForfeited += result.discountsForfeited
            } catch (err) {
                console.error(`Failed to apply late fees for school ${setting.school_id}:`, err)
            }
        }

        return {
            schoolsProcessed: feeSettings?.length || 0,
            totalFeesUpdated,
            totalDiscountsForfeited
        }
    }

    // ==========================================
    // MONTHLY FEE GENERATION
    // ==========================================

    /**
     * Generate monthly fees for all students in a school
     * Includes base tuition + services - discounts
     */
    async generateMonthlyFees(
        schoolId: string,
        month?: number,
        year?: number,
        academicYear?: string,
        gradeLevelId?: string | string[],
        sectionId?: string | string[],
        categoryIds?: string[],
        campusId?: string,
        // Appended at the end, both default to today's monthly behavior, so
        // every existing caller (cron job, older frontend builds) keeps
        // working unchanged.
        periodType: 'monthly' | 'termly' | 'quarterly' | 'semester' | 'annual' | 'one_time' = 'monthly',
        // Required when periodType is termly/quarterly/semester (a grade can
        // have several structures of that period_type — one per term/quarter/
        // semester — so this picks exactly one). Not used for annual/one_time,
        // where a grade normally has a single active structure per year.
        periodNumber?: number
    ): Promise<{
        studentsProcessed: number
        feesCreated: number
        totalAmount: number
        // Diagnostics: when feesCreated is 0 despite students existing, these
        // pinpoint which stage filtered everyone out (mismatched grade_level_id
        // between students and fee_structures — e.g. created under a different
        // campus context — is a common cause) instead of just "0 for 0".
        studentsFound: number
        skippedAlreadyExists: number
        skippedNoFeeStructures: number
        skippedZeroAmount: number
        skippedNoGrade: number
        skippedError: number
    }> {
        try {
            // Use campus-specific school ID if provided, otherwise use the provided school ID
            const effectiveSchoolId = campusId || schoolId;

            // Get students with proper campus filtering
            let studentsQuery = supabase
                .from('students')
                .select(`
                    id,
                    student_number,
                    grade_level_id,
                    profiles!inner(first_name, last_name)
                `)
                .eq('school_id', effectiveSchoolId);

            if (gradeLevelId) {
                studentsQuery = Array.isArray(gradeLevelId)
                    ? studentsQuery.in('grade_level_id', gradeLevelId)
                    : studentsQuery.eq('grade_level_id', gradeLevelId);
            }

            // NOTE: sectionId used to be accepted here but silently never applied
            // to the query — the Section filter on the bulk-generate page did
            // nothing. Now actually filters.
            if (sectionId) {
                studentsQuery = Array.isArray(sectionId)
                    ? studentsQuery.in('section_id', sectionId)
                    : studentsQuery.eq('section_id', sectionId);
            }

            const { data: students, error: studentsError } = await studentsQuery;
            if (studentsError) throw studentsError;

            if (!students || students.length === 0) {
                return {
                    studentsProcessed: 0,
                    feesCreated: 0,
                    totalAmount: 0,
                    studentsFound: 0,
                    skippedAlreadyExists: 0,
                    skippedNoFeeStructures: 0,
                    skippedZeroAmount: 0,
                    skippedNoGrade: 0,
                    skippedError: 0
                };
            }

            // Get the current academic year if not provided
            let currentAcademicYear = academicYear;
            if (!currentAcademicYear) {
                const { data: academicYearData } = await supabase
                    .from('academic_years')
                    .select('name')
                    .eq('school_id', effectiveSchoolId)
                    .eq('is_current', true)
                    .single();

                if (academicYearData) {
                    currentAcademicYear = academicYearData.name;
                } else {
                    // Generate default academic year
                    const now = new Date();
                    const currentYear = now.getFullYear();
                    const currentMonth = now.getMonth() + 1;
                    if (currentMonth >= 7) {
                        currentAcademicYear = `${currentYear}-${currentYear + 1}`;
                    } else {
                        currentAcademicYear = `${currentYear - 1}-${currentYear}`;
                    }
                }
            }

            // Calculate month and year for fee generation (only meaningful
            // when periodType === 'monthly' — still computed unconditionally
            // since it's cheap and used as the due-date fallback below).
            const now = new Date();
            const targetMonth = month || (now.getMonth() + 2); // Next month
            const targetYear = year || (targetMonth > 12 ? now.getFullYear() + 1 : now.getFullYear());
            const normalizedMonth = targetMonth > 12 ? targetMonth - 12 : targetMonth;
            const feeMonth = `${targetYear}-${normalizedMonth.toString().padStart(2, '0')}`;
            const isMonthly = periodType === 'monthly';

            let studentsProcessed = 0;
            let feesCreated = 0;
            let totalAmount = 0;
            let skippedAlreadyExists = 0;
            let skippedNoFeeStructures = 0;
            let skippedZeroAmount = 0;
            let skippedNoGrade = 0;
            let skippedError = 0;

            // Process each student
            for (const student of students) {
              try {
                // A student with no grade_level_id would make the fee_structures
                // .eq('grade_level_id', student.grade_level_id) query below send a
                // literal "null" string for a UUID column — Postgres rejects that
                // ("invalid input syntax for type uuid: \"null\"") and, being
                // unhandled, that error used to abort generation for every OTHER
                // student in the batch too, not just this one. Skip explicitly.
                if (!student.grade_level_id) {
                    skippedNoGrade++;
                    continue;
                }

                if (isMonthly) {
                    // Monthly de-dup: has this student already been billed for
                    // this exact calendar month? Checked before fetching fee
                    // structures — cheap early-out for the common repeat-run case.
                    const { data: existingFee, error: existingFeeError } = await supabase
                        .from('student_fees')
                        .select('id')
                        .eq('student_id', student.id)
                        .eq('fee_month', feeMonth)
                        .eq('school_id', effectiveSchoolId)
                        .single();

                    if (existingFeeError && existingFeeError.code !== 'PGRST116') {
                        console.error(`Failed to check existing fee for student ${student.id}:`, existingFeeError);
                        skippedError++;
                        continue; // Don't silently treat a real error as "not found"
                    }

                    if (existingFee) {
                        skippedAlreadyExists++;
                        continue; // Skip if already generated
                    }
                }

                // Get fee structures for this grade level, categories, AND
                // period — period_type is the fix for the core bug: without
                // it, a run for one period_type would pick up (and sum in)
                // every OTHER period_type's structures too (e.g. an annual
                // exam fee getting billed alongside monthly tuition).
                // periodNumber narrows further to exactly one term/quarter/
                // semester when a grade has several structures of that type.
                let feeStructuresQuery = supabase
                    .from('fee_structures')
                    .select('*, fee_categories!inner(name, code)')
                    .eq('school_id', effectiveSchoolId)
                    .eq('grade_level_id', student.grade_level_id)
                    .eq('academic_year', currentAcademicYear)
                    .eq('is_active', true)
                    .eq('period_type', periodType);

                if (periodNumber !== undefined && periodNumber !== null) {
                    feeStructuresQuery = feeStructuresQuery.eq('period_number', periodNumber);
                }

                if (categoryIds && categoryIds.length > 0) {
                    feeStructuresQuery = feeStructuresQuery.in('fee_category_id', categoryIds);
                }

                const { data: feeStructures, error: structuresError } = await feeStructuresQuery;
                if (structuresError) throw structuresError;

                if (!feeStructures || feeStructures.length === 0) {
                    skippedNoFeeStructures++;
                    console.warn(`No matching fee structures for student ${student.id} (grade_level_id=${student.grade_level_id}, academic_year=${currentAcademicYear}, school_id=${effectiveSchoolId}, period_type=${periodType})`);
                    continue; // Skip if no fee structures found
                }

                if (!isMonthly) {
                    // Non-monthly de-dup: has this student already been billed
                    // under ANY of these exact structure rows this year? Each
                    // term/semester is its own fee_structures row (distinct
                    // period_number), so this naturally lets Term 2 through
                    // once Term 1 is billed, while blocking a repeat run of
                    // the same term/semester/annual/one-time structure.
                    const structureIds = feeStructures.map((s) => s.id);
                    const { data: existingFees, error: existingFeeError } = await supabase
                        .from('student_fees')
                        .select('id')
                        .eq('student_id', student.id)
                        .eq('school_id', effectiveSchoolId)
                        .eq('academic_year', currentAcademicYear)
                        .in('fee_structure_id', structureIds)
                        .limit(1);

                    if (existingFeeError) {
                        console.error(`Failed to check existing fee for student ${student.id}:`, existingFeeError);
                        skippedError++;
                        continue;
                    }

                    if (existingFees && existingFees.length > 0) {
                        skippedAlreadyExists++;
                        continue;
                    }
                }

                // Fetch any student-specific fee overrides for this academic year
                const overrideMap = await this.getActiveOverrideMap(student.id, currentAcademicYear!, effectiveSchoolId);

                // Calculate total fee amount and create breakdown details
                let totalFeeAmount = 0;
                const feeBreakdown: any[] = [];

                for (const structure of feeStructures) {
                    // Check if there's an override for this category
                    const hasOverride = overrideMap.has(structure.fee_category_id);
                    const categoryAmount = hasOverride
                        ? overrideMap.get(structure.fee_category_id)!
                        : (structure.amount || 0);

                    if (categoryAmount > 0) {
                        totalFeeAmount += categoryAmount;
                        feeBreakdown.push({
                            category_id: structure.fee_category_id,
                            category_name: structure.fee_categories?.name || 'Fee',
                            category_code: structure.fee_categories?.code || '',
                            amount: categoryAmount,
                            is_override: hasOverride,
                            original_amount: hasOverride ? structure.amount : undefined
                        });
                    }
                }

                if (totalFeeAmount === 0) {
                    skippedZeroAmount++;
                    continue; // Skip if no fees to charge
                }

                // Calculate sibling discount on total amount
                const totalSiblingDiscount = await this.calculateSiblingDiscount(
                    student.id,
                    effectiveSchoolId,
                    feeStructures[0].fee_category_id,
                    totalFeeAmount
                );

                const finalAmount = totalFeeAmount - totalSiblingDiscount;

                if (finalAmount <= 0) {
                    skippedZeroAmount++;
                    continue; // Skip if final amount is zero or negative
                }

                // Create single fee record with breakdown details stored as JSON
                // Built directly as a string (not via Date + toISOString) to avoid UTC
                // round-tripping shifting the date by a day depending on server timezone.
                // Non-monthly: label the record with the structure's own
                // period_name ("Semester 1") instead of a calendar month, and
                // default the due date to the structure's own due_date column
                // (set once at structure-definition time) rather than forcing
                // a month-based one on a fee that isn't monthly.
                const effectiveFeeMonth = isMonthly ? feeMonth : (feeStructures[0].period_name || periodType);
                const dueDate = isMonthly
                    ? `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-05`
                    : (feeStructures[0].due_date || `${targetYear}-${String(normalizedMonth).padStart(2, '0')}-05`);
                const { data: createdFee, error: createError } = await supabase
                    .from('student_fees')
                    .insert({
                        student_id: student.id,
                        school_id: effectiveSchoolId,
                        fee_structure_id: feeStructures[0].id, // Primary structure reference
                        academic_year: currentAcademicYear,
                        fee_month: effectiveFeeMonth,
                        due_date: dueDate,
                        base_amount: totalFeeAmount,
                        sibling_discount: totalSiblingDiscount,
                        custom_discount: 0,
                        late_fee_applied: 0,
                        final_amount: finalAmount,
                        amount_paid: 0,
                        status: 'pending',
                        fee_breakdown: JSON.stringify(feeBreakdown) // Store category-wise breakdown
                    })
                    .select()
                    .single();

                if (createError) {
                    console.error(`Failed to create fee for student ${student.id}:`, createError);
                    skippedError++;
                    continue;
                }

                studentsProcessed++;
                feesCreated++;
                totalAmount += finalAmount;
              } catch (perStudentError: any) {
                // A DB error for one student (e.g. an unexpected null/invalid
                // field) must not abort generation for the rest of the batch.
                console.error(`Error generating fee for student ${student.id}, skipping:`, perStudentError?.message || perStudentError);
                skippedError++;
              }
            }

            if (feesCreated === 0) {
                console.warn(
                    `generateMonthlyFees produced 0 fees for school_id=${effectiveSchoolId}, ` +
                    `academic_year=${currentAcademicYear}, period_type=${periodType}${periodNumber !== undefined ? `, period_number=${periodNumber}` : ''}${isMonthly ? `, fee_month=${feeMonth}` : ''}: ` +
                    `${students.length} student(s) found, ${skippedNoGrade} had no grade assigned, ` +
                    `${skippedAlreadyExists} already had a fee, ` +
                    `${skippedNoFeeStructures} had no matching fee structure, ` +
                    `${skippedZeroAmount} computed to a zero/negative amount, ${skippedError} hit an error.`
                );
            }

            return {
                studentsProcessed,
                feesCreated,
                totalAmount,
                studentsFound: students.length,
                skippedNoGrade,
                skippedAlreadyExists,
                skippedNoFeeStructures,
                skippedZeroAmount,
                skippedError
            };

        } catch (error: any) {
            throw new Error(`Failed to generate monthly fees: ${error.message}`)
        }
    }

    /**
     * Generate monthly fees for all schools (cron job)
     */
    async generateMonthlyFeesAllSchools(
        month?: number,
        year?: number
    ): Promise<{
        schools: Array<{
            schoolId: string
            schoolName: string
            studentsProcessed: number
            feesCreated: number
            totalAmount: number
        }>
        totalFeesCreated: number
        grandTotal: number
    }> {
        const { data, error } = await supabase.rpc('generate_monthly_fees_all_schools', {
            p_month: month || null,
            p_year: year || null
        })

        if (error) {
            throw new Error(`Failed to generate fees for all schools: ${error.message}`)
        }

        const schools = (data || []).map((row: any) => ({
            schoolId: row.school_id,
            schoolName: row.school_name,
            studentsProcessed: row.students_processed,
            feesCreated: row.fees_created,
            totalAmount: row.total_amount
        }))

        return {
            schools,
            totalFeesCreated: schools.reduce((sum: number, s: any) => sum + s.feesCreated, 0),
            grandTotal: schools.reduce((sum: number, s: any) => sum + s.totalAmount, 0)
        }
    }

    // ==========================================
    // FEE ADJUSTMENTS (Admin Overrides)
    // ==========================================

    async adjustFee(
        feeId: string,
        schoolId: string,
        adminId: string,
        adjustment: {
            type: 'late_fee_removed' | 'late_fee_reduced' | 'custom_discount' | 'fee_waived' | 'discount_restored'
            newLateFee?: number
            customDiscount?: number
            reason: string
        }
    ): Promise<StudentFee> {
        // Get current fee
        const { data: fee, error: fetchError } = await supabase
            .from('student_fees')
            .select('*')
            .eq('id', feeId)
            .eq('school_id', schoolId)
            .single()

        if (fetchError || !fee) throw new Error('Fee record not found')

        if (adjustment.newLateFee !== undefined && adjustment.newLateFee < 0) {
            throw new Error('New late fee amount must not be negative')
        }
        if (adjustment.customDiscount !== undefined) {
            if (adjustment.customDiscount < 0) {
                throw new Error('Discount amount must not be negative')
            }
            if (adjustment.customDiscount > fee.base_amount) {
                throw new Error('Discount amount must not exceed the fee base amount')
            }
        }

        const amountBefore = fee.final_amount
        let updates: any = { updated_at: new Date().toISOString() }
        let adjustmentAmount = 0

        switch (adjustment.type) {
            case 'late_fee_removed':
                adjustmentAmount = round2(-fee.late_fee_applied)
                updates.late_fee_applied = 0
                updates.final_amount = Math.max(0, round2(fee.base_amount - fee.sibling_discount - fee.custom_discount))
                break

            case 'late_fee_reduced':
                if (adjustment.newLateFee === undefined) throw new Error('New late fee amount required')
                adjustmentAmount = round2(adjustment.newLateFee - fee.late_fee_applied)
                updates.late_fee_applied = round2(adjustment.newLateFee)
                updates.final_amount = Math.max(0, round2(fee.base_amount - fee.sibling_discount - fee.custom_discount + adjustment.newLateFee))
                break

            case 'custom_discount':
                if (adjustment.customDiscount === undefined) throw new Error('Discount amount required')
                adjustmentAmount = round2(-adjustment.customDiscount)
                updates.custom_discount = round2((fee.custom_discount || 0) + adjustment.customDiscount)
                updates.discount_reason = adjustment.reason
                updates.final_amount = Math.max(0, round2(fee.base_amount - fee.sibling_discount - updates.custom_discount + fee.late_fee_applied))
                break

            case 'fee_waived':
                adjustmentAmount = round2(-fee.final_amount)
                updates.status = 'waived'
                updates.notes = adjustment.reason
                break

            case 'discount_restored':
                updates.discount_forfeited = false
                updates.discount_restored_by = adminId
                break
        }

        // Update the fee
        const { data: updatedFee, error: updateError } = await supabase
            .from('student_fees')
            .update(updates)
            .eq('id', feeId)
            .select()
            .single()

        if (updateError) throw new Error(`Failed to adjust fee: ${updateError.message}`)

        // Log the adjustment for audit
        const { error: adjustmentLogError } = await supabase.from('fee_adjustments').insert({
            school_id: schoolId,
            student_fee_id: feeId,
            adjusted_by: adminId,
            adjustment_type: adjustment.type,
            amount_before: amountBefore,
            amount_after: updatedFee.final_amount,
            adjustment_amount: adjustmentAmount,
            reason: adjustment.reason
        })

        if (adjustmentLogError) throw new Error(`Failed to log fee adjustment: ${adjustmentLogError.message}`)

        return updatedFee
    }

    async getFeeAdjustments(feeId: string, schoolId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('fee_adjustments')
            .select(`
                *,
                adjusted_by_profile:profiles!adjusted_by(first_name, last_name)
            `)
            .eq('student_fee_id', feeId)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to get adjustments: ${error.message}`)
        return data || []
    }

    // ==========================================
    // STUDENT FEE HISTORY
    // ==========================================

    async getStudentFeeHistory(
        studentId: string,
        schoolId: string,
        options: {
            academicYear?: string
            status?: string
            page?: number
            limit?: number
        } = {}
    ): Promise<{
        data: StudentFee[]
        total: number
        summary: { totalBilled: number; totalPaid: number; totalDue: number }
    }> {
        const { academicYear, status, page = 1, limit = 50 } = options
        const offset = (page - 1) * limit

        let query = supabase
            .from('student_fees')
            .select(`
                *,
                fee_structures(
                    fee_categories(name, code),
                    period_type,
                    period_name
                )
            `, { count: 'exact' })
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('due_date', { ascending: false })
            .range(offset, offset + limit - 1)

        if (academicYear) query = query.eq('academic_year', academicYear)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query

        if (error) throw new Error(`Failed to get fee history: ${error.message}`)

        // Calculate summary
        const allFees = data || []
        const summary = {
            totalBilled: allFees.reduce((sum, f) => sum + f.final_amount, 0),
            totalPaid: allFees.reduce((sum, f) => sum + f.amount_paid, 0),
            totalDue: allFees.reduce((sum, f) => sum + (f.final_amount - f.amount_paid), 0)
        }

        return { data: allFees, total: count || 0, summary }
    }

    // ==========================================
    // ON-THE-SPOT FEE GENERATION (New Student)
    // ==========================================

    async generateFeeForNewStudent(
        studentId: string,
        schoolId: string,
        gradeId: string,
        selectedServiceIds: string[],
        options: {
            academicYear: string
            feeMonth?: string // Format: "2026-01" — required when periodType is 'monthly'
            dueDate?: string  // ISO date string — required when periodType is 'monthly'
            categoryIds?: string[] | null // Optional: filter by specific categories
            // Both default to today's monthly behavior — existing callers
            // (e.g. AddStudentForm's "generate first challan") keep working
            // unchanged.
            periodType?: 'monthly' | 'termly' | 'quarterly' | 'semester' | 'annual' | 'one_time'
            periodNumber?: number
        }
    ): Promise<StudentFee> {
        const periodType = options.periodType || 'monthly'
        const isMonthly = periodType === 'monthly'

        if (isMonthly && (!options.feeMonth || !options.dueDate)) {
            throw new Error('feeMonth and dueDate are required for monthly fee generation')
        }

        // 1. Get fee structures for this grade (there can be multiple categories)
        // Also include school-wide structures where grade_level_id is null.
        // period_type is the same fix as generateMonthlyFees: without it a
        // "termly" run would also pick up (and sum in) monthly/annual/etc.
        // structures for the same grade.
        let gradeQuery = supabase
            .from('fee_structures')
            .select('*, fee_categories!inner(*)')
            .eq('school_id', schoolId)
            .eq('grade_level_id', gradeId)
            .eq('academic_year', options.academicYear)
            .eq('is_active', true)
            .eq('period_type', periodType)
        let globalQuery = supabase
            .from('fee_structures')
            .select('*, fee_categories!inner(*)')
            .eq('school_id', schoolId)
            .is('grade_level_id', null)
            .eq('academic_year', options.academicYear)
            .eq('is_active', true)
            .eq('period_type', periodType)
        if (options.periodNumber !== undefined && options.periodNumber !== null) {
            gradeQuery = gradeQuery.eq('period_number', options.periodNumber)
            globalQuery = globalQuery.eq('period_number', options.periodNumber)
        }
        // Filter by specific categories if provided
        if (options.categoryIds && options.categoryIds.length > 0) {
            gradeQuery = gradeQuery.in('fee_category_id', options.categoryIds)
            globalQuery = globalQuery.in('fee_category_id', options.categoryIds)
        }

        const { data: gradeStructures, error: gradeError } = await gradeQuery
        const { data: globalStructures, error: globalError } = await globalQuery

        // Merge grade-specific and school-wide (null grade) structures
        const feeStructures = [
            ...(gradeStructures || []),
            ...(globalStructures || [])
        ]

        // Check if any fee structures exist
        if ((gradeError && globalError) || feeStructures.length === 0) {
            throw new Error(
                `No active fee structure found for this grade level. Please configure fee structures in Settings before generating fees.`
            )
        }

        // De-dup: monthly checks the exact fee_month; non-monthly checks
        // whether this student already has a fee under any of these exact
        // structure rows this year (mirrors generateMonthlyFees).
        let dedupQuery = supabase
            .from('student_fees')
            .select('id')
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .eq('academic_year', options.academicYear)
        dedupQuery = isMonthly
            ? dedupQuery.eq('fee_month', options.feeMonth as string)
            : dedupQuery.in('fee_structure_id', feeStructures.map((s) => s.id))
        const { data: existingFees, error: dedupError } = await dedupQuery.limit(1)
        if (dedupError) throw new Error(`Failed to check existing fee: ${dedupError.message}`)
        if (existingFees && existingFees.length > 0) {
            throw new Error('A fee has already been generated for this student for this period.')
        }

        // Sum up all category amounts into a single base amount with breakdown,
        // applying any active student-specific fee overrides
        const overrideMap = await this.getActiveOverrideMap(studentId, options.academicYear, schoolId)
        let baseAmount = 0
        const feeBreakdown: any[] = []
        for (const structure of feeStructures) {
            const hasOverride = overrideMap.has(structure.fee_category_id)
            const categoryAmount = hasOverride ? overrideMap.get(structure.fee_category_id)! : (structure.amount || 0)
            if (categoryAmount > 0) {
                baseAmount += categoryAmount
                feeBreakdown.push({
                    category_id: structure.fee_category_id,
                    category_name: structure.fee_categories?.name || 'Fee',
                    category_code: structure.fee_categories?.code || '',
                    amount: categoryAmount,
                    is_override: hasOverride,
                    original_amount: hasOverride ? structure.amount : undefined
                })
            }
        }

        // Use first structure as primary reference
        let feeStructureId = feeStructures[0].id

        // 2. Calculate services total
        let servicesAmount = 0
        if (selectedServiceIds.length > 0) {
            const { data: services } = await supabase
                .from('school_services')
                .select('id, default_charge')
                .in('id', selectedServiceIds)
                .eq('is_active', true)

            servicesAmount = (services || []).reduce((sum, s) => sum + (s.default_charge || 0), 0)
        }

        const subtotal = baseAmount + servicesAmount

        // 3. Calculate sibling discount
        const siblingDiscount = await this.calculateSiblingDiscount(
            studentId,
            schoolId,
            feeStructures[0]?.fee_category_id || '',
            subtotal
        )

        const finalAmount = subtotal - siblingDiscount

        // Non-monthly: label with the structure's own period_name and default
        // the due date to the structure's own due_date column, same as
        // generateMonthlyFees.
        const effectiveFeeMonth = isMonthly ? (options.feeMonth as string) : (feeStructures[0].period_name || periodType)
        const effectiveDueDate = isMonthly ? (options.dueDate as string) : (feeStructures[0].due_date || options.dueDate)

        // 4. Create the student fee record
        const { data: newFee, error: insertError } = await supabase
            .from('student_fees')
            .insert({
                school_id: schoolId,
                student_id: studentId,
                fee_structure_id: feeStructureId,
                academic_year: options.academicYear,
                fee_month: effectiveFeeMonth,
                base_amount: baseAmount,
                services_amount: servicesAmount,
                sibling_discount: siblingDiscount,
                custom_discount: 0,
                late_fee_applied: 0,
                final_amount: finalAmount,
                amount_paid: 0,
                status: 'pending',
                due_date: effectiveDueDate,
                fee_breakdown: JSON.stringify(feeBreakdown)
            })
            .select()
            .single()

        if (insertError) throw new Error(`Failed to generate fee: ${insertError.message}`)

        return newFee
    }

    // ==========================================
    // GET FEES BY GRADE (Admin Browse)
    // ==========================================

    async getFeesByGrade(
        schoolId: string,
        options: {
            gradeLevelIds?: string[]
            sectionIds?: string[]
            feeMonth?: string
            status?: string
            page?: number
            limit?: number
        }
    ): Promise<{ data: any[]; total: number }> {
        const { gradeLevelIds, sectionIds, feeMonth, status, page = 1, limit = 30 } = options
        const offset = (page - 1) * limit

        let query = supabase
            .from('student_fees')
            .select(`
                *,
                students!inner(
                    id, student_number, grade_level_id, section_id,
                    profiles!inner(first_name, last_name),
                    grade_levels(id, name),
                    sections(id, name)
                ),
                fee_structures(fee_categories(name, code))
            `, { count: 'exact' })
            .eq('school_id', schoolId)
            .order('due_date', { ascending: false })
            .range(offset, offset + limit - 1)

        if (gradeLevelIds && gradeLevelIds.length > 0) query = query.in('students.grade_level_id', gradeLevelIds)
        if (sectionIds && sectionIds.length > 0) query = query.in('students.section_id', sectionIds)
        if (feeMonth) query = query.like('fee_month', `%-${feeMonth}`)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query

        if (error) throw new Error(`Failed to get fees by grade: ${error.message}`)

        return { data: data || [], total: count || 0 }
    }

    // ==========================================
    // STUDENT FEE OVERRIDES
    // ==========================================

    /**
     * Create a student fee override
     * Allows setting a custom fee amount for a specific student and category
     */
    async createStudentFeeOverride(data: CreateStudentFeeOverrideDTO): Promise<StudentFeeOverride> {
        const { data: override, error } = await supabase
            .from('student_fee_overrides')
            .insert({
                school_id: data.school_id,
                student_id: data.student_id,
                fee_category_id: data.fee_category_id,
                academic_year: data.academic_year,
                override_amount: data.override_amount,
                reason: data.reason,
                created_by: data.created_by,
                is_active: true
            })
            .select(`
                *,
                fee_categories(name, code),
                students(profiles(first_name, last_name))
            `)
            .single()

        if (error) {
            if (error.code === '23505') {
                throw new Error('An override already exists for this student, category, and academic year')
            }
            throw new Error(`Failed to create fee override: ${error.message}`)
        }

        return override
    }

    /**
     * Get all fee overrides for a specific student
     */
    async getStudentFeeOverrides(
        studentId: string,
        schoolId: string,
        academicYear?: string
    ): Promise<StudentFeeOverride[]> {
        let query = supabase
            .from('student_fee_overrides')
            .select(`
                *,
                fee_categories(name, code),
                students(profiles(first_name, last_name))
            `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })

        if (academicYear) {
            query = query.eq('academic_year', academicYear)
        }

        const { data, error } = await query

        if (error) throw new Error(`Failed to get fee overrides: ${error.message}`)

        return data || []
    }

    /**
     * Get a single fee override by ID
     */
    async getStudentFeeOverrideById(overrideId: string, schoolId: string): Promise<StudentFeeOverride | null> {
        const { data, error } = await supabase
            .from('student_fee_overrides')
            .select(`
                *,
                fee_categories(name, code),
                students(profiles(first_name, last_name))
            `)
            .eq('id', overrideId)
            .eq('school_id', schoolId)
            .single()

        if (error) {
            if (error.code === 'PGRST116') return null
            throw new Error(`Failed to get fee override: ${error.message}`)
        }

        return data
    }

    /**
     * Update an existing fee override
     */
    async updateStudentFeeOverride(
        overrideId: string,
        schoolId: string,
        updates: UpdateStudentFeeOverrideDTO
    ): Promise<StudentFeeOverride> {
        const { data, error } = await supabase
            .from('student_fee_overrides')
            .update({
                ...(updates.override_amount !== undefined && { override_amount: updates.override_amount }),
                ...(updates.reason !== undefined && { reason: updates.reason }),
                ...(updates.is_active !== undefined && { is_active: updates.is_active })
            })
            .eq('id', overrideId)
            .eq('school_id', schoolId)
            .select(`
                *,
                fee_categories(name, code),
                students(profiles(first_name, last_name))
            `)
            .single()

        if (error) throw new Error(`Failed to update fee override: ${error.message}`)

        return data
    }

    /**
     * Delete a fee override
     */
    async deleteStudentFeeOverride(overrideId: string, schoolId: string): Promise<void> {
        const { error } = await supabase
            .from('student_fee_overrides')
            .delete()
            .eq('id', overrideId)
            .eq('school_id', schoolId)

        if (error) throw new Error(`Failed to delete fee override: ${error.message}`)
    }

    /**
     * Get all active fee overrides for a school (for admin overview)
     */
    async getAllSchoolFeeOverrides(
        schoolId: string,
        options?: {
            academicYear?: string
            feeCategoryId?: string
            isActive?: boolean
            page?: number
            limit?: number
        }
    ): Promise<{ data: StudentFeeOverride[]; total: number }> {
        const { academicYear, feeCategoryId, isActive = true, page = 1, limit = 50 } = options || {}
        const offset = (page - 1) * limit

        let query = supabase
            .from('student_fee_overrides')
            .select(`
                *,
                fee_categories(name, code),
                students(
                    id, student_number,
                    profiles(first_name, last_name),
                    grade_levels(name)
                )
            `, { count: 'exact' })
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (academicYear) query = query.eq('academic_year', academicYear)
        if (feeCategoryId) query = query.eq('fee_category_id', feeCategoryId)
        if (isActive !== undefined) query = query.eq('is_active', isActive)

        const { data, error, count } = await query

        if (error) throw new Error(`Failed to get school fee overrides: ${error.message}`)

        return { data: data || [], total: count || 0 }
    }
}

export const feesService = new FeesService()

