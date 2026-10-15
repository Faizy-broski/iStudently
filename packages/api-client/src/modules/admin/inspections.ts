// Inspections (school admin): analytics, inspector directory + campus assignments, visits,
// rubric builder, training prescriptions, reports + e-signatures and appeals. Same endpoints as
// frontend/src/lib/api/{inspection-*,inspectors,training-prescription}.ts. Responses are
// { data, error } without `success` (the client treats 2xx as success).
import type { ApiClient } from '../../client'

export interface InspectionCategoryScore {
  category: string
  avgScore: number
}

export interface InspectionHeatmapRow {
  label: string
  scoresByCategory: Record<string, number>
}

export interface InspectionDashboardStats {
  visitsScheduled: number
  visitsCompleted: number
  avgOverallScore: number | null
  avgScoreByCategory: InspectionCategoryScore[]
  openAppealsCount: number
  heatmap: InspectionHeatmapRow[]
}

export interface InspectorProfile {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  school_id: string
}

export interface InspectorAssignment {
  id: string
  inspector_profile_id: string
  school_id: string
  subject_id: string | null
  grade_level_id: string | null
  is_active: boolean
  assigned_at: string
  school?: { id: string; name: string; parent_school_id: string | null }
  subject?: { id: string; name: string } | null
  grade_level?: { id: string; name: string } | null
}

export type VisitType = string
export type VisitStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled'

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
  cancellation_reason: string | null
  created_at: string
  school?: { id: string; name: string }
  inspector?: { id: string; first_name: string; last_name: string }
}

export interface RubricCriterion {
  id: string
  category_id: string
  name: string
  description: string | null
  sort_order: number
}

export interface RubricCategory {
  id: string
  template_id: string
  name: string
  weight: number
  sort_order: number
  criteria: RubricCriterion[]
}

export interface RubricTemplate {
  id: string
  name: string
  description: string | null
  is_active: boolean
  categories: RubricCategory[]
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
  created_at: string
  criterion?: { id: string; name: string } | null
  training_session?: { id: string; title: string; start_date: string; status?: string } | null
  teacher?: { id: string; first_name: string; last_name: string }
}

export interface TrainingSessionOption {
  id: string
  title: string
  start_date: string
  end_date: string
  status: string
}

export type ReportStatus = 'pending_signatures' | 'fully_signed'
export type SignerRole = 'teacher' | 'principal' | 'inspector'

export interface InspectionReport {
  id: string
  evaluation_id: string
  visit_id: string
  school_id: string
  teacher_profile_id: string
  inspector_profile_id: string
  status: ReportStatus
  pdf_file_url: string | null
  generated_at: string | null
  fully_signed_at: string | null
  created_at: string
}

type Person = { id: string; first_name: string; last_name: string }

export type InspectionReportRow = InspectionReport & { teacher: Person; inspector: Person }

export interface InspectionReportDetail extends InspectionReport {
  signatures: { id: string; signer_role: SignerRole; signer_profile_id: string; typed_full_name: string; attested_at: string }[]
  teacher: Person | null
  inspector: Person | null
  school: { id: string; name: string } | null
}

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
  teacher?: Person
  school?: { id: string; name: string }
}

export interface InspectionAppealDetail extends Omit<InspectionAppeal, 'teacher'> {
  comments: { id: string; appeal_id: string; author_profile_id: string; body: string; is_internal_note: boolean; created_at: string }[]
  teacher: Person | null
  assigned_to: Person | null
}

export interface EscalationTarget {
  id: string
  first_name: string
  last_name: string
  role: string
}

