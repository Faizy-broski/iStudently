import { supabase } from '../config/supabase'

export interface MessageAttachmentInput {
  url: string
  name: string
  mime_type: string
  size: number
  path: string
}

export interface SendMessageInput {
  schoolId: string
  senderProfileId: string
  subject: string
  body: string
  recipientProfileIds: string[]
  /** If set, this message joins the same conversation thread as the message being replied to. */
  replyToMessageId?: string
  attachments?: MessageAttachmentInput[]
}

export interface MessageAttachment {
  id: string
  file_name: string
  url: string
  mime_type: string
  size: number
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

export interface MessagingProfile {
  id: string
  role: string
  user_profile_id?: string | null
}

const MESSAGING_MODULE_KEY = '/admin/messaging'

export class MessagingService {
  async sendMessage(input: SendMessageInput) {
    const { schoolId, senderProfileId, subject, body, recipientProfileIds, replyToMessageId, attachments } = input

    let threadId: string | undefined
    if (replyToMessageId) {
      const { data: parent } = await supabase
        .from('messages')
        .select('thread_id')
        .eq('id', replyToMessageId)
        .single()
      threadId = parent?.thread_id
    }

    const insertPayload: Record<string, any> = {
      school_id: schoolId,
      sender_profile_id: senderProfileId,
      subject,
      body,
    }
    if (threadId) {
      insertPayload.thread_id = threadId
    }

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(insertPayload)
      .select('*')
      .single()

    if (messageError || !message) {
      throw new Error(`Failed to send message: ${messageError?.message}`)
    }

    // Every recipient (including the sender, if they included themselves) gets exactly
    // one row. The sender's own row is always 'sent' so it shows in their Sent view;
    // dropping the sender entirely here used to silently swallow self-addressed
    // messages (e.g. replying to yourself while testing with a single account).
    const recipientRows = Array.from(new Set(recipientProfileIds)).map((recipientProfileId) => ({
      message_id: message.id,
      recipient_profile_id: recipientProfileId,
      status: recipientProfileId === senderProfileId ? 'sent' : 'unread',
    }))

    if (!recipientProfileIds.includes(senderProfileId)) {
      recipientRows.push({
        message_id: message.id,
        recipient_profile_id: senderProfileId,
        status: 'sent',
      })
    }

    const { error: recipientsError } = await supabase
      .from('message_recipients')
      .insert(recipientRows)

    if (recipientsError) {
      throw new Error(`Failed to save message recipients: ${recipientsError.message}`)
    }

    if (attachments && attachments.length > 0) {
      const attachmentRows = attachments.map((a) => ({
        message_id: message.id,
        file_name: a.name,
        url: a.url,
        mime_type: a.mime_type,
        size: a.size,
        path: a.path,
      }))

      const { error: attachmentsError } = await supabase
        .from('message_attachments')
        .insert(attachmentRows)

      if (attachmentsError) {
        throw new Error(`Failed to save message attachments: ${attachmentsError.message}`)
      }
    }

    return message
  }

  async listMessages(profileId: string, view: 'inbox' | 'read' | 'archived' | 'sent', page = 1, limit = 50) {
    const status = view === 'inbox' ? 'unread' : view
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await supabase
      .from('message_recipients')
      .select('id, status, read_at, messages(id, subject, body, created_at, sender_profile_id)', { count: 'exact' })
      .eq('recipient_profile_id', profileId)
      .eq('status', status)
      .order('created_at', { referencedTable: 'messages', ascending: false })
      .range(from, to)

    if (error) {
      throw new Error(`Failed to list messages: ${error.message}`)
    }

    const senderIds = (data || [])
      .map((item: any) => item.messages?.sender_profile_id)
      .filter((id: string | undefined): id is string => !!id)
    const profiles = await this.fetchProfilesByIds(senderIds)

    const messageIds = (data || [])
      .map((item: any) => item.messages?.id)
      .filter((id: string | undefined): id is string => !!id)
    const { data: attachmentRows } = messageIds.length
      ? await supabase.from('message_attachments').select('message_id').in('message_id', messageIds)
      : { data: [] }
    const messageIdsWithAttachments = new Set((attachmentRows || []).map((r: any) => r.message_id))

    const enriched = (data || []).map((item: any) => ({
      ...item,
      sender_name: this.formatProfileName(profiles.get(item.messages?.sender_profile_id)),
      has_attachments: messageIdsWithAttachments.has(item.messages?.id),
    }))

    return {
      data: enriched,
      total: count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    }
  }

