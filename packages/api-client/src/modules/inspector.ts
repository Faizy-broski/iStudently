// The inspector role: assigned campuses, visits (schedule, check in, complete, cancel, reschedule,
// teachers), observation (rubric scores + photo / audio evidence + grade sample), coaching notes and
// training prescriptions, reports (create, PDF upload), broadcasts / forum threads to campuses,
// teacher portfolios and the Hifzi compliance roll-up.
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { UploadFile } from '../types'
import type { HifziComplianceStats } from './admin/hifzi'
import type {
  InspectionDashboardStats,
  InspectionReport,
  InspectionVisit,
  TrainingPrescription,
  TrainingSessionOption,
} from './admin/inspections'
import type { ForumThread, InspectorBroadcast, TeacherEvaluation } from './teacher-inspections'

const id = (v: string) => encodeURIComponent(v)

export type InspectorVisitType = 'announced' | 'unannounced' | 'follow_up'

export interface InspectorVisitDetail extends InspectionVisit {
  teachers: {
    id: string
    teacher_profile_id: string
    subject_id: string | null
    teacher?: { id: string; first_name: string; last_name: string }
    subject?: { id: string; name: string } | null
  }[]
}

export interface InspectorEvaluationListItem {
  id: string
  status: string
  overall_score: number | null
  teacher: { id: string; first_name: string; last_name: string }
}

export type CoachingNoteType = 'strength' | 'area_for_growth' | 'action_item'

export interface CoachingNote {
  id: string
  evaluation_id: string
  note_type: CoachingNoteType
  content: string
  target_date: string | null
  status: 'open' | 'in_progress' | 'completed'
  created_at: string
}

export interface TeacherPortfolio {
  teacher: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; profile_photo_url: string | null; school_id: string; school?: { id: string; name: string } }
  qualifications: {
    skills: { id: string; title: string; description?: string | null }[]
    education: { id: string; qualification: string; institute?: string | null; completed_on?: string | null }[]
    certifications: { id: string; title: string; institute?: string | null; granted_on?: string | null; valid_through?: string | null }[]
    languages: { id: string; title: string }[]
  }
  historical_reports: unknown[]
}

