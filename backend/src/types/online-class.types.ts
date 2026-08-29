export type OnlineClassType = 'existing_course' | 'external_open'

export type OnlineClassStatus =
  | 'pending_review'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'completed'
  | 'cancelled'

export type EnrollmentStatus = 'enrolled' | 'withdrawn'

export interface OnlineClass {
  id: string
  school_id: string
  campus_id: string
  teacher_profile_id: string
  class_type: OnlineClassType
  course_period_id: string | null
  title: string
  description: string | null
  student_capacity: number | null
  enrolled_count: number
  scheduled_days: string | null
  session_start_time: string | null
  session_end_time: string | null
  start_date: string | null
  end_date: string | null
  status: OnlineClassStatus
  reviewer_profile_id: string | null
  review_note: string | null
  reviewed_at: string | null
  jitsi_room_id: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateOnlineClassRequestDTO {
  school_id: string
  campus_id: string
  teacher_profile_id: string
  class_type: OnlineClassType
  course_period_id?: string
  title: string
  description?: string
  student_capacity?: number
  scheduled_days?: string
  session_start_time?: string
  session_end_time?: string
  start_date?: string
  end_date?: string
}

export interface OnlineClassEnrollment {
  id: string
  online_class_id: string
  student_profile_id: string
  status: EnrollmentStatus
  enrolled_at: string
  withdrawn_at: string | null
}
