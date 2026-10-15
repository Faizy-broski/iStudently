// Staff designations / job titles (backend/src/routes/staff-designation.routes.ts, /staff-designations).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface StaffDesignation {
  id: string
  campus_id: string | null
  name: string
  description: string | null
  /** Built-in: can be switched off but not deleted. */
  is_system: boolean
  is_active: boolean
}

export function adminDesignationsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** Campus-specific and school-wide designations. */
    list: (campusId?: string) => api.get<StaffDesignation[]>(`/staff-designations${qs({ campus_id: campusId })}`),
    create: (input: { name: string; description?: string; campus_id?: string | null }) => api.post<StaffDesignation>('/staff-designations', input),
    update: (designationId: string, input: { name?: string; description?: string; is_active?: boolean }) =>
      api.put<StaffDesignation>(`/staff-designations/${id(designationId)}`, input),
    remove: (designationId: string) => api.del<void>(`/staff-designations/${id(designationId)}`),
    /** Adds the default designations if the school has none. */
    seedDefaults: () => api.post<unknown>('/staff-designations/seed'),
  }
}
