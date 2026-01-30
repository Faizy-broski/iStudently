import { supabase } from '../config/supabase'

export interface PayrollSettings {
    id: string
    school_id: string
    grace_late_count: number
    late_threshold_minutes: number
    deduction_type: 'percentage' | 'fixed' | 'per_minute'
    deduction_value: number
    absence_deduction_percent: number
    attendance_bonus_enabled: boolean
    attendance_bonus_amount: number
    max_advance_percent: number
    expected_check_in: string
    working_days_per_month: number
}

export interface SalaryStructure {
    id: string
    school_id: string
    staff_id: string
    base_salary: number
    allowances: Record<string, number>
    fixed_deductions: Record<string, number>
    effective_from: string
    effective_to?: string
    is_current: boolean
}

export interface SalaryRecord {
    id: string
    school_id: string
    staff_id: string
    salary_structure_id?: string
    month: number
    year: number
    base_salary: number
    total_allowances: number
    attendance_bonus: number
    total_deductions: number
    advance_deduction: number
    net_salary: number
    status: 'pending' | 'approved' | 'paid'
    payment_date?: string
}

export interface SalaryAdvance {
    id: string
    school_id: string
    staff_id: string
    amount: number
    reason?: string
    status: 'pending' | 'approved' | 'rejected' | 'recovered'
    approved_by?: string
    recovery_month?: number
    recovery_year?: number
}

export interface StaffAttendance {
    id: string
    school_id: string
    staff_id: string
    attendance_date: string
    check_in_time?: string
    check_out_time?: string
    expected_time: string
    late_minutes: number
    status: 'present' | 'absent' | 'late' | 'excused' | 'half_day' | 'leave'
    notes?: string
}

class SalaryService {
    // ==========================================
    // PAYROLL SETTINGS
    // ==========================================

