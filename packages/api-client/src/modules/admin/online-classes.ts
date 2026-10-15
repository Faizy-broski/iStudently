// Online classes (backend/src/routes/online-class.routes.ts).
// Plugin: online_classes. Admin routes: review-queue, active-sessions, approve, reject, end-session.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type OnlineClassType = 'existing_course' | 'external_open'

/** One online class request or session (web: lib/api/online-classes OnlineClass). */
export interface OnlineClassRequest {
  id: string
  school_id?: string
  campus_id?: string
  teacher_profile_id?: string
  class_type: OnlineClassType
  course_period_id?: string | null
  title: string
  description?: string | null
  student_capacity?: number | null
  enrolled_count?: number
  scheduled_days?: string | null
  session_start_time?: string | null
  session_end_time?: string | null
  start_date?: string | null
  end_date?: string | null
  status: string
  review_note?: string | null
  reviewed_at?: string | null
  started_at?: string | null
  ended_at?: string | null
  created_at: string
}

export type OnlineClassSession = OnlineClassRequest

export function adminOnlineClassesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    reviewQueue: (campusId?: string | null) =>
      api.get<OnlineClassRequest[]>(`/online-classes/review-queue${qs({ campus_id: campusId ?? undefined })}`),
    activeSessions: (campusId?: string | null) =>
      api.get<OnlineClassSession[]>(`/online-classes/active-sessions${qs({ campus_id: campusId ?? undefined })}`),
    /** Optional note is saved as the review note. */
    approve: (classId: string, note?: string) => api.post<OnlineClassRequest>(`/online-classes/${id(classId)}/approve`, { note }),
    reject: (classId: string, note?: string) => api.post<OnlineClassRequest>(`/online-classes/${id(classId)}/reject`, { note }),
    /** Student: open courses with seats_remaining (web: browse open courses). */
    openClasses: () => api.get<(OnlineClassRequest & { seats_remaining: number; jitsi_room_id?: string | null })[]>('/online-classes/open'),
    enroll: (classId: string) => api.post<{ id: string }>(`/online-classes/${id(classId)}/enroll`),
    /** Student: classes they are enrolled in. */
    enrolled: () => api.get<(OnlineClassRequest & { jitsi_room_id?: string | null })[]>('/online-classes/enrolled'),
    withdraw: (classId: string) => api.post<null>(`/online-classes/${id(classId)}/withdraw`),
    /** Teacher: request an external open class (goes to admin review). */
    submitRequest: (body: {
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
      campus_id?: string | null
    }) => api.post<OnlineClassRequest>('/online-classes', body),
    /** Teacher: their own requests and sessions. */
    mine: () => api.get<OnlineClassRequest[]>('/online-classes/mine'),
    cancel: (classId: string) => api.post<null>(`/online-classes/${id(classId)}/cancel`),
    /** Teacher: start (or rejoin) an approved external class; returns the Jitsi room. */
    startSession: (classId: string) => api.post<{ id: string; room_name: string; jitsi_domain?: string | null }>(`/online-classes/${id(classId)}/start-session`),
    /** Teacher: start (or rejoin) a live session for one of their course periods, no approval. */
    startCourseSession: (coursePeriodId: string) => api.post<{ id: string; room_name: string; jitsi_domain?: string | null }>(`/online-classes/course-periods/${id(coursePeriodId)}/start`),
    endSession: (classId: string) => api.post<OnlineClassRequest>(`/online-classes/${id(classId)}/end-session`),
  }
}
