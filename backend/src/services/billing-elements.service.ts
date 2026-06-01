import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface BillingElementCategory {
  id: string
  school_id: string
  title: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  elements_count?: number
}

export interface BillingElement {
  id: string
  school_id: string
  category_id: string
  title: string
  amount: number
  course_period_section_id: string | null
  course_period_subject_id: string | null
  grade_level_id: string | null
  comment: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  category_title?: string
  section_name?: string
  subject_name?: string
  grade_name?: string
}

export interface StudentBillingElement {
  id: string
  school_id: string
  student_id: string
  billing_element_id: string | null
  element_title: string
  amount: number
  due_date: string | null
  assigned_date: string
  comment: string | null
  amount_paid: number
  balance: number
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'
  student_fee_id: string | null
  created_at: string
  updated_at: string
  // Joined
  student_name?: string
  student_first_name?: string
  student_last_name?: string
  grade_level?: string
  section_name?: string
  category_title?: string
}

export interface BillingElementTransaction {
  id: string
  school_id: string
  student_billing_element_id: string
  student_id: string
  amount: number
  transaction_date: string
  payment_method: string | null
  comment: string | null
  created_by: string | null
  created_at: string
  // Joined
  student_name?: string
  grade_level?: string
  element_title?: string
}

export interface CreateCategoryDTO {
  school_id: string
  title: string
  sort_order?: number
}

export interface UpdateCategoryDTO {
  title?: string
  sort_order?: number
  is_active?: boolean
}

export interface CreateElementDTO {
  school_id: string
  category_id: string
  title: string
  amount: number
  course_period_section_id?: string | null
  course_period_subject_id?: string | null
  grade_level_id?: string | null
  comment?: string | null
  sort_order?: number
}

export interface UpdateElementDTO {
  category_id?: string
  title?: string
  amount?: number
  course_period_section_id?: string | null
  course_period_subject_id?: string | null
  grade_level_id?: string | null
  comment?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface AssignElementDTO {
  school_id: string
  student_id: string
  billing_element_id?: string | null
  element_title: string
  amount: number
  due_date?: string | null
  comment?: string | null
}

export interface MassAssignDTO {
  school_id: string
  student_ids: string[]
  billing_element_id?: string | null
  element_title: string
  amount: number
  due_date?: string | null
  comment?: string | null
}

export interface RecordTransactionDTO {
  school_id: string
  student_billing_element_id: string
  student_id: string
  amount: number
  transaction_date?: string
  payment_method?: string
  comment?: string
  created_by?: string
}

// ============================================================================
// SERVICE
// ============================================================================

class BillingElementsService {

  // ---------- CATEGORIES ----------

  async getCategories(schoolId: string): Promise<BillingElementCategory[]> {
    const { data, error } = await supabase
      .from('billing_element_categories')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`)
    
    // Get element counts per category
    if (data && data.length > 0) {
      const { data: counts } = await supabase
        .from('billing_elements')
        .select('category_id')
        .eq('school_id', schoolId)
        .eq('is_active', true)

      const countMap: Record<string, number> = {}
      ;(counts || []).forEach((e: any) => {
        countMap[e.category_id] = (countMap[e.category_id] || 0) + 1
      })
      data.forEach((cat: any) => {
        cat.elements_count = countMap[cat.id] || 0
      })
    }
    
    return data || []
  }

  async createCategory(dto: CreateCategoryDTO): Promise<BillingElementCategory> {
    const { data, error } = await supabase
      .from('billing_element_categories')
      .insert({
        school_id: dto.school_id,
        title: dto.title,
        sort_order: dto.sort_order ?? 0
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return data
  }

  async updateCategory(id: string, schoolId: string, dto: UpdateCategoryDTO): Promise<BillingElementCategory> {
    const { data, error } = await supabase
      .from('billing_element_categories')
      .update(dto)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update category: ${error.message}`)
    return data
  }

  async deleteCategory(id: string, schoolId: string): Promise<void> {
    // Check for elements
    const { count } = await supabase
      .from('billing_elements')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
      .eq('is_active', true)

    if (count && count > 0) {
      throw new Error(`Cannot delete category with ${count} active elements. Delete elements first.`)
    }

    const { error } = await supabase
      .from('billing_element_categories')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw new Error(`Failed to delete category: ${error.message}`)
  }

  // ---------- ELEMENTS ----------

