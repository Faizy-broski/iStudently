// VLaby virtual labs: the per-user device limit (backend/src/routes/vlaby.routes.ts).
// The super admin sets the limit per school; every user manages only their own devices.
// The client must send a stable `X-Device-Id` header (8-64 chars, letters, digits, dashes) on VLaby
// experiment requests; a refused call returns HTTP 200 { success:false, code:'VLABY_DEVICE_LIMIT' |
// 'VLABY_DEVICE_ID_REQUIRED', data:{ limit, devices } }.
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface VlabyDevice {
  id: string
  label: string | null
  platform: string | null
  first_seen_at: string
  last_seen_at: string
  /** True for the device that made this request (matched by X-Device-Id). */
  is_current: boolean
}

export interface VlabyMyDevices {
  /** null = no limit for this school (or the caller is a super admin). */
  limit: number | null
  devices: VlabyDevice[]
}

/** The `data` of a refused experiment call. */
export interface VlabyDeviceRefusal {
  limit: number
  devices: VlabyDevice[]
}

export interface VlabyAdminDevice {
  id: string
  profile_id: string
  user_name: string
  role: string | null
  label: string | null
  platform: string | null
  first_seen_at: string
  last_seen_at: string
}

export function vlabyApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    // Any signed-in VLaby user
    myDevices: () => api.get<VlabyMyDevices>('/vlaby/my-devices'),
    releaseMyDevice: (deviceId: string) => api.del<void>(`/vlaby/my-devices/${id(deviceId)}`),

    // Super admin only
    deviceLimit: (schoolId: string) => api.get<{ school_id: string; limit: number | null }>(`/vlaby/device-limit${qs({ school_id: schoolId })}`),
    /** limit: whole number 1..20, or null for unlimited. */
    setDeviceLimit: (schoolId: string, limit: number | null) =>
      api.put<{ school_id: string; limit: number | null }>('/vlaby/device-limit', { school_id: schoolId, limit }),
    devices: (schoolId: string) => api.get<VlabyAdminDevice[]>(`/vlaby/devices${qs({ school_id: schoolId })}`),
    removeDevice: (deviceId: string) => api.del<void>(`/vlaby/devices/${id(deviceId)}`),
    resetUserDevices: (schoolId: string, profileId: string) =>
      api.del<{ deleted: number }>(`/vlaby/devices/user/${id(profileId)}${qs({ school_id: schoolId })}`),
  }
}
