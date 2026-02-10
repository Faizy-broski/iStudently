import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { simpleFetch } from './abortable-fetch'
import {
  TimetableEntry,
  CreateTimetableEntryDTO,
  UpdateTimetableEntryDTO,
  TimetableConflict,
  TeacherSchedule,
  AttendanceRecord,
  UpdateAttendanceDTO,
  BulkAttendanceUpdate,
  AttendanceStats,
  DayOfWeek
} from './teachers'

// Re-export types for convenience
export type {
  TimetableEntry,
  CreateTimetableEntryDTO,
  UpdateTimetableEntryDTO,
  TimetableConflict,
  TeacherSchedule,
  AttendanceRecord,
  UpdateAttendanceDTO,
  BulkAttendanceUpdate,
  AttendanceStats,
  DayOfWeek
}

import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================================================
// STEP 2: TIMETABLE CONSTRUCTION API
// ============================================================================

export async function getTimetableBySection(
  sectionId: string,
  academicYearId: string
): Promise<TimetableEntry[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ section_id: sectionId, academic_year_id: academicYearId })

  const response = await fetch(`${API_URL}/timetable/section?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TimetableEntry[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch timetable')
  }

  return result.data
}

export async function getTimetableByTeacher(
  teacherId: string,
  academicYearId: string
): Promise<TimetableEntry[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId, academic_year_id: academicYearId })

  const response = await fetch(`${API_URL}/timetable/teacher?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TimetableEntry[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch timetable')
  }

  return result.data
}

export async function getAvailableSubjectsForSection(
  sectionId: string,
  academicYearId: string
): Promise<any[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ section_id: sectionId, academic_year_id: academicYearId })

  const response = await fetch(`${API_URL}/timetable/available-subjects?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<any[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch available subjects')
  }

  return result.data
}

export async function checkTeacherConflict(
  teacherId: string,
  dayOfWeek: DayOfWeek,
  periodId: string,
  academicYearId: string,
  excludeEntryId?: string
): Promise<TimetableConflict> {
  const token = await getAuthToken()
  const params = new URLSearchParams({
    teacher_id: teacherId,
    day_of_week: dayOfWeek.toString(),
    period_id: periodId,
    academic_year_id: academicYearId
  })
  if (excludeEntryId) params.append('exclude_entry_id', excludeEntryId)

  const response = await fetch(`${API_URL}/timetable/check-conflict?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TimetableConflict> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to check conflict')
  }

  return result.data
}

export async function createTimetableEntry(data: CreateTimetableEntryDTO): Promise<TimetableEntry> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<TimetableEntry> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to create timetable entry')
  }

  return result.data
}

export async function updateTimetableEntry(
  id: string,
  data: UpdateTimetableEntryDTO
): Promise<TimetableEntry> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<TimetableEntry> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update timetable entry')
  }

  return result.data
}

export async function deleteTimetableEntry(id: string): Promise<void> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete timetable entry')
  }
}

// ============================================================================
// STEP 4: TEACHER'S SCHEDULE VIEW API
// ============================================================================

export async function getTeacherSchedule(
  teacherId: string,
  date?: string
): Promise<TeacherSchedule[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId })
  if (date) params.append('date', date)

  try {
    const response = await simpleFetch(`${API_URL}/timetable/teacher-schedule?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000
    })

    if (response.status === 401) {
      await handleSessionExpiry()
      throw new Error('Session expired')
    }

    const result: ApiResponse<TeacherSchedule[]> = await response.json()
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch teacher schedule')
    }

    return result.data
  } catch (error) {
    if (error instanceof Error && error.message === 'Session expired') throw error
    throw new Error('Failed to fetch teacher schedule')
  }
}

export async function getTeacherTimetable(
  teacherId: string,
  academicYearId: string
): Promise<any[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({
    teacher_id: teacherId,
    academic_year_id: academicYearId
  })

  const response = await fetch(`${API_URL}/timetable/teacher-timetable?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<any[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch teacher timetable')
  }

  return result.data
}

export async function getCurrentClass(teacherId: string): Promise<TimetableEntry | null> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId })

  const response = await fetch(`${API_URL}/timetable/current-class?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TimetableEntry> = await response.json()
  return result.data || null
}

export async function getNextClass(teacherId: string): Promise<TimetableEntry | null> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId })

  const response = await fetch(`${API_URL}/timetable/next-class?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<TimetableEntry> = await response.json()
  return result.data || null
}

// ============================================================================
// STEP 3: AUTO-GENERATE ATTENDANCE API
// ============================================================================

export async function generateDailyAttendance(
  date?: string
): Promise<{ generated_count: number; timetable_entries_processed: number }> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable/attendance/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ date })
  })

  const result: ApiResponse<{ generated_count: number; timetable_entries_processed: number }> =
    await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to generate attendance')
  }

  return result.data
}

// ============================================================================
// STEP 4: TEACHER ATTENDANCE MARKING API
// ============================================================================

export async function getAttendanceForClass(
  timetableEntryId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ timetable_entry_id: timetableEntryId, date })

  const response = await fetch(`${API_URL}/timetable/attendance/class?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AttendanceRecord[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch attendance')
  }

  return result.data
}

export async function getAttendanceForSectionDate(
  sectionId: string,
  date: string
): Promise<{ data: AttendanceRecord[], error?: string }> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ section_id: sectionId, date })

  const response = await fetch(`${API_URL}/timetable/attendance/section-date?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AttendanceRecord[]> = await response.json()
  if (!result.success) {
    return { data: [], error: result.error || 'Failed to fetch attendance' }
  }

  return { data: result.data || [] }
}

export async function updateAttendanceRecord(
  id: string,
  data: UpdateAttendanceDTO
): Promise<AttendanceRecord> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable/attendance/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  })

  const result: ApiResponse<AttendanceRecord> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to update attendance')
  }

  return result.data
}

export async function bulkUpdateAttendance(
  timetableEntryId: string,
  date: string,
  updates: BulkAttendanceUpdate[]
): Promise<{ updated_count: number }> {
  const token = await getAuthToken()
  const response = await fetch(`${API_URL}/timetable/attendance/bulk-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ timetable_entry_id: timetableEntryId, date, updates })
  })

  const result: ApiResponse<{ updated_count: number }> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to bulk update attendance')
  }

  return result.data
}

export async function getAttendanceStats(
  timetableEntryId: string,
  date: string
): Promise<AttendanceStats> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ timetable_entry_id: timetableEntryId, date })

  const response = await fetch(`${API_URL}/timetable/attendance/stats?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AttendanceStats> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch attendance stats')
  }

  return result.data
}

export async function getStudentAttendanceHistory(
  studentId: string,
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ student_id: studentId })
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const response = await fetch(`${API_URL}/timetable/attendance/student-history?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<AttendanceRecord[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch student attendance history')
  }

  return result.data
}

export async function getClassAttendanceSummary(
  sectionId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ section_id: sectionId, start_date: startDate, end_date: endDate })

  const response = await fetch(`${API_URL}/timetable/attendance/class-summary?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<any[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch class attendance summary')
  }

  return result.data
}

export async function getTeacherAttendanceOverview(
  teacherId: string,
  date: string
): Promise<any[]> {
  const token = await getAuthToken()
  const params = new URLSearchParams({ teacher_id: teacherId, date })

  const response = await fetch(`${API_URL}/timetable/attendance/teacher-overview?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  })

  const result: ApiResponse<any[]> = await response.json()
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to fetch teacher attendance overview')
  }

  return result.data
}
