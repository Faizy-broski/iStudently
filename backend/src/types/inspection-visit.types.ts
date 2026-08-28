export type VisitType = 'announced' | 'unannounced' | 'follow_up'

export type VisitStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'

export interface InspectionVisit {
  id: string
  school_id: string
  inspector_profile_id: string
  visit_type: VisitType
  scheduled_date: string
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  status: VisitStatus
  purpose: string | null
  principal_profile_id: string | null
  created_by: string
  cancellation_reason: string | null
  cancelled_by: string | null
  rescheduled_from_visit_id: string | null
  confirmed_at: string | null
  checked_in_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateVisitDTO {
  school_id: string
  visit_type: VisitType
  scheduled_date: string
  scheduled_start_time?: string
  scheduled_end_time?: string
  purpose?: string
  principal_profile_id?: string
  /** super_admin only — schedule on behalf of another inspector */
  inspector_profile_id?: string
}

export interface VisitTeacherEntry {
  teacher_profile_id: string
  subject_id?: string | null
  notes?: string | null
}

export interface InspectionVisitTeacher {
  id: string
  visit_id: string
  teacher_profile_id: string
  subject_id: string | null
  notes: string | null
  created_at: string
}
