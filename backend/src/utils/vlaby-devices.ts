import { supabase } from '../config/supabase'
import { schoolRootId, schoolScopeIds } from './campus-validation'

/**
 * VLaby concurrent-device limit. The super admin sets, per school, how many devices one user may
 * open VLaby on (`school_settings.vlaby_device_limit`, null = unlimited). A device is the id the
 * client keeps and sends as `X-Device-Id`. Super admins are exempt.
 *
 * A user keeps the first `limit` devices they registered (oldest first). A new device beyond the
 * limit is refused until the user releases one (or the super admin resets them). If the limit is
 * lowered below what a user already has, only their oldest `limit` devices stay allowed.
 */

export const DEVICE_ID_RE = /^[A-Za-z0-9-]{8,64}$/
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_DEVICE_LIMIT = 20

const DEVICE_COLUMNS = 'id, school_id, profile_id, device_id, platform, label, first_seen_at, last_seen_at'

export interface VlabyDeviceRow {
  id: string
  school_id: string
  profile_id: string
  device_id: string
  platform: string | null
  label: string | null
  first_seen_at: string
  last_seen_at: string
}

export interface DeviceView {
  id: string
  label: string | null
  platform: string | null
  first_seen_at: string
  last_seen_at: string
  is_current: boolean
}

export type DeviceCheck =
  | { allowed: true }
  | { allowed: false; code: 'VLABY_DEVICE_LIMIT' | 'VLABY_DEVICE_ID_REQUIRED'; limit: number; devices: DeviceView[] }

/** True when the error means the migration has not been run yet (missing table or column). */
export function isMissingSchema(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code && ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(e.code)) return true
  return /schema cache|does not exist/i.test(e.message ?? '')
}

let warnedMissing = false
function warnMissingOnce(): void {
  if (warnedMissing) return
  warnedMissing = true
  console.warn('[vlaby-devices] vlaby_devices table or school_settings.vlaby_device_limit is missing: run backend/migrations/vlaby_devices.sql. Device limit is NOT enforced until then.')
}

/** Short label and platform from a User-Agent, e.g. { label: 'Chrome on Android', platform: 'android' }. */
export function describeDevice(userAgent?: string | null): { label: string; platform: string } {
  const ua = userAgent ?? ''
  let os = 'Unknown'
  let platform = 'unknown'
  if (/Android/i.test(ua)) { os = 'Android'; platform = 'android' }
  else if (/iPhone|iPad|iPod|iOS/i.test(ua)) { os = 'iOS'; platform = 'ios' }
  else if (/Windows/i.test(ua)) { os = 'Windows'; platform = 'windows' }
  else if (/CrOS/i.test(ua)) { os = 'ChromeOS'; platform = 'chromeos' }
  else if (/Mac OS X|Macintosh/i.test(ua)) { os = 'macOS'; platform = 'macos' }
  else if (/Linux/i.test(ua)) { os = 'Linux'; platform = 'linux' }

  let browser = 'Browser'
  if (/Studently|okhttp|ReactNative|Expo/i.test(ua)) browser = 'Studently app'
  else if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Chrome\/|CriOS/i.test(ua)) browser = 'Chrome'
  else if (/Safari\//i.test(ua)) browser = 'Safari'

  return { label: os === 'Unknown' && browser === 'Browser' ? 'Unknown device' : `${browser} on ${os}`, platform }
}

export function toView(row: VlabyDeviceRow, currentDeviceId?: string | null): DeviceView {
  return {
    id: row.id,
    label: row.label,
    platform: row.platform,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    is_current: !!currentDeviceId && row.device_id === currentDeviceId,
  }
}

/** The limit that applies to a school: its own setting, else its main school's. null = unlimited. */
export async function getVlabyDeviceLimit(schoolId: string): Promise<number | null> {
  const root = await schoolRootId(schoolId)
  const ids = [...new Set([schoolId, root].filter((x): x is string => !!x))]
  for (const id of ids) {
    const { data, error } = await supabase
      .from('school_settings')
      .select('vlaby_device_limit')
      .eq('school_id', id)
      .is('campus_id', null)
      .maybeSingle()
    if (error) throw error
    const limit = (data as { vlaby_device_limit?: number | null } | null)?.vlaby_device_limit
    if (typeof limit === 'number') return limit
  }
  return null
}

/** Sets (or clears, with null) a school's limit. Throws on a missing column (migration not run). */
export async function setVlabyDeviceLimit(schoolId: string, limit: number | null): Promise<void> {
  const { data: existing, error: findErr } = await supabase
    .from('school_settings')
    .select('id')
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .maybeSingle()
  if (findErr) throw findErr
  if (existing?.id) {
    const { error } = await supabase.from('school_settings').update({ vlaby_device_limit: limit }).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('school_settings').insert({ school_id: schoolId, campus_id: null, vlaby_device_limit: limit })
    if (error) throw error
  }
}

