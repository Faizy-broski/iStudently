import crypto from 'crypto'
import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface JitsiRoom {
  id: string
  school_id: string
  campus_id: string
  owner_profile_id: string
  room_name: string
  title: string
  description?: string | null
  password?: string | null
  start_audio_only: boolean
  created_at: string
  updated_at: string
}

export interface CreateRoomDTO {
  school_id: string
  campus_id: string
  owner_profile_id: string
  title: string
  description?: string
  password?: string
  start_audio_only?: boolean
}

export type UpdateRoomDTO = Partial<Pick<CreateRoomDTO, 'title' | 'description' | 'password' | 'start_audio_only'>>

export interface WhiteboardSnapshot {
  room_id: string
  scene_data: Record<string, unknown>
  updated_at: string
  updated_by?: string | null
}

interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const generateRoomName = () => `studently-${crypto.randomUUID()}`

const isPrivileged = (role: string) => role === 'super_admin' || role === 'admin'

export async function getRoomOrThrow(roomId: string): Promise<JitsiRoom> {
  const { data, error } = await supabase
    .from('jitsi_rooms')
    .select('*')
    .eq('id', roomId)
    .single()
  if (error || !data) throw new Error('Room not found')
  return data as JitsiRoom
}

export function assertSameSchool(room: JitsiRoom, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  if (room.school_id !== caller.schoolId) throw new Error('Access denied: different school')
}

export function assertOwner(room: JitsiRoom, caller: CallerContext) {
  if (isPrivileged(caller.role)) {
    assertSameSchool(room, caller)
    return
  }
  if (room.owner_profile_id !== caller.profileId) {
    throw new Error('Access denied: not the owner of this room')
  }
}

// ============================================================================
// ROOM CRUD
// ============================================================================

export const createRoom = async (dto: CreateRoomDTO): Promise<JitsiRoom> => {
  const { data, error } = await supabase
    .from('jitsi_rooms')
    .insert({
      school_id: dto.school_id,
      campus_id: dto.campus_id,
      owner_profile_id: dto.owner_profile_id,
      room_name: generateRoomName(),
      title: dto.title,
      description: dto.description,
      password: dto.password || null,
      start_audio_only: dto.start_audio_only ?? false,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create room: ${error.message}`)
  return data as JitsiRoom
}

export const updateRoom = async (roomId: string, dto: UpdateRoomDTO, caller: CallerContext): Promise<JitsiRoom> => {
  const room = await getRoomOrThrow(roomId)
  assertOwner(room, caller)

  const { data, error } = await supabase
    .from('jitsi_rooms')
    .update({
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.password !== undefined && { password: dto.password || null }),
      ...(dto.start_audio_only !== undefined && { start_audio_only: dto.start_audio_only }),
    })
    .eq('id', roomId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to update room: ${error.message}`)
  return data as JitsiRoom
}

export const deleteRoom = async (roomId: string, caller: CallerContext): Promise<void> => {
  const room = await getRoomOrThrow(roomId)
  assertOwner(room, caller)

  const { error } = await supabase.from('jitsi_rooms').delete().eq('id', roomId)
  if (error) throw new Error(`Failed to delete room: ${error.message}`)
}

export const getRoom = async (roomId: string, caller: CallerContext): Promise<JitsiRoom & { jitsi_domain: string | null }> => {
  const room = await getRoomOrThrow(roomId)
  assertSameSchool(room, caller)

  // Resolve the school's custom Jitsi domain here (rather than via the
  // admin-only school-settings endpoint) so any same-school joiner —
  // including students/parents who can't call that admin route — can embed
  // against the right server. Null means fall back to meet.jit.si client-side.
  // school_settings rows may be campus-specific or school-wide (campus_id
  // null) — prefer the campus-specific row, fall back to the school-wide one.
  let jitsiDomain: string | null = null
  const { data: campusRow } = await supabase
    .from('school_settings')
    .select('jitsi_domain')
    .eq('school_id', room.school_id)
    .eq('campus_id', room.campus_id)
    .maybeSingle()
  jitsiDomain = campusRow?.jitsi_domain || null

  if (!jitsiDomain) {
    const { data: schoolRow } = await supabase
      .from('school_settings')
      .select('jitsi_domain')
      .eq('school_id', room.school_id)
      .is('campus_id', null)
      .maybeSingle()
    jitsiDomain = schoolRow?.jitsi_domain || null
  }

  return { ...room, jitsi_domain: jitsiDomain }
}

export const listMyRooms = async (profileId: string): Promise<JitsiRoom[]> => {
  const { data, error } = await supabase
    .from('jitsi_rooms')
    .select('*')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list rooms: ${error.message}`)
  return data || []
}

// ============================================================================
// WHITEBOARD SNAPSHOT
// ============================================================================

export const getWhiteboardSnapshot = async (
  roomId: string,
  caller: CallerContext
): Promise<WhiteboardSnapshot | null> => {
  const room = await getRoomOrThrow(roomId)
  assertSameSchool(room, caller)

  const { data, error } = await supabase
    .from('jitsi_room_whiteboards')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch whiteboard: ${error.message}`)
  return (data as WhiteboardSnapshot) || null
}

/**
 * Only the room owner (or admin/super_admin) persists snapshots — avoids
 * write contention from every joined client racing to save the same row.
 */
export const upsertWhiteboardSnapshot = async (
  roomId: string,
  sceneData: Record<string, unknown>,
  caller: CallerContext
): Promise<WhiteboardSnapshot> => {
  const room = await getRoomOrThrow(roomId)
  assertOwner(room, caller)

  const { data, error } = await supabase
    .from('jitsi_room_whiteboards')
    .upsert(
      {
        room_id: roomId,
        scene_data: sceneData,
        updated_at: new Date().toISOString(),
        updated_by: caller.profileId,
      },
      { onConflict: 'room_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(`Failed to save whiteboard: ${error.message}`)
  return data as WhiteboardSnapshot
}
