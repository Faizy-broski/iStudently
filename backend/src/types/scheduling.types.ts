// ============================================================================
// SCHEDULING MODULE — Type Definitions
// Individual student scheduling built on existing timetable + course_periods
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// ROOMS
// ────────────────────────────────────────────────────────────────────────────

export type RoomType = 'classroom' | 'lab' | 'auditorium' | 'library' | 'gym' | 'office' | 'other'

export interface Room {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  capacity?: number | null
  building?: string | null
  floor?: string | null
  room_type: RoomType
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface CreateRoomDTO {
  name: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: RoomType
}

export interface UpdateRoomDTO {
  name?: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: RoomType
  is_active?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// TEACHER AVAILABILITY
// ────────────────────────────────────────────────────────────────────────────

export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred'

export interface TeacherAvailabilityEntry {
  id: string
  school_id: string
  campus_id?: string | null
  teacher_id: string
  academic_year_id: string
  day_of_week: number
  period_id: string
  status: AvailabilityStatus
  reason?: string | null
  created_at: string
  updated_at: string
  // Joined
  teacher?: any
  period?: any
}

export interface SetTeacherAvailabilityDTO {
  teacher_id: string
  academic_year_id: string
  entries: {
    day_of_week: number
    period_id: string
    status: AvailabilityStatus
    reason?: string
  }[]
}

// ────────────────────────────────────────────────────────────────────────────
// STUDENT SCHEDULES (individual course-period enrollment)
// ────────────────────────────────────────────────────────────────────────────

export interface StudentSchedule {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string | null
  start_date: string
  end_date?: string | null
  scheduler_lock: boolean
  enrolled_by?: string | null
  created_at: string
  updated_at: string
  // Joined
  student?: any
  course?: any
  course_period?: any
}

export interface EnrollStudentDTO {
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string
  start_date?: string  // defaults to today
  campus_id?: string
}

export interface DropStudentDTO {
  student_id: string
  course_period_id: string
  end_date?: string  // defaults to today
}

export interface MassEnrollDTO {
  student_ids: string[]
  course_period_id: string
  course_id: string
  academic_year_id: string
  marking_period_id?: string
  start_date?: string
  campus_id?: string
}

export interface MassDropDTO {
  student_ids: string[]
  course_period_id: string
  end_date?: string
}

// ────────────────────────────────────────────────────────────────────────────
// SCHEDULE REQUESTS
// ────────────────────────────────────────────────────────────────────────────

export type RequestStatus = 'pending' | 'fulfilled' | 'unfilled' | 'cancelled'

export interface ScheduleRequest {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  course_id: string
  subject_id?: string | null
  academic_year_id: string
  marking_period_id?: string | null
  with_teacher_id?: string | null
  not_teacher_id?: string | null
  with_period_id?: string | null
  not_period_id?: string | null
  priority: number
  status: RequestStatus
  fulfilled_course_period_id?: string | null
  requested_by?: string | null
  created_at: string
  updated_at: string
  // Joined
  student?: any
  course?: any
  subject?: any
  with_teacher?: any
  not_teacher?: any
  with_period?: any
  not_period?: any
  fulfilled_course_period?: any
}

export interface CreateScheduleRequestDTO {
  student_id: string
  course_id: string
  subject_id?: string
  academic_year_id: string
  marking_period_id?: string
  with_teacher_id?: string
  not_teacher_id?: string
  with_period_id?: string
  not_period_id?: string
  priority?: number
  campus_id?: string
}

export interface UpdateScheduleRequestDTO {
  with_teacher_id?: string | null
  not_teacher_id?: string | null
  with_period_id?: string | null
  not_period_id?: string | null
  priority?: number
  status?: RequestStatus
}

export interface MassCreateRequestDTO {
  student_ids: string[]
  course_id: string
  academic_year_id: string
  marking_period_id?: string
  campus_id?: string
  priority?: number
}

// ────────────────────────────────────────────────────────────────────────────
// SCHEDULER ENGINE
// ────────────────────────────────────────────────────────────────────────────

export interface SchedulerOptions {
  school_id: string
  campus_id?: string
  academic_year_id: string
  marking_period_id?: string
  course_id?: string                 // run for one course, or null = all
  respect_teacher_availability: boolean
  respect_room_capacity: boolean
  respect_gender_restrictions: boolean
  use_priority_ordering: boolean
}

export interface SchedulerResult {
  total_requests: number
  fulfilled: number
  unfilled: number
  errors: string[]
  details: {
    student_id: string
    course_id: string
    status: 'fulfilled' | 'unfilled'
    course_period_id?: string
    reason?: string
  }[]
}

export interface ScheduleConflict {
  conflicting_schedule_id: string
  conflicting_course_period_id: string
  conflicting_course_title: string
  conflicting_period_title: string
  conflicting_day_of_week: number
}

// ────────────────────────────────────────────────────────────────────────────
// ADD/DROP LOG (derived from student_schedules audit)
// ────────────────────────────────────────────────────────────────────────────

export interface AddDropRecord {
  student_id: string
  student_name?: string
  course_title: string
  course_period_title?: string
  action: 'add' | 'drop'
  date: string
  enrolled_by?: string
}

// ────────────────────────────────────────────────────────────────────────────
// TIMETABLE TEMPLATES
// ────────────────────────────────────────────────────────────────────────────

export interface TimetableTemplate {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  description?: string | null
  grade_level_id?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  entries?: TimetableTemplateEntry[]
}

export interface TimetableTemplateEntry {
  id: string
  template_id: string
  subject_id?: string | null
  period_id?: string | null
  day_of_week: number
  room_id?: string | null
  teacher_id?: string | null
  created_at: string
}

export interface CreateTemplateDTO {
  name: string
  description?: string
  grade_level_id?: string
  campus_id?: string
  entries?: {
    subject_id?: string
    period_id?: string
    day_of_week: number
    room_id?: string
    teacher_id?: string
  }[]
}

export interface SaveTemplateFromSectionDTO {
  name: string
  description?: string
  section_id: string
  academic_year_id: string
  campus_id?: string
}

export interface ApplyTemplateDTO {
  template_id: string
  section_id: string
  academic_year_id: string
  clear_existing?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// EXTENDED COURSE PERIOD (with new scheduling columns)
// ────────────────────────────────────────────────────────────────────────────

export type GenderRestriction = 'N' | 'M' | 'F'

export interface CoursePeriodSchedulingExtension {
  total_seats?: number | null
  filled_seats: number
  room?: string | null
  days?: string | null
  gender_restriction: GenderRestriction
  parent_id?: string | null
}

export interface UpdateCoursePeriodSchedulingDTO {
  total_seats?: number | null
  room?: string | null
  days?: string | null
  gender_restriction?: GenderRestriction
}

// ────────────────────────────────────────────────────────────────────────────
// CLASS LIST (students enrolled in a course period)
// ────────────────────────────────────────────────────────────────────────────

export interface ClassListEntry {
  schedule_id: string
  student_id: string
  student_name: string
  section_name?: string
  grade_level?: string
  start_date: string
  end_date?: string | null
  scheduler_lock: boolean
}

export interface ClassListResponse {
  course_period_id: string
  course_title: string
  teacher_name: string
  total_seats?: number | null
  filled_seats: number
  students: ClassListEntry[]
}
