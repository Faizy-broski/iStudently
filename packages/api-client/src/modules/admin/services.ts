// School services (transport, meals, …) per campus with optional per-grade charges.
// Same endpoints as frontend/src/lib/api/services.ts; router: school-services.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type ServiceType = 'recurring' | 'one_time'
export type ChargeFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time'

export interface SchoolService {
  id: string
  school_id: string
  name: string
  code: string
  description?: string | null
  service_type: ServiceType
  charge_frequency: ChargeFrequency
  default_charge: number
  is_mandatory: boolean
  is_active: boolean
  display_order: number
  grade_charges?: { id: string; grade_level_id: string; charge_amount: number; grade_level?: { id: string; name: string } | null }[]
}

export interface SchoolServiceInput {
  name: string
  code: string
  description?: string
  service_type: ServiceType
  charge_frequency: ChargeFrequency
  default_charge: number
  is_mandatory: boolean
  display_order?: number
}

export function adminServicesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** All services of the campus, inactive included (web passes active=false). */
    list: (campusId?: string) => api.get<SchoolService[]>(`/school-services${qs({ active: 'false', campus_id: campusId })}`),
    create: (body: SchoolServiceInput, campusId?: string) => api.post<SchoolService>('/school-services', { ...body, campus_id: campusId }),
    update: (serviceId: string, body: Partial<SchoolServiceInput> & { is_active?: boolean }) => api.put<SchoolService>(`/school-services/${id(serviceId)}`, body),
    remove: (serviceId: string) => api.del<void>(`/school-services/${id(serviceId)}`),
    setGradeCharges: (serviceId: string, charges: { grade_level_id: string; charge_amount: number }[]) =>
      api.put<unknown>(`/school-services/${id(serviceId)}/grade-charges`, { charges }),
    /** Active services offered to a new student (web AddStudentForm: getServices(true, campus)). */
    active: (campusId?: string) => api.get<SchoolService[]>(`/school-services${qs({ active: 'true', campus_id: campusId })}`),
    /** Subscribe a student to services (web: subscribeStudentToServices). */
    subscribeStudent: (studentId: string, serviceIds: string[]) => api.post<unknown>(`/school-services/student/${id(studentId)}/subscribe`, { serviceIds }),
  }
}
