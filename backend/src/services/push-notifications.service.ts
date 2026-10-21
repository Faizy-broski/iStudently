import webpush from 'web-push'
import { supabase } from '../config/supabase'
import { isExpoPushToken, sendExpoPush } from './expo-push.service'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:support@istudent.ly'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
} else {
  console.warn('⚠️  VAPID keys not configured — push notifications are disabled')
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

export interface CreatePushSubscriptionDTO {
  profileId: string
  schoolId: string
  campusId?: string | null
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

class PushNotificationsService {
  isConfigured(): boolean {
    return !!(vapidPublicKey && vapidPrivateKey)
  }

  getPublicKey(): string | null {
    return vapidPublicKey || null
  }

  async subscribe(dto: CreatePushSubscriptionDTO): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          profile_id: dto.profileId,
          school_id: dto.schoolId,
          campus_id: dto.campusId ?? null,
          endpoint: dto.endpoint,
          p256dh: dto.p256dh,
          auth: dto.auth,
          user_agent: dto.userAgent ?? null,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) throw new Error(`Failed to save push subscription: ${error.message}`)
  }

  async unsubscribe(profileId: string, endpoint: string): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('profile_id', profileId)
      .eq('endpoint', endpoint)

    if (error) throw new Error(`Failed to remove push subscription: ${error.message}`)
  }

  /** Sends to every active subscription for a single profile. */
  async sendToProfile(profileId: string, payload: PushPayload): Promise<void> {
    await this.sendToProfiles([profileId], payload)
  }

  /** Sends to every active subscription across a list of profiles. */
  async sendToProfiles(profileIds: string[], payload: PushPayload): Promise<void> {
    if (profileIds.length === 0) return

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, profile_id, endpoint, p256dh, auth')
      .in('profile_id', profileIds)
      .eq('is_active', true)

    if (error) console.error('Failed to fetch push subscriptions:', error.message)

    await Promise.all([this.dispatch(error ? [] : subscriptions || [], payload), this.dispatchToPhones(profileIds, payload)])
  }

  /** Registers (or re-activates) this phone's Expo push token for the signed-in user. */
  async registerDevice(dto: { profileId: string; schoolId: string | null; token: string; platform: 'ios' | 'android'; deviceName?: string | null; appVersion?: string | null }): Promise<void> {
    if (!isExpoPushToken(dto.token)) throw new Error('Invalid push token')
    const { error } = await supabase.from('mobile_push_tokens').upsert(
      {
        profile_id: dto.profileId,
        school_id: dto.schoolId,
        token: dto.token,
        platform: dto.platform,
        device_name: dto.deviceName ?? null,
        app_version: dto.appVersion ?? null,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      // A token moves to whoever signs in on that phone.
      { onConflict: 'token' },
    )
    if (error) throw new Error(`Failed to save push token: ${error.message}`)
  }

  /** Stops push to this phone for the user (sign-out, or push turned off in Settings). */
  async unregisterDevice(profileId: string, token: string): Promise<void> {
    const { error } = await supabase.from('mobile_push_tokens').update({ is_active: false }).eq('profile_id', profileId).eq('token', token)
    if (error) throw new Error(`Failed to remove push token: ${error.message}`)
  }

  private async dispatchToPhones(profileIds: string[], payload: PushPayload): Promise<number> {
    const { data, error } = await supabase.from('mobile_push_tokens').select('token').in('profile_id', profileIds).eq('is_active', true)
    if (error) {
      // Table not created yet (mobile_push_tokens.sql): phones simply get nothing.
      if (error.code !== 'PGRST205' && error.code !== '42P01') console.error('Failed to fetch phone push tokens:', error.message)
      return 0
    }
    const tokens = (data || []).map((r) => r.token as string)
    if (!tokens.length) return 0
    const dead = await sendExpoPush(tokens, { title: payload.title, body: payload.body, url: payload.url })
    if (dead.length) await supabase.from('mobile_push_tokens').update({ is_active: false }).in('token', dead)
    return tokens.length
  }

  /** Active subscription counts for a school (optionally scoped to a campus), broken down by role. */
  async getStats(schoolId: string, campusId?: string | null): Promise<{ configured: boolean; total: number; byRole: Record<string, number> }> {
    let query = supabase
      .from('push_subscriptions')
      .select('profile_id, profiles(role)')
      .eq('school_id', schoolId)
      .eq('is_active', true)

    // Include school-wide subscriptions (campus_id IS NULL, e.g. from admins who
    // aren't tied to a specific campus) alongside subscriptions for this campus.
    if (campusId) query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)

    const { data, error } = await query
    if (error) throw new Error(`Failed to load push subscription stats: ${error.message}`)

    const byRole: Record<string, number> = {}
    for (const row of data || []) {
      const role = (row as any).profiles?.role ?? 'unknown'
      byRole[role] = (byRole[role] || 0) + 1
    }

    return { configured: this.isConfigured(), total: (data || []).length, byRole }
  }

  /** Sends a test notification to every active subscription belonging to one profile. */
  async sendTest(profileId: string): Promise<{ sent: number }> {
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('id, profile_id, endpoint, p256dh, auth')
      .eq('profile_id', profileId)
      .eq('is_active', true)

    if (error) throw new Error(`Failed to load subscriptions: ${error.message}`)

    const payload = { title: 'Test Notification', body: 'This is a test push notification from Studently.' }
    const [, phones] = await Promise.all([this.dispatch(subscriptions || [], payload), this.dispatchToPhones([profileId], payload)])
    return { sent: (subscriptions || []).length + phones }
  }

  /** Sends to every active subscription for a given role within a school. */
  async sendToRole(schoolId: string, role: string, payload: PushPayload): Promise<void> {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role', role)

    if (profilesError) {
      console.error('Failed to resolve profiles for role push:', profilesError.message)
      return
    }

    const profileIds = (profiles || []).map((p) => p.id)
    await this.sendToProfiles(profileIds, payload)
  }

  /** Sends to every active subscription for a set of roles within a school — "notify everyone at a school." */
  async sendToSchool(schoolId: string, roles: string[], payload: PushPayload): Promise<void> {
    await Promise.all(roles.map((role) => this.sendToRole(schoolId, role, payload)))
  }

  private async dispatch(
    subscriptions: { id: string; profile_id: string; endpoint: string; p256dh: string; auth: string }[],
    payload: PushPayload
  ): Promise<void> {
    console.log(`[push] dispatch: configured=${this.isConfigured()} subscriptions=${subscriptions.length}`)
    if (!this.isConfigured() || subscriptions.length === 0) return

    const body = JSON.stringify(payload)
    const staleIds: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        console.log(`[push] sending to subscription ${sub.id}`)
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body
          )
          console.log(`[push] sent OK to subscription ${sub.id}`)
        } catch (err: any) {
          // 404/410 = the browser revoked or expired this subscription — prune it.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            console.error(`[push] subscription ${sub.id} stale (status ${err.statusCode}), pruning. body:`, err?.body)
            staleIds.push(sub.id)
          } else {
            console.error(`[push] send failed for subscription ${sub.id}: statusCode=${err?.statusCode} message=${err?.message} body=${err?.body}`, err)
          }
        }
      })
    )

    if (staleIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }
  }
}

export const pushNotificationsService = new PushNotificationsService()