export function adminInspectionsApi(api: ApiClient) {
  return {
    dashboard: (schoolId: string) => api.get<InspectionDashboardStats>(`/inspection-analytics/school/${schoolId}`),

    inspectors: () => api.get<InspectorProfile[]>('/inspectors'),
    createInspector: (body: { first_name: string; last_name: string; email: string; password?: string; phone?: string; home_school_id: string }) => api.post<InspectorProfile>('/inspectors', body),
    updateInspector: (id: string, body: { first_name?: string; last_name?: string; phone?: string | null }) => api.patch<InspectorProfile>(`/inspectors/${id}`, body),
    deactivateInspector: (id: string) => api.post<InspectorProfile>(`/inspectors/${id}/deactivate`),
    reactivateInspector: (id: string) => api.post<InspectorProfile>(`/inspectors/${id}/reactivate`),
    deleteInspector: (id: string) => api.del<{ id: string }>(`/inspectors/${id}`),
    inspectorAssignments: (inspectorId: string) => api.get<InspectorAssignment[]>(`/inspectors/${inspectorId}/assignments`),
    assignCampus: (body: { inspector_profile_id: string; school_id: string; subject_id?: string | null; grade_level_id?: string | null }) => api.post<InspectorAssignment>('/inspectors/assignments', body),
    revokeCampus: (assignmentId: string) => api.post<InspectorAssignment>(`/inspectors/assignments/${assignmentId}/revoke`),

    visitsForSchool: (schoolId: string) => api.get<InspectionVisit[]>(`/inspection-visits/school/${schoolId}`),
    confirmVisit: (id: string) => api.post<InspectionVisit>(`/inspection-visits/${id}/confirm`),
    cancelVisit: (id: string, reason?: string) => api.post<InspectionVisit>(`/inspection-visits/${id}/cancel`, { reason }),

    activeRubric: () => api.get<RubricTemplate | null>('/inspection-rubrics/active'),
    ensureDefaultRubric: () => api.post<RubricTemplate>('/inspection-rubrics/ensure-default'),
    createRubricCategory: (templateId: string, body: { name: string; weight?: number; sort_order?: number }) => api.post<RubricCategory>(`/inspection-rubrics/templates/${templateId}/categories`, body),
    updateRubricCategory: (id: string, body: { name?: string; weight?: number; sort_order?: number }) => api.put<RubricCategory>(`/inspection-rubrics/categories/${id}`, body),
    deleteRubricCategory: (id: string) => api.del<null>(`/inspection-rubrics/categories/${id}`),
    createCriterion: (categoryId: string, body: { name: string; description?: string; sort_order?: number }) => api.post<RubricCriterion>(`/inspection-rubrics/categories/${categoryId}/criteria`, body),
    updateCriterion: (id: string, body: { name?: string; description?: string; sort_order?: number }) => api.put<RubricCriterion>(`/inspection-rubrics/criteria/${id}`, body),
    deleteCriterion: (id: string) => api.del<null>(`/inspection-rubrics/criteria/${id}`),

    prescriptionsForSchool: (schoolId: string) => api.get<TrainingPrescription[]>(`/training-prescriptions/school/${schoolId}`),
    trainingSessions: (schoolId: string) => api.get<TrainingSessionOption[]>(`/training-prescriptions/sessions/school/${schoolId}`),
    assignPrescription: (id: string, trainingSessionId?: string | null) => api.post<TrainingPrescription>(`/training-prescriptions/${id}/assign`, { training_session_id: trainingSessionId }),
    dismissPrescription: (id: string) => api.post<TrainingPrescription>(`/training-prescriptions/${id}/dismiss`),

    reportsForSchool: (schoolId: string) => api.get<InspectionReportRow[]>(`/inspection-reports/school/${schoolId}`),
    report: (id: string) => api.get<InspectionReportDetail>(`/inspection-reports/${id}`),
    reportPdfUrl: (id: string) => api.get<{ url: string }>(`/inspection-reports/${id}/pdf-url`),
    signReport: (reportId: string, password: string, typedFullName: string) =>
      api.post<{ report: unknown; signature: unknown }>(`/inspection-signatures/${reportId}/sign`, { password, typed_full_name: typedFullName }),

    appealsForSchool: (schoolId: string) => api.get<InspectionAppeal[]>(`/inspection-appeals/school/${schoolId}`),
    appealsAssignedToMe: () => api.get<InspectionAppeal[]>('/inspection-appeals/assigned-to-me'),
    appeal: (id: string) => api.get<InspectionAppealDetail>(`/inspection-appeals/${id}`),
    escalationTargets: (schoolId: string) => api.get<EscalationTarget[]>(`/inspection-appeals/school/${schoolId}/escalation-targets`),
    updateAppealStatus: (id: string, status: AppealStatus, resolutionNote?: string) => api.post<InspectionAppeal>(`/inspection-appeals/${id}/status`, { status, resolution_note: resolutionNote }),
    escalateAppeal: (id: string, targetProfileId: string, note?: string) => api.post<InspectionAppeal>(`/inspection-appeals/${id}/escalate`, { target_profile_id: targetProfileId, note }),
    withdrawAppeal: (id: string) => api.post<InspectionAppeal>(`/inspection-appeals/${id}/withdraw`),
    addAppealComment: (id: string, body: string, isInternalNote = false) => api.post(`/inspection-appeals/${id}/comments`, { body, is_internal_note: isInternalNote }),
  }
}
