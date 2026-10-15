// School admin: parents (backend/src/routes/parent.routes.ts, /parents). Scoped to the admin's school.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { ChildrenFeesResult } from '../parent-dashboard'

export interface Parent {
  id: string
  profile_id: string | null
  school_id: string
  occupation: string | null
  workplace: string | null
  income: string | null
  cnic: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_relation: string | null
  emergency_contact_phone: string | null
  notes: string | null
  custom_fields?: Record<string, any>
  created_at: string
  updated_at: string
  profile?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
    profile_photo_url?: string | null
    is_active: boolean
  }
  children?: { id: string; student_number?: string; relationship?: string; relation_type?: string; profile?: { first_name: string | null; last_name: string | null } }[]
}

export interface ParentInput {
  first_name: string
  last_name: string
  email?: string
  password?: string
  username?: string
  phone?: string
  occupation?: string
  workplace?: string
  income?: string
  cnic?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  country?: string
  emergency_contact_name?: string
  emergency_contact_relation?: string
  emergency_contact_phone?: string
  notes?: string
  custom_fields?: Record<string, any>
  profile_photo_url?: string
}

export type ParentRelationship = 'father' | 'mother' | 'guardian' | 'other'

export function adminParentsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (p: { page?: number; limit?: number; search?: string } = {}) => api.get<Parent[]>(`/parents${qs({ page: p.page, limit: p.limit, search: p.search })}`),
    listWithChildren: (p: { page?: number; limit?: number; search?: string } = {}) =>
      api.get<Parent[]>(`/parents/with-children${qs({ page: p.page, limit: p.limit, search: p.search })}`),
    get: (parentId: string) => api.get<Parent>(`/parents/${id(parentId)}`),
    getWithChildren: (parentId: string) => api.get<Parent>(`/parents/${id(parentId)}/children`),
    search: (query: string) => api.get<Parent[]>(`/parents/search${qs({ q: query })}`),
    /** Parent role: every linked child's invoices (web: /parent/billing/fees, All Children). */
    myChildrenFees: () => api.get<ChildrenFeesResult>('/parents/my/children/fees'),
    create: (input: ParentInput) => api.post<Parent & { credentials?: { username?: string; password?: string } }>('/parents', input),
    update: (parentId: string, input: Partial<ParentInput>) => api.put<Parent>(`/parents/${id(parentId)}`, input),
    remove: (parentId: string) => api.del<void>(`/parents/${id(parentId)}`),
    linkStudent: (parentId: string, studentId: string, relationship: ParentRelationship, isEmergencyContact = false) =>
      api.post<void>(`/parents/${id(parentId)}/link-student`, { student_id: studentId, relationship, is_emergency_contact: isEmergencyContact }),
    unlinkStudent: (parentId: string, studentId: string) => api.del<void>(`/parents/${id(parentId)}/unlink-student/${id(studentId)}`),
  }
}
