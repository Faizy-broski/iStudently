// Training sessions (school admin): sessions, registrations (attendance, payment, score,
// waitlist), certificates and CSV export. Same endpoints as frontend/src/lib/api/training.ts;
// router: training.routes.ts. Certificate templates come from certificate-template.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type TrainingSessionStatus = 'open' | 'full' | 'closed'
export type TrainingAudience = 'internal' | 'external' | 'both'
export type TrainingPaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'expired'
export type TrainingSkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type TrainingDeliveryMode = 'in_person' | 'online' | 'hybrid'

export interface TrainingCertificateSettings {
  enable_auto_issuance: boolean
  certificate_template_id: string | null
  min_attendance_rate: number
  min_passing_grade: number
  require_payment_cleared: boolean
  authorized_signatory: string
  digital_signature_url?: string | null
  enable_verification_qr: boolean
  distribution_methods: { dashboard: boolean; email: boolean }
}

export interface TrainingSession {
  id: string
  title: string
  description: string | null
  category?: string | null
  skill_level?: TrainingSkillLevel | null
  start_date: string
  end_date: string
  weekly_days?: string[] | null
  daily_time_range?: string | null
  daily_times?: Record<string, string> | null
  total_duration_hours?: number | null
  delivery_mode?: TrainingDeliveryMode | null
  location_venue_link?: string | null
  instructor_id?: string | null
  instructor_name?: string | null
  total_seats: number
  registered_seats: number
  available_seats: number
  course_fee: number
  registration_deadline?: string | null
  status: TrainingSessionStatus
  target_audience: TrainingAudience
  cover_image_url?: string | null
  syllabus_pdf_url?: string | null
  certificate_settings?: TrainingCertificateSettings | null
  public_token: string
  created_at: string
  registration_counts?: { confirmed_paid: number; confirmed_unpaid: number; waiting_list: number; cancelled: number }
}

export type TrainingSessionInput = Partial<Omit<TrainingSession, 'id' | 'registered_seats' | 'available_seats' | 'public_token' | 'created_at' | 'registration_counts'>>

export interface TrainingRegistration {
  id: string
  session_id: string
  student_type: 'internal' | 'external'
  student_id: string | null
  ext_student_name: string | null
  ext_parent_phone: string | null
  payment_status: TrainingPaymentStatus
  registration_status: 'confirmed' | 'waiting_list' | 'cancelled'
  qr_auth_token: string
  attendance_status: boolean
  final_score: number | null
  created_at: string
  display_name?: string
}

export interface TrainingCertificate {
  id: string
  recipient_name: string
  verification_code: string
  issued_at: string
  delivery_email_sent_at: string | null
  delivery_email_error: string | null
  download_url?: string | null
}

export interface CertificateTemplateSummary {
  id: string
  name: string
}

export function adminTrainingApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    sessions: (campusId?: string) => api.get<TrainingSession[]>(`/training/sessions${qs({ campus_id: campusId })}`),
    session: (sessionId: string, campusId?: string) => api.get<TrainingSession>(`/training/sessions/${id(sessionId)}${qs({ campus_id: campusId })}`),
    create: (body: TrainingSessionInput, campusId?: string) => api.post<TrainingSession>('/training/sessions', campusId ? { ...body, campus_id: campusId } : body),
    update: (sessionId: string, body: TrainingSessionInput, campusId?: string) => api.put<TrainingSession>(`/training/sessions/${id(sessionId)}`, campusId ? { ...body, campus_id: campusId } : body),
    remove: (sessionId: string, campusId?: string) => api.del<void>(`/training/sessions/${id(sessionId)}${qs({ campus_id: campusId })}`),

    registrations: (sessionId: string, p: { status?: string; paid?: boolean; campus_id?: string } = {}) =>
      api.get<TrainingRegistration[]>(`/training/sessions/${id(sessionId)}/registrations${qs({ campus_id: p.campus_id, status: p.status, paid: p.paid === undefined ? undefined : String(p.paid) })}`),
    toggleAttendance: (regId: string, sessionId: string, campusId?: string) => api.put<TrainingRegistration>(`/training/registrations/${id(regId)}/attendance`, { session_id: sessionId, campus_id: campusId }),
    setPayment: (regId: string, sessionId: string, status: TrainingPaymentStatus, campusId?: string) =>
      api.put<TrainingRegistration>(`/training/registrations/${id(regId)}/payment`, { session_id: sessionId, payment_status: status, campus_id: campusId }),
    cancel: (regId: string, sessionId: string, campusId?: string) => api.put<void>(`/training/registrations/${id(regId)}/cancel`, { session_id: sessionId, campus_id: campusId }),
    promote: (regId: string, sessionId: string, campusId?: string) => api.put<void>(`/training/registrations/${id(regId)}/promote`, { session_id: sessionId, campus_id: campusId }),
    hardDelete: (regId: string, sessionId: string, campusId?: string) => api.del<void>(`/training/registrations/${id(regId)}`, { body: { session_id: sessionId, campus_id: campusId } }),
    setScore: (regId: string, sessionId: string, score: number | null, campusId?: string) =>
      api.put<TrainingRegistration>(`/training/registrations/${id(regId)}/score`, { session_id: sessionId, final_score: score, campus_id: campusId }),
    issueCertificate: (regId: string, sessionId: string, templateId: string, campusId?: string) =>
      api.post<TrainingCertificate>(`/training/registrations/${id(regId)}/certificate/issue`, { session_id: sessionId, template_id: templateId, campus_id: campusId }),
    bulkIssue: (sessionId: string, campusId?: string) =>
      api.post<{ issued: number; skipped: number; errors: { registrationId: string; error: string }[] }>(`/training/sessions/${id(sessionId)}/certificates/issue-bulk`, { campus_id: campusId }),
    certificates: (regId: string, sessionId: string, campusId?: string) => api.get<TrainingCertificate[]>(`/training/registrations/${id(regId)}/certificates${qs({ session_id: sessionId, campus_id: campusId })}`),
    /** Path for shareApiFile (CSV of registrations). */
    exportPath: (sessionId: string, campusId?: string) => `/training/sessions/${id(sessionId)}/export${qs({ campus_id: campusId })}`,
    /** Certificate templates for training (the body is { templates }, next to success). */
    certificateTemplates: async () => {
      const r = await api.get<{ templates?: CertificateTemplateSummary[] }>(`/certificate-templates${qs({ recipient_type: 'training' })}`)
      const body = r as unknown as { templates?: CertificateTemplateSummary[]; data?: { templates?: CertificateTemplateSummary[] } }
      return { ...r, data: body.data?.templates ?? body.templates ?? [] }
    },
  }
}
