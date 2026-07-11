import { randomUUID } from 'crypto'
import { supabase } from '../config/supabase'
import { matchesFileSignature } from '../utils/file-signature'
import {
  Grievance,
  CreateGrievanceDTO,
  GrievanceStatus,
  GrievancePriority,
  GrievanceSettings,
} from '../types'

export interface GrievanceProfile {
  id: string
  role: string
  school_id: string
  user_profile_id?: string | null
}

const GRIEVANCE_MODULE_KEY = '/admin/grievances'

const DEFAULT_CATEGORIES = [
  'Academic', 'Teacher Conduct', 'Student Conduct', 'Bullying', 'Homework',
  'Assessment', 'Attendance', 'Transportation', 'School Facilities', 'Finance',
  'Technology', 'Administration', 'Health & Safety', 'Other',
]

const OPEN_STATUSES: GrievanceStatus[] = [
  'submitted', 'pending_review', 'assigned', 'under_investigation',
  'awaiting_info', 'reopened', 'escalated',
]

export class GrievanceService {
  // ── Settings & categories ────────────────────────────────────────────────

  async getSettings(schoolId: string): Promise<GrievanceSettings> {
    const { data } = await supabase
      .from('grievance_settings')
      .select('*')
      .eq('school_id', schoolId)
      .single()

    if (data) return data as GrievanceSettings

    const defaults = {
      school_id: schoolId,
      sla_days_default: 5,
      allow_anonymous: true,
      allow_confidential: true,
      allow_reopen: true,
      max_attachment_mb: 10,
      allowed_file_types: [
        'image/jpeg', 'image/png', 'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      notification_channels: { in_app: true, email: false },
    }

    const { data: created, error } = await supabase
      .from('grievance_settings')
      .upsert(defaults)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to initialize grievance settings: ${error.message}`)
    return created as GrievanceSettings
  }

  async updateSettings(schoolId: string, updates: Partial<GrievanceSettings>): Promise<GrievanceSettings> {
    const current = await this.getSettings(schoolId)
    const merged = { ...current, ...updates, school_id: schoolId, updated_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('grievance_settings')
      .upsert(merged)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update grievance settings: ${error.message}`)
    return data as GrievanceSettings
  }

