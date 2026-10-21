// School admin: campuses (backend/src/routes/setup-status.routes.ts, mounted at /setup).
// A campus is a `schools` row whose parent_school_id is the admin's school. The selected campus
// is sent per endpoint as campus_id (query or body), like the web; never X-School-Id.
import type { ApiClient } from '../../client'
import type { ApiResponse } from '../../types'

export interface Campus {
  id: string
  name: string
  slug?: string | null
  parent_school_id?: string | null
  status?: string | null
  logo_url?: string | null
  logo_shape?: 'circle' | 'rounded' | 'square' | 'rectangle' | null
  logo_frame_color?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  phone?: string | null
  contact_email?: string | null
  principal_name?: string | null
  website?: string | null
  short_name?: string | null
  school_number?: string | null
  latitude?: number | null
  longitude?: number | null
  custom_fields?: Record<string, unknown> | null
}

export interface CampusStats {
  total_students: number
  boys_count: number
  girls_count: number
  total_teachers: number
  male_teachers: number
  female_teachers: number
  total_staff: number
  male_staff: number
  female_staff: number
  total_parents: number
  total_grade_levels: number
  total_sections: number
  present_today: number
  attendance_percentage_today: number
}

export type CampusUpdate = Partial<Pick<Campus, 'name' | 'address' | 'city' | 'state' | 'zip_code' | 'phone' | 'contact_email' | 'principal_name' | 'short_name' | 'school_number' | 'latitude' | 'longitude' | 'custom_fields' | 'logo_url'>>

/** POST/PUT /setup/campuses answer with the bare row instead of { data }: move it into data. */
function bareRow(r: ApiResponse<Campus>): ApiResponse<Campus> {
  if (!r.success || r.data) return r
  const { success: _s, status, ...row } = r as ApiResponse<Campus> & Record<string, unknown>
  return { success: true, status, data: row as unknown as Campus }
}

/** First-run setup state (GET /setup/status answers with the bare object). */
export interface SetupStatus {
  hasCampuses: boolean
  hasAcademicYear: boolean
  isComplete: boolean
  campusCount: number
  academicYearCount: number
}

export function campusesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** Active branch campuses of the admin's school (admin/librarian). */
    list: () => api.get<Campus[]>('/setup/campuses'),
    /** Web DashboardLayout sends admins to /admin/setup until this says isComplete. */
    setupStatus: async (): Promise<ApiResponse<SetupStatus>> => {
      const r = await api.get<SetupStatus>('/setup/status')
      if (!r.success || r.data) return r
      const { success: _s, status, ...row } = r as ApiResponse<SetupStatus> & Record<string, unknown>
      return { success: true, status, data: row as unknown as SetupStatus }
    },
    /** One campus (any role, used for staff locked to their own campus). */
    get: (campusId: string) => api.get<Campus>(`/setup/campuses/${id(campusId)}`),
    create: async (body: CampusUpdate & { name: string }) => bareRow(await api.post<Campus>('/setup/campuses', body)),
    remove: (campusId: string) => api.del<void>(`/setup/campuses/${id(campusId)}`),
    /** The admin's school and its campuses (copy-settings sources). */
    mySchools: () => api.get<{ id: string; name: string }[]>('/schools/my-schools'),
    stats: (campusId: string) => api.get<CampusStats>(`/setup/campuses/${id(campusId)}/stats`),
    update: async (campusId: string, body: CampusUpdate) => bareRow(await api.put<Campus>(`/setup/campuses/${id(campusId)}`, body)),
  }
}

export type CampusesApi = ReturnType<typeof campusesApi>
