import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  count?: number
}

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
  student_name?: string
  grade_level?: string
  element_title?: string
  category_title?: string
}

export interface CategoryBreakdownResult {
  breakdown: {
    category_title?: string
    grade_name?: string
    count: number
    total_amount: number
  }[]
  total_count: number
  total_amount: number
}

export interface StudentForAssign {
  id: string
  first_name: string
  last_name: string
  name: string
  admission_number: string
  section_id: string
  section_name: string
  grade_level: string
  grade_level_id: string
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(): Promise<BillingElementCategory[]> {
  const res = await apiRequest<BillingElementCategory[]>('/billing-elements/categories')
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch categories')
  return res.data
}

export async function createCategory(data: { title: string; sort_order?: number }): Promise<BillingElementCategory> {
  const res = await apiRequest<BillingElementCategory>('/billing-elements/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to create category')
  return res.data
}

export async function updateCategory(id: string, data: { title?: string; sort_order?: number }): Promise<BillingElementCategory> {
  const res = await apiRequest<BillingElementCategory>(`/billing-elements/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to update category')
  return res.data
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await apiRequest(`/billing-elements/categories/${id}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error || 'Failed to delete category')
}

// ============================================================================
// ELEMENTS
// ============================================================================

export async function getElements(categoryId?: string): Promise<BillingElement[]> {
  const params = categoryId ? `?category_id=${categoryId}` : ''
  const res = await apiRequest<BillingElement[]>(`/billing-elements/elements${params}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch elements')
  return res.data
}

export async function getElementById(id: string): Promise<BillingElement> {
  const res = await apiRequest<BillingElement>(`/billing-elements/elements/${id}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch element')
  return res.data
}

export async function createElement(data: {
  category_id: string
  title: string
  amount: number
  course_period_section_id?: string | null
  course_period_subject_id?: string | null
  grade_level_id?: string | null
  comment?: string | null
  sort_order?: number
}): Promise<BillingElement> {
  const res = await apiRequest<BillingElement>('/billing-elements/elements', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to create element')
  return res.data
}

export async function updateElement(id: string, data: Partial<BillingElement>): Promise<BillingElement> {
  const res = await apiRequest<BillingElement>(`/billing-elements/elements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to update element')
  return res.data
}

export async function deleteElement(id: string): Promise<void> {
  const res = await apiRequest(`/billing-elements/elements/${id}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error || 'Failed to delete element')
}

// ============================================================================
// STUDENT BILLING ELEMENTS
// ============================================================================

export async function getStudentElements(filters?: {
  student_id?: string
  status?: string
  category_id?: string
  from_date?: string
  to_date?: string
}): Promise<StudentBillingElement[]> {
  const params = new URLSearchParams()
  if (filters?.student_id) params.append('student_id', filters.student_id)
  if (filters?.status) params.append('status', filters.status)
  if (filters?.category_id) params.append('category_id', filters.category_id)
  if (filters?.from_date) params.append('from_date', filters.from_date)
  if (filters?.to_date) params.append('to_date', filters.to_date)
  const query = params.toString() ? `?${params.toString()}` : ''
  
  const res = await apiRequest<StudentBillingElement[]>(`/billing-elements/student-elements${query}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch student elements')
  return res.data
}

export async function assignElement(data: {
  student_id: string
  billing_element_id?: string | null
  element_title: string
  amount: number
  due_date?: string | null
  comment?: string | null
}): Promise<StudentBillingElement> {
  const res = await apiRequest<StudentBillingElement>('/billing-elements/student-elements', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to assign element')
  return res.data
}

export async function massAssignElement(data: {
  student_ids: string[]
  billing_element_id?: string | null
  element_title: string
  amount: number
  due_date?: string | null
  comment?: string | null
}): Promise<{ data: StudentBillingElement[]; count: number }> {
  const res = await apiRequest<StudentBillingElement[]>('/billing-elements/student-elements/mass-assign', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to mass assign')
  return { data: res.data, count: res.count || res.data.length }
}

export async function updateStudentElement(id: string, data: {
  billing_element_id?: string | null
  element_title?: string
  amount?: number
  due_date?: string | null
  comment?: string | null
  status?: string
}): Promise<StudentBillingElement> {
  const res = await apiRequest<StudentBillingElement>(`/billing-elements/student-elements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to update student element')
  return res.data
}

export async function deleteStudentElement(id: string): Promise<void> {
  const res = await apiRequest(`/billing-elements/student-elements/${id}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error || 'Failed to delete student element')
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function recordTransaction(data: {
  student_billing_element_id: string
  student_id: string
  amount: number
  transaction_date?: string
  payment_method?: string
  comment?: string
}): Promise<BillingElementTransaction> {
  const res = await apiRequest<BillingElementTransaction>('/billing-elements/transactions', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to record transaction')
  return res.data
}

export async function getTransactions(filters?: {
  from_date?: string
  to_date?: string
  category_id?: string
  student_id?: string
}): Promise<BillingElementTransaction[]> {
  const params = new URLSearchParams()
  if (filters?.from_date) params.append('from_date', filters.from_date)
  if (filters?.to_date) params.append('to_date', filters.to_date)
  if (filters?.category_id) params.append('category_id', filters.category_id)
  if (filters?.student_id) params.append('student_id', filters.student_id)
  const query = params.toString() ? `?${params.toString()}` : ''

  const res = await apiRequest<BillingElementTransaction[]>(`/billing-elements/transactions${query}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch transactions')
  return res.data
}

// ============================================================================
// REPORTS
// ============================================================================

export async function getCategoryBreakdown(filters?: {
  category_id?: string
  from_date?: string
  to_date?: string
  breakdown_by_grade?: boolean
  metric?: 'number' | 'amount'
}): Promise<CategoryBreakdownResult> {
  const params = new URLSearchParams()
  if (filters?.category_id) params.append('category_id', filters.category_id)
  if (filters?.from_date) params.append('from_date', filters.from_date)
  if (filters?.to_date) params.append('to_date', filters.to_date)
  if (filters?.breakdown_by_grade) params.append('breakdown_by_grade', 'true')
  if (filters?.metric) params.append('metric', filters.metric)
  const query = params.toString() ? `?${params.toString()}` : ''

  const res = await apiRequest<CategoryBreakdownResult>(`/billing-elements/reports/category-breakdown${query}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch breakdown')
  return res.data
}

// ============================================================================
// STUDENTS (for mass assign)
// ============================================================================

export async function getStudentsForAssign(gradeId?: string, sectionId?: string): Promise<StudentForAssign[]> {
  const params = new URLSearchParams()
  if (gradeId) params.append('grade_id', gradeId)
  if (sectionId) params.append('section_id', sectionId)
  const query = params.toString() ? `?${params.toString()}` : ''

  const res = await apiRequest<StudentForAssign[]>(`/billing-elements/students${query}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch students')
  return res.data
}
