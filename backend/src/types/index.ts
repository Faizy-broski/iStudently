export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent'
export type SchoolStatus = 'active' | 'suspended'

export interface Profile {
  id: string
  school_id: string | null
  role: UserRole
  first_name: string | null
  last_name: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface School {
  id: string
  name: string
  slug: string
  status: SchoolStatus
  logo_url: string | null
  website: string | null
  contact_email: string
  address: string | null
  settings?: {
    grading_scale: number
    currency: string
    library: {
      max_books: number
      fine_per_day: number
    }
  }
  modules?: {
    food_service: boolean
    discipline: boolean
    billing: boolean
    activities: boolean
  }
  created_at: string
  updated_at: string
}

export interface CreateSchoolDTO {
  name: string
  slug: string
  contact_email: string
  address?: string
  website?: string
  logo_url?: string
  settings?: School['settings']
  modules?: School['modules']
}

export interface UpdateSchoolDTO {
  name?: string
  contact_email?: string
  address?: string
  website?: string
  logo_url?: string
  status?: SchoolStatus
}

export interface SchoolStats {
  total_schools: number
  active_schools: number
  suspended_schools: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
