// Billing elements: one-off charges such as uniforms, trips or books (backend/src/routes/
// billing-elements.routes.ts). Scoped to the user's school on the server (not per campus).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type ElementStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived'

export interface ElementCategory {
  id: string
  title: string
  sort_order: number
  is_active: boolean
  elements_count?: number
}

export interface BillingElement {
  id: string
  category_id: string
  title: string
  amount: number
  grade_level_id: string | null
  /** Optional course-period link: a section and a subject of the grade. */
  course_period_section_id?: string | null
  course_period_subject_id?: string | null
  comment: string | null
  sort_order: number
  is_active: boolean
  category_title?: string
  grade_name?: string
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

export interface StudentElement {
  id: string
  student_id: string
  billing_element_id: string | null
  element_title: string
  amount: number
  due_date: string | null
  assigned_date: string
  comment: string | null
  amount_paid: number
  balance: number
  status: ElementStatus
  student_name?: string
  grade_level?: string
  section_name?: string
  category_title?: string
}

export interface ElementTransaction {
  id: string
  student_billing_element_id: string
  student_id: string
  amount: number
  transaction_date: string
  payment_method: string | null
  comment: string | null
  created_at: string
  student_name?: string
  grade_level?: string
  element_title?: string
  category_title?: string
}

export interface CategoryBreakdown {
  breakdown: { category_title?: string; grade_name?: string; count: number; total_amount: number }[]
  total_count: number
  total_amount: number
}

export interface AssignInput {
  billing_element_id?: string | null
  element_title: string
  amount: number
  due_date?: string | null
  comment?: string | null
}

export function adminBillingElementsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const base = '/billing-elements'
  return {
    /** Active students with grade/section (web: getStudentsForAssign); also used by the portal visibility picker. */
    studentsForAssign: (gradeId?: string, sectionId?: string) => api.get<StudentForAssign[]>(`${base}/students${qs({ grade_id: gradeId, section_id: sectionId })}`),
    categories: () => api.get<ElementCategory[]>(`${base}/categories`),
    createCategory: (title: string, sortOrder?: number) => api.post<ElementCategory>(`${base}/categories`, { title, sort_order: sortOrder }),
    updateCategory: (categoryId: string, input: { title?: string; sort_order?: number }) => api.put<ElementCategory>(`${base}/categories/${id(categoryId)}`, input),
    deleteCategory: (categoryId: string) => api.del<void>(`${base}/categories/${id(categoryId)}`),
    elements: (categoryId?: string) => api.get<BillingElement[]>(`${base}/elements${qs({ category_id: categoryId })}`),
    createElement: (input: {
      category_id: string
      title: string
      amount: number
      grade_level_id?: string | null
      course_period_section_id?: string | null
      course_period_subject_id?: string | null
      comment?: string | null
      sort_order?: number
    }) =>
      api.post<BillingElement>(`${base}/elements`, input),
    updateElement: (elementId: string, input: Partial<Pick<BillingElement, 'category_id' | 'title' | 'amount' | 'grade_level_id' | 'course_period_section_id' | 'course_period_subject_id' | 'comment' | 'sort_order' | 'is_active'>>) =>
      api.put<BillingElement>(`${base}/elements/${id(elementId)}`, input),
    deleteElement: (elementId: string) => api.del<void>(`${base}/elements/${id(elementId)}`),
    studentElements: (f: { student_id?: string; status?: ElementStatus; category_id?: string; from_date?: string; to_date?: string } = {}) =>
      api.get<StudentElement[]>(`${base}/student-elements${qs({ ...f })}`),
    assign: (studentId: string, input: AssignInput) => api.post<StudentElement>(`${base}/student-elements`, { ...input, student_id: studentId }),
    massAssign: (studentIds: string[], input: AssignInput) => api.post<{ count?: number; assigned?: number }>(`${base}/student-elements/mass-assign`, { ...input, student_ids: studentIds }),
    updateStudentElement: (seId: string, input: Partial<AssignInput> & { status?: ElementStatus }) => api.put<StudentElement>(`${base}/student-elements/${id(seId)}`, input),
    deleteStudentElement: (seId: string) => api.del<void>(`${base}/student-elements/${id(seId)}`),
    /** Record a payment against a student's charge. */
    pay: (input: { student_billing_element_id: string; student_id: string; amount: number; transaction_date?: string; payment_method?: string; comment?: string }) =>
      api.post<ElementTransaction>(`${base}/transactions`, input),
    transactions: (f: { from_date?: string; to_date?: string; student_id?: string; category_id?: string } = {}) => api.get<ElementTransaction[]>(`${base}/transactions${qs({ ...f })}`),
    reverseTransaction: (txId: string) => api.del<void>(`${base}/transactions/${id(txId)}`),
    categoryBreakdown: (f: { from_date?: string; to_date?: string; category_id?: string; by_grade?: boolean; metric?: 'number' | 'amount' } = {}) =>
      api.get<CategoryBreakdown>(
        `${base}/reports/category-breakdown${qs({ from_date: f.from_date, to_date: f.to_date, category_id: f.category_id, breakdown_by_grade: f.by_grade ? 'true' : undefined, metric: f.metric })}`,
      ),
  }
}
