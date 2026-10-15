// A teacher's side of inspections: their visits and evaluations, appeals, reports, training
// prescriptions and the inspector community (broadcasts + forum).
import type { ApiClient } from '../client'
import type { InspectionAppeal, InspectionReport, InspectionVisit, TrainingPrescription } from './admin/inspections'

const id = (v: string) => encodeURIComponent(v)

export interface TeacherEvaluation {
  id: string
  visit_id: string
  teacher_profile_id: string
  status: 'draft' | 'submitted' | 'finalized'
  overall_score: number | null
  inspector_notes: string | null
  submitted_at: string | null
  rubric_template: {
    id: string
    name: string
    categories: { id: string; name: string; weight: number; criteria: { id: string; name: string; description: string | null }[] }[]
  } | null
  scores: { id: string; criterion_id: string; score: number; comment: string | null }[]
  evidence: { id: string; criterion_id: string | null; file_name: string; file_type: 'photo' | 'audio'; created_at: string }[]
}

export interface InspectorBroadcast {
  id: string
  title: string
  body: string
  created_at: string
  inspector?: { id: string; first_name: string; last_name: string }
  subject?: { id: string; name: string } | null
}

export interface ForumThread {
  id: string
  subject_id: string | null
  title: string
  created_by: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  subject?: { id: string; name: string } | null
}

export interface ForumThreadDetail extends ForumThread {
  posts: { id: string; body: string; created_at: string; author?: { id: string; first_name: string; last_name: string; role: string } }[]
}

export function teacherInspectionsApi(api: ApiClient) {
  return {
    myVisits: () => api.get<InspectionVisit[]>('/inspection-visits/teacher/mine'),
    /** The teacher's own evaluation for a visit (null until shared). */
    evaluationForVisit: (visitId: string) => api.get<TeacherEvaluation | null>(`/inspection-evaluations/teacher/visit/${id(visitId)}`),
    evidenceUrl: (evidenceId: string) => api.get<{ url: string; file_name: string }>(`/inspection-evaluations/evidence/${id(evidenceId)}/signed-url`),
    createAppeal: (evaluationId: string, reason: string) => api.post<InspectionAppeal>('/inspection-appeals', { evaluation_id: evaluationId, reason }),
    myAppeals: () => api.get<InspectionAppeal[]>('/inspection-appeals/mine'),
    myReports: () => api.get<(InspectionReport & { school: { id: string; name: string } | null })[]>('/inspection-reports/mine'),
    myPrescriptions: () => api.get<TrainingPrescription[]>('/training-prescriptions/mine'),
    completePrescription: (prescriptionId: string) => api.post<TrainingPrescription>(`/training-prescriptions/${id(prescriptionId)}/complete`),
    broadcastsForSchool: (schoolId: string) => api.get<InspectorBroadcast[]>(`/inspector-broadcasts/school/${id(schoolId)}`),
    threadsForSchool: (schoolId: string) => api.get<ForumThread[]>(`/inspection-forum/school/${id(schoolId)}`),
    thread: (threadId: string) => api.get<ForumThreadDetail>(`/inspection-forum/${id(threadId)}`),
    createThread: (body: { title: string; body: string; subject_id?: string | null }) => api.post<ForumThread>('/inspection-forum', body),
    addPost: (threadId: string, body: string) => api.post<{ id: string }>(`/inspection-forum/${id(threadId)}/posts`, { body }),
  }
}
