// Student, parent and teacher apps: what the web's DashboardLayout reads to build their sidebar.
// (backend/src/routes/school-settings.routes.ts, user-profiles.routes.ts, embedded-resources.routes.ts,
// setup-assistant.routes.ts, portal.routes.ts, attendance.routes.ts)
import type { ProfilePermission } from '@studently/shared-types'

import type { ApiClient } from '../client'
import { qs } from '../query'
import type { AttendanceSummaryRow } from './admin/attendance'
import type { StudentElement } from './admin/billing-elements'
import type { PortalNote, PortalPoll } from './admin/portal'
import type { EmbeddedResource, PhysicsLab, PhysicsLabSubmission } from './admin/resources'
import type { SchoolSettings } from './admin/school'

/** A note as non-admins see it (active and visible to their role). */
export type PortalFeedNote = PortalNote & { created_at: string }
export type PortalFeedPoll = PortalPoll & { created_at: string; has_voted?: boolean }

export interface PollResponseInput {
  question_id: string
  answer_text?: string
  selected_options?: string[]
  rating_value?: number
}

/** An embedded resource as /for-user returns it, with display names. */
export type UserEmbeddedResource = EmbeddedResource & { created_at?: string; creator_name?: string | null; published_grade_names?: string[] }

export function portalApi(api: ApiClient) {
  return {
    /** Portal announcements for this user's role (web: /<role>/portal/notes). */
    notes: async (campusId?: string | null) => {
      const r = await api.get<{ notes: PortalFeedNote[] }>(`/portal/notes${qs({ campus_id: campusId ?? undefined, limit: 100 })}`)
      return { ...r, data: (r as unknown as { notes?: PortalFeedNote[] }).notes ?? [] }
    },
    /** Portal polls for this user's role, with has_voted. */
    polls: async (campusId?: string | null) => {
      const r = await api.get<{ polls: PortalFeedPoll[] }>(`/portal/polls${qs({ campus_id: campusId ?? undefined, limit: 100 })}`)
      return { ...r, data: (r as unknown as { polls?: PortalFeedPoll[] }).polls ?? [] }
    },
    respondPoll: (pollId: string, responses: PollResponseInput[]) =>
      api.post<void>(`/portal/polls/${encodeURIComponent(pollId)}/respond`, { responses: ([] as PollResponseInput[]).concat(responses) }),
    /** Settings of the user's own campus (plugins, module deny-list, menu order, date format). */
    settings: (campusId?: string | null) => api.get<SchoolSettings>(`/school-settings${qs({ campus_id: campusId ?? undefined })}`),
    /** null = no user profile assigned (everything allowed). */
    myPermissions: () => api.get<ProfilePermission[] | null>('/user-profiles/my-permissions'),
    /** Embedded resources published to this user (web: sidebar "Premium Resources"). */
    /** Setup Assistant checklist progress of the signed-in user. */
    setupProgress: () => api.get<{ completed_steps: string[]; dismissed: boolean }>('/setup-assistant/progress'),
    completeSetupStep: (stepId: string) => api.post<void>('/setup-assistant/complete-step', { step_id: stepId }),
    dismissSetupAssistant: () => api.post<void>('/setup-assistant/dismiss', {}),
    /** The signed-in student's daily attendance summary for a date range (web: Absence Summary). */
    studentAttendanceSummary: (startDate: string, endDate: string) =>
      api.get<AttendanceSummaryRow[]>(`/attendance/student/summary${qs({ start_date: startDate, end_date: endDate })}`),
    /** The signed-in parent's children, one row each (web: /parent/attendance, Absence Summary). */
    parentAttendanceSummary: (startDate: string, endDate: string) =>
      api.get<AttendanceSummaryRow[]>(`/attendance/parent/summary${qs({ start_date: startDate, end_date: endDate })}`),
    /** The signed-in student's own billing element charges (web: Additional charges). */
    myBillingElements: () => api.get<StudentElement[]>('/billing-elements/my'),
    /** Physics labs assigned to the student (web: /student/resources/physics-labs). */
    physicsLabs: (gradeId?: string) => api.get<PhysicsLab[]>(`/physics-labs/for-student${qs({ grade_id: gradeId })}`),
    submitPhysicsFindings: (body: { lab_id: string; findings_text: string; time_spent_s?: number }) => api.post<PhysicsLabSubmission>('/physics-labs/submissions', body),
    embeddedForUser: (gradeId?: string) => api.get<UserEmbeddedResource[]>(`/embedded-resources/for-user${qs({ grade_id: gradeId })}`),
  }
}
