// Al-Fina' (school social wall plugin): posts, media + face tagging, albums, stories, groups,
// events, threads, notifications, audit, reports. Same endpoints as frontend/src/lib/api/fina-*.ts;
// routers: backend/src/routes/fina/*.routes.ts. Responses are { data, error } (no `success`
// field; the client fills it in). Like the web's withCampusParam, every call carries the selected
// campus as campus_id; the backend only reads it for admin / media_officer callers.
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { UploadFile } from '../types'

export type FinaPostType = 'activity' | 'announcement' | 'achievement' | 'congratulation' | 'urgent' | 'resource' | 'poll' | 'reminder'
export type FinaPostState = 'draft' | 'pending_auto' | 'pending_review' | 'pending_approval' | 'published' | 'blocked' | 'rejected' | 'restricted' | 'archived'
export type FinaAudienceType = 'school' | 'classes' | 'students'
export type FinaReactionKind = 'thumbs_up' | 'clap' | 'bright_idea' | 'star' | 'thinker' | 'artistic' | 'teamwork' | 'bookworm'
export type FinaMediaVariant = 'thumb' | 'sm' | 'md' | 'lg' | 'blurred'

interface PersonName {
  first_name: string | null
  last_name: string | null
}

export interface FinaPost {
  id: string
  school_id: string
  author_id: string
  type: FinaPostType
  title: string | null
  body: string | null
  audience_type: FinaAudienceType
  audience_ref: Record<string, unknown>
  type_data: Record<string, unknown>
  state: FinaPostState
  is_pinned: boolean
  is_emergency: boolean
  needs_post_hoc_review: boolean
  comments_enabled: boolean
  published_at: string | null
  created_at: string
  rejected_reason: string | null
  blocked_reason: string | null
  author?: PersonName | null
  media: { id: string; kind: 'image' | 'video' }[]
  reactionsCount: number
  myReaction: string | null
  myReactionIsSuper: boolean
  commentsCount: number
  isHonorRoll: boolean
}

export interface FinaPostInput {
  type: FinaPostType
  title?: string
  body?: string
  audience_type?: FinaAudienceType
  audience_ref?: Record<string, unknown>
  type_data?: Record<string, unknown>
  is_emergency?: boolean
  comments_enabled?: boolean
  media_ids?: string[]
}

export interface FinaComment {
  id: string
  post_id: string
  author_id: string
  body: string
  state: 'pending' | 'approved' | 'rejected'
  created_at: string
  author?: PersonName & { role: string }
}

export interface FinaComposerOptions {
  gradeLevels: { id: string; name: string }[]
  sections: { id: string; name: string; gradeLevelId: string | null }[]
  students: { id: string; sectionId: string | null; name: string }[]
}

export interface FinaClassGoal {
  id: string
  school_id: string
  section_id: string | null
  grade_level_id: string | null
  reaction_kind: FinaReactionKind
  target_count: number
  week_start: string
  week_end: string
  currentCount: number
}

export interface FinaMedia {
  id: string
  school_id: string
  uploader_id: string
  kind: 'image' | 'video'
  width: number | null
  height: number | null
  duration_sec: number | null
  bytes: number | null
  processing_state: 'pending_tagging' | 'pending_variants' | 'ready' | 'failed'
  no_identifiable_students: boolean
  min_consent_level: number | null
  has_unconsented: boolean
  uploaded_at: string
  confirmed_at: string | null
  confirmed_by: string | null
}

export interface FinaFaceTag {
  id: string
  media_id: string
  student_id: string | null
  bbox: { x: number; y: number; w: number; h: number }
  source: 'manual' | 'corrected'
  student?: { id: string; profile: PersonName } | null
}

export interface FinaCandidateStudent {
  id: string
  profile: PersonName | null
  section: { name: string } | null
}

export interface FinaAlbum {
  id: string
  school_id: string
  title: string
  activity_date: string | null
  section_id: string | null
}

export interface FinaStory {
  id: string
  media_id: string
  author_id: string
  created_at: string
  expires_at: string
  author?: PersonName | null
}

