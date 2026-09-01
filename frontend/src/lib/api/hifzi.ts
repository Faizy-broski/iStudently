import { apiRequest } from './index'

// ============================================================================
// Hifzi module API client. Built on apiRequest<T>() (auth token, X-School-Id
// header, 401/403/2FA handling) — not the older raw-fetch pattern in
// lib/api/library.ts.
//
// Every function threads an optional `campusId` through as a `campus_id`
// query param (and, for writes, also in the body) — matching every other
// plugin-gated API client in this codebase (see e.g. lib/api/discipline.ts).
// This matters here specifically: backend/src/middlewares/hifzi-enabled.middleware.ts
// only auto-resolves campus_id from the JWT profile for campus-FIXED roles
// (teacher/student/parent/staff/librarian) — an admin is not pinned to one
// campus, so every Hifzi call an admin makes must pass campus_id explicitly
// or the gate falls back to the org-wide default row, which 403s if the
// module was actually toggled on for a specific campus. Callers should pass
// `campusContext?.selectedCampus?.id` from useCampus().
// ============================================================================

export interface HifziSettings {
  gradingWeights: Record<string, number>
  gradeBands: { code: string; minScore: number }[]
  srsSimilarityFactor: number
  srsReviewIntensity: number
  srsRecencyFactor: number
  srsMaxIntervalDays: number
  retentionDecayScale: number
  assignmentCriticalThreshold: number
  assignmentNewBlockThreshold: number
  assignmentMaxDailyReviewUnits: number
  assignmentNearReviewCount: number
  absenceAlertMinutes: number
  guardianNotifyAfterSession: boolean
}

export interface HifziCircle {
  id: string
  school_id: string
  name_ar: string
  name_en: string | null
  riwayah_id: string
  section_gender: 'male' | 'female' | 'mixed'
  circle_type: string
  capacity: number | null
  is_active: boolean
  hifzi_circle_teachers?: { id: string; teacher_profile_id: string; role: string; active_to: string | null }[]
  hifzi_circle_schedules?: { id: string; day_of_week: number; start_time: string; end_time: string; location: string | null }[]
}

export interface HifziEnrollment {
  id: string
  circle_id: string
  student_id: string
  status: 'active' | 'paused' | 'withdrawn'
  students?: { id: string; student_number: string; profile?: { first_name: string; last_name: string } }
}

export interface HifziSessionError {
  ayah_id: string
  word_index?: number | null
  error_type: string
  severity: 'major' | 'minor'
}

export interface HifziSession {
  id: string
  student_id: string
  circle_id: string | null
  session_type: string
  start_ayah_id: string
  end_ayah_id: string
  raw_score: number | null
  grade_code: string | null
  overridden: boolean
  created_at: string
  hifzi_session_errors?: HifziSessionError[]
}

export interface HeatmapCell {
  unitId: string
  startAyahId: string
  surahNumber: number
  juzNumber: number
  strength: number
  band: 'mastered' | 'strong' | 'review_due' | 'weak' | 'critical'
}

/** Appends campus_id to a query param bag if present, in the same shape every other Hifzi call uses. */
function withCampus(params: Record<string, string>, campusId?: string | null): URLSearchParams {
  const qs = new URLSearchParams(params)
  if (campusId) qs.set('campus_id', campusId)
  return qs
}