  async getElements(schoolId: string, categoryId?: string): Promise<BillingElement[]> {
    let query = supabase
      .from('billing_elements')
      .select(`
        *,
        billing_element_categories(title),
        sections(name),
        subjects(name),
        grade_levels(name)
      `)
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch elements: ${error.message}`)

    return (data || []).map((e: any) => ({
      ...e,
      category_title: e.billing_element_categories?.title || null,
      section_name: e.sections?.name || null,
      subject_name: e.subjects?.name || null,
      grade_name: e.grade_levels?.name || null,
      billing_element_categories: undefined,
      sections: undefined,
      subjects: undefined,
      grade_levels: undefined
    }))
  }

  async getElementById(id: string, schoolId: string): Promise<BillingElement | null> {
    const { data, error } = await supabase
      .from('billing_elements')
      .select(`
        *,
        billing_element_categories(title),
        sections(name),
        subjects(name),
        grade_levels(name)
      `)
      .eq('id', id)
      .eq('school_id', schoolId)
      .single()

    if (error) return null

    return {
      ...data,
      category_title: data.billing_element_categories?.title || null,
      section_name: data.sections?.name || null,
      subject_name: data.subjects?.name || null,
      grade_name: data.grade_levels?.name || null,
    }
  }

  async createElement(dto: CreateElementDTO): Promise<BillingElement> {
    const { data, error } = await supabase
      .from('billing_elements')
      .insert({
        school_id: dto.school_id,
        category_id: dto.category_id,
        title: dto.title,
        amount: dto.amount,
        course_period_section_id: dto.course_period_section_id || null,
        course_period_subject_id: dto.course_period_subject_id || null,
        grade_level_id: dto.grade_level_id || null,
        comment: dto.comment || null,
        sort_order: dto.sort_order ?? 0
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create element: ${error.message}`)
    return data
  }

  async updateElement(id: string, schoolId: string, dto: UpdateElementDTO): Promise<BillingElement> {
    const updateData: any = { ...dto }
    // Ensure course period fields are set together
    if ('course_period_section_id' in dto || 'course_period_subject_id' in dto) {
      updateData.course_period_section_id = dto.course_period_section_id || null
      updateData.course_period_subject_id = dto.course_period_subject_id || null
    }

    const { data, error } = await supabase
      .from('billing_elements')
      .update(updateData)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update element: ${error.message}`)
    return data
  }

  async deleteElement(id: string, schoolId: string): Promise<void> {
    // Check for assigned student elements
    const { count } = await supabase
      .from('student_billing_elements')
      .select('id', { count: 'exact', head: true })
      .eq('billing_element_id', id)

    if (count && count > 0) {
      throw new Error(`Cannot delete element assigned to ${count} students. Remove assignments first.`)
    }

    const { error } = await supabase
      .from('billing_elements')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw new Error(`Failed to delete element: ${error.message}`)
  }

  // ---------- STUDENT BILLING ELEMENTS ----------

  async getStudentElements(
    schoolId: string,
    studentId?: string,
    filters?: {
      status?: string
      category_id?: string
      from_date?: string
      to_date?: string
    }
  ): Promise<StudentBillingElement[]> {
    let query = supabase
      .from('student_billing_elements')
      .select(`
        *,
        students!inner(
          id,
          student_number,
          section_id,
          profile:profiles(first_name, last_name),
          sections(
            name,
            grade_levels(name)
          )
        ),
        billing_elements(
          title,
          category_id,
          billing_element_categories(title)
        )
      `)
      .eq('school_id', schoolId)
      .order('assigned_date', { ascending: false })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }
    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.from_date) {
      query = query.gte('assigned_date', filters.from_date)
    }
    if (filters?.to_date) {
      query = query.lte('assigned_date', filters.to_date)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch student elements: ${error.message}`)

    let result = (data || []).map((sbe: any) => ({
      ...sbe,
      student_name: `${sbe.students?.profile?.first_name || ''} ${sbe.students?.profile?.last_name || ''}`.trim(),
      student_first_name: sbe.students?.profile?.first_name || '',
      student_last_name: sbe.students?.profile?.last_name || '',
      grade_level: sbe.students?.sections?.grade_levels?.name || '',
      section_name: sbe.students?.sections?.name || '',
      category_title: sbe.billing_elements?.billing_element_categories?.title || '',
      students: undefined,
      billing_elements: undefined
    }))

    // Filter by category if needed (post-filter since it's a nested join)
    if (filters?.category_id) {
      const { data: catElements } = await supabase
        .from('billing_elements')
        .select('id')
        .eq('category_id', filters.category_id)
      const elementIds = new Set((catElements || []).map((e: any) => e.id))
      result = result.filter((sbe: any) => sbe.billing_element_id && elementIds.has(sbe.billing_element_id))
    }

    return result
  }

  async assignElement(dto: AssignElementDTO): Promise<StudentBillingElement> {
    const { data, error } = await supabase
      .from('student_billing_elements')
      .insert({
        school_id: dto.school_id,
        student_id: dto.student_id,
        billing_element_id: dto.billing_element_id || null,
        element_title: dto.element_title,
        amount: dto.amount,
        due_date: dto.due_date || null,
        assigned_date: new Date().toISOString().split('T')[0],
        comment: dto.comment || null,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to assign element: ${error.message}`)
    return data
  }

  async massAssignElement(dto: MassAssignDTO): Promise<StudentBillingElement[]> {
    const records = dto.student_ids.map(studentId => ({
      school_id: dto.school_id,
      student_id: studentId,
      billing_element_id: dto.billing_element_id || null,
      element_title: dto.element_title,
      amount: dto.amount,
      due_date: dto.due_date || null,
      assigned_date: new Date().toISOString().split('T')[0],
      comment: dto.comment || null,
      status: 'pending' as const
    }))

    const { data, error } = await supabase
      .from('student_billing_elements')
      .insert(records)
      .select()

    if (error) throw new Error(`Failed to mass assign elements: ${error.message}`)
    return data || []
  }

  async updateStudentElement(
    id: string,
    schoolId: string,
    updates: {
      billing_element_id?: string | null
      element_title?: string
      amount?: number
      due_date?: string | null
      comment?: string | null
      status?: string
    }
  ): Promise<StudentBillingElement> {
    const { data, error } = await supabase
      .from('student_billing_elements')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update student element: ${error.message}`)
    return data
  }

  async deleteStudentElement(id: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('student_billing_elements')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw new Error(`Failed to delete student element: ${error.message}`)
  }

  // ---------- TRANSACTIONS ----------

  async recordTransaction(dto: RecordTransactionDTO): Promise<BillingElementTransaction> {
    // 1. Create transaction
    const { data: txn, error: txnError } = await supabase
      .from('billing_element_transactions')
      .insert({
        school_id: dto.school_id,
        student_billing_element_id: dto.student_billing_element_id,
        student_id: dto.student_id,
        amount: dto.amount,
        transaction_date: dto.transaction_date || new Date().toISOString().split('T')[0],
        payment_method: dto.payment_method || null,
        comment: dto.comment || null,
        created_by: dto.created_by || null
      })
      .select()
      .single()

    if (txnError) throw new Error(`Failed to record transaction: ${txnError.message}`)

    // 2. Update student element's amount_paid and status
    const { data: sbe } = await supabase
      .from('student_billing_elements')
      .select('amount, amount_paid')
      .eq('id', dto.student_billing_element_id)
      .single()

    if (sbe) {
      const newPaid = (sbe.amount_paid || 0) + dto.amount
      const newStatus = newPaid >= sbe.amount ? 'paid' : newPaid > 0 ? 'partial' : 'pending'
      
      await supabase
        .from('student_billing_elements')
        .update({ amount_paid: newPaid, status: newStatus })
        .eq('id', dto.student_billing_element_id)
    }

    return txn
  }

  async getTransactions(
    schoolId: string,
    filters?: {
      from_date?: string
      to_date?: string
      category_id?: string
      student_id?: string
    }
  ): Promise<BillingElementTransaction[]> {
    let query = supabase
      .from('billing_element_transactions')
      .select(`
        *,
        students:student_id(
          id,
          student_number,
          section_id,
          profile:profiles(first_name, last_name),
          sections(
            name,
            grade_levels(name)
          )
        ),
        student_billing_elements:student_billing_element_id(
          element_title,
          billing_element_id,
          billing_elements(
            category_id,
            billing_element_categories(title)
          )
        )
      `)
      .eq('school_id', schoolId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.from_date) {
      query = query.gte('transaction_date', filters.from_date)
    }
    if (filters?.to_date) {
      query = query.lte('transaction_date', filters.to_date)
    }
    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)

    let result = (data || []).map((t: any) => ({
      ...t,
      student_name: `${t.students?.profile?.first_name || ''} ${t.students?.profile?.last_name || ''}`.trim(),
      grade_level: t.students?.sections?.grade_levels?.name || '',
      element_title: t.student_billing_elements?.element_title || '',
      category_title: t.student_billing_elements?.billing_elements?.billing_element_categories?.title || '',
      students: undefined,
      student_billing_elements: undefined
    }))

    // Post-filter by category
    if (filters?.category_id) {
      result = result.filter((t: any) => {
        const catId = t.student_billing_elements?.billing_elements?.category_id
        return catId === filters.category_id
      })
    }

    return result
  }

  // ---------- REPORTS ----------

  async getCategoryBreakdown(
    schoolId: string,
    filters?: {
      category_id?: string
      from_date?: string
      to_date?: string
      breakdown_by_grade?: boolean
      metric?: 'number' | 'amount'
    }
  ): Promise<any> {
    let query = supabase
      .from('student_billing_elements')
      .select(`
        *,
        students!inner(
          section_id,
          sections(
            grade_levels(id, name)
          )
        ),
        billing_elements(
          category_id,
          billing_element_categories(id, title)
        )
      `)
      .eq('school_id', schoolId)

    if (filters?.from_date) {
      query = query.gte('assigned_date', filters.from_date)
    }
    if (filters?.to_date) {
      query = query.lte('assigned_date', filters.to_date)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch breakdown: ${error.message}`)

    // Process data into breakdown
    const items = data || []
    
    // Filter by category if specified
    let filtered = items
    if (filters?.category_id) {
      filtered = items.filter((sbe: any) => 
        sbe.billing_elements?.category_id === filters.category_id
      )
    }

    if (filters?.breakdown_by_grade) {
      // Group by grade level
      const gradeMap: Record<string, { grade_name: string; count: number; total_amount: number }> = {}
      
      filtered.forEach((sbe: any) => {
        const gradeId = sbe.students?.sections?.grade_levels?.id || 'unknown'
        const gradeName = sbe.students?.sections?.grade_levels?.name || 'Unknown'
        
        if (!gradeMap[gradeId]) {
          gradeMap[gradeId] = { grade_name: gradeName, count: 0, total_amount: 0 }
        }
        gradeMap[gradeId].count += 1
        gradeMap[gradeId].total_amount += sbe.amount || 0
      })

      return {
        breakdown: Object.values(gradeMap),
        total_count: filtered.length,
        total_amount: filtered.reduce((sum: number, sbe: any) => sum + (sbe.amount || 0), 0)
      }
    }

    // Group by category
    const catMap: Record<string, { category_title: string; count: number; total_amount: number }> = {}
    
    filtered.forEach((sbe: any) => {
      const catId = sbe.billing_elements?.billing_element_categories?.id || 'none'
      const catTitle = sbe.billing_elements?.billing_element_categories?.title || 'Uncategorized'
      
      if (!catMap[catId]) {
        catMap[catId] = { category_title: catTitle, count: 0, total_amount: 0 }
      }
      catMap[catId].count += 1
      catMap[catId].total_amount += sbe.amount || 0
    })

    return {
      breakdown: Object.values(catMap),
      total_count: filtered.length,
      total_amount: filtered.reduce((sum: number, sbe: any) => sum + (sbe.amount || 0), 0)
    }
  }

  // ---------- STUDENT LIST (for mass assign) ----------

  async getStudentsByGradeAndSection(
    schoolId: string,
    gradeId?: string,
    sectionId?: string
  ): Promise<any[]> {
    let query = supabase
      .from('students')
      .select(`
        id,
        student_number,
        section_id,
        profile:profiles(first_name, last_name),
        sections(
          id,
          name,
          grade_level_id,
          grade_levels(id, name)
        )
      `)
      .eq('school_id', schoolId)

    if (sectionId) {
      query = query.eq('section_id', sectionId)
    } else if (gradeId) {
      // Filter by grade through section
      const { data: sections } = await supabase
        .from('sections')
        .select('id')
        .eq('grade_level_id', gradeId)
        .eq('school_id', schoolId)

      if (sections && sections.length > 0) {
        query = query.in('section_id', sections.map((s: any) => s.id))
      } else {
        return []
      }
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch students: ${error.message}`)

    return (data || []).map((s: any) => ({
      id: s.id,
      first_name: s.profile?.first_name || '',
      last_name: s.profile?.last_name || '',
      name: `${s.profile?.first_name || ''} ${s.profile?.last_name || ''}`.trim(),
      admission_number: s.student_number,
      section_id: s.section_id,
      section_name: s.sections?.name || '',
      grade_level: s.sections?.grade_levels?.name || '',
      grade_level_id: s.sections?.grade_level_id || ''
    }))
  }
}

export const billingElementsService = new BillingElementsService()
