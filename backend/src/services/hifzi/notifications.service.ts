import { supabase } from '../../config/supabase'
import { pushNotificationsService } from '../push-notifications.service'

// ============================================================================
// Hifzi's own notifications table (hifzi_notifications), mirroring fina's
// pattern of rolling its own rather than expecting a shared cross-module
// bus. Phase 1 ships in-app + Web Push ONLY (per product decision) — no
// WhatsApp/SMS gateway exists yet anywhere in this codebase
// (notification-providers/index.ts's LogOnlyProvider is a stub). The
// `channel: 'whatsapp'` value stays valid in the schema for when a gateway
// is procured, but this service never sends through it yet.
// ============================================================================

export interface NotifyDTO {
  schoolId: string
  recipientProfileId: string
  title: string
  body: string
  relatedEntityType?: string
  relatedEntityId?: string
  url?: string
}

class HifziNotificationsService {
  /** Writes the notification row and best-effort delivers it via Web Push. In-app read state is tracked via read_at regardless of push delivery success. */
  async notify(dto: NotifyDTO): Promise<void> {
    const { data: row, error } = await supabase
      .from('hifzi_notifications')
      .insert({
        school_id: dto.schoolId,
        recipient_profile_id: dto.recipientProfileId,
        channel: 'push',
        title: dto.title,
        body: dto.body,
        related_entity_type: dto.relatedEntityType ?? null,
        related_entity_id: dto.relatedEntityId ?? null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to write hifzi_notifications row:', error)
      return
    }

    try {
      await pushNotificationsService.sendToProfile(dto.recipientProfileId, { title: dto.title, body: dto.body, url: dto.url })
      await supabase.from('hifzi_notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id)
    } catch (err) {
      console.error('Failed to push-deliver hifzi_notifications row:', err)
      await supabase.from('hifzi_notifications').update({ status: 'failed' }).eq('id', row.id)
    }
  }

  async notifyRecitationRecorded(schoolId: string, guardianProfileId: string, studentName: string, gradeCode: string) {
    return this.notify({
      schoolId,
      recipientProfileId: guardianProfileId,
      title: 'تسجيل تسميع جديد',
      body: `تم تسجيل تسميع لـ ${studentName} — التقدير: ${gradeCode}`,
      relatedEntityType: 'hifzi_session',
    })
  }

  async notifyAbsence(schoolId: string, guardianProfileId: string, studentName: string, circleName: string) {
    return this.notify({
      schoolId,
      recipientProfileId: guardianProfileId,
      title: 'تنبيه غياب',
      body: `لم يتم تسجيل حضور ${studentName} في حلقة ${circleName}`,
      relatedEntityType: 'hifzi_attendance',
    })
  }

  /** Ministerial Decree 1205 compliance: a structural-unit or syllabus-grade completion — see milestones.service.ts, which calls this once per newly-recorded row in hifzi_milestones_log (that table's UNIQUE constraint is what makes "once" true, not this method). */
  async notifyMilestone(schoolId: string, guardianProfileId: string, studentName: string, milestoneLabel: string, milestoneId: string) {
    return this.notify({
      schoolId,
      recipientProfileId: guardianProfileId,
      title: 'إنجاز جديد',
      body: `أتم ${studentName} حفظ ${milestoneLabel}`,
      relatedEntityType: 'hifzi_milestone',
      relatedEntityId: milestoneId,
    })
  }

  async listForProfile(profileId: string, limit = 30) {
    const { data, error } = await supabase
      .from('hifzi_notifications')
      .select('*')
      .eq('recipient_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`)
    return data || []
  }

  async markRead(notificationId: string, profileId: string) {
    const { error } = await supabase
      .from('hifzi_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_profile_id', profileId)

    if (error) throw new Error(`Failed to mark notification read: ${error.message}`)
  }
}

export const hifziNotificationsService = new HifziNotificationsService()
