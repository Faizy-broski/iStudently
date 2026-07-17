import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'

// ============================================================================
// ROOMS API — classroom/lab/etc rooms used by the timetable (distinct from
// hostel_rooms, which is an unrelated dormitory-bed entity under /admin/hostel).
// Follows the same fetch + Bearer-token + { success, data, error } convention
// as `lib/api/timetable-requirements.ts`.
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type RoomType = 'classroom' | 'lab' | 'auditorium' | 'library' | 'gym' | 'office' | 'other'

export const ROOM_TYPES: RoomType[] = ['classroom', 'lab', 'auditorium', 'library', 'gym', 'office', 'other']

export interface Room {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  capacity?: number | null
  building?: string | null
  floor?: string | null
  room_type: RoomType
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface CreateRoomDTO {
  name: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: RoomType
}

export interface UpdateRoomDTO {
  name?: string
  campus_id?: string
  capacity?: number
  building?: string
  floor?: string
  room_type?: RoomType
  is_active?: boolean
}

async function authHeaders(json = true): Promise<Record<string, string>> {
  const token = await getAuthToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

export async function listRooms(campusId?: string, activeOnly = true): Promise<Room[]> {
  const headers = await authHeaders(false)
  const params = new URLSearchParams()
  if (campusId) params.append('campus_id', campusId)
  if (!activeOnly) params.append('active_only', 'false')
  const response = await fetch(`${API_URL}/rooms?${params}`, { headers })
  const result: ApiResponse<Room[]> = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to fetch rooms')
  return result.data || []
}

export async function createRoom(data: CreateRoomDTO): Promise<Room> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<Room> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to create room')
  return result.data
}

export async function updateRoom(id: string, data: UpdateRoomDTO): Promise<Room> {
  const headers = await authHeaders()
  const response = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data)
  })
  const result: ApiResponse<Room> = await response.json()
  if (!result.success || !result.data) throw new Error(result.error || 'Failed to update room')
  return result.data
}

export async function deleteRoom(id: string): Promise<void> {
  const headers = await authHeaders(false)
  const response = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'DELETE',
    headers
  })
  const result: ApiResponse = await response.json()
  if (!result.success) throw new Error(result.error || 'Failed to delete room')
}