export interface FinaGroup {
  id: string
  school_id: string
  name: string
  type: string
  section_id: string | null
  moderator_id: string
  isMember: boolean
}

export interface FinaEvent {
  id: string
  school_id: string
  title: string
  body: string | null
  starts_at: string
  location: string | null
  audience_type: string
  audience_ref: Record<string, unknown>
  myRsvp: 'yes' | 'no' | 'maybe' | null
  rsvpCounts: Record<string, number>
}

export interface FinaThread {
  id: string
  school_id: string
  teacher_id: string
  guardian_id: string
  student_id: string
  created_at: string
  last_message_at: string
  teacher?: PersonName | null
  guardian?: PersonName | null
  student?: { id: string; profile: PersonName | null } | null
}

export interface FinaMessage {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  sender?: (PersonName & { role: string }) | null
}

export interface FinaNotification {
  id: string
  type: string
  payload: Record<string, unknown>
  channels: string[]
  sent_at: string
  read_at: string | null
}

export interface FinaAuditRow {
  id: string
  seq: number
  school_id: string
  actor_id: string | null
  actor_role: string | null
  action: string
  subject_type: string | null
  subject_id: string | null
  meta: Record<string, unknown> | null
  occurred_at: string
}

export interface FinaReport {
  id: string
  school_id: string
  period: string
  kind: string
  file_key: string
  generated_at: string
  created_at: string
}

