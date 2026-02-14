import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ==========================================
// TYPES
// ==========================================

export interface AccountingCategory {
    id: string
    campus_id: string
    name: string
    category_type: 'incomes' | 'expenses' | 'common'
    description?: string
    display_order: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface AccountingIncome {
    id: string
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    income_date: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at: string
    updated_at: string
    category?: AccountingCategory
}

export interface AccountingPayment {
    id: string
    campus_id: string
    academic_year: string
    staff_id?: string
    title: string
    category_id?: string
    amount: number
    payment_date: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at: string
    updated_at: string
    category?: AccountingCategory
    staff?: {
        id: string
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

export interface AccountingTotals {
    total_incomes: number
    total_student_payments: number
    total_expenses: number
    total_staff_payments: number
    balance: number
    general_balance: number
}

export interface CreateCategoryDTO {
    campus_id: string
    name: string
    category_type: 'incomes' | 'expenses' | 'common'
    description?: string
    display_order?: number
}

export interface CreateIncomeDTO {
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    income_date: string
    comments?: string
    file_attached?: string
    created_by?: string
}

export interface CreateExpenseDTO {
    campus_id: string
    academic_year: string
    title: string
    category_id?: string
    amount: number
    payment_date: string
    comments?: string
    file_attached?: string
    created_by?: string
}

export interface CreateStaffPaymentDTO extends CreateExpenseDTO {
    staff_id: string
}

// Salary interfaces
export interface AccountingSalary {
    id: string
    campus_id: string
    academic_year: string
    staff_id: string
    title: string
    amount: number
    assigned_date: string
    due_date?: string
    comments?: string
    file_attached?: string
    created_by?: string
    created_at?: string
    updated_at?: string
    staff?: {
        profiles: {
            first_name: string
            last_name: string
        }
    }
}

export interface CreateSalaryDTO {
    campus_id: string
    academic_year: string
    staff_id: string
    title: string
    amount: number
    assigned_date: string
    due_date?: string
    comments?: string
    file_attached?: string
    created_by?: string
}

// ==========================================
// SERVICE
// ==========================================

class AccountingService {
    // ==========================================
    // CATEGORIES
    // ==========================================

    async getCategories(
        campusId: string,
        type?: 'incomes' | 'expenses' | 'common',
        activeOnly: boolean = true
    ): Promise<AccountingCategory[]> {
        let query = supabase
            .from('accounting_categories')
            .select('*')
            .eq('campus_id', campusId)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true })

        if (type) {
            // For incomes page: show 'incomes' and 'common'
            // For expenses page: show 'expenses' and 'common'
            if (type === 'incomes') {
                query = query.in('category_type', ['incomes', 'common'])
            } else if (type === 'expenses') {
                query = query.in('category_type', ['expenses', 'common'])
            } else {
                query = query.eq('category_type', type)
            }
        }

        if (activeOnly) {
            query = query.eq('is_active', true)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async createCategory(dto: CreateCategoryDTO): Promise<AccountingCategory> {
        const { data, error } = await supabase
            .from('accounting_categories')
            .insert({
                campus_id: dto.campus_id,
                name: dto.name,
                category_type: dto.category_type,
                description: dto.description,
                display_order: dto.display_order || 0
            })
            .select()
            .single()

        if (error) throw error
        return data
    }

    async updateCategory(
        id: string,
        campusId: string,
        updates: Partial<AccountingCategory>
    ): Promise<AccountingCategory> {
        const { data, error } = await supabase
            .from('accounting_categories')
            .update({
                name: updates.name,
                category_type: updates.category_type,
                description: updates.description,
                display_order: updates.display_order,
                is_active: updates.is_active
            })
            .eq('id', id)
            .eq('campus_id', campusId)
            .select()
            .single()

        if (error) throw error
        return data
    }

    async deleteCategory(id: string, campusId: string): Promise<void> {
        const { error } = await supabase
            .from('accounting_categories')
            .delete()
            .eq('id', id)
            .eq('campus_id', campusId)

        if (error) throw error
    }

    // ==========================================
    // INCOMES
    // ==========================================

    async getIncomes(
        campusId: string,
        academicYear: string,
        startDate?: string,
        endDate?: string
    ): Promise<AccountingIncome[]> {
        let query = supabase
            .from('accounting_incomes')
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .order('income_date', { ascending: false })

        if (startDate) {
            query = query.gte('income_date', startDate)
        }
        if (endDate) {
            query = query.lte('income_date', endDate)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async createIncome(dto: CreateIncomeDTO): Promise<AccountingIncome> {
        const { data, error } = await supabase
            .from('accounting_incomes')
            .insert({
                campus_id: dto.campus_id,
                academic_year: dto.academic_year,
                title: dto.title,
                category_id: dto.category_id || null,
                amount: dto.amount,
                income_date: dto.income_date,
                comments: dto.comments,
                file_attached: dto.file_attached,
                created_by: dto.created_by
            })
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .single()

        if (error) throw error
        return data
    }

    async updateIncome(
        id: string,
        campusId: string,
        updates: Partial<AccountingIncome>
    ): Promise<AccountingIncome> {
        const { data, error } = await supabase
            .from('accounting_incomes')
            .update({
                title: updates.title,
                category_id: updates.category_id,
                amount: updates.amount,
                income_date: updates.income_date,
                comments: updates.comments,
                file_attached: updates.file_attached
            })
            .eq('id', id)
            .eq('campus_id', campusId)
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .single()

        if (error) throw error
        return data
    }

    async deleteIncome(id: string, campusId: string): Promise<void> {
        // Get the file path before deleting
        const { data: income } = await supabase
            .from('accounting_incomes')
            .select('file_attached')
            .eq('id', id)
            .eq('campus_id', campusId)
            .single()

        // Delete the record
        const { error } = await supabase
            .from('accounting_incomes')
            .delete()
            .eq('id', id)
            .eq('campus_id', campusId)

        if (error) throw error

        // TODO: Delete the file from storage if exists
        // if (income?.file_attached) { ... }
    }

    // ==========================================
    // EXPENSES (General - staff_id IS NULL)
    // ==========================================

    async getExpenses(
        campusId: string,
        academicYear: string,
        startDate?: string,
        endDate?: string
    ): Promise<AccountingPayment[]> {
        let query = supabase
            .from('accounting_payments')
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .is('staff_id', null) // CRITICAL: Only get general expenses
            .order('payment_date', { ascending: false })

        if (startDate) {
            query = query.gte('payment_date', startDate)
        }
        if (endDate) {
            query = query.lte('payment_date', endDate)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async createExpense(dto: CreateExpenseDTO): Promise<AccountingPayment> {
        const { data, error } = await supabase
            .from('accounting_payments')
            .insert({
                campus_id: dto.campus_id,
                academic_year: dto.academic_year,
                staff_id: null, // General expense
                title: dto.title,
                category_id: dto.category_id || null,
                amount: dto.amount,
                payment_date: dto.payment_date,
                comments: dto.comments,
                file_attached: dto.file_attached,
                created_by: dto.created_by
            })
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .single()

        if (error) throw error
        return data
    }

    async updateExpense(
        id: string,
        campusId: string,
        updates: Partial<AccountingPayment>
    ): Promise<AccountingPayment> {
        const { data, error } = await supabase
            .from('accounting_payments')
            .update({
                title: updates.title,
                category_id: updates.category_id,
                amount: updates.amount,
                payment_date: updates.payment_date,
                comments: updates.comments,
                file_attached: updates.file_attached
            })
            .eq('id', id)
            .eq('campus_id', campusId)
            .is('staff_id', null) // Ensure we're updating a general expense
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .single()

        if (error) throw error
        return data
    }

    async deleteExpense(id: string, campusId: string): Promise<void> {
        // Get the file path before deleting
        const { data: expense } = await supabase
            .from('accounting_payments')
            .select('file_attached')
            .eq('id', id)
            .eq('campus_id', campusId)
            .is('staff_id', null)
            .single()

        // Delete the record
        const { error } = await supabase
            .from('accounting_payments')
            .delete()
            .eq('id', id)
            .eq('campus_id', campusId)
            .is('staff_id', null) // Ensure we're deleting a general expense

        if (error) throw error

        // TODO: Delete the file from storage if exists
    }

    // ==========================================
    // STAFF PAYMENTS
    // ==========================================

    async getStaffPayments(
        campusId: string,
        academicYear: string,
        startDate?: string,
        endDate?: string
    ): Promise<AccountingPayment[]> {
        let query = supabase
            .from('accounting_payments')
            .select(`
                *,
                category:accounting_categories(id, name, category_type),
                staff:staff(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))
            `)
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .not('staff_id', 'is', null) // Only get staff payments
            .order('payment_date', { ascending: false })

        if (startDate) {
            query = query.gte('payment_date', startDate)
        }
        if (endDate) {
            query = query.lte('payment_date', endDate)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async getStaffPaymentsByStaff(
        campusId: string,
        staffId: string,
        academicYear?: string
    ): Promise<AccountingPayment[]> {
        let query = supabase
            .from('accounting_payments')
            .select(`
                *,
                category:accounting_categories(id, name, category_type)
            `)
            .eq('campus_id', campusId)
            .eq('staff_id', staffId)
            .order('payment_date', { ascending: false })

        if (academicYear) {
            query = query.eq('academic_year', academicYear)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async createStaffPayment(dto: CreateStaffPaymentDTO): Promise<AccountingPayment> {
        const { data, error } = await supabase
            .from('accounting_payments')
            .insert({
                campus_id: dto.campus_id,
                academic_year: dto.academic_year,
                staff_id: dto.staff_id,
                title: dto.title,
                category_id: dto.category_id || null,
                amount: dto.amount,
                payment_date: dto.payment_date,
                comments: dto.comments,
                file_attached: dto.file_attached,
                created_by: dto.created_by
            })
            .select(`
                *,
                category:accounting_categories(id, name, category_type),
                staff:staff(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))
            `)
            .single()

        if (error) throw error
        return data
    }

    async updateStaffPayment(
        id: string,
        campusId: string,
        updates: Partial<AccountingPayment>
    ): Promise<AccountingPayment> {
        const { data, error } = await supabase
            .from('accounting_payments')
            .update({
                title: updates.title,
                category_id: updates.category_id,
                amount: updates.amount,
                payment_date: updates.payment_date,
                comments: updates.comments,
                file_attached: updates.file_attached
            })
            .eq('id', id)
            .eq('campus_id', campusId)
            .not('staff_id', 'is', null) // Ensure we're updating a staff payment
            .select(`
                *,
                category:accounting_categories(id, name, category_type),
                staff:staff(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name))
            `)
            .single()

        if (error) throw error
        return data
    }

    async deleteStaffPayment(id: string, campusId: string): Promise<void> {
        const { error } = await supabase
            .from('accounting_payments')
            .delete()
            .eq('id', id)
            .eq('campus_id', campusId)
            .not('staff_id', 'is', null) // Ensure we're deleting a staff payment

        if (error) throw error
    }

    // ==========================================
    // TOTALS / REPORTS
    // ==========================================

    async getTotals(
        campusId: string,
        academicYear: string,
        startDate?: string,
        endDate?: string
    ): Promise<AccountingTotals> {
        const { data, error } = await supabase
            .rpc('get_accounting_totals_with_fees', {
                p_campus_id: campusId,
                p_academic_year: academicYear,
                p_start_date: startDate || null,
                p_end_date: endDate || null
            })

        if (error) {
            // Fallback to basic totals if function doesn't exist
            return this.calculateTotalsManually(campusId, academicYear, startDate, endDate)
        }

        return data?.[0] || {
            total_incomes: 0,
            total_student_payments: 0,
            total_expenses: 0,
            total_staff_payments: 0,
            balance: 0,
            general_balance: 0
        }
    }

    private async calculateTotalsManually(
        campusId: string,
        academicYear: string,
        startDate?: string,
        endDate?: string
    ): Promise<AccountingTotals> {
        // Get incomes
        let incomesQuery = supabase
            .from('accounting_incomes')
            .select('amount')
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)

        if (startDate) incomesQuery = incomesQuery.gte('income_date', startDate)
        if (endDate) incomesQuery = incomesQuery.lte('income_date', endDate)

        const { data: incomes } = await incomesQuery
        const totalIncomes = (incomes || []).reduce((sum, i) => sum + Number(i.amount), 0)

        // Get expenses (general)
        let expensesQuery = supabase
            .from('accounting_payments')
            .select('amount')
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .is('staff_id', null)

        if (startDate) expensesQuery = expensesQuery.gte('payment_date', startDate)
        if (endDate) expensesQuery = expensesQuery.lte('payment_date', endDate)

        const { data: expenses } = await expensesQuery
        const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0)

        // Get staff payments
        let staffQuery = supabase
            .from('accounting_payments')
            .select('amount')
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .not('staff_id', 'is', null)

        if (startDate) staffQuery = staffQuery.gte('payment_date', startDate)
        if (endDate) staffQuery = staffQuery.lte('payment_date', endDate)

        const { data: staffPayments } = await staffQuery
        const totalStaffPayments = (staffPayments || []).reduce((sum, s) => sum + Number(s.amount), 0)

        return {
            total_incomes: totalIncomes,
            total_student_payments: 0, // Would need to query fee_payments
            total_expenses: totalExpenses,
            total_staff_payments: totalStaffPayments,
            balance: totalIncomes - totalExpenses,
            general_balance: totalIncomes - (totalExpenses + totalStaffPayments)
        }
    }

    async getDailyTransactions(
        campusId: string,
        academicYear: string,
        date: string
    ): Promise<{ incomes: AccountingIncome[]; expenses: AccountingPayment[]; staffPayments: AccountingPayment[] }> {
        const [incomes, expenses, staffPayments] = await Promise.all([
            this.getIncomes(campusId, academicYear, date, date),
            this.getExpenses(campusId, academicYear, date, date),
            this.getStaffPayments(campusId, academicYear, date, date)
        ])

        return { incomes, expenses, staffPayments }
    }

    async getStaffBalances(
        campusId: string,
        academicYear: string
    ): Promise<Array<{ staff_id: string; staff_name: string; total_payments: number }>> {
        const { data, error } = await supabase
            .from('accounting_payments')
            .select(`
                staff_id,
                amount,
                staff:staff(profiles:profiles!staff_profile_id_fkey(first_name, last_name))
            `)
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .not('staff_id', 'is', null)

        if (error) throw error

        // Group by staff and calculate totals
        const staffMap = new Map<string, { name: string; total: number }>()

        for (const payment of data || []) {
            if (payment.staff_id) {
                const existing = staffMap.get(payment.staff_id) || {
                    // @ts-ignore
                    name: `${payment.staff?.profiles?.first_name || ''} ${payment.staff?.profiles?.last_name || ''}`.trim(),
                    total: 0
                }
                existing.total += Number(payment.amount)
                staffMap.set(payment.staff_id, existing)
            }
        }

        return Array.from(staffMap.entries()).map(([staff_id, { name, total }]) => ({
            staff_id,
            staff_name: name || 'Unknown',
            total_payments: total
        }))
    }

    // ==========================================
    // SALARIES
    // ==========================================

    async getSalaries(
        campusId: string,
        academicYear: string
    ): Promise<AccountingSalary[]> {
        const { data, error } = await supabase
            .from('accounting_salaries')
            .select(`
                *,
                staff:staff(profiles:profiles!staff_profile_id_fkey(first_name, last_name))
            `)
            .eq('campus_id', campusId)
            .eq('academic_year', academicYear)
            .order('assigned_date', { ascending: false })

        if (error) throw error
        return data || []
    }

    async getSalariesByStaff(
        campusId: string,
        staffId: string,
        academicYear?: string
    ): Promise<AccountingSalary[]> {
        let query = supabase
            .from('accounting_salaries')
            .select('*')
            .eq('campus_id', campusId)
            .eq('staff_id', staffId)
            .order('assigned_date', { ascending: false })

        if (academicYear) {
            query = query.eq('academic_year', academicYear)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    }

    async createSalary(dto: CreateSalaryDTO): Promise<AccountingSalary> {
        const { data, error } = await supabase
            .from('accounting_salaries')
            .insert({
                campus_id: dto.campus_id,
                academic_year: dto.academic_year,
                staff_id: dto.staff_id,
                title: dto.title,
                amount: dto.amount,
                assigned_date: dto.assigned_date,
                due_date: dto.due_date || null,
                comments: dto.comments,
                file_attached: dto.file_attached,
                created_by: dto.created_by
            })
            .select('*')
            .single()

        if (error) throw error
        return data
    }

    async updateSalary(
        id: string,
        campusId: string,
        updates: Partial<AccountingSalary>
    ): Promise<AccountingSalary> {
        const { data, error } = await supabase
            .from('accounting_salaries')
            .update({
                title: updates.title,
                amount: updates.amount,
                assigned_date: updates.assigned_date,
                due_date: updates.due_date,
                comments: updates.comments,
                file_attached: updates.file_attached
            })
            .eq('id', id)
            .eq('campus_id', campusId)
            .select('*')
            .single()

        if (error) throw error
        return data
    }

    async deleteSalary(id: string, campusId: string): Promise<void> {
        const { error } = await supabase
            .from('accounting_salaries')
            .delete()
            .eq('id', id)
            .eq('campus_id', campusId)

        if (error) throw error
    }

    async getStaffSalaryTotals(
        campusId: string,
        staffId: string,
        academicYear: string
    ): Promise<{ totalSalaries: number; totalPayments: number; balance: number }> {
        // Get total salaries assigned
        const { data: salaries, error: salaryError } = await supabase
            .from('accounting_salaries')
            .select('amount')
            .eq('campus_id', campusId)
            .eq('staff_id', staffId)
            .eq('academic_year', academicYear)

        if (salaryError) throw salaryError

        // Get total payments made
        const { data: payments, error: paymentError } = await supabase
            .from('accounting_payments')
            .select('amount')
            .eq('campus_id', campusId)
            .eq('staff_id', staffId)
            .eq('academic_year', academicYear)

        if (paymentError) throw paymentError

        const totalSalaries = (salaries || []).reduce((sum, s) => sum + Number(s.amount), 0)
        const totalPayments = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0)

        return {
            totalSalaries,
            totalPayments,
            balance: totalSalaries - totalPayments
        }
    }

    // ==========================================
    // TEACHER HOURS
    // ==========================================

    async getTeachersWithHours(campusId: string): Promise<any[]> {
        // Get only teachers with hourly payment type
        console.log('🔍 Getting hourly teachers for campus:', campusId)
        
        const { data, error } = await supabase
            .from('staff')
            .select(`
                id,
                employee_number,
                payment_type,
                profile:profiles!staff_profile_id_fkey(first_name, father_name, last_name)
            `)
            .eq('school_id', campusId)
            .eq('role', 'teacher')
            .eq('payment_type', 'hourly')
            .eq('is_active', true)
            .order('employee_number', { ascending: true })

        if (error) {
            console.error('Error getting teachers list:', error)
            throw error
        }
        
        console.log('📋 Found hourly teachers:', data?.length || 0, data)
        return data || []
    }

    async getTeacherHoursDetail(
        campusId: string,
        teacherId: string,
        startDate: string,
        endDate: string,
        academicYearId: string
    ): Promise<any[]> {
        // Get teacher's timetable entries with period times
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select(`
                id,
                day_of_week,
                subject:subjects(id, name, code),
                period:periods(id, period_number, period_name, start_time, end_time, length_minutes),
                section:sections(id, name)
            `)
            .eq('teacher_id', teacherId)
            .eq('academic_year_id', academicYearId)
            .eq('is_active', true)
            .order('day_of_week', { ascending: true })

        if (error) throw error

        // Get hourly rates for this teacher
        const { data: rates, error: ratesError } = await supabase
            .from('teacher_hourly_rates')
            .select('timetable_entry_id, hourly_rate')
            .eq('teacher_id', teacherId)
            .eq('school_id', campusId)

        if (ratesError && ratesError.code !== 'PGRST116') throw ratesError

        const ratesMap = new Map((rates || []).map(r => [r.timetable_entry_id, Number(r.hourly_rate)]))

        // Calculate hours for each entry in the date range
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        // Count occurrences of each day of week in the range
        const dayCountMap: Record<number, number> = {}
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay() // 0=Sunday, 6=Saturday
            dayCountMap[dow] = (dayCountMap[dow] || 0) + 1
        }

        // Map day_of_week from timetable (1=Monday...7=Sunday) to JS day (0=Sunday...6=Saturday)
        const dayMapping: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 }

        return (entries || []).map(entry => {
            const period = entry.period as any
            const subject = entry.subject as any
            
            // Calculate hours per period from length_minutes or start_time/end_time
            let hoursPerPeriod = 0
            if (period?.length_minutes) {
                // Prefer length_minutes if available (stored in minutes, convert to hours)
                hoursPerPeriod = period.length_minutes / 60
            } else if (period?.start_time && period?.end_time) {
                // Fallback to calculating from start_time and end_time
                const [sh, sm] = period.start_time.split(':').map(Number)
                const [eh, em] = period.end_time.split(':').map(Number)
                hoursPerPeriod = (eh - sh) + (em - sm) / 60
            }

            // Count periods in range for this day of week
            const jsDow = dayMapping[entry.day_of_week] ?? entry.day_of_week
            const periodsInRange = dayCountMap[jsDow] || 0
            const totalHours = hoursPerPeriod * periodsInRange
            const hourlyRate = ratesMap.get(entry.id) || 0
            const totalAmount = totalHours * hourlyRate

            return {
                timetable_entry_id: entry.id,
                subject_name: subject?.name || 'Unknown',
                period_name: period?.period_name || `Period ${period?.period_number}`,
                day_of_week: entry.day_of_week,
                hours_per_period: Math.round(hoursPerPeriod * 100) / 100,
                periods_in_range: periodsInRange,
                total_hours: Math.round(totalHours * 100) / 100,
                hourly_rate: hourlyRate,
                total_amount: Math.round(totalAmount * 100) / 100
            }
        })
    }

    async updateTeacherHourlyRate(
        campusId: string,
        teacherId: string,
        timetableEntryId: string,
        hourlyRate: number
    ): Promise<void> {
        const { error } = await supabase
            .from('teacher_hourly_rates')
            .upsert({
                school_id: campusId,
                teacher_id: teacherId,
                timetable_entry_id: timetableEntryId,
                hourly_rate: hourlyRate,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'teacher_id,timetable_entry_id'
            })

        if (error) throw error
    }

    async updateTeacherHourlyRates(
        campusId: string,
        teacherId: string,
        rates: Array<{ timetable_entry_id: string; hourly_rate: number }>
    ): Promise<void> {
        for (const rate of rates) {
            await this.updateTeacherHourlyRate(campusId, teacherId, rate.timetable_entry_id, rate.hourly_rate)
        }
    }

    // ==========================================
    // PAYEES METHODS
    // ==========================================

    async getPayees(campusId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('payees')
            .select(`
                *,
                total_payments:payee_payments(amount)
            `)
            .eq('school_id', campusId)
            .eq('is_active', true)
            .order('name', { ascending: true })

        if (error) throw error

        // Calculate total payments for each payee
        return (data || []).map(payee => ({
            ...payee,
            total_payments: (payee.total_payments || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
        }))
    }

    async getPayeeById(campusId: string, payeeId: string): Promise<any> {
        const { data, error } = await supabase
            .from('payees')
            .select('*')
            .eq('id', payeeId)
            .eq('school_id', campusId)
            .single()

        if (error) throw error
        return data
    }

    async createPayee(campusId: string, payeeData: {
        name: string
        email?: string
        phone?: string
        address?: string
        bank?: string
        account_number?: string
        swift_iban?: string
        bsb_bic?: string
        rollover?: boolean
    }, creatorId: string): Promise<any> {
        const { data, error } = await supabase
            .from('payees')
            .insert({
                school_id: campusId,
                name: payeeData.name,
                email: payeeData.email,
                phone: payeeData.phone,
                address: payeeData.address,
                bank: payeeData.bank,
                account_number: payeeData.account_number,
                swift_iban: payeeData.swift_iban,
                bsb_bic: payeeData.bsb_bic,
                rollover: payeeData.rollover || false,
                created_by: creatorId
            })
            .select()
            .single()

        if (error) throw error
        return data
    }

    async updatePayee(campusId: string, payeeId: string, payeeData: {
        name?: string
        email?: string
        phone?: string
        address?: string
        bank?: string
        account_number?: string
        swift_iban?: string
        bsb_bic?: string
        rollover?: boolean
    }): Promise<any> {
        const { data, error } = await supabase
            .from('payees')
            .update({
                ...payeeData,
                updated_at: new Date().toISOString()
            })
            .eq('id', payeeId)
            .eq('school_id', campusId)
            .select()
            .single()

        if (error) throw error
        return data
    }

    async deletePayee(campusId: string, payeeId: string): Promise<void> {
        // Soft delete by setting is_active to false
        const { error } = await supabase
            .from('payees')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', payeeId)
            .eq('school_id', campusId)

        if (error) throw error
    }

    async getPayeePayments(campusId: string, payeeId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('payee_payments')
            .select('*')
            .eq('school_id', campusId)
            .eq('payee_id', payeeId)
            .order('payment_date', { ascending: false })

        if (error) throw error
        return data || []
    }

    async createPayeePayment(campusId: string, paymentData: {
        payee_id: string
        academic_year_id?: string
        amount: number
        payment_date: string
        description?: string
        reference_number?: string
        file_attached?: string
    }, creatorId: string): Promise<any> {
        const { data, error } = await supabase
            .from('payee_payments')
            .insert({
                school_id: campusId,
                payee_id: paymentData.payee_id,
                academic_year_id: paymentData.academic_year_id,
                amount: paymentData.amount,
                payment_date: paymentData.payment_date,
                description: paymentData.description,
                reference_number: paymentData.reference_number,
                file_attached: paymentData.file_attached,
                created_by: creatorId
            })
            .select()
            .single()

        if (error) throw error
        return data
    }

    async deletePayeePayment(campusId: string, paymentId: string): Promise<void> {
        const { error } = await supabase
            .from('payee_payments')
            .delete()
            .eq('id', paymentId)
            .eq('school_id', campusId)

        if (error) throw error
    }
}

export const accountingService = new AccountingService()
