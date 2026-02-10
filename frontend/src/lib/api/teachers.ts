import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// TYPES
// ============================================================================

export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Monday, 6 = Sunday

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  username?: string | null
}

export interface Staff {
  id: string
  profile_id: string
  school_id: string
  employee_number: string
  title: string | null
  department: string | null
  qualifications: string | null
  specialization: string | null
  date_of_joining: string | null
  employment_type: EmploymentType
  is_active: boolean
  permissions: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string | null
  profile?: Profile
  assigned_subjects?: TeacherSubjectAssignment[]
  custom_fields?: Record<string, any>
  base_salary?: number // From salary_settings table (may not always be loaded)
}

export interface CreateStaffDTO {
  profile_id?: string
  school_id?: string
  employee_number?: string // Optional - auto-generated if not provided
  title?: string
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  permissions?: Record<string, any>
  created_by?: string
  // Profile data (if creating new user)
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  // Credentials (optional - auto-generated if not provided)
  username?: string
  password?: string
  // Salary (optional)
  base_salary?: number
  custom_fields?: Record<string, any>
}

export interface UpdateStaffDTO {
  employee_number?: string
  title?: string
  department?: string
  qualifications?: string
  specialization?: string
  date_of_joining?: string
  employment_type?: EmploymentType
  is_active?: boolean
  permissions?: Record<string, any>
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  password?: string // NEW: Optional password update
  base_salary?: number // NEW: Optional base salary update
  custom_fields?: Record<string, any>
}

export interface AcademicYear {
  id: string
  school_id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAcademicYearDTO {
  name: string
  start_date: string
  end_date: string
  is_current?: boolean
}

export interface UpdateAcademicYearDTO {
  name?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  is_active?: boolean
}

export interface Period {
  id: string
  school_id: string
  campus_id?: string | null
  // Legacy fields (still supported for backward compatibility)
  period_number: number
  start_time: string
  end_time: string
  period_name: string | null
  is_break: boolean
  is_active: boolean
  created_at: string
  // New global period fields
  title?: string
  short_name?: string
  sort_order?: number
  length_minutes?: number
  block?: string
}

export interface CreatePeriodDTO {
  period_number: number
  start_time: string
  end_time: string
  period_name?: string
  is_break?: boolean
  campus_id?: string
}

export interface UpdatePeriodDTO {
  period_number?: number
  start_time?: string
  end_time?: string
  period_name?: string
  is_break?: boolean
  is_active?: boolean
}

// Step 1: Workload Allocation
export interface TeacherSubjectAssignment {
  id: string
  school_id: string
  teacher_id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary: boolean
  assigned_at: string
  assigned_by: string | null
  // Flattened fields
  teacher_name?: string
  subject_name?: string
  section_name?: string
  grade_name?: string
  // Nested objects from backend
  teacher?: {
    id: string
    profile?: {
      first_name: string | null
      last_name: string | null
    }
  }
  subject?: {
    id: string
    name: string
    code?: string
  }
  section?: {
    id: string
    name: string
    grade_level?: {
      id?: string
      name: string
    }
  }
  academic_year?: {
    name: string
  }
}

export interface CreateTeacherAssignmentDTO {
  teacher_id: string
  subject_id: string
  section_id: string
  academic_year_id: string
  is_primary?: boolean
}

// Step 2: Timetable Construction
export interface TimetableEntry {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: DayOfWeek
  room_number: string | null
  is_active: boolean
  created_at: string
  created_by: string | null
  // Flattened fields for display
  section_name?: string
  grade_name?: string
  subject_name?: string
  teacher_name?: string
  period_number?: number
  start_time?: string
  end_time?: string
  // Nested relation objects
  section?: {
    id: string
    name: string
    current_strength?: number
    grade?: {
      name: string
    }
    grade_level?: {
      name: string
    }
  }
  subject?: {
    id: string
    name: string
  }
  period?: {
    id: string
    period_number: number
    start_time: string
    end_time: string
  }
}

export interface CreateTimetableEntryDTO {
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: DayOfWeek
  room_number?: string
  campus_id?: string
}

export interface UpdateTimetableEntryDTO {
  subject_id?: string
  teacher_id?: string
  period_id?: string
  day_of_week?: DayOfWeek
  room_number?: string
  is_active?: boolean
}

export interface TimetableConflict {
  has_conflict: boolean
  conflict_details: string
}

export interface TeacherSchedule {
  id: string
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  subject_name: string | null
  section_name: string | null
  grade_name: string | null
  room_number: string | null
  is_break: boolean
  section_id?: string
  subject_id?: string
}

// Step 3 & 4: Attendance
export interface AttendanceRecord {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  timetable_entry_id: string
  attendance_date: string
  status: AttendanceStatus
  marked_at: string
  marked_by: string | null
  auto_generated: boolean
  remarks: string | null
  student_name?: string
  student_number?: string
}

export interface UpdateAttendanceDTO {
  status: AttendanceStatus
  remarks?: string
}

export interface BulkAttendanceUpdate {
  student_id: string
  status: AttendanceStatus
  remarks?: string
}

export interface AttendanceStats {
  total_students: number
  present: number
  absent: number
  late: number
  excused: number
  percentage: number
}

// ============================================================================
// TEACHER / STAFF API
// ============================================================================

export async function getAllTeachers(params?: {
  page?: number
  limit?: number
  search?: string
  campus_id?: string
}): Promise<{ data: Staff[], total: number, page: number, totalPages: number }> {
  const token = await getAuthToken()

  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.limit) queryParams.append('limit', params.limit.toString())
  if (params?.search) queryParams.append('search', params.search)
  if (params?.campus_id) queryParams.append('campus_id', params.campus_id)