    async getPayrollSettings(schoolId: string): Promise<PayrollSettings | null> {
        const { data, error } = await supabase
            .from('payroll_settings')
            .select('*')
            .eq('school_id', schoolId)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get payroll settings: ${error.message}`)
        }
        return data
    }

    async upsertPayrollSettings(schoolId: string, settings: Partial<PayrollSettings>): Promise<PayrollSettings> {
        const { data, error } = await supabase
            .from('payroll_settings')
            .upsert({
                school_id: schoolId,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'school_id' })
            .select()
            .single()

        if (error) throw new Error(`Failed to update payroll settings: ${error.message}`)
        return data
    }

    // ==========================================
    // SALARY STRUCTURES
    // ==========================================

    async getSalaryStructure(staffId: string, schoolId: string): Promise<SalaryStructure | null> {
        const { data, error } = await supabase
            .from('salary_structures')
            .select('*')
            .eq('staff_id', staffId)
            .eq('school_id', schoolId)
            .eq('is_current', true)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get salary structure: ${error.message}`)
        }
        return data
    }

    async getAllSalaryStructures(schoolId: string, campusId?: string): Promise<any[]> {
        // In multi-campus setup, use campusId as the primary filter
        // Otherwise use schoolId (for single-campus schools)
        const targetSchoolId = campusId || schoolId
        
        let query = supabase
            .from('salary_structures')
            .select(`
        *,
        staff!inner(
          id,
          title,
          employee_number,
          school_id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name, email)
        )
      `)
            .eq('school_id', targetSchoolId)
            .eq('is_current', true)
            .order('created_at', { ascending: false })

        // Also filter staff by campus to ensure they belong to the selected campus
        query = query.eq('staff.school_id', targetSchoolId)

        const { data, error } = await query

        if (error) throw new Error(`Failed to get salary structures: ${error.message}`)
        return data || []
    }

    async createSalaryStructure(structureData: Omit<SalaryStructure, 'id'>): Promise<SalaryStructure> {
        // Deactivate previous structure for this staff
        await supabase
            .from('salary_structures')
            .update({ is_current: false, effective_to: new Date().toISOString().split('T')[0] })
            .eq('staff_id', structureData.staff_id)
            .eq('school_id', structureData.school_id)
            .eq('is_current', true)

        // Create new structure
        const { data, error } = await supabase
            .from('salary_structures')
            .insert({
                ...structureData,
                is_current: true
            })
            .select()
            .single()

        if (error) throw new Error(`Failed to create salary structure: ${error.message}`)
        return data
    }

    // ==========================================
    // STAFF ATTENDANCE
    // ==========================================

    async recordAttendance(attendance: Omit<StaffAttendance, 'id'>): Promise<StaffAttendance> {
        // Calculate late minutes
        let lateMinutes = 0
        if (attendance.check_in_time && attendance.expected_time) {
            const checkIn = this.timeToMinutes(attendance.check_in_time)
            const expected = this.timeToMinutes(attendance.expected_time)
            lateMinutes = Math.max(0, checkIn - expected)
        }

        const status = lateMinutes > 0 ? 'late' : (attendance.status || 'present')

        const { data, error } = await supabase
            .from('staff_attendance')
            .upsert({
                ...attendance,
                late_minutes: lateMinutes,
                status
            }, { onConflict: 'staff_id,attendance_date' })
            .select()
            .single()

        if (error) throw new Error(`Failed to record attendance: ${error.message}`)
        return data
    }

    async getMonthlyAttendance(staffId: string, schoolId: string, month: number, year: number): Promise<StaffAttendance[]> {
        const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
        const endDate = new Date(year, month, 0).toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('staff_id', staffId)
            .eq('school_id', schoolId)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('attendance_date', { ascending: true })

        if (error) throw new Error(`Failed to get monthly attendance: ${error.message}`)
        return data || []
    }

    private timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + minutes
    }

    // ==========================================
    // ATTENDANCE DEDUCTIONS CALCULATION
    // ==========================================

    async calculateAttendanceDeductions(
        staffId: string,
        schoolId: string,
        month: number,
        year: number
    ): Promise<{ deductions: any[]; totalDeduction: number; isPerfectAttendance: boolean }> {
        const settings = await this.getPayrollSettings(schoolId)
        if (!settings) return { deductions: [], totalDeduction: 0, isPerfectAttendance: false }

        const attendance = await this.getMonthlyAttendance(staffId, schoolId, month, year)
        const structure = await this.getSalaryStructure(staffId, schoolId)

        if (!structure) return { deductions: [], totalDeduction: 0, isPerfectAttendance: false }

        const dailySalary = structure.base_salary / settings.working_days_per_month
        const deductions: any[] = []
        let totalDeduction = 0
        let lateCount = 0
        let isPerfectAttendance = true

        for (const record of attendance) {
            // Handle absences
            if (record.status === 'absent') {
                isPerfectAttendance = false
                const deduction = (dailySalary * settings.absence_deduction_percent) / 100
                deductions.push({
                    type: 'absence',
                    description: `Absent on ${record.attendance_date}`,
                    amount: deduction,
                    date: record.attendance_date
                })
                totalDeduction += deduction
                continue
            }

            // Handle late arrivals
            if (record.status === 'late' && record.late_minutes > settings.late_threshold_minutes) {
                lateCount++
                isPerfectAttendance = false

                // Only deduct after grace count
                if (lateCount > settings.grace_late_count) {
                    let deduction = 0

                    switch (settings.deduction_type) {
                        case 'per_minute':
                            deduction = record.late_minutes * settings.deduction_value
                            break
                        case 'percentage':
                            deduction = (dailySalary * settings.deduction_value) / 100
                            break
                        case 'fixed':
                            deduction = settings.deduction_value
                            break
                    }

                    deductions.push({
                        type: 'late_arrival',
                        description: `Late ${record.late_minutes} mins on ${record.attendance_date}`,
                        amount: deduction,
                        date: record.attendance_date
                    })
                    totalDeduction += deduction
                }
            }

            // Handle half days
            if (record.status === 'half_day') {
                isPerfectAttendance = false
                const deduction = dailySalary / 2
                deductions.push({
                    type: 'half_day',
                    description: `Half day on ${record.attendance_date}`,
                    amount: deduction,
                    date: record.attendance_date
                })
                totalDeduction += deduction
            }
        }

        return { deductions, totalDeduction, isPerfectAttendance }
    }

    // ==========================================
    // SALARY ADVANCES
    // ==========================================

    async requestAdvance(schoolId: string, staffId: string, amount: number, reason?: string): Promise<SalaryAdvance> {
        const settings = await this.getPayrollSettings(schoolId)
        const structure = await this.getSalaryStructure(staffId, schoolId)

        if (!structure) throw new Error('Salary structure not found')

        // Check max advance limit
        if (settings) {
            const maxAdvance = (structure.base_salary * settings.max_advance_percent) / 100
            if (amount > maxAdvance) {
                throw new Error(`Maximum advance allowed is ${maxAdvance.toFixed(2)} (${settings.max_advance_percent}% of base salary)`)
            }
        }

        // Check for pending advances
        const { data: existing } = await supabase
            .from('salary_advances')
            .select('id')
            .eq('staff_id', staffId)
            .eq('school_id', schoolId)
            .in('status', ['pending', 'approved'])

        if (existing && existing.length > 0) {
            throw new Error('You have a pending or unrecovered advance. Please wait until it is recovered.')
        }

        const { data, error } = await supabase
            .from('salary_advances')
            .insert({
                school_id: schoolId,
                staff_id: staffId,
                amount,
                reason,
                status: 'pending'
            })
            .select()
            .single()

        if (error) throw new Error(`Failed to request advance: ${error.message}`)
        return data
    }

    async processAdvanceRequest(advanceId: string, schoolId: string, action: 'approve' | 'reject', adminId: string, recoveryMonth?: number, recoveryYear?: number): Promise<SalaryAdvance> {
        const updates: any = {
            status: action === 'approve' ? 'approved' : 'rejected',
            approved_by: adminId,
            approved_date: new Date().toISOString()
        }

        if (action === 'approve') {
            updates.recovery_month = recoveryMonth || new Date().getMonth() + 2 // Next month
            updates.recovery_year = recoveryYear || new Date().getFullYear()
        }

        const { data, error } = await supabase
            .from('salary_advances')
            .update(updates)
            .eq('id', advanceId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to process advance: ${error.message}`)
        return data
    }

    async getPendingAdvances(schoolId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('salary_advances')
            .select(`
        *,
        staff!inner(
          id,
          title,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        )
      `)
            .eq('school_id', schoolId)
            .eq('status', 'pending')
            .order('request_date', { ascending: true })

        if (error) throw new Error(`Failed to get pending advances: ${error.message}`)
        return data || []
    }

    // ==========================================
    // SALARY GENERATION
    // ==========================================

    async generateMonthlySalary(staffId: string, schoolId: string, month: number, year: number): Promise<SalaryRecord> {
        const settings = await this.getPayrollSettings(schoolId)
        const structure = await this.getSalaryStructure(staffId, schoolId)

        if (!structure) throw new Error('Salary structure not found for staff')

        // Calculate allowances
        const totalAllowances = Object.values(structure.allowances).reduce((sum, val) => sum + val, 0)

        // Calculate fixed deductions
        const fixedDeductions = Object.values(structure.fixed_deductions).reduce((sum, val) => sum + val, 0)

        // Calculate attendance deductions
        const { deductions, totalDeduction, isPerfectAttendance } = await this.calculateAttendanceDeductions(
            staffId, schoolId, month, year
        )

        // Calculate attendance bonus
        let attendanceBonus = 0
        if (settings?.attendance_bonus_enabled && isPerfectAttendance) {
            attendanceBonus = settings.attendance_bonus_amount
        }

        // Check for advance recovery
        let advanceDeduction = 0
        const { data: advances } = await supabase
            .from('salary_advances')
            .select('*')
            .eq('staff_id', staffId)
            .eq('school_id', schoolId)
            .eq('status', 'approved')
            .eq('recovery_month', month)
            .eq('recovery_year', year)

        if (advances && advances.length > 0) {
            advanceDeduction = advances.reduce((sum: number, adv: any) => sum + adv.amount, 0)
        }

        // Calculate net salary
        const totalDeductions = fixedDeductions + totalDeduction + advanceDeduction
        const netSalary = structure.base_salary + totalAllowances + attendanceBonus - totalDeductions

        // Create salary record
        const { data: salaryRecord, error } = await supabase
            .from('salary_records')
            .upsert({
                school_id: schoolId,
                staff_id: staffId,
                salary_structure_id: structure.id,
                month,
                year,
                base_salary: structure.base_salary,
                total_allowances: totalAllowances,
                attendance_bonus: attendanceBonus,
                total_deductions: totalDeductions,
                advance_deduction: advanceDeduction,
                net_salary: netSalary,
                status: 'pending'
            }, { onConflict: 'staff_id,month,year' })
            .select()
            .single()

        if (error) throw new Error(`Failed to generate salary: ${error.message}`)

        // Store deduction breakdown
        for (const d of deductions) {
            await supabase.from('salary_deduction_items').insert({
                salary_record_id: salaryRecord.id,
                deduction_type: d.type,
                description: d.description,
                amount: d.amount,
                deduction_date: d.date
            })
        }

        // Store allowance breakdown
        for (const [type, amount] of Object.entries(structure.allowances)) {
            await supabase.from('salary_allowance_items').insert({
                salary_record_id: salaryRecord.id,
                allowance_type: type,
                description: type.charAt(0).toUpperCase() + type.slice(1) + ' Allowance',
                amount
            })
        }

        // If attendance bonus, add it
        if (attendanceBonus > 0) {
            await supabase.from('salary_allowance_items').insert({
                salary_record_id: salaryRecord.id,
                allowance_type: 'attendance_bonus',
                description: 'Perfect Attendance Bonus',
                amount: attendanceBonus
            })
        }

        // Mark advances as recovered
        if (advances && advances.length > 0) {
            await supabase
                .from('salary_advances')
                .update({ status: 'recovered' })
                .in('id', advances.map((a: any) => a.id))
        }

        return salaryRecord
    }

    async generateBulkSalaries(schoolId: string, month: number, year: number, campusId?: string): Promise<{ success: number; failed: number; errors: string[] }> {
        // Get all staff with salary structures, filtered by campus if provided
        const structures = await this.getAllSalaryStructures(schoolId, campusId)

        let success = 0
        let failed = 0
        const errors: string[] = []

        for (const structure of structures) {
            try {
                // Use the staff's school_id (which is actually the campus_id in multi-campus setup)
                const targetSchoolId = structure.staff.school_id || campusId || schoolId
                await this.generateMonthlySalary(structure.staff_id, targetSchoolId, month, year)
                success++
            } catch (err: any) {
                failed++
                errors.push(`${structure.staff.profile.first_name} ${structure.staff.profile.last_name}: ${err.message}`)
            }
        }

        return { success, failed, errors }
    }

    // ==========================================
    // SALARY RECORDS
    // ==========================================

    async getSalaryRecords(schoolId: string, options: { month?: number; year?: number; status?: string; page?: number; limit?: number; campus_id?: string } = {}): Promise<{ data: any[]; total: number }> {
        const { month, year, status, page = 1, limit = 20, campus_id } = options
        const offset = (page - 1) * limit

        // In multi-campus setup, use campus_id; otherwise use schoolId
        const targetSchoolId = campus_id || schoolId

        let query = supabase
            .from('salary_records')
            .select(`
        *,
        staff!inner(
          id,
          title,
          employee_number,
          profile:profiles!staff_profile_id_fkey(first_name, last_name, email)
        )
      `, { count: 'exact' })
            .eq('school_id', targetSchoolId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (month) query = query.eq('month', month)
        if (year) query = query.eq('year', year)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query

        if (error) throw new Error(`Failed to get salary records: ${error.message}`)
        return { data: data || [], total: count || 0 }
    }

    async getPaySlip(salaryRecordId: string, schoolId: string): Promise<any> {
        const { data: record, error: recordError } = await supabase
            .from('salary_records')
            .select(`
        *,
        staff!inner(
          id,
          title,
          profile:profiles!staff_profile_id_fkey(first_name, last_name, email)
        )
      `)
            .eq('id', salaryRecordId)
            .eq('school_id', schoolId)
            .single()

        if (recordError) throw new Error(`Failed to get salary record: ${recordError.message}`)

        const { data: allowances } = await supabase
            .from('salary_allowance_items')
            .select('*')
            .eq('salary_record_id', salaryRecordId)

        const { data: deductions } = await supabase
            .from('salary_deduction_items')
            .select('*')
            .eq('salary_record_id', salaryRecordId)
            .order('deduction_date', { ascending: true })

        return {
            ...record,
            allowances_breakdown: allowances || [],
            deductions_breakdown: deductions || []
        }
    }

    async approveSalary(salaryRecordId: string, schoolId: string): Promise<SalaryRecord> {
        const { data, error } = await supabase
            .from('salary_records')
            .update({ status: 'approved' })
            .eq('id', salaryRecordId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to approve salary: ${error.message}`)
        return data
    }

    async markSalaryPaid(salaryRecordId: string, schoolId: string, paymentMethod?: string, paymentReference?: string): Promise<SalaryRecord> {
        const { data, error } = await supabase
            .from('salary_records')
            .update({
                status: 'paid',
                payment_date: new Date().toISOString(),
                payment_method: paymentMethod,
                payment_reference: paymentReference
            })
            .eq('id', salaryRecordId)
            .eq('school_id', schoolId)
            .select()
            .single()

        if (error) throw new Error(`Failed to mark salary paid: ${error.message}`)
        return data
    }

    // ==========================================
    // DASHBOARD STATS
    // ==========================================

    async getSalaryDashboardStats(schoolId: string, month?: number, year?: number): Promise<any> {
        const currentMonth = month || new Date().getMonth() + 1
        const currentYear = year || new Date().getFullYear()

        const { data, error } = await supabase
            .from('salary_records')
            .select('status, net_salary')
            .eq('school_id', schoolId)
            .eq('month', currentMonth)
            .eq('year', currentYear)

        if (error) throw new Error(`Failed to get salary stats: ${error.message}`)

        const stats = {
            total_payroll: 0,
            total_paid: 0,
            total_pending: 0,
            counts: {
                pending: 0,
                approved: 0,
                paid: 0
            }
        }

        data?.forEach((record: any) => {
            stats.total_payroll += record.net_salary
            stats.counts[record.status as keyof typeof stats.counts]++

            if (record.status === 'paid') {
                stats.total_paid += record.net_salary
            } else {
                stats.total_pending += record.net_salary
            }
        })

        return stats
    }
}

export const salaryService = new SalaryService()
