export interface RubricCriterion {
  id: string
  category_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface RubricCategory {
  id: string
  template_id: string
  name: string
  weight: number
  sort_order: number
  created_at: string
  updated_at: string
  criteria?: RubricCriterion[]
}

export interface RubricTemplate {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  categories?: RubricCategory[]
}

export type EvaluationStatus = 'draft' | 'submitted' | 'finalized'

export interface InspectionEvaluation {
  id: string
  visit_id: string
  teacher_profile_id: string
  rubric_template_id: string
  status: EvaluationStatus
  overall_score: number | null
  inspector_notes: string | null
  created_at: string
  updated_at: string
  submitted_at: string | null
  finalized_at: string | null
}

export interface EvaluationScore {
  id: string
  evaluation_id: string
  criterion_id: string
  score: number
  comment: string | null
  created_at: string
  updated_at: string
}

export type EvidenceFileType = 'photo' | 'audio'

export interface InspectionEvidence {
  id: string
  evaluation_id: string
  criterion_id: string | null
  file_url: string
  file_name: string
  file_type: EvidenceFileType
  file_size: number | null
  uploaded_by: string
  created_at: string
}
