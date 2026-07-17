import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

// ============================================================================
// TIMETABLE REQUIREMENTS / TEACHER CONSTRAINTS / GENERATION SETTINGS API
// Typed client for the FET-style generator's "activity" definition endpoints.
// Follows the same fetch + Bearer-token + { success, data, error } convention
// as `lib/api/timetable.ts`.
// ============================================================================

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

export type RoomType = 'classroom' | 'lab' | 'auditorium' | 'library' | 'gym' | 'office' | 'other'

export const ROOM_TYPES: RoomType[] = ['classroom', 'lab', 'auditorium', 'library', 'gym', 'office', 'other']

export interface TimetableRequirement {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string | null
  periods_per_week: number
  double_period: boolean
  preferred_room_type: RoomType | null
  min_gap_days: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  section_name?: string
  grade_name?: string
  subject_name?: string
  subject_code?: string
  teacher_name?: string
}

export interface CreateTimetableRequirementDTO {
  school_id?: string
  campus_id?: string
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id?: string | null
  periods_per_week: number
  double_period?: boolean
  preferred_room_type?: RoomType | null
  min_gap_days?: number
}

export interface UpdateTimetableRequirementDTO {
  teacher_id?: string | null
  periods_per_week?: number
  double_period?: boolean
  preferred_room_type?: RoomType | null
  min_gap_days?: number
  is_active?: boolean
}

export interface RequirementCoverageSummary {
  section_id: string
  academic_year_id: string
  required_periods_per_week: number
  available_periods_per_week: number
  is_over_capacity: boolean
  requirement_count: number
}

export interface TeacherSchedulingConstraint {
  id: string
  school_id: string
  campus_id?: string | null
  teacher_id: string
  academic_year_id: string
  max_periods_per_day: number | null
  max_periods_per_week: number | null
  min_gap_between_periods: number
  max_consecutive_periods: number | null
  created_at: string
  updated_at: string
  teacher_name?: string
}

export interface UpsertTeacherSchedulingConstraintDTO {
  school_id?: string
  campus_id?: string
  teacher_id: string
  academic_year_id: string
  max_periods_per_day?: number | null
  max_periods_per_week?: number | null
  min_gap_between_periods?: number
  max_consecutive_periods?: number | null
}

export interface TimetableGenerationSettings {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  default_max_periods_per_day: number
  default_min_gap_between_periods: number
  weight_teacher_availability_preferred: number
  weight_gap_violation: number
  weight_daily_load_violation: number
  weight_double_period_broken: number
  weight_frequency_spread: number
  solver_time_limit_seconds: number
  created_at: string
  updated_at: string
}

export interface UpdateTimetableGenerationSettingsDTO {
  school_id?: string
  campus_id?: string
  academic_year_id: string
  default_max_periods_per_day?: number
  default_min_gap_between_periods?: number
  weight_teacher_availability_preferred?: number
  weight_gap_violation?: number
  weight_daily_load_violation?: number
  weight_double_period_broken?: number
  weight_frequency_spread?: number
  solver_time_limit_seconds?: number
}

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getAuthToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

// ----------------------------------------------------------------------------
// Requirements
// ----------------------------------------------------------------------------

export async function listRequirements(
  academicYearId: string,
  sectionId?: string
): Promise<TimetableRequirement[]> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  if (sectionId) params.append('section_id', sectionId)

  const response = await fetch(`${API_URL}/timetable/requirements?${params}`, { headers })
  const result: ApiResponse<TimetableRequirement[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch requirements')
  return result.data || []
}

export async function createRequirement(data: CreateTimetableRequirementDTO): Promise<TimetableRequirement> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/requirements`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<TimetableRequirement> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to create requirement')
  return result.data
}

export async function bulkCreateRequirements(
  requirements: CreateTimetableRequirementDTO[]
): Promise<TimetableRequirement[]> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/requirements/bulk`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requirements })
  })
  const result: ApiResponse<TimetableRequirement[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to bulk create requirements')
  return result.data || []
}

export async function updateRequirement(
  id: string,
  data: UpdateTimetableRequirementDTO
): Promise<TimetableRequirement> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/requirements/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<TimetableRequirement> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to update requirement')
  return result.data
}

export async function deleteRequirement(id: string): Promise<void> {
  const headers = await authHeaders(false)
  const response = await fetch(`${API_URL}/timetable/requirements/${id}`, {
    method: 'DELETE',
    headers
  })
  const result: ApiResponse = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to delete requirement')
}

export async function seedRequirementsFromAssignments(
  academicYearId: string,
  sectionId?: string
): Promise<TimetableRequirement[]> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/requirements/seed-from-assignments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ academic_year_id: academicYearId, section_id: sectionId })
  })
  const result: ApiResponse<TimetableRequirement[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to seed requirements')
  return result.data || []
}

export async function getCoverage(
  sectionId: string,
  academicYearId: string
): Promise<RequirementCoverageSummary> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({ section_id: sectionId, academic_year_id: academicYearId })
  const response = await fetch(`${API_URL}/timetable/requirements/coverage?${params}`, { headers })
  const result: ApiResponse<RequirementCoverageSummary> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch coverage')
  return result.data
}

// ----------------------------------------------------------------------------
// Teacher scheduling constraints
// ----------------------------------------------------------------------------

export async function listTeacherConstraints(academicYearId: string): Promise<TeacherSchedulingConstraint[]> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  const response = await fetch(`${API_URL}/timetable/teacher-constraints?${params}`, { headers })
  const result: ApiResponse<TeacherSchedulingConstraint[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch teacher constraints')
  return result.data || []
}

export async function getTeacherConstraints(
  teacherId: string,
  academicYearId: string
): Promise<TeacherSchedulingConstraint | null> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  const response = await fetch(`${API_URL}/timetable/teacher-constraints/${teacherId}?${params}`, { headers })
  const result: ApiResponse<TeacherSchedulingConstraint> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch teacher constraints')
  return result.data || null
}

export async function upsertTeacherConstraints(
  teacherId: string,
  data: UpsertTeacherSchedulingConstraintDTO
): Promise<TeacherSchedulingConstraint> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/teacher-constraints/${teacherId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<TeacherSchedulingConstraint> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to update teacher constraints')
  return result.data
}

// ----------------------------------------------------------------------------
// Generation settings
// ----------------------------------------------------------------------------

export async function getGenerationSettings(
  academicYearId: string,
  campusId?: string
): Promise<TimetableGenerationSettings> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams({ academic_year_id: academicYearId })
  if (campusId) params.append('campus_id', campusId)
  const response = await fetch(`${API_URL}/timetable/generation-settings?${params}`, { headers })
  const result: ApiResponse<TimetableGenerationSettings> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch generation settings')
  return result.data
}

export async function updateGenerationSettings(
  data: UpdateTimetableGenerationSettingsDTO
): Promise<TimetableGenerationSettings> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/timetable/generation-settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<TimetableGenerationSettings> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to update generation settings')
  return result.data
}
