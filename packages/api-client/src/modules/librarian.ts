// The signed-in librarian / staff member's own staff record (backend/src/routes/staff.routes.ts, GET /staff/me).
import type { ApiClient } from '../client'

export interface MyStaffRecord {
  id: string
  employee_number: string | null
  title: string | null
  department: string | null
  qualifications: string[] | null
  specialization: string | null
  date_of_joining: string | null
  employment_type: string | null
  is_active: boolean
}

export function librarianApi(api: ApiClient) {
  return {
    myStaffRecord: () => api.get<MyStaffRecord>('/staff/me'),
  }
}