  async getUnreadCount(profileId: string): Promise<number> {
    const { count, error } = await supabase
      .from('message_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_profile_id', profileId)
      .eq('status', 'unread')

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`)
    }

    return count || 0
  }

  /**
   * A message plus every reply in the same conversation that this profile is allowed to
   * see (they were either the sender or a recipient of that particular message) — opening
   * any one message in a thread shows the whole back-and-forth with that person.
   */
  async getThread(anchorMessageId: string, profile: MessagingProfile): Promise<ThreadMessage[] | null> {
    const { data: anchor } = await supabase
      .from('messages')
      .select('id, thread_id')
      .eq('id', anchorMessageId)
      .single()

    if (!anchor) {
      return null
    }

    const { data: threadMessages, error } = await supabase
      .from('messages')
      .select('id, subject, body, created_at, sender_profile_id')
      .eq('thread_id', anchor.thread_id)
      .order('created_at', { ascending: true })

    if (error || !threadMessages || threadMessages.length === 0) {
      return null
    }

    const messageIds = threadMessages.map((m) => m.id)
    const { data: recipientRows } = await supabase
      .from('message_recipients')
      .select('*')
      .in('message_id', messageIds)
      .eq('recipient_profile_id', profile.id)

    const recipientByMessage = new Map((recipientRows || []).map((r) => [r.message_id, r]))

    // Only messages this profile actually sent or received are visible to them.
    const visible = threadMessages.filter(
      (m) => recipientByMessage.has(m.id) || m.sender_profile_id === profile.id
    )

    if (visible.length === 0) {
      return null
    }

    const unreadRowIds = (recipientRows || [])
      .filter((r) => r.status === 'unread' && visible.some((m) => m.id === r.message_id))
      .map((r) => r.id)

    if (unreadRowIds.length > 0) {
      await supabase
        .from('message_recipients')
        .update({ status: 'read', read_at: new Date().toISOString() })
        .in('id', unreadRowIds)
    }

    const senderIds = visible.map((m) => m.sender_profile_id)
    const profiles = await this.fetchProfilesByIds(senderIds)

    const visibleIds = visible.map((m) => m.id)
    const { data: attachmentRows } = await supabase
      .from('message_attachments')
      .select('id, message_id, file_name, url, mime_type, size')
      .in('message_id', visibleIds)

    const attachmentsByMessage = new Map<string, MessageAttachment[]>()
    for (const row of attachmentRows || []) {
      const list = attachmentsByMessage.get(row.message_id) || []
      list.push({
        id: row.id,
        file_name: row.file_name,
        url: row.url,
        mime_type: row.mime_type,
        size: row.size,
      })
      attachmentsByMessage.set(row.message_id, list)
    }

    const messages: ThreadMessage[] = []
    for (const m of visible) {
      const recipientRow = recipientByMessage.get(m.id)
      const status = recipientRow
        ? recipientRow.status === 'unread'
          ? 'read'
          : recipientRow.status
        : 'sent'

      const canDelete = await this.canDeleteMessage(profile, m)

      messages.push({
        id: m.id,
        subject: m.subject,
        body: m.body,
        created_at: m.created_at,
        sender_profile_id: m.sender_profile_id,
        sender_name: this.formatProfileName(profiles.get(m.sender_profile_id)),
        is_own: m.sender_profile_id === profile.id,
        status,
        can_delete: canDelete,
        attachments: attachmentsByMessage.get(m.id) || [],
      })
    }

    return messages
  }

  async archiveMessage(messageId: string, profileId: string) {
    const { data, error } = await supabase
      .from('message_recipients')
      .update({ status: 'archived' })
      .eq('message_id', messageId)
      .eq('recipient_profile_id', profileId)
      .in('status', ['unread', 'read'])
      .select('id')

    if (error) {
      throw new Error(`Failed to archive message: ${error.message}`)
    }

    return (data?.length || 0) > 0
  }

  async canDeleteMessage(profile: MessagingProfile, message: { created_at: string }): Promise<boolean> {
    const hasRolePermission = profile.role === 'admin' || profile.role === 'super_admin'

    let hasGrantedPermission = false
    if (!hasRolePermission && profile.user_profile_id) {
      const { data } = await supabase
        .from('user_profile_permissions')
        .select('can_edit')
        .eq('profile_id', profile.user_profile_id)
        .eq('module_key', MESSAGING_MODULE_KEY)
        .single()

      hasGrantedPermission = !!data?.can_edit
    }

    if (!hasRolePermission && !hasGrantedPermission) {
      return false
    }

    const settings = await this.getMessagingSettings()
    const windowMinutes = Number(settings.delete_window_minutes) || 0

    if (windowMinutes <= 0) {
      return false
    }

    const elapsedMs = Date.now() - new Date(message.created_at).getTime()
    return elapsedMs <= windowMinutes * 60_000
  }

  async deleteMessage(messageId: string, profile: MessagingProfile): Promise<boolean> {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('id', messageId)
      .single()

    if (messageError || !message) {
      return false
    }

    const allowed = await this.canDeleteMessage(profile, message)
    if (!allowed) {
      return false
    }

    const { error: deleteError } = await supabase.from('messages').delete().eq('id', messageId)

    if (deleteError) {
      throw new Error(`Failed to delete message: ${deleteError.message}`)
    }

    return true
  }

  async listRecipients(schoolId: string, role: string, type: 'staff' | 'students', search?: string) {
    const term = search?.trim().toLowerCase()

    if (type === 'students') {
      if (!['admin', 'teacher', 'super_admin'].includes(role)) {
        return []
      }

      const { data, error } = await supabase
        .from('students')
        .select('profile_id, student_number')
        .eq('school_id', schoolId)
        .not('profile_id', 'is', null)
        .limit(300)

      if (error) {
        throw new Error(`Failed to list student recipients: ${error.message}`)
      }

      const profiles = await this.fetchProfilesByIds((data || []).map((s) => s.profile_id as string))

      return (data || [])
        .map((s) => {
          const profile = profiles.get(s.profile_id as string)
          return {
            profileId: s.profile_id as string,
            name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
            subtitle: s.student_number as string,
          }
        })
        .filter((r) => !term || r.name.toLowerCase().includes(term))
    }

    const { data, error } = await supabase
      .from('staff')
      .select('profile_id, title')
      .eq('school_id', schoolId)
      .limit(300)

    if (error) {
      throw new Error(`Failed to list staff recipients: ${error.message}`)
    }

    const profiles = await this.fetchProfilesByIds((data || []).map((s) => s.profile_id as string))

    return (data || [])
      .map((s) => {
        const profile = profiles.get(s.profile_id as string)
        return {
          profileId: s.profile_id as string,
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          subtitle: (profile?.role as string) || s.title || '',
        }
      })
      .filter((r) => !term || r.name.toLowerCase().includes(term))
  }

  private async fetchProfilesByIds(profileIds: string[]) {
    const map = new Map<string, { first_name: string | null; last_name: string | null; role: string | null }>()

    if (profileIds.length === 0) {
      return map
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', profileIds)

    for (const profile of data || []) {
      map.set(profile.id, profile)
    }

    return map
  }

  private formatProfileName(profile?: { first_name: string | null; last_name: string | null } | null): string {
    if (!profile) return 'Unknown'
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
  }

  async listTemplates(ownerProfileId: string) {
    const { data, error } = await supabase
      .from('message_templates')
      .select('id, title, subject, body, created_at, updated_at')
      .eq('owner_profile_id', ownerProfileId)
      .order('title', { ascending: true })

    if (error) {
      throw new Error(`Failed to list templates: ${error.message}`)
    }

    return data || []
  }

  async saveTemplate(input: { schoolId: string; ownerProfileId: string; title: string; subject: string; body: string }) {
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        school_id: input.schoolId,
        owner_profile_id: input.ownerProfileId,
        title: input.title,
        subject: input.subject,
        body: input.body,
      })
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to save template: ${error.message}`)
    }

    return data
  }

  async deleteTemplate(templateId: string, ownerProfileId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', templateId)
      .eq('owner_profile_id', ownerProfileId)
      .select('id')

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`)
    }

    return (data?.length || 0) > 0
  }

  async getMessagingSettings(): Promise<Record<string, any>> {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'messaging')
      .single()

    if (error || !data) {
      return { delete_window_minutes: 0 }
    }

    return data.value as Record<string, any>
  }

  async updateMessagingSettings(updates: Record<string, any>): Promise<Record<string, any>> {
    const current = await this.getMessagingSettings()
    const merged = { ...current, ...updates }

    const { data, error } = await supabase
      .from('platform_settings')
      .upsert({ key: 'messaging', value: merged, updated_at: new Date().toISOString() })
      .select('value')
      .single()

    if (error) {
      throw new Error(`Failed to update messaging settings: ${error.message}`)
    }

    return data?.value as Record<string, any>
  }
}
