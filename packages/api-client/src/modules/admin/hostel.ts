// Hostel: buildings, rooms, student room assignments, visitor log, rental fees.
// Same endpoints as frontend/src/lib/api/hostel.ts; router: hostel.routes.ts (admin/staff only).
// Like the web, rows are keyed by the signed-in admin's school_id (not the campus switcher);
// staff send their own campus_id.
import type { HostelBuilding, HostelRentalFee, HostelRoom, HostelRoomAssignment, HostelStats, HostelVisit } from '@studently/shared-types'

import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface HostelScope {
  schoolId: string
  campusId?: string
}

export interface HostelBuildingInput {
  name: string
  address?: string
  floors: number
  description?: string
  custom_fields: Record<string, string>
}

export interface HostelRoomInput {
  room_number: string
  floor: number
  capacity: number
  room_type: string
  price_per_month: number
  description?: string
  custom_fields: Record<string, string>
}

export interface HostelVisitInput {
  student_id: string
  visitor_name: string
  visitor_phone?: string
  visitor_relation?: string
  purpose?: string
  notes?: string
}

export function adminHostelApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    stats: (s: HostelScope) => api.get<HostelStats>(`/hostel/stats${qs({ school_id: s.schoolId })}`),

    buildings: (s: HostelScope) => api.get<HostelBuilding[]>(`/hostel/buildings${qs({ school_id: s.schoolId })}`),
    createBuilding: (s: HostelScope, body: HostelBuildingInput) => api.post<HostelBuilding>('/hostel/buildings', { ...body, school_id: s.schoolId, campus_id: s.campusId }),
    updateBuilding: (s: HostelScope, buildingId: string, body: HostelBuildingInput) =>
      api.put<HostelBuilding>(`/hostel/buildings/${id(buildingId)}${qs({ school_id: s.schoolId })}`, { ...body, campus_id: s.campusId }),
    deleteBuilding: (s: HostelScope, buildingId: string) => api.del<void>(`/hostel/buildings/${id(buildingId)}${qs({ school_id: s.schoolId })}`),

    rooms: (s: HostelScope, buildingId?: string) => api.get<HostelRoom[]>(`/hostel/rooms${qs({ school_id: s.schoolId, building_id: buildingId })}`),
    createRoom: (s: HostelScope, buildingId: string, body: HostelRoomInput) =>
      api.post<HostelRoom>('/hostel/rooms', { ...body, building_id: buildingId, school_id: s.schoolId, campus_id: s.campusId }),
    updateRoom: (s: HostelScope, roomId: string, body: HostelRoomInput) =>
      api.put<HostelRoom>(`/hostel/rooms/${id(roomId)}${qs({ school_id: s.schoolId })}`, { ...body, campus_id: s.campusId }),
    deleteRoom: (s: HostelScope, roomId: string) => api.del<void>(`/hostel/rooms/${id(roomId)}${qs({ school_id: s.schoolId })}`),

    assignments: (s: HostelScope, f: { building_id?: string; room_id?: string; active_only?: boolean } = {}) =>
      api.get<HostelRoomAssignment[]>(
        `/hostel/assignments${qs({ school_id: s.schoolId, campus_id: s.campusId, building_id: f.building_id, room_id: f.room_id, active_only: f.active_only === false ? 'false' : undefined })}`,
      ),
    assign: (s: HostelScope, body: { room_id: string; student_id: string; notes?: string }) => api.post<HostelRoomAssignment>('/hostel/assignments', { ...body, school_id: s.schoolId }),
    release: (s: HostelScope, assignmentId: string) => api.del<HostelRoomAssignment>(`/hostel/assignments/${id(assignmentId)}${qs({ campus_id: s.campusId })}`),
    studentRoom: (studentId: string) => api.get<HostelRoomAssignment | null>(`/hostel/assignments/student/${id(studentId)}`),

    visits: (s: HostelScope, f: { student_id?: string; room_id?: string; date_from?: string; date_to?: string; active_only?: boolean } = {}) =>
      api.get<HostelVisit[]>(
        `/hostel/visits${qs({ school_id: s.schoolId, campus_id: s.campusId, student_id: f.student_id, room_id: f.room_id, date_from: f.date_from, date_to: f.date_to, active_only: f.active_only ? 'true' : undefined })}`,
      ),
    createVisit: (s: HostelScope, body: HostelVisitInput) => api.post<HostelVisit>('/hostel/visits', { ...body, school_id: s.schoolId }),
    checkOut: (visitId: string) => api.patch<HostelVisit>(`/hostel/visits/${id(visitId)}/checkout`),

    fees: (s: HostelScope, f: { student_id?: string; status?: string; period_start?: string; period_end?: string } = {}) =>
      api.get<HostelRentalFee[]>(`/hostel/fees${qs({ school_id: s.schoolId, campus_id: s.campusId, ...f })}`),
    generateFees: (s: HostelScope, body: { period_start: string; period_end: string; factor: number; building_id?: string }) =>
      api.post<{ fees_created: number; total_amount: number }>('/hostel/fees/generate', { ...body, school_id: s.schoolId, campus_id: s.campusId }),
    recordPayment: (body: { fee_id: string; amount: number; notes?: string }) => api.post<HostelRentalFee>('/hostel/fees/payment', body),

    searchStudents: (s: HostelScope, f: { building_id?: string; room_id?: string }) =>
      api.get<unknown[]>(`/hostel/search/students${qs({ school_id: s.schoolId, campus_id: s.campusId, ...f })}`),
  }
}
