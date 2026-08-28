export type AppealStatus = 'submitted' | 'under_review' | 'escalated' | 'upheld' | 'denied' | 'withdrawn'

export interface InspectionAppeal {
  id: string
  evaluation_id: string
  visit_id: string
  school_id: string
  teacher_profile_id: string
  reason: string
  status: AppealStatus
  assigned_to_profile_id: string | null
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface InspectionAppealComment {
  id: string
  appeal_id: string
  author_profile_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

export type AppealAuditAction = 'created' | 'status_changed' | 'comment_added' | 'escalated' | 'assigned' | 'resolved' | 'withdrawn'

export interface InspectionAppealAuditLog {
  id: string
  appeal_id: string
  actor_profile_id: string | null
  action: AppealAuditAction
  metadata: Record<string, any>
  created_at: string
}
