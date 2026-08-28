export type CoachingNoteType = 'strength' | 'area_for_growth' | 'action_item'
export type CoachingNoteStatus = 'open' | 'in_progress' | 'completed'

export interface InspectionCoachingNote {
  id: string
  evaluation_id: string
  note_type: CoachingNoteType
  content: string
  target_date: string | null
  status: CoachingNoteStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type PrescriptionStatus = 'suggested' | 'assigned' | 'completed' | 'dismissed'

export interface TrainingPrescription {
  id: string
  teacher_profile_id: string
  evaluation_id: string
  criterion_id: string | null
  training_session_id: string | null
  reason: string | null
  status: PrescriptionStatus
  auto_suggested: boolean
  created_by: string | null
  assigned_at: string | null
  completed_at: string | null
  dismissed_at: string | null
  created_at: string
  updated_at: string
}