// ── Settings ────────────────────────────────────────────────────────────
export async function getHifziSettings(campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest<HifziSettings>(`/hifzi/settings${qs.toString() ? `?${qs}` : ''}`)
}
export async function updateHifziSettings(updates: Partial<HifziSettings>, campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest<HifziSettings>(`/hifzi/settings${qs.toString() ? `?${qs}` : ''}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, campus_id: campusId ?? undefined }),
  })
}

// ── Circles ─────────────────────────────────────────────────────────────
export async function getCircles(campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest<HifziCircle[]>(`/hifzi/circles${qs.toString() ? `?${qs}` : ''}`)
}
export async function getCircle(id: string, campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest<HifziCircle>(`/hifzi/circles/${id}${qs.toString() ? `?${qs}` : ''}`)
}
export async function createCircle(
  dto: { name_ar: string; name_en?: string; riwayah_id: string; section_gender?: string; circle_type?: string; capacity?: number },
  campusId?: string | null
) {
  return apiRequest<HifziCircle>('/hifzi/circles', { method: 'POST', body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }) })
}
export async function updateCircle(id: string, updates: Partial<{ name_ar: string; name_en: string; is_active: boolean }>, campusId?: string | null) {
  return apiRequest<HifziCircle>(`/hifzi/circles/${id}`, { method: 'PATCH', body: JSON.stringify({ ...updates, campus_id: campusId ?? undefined }) })
}
export async function addCircleTeacher(circleId: string, teacherProfileId: string, role: 'lead' | 'assistant' | 'substitute' = 'lead', campusId?: string | null) {
  return apiRequest(`/hifzi/circles/${circleId}/teachers`, {
    method: 'POST',
    body: JSON.stringify({ teacher_profile_id: teacherProfileId, role, campus_id: campusId ?? undefined }),
  })
}
export async function addCircleSchedule(circleId: string, dto: { day_of_week: number; start_time: string; end_time: string; location?: string }, campusId?: string | null) {
  return apiRequest(`/hifzi/circles/${circleId}/schedules`, { method: 'POST', body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }) })
}

// ── Students / enrollments ─────────────────────────────────────────────
export async function getEnrollments(circleId: string, campusId?: string | null) {
  const qs = withCampus({ circle_id: circleId }, campusId)
  return apiRequest<HifziEnrollment[]>(`/hifzi/students/enrollments?${qs}`)
}
export async function enrollStudent(circleId: string, studentId: string, campusId?: string | null) {
  return apiRequest<HifziEnrollment>('/hifzi/students/enrollments', {
    method: 'POST',
    body: JSON.stringify({ circle_id: circleId, student_id: studentId, campus_id: campusId ?? undefined }),
  })
}
export async function withdrawEnrollment(enrollmentId: string, campusId?: string | null) {
  return apiRequest(`/hifzi/students/enrollments/${enrollmentId}/withdraw`, { method: 'PATCH', body: JSON.stringify({ campus_id: campusId ?? undefined }) })
}
export async function getStudentProfile(studentId: string, campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest(`/hifzi/students/${studentId}/profile${qs.toString() ? `?${qs}` : ''}`)
}

// ── Plans / assignments ─────────────────────────────────────────────────
export interface CreatePlanDTO {
  student_id: string
  circle_id?: string | null
  plan_type?: 'time_based' | 'quantity_based' | 'staged' | 'custom' | 'intensive'
  riwayah_id: string
  daily_new_ayat_target?: number | null
}
export async function createPlan(dto: CreatePlanDTO, campusId?: string | null) {
  return apiRequest('/hifzi/plans', {
    method: 'POST',
    body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }),
  })
}
export async function getPlans(studentId: string, campusId?: string | null) {
  const qs = withCampus({ student_id: studentId }, campusId)
  return apiRequest(`/hifzi/plans?${qs}`)
}
export async function updatePlan(planId: string, dto: Partial<CreatePlanDTO>, campusId?: string | null) {
  return apiRequest(`/hifzi/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }),
  })
}
export async function deletePlan(planId: string, campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest(`/hifzi/plans/${planId}${qs.toString() ? `?${qs}` : ''}`, { method: 'DELETE' })
}
export async function getAssignment(studentId: string, date?: string, campusId?: string | null) {
  const qs = withCampus({ student_id: studentId, ...(date ? { date } : {}) }, campusId)
  return apiRequest(`/hifzi/plans/assignments?${qs}`)
}
export async function generateAssignment(studentId: string, date?: string, campusId?: string | null) {
  return apiRequest('/hifzi/plans/assignments/generate', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, date, campus_id: campusId ?? undefined }),
  })
}

// ── Recitation sessions ─────────────────────────────────────────────────
export interface CreateSessionDTO {
  student_id: string
  circle_id?: string | null
  session_type: 'new' | 'near_review' | 'far_review' | 'consolidation' | 'continuous' | 'tajweed' | 'exam'
  start_ayah_id: string
  end_ayah_id: string
  errors: { ayah_id: string; word_index?: number; error_type: string; severity?: 'major' | 'minor' }[]
  final_score?: number | null
  override_reason?: string | null
  client_uuid: string
}
export async function createSession(dto: CreateSessionDTO, campusId?: string | null) {
  return apiRequest<HifziSession>('/hifzi/sessions', { method: 'POST', body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }) })
}
export async function getSessions(studentId: string, limit = 20, campusId?: string | null) {
  const qs = withCampus({ student_id: studentId, limit: String(limit) }, campusId)
  return apiRequest<HifziSession[]>(`/hifzi/sessions?${qs}`)
}

// ── Attendance ──────────────────────────────────────────────────────────
export async function markAttendance(dto: { circle_id: string; student_id: string; session_date: string; status: string }, campusId?: string | null) {
  return apiRequest('/hifzi/attendance', { method: 'POST', body: JSON.stringify({ ...dto, campus_id: campusId ?? undefined }) })
}
export async function markAttendanceBulk(circleId: string, sessionDate: string, entries: { student_id: string; status: string }[], campusId?: string | null) {
  return apiRequest('/hifzi/attendance', {
    method: 'POST',
    body: JSON.stringify({ circle_id: circleId, session_date: sessionDate, entries, campus_id: campusId ?? undefined }),
  })
}
export async function getAttendance(circleId: string, date: string, campusId?: string | null) {
  const qs = withCampus({ circle_id: circleId, date }, campusId)
  return apiRequest(`/hifzi/attendance?${qs}`)
}

// ── Heatmap / reports ───────────────────────────────────────────────────
export async function getHeatmap(studentId: string, campusId?: string | null) {
  const qs = withCampus({}, campusId)
  return apiRequest<HeatmapCell[]>(`/hifzi/students/${studentId}/heatmap${qs.toString() ? `?${qs}` : ''}`)
}

/** Fetches a short-lived signed URL for the report card PDF (JSON, not a redirect — see the backend controller's comment for why) and opens it in a new tab. */
export async function openReportCard(studentId: string, campusId?: string | null): Promise<{ success: boolean; error?: string }> {
  const qs = withCampus({}, campusId)
  const res = await apiRequest<{ url: string }>(`/hifzi/students/${studentId}/report-card.pdf${qs.toString() ? `?${qs}` : ''}`)
  if (!res.success || !res.data?.url) return { success: false, error: res.error || 'Failed to generate report card' }
  window.open(res.data.url, '_blank', 'noopener,noreferrer')
  return { success: true }
}