export function inspectorApi(api: ApiClient) {
  return {
    mySchools: () => api.get<{ id: string; name: string }[]>('/inspectors/me/schools'),
    dashboard: () => api.get<InspectionDashboardStats>('/inspection-analytics/inspector'),
    hifziCompliance: (academicYearId: string) => api.get<HifziComplianceStats>(`/hifzi/compliance/dashboard${qs({ academic_year_id: academicYearId })}`),

    myVisits: () => api.get<InspectionVisit[]>('/inspection-visits/mine'),
    createVisit: (body: { school_id: string; visit_type: InspectorVisitType; scheduled_date: string; scheduled_start_time?: string; scheduled_end_time?: string; purpose?: string }) =>
      api.post<InspectionVisit>('/inspection-visits', body),
    visit: (visitId: string) => api.get<InspectorVisitDetail>(`/inspection-visits/${id(visitId)}`),
    checkIn: (visitId: string) => api.post<InspectionVisit>(`/inspection-visits/${id(visitId)}/check-in`),
    complete: (visitId: string) => api.post<InspectionVisit>(`/inspection-visits/${id(visitId)}/complete`),
    cancel: (visitId: string, reason?: string) => api.post<InspectionVisit>(`/inspection-visits/${id(visitId)}/cancel`, { reason }),
    /** Creates a new visit and marks this one rescheduled; returns the new visit. */
    reschedule: (visitId: string, body: { scheduled_date: string; scheduled_start_time?: string; scheduled_end_time?: string }) =>
      api.post<InspectionVisit>(`/inspection-visits/${id(visitId)}/reschedule`, body),
    setTeachers: (visitId: string, teachers: { teacher_profile_id: string; subject_id?: string | null }[]) =>
      api.put<unknown>(`/inspection-visits/${id(visitId)}/teachers`, { teachers }),

    teachersForSchool: (schoolId: string) => api.get<{ id: string; first_name: string; last_name: string; email: string | null }[]>(`/inspector-teachers/school/${id(schoolId)}`),
    subjectsForSchool: (schoolId: string) => api.get<{ id: string; name: string; code: string }[]>(`/inspector-teachers/school/${id(schoolId)}/subjects`),
    portfolio: (teacherProfileId: string) => api.get<TeacherPortfolio>(`/inspector-teachers/${id(teacherProfileId)}/portfolio`),

    draftEvaluation: (visitId: string, teacherProfileId: string) =>
      api.post<TeacherEvaluation>('/inspection-evaluations', { visit_id: visitId, teacher_profile_id: teacherProfileId }),
    evaluation: (evaluationId: string) => api.get<TeacherEvaluation>(`/inspection-evaluations/${id(evaluationId)}`),
    evaluationsForVisit: (visitId: string) => api.get<InspectorEvaluationListItem[]>(`/inspection-evaluations/visit/${id(visitId)}`),
    saveScore: (evaluationId: string, criterionId: string, score: number, comment?: string) =>
      api.post<TeacherEvaluation['scores'][number]>(`/inspection-evaluations/${id(evaluationId)}/scores`, { criterion_id: criterionId, score, comment }),
    submitEvaluation: (evaluationId: string) => api.post<TeacherEvaluation>(`/inspection-evaluations/${id(evaluationId)}/submit`),
    /** Photo (jpeg/png) or voice note (m4a/wav/webm/ogg), optionally tied to a rubric criterion. */
    uploadEvidence: (evaluationId: string, file: UploadFile, criterionId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      if (criterionId) form.append('criterion_id', criterionId)
      return api.post<TeacherEvaluation['evidence'][number]>(`/inspection-media/${id(evaluationId)}/upload`, form, { timeout: 120_000 })
    },
    removeEvidence: (evidenceId: string) => api.del<null>(`/inspection-evaluations/evidence/${id(evidenceId)}`),
    coursePeriodsForTeacher: (teacherProfileId: string, schoolId: string) =>
      api.get<{ id: string; title: string | null; short_name: string | null; section_name: string | null }[]>(`/inspection-evaluations/course-periods/teacher/${id(teacherProfileId)}${qs({ school_id: schoolId })}`),
    gradeSample: (coursePeriodId: string, sampleSize = 5) =>
      api.get<{ student_id: string; student_name: string; assignment_title: string | null; points: number | null; letter_grade: string | null; comment: string | null }[]>(
        `/inspection-evaluations/grade-sample/${id(coursePeriodId)}${qs({ sample_size: String(sampleSize) })}`,
      ),

    notes: (evaluationId: string) => api.get<CoachingNote[]>(`/inspection-coaching/evaluation/${id(evaluationId)}`),
    addNote: (evaluationId: string, body: { note_type: CoachingNoteType; content: string; target_date?: string }) => api.post<CoachingNote>(`/inspection-coaching/evaluation/${id(evaluationId)}`, body),
    deleteNote: (noteId: string) => api.del<null>(`/inspection-coaching/${id(noteId)}`),
    prescriptions: (evaluationId: string) => api.get<TrainingPrescription[]>(`/training-prescriptions/evaluation/${id(evaluationId)}`),
    createPrescription: (evaluationId: string, body: { reason?: string; training_session_id?: string; criterion_id?: string }) =>
      api.post<TrainingPrescription>(`/training-prescriptions/evaluation/${id(evaluationId)}`, body),
    assignPrescription: (prescriptionId: string, trainingSessionId?: string | null) =>
      api.post<TrainingPrescription>(`/training-prescriptions/${id(prescriptionId)}/assign`, { training_session_id: trainingSessionId }),
    dismissPrescription: (prescriptionId: string) => api.post<TrainingPrescription>(`/training-prescriptions/${id(prescriptionId)}/dismiss`),
    trainingSessions: (schoolId: string) => api.get<TrainingSessionOption[]>(`/training-prescriptions/sessions/school/${id(schoolId)}`),

    myReports: () => api.get<(InspectionReport & { school: { id: string; name: string } | null; teacher: { id: string; first_name: string; last_name: string } | null })[]>('/inspection-reports/inspector/mine'),
    reportForEvaluation: (evaluationId: string) => api.get<InspectionReport | null>(`/inspection-reports/evaluation/${id(evaluationId)}`),
    createReport: (evaluationId: string) => api.post<InspectionReport>('/inspection-reports', { evaluation_id: evaluationId }),
    /** Upload the report PDF rendered on the device. */
    uploadReportPdf: (reportId: string, file: UploadFile) => {
      const form = new FormData()
      form.append('file', file as Blob)
      return api.post<InspectionReport>(`/inspection-media/reports/${id(reportId)}/upload`, form, { timeout: 120_000 })
    },

    createBroadcast: (body: { title: string; body: string; target_school_ids: string[]; subject_id?: string | null }) => api.post<InspectorBroadcast>('/inspector-broadcasts', body),
    createThread: (body: { title: string; body: string; target_school_ids: string[]; subject_id?: string | null }) => api.post<ForumThread>('/inspection-forum', body),
  }
}
