// Timetable auto-generator (school admin): requirements per section/grade, coverage, teacher load
// constraints, solver settings, generation jobs, and rooms. Same endpoints as
// frontend/src/lib/api/{timetable-requirements,timetable-generation,rooms}.ts;
// routers: timetable.routes.ts, rooms.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type RoomType = 'classroom' | 'lab' | 'auditorium' | 'library' | 'gym' | 'office' | 'other'
export const ROOM_TYPES: RoomType[] = ['classroom', 'lab', 'auditorium', 'library', 'gym', 'office', 'other']

export interface TimetableRequirement {
  id: string
  academic_year_id: string
  section_id: string | null
  grade_level_id: string | null
  subject_id: string
  teacher_id: string | null
  periods_per_week: number
  double_period: boolean
  preferred_room_type: RoomType | null
  min_gap_days: number
  is_active: boolean
  section_name?: string
  grade_name?: string
  subject_name?: string
  subject_code?: string
  teacher_name?: string
}

export interface RequirementInput {
  academic_year_id: string
  section_id?: string | null
  grade_level_id?: string | null
  subject_id: string
  teacher_id?: string | null
  periods_per_week: number
  double_period?: boolean
  preferred_room_type?: RoomType | null
  min_gap_days?: number
}

export interface RequirementPatch {
  teacher_id?: string | null
  periods_per_week?: number
  double_period?: boolean
  preferred_room_type?: RoomType | null
  min_gap_days?: number
  is_active?: boolean
}

export interface RequirementCoverage {
  academic_year_id: string
  required_periods_per_week: number
  available_periods_per_week: number
  is_over_capacity: boolean
  requirement_count: number
}

export interface TeacherConstraint {
  id: string
  teacher_id: string
  academic_year_id: string
  max_periods_per_day: number | null
  max_periods_per_week: number | null
  min_gap_between_periods: number
  max_consecutive_periods: number | null
  teacher_name?: string
}

export interface TeacherConstraintInput {
  teacher_id: string
  academic_year_id: string
  campus_id?: string
  max_periods_per_day?: number | null
  max_periods_per_week?: number | null
  min_gap_between_periods?: number
  max_consecutive_periods?: number | null
}

export interface GenerationSettings {
  id: string
  academic_year_id: string
  default_max_periods_per_day: number
  default_min_gap_between_periods: number
  weight_teacher_availability_preferred: number
  weight_gap_violation: number
  weight_daily_load_violation: number
  weight_double_period_broken: number
  weight_frequency_spread: number
  solver_time_limit_seconds: number
}

export type GenerationSettingsInput = Partial<Omit<GenerationSettings, 'id'>> & { academic_year_id: string; campus_id?: string }

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface GenerationJob {
  id: string
  academic_year_id: string
  status: GenerationJobStatus
  scope: 'all' | 'sections'
  section_ids: string[] | null
  grade_level_ids: string[] | null
  progress_percent: number
  total_activities: number | null
  placed_activities: number | null
  unplaced_activities: number | null
  hard_violations: number
  soft_score: number | null
  result_summary: {
    unplaced?: { activity_id: string; reason: string; section_id?: string; section_name?: string; subject_name?: string; teacher_name?: string }[]
    warnings?: string[]
  } | null
  error_message: string | null
  created_at: string
}

export interface Room {
  id: string
  campus_id?: string | null
  name: string
  capacity?: number | null
  building?: string | null
  floor?: string | null
  room_type: RoomType
  is_active: boolean
}

export interface RoomInput {
  name?: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: RoomType
  is_active?: boolean
}

export function adminGeneratorApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    requirements: (academicYearId: string, sectionId?: string, gradeLevelId?: string) =>
      api.get<TimetableRequirement[]>(`/timetable/requirements${qs({ academic_year_id: academicYearId, section_id: sectionId, grade_level_id: sectionId ? undefined : gradeLevelId })}`),
    createRequirement: (body: RequirementInput) => api.post<TimetableRequirement>('/timetable/requirements', body),
    updateRequirement: (reqId: string, body: RequirementPatch) => api.put<TimetableRequirement>(`/timetable/requirements/${id(reqId)}`, body),
    deleteRequirement: (reqId: string) => api.del<void>(`/timetable/requirements/${id(reqId)}`),
    seedRequirements: (academicYearId: string, sectionId?: string) =>
      api.post<TimetableRequirement[]>('/timetable/requirements/seed-from-assignments', { academic_year_id: academicYearId, section_id: sectionId }),
    coverage: (scopeId: string, academicYearId: string, mode: 'section' | 'grade' = 'section') =>
      api.get<RequirementCoverage>(`/timetable/requirements/coverage${qs({ academic_year_id: academicYearId, section_id: mode === 'section' ? scopeId : undefined, grade_level_id: mode === 'grade' ? scopeId : undefined })}`),

    teacherConstraints: (academicYearId: string) => api.get<TeacherConstraint[]>(`/timetable/teacher-constraints${qs({ academic_year_id: academicYearId })}`),
    upsertTeacherConstraint: (teacherId: string, body: TeacherConstraintInput) => api.put<TeacherConstraint>(`/timetable/teacher-constraints/${id(teacherId)}`, body),
    settings: (academicYearId: string, campusId?: string) => api.get<GenerationSettings>(`/timetable/generation-settings${qs({ academic_year_id: academicYearId, campus_id: campusId })}`),
    updateSettings: (body: GenerationSettingsInput) => api.put<GenerationSettings>('/timetable/generation-settings', body),

    /** 409 with errorData.existing_job_id when a job is already running. */
    start: (body: { campus_id?: string; academic_year_id: string; scope: 'all' | 'sections'; section_ids?: string[]; grade_level_ids?: string[] }) =>
      api.post<{ job_id: string }>('/timetable/generate', body),
    job: (jobId: string) => api.get<GenerationJob>(`/timetable/generate/${id(jobId)}/status`),
    jobs: (academicYearId: string, page = 1, limit = 20) => api.get<GenerationJob[]>(`/timetable/generate/jobs${qs({ academic_year_id: academicYearId, page, limit })}`),
    cancel: (jobId: string) => api.post<void>(`/timetable/generate/${id(jobId)}/cancel`),
    rollback: (jobId: string) => api.post<{ rolled_back_count: number }>(`/timetable/generate/${id(jobId)}/rollback`),

    rooms: (campusId?: string, activeOnly = true) => api.get<Room[]>(`/rooms${qs({ campus_id: campusId, active_only: activeOnly ? undefined : 'false' })}`),
    createRoom: (body: RoomInput & { name: string }) => api.post<Room>('/rooms', body),
    updateRoom: (roomId: string, body: RoomInput) => api.put<Room>(`/rooms/${id(roomId)}`, body),
    deleteRoom: (roomId: string) => api.del<void>(`/rooms/${id(roomId)}`),
  }
}
