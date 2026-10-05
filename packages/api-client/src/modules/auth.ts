import type { ApiClient } from '../client'

export interface SchoolBranding {
  id: string
  name: string
  short_name?: string | null
  parent_school_id: string | null
  logo_url: string | null
  logo_shape?: 'circle' | 'square' | 'rounded' | 'rectangle'
  logo_border_width?: number
  logo_border_color?: string
}

export interface MyContext {
  campus_id: string | null
  school_id: string | null
  staff_id: string | null
  user_profile_id: string | null
  school: SchoolBranding | null
}

export function authApi(api: ApiClient) {
  return {
    /** POST /public/resolve-username. Returns `{ success, email }` (not wrapped in `data`). */
    async resolveUsername(username: string): Promise<string | null> {
      const res = await api.post<never>('/public/resolve-username', { username }, { public: true })
      return res.success ? ((res as { email?: string }).email ?? null) : null
    },

    /** GET /auth/me/context: school/campus ids and branding. Replaced by GET /auth/me in Sprint 2. */
    getMyContext: () => api.get<MyContext>('/auth/me/context'),

    changePassword: (newPassword: string) => api.post('/auth/change-password', { new_password: newPassword }),
  }
}
