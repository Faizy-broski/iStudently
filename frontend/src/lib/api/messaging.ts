import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }

  const impersonatedSchoolId = typeof window !== 'undefined' ? sessionStorage.getItem('impersonatedSchoolId') : null
  if (impersonatedSchoolId) {
    headers['X-School-Id'] = impersonatedSchoolId
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      timeout: 30000,
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' }
    }

    return data
  } catch {
    return { success: false, error: 'Network error' }
  }
}

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

export interface MessageRecipientOption {
  profileId: string
  name: string
  subtitle?: string
}

export const messagingApi = {
  listRecipients: async (type: 'staff' | 'students', search?: string, campusId?: string) => {
    const params = new URLSearchParams({ type })
    if (search) params.append('search', search)
    if (campusId) params.append('campus_id', campusId)
    return apiRequest<MessageRecipientOption[]>(`/messaging/recipients?${params.toString()}`)
  },

  sendMessage: async (input: {
    recipient_ids: string[]
    subject: string
    body: string
    campus_id?: string
    reply_to_message_id?: string
    attachments?: { url: string; name: string; mime_type: string; size: number; path: string }[]
  }) => {
    return apiRequest<{ id: string }>('/messaging/send', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  listMessages: async (view: MessageView, page = 1, limit = 50) => {
    return apiRequest<MessageListItem[]>(`/messaging?view=${view}&page=${page}&limit=${limit}`)
  },

  getUnreadCount: async () => {
    return apiRequest<{ count: number }>('/messaging/unread-count')
  },

  getThread: async (id: string) => {
    return apiRequest<{ messages: ThreadMessage[] }>(`/messaging/${id}`)
  },

  archiveMessage: async (id: string) => {
    return apiRequest<void>(`/messaging/${id}/archive`, { method: 'PUT' })
  },

  deleteMessage: async (id: string) => {
    return apiRequest<void>(`/messaging/${id}`, { method: 'DELETE' })
  },

  listTemplates: async () => {
    return apiRequest<MessageTemplate[]>('/messaging/templates')
  },

  saveTemplate: async (input: { title: string; subject: string; body: string; campus_id?: string }) => {
    return apiRequest<MessageTemplate>('/messaging/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  deleteTemplate: async (id: string) => {
    return apiRequest<void>(`/messaging/templates/${id}`, { method: 'DELETE' })
  },

  getMessagingSettings: async () => {
    return apiRequest<{ delete_window_minutes: number }>('/messaging/settings')
  },

  updateMessagingSettings: async (updates: { delete_window_minutes: number }) => {
    return apiRequest<{ delete_window_minutes: number }>('/messaging/settings', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  },
}