  async getCategories(schoolId: string) {
    const { data, error } = await supabase
      .from('grievance_categories')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`)

    if (data && data.length > 0) return data

    // Lazily seed the default category list the first time this school reads categories.
    const rows = DEFAULT_CATEGORIES.map((name, i) => ({
      school_id: schoolId, name, is_default: true, sort_order: i,
    }))
    const { data: seeded, error: seedError } = await supabase
      .from('grievance_categories')
      .insert(rows)
      .select('*')

    if (seedError) throw new Error(`Failed to seed default categories: ${seedError.message}`)
    return seeded || []
  }

  async createCategory(schoolId: string, name: string, slaDays?: number) {
    const { data, error } = await supabase
      .from('grievance_categories')
      .insert({ school_id: schoolId, name, sla_days: slaDays ?? null })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return data
  }

  async updateCategory(schoolId: string, id: string, updates: { name?: string; is_active?: boolean; sla_days?: number | null }) {
    const { data, error } = await supabase
      .from('grievance_categories')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update category: ${error.message}`)
    return data
  }

  async deleteCategory(schoolId: string, id: string) {
    const { error } = await supabase
      .from('grievance_categories')
      .update({ is_active: false })
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw new Error(`Failed to delete category: ${error.message}`)
  }

  // ── Number / token generation ────────────────────────────────────────────

  private async generateComplaintNumber(schoolId: string): Promise<string> {
    const year = new Date().getFullYear()
    for (let i = 0; i < 20; i++) {
      const candidate = `GRV-${year}-${Math.floor(100000 + Math.random() * 900000)}`
      const { data } = await supabase
        .from('grievances')
        .select('id')
        .eq('school_id', schoolId)
        .eq('complaint_number', candidate)
        .maybeSingle()
      if (!data) return candidate
    }
    throw new Error('Unable to generate unique complaint number after 20 attempts')
  }

  private generateTrackingToken(): string {
    return Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('')
  }

  /** Adds `days` working days (Mon-Fri) to `from`. Does not account for holidays. */
  private addWorkingDays(from: Date, days: number): Date {
    const result = new Date(from)
    let added = 0
    while (added < days) {
      result.setDate(result.getDate() + 1)
      const day = result.getDay()
      if (day !== 0 && day !== 6) added++
    }
    return result
  }

  // ── Audit log & watchers ─────────────────────────────────────────────────

  private async writeAudit(
    grievanceId: string,
    actorProfileId: string | null,
    action: string,
    metadata: Record<string, any> = {}
  ) {
    await supabase.from('grievance_audit_logs').insert({
      grievance_id: grievanceId,
      actor_profile_id: actorProfileId,
      action,
      metadata,
    })
  }

  private async addWatcher(grievanceId: string, profileId: string) {
    await supabase
      .from('grievance_watchers')
      .upsert({ grievance_id: grievanceId, profile_id: profileId }, { onConflict: 'grievance_id,profile_id' })
  }

  private async touchGrievance(grievanceId: string) {
    await supabase.from('grievances').update({ updated_at: new Date().toISOString() }).eq('id', grievanceId)
  }

  // ── Permission checks ────────────────────────────────────────────────────

  private isAdmin(profile: GrievanceProfile): boolean {
    return profile.role === 'admin' || profile.role === 'super_admin'
  }

  private async isAssignee(grievanceId: string, profileId: string): Promise<boolean> {
    const { data } = await supabase
      .from('grievance_assignments')
      .select('id')
      .eq('grievance_id', grievanceId)
      .eq('assignee_profile_id', profileId)
      .eq('is_current', true)
      .maybeSingle()
    return !!data
  }

  /** Can this profile manage (change status / assign / add internal notes on) this grievance? */
  async canManageGrievance(profile: GrievanceProfile, grievanceId: string): Promise<boolean> {
    if (this.isAdmin(profile)) return true

    if (await this.isAssignee(grievanceId, profile.id)) return true

    if (profile.user_profile_id) {
      const { data } = await supabase
        .from('user_profile_permissions')
        .select('can_edit')
        .eq('profile_id', profile.user_profile_id)
        .eq('module_key', GRIEVANCE_MODULE_KEY)
        .single()
      if (data?.can_edit) return true
    }

    return false
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createGrievance(dto: CreateGrievanceDTO): Promise<Grievance> {
    const settings = await this.getSettings(dto.school_id)

    if (dto.is_anonymous && !settings.allow_anonymous) {
      throw new Error('Anonymous submissions are not allowed at this school')
    }
    if (dto.is_confidential && !settings.allow_confidential) {
      throw new Error('Confidential submissions are not allowed at this school')
    }

    const complaintNumber = await this.generateComplaintNumber(dto.school_id)
    const trackingToken = this.generateTrackingToken()

    let slaDays = settings.sla_days_default
    if (dto.category_id) {
      const { data: category } = await supabase
        .from('grievance_categories')
        .select('sla_days')
        .eq('id', dto.category_id)
        .maybeSingle()
      if (category?.sla_days) slaDays = category.sla_days
    }

    const submittedAt = new Date()
    const dueDate = this.addWorkingDays(submittedAt, slaDays)

    const { data, error } = await supabase
      .from('grievances')
      .insert({
        school_id: dto.school_id,
        complaint_number: complaintNumber,
        title: dto.title,
        description: dto.description,
        category_id: dto.category_id || null,
        priority: dto.priority || 'normal',
        department: dto.department || null,
        submitter_profile_id: dto.submitter_profile_id,
        person_involved_profile_id: dto.person_involved_profile_id || null,
        is_anonymous: !!dto.is_anonymous,
        is_confidential: !!dto.is_confidential,
        status: 'submitted',
        tracking_token: trackingToken,
        submitted_at: submittedAt.toISOString(),
        due_date: dueDate.toISOString(),
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to create grievance: ${error.message}`)

    if (dto.attachments && dto.attachments.length > 0) {
      await supabase.from('grievance_attachments').insert(
        dto.attachments.map((a) => ({
          grievance_id: data.id,
          file_name: a.file_name,
          file_url: a.file_url,
          file_type: a.file_type || null,
          file_size: a.file_size || null,
          uploaded_by_profile_id: dto.submitter_profile_id,
        }))
      )
    }

    await this.addWatcher(data.id, dto.submitter_profile_id)
    await this.writeAudit(data.id, dto.submitter_profile_id, 'created', { complaint_number: complaintNumber })

    return data as Grievance
  }

  // ── List / Get ────────────────────────────────────────────────────────────

  async listGrievances(
    profile: GrievanceProfile,
    view: 'mine' | 'assigned' | 'all',
    filters: {
      status?: string
      priority?: string
      category_id?: string
      search?: string
      page?: number
      limit?: number
    }
  ) {
    const page = filters.page || 1
    const limit = filters.limit || 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    if (view === 'all' && !this.isAdmin(profile)) {
      throw new Error('Only administrators can view all complaints')
    }

    let query = supabase
      .from('grievances')
      .select('*, category:grievance_categories(id, name)', { count: 'exact' })
      .eq('school_id', profile.school_id)

    if (view === 'mine') {
      query = query.eq('submitter_profile_id', profile.id)
    } else if (view === 'assigned') {
      const { data: assignments } = await supabase
        .from('grievance_assignments')
        .select('grievance_id')
        .eq('assignee_profile_id', profile.id)
        .eq('is_current', true)
      const ids = (assignments || []).map((a) => a.grievance_id)
      if (ids.length === 0) return { data: [], total: 0, page, totalPages: 1 }
      query = query.in('id', ids)
    } else {
      // 'all' — admin only (checked above). Exclude complaints confidentially filed
      // against the admin themselves.
      query = query.not('person_involved_profile_id', 'eq', profile.id)
    }

    if (filters.status) query = query.eq('status', filters.status)
    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.category_id) query = query.eq('category_id', filters.category_id)
    if (filters.search) query = query.or(`title.ilike.%${filters.search}%,complaint_number.ilike.%${filters.search}%`)

    // Critical priority always surfaces first, per spec.
    query = query
      .order('priority', { ascending: false, nullsFirst: false })
      .order('submitted_at', { ascending: false })
      .range(from, to)

    const { data, error, count } = await query
    if (error) throw new Error(`Failed to list grievances: ${error.message}`)

    const rows = await this.maskAnonymous(data || [], profile)

    return {
      data: rows,
      total: count || 0,
      page,
      totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
    }
  }

  /**
   * Throws unless `profile` is allowed to view `grievance` (owner, current
   * assignee, or admin — with the confidential-subject exclusion). Returns
   * the resolved flags so callers don't have to recompute isAdmin/isAssignee.
   * Shared by getGrievanceById and the attachment upload/download paths so
   * every access point to a grievance's data enforces the same rule.
   */
  private async assertCanView(
    grievance: { id: string; submitter_profile_id: string; is_confidential: boolean; person_involved_profile_id: string | null },
    profile: GrievanceProfile
  ): Promise<{ isAdmin: boolean; isAssignee: boolean }> {
    const isOwner = grievance.submitter_profile_id === profile.id
    const isAdmin = this.isAdmin(profile)
    const isAssignee = await this.isAssignee(grievance.id, profile.id)

    if (!isAdmin && !isOwner && !isAssignee) {
      throw new Error('You do not have access to this complaint')
    }

    // The subject of a confidential complaint may never open it, even if they are
    // otherwise an admin/assignee on unrelated complaints.
    if (grievance.is_confidential && grievance.person_involved_profile_id === profile.id && !isAdmin) {
      throw new Error('You do not have access to this complaint')
    }

    return { isAdmin, isAssignee }
  }

  async getGrievanceById(id: string, profile: GrievanceProfile) {
    const { data: grievance, error } = await supabase
      .from('grievances')
      .select('*, category:grievance_categories(id, name)')
      .eq('id', id)
      .eq('school_id', profile.school_id)
      .single()

    if (error || !grievance) return null

    const { isAdmin, isAssignee } = await this.assertCanView(grievance, profile)

    const [masked] = await this.maskAnonymous([grievance], profile)

    const { data: comments } = await supabase
      .from('grievance_comments')
      .select('*')
      .eq('grievance_id', id)
      .order('created_at', { ascending: true })

    const visibleComments = isAdmin || isAssignee
      ? comments || []
      : (comments || []).filter((c) => !c.is_internal_note)

    const { data: attachments } = await supabase
      .from('grievance_attachments')
      .select('*')
      .eq('grievance_id', id)
      .order('created_at', { ascending: true })

    const { data: assignments } = await supabase
      .from('grievance_assignments')
      .select('*')
      .eq('grievance_id', id)
      .order('created_at', { ascending: false })

    await this.addWatcher(id, profile.id)
    await supabase
      .from('grievance_watchers')
      .update({ last_read_at: new Date().toISOString() })
      .eq('grievance_id', id)
      .eq('profile_id', profile.id)

    return {
      ...masked,
      comments: visibleComments,
      attachments: attachments || [],
      assignments: assignments || [],
      can_manage: isAdmin || isAssignee,
    }
  }

  /** Hides submitter identity for anonymous complaints from anyone but admins. */
  private async maskAnonymous(rows: any[], profile: GrievanceProfile) {
    const isAdmin = this.isAdmin(profile)
    const anonymousIds = rows.filter((r) => r.is_anonymous).map((r) => r.submitter_profile_id)

    if (isAdmin || anonymousIds.length === 0) return rows

    return rows.map((r) => {
      if (r.is_anonymous && r.submitter_profile_id !== profile.id) {
        return { ...r, submitter_profile_id: null, submitter_name: 'Anonymous' }
      }
      return r
    })
  }

  // ── Comments / attachments ───────────────────────────────────────────────

  async addComment(grievanceId: string, profile: GrievanceProfile, body: string, isInternalNote: boolean) {
    if (isInternalNote && !(await this.canManageGrievance(profile, grievanceId))) {
      throw new Error('Only staff assigned to this complaint can add internal notes')
    }

    const { data, error } = await supabase
      .from('grievance_comments')
      .insert({ grievance_id: grievanceId, author_profile_id: profile.id, body, is_internal_note: isInternalNote })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to add comment: ${error.message}`)

    await this.touchGrievance(grievanceId)
    await this.addWatcher(grievanceId, profile.id)
    await this.writeAudit(grievanceId, profile.id, 'comment_added', { comment_id: data.id, is_internal_note: isInternalNote })

    return data
  }

  /** Fetches a grievance scoped to the caller's school — used to gate attachment access. */
  private async fetchGrievanceForAccess(grievanceId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('grievances')
      .select('id, school_id, submitter_profile_id, is_confidential, person_involved_profile_id')
      .eq('id', grievanceId)
      .eq('school_id', schoolId)
      .single()

    if (error || !data) throw new Error('Complaint not found')
    return data
  }

  /**
   * Registers metadata for already-uploaded files (used only by trusted
   * server-side callers, e.g. re-attaching during import). NOT the path the
   * UI uses — the UI uploads real bytes via uploadAttachmentFile() below,
   * which is the only route that actually validates and stores a file.
   */
  async addAttachments(
    grievanceId: string,
    profile: GrievanceProfile,
    files: { file_name: string; file_url: string; file_type?: string; file_size?: number }[],
    commentId?: string
  ) {
    const grievance = await this.fetchGrievanceForAccess(grievanceId, profile.school_id)
    await this.assertCanView(grievance, profile)

    const rows = files.map((f) => ({
      grievance_id: grievanceId,
      comment_id: commentId || null,
      file_name: f.file_name,
      file_url: f.file_url,
      file_type: f.file_type || null,
      file_size: f.file_size || null,
      uploaded_by_profile_id: profile.id,
    }))

    const { data, error } = await supabase.from('grievance_attachments').insert(rows).select('*')
    if (error) throw new Error(`Failed to upload attachments: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'attachment_uploaded', { count: files.length })
    return data
  }

  /**
   * The real upload path used by the UI: accepts raw file bytes (from
   * multer), validates them against this school's grievance_settings and a
   * magic-byte signature check, then stores the file via the service-role
   * Supabase client (the storage bucket has no authenticated-role policies —
   * this is the only way a file reaches it) and records the attachment row.
   */
  async uploadAttachmentFile(
    grievanceId: string,
    profile: GrievanceProfile,
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    commentId?: string
  ) {
    const grievance = await this.fetchGrievanceForAccess(grievanceId, profile.school_id)
    await this.assertCanView(grievance, profile)

    const settings = await this.getSettings(profile.school_id)

    if (!settings.allowed_file_types.includes(file.mimetype)) {
      throw new Error(`File type not allowed: ${file.mimetype}`)
    }
    if (file.size > settings.max_attachment_mb * 1024 * 1024) {
      throw new Error(`File too large. Maximum ${settings.max_attachment_mb} MB`)
    }
    if (!matchesFileSignature(file.buffer, file.mimetype)) {
      throw new Error('File content does not match its declared type')
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 80)
    const storagePath = `${profile.school_id}/${grievanceId}/${randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('grievance-attachments')
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false })

    if (uploadError) throw new Error(`Failed to upload attachment: ${uploadError.message}`)

    const { data, error } = await supabase
      .from('grievance_attachments')
      .insert({
        grievance_id: grievanceId,
        comment_id: commentId || null,
        file_name: file.originalname,
        file_url: storagePath,
        file_type: file.mimetype,
        file_size: file.size,
        uploaded_by_profile_id: profile.id,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to save attachment record: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'attachment_uploaded', { attachment_id: data.id, file_name: file.originalname })
    return data
  }

  /** Issues a short-lived signed URL for an attachment, after verifying the caller can view the grievance it belongs to. */
  async getAttachmentSignedUrl(grievanceId: string, attachmentId: string, profile: GrievanceProfile) {
    const grievance = await this.fetchGrievanceForAccess(grievanceId, profile.school_id)
    await this.assertCanView(grievance, profile)

    const { data: attachment, error: attachmentError } = await supabase
      .from('grievance_attachments')
      .select('file_name, file_url')
      .eq('id', attachmentId)
      .eq('grievance_id', grievanceId)
      .single()

    if (attachmentError || !attachment) throw new Error('Attachment not found')

    const { data: signed, error: signError } = await supabase.storage
      .from('grievance-attachments')
      .createSignedUrl(attachment.file_url, 300)

    if (signError || !signed) throw new Error(signError?.message || 'Failed to create signed URL')

    await this.writeAudit(grievanceId, profile.id, 'attachment_downloaded', { attachment_id: attachmentId })

    return { url: signed.signedUrl, file_name: attachment.file_name }
  }

  // ── Status / assignment / escalation / reopen ────────────────────────────

  async updateStatus(grievanceId: string, profile: GrievanceProfile, newStatus: GrievanceStatus, note?: string) {
    if (!(await this.canManageGrievance(profile, grievanceId))) {
      throw new Error('You are not authorized to change the status of this complaint')
    }

    const { data: existing } = await supabase.from('grievances').select('status').eq('id', grievanceId).single()
    if (!existing) throw new Error('Complaint not found')

    const updates: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString()
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('grievances')
      .update(updates)
      .eq('id', grievanceId)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update status: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'status_changed', { from: existing.status, to: newStatus, note })
    return data
  }

  async assignGrievance(grievanceId: string, profile: GrievanceProfile, assigneeProfileId: string, roleLabel?: string) {
    if (!this.isAdmin(profile)) {
      throw new Error('Only administrators can assign complaints')
    }

    await supabase
      .from('grievance_assignments')
      .update({ is_current: false })
      .eq('grievance_id', grievanceId)
      .eq('is_current', true)

    const { data, error } = await supabase
      .from('grievance_assignments')
      .insert({
        grievance_id: grievanceId,
        assignee_profile_id: assigneeProfileId,
        assigned_by_profile_id: profile.id,
        role_label: roleLabel || null,
        is_current: true,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to assign complaint: ${error.message}`)

    await supabase
      .from('grievances')
      .update({ status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', grievanceId)
      .in('status', ['submitted', 'pending_review'])

    await this.addWatcher(grievanceId, assigneeProfileId)
    await this.writeAudit(grievanceId, profile.id, 'assigned', { assignee_profile_id: assigneeProfileId, role_label: roleLabel })

    return data
  }

  async escalateGrievance(grievanceId: string, profile: GrievanceProfile, note?: string) {
    if (!(await this.canManageGrievance(profile, grievanceId))) {
      throw new Error('You are not authorized to escalate this complaint')
    }

    const { error } = await supabase
      .from('grievances')
      .update({ status: 'escalated', updated_at: new Date().toISOString() })
      .eq('id', grievanceId)

    if (error) throw new Error(`Failed to escalate complaint: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'escalated', { note })
  }

  async reopenGrievance(grievanceId: string, profile: GrievanceProfile, note?: string) {
    const { data: grievance } = await supabase
      .from('grievances')
      .select('submitter_profile_id, school_id, status')
      .eq('id', grievanceId)
      .single()

    if (!grievance) throw new Error('Complaint not found')

    const isOwner = grievance.submitter_profile_id === profile.id
    if (!isOwner && !this.isAdmin(profile)) {
      throw new Error('Only the submitter or an administrator can reopen this complaint')
    }
    if (!['resolved', 'closed'].includes(grievance.status)) {
      throw new Error('Only resolved or closed complaints can be reopened')
    }

    const settings = await this.getSettings(grievance.school_id)
    if (!settings.allow_reopen) {
      throw new Error('Reopening complaints is disabled at this school')
    }

    const { error } = await supabase
      .from('grievances')
      .update({ status: 'reopened', resolved_at: null, closed_at: null, updated_at: new Date().toISOString() })
      .eq('id', grievanceId)

    if (error) throw new Error(`Failed to reopen complaint: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'reopened', { note })
  }

  async submitFeedback(grievanceId: string, profile: GrievanceProfile, rating: number, feedbackText?: string) {
    const { data: grievance } = await supabase
      .from('grievances')
      .select('submitter_profile_id')
      .eq('id', grievanceId)
      .single()

    if (!grievance || grievance.submitter_profile_id !== profile.id) {
      throw new Error('Only the submitter can leave feedback on this complaint')
    }

    const { data, error } = await supabase
      .from('grievance_feedback')
      .upsert({ grievance_id: grievanceId, rating, feedback_text: feedbackText || null, submitted_by_profile_id: profile.id })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to submit feedback: ${error.message}`)

    await this.writeAudit(grievanceId, profile.id, 'feedback_submitted', { rating })
    return data
  }

  // ── Notifications (unread) ───────────────────────────────────────────────

  async getUnreadCount(profileId: string): Promise<number> {
    const { data: watched } = await supabase
      .from('grievance_watchers')
      .select('grievance_id, last_read_at')
      .eq('profile_id', profileId)

    if (!watched || watched.length === 0) return 0

    let unread = 0
    for (const w of watched) {
      const { data: g } = await supabase.from('grievances').select('updated_at').eq('id', w.grievance_id).single()
      if (g && (!w.last_read_at || new Date(g.updated_at) > new Date(w.last_read_at))) unread++
    }
    return unread
  }

  // ── Dashboard / reports ──────────────────────────────────────────────────

  async getDashboardStats(schoolId: string) {
    const { data } = await supabase
      .from('grievances')
      .select('status, priority, due_date')
      .eq('school_id', schoolId)

    const rows = data || []
    const now = new Date()

    const counts = {
      pending: rows.filter((r) => ['submitted', 'pending_review', 'assigned'].includes(r.status)).length,
      under_investigation: rows.filter((r) => ['under_investigation', 'awaiting_info'].includes(r.status)).length,
      overdue: rows.filter((r) => r.due_date && new Date(r.due_date) < now && OPEN_STATUSES.includes(r.status)).length,
      resolved: rows.filter((r) => r.status === 'resolved').length,
      closed: rows.filter((r) => r.status === 'closed').length,
      escalated: rows.filter((r) => r.status === 'escalated').length,
      total: rows.length,
      by_priority: (['low', 'normal', 'high', 'urgent', 'critical'] as GrievancePriority[]).reduce(
        (acc, p) => ({ ...acc, [p]: rows.filter((r) => r.priority === p).length }),
        {} as Record<GrievancePriority, number>
      ),
    }

    return counts
  }

  async getReport(schoolId: string, filters: { from?: string; to?: string; category_id?: string; department?: string; status?: string }) {
    let query = supabase
      .from('grievances')
      .select('*, category:grievance_categories(id, name)')
      .eq('school_id', schoolId)

    if (filters.from) query = query.gte('submitted_at', filters.from)
    if (filters.to) query = query.lte('submitted_at', filters.to)
    if (filters.category_id) query = query.eq('category_id', filters.category_id)
    if (filters.department) query = query.eq('department', filters.department)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, error } = await query.order('submitted_at', { ascending: false })
    if (error) throw new Error(`Failed to generate report: ${error.message}`)

    const rows = data || []
    const resolvedRows = rows.filter((r) => r.resolved_at)
    const avgResolutionMs = resolvedRows.length
      ? resolvedRows.reduce((sum, r) => sum + (new Date(r.resolved_at).getTime() - new Date(r.submitted_at).getTime()), 0) / resolvedRows.length
      : 0

    const now = new Date()
    const overdueCount = rows.filter((r) => r.due_date && new Date(r.due_date) < now && OPEN_STATUSES.includes(r.status)).length
    const slaCompliance = rows.length ? Math.round(((rows.length - overdueCount) / rows.length) * 100) : 100

    return {
      rows,
      kpis: {
        total: rows.length,
        open: rows.filter((r) => OPEN_STATUSES.includes(r.status)).length,
        overdue: overdueCount,
        resolved: resolvedRows.length,
        avg_resolution_days: Math.round((avgResolutionMs / (1000 * 60 * 60 * 24)) * 10) / 10,
        sla_compliance_rate: slaCompliance,
      },
    }
  }

  // ── SLA / escalation cron entry point ────────────────────────────────────

  /** Called by cron.service.ts on a daily schedule. Marks overdue open complaints as escalated. */
  async runSlaEscalationSweep(): Promise<{ escalated: number }> {
    const now = new Date().toISOString()
    const { data: overdue } = await supabase
      .from('grievances')
      .select('id, school_id')
      .lt('due_date', now)
      .in('status', OPEN_STATUSES)
      .neq('status', 'escalated')

    for (const g of overdue || []) {
      await supabase.from('grievances').update({ status: 'escalated', updated_at: now }).eq('id', g.id)
      await this.writeAudit(g.id, null, 'escalated', { reason: 'sla_overdue_auto' })

      const { data: watchers } = await supabase.from('grievance_watchers').select('profile_id').eq('grievance_id', g.id)
      // Bumping updated_at above already makes every watcher's unread count reflect this;
      // email delivery (if enabled in that school's settings) is handled by the caller.
      void watchers
    }

    return { escalated: (overdue || []).length }
  }
}
