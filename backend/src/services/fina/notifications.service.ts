import { supabase } from '../../config/supabase'
import { pushNotificationsService } from '../push-notifications.service'
import { getGuardianProfileIdsForStudent } from './access-policy.service'
import { CallerContext } from './types'

/**
 * Notification fan-out (spec §14). `channels` is data-driven per row (see
 * 246_create_fina_notifications.sql) — every place the spec marks a channel
 * "immutable" (absence, emergency) still only sends push+in-app in this
 * build, since no SMS gateway exists yet (approved deviation); the channel
 * list on each row is already what a later SMS integration would extend,
 * no schema change needed then.
 *
 * The DB write is awaited (it's the actual notification record — in-app
 * "read" state depends on it existing). The push SEND is fire-and-forget
 * (`.catch()`, never awaited), matching this session's established
 * convention everywhere else push is used — a slow/failed push must never
 * block or fail the caller's own request.
 */

export interface NotifyInput {
  schoolId: string
  userId: string
  type: string
  payload?: Record<string, unknown>
  pushTitle?: string
  pushBody?: string
  channels?: string[]
}

export async function notify(input: NotifyInput): Promise<void> {
  const channels = input.channels ?? ['push', 'in_app']
  const { error } = await supabase.from('fina_notifications').insert({
    school_id: input.schoolId,
    user_id: input.userId,
    type: input.type,
    payload: input.payload ?? {},
    channels,
  })
  if (error) console.error('Failed to record fina_notification:', error)

  if (channels.includes('push') && input.pushTitle) {
    pushNotificationsService
      .sendToProfile(input.userId, { title: input.pushTitle, body: input.pushBody || '' })
      .catch((err) => console.error('fina notification push send failed:', err))
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<void> {
  await Promise.all([...new Set(userIds)].map((userId) => notify({ ...input, userId })))
}

/** Spec §14: absence alert, ≤15min SLA — wired to an event listener on the
 * attendance-marking write path (see fina-attendance-absence.listener.ts),
 * never the platform's existing 5-minute attendance cron. */
export async function notifyAbsence(schoolId: string, studentId: string, studentName: string, date: string): Promise<void> {
  const guardianProfileIds = await getGuardianProfileIdsForStudent(studentId)
  await notifyMany(guardianProfileIds, {
    schoolId,
    type: 'absence',
    payload: { studentId, studentName, date },
    pushTitle: 'The School Wall',
    pushBody: `${studentName} was not present today (${date}). If there is an excuse, please contact the school.`,
  })
}

/** Notifies the principal that a student's consent was withdrawn — spec
 * §8.4: "notify the principal — WITHOUT naming the student." */
export async function notifyConsentWithdrawnToPrincipal(schoolId: string): Promise<void> {
  const { data: principals, error } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'admin')
  if (error) {
    console.error('Failed to resolve principals for consent-withdrawal notice:', error)
    return
  }
  await notifyMany(
    (principals || []).map((p) => p.id),
    {
      schoolId,
      type: 'consent_withdrawn',
      pushTitle: 'The School Wall',
      pushBody: 'A guardian withdrew consent for a student\'s photos. The archive is being updated.',
    }
  )
}

/** Notifies media officers a submission was auto-blocked — spec §14's
 * "Blocked publish attempt (to officer)". In-app only per spec (no push
 * listed for this one). */
export async function notifyPublishBlockedToOfficers(schoolId: string, postId: string, reason: string): Promise<void> {
  const { data: officers, error } = await supabase.from('profiles').select('id').eq('school_id', schoolId).eq('role', 'media_officer')
  if (error) {
    console.error('Failed to resolve media officers for blocked-publish notice:', error)
    return
  }
  await notifyMany(
    (officers || []).map((o) => o.id),
    { schoolId, type: 'publish_blocked', payload: { postId, reason }, channels: ['in_app'] }
  )
}

/** Notifies guardians whose ward is implicated by a newly published post —
 * spec §14 "New post involving the ward". Recipients are whichever
 * guardians match the post's own audience (school-wide -> every guardian at
 * the school; classes/students -> only guardians of students in scope). */
export async function notifyNewPost(schoolId: string, recipientProfileIds: string[], postType: string): Promise<void> {
  await notifyMany(recipientProfileIds, {
    schoolId,
    type: 'new_post',
    payload: { postType },
    pushTitle: 'The School Wall',
    pushBody: 'A new post was published for your child\'s class.',
  })
}

/** Spec §7.6/§22: the nightly chain-verify job's own alert on a break —
 * "the specific thing a regulator will ask you to demonstrate". The chain
 * is a single GLOBAL ledger (not per-school), so this notifies every
 * super_admin profile that has a school_id to attach the in-app row to,
 * and ALWAYS logs loudly server-side regardless — a broken audit chain is
 * the most severe integrity event this platform can produce and must never
 * depend solely on an in-app notification being seen. */
export async function notifyAuditChainBroken(brokenAtSeq: number): Promise<void> {
  console.error(`CRITICAL: fina_audit_log hash chain is broken at seq=${brokenAtSeq}. Tamper or corruption suspected.`)
  const { data: superAdmins, error } = await supabase.from('profiles').select('id, school_id').eq('role', 'super_admin')
  if (error) {
    console.error('Failed to resolve super_admins for audit-chain-broken alert:', error)
    return
  }
  await Promise.all(
    (superAdmins || [])
      .filter((p) => p.school_id)
      .map((p) =>
        notify({
          schoolId: p.school_id as string,
          userId: p.id,
          type: 'audit_chain_broken',
          payload: { brokenAtSeq },
          channels: ['in_app'],
        })
      )
  )
}

// ── In-app notification list (the bell) ────────────────────────────────────

export async function listMyNotifications(caller: CallerContext, limit = 30) {
  const { data, error } = await supabase
    .from('fina_notifications')
    .select('*')
    .eq('user_id', caller.profileId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to load notifications: ${error.message}`)
  return data || []
}

export async function countUnreadNotifications(caller: CallerContext): Promise<number> {
  const { count, error } = await supabase
    .from('fina_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', caller.profileId)
    .is('read_at', null)
  if (error) {
    console.error('Failed to count unread notifications:', error)
    return 0
  }
  return count || 0
}

export async function markNotificationRead(caller: CallerContext, notificationId: string) {
  const { data, error } = await supabase
    .from('fina_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', caller.profileId)
    .select()
    .single()
  if (error || !data) throw new Error('Notification not found')
  return data
}

export async function markAllNotificationsRead(caller: CallerContext): Promise<void> {
  const { error } = await supabase
    .from('fina_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', caller.profileId)
    .is('read_at', null)
  if (error) throw new Error(`Failed to mark notifications read: ${error.message}`)
}