  const query = queryParams.toString()

  try {
    const response = await simpleFetch(`${API_URL}/teachers${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    })

    if (response.status === 401) {
      await handleSessionExpiry()
      throw new Error('Session expired')
    }

    const result: ApiResponse<{ data: Staff[], total: number, page: number, totalPages: number }> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch teachers')
    }

    return result.data
  } catch (error) {
    if (error instanceof Error && error.message === 'Session expired') throw error
    throw new Error('Failed to fetch teachers')
  }
}

export async function getTeacherById(id: string): Promise<Staff> {
  const token = await getAuthToken()

  try {
    const response = await simpleFetch(`${API_URL}/teachers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    })

    if (response.status === 401) {
      await handleSessionExpiry()
      throw new Error('Session expired')
    }

    const result: ApiResponse<Staff> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch teacher')
    }

    return result.data
  } catch (error) {
    if (error instanceof Error && error.message === 'Session expired') throw error
    throw new Error('Failed to fetch teacher')
  }
}

export async function createTeacher(data: CreateStaffDTO): Promise<Staff> {
  console.log('🔧 API: Creating teacher with data:', data)
  console.log('💰 API: base_salary =', data.base_salary, 'Type:', typeof data.base_salary)

  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<Staff> = await response.json()
  console.log('🔧 API: Create teacher result:', result)

  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create teacher')
  }

  return result.data
}

export async function updateTeacher(id: string, data: UpdateStaffDTO): Promise<Staff> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<Staff> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update teacher')
  }

  return result.data
}

export async function deleteTeacher(id: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete teacher')
  }
}

// ============================================================================
// STEP 1: WORKLOAD ALLOCATION API
// ============================================================================

export async function getTeacherAssignments(
  campusIdOrTeacherId?: string,
  academicYearIdOrOptions?: string | { teacher_id?: string, academic_year_id?: string }
): Promise<TeacherSubjectAssignment[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams()

  // Support both old signature (teacherId, academicYearId) and new (campusId)
  // If the first param looks like a UUID and there's no second param or second is an object, treat as campus_id
  if (campusIdOrTeacherId) {
    if (typeof academicYearIdOrOptions === 'object' || academicYearIdOrOptions === undefined) {
      // New signature: (campusId, {teacher_id?, academic_year_id?})
      params.append('campus_id', campusIdOrTeacherId)
      if (typeof academicYearIdOrOptions === 'object') {
        if (academicYearIdOrOptions.teacher_id) params.append('teacher_id', academicYearIdOrOptions.teacher_id)
        if (academicYearIdOrOptions.academic_year_id) params.append('academic_year_id', academicYearIdOrOptions.academic_year_id)
      }
    } else {
      // Old signature: (teacherId, academicYearId)
      params.append('teacher_id', campusIdOrTeacherId)
      if (academicYearIdOrOptions) params.append('academic_year_id', academicYearIdOrOptions)
    }
  }

  const response = await fetch(`${API_URL}/teachers/assignments?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TeacherSubjectAssignment[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch teacher assignments')
  }

  return result.data
}

export async function createTeacherAssignment(
  data: CreateTeacherAssignmentDTO
): Promise<TeacherSubjectAssignment> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/assignments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<TeacherSubjectAssignment> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create teacher assignment')
  }

  return result.data
}

export async function deleteTeacherAssignment(id: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/assignments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete teacher assignment')
  }
}

// ============================================================================
// ACADEMIC YEAR API
// ============================================================================

export async function getAcademicYears(): Promise<AcademicYear[]> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/academic-years`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AcademicYear[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch academic years')
  }

  return result.data
}

export async function getCurrentAcademicYear(): Promise<AcademicYear | null> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/academic-years/current`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AcademicYear> = await response.json()
  return result.data || null
}

export async function createAcademicYear(data: CreateAcademicYearDTO): Promise<AcademicYear> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/academic-years`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<AcademicYear> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create academic year')
  }

  return result.data
}

export async function updateAcademicYear(
  id: string,
  data: UpdateAcademicYearDTO
): Promise<AcademicYear> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/academic-years/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<AcademicYear> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update academic year')
  }

  return result.data
}

// ============================================================================
// PERIOD API
// ============================================================================

export async function getPeriods(campusId?: string): Promise<Period[]> {
  const token = await getAuthToken()
  const params = campusId ? `?campus_id=${campusId}` : ''
  const response = await fetch(`${API_URL}/teachers/periods${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<Period[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch periods')
  }

  return result.data
}

export async function createPeriod(data: CreatePeriodDTO): Promise<Period> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/periods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<Period> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create period')
  }

  return result.data
}

export async function updatePeriod(id: string, data: UpdatePeriodDTO): Promise<Period> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/periods/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<Period> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update period')
  }

  return result.data
}

export async function deletePeriod(id: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/teachers/periods/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete period')
  }
}

// ============================================================================
// GLOBAL PERIODS API (from /periods endpoint - the global period definitions)
// ============================================================================

export interface GlobalPeriod {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  short_name: string
  sort_order: number
  length_minutes: number
  block?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export async function getGlobalPeriods(campusId?: string): Promise<GlobalPeriod[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams()
  if (campusId) {
    params.append('campus_id', campusId)
  }
  const queryString = params.toString() ? `?${params.toString()}` : ''

  const response = await fetch(`${API_URL}/periods${queryString}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<GlobalPeriod[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch global periods')
  }

  // Sort by sort_order
  return result.data.sort((a, b) => a.sort_order - b.sort_order)
}
