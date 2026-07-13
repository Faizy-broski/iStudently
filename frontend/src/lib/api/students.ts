import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getFieldDefinitions } from './custom-fields'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return {
      success: false,
      error: 'Authentication required'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  const impersonatedSchoolId = typeof window !== 'undefined' ? sessionStorage.getItem('impersonatedSchoolId') : null;
  if (impersonatedSchoolId) {
    headers['X-School-Id'] = impersonatedSchoolId;
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      timeout: 30000
    })

    const data = await response.json()

    // Handle 401 Unauthorized
    if (response.status === 401) {
      await handleSessionExpiry()
      return {
        success: false,
        error: 'Session expired'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Request failed'
      }
    }

    return data
  } catch {
    // Silent fail - no logging, no abort checks
    return {
      success: false,
      error: 'Network error'
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface Student {
  id: string
  profile_id: string | null
  school_id: string
  campus_id?: string               // returned when a student is assigned to a campus
  student_number: string
  grade_level: string | null
  medical_info?: {
    id: string
    first_name: string | null
    father_name: string | null // NEW
    grandfather_name: string | null // NEW
    last_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    profile_photo_url: string | null // NEW
    is_active: boolean
  }
  // Returned by GET /students (list endpoint) — not present on all student shapes
  profile?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    profile_photo_url: string | null
    is_active: boolean
  }
  grade?: { id: string; name: string } | null
  section?: { id: string; name: string } | null
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface CreateStudentDTO {
  student_number: string
  grade_level?: string
  grade_level_id?: string
  section_id?: string
  campus_id?: string // Campus/School assignment
  first_name: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW: Supabase storage URL
  password?: string // NEW: Optional password
  gender?: 'male' | 'female' | 'other'
  date_of_birth?: string
  national_id?: string
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface UpdateStudentDTO {
  student_number?: string
  grade_level?: string
  grade_level_id?: string
  section_id?: string
  first_name?: string
  father_name?: string // NEW
  grandfather_name?: string // NEW
  last_name?: string
  email?: string
  phone?: string
  profile_photo_url?: string // NEW
  password?: string // NEW: Optional password update
  is_active?: boolean // NEW: Toggle student active/inactive status
  gender?: 'male' | 'female' | 'other'
  date_of_birth?: string
  national_id?: string
  medical_info?: Student['medical_info']
  custom_fields?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ============================================================================
// STUDENT API
// ============================================================================

export async function getStudents(params?: {
  page?: number
  limit?: number
  search?: string
  grade_level?: string | string[]
  campus_id?: string
  /** Scope results to a specific section (used by teacher dashboard) */
  section_id?: string
}) {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.grade_level) {
    if (Array.isArray(params.grade_level)) {
      params.grade_level.forEach((grade) => queryParams.append('grade_level', grade))
    } else {
      queryParams.append('grade_level', params.grade_level)
    }
  }
  if (params?.campus_id) queryParams.append('campus_id', params.campus_id)
  if (params?.section_id) queryParams.append('section_id', params.section_id)

  const query = queryParams.toString()
  return apiRequest<Student[]>(`/students${query ? `?${query}` : ''}`)
}

export async function getStudentById(id: string, campusId?: string) {
  const queryParams = new URLSearchParams()
  if (campusId) queryParams.append('campus_id', campusId)

  const query = queryParams.toString()
  return apiRequest<Student>(`/students/${id}${query ? `?${query}` : ''}`)
}

export async function getStudentByNumber(studentNumber: string) {
  return apiRequest<Student>(`/students/number/${studentNumber}`)
}

export async function createStudent(data: CreateStudentDTO) {
  return apiRequest<Student>('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateStudent(id: string, data: UpdateStudentDTO, campusId?: string) {
  const queryParams = new URLSearchParams()
  if (campusId) queryParams.append('campus_id', campusId)

  const query = queryParams.toString()
  return apiRequest<Student>(`/students/${id}${query ? `?${query}` : ''}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteStudent(id: string) {
  return apiRequest(`/students/${id}`, {
    method: 'DELETE'
  })
}

export async function getStudentsByGrade(gradeLevel: string) {
  return apiRequest<Student[]>(`/students/grade/${gradeLevel}`)
}

export async function getStudentStats() {
  return apiRequest<{
    total: number
    active: number
    inactive: number
    byGrade: Record<string, number>
  }>('/students/stats')
}

// ============================================================================
// PRINT STUDENT INFO
// ============================================================================

export interface StudentPrintInfo {
  id: string
  student_number: string
  profile: {
    first_name: string
    father_name: string
    grandfather_name: string
    last_name: string
    email: string
    phone: string
    profile_photo_url: string | null
    is_active: boolean
  }
  academic: {
    grade_level: string
    section: string
    admission_date: string
  }
  medical_info: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  custom_fields: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  parent_links: Array<{
    parent: {
      id: string
      profile: {
        first_name: string
        last_name: string
        email: string
        phone: string
      }
    }
    relationship: string
    relation_type: string
  }>
  created_at: string
}

export interface PrintInfoResponse {
  students: StudentPrintInfo[]
  categories: { id: string; name: string }[]
  campus: { id: string; name: string } | null
}

export async function getStudentsPrintInfo(params: {
  studentIds: string[]
  categoryIds: string[]
  campusId?: string
}) {
  return apiRequest<PrintInfoResponse>('/students/print-info', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

// ============================================================================
// BULK IMPORT
// ============================================================================

export interface BulkImportRow {
  first_name: string
  father_name?: string
  grandfather_name?: string
  last_name: string
  email: string
  phone?: string
  gender?: 'male' | 'female' | 'other'
  date_of_birth?: string
  national_id?: string
  /** Admin-defined custom field values, grouped by category_id.field_key */
  custom_fields?: Record<string, any>
  /** Original row number in the uploaded file, echoed back on error rows */
  _row?: number
}

export interface BulkImportError {
  row: number
  error: string
}

export interface BulkImportCreatedStudent {
  student_number: string
  first_name: string
  last_name: string
  username?: string
  password?: string
}

export interface BulkImportResult {
  success_count: number
  error_count: number
  errors: BulkImportError[]
  created: BulkImportCreatedStudent[]
}

export async function bulkImportStudents(
  students: BulkImportRow[],
  target: { gradeLevelId: string; sectionId?: string },
  campusId?: string
) {
  return apiRequest<BulkImportResult>('/students/bulk-import', {
    method: 'POST',
    body: JSON.stringify({
      students,
      grade_level_id: target.gradeLevelId,
      section_id: target.sectionId,
      campus_id: campusId
    })
  })
}

export async function downloadStudentImportTemplate(campusId?: string) {
  const headers = [
    'first_name', 'father_name', 'grandfather_name', 'last_name',
    'email', 'phone', 'gender', 'date_of_birth', 'national_id'
  ]
  const example = [
    'John', 'Robert', 'James', 'Smith',
    'john.smith@school.com', '+1234567890', 'male', '2012-05-14', 'A123456789'
  ]

  const fieldsRes = await getFieldDefinitions('student', campusId)
  if (fieldsRes.success && fieldsRes.data) {
    for (const field of fieldsRes.data) {
      headers.push(field.label)
      example.push(field.options?.[0] ?? '')
    }
  }

  const csvEscape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
  const csv = [headers.map(csvEscape).join(','), example.map(csvEscape).join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'student_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================================
// BULK DELETE (super admin only)
// ============================================================================

export interface BulkDeleteResult {
  deleted: number
  errors: { student_id: string; error: string }[]
}

export async function bulkDeleteStudents(params: {
  studentIds?: string[]
  gradeLevelId?: string
  sectionId?: string
  campusId?: string
}) {
  return apiRequest<BulkDeleteResult>('/students/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({
      student_ids: params.studentIds,
      grade_level_id: params.gradeLevelId,
      section_id: params.sectionId,
      campus_id: params.campusId
    })
  })
}