export function finaApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const c = (campusId?: string, extra: Record<string, string | undefined> = {}) => qs({ ...extra, campus_id: campusId })
  return {
    // Posts / wall
    wall: (campusId?: string, p: { cursor?: string | null; q?: string } = {}) =>
      api.get<{ posts: FinaPost[]; nextCursor: string | null }>(`/fina/posts/wall${c(campusId, { cursor: p.cursor ?? undefined, q: p.q?.trim() || undefined })}`),
    composerOptions: (campusId?: string) => api.get<FinaComposerOptions>(`/fina/posts/composer-options${c(campusId)}`),
    createPost: (input: FinaPostInput, campusId?: string) => api.post<FinaPost>(`/fina/posts${c(campusId)}`, input),
    submitPost: (postId: string, campusId?: string) => api.post<FinaPost>(`/fina/posts/${id(postId)}/submit${c(campusId)}`),
    deletePost: (postId: string, campusId?: string) => api.del<null>(`/fina/posts/${id(postId)}${c(campusId)}`),
    /** The author's own posts in every state (web: /teacher/fina/my-posts). */
    myPosts: (campusId?: string) => api.get<FinaPost[]>(`/fina/posts/mine${c(campusId)}`),
    approvalQueue: (campusId?: string) => api.get<FinaPost[]>(`/fina/posts/approval-queue${c(campusId)}`),
    approvePost: (postId: string, campusId?: string) => api.post<FinaPost>(`/fina/posts/${id(postId)}/approve${c(campusId)}`),
    rejectApproval: (postId: string, reason: string, campusId?: string) => api.post<FinaPost>(`/fina/posts/${id(postId)}/reject-approval${c(campusId)}`, { reason }),
    pinPost: (postId: string, pinned: boolean, campusId?: string) => api.post<FinaPost>(`/fina/posts/${id(postId)}/pin${c(campusId)}`, { pinned }),
    setReaction: (postId: string, kind: FinaReactionKind, campusId?: string) =>
      api.post<{ action: string; pointsEarnedByAuthor: number; isSuperReaction: boolean; promotedToHonorRoll: boolean }>(`/fina/posts/${id(postId)}/reactions${c(campusId)}`, { kind }),
    removeReaction: (postId: string, campusId?: string) => api.del<unknown>(`/fina/posts/${id(postId)}/reactions${c(campusId)}`),
    comments: (postId: string, campusId?: string) => api.get<FinaComment[]>(`/fina/posts/${id(postId)}/comments${c(campusId)}`),
    addComment: (postId: string, body: string, campusId?: string) => api.post<FinaComment>(`/fina/posts/${id(postId)}/comments${c(campusId)}`, { body }),
    moderateComment: (commentId: string, decision: 'approve' | 'reject', campusId?: string) => api.post<FinaComment>(`/fina/posts/comments/${id(commentId)}/moderate${c(campusId)}`, { decision }),
    classGoals: (campusId?: string) => api.get<FinaClassGoal[]>(`/fina/posts/class-goals${c(campusId)}`),
    createClassGoal: (input: { sectionId?: string; gradeLevelId?: string; reactionKind: FinaReactionKind; targetCount: number }, campusId?: string) =>
      api.post<FinaClassGoal>(`/fina/posts/class-goals${c(campusId)}`, input),

    // Media
    uploadMedia: (file: UploadFile, campusId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      return api.post<FinaMedia>(`/fina/media/upload${c(campusId)}`, form, { timeout: 180_000 })
    },
    pendingTagging: (campusId?: string) => api.get<FinaMedia[]>(`/fina/media/pending${c(campusId)}`),
    myReadyMedia: (campusId?: string) => api.get<FinaMedia[]>(`/fina/media/mine/ready${c(campusId)}`),
    tagging: (mediaId: string, campusId?: string) =>
      api.get<{ media: FinaMedia; tags: FinaFaceTag[]; candidateStudents: FinaCandidateStudent[] }>(`/fina/media/${id(mediaId)}/tagging${c(campusId)}`),
    addFaceTag: (mediaId: string, studentId: string, campusId?: string) => api.post<FinaFaceTag>(`/fina/media/${id(mediaId)}/face-tags${c(campusId)}`, { student_id: studentId }),
    removeFaceTag: (mediaId: string, tagId: string, campusId?: string) => api.del<null>(`/fina/media/${id(mediaId)}/face-tags/${id(tagId)}${c(campusId)}`),
    setNoIdentifiable: (mediaId: string, value: boolean, campusId?: string) => api.post<FinaMedia>(`/fina/media/${id(mediaId)}/no-identifiable-students${c(campusId)}`, { value }),
    confirmTagging: (mediaId: string, campusId?: string) => api.post<FinaMedia>(`/fina/media/${id(mediaId)}/confirm-tagging${c(campusId)}`),
    deleteMedia: (mediaId: string, campusId?: string) => api.del<null>(`/fina/media/${id(mediaId)}${c(campusId)}`),
    /** Path of a gated, per-viewer watermarked image (needs the Bearer token, so load it with headers). */
    mediaPath: (mediaId: string, variant: FinaMediaVariant, campusId?: string) => `/fina/media/${id(mediaId)}/${variant}${c(campusId)}`,
    /** Staff-only pre-confirmation preview (bypasses the consent gate): only for tagging screens. */
    rawMediaPath: (mediaId: string, thumb: boolean, campusId?: string) => `/fina/media/${id(mediaId)}/raw${c(campusId, { thumb: thumb ? '1' : undefined })}`,

    // Albums / stories
    albums: (campusId?: string) => api.get<FinaAlbum[]>(`/fina/albums${c(campusId)}`),
    createAlbum: (input: { title: string; activity_date?: string; section_id?: string }, campusId?: string) => api.post<FinaAlbum>(`/fina/albums${c(campusId)}`, input),
    album: (albumId: string, campusId?: string) => api.get<{ album: FinaAlbum; media: { id: string; kind: string; isMyChild: boolean }[] }>(`/fina/albums/${id(albumId)}${c(campusId)}`),
    stories: (campusId?: string) => api.get<FinaStory[]>(`/fina/stories${c(campusId)}`),
    createStory: (mediaId: string, campusId?: string) => api.post<FinaStory>(`/fina/stories${c(campusId)}`, { media_id: mediaId }),

    // Groups / events
    groups: (campusId?: string) => api.get<FinaGroup[]>(`/fina/groups${c(campusId)}`),
    createGroup: (input: { name: string; type?: string; section_id?: string }, campusId?: string) => api.post<FinaGroup>(`/fina/groups${c(campusId)}`, input),
    joinGroup: (groupId: string, campusId?: string) => api.post<unknown>(`/fina/groups/${id(groupId)}/join${c(campusId)}`),
    leaveGroup: (groupId: string, campusId?: string) => api.post<unknown>(`/fina/groups/${id(groupId)}/leave${c(campusId)}`),
    events: (campusId?: string) => api.get<FinaEvent[]>(`/fina/events${c(campusId)}`),
    createEvent: (input: { title: string; body?: string; starts_at: string; location?: string; audience_type?: string }, campusId?: string) => api.post<FinaEvent>(`/fina/events${c(campusId)}`, input),
    rsvp: (eventId: string, answer: 'yes' | 'no' | 'maybe', campusId?: string) => api.post<unknown>(`/fina/events/${id(eventId)}/rsvp${c(campusId)}`, { answer }),

    // Threads (admins read only)
    threads: (campusId?: string) => api.get<FinaThread[]>(`/fina/threads${c(campusId)}`),
    /** Guardian: own children with their current photo-consent level (0 deny … 4 special grant). */
    consentWards: () =>
      api.get<{ studentId: string; firstName: string | null; lastName: string | null; sectionName: string | null; isConsentGuardian: boolean; currentLevel: number }[]>('/fina/consents/my-wards'),
    grantConsent: (body: { student_id: string; level: number; purpose?: string; valid_until?: string }) => api.post<unknown>('/fina/consents', body),
    /** The canonical consent text a guardian reads before choosing. */
    consentText: () => api.get<{ version: string; text: string | null }>('/fina/consents/text/current'),
    /** Guardian: own children to start a thread about. */
    threadWards: () => api.get<{ id: string; sectionId: string | null; name: string }[]>('/fina/threads/my-wards'),
    /** Teacher: students they teach. */
    threadStudents: () => api.get<{ id: string; sectionId: string | null; name: string }[]>('/fina/threads/my-students'),
    /** The other side for a student: that student's teachers (for a guardian) or guardians (for a teacher). */
    threadContacts: (studentId: string) => api.get<{ id: string; name: string }[]>(`/fina/threads/contacts/${id(studentId)}`),
    openThread: (body: { teacher_profile_id?: string; guardian_profile_id?: string; student_id: string }) => api.post<FinaThread>('/fina/threads', body),
    sendMessage: (threadId: string, body: string) => api.post<FinaMessage>(`/fina/threads/${id(threadId)}/messages`, { body }),
    messages: (threadId: string, campusId?: string) => api.get<FinaMessage[]>(`/fina/threads/${id(threadId)}/messages${c(campusId)}`),

    // Notifications
    notifications: (campusId?: string) => api.get<FinaNotification[]>(`/fina/notifications${c(campusId)}`),
    unreadCount: (campusId?: string) => api.get<{ count: number }>(`/fina/notifications/unread-count${c(campusId)}`),
    markRead: (notificationId: string, campusId?: string) => api.post<FinaNotification>(`/fina/notifications/${id(notificationId)}/read${c(campusId)}`),
    markAllRead: (campusId?: string) => api.post<unknown>(`/fina/notifications/read-all${c(campusId)}`),

    // Audit / reports (admin, fina_supervisor)
    audit: (campusId?: string, f: { from?: string; to?: string; action?: string; limit?: number } = {}) =>
      api.get<FinaAuditRow[]>(`/fina/audit${qs({ from: f.from, to: f.to, action: f.action, limit: f.limit, campus_id: campusId })}`),
    reports: (campusId?: string) => api.get<FinaReport[]>(`/fina/reports${c(campusId)}`),
    generateReport: (campusId?: string, period?: string) => api.post<FinaReport>(`/fina/reports/generate${c(campusId)}`, { period }),
    reportDownload: (reportId: string, campusId?: string) => api.get<{ url: string }>(`/fina/reports/${id(reportId)}/download${c(campusId)}`),
  }
}