/** A user's registered devices, oldest registration first. */
export async function listUserDevices(profileId: string): Promise<VlabyDeviceRow[]> {
  const { data, error } = await supabase
    .from('vlaby_devices')
    .select(DEVICE_COLUMNS)
    .eq('profile_id', profileId)
    .order('first_seen_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as VlabyDeviceRow[]
}

/**
 * Called before VLaby experiments open. Registers the device if it fits, otherwise refuses with the
 * user's device list. Fails open only when the migration has not been run.
 */
export async function checkAndRegisterDevice(input: {
  schoolId: string | null | undefined
  profileId: string
  role: string
  deviceId: string | null | undefined
  userAgent?: string | null
}): Promise<DeviceCheck> {
  const { schoolId, profileId, role, userAgent } = input
  if (role === 'super_admin' || !schoolId) return { allowed: true }

  try {
    const limit = await getVlabyDeviceLimit(schoolId)
    if (limit === null) return { allowed: true }

    const deviceId = input.deviceId && DEVICE_ID_RE.test(input.deviceId) ? input.deviceId : null
    const devices = await listUserDevices(profileId)

    if (!deviceId) {
      return { allowed: false, code: 'VLABY_DEVICE_ID_REQUIRED', limit, devices: devices.map((d) => toView(d)) }
    }

    const index = devices.findIndex((d) => d.device_id === deviceId)
    if (index >= 0) {
      if (index >= limit) {
        return { allowed: false, code: 'VLABY_DEVICE_LIMIT', limit, devices: devices.map((d) => toView(d, deviceId)) }
      }
      const { error } = await supabase.from('vlaby_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', devices[index].id)
      if (error) throw error
      return { allowed: true }
    }

    if (devices.length >= limit) {
      return { allowed: false, code: 'VLABY_DEVICE_LIMIT', limit, devices: devices.map((d) => toView(d, deviceId)) }
    }

    const { label, platform } = describeDevice(userAgent)
    const { data: inserted, error: insertErr } = await supabase
      .from('vlaby_devices')
      .insert({ school_id: schoolId, profile_id: profileId, device_id: deviceId, platform, label, user_agent: (userAgent ?? '').slice(0, 300) || null })
      .select('id')
      .single()
    if (insertErr) {
      // Two requests from the same new device at once: the second hits the unique key, which is fine.
      if (insertErr.code === '23505') return { allowed: true }
      throw insertErr
    }

    // Two different new devices racing past the count: keep the earlier one, drop this one.
    const after = await listUserDevices(profileId)
    if (after.length > limit && after.findIndex((d) => d.id === (inserted as { id: string }).id) >= limit) {
      await supabase.from('vlaby_devices').delete().eq('id', (inserted as { id: string }).id)
      return { allowed: false, code: 'VLABY_DEVICE_LIMIT', limit, devices: after.filter((d) => d.id !== (inserted as { id: string }).id).map((d) => toView(d, deviceId)) }
    }
    return { allowed: true }
  } catch (err) {
    if (isMissingSchema(err)) {
      warnMissingOnce()
      return { allowed: true }
    }
    throw err
  }
}

/** Deletes one of the user's own devices. False when it is not theirs (or does not exist). */
export async function releaseOwnDevice(profileId: string, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const { data, error } = await supabase.from('vlaby_devices').delete().eq('id', id).eq('profile_id', profileId).select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

export interface AdminDeviceRow extends VlabyDeviceRow {
  user_name: string
  role: string | null
}

/** Super admin: newest-first devices of a school and its campuses (max 500) with the user's name. */
export async function listSchoolDevices(schoolId: string): Promise<AdminDeviceRow[]> {
  const scope = await schoolScopeIds(schoolId)
  const { data, error } = await supabase
    .from('vlaby_devices')
    .select(DEVICE_COLUMNS)
    .in('school_id', scope)
    .order('last_seen_at', { ascending: false })
    .limit(500)
  if (error) throw error
  const rows = (data ?? []) as VlabyDeviceRow[]
  const ids = [...new Set(rows.map((r) => r.profile_id))]
  const people = new Map<string, { name: string; role: string | null }>()
  if (ids.length) {
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, first_name, last_name, role').in('id', ids)
    if (pErr) throw pErr
    for (const p of (profiles ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; role: string | null }>) {
      people.set(p.id, { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(), role: p.role })
    }
  }
  return rows.map((r) => ({ ...r, user_name: people.get(r.profile_id)?.name ?? '', role: people.get(r.profile_id)?.role ?? null }))
}

/** Super admin: delete one device row. False when it does not exist. */
export async function removeDevice(id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false
  const { data, error } = await supabase.from('vlaby_devices').delete().eq('id', id).select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

/** Super admin: free every slot of one user within a school (and its campuses). Returns rows removed. */
export async function resetUserDevices(schoolId: string, profileId: string): Promise<number> {
  const scope = await schoolScopeIds(schoolId)
  const { data, error } = await supabase.from('vlaby_devices').delete().eq('profile_id', profileId).in('school_id', scope).select('id')
  if (error) throw error
  return (data ?? []).length
}
