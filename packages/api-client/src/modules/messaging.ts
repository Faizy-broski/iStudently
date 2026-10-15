// Ported from frontend/src/lib/api/messaging.ts (types copied verbatim).
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface MessageAttachment {
  id: string
  file_name: string
  url: string
  mime_type: string
  size: number
}

export interface MessageListItem {
  id: string
  status: 'unread' | 'read' | 'archived' | 'sent'
  read_at: string | null
  sender_name: string
  has_attachments?: boolean
  messages: {
    id: string
    subject: string
    body: string
    created_at: string
    sender_profile_id: string
  }
}

export interface ThreadMessage {
  id: string
  subject: string
  body: string
  created_at: string
  sender_profile_id: string
  sender_name: string
  is_own: boolean
  status: string
  can_delete: boolean
  attachments: MessageAttachment[]
}

export interface MessageTemplate {
  id: string
  title: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

export type MessageView = 'inbox' | 'read' | 'archived' | 'sent'

export type RecipientType = 'students' | 'teachers' | 'staff' | 'parents'

export interface MessageRecipientOption {
  profileId: string
  name: string
  subtitle?: string
}

export interface TeacherAllowedStaffOption {
  profileId: string
  name: string
  role: string
  title: string | null
  isAllowed: boolean
}

/** Already-uploaded file (POST /media/upload-attachment, `media.uploadAttachment`). */
export interface SendAttachment {
  url: string
  name: string
  mime_type: string
  size: number
  path: string
}

export interface SendMessageInput {
  recipient_ids: string[]
  subject: string
  body: string
  campus_id?: string
  reply_to_message_id?: string
  attachments?: SendAttachment[]
}

export function messagingApi(api: ApiClient) {
  const base = '/messaging'
  const id = (v: string) => encodeURIComponent(v)
  return {
    listRecipients: (
      type: RecipientType,
      opts: { search?: string; campusId?: string; gradeLevelIds?: string[]; sectionIds?: string[]; page?: number; limit?: number } = {},
    ) =>
      api.get<MessageRecipientOption[]>(
        `${base}/recipients${qs({
          type,
          search: opts.search,
          campus_id: opts.campusId,
          grade_level_id: opts.gradeLevelIds,
          section_id: opts.sectionIds,
          page: opts.page,
          limit: opts.limit,
        })}`,
      ),
    sendMessage: (input: SendMessageInput) => api.post<{ id: string }>(`${base}/send`, input),
    listMessages: (view: MessageView, opts: { page?: number; limit?: number; search?: string; order?: 'asc' | 'desc' } = {}) =>
      api.get<MessageListItem[]>(
        `${base}${qs({ view, page: opts.page ?? 1, limit: opts.limit ?? 50, order: opts.order ?? 'desc', search: opts.search?.trim() })}`,
      ),
    getUnreadCount: () => api.get<{ count: number }>(`${base}/unread-count`),
    getThread: (messageId: string) => api.get<{ messages: ThreadMessage[] }>(`${base}/${id(messageId)}`),
    archiveMessage: (messageId: string) => api.put<void>(`${base}/${id(messageId)}/archive`),
    deleteMessage: (messageId: string) => api.del<void>(`${base}/${id(messageId)}`),
    listTemplates: () => api.get<MessageTemplate[]>(`${base}/templates`),
    saveTemplate: (input: { title: string; subject: string; body: string; campus_id?: string }) =>
      api.post<MessageTemplate>(`${base}/templates`, input),
    updateTemplate: (templateId: string, input: { title?: string; subject?: string; body?: string }) =>
      api.put<MessageTemplate>(`${base}/templates/${id(templateId)}`, input),
    deleteTemplate: (templateId: string) => api.del<void>(`${base}/templates/${id(templateId)}`),
    /** Admin only. */
    getTeacherAllowedStaff: (campusId?: string) =>
      api.get<TeacherAllowedStaffOption[]>(`${base}/teacher-allowed-staff${qs({ campus_id: campusId })}`),
    /** Admin only. */
    setTeacherAllowedStaff: (staffProfileIds: string[], campusId?: string) =>
      api.put<void>(`${base}/teacher-allowed-staff`, { staff_profile_ids: staffProfileIds, campus_id: campusId }),
    getMessagingSettings: () => api.get<{ delete_window_minutes: number }>(`${base}/settings`),
    updateMessagingSettings: (updates: { delete_window_minutes: number }) =>
      api.put<{ delete_window_minutes: number }>(`${base}/settings`, updates),
  }
}

export type MessagingApi = ReturnType<typeof messagingApi>
