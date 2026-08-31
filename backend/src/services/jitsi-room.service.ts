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
  // Audience targeting — all null means same-school-wide (see
  // add_room_audience_targeting.sql). Applies to student/parent access
  // only; teachers/admins always see every same-school room regardless.
  target_campus_id?: string | null
  target_grade_level_id?: string | null
  target_section_id?: string | null
  // Only present when explicitly selected (getRoom/listMyRooms/listSchoolRooms)
  // for display — not part of the base row.
  target_campus?: { name: string } | null
  target_grade_level?: { name: string } | null
  target_section?: { name: string } | null
}

export interface CreateRoomDTO {
  school_id: string
  campus_id: string
  owner_profile_id: string
  title: string
  description?: string
  password?: string
  start_audio_only?: boolean
  target_campus_id?: string | null
  target_grade_level_id?: string | null
  target_section_id?: string | null
}

export type UpdateRoomDTO = Partial<Pick<CreateRoomDTO,
  'title' | 'description' | 'password' | 'start_audio_only' |
  'target_campus_id' | 'target_grade_level_id' | 'target_section_id'
>>

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

// ============================================================================
// AUDIENCE TARGETING (campus/grade/section) — ad-hoc rooms only, students and
// parents only. Teachers/admins are exempt by design: they already have
// broader same-school access everywhere else in this app, and a room's
// audience targeting narrows who a session is *for*, not who's allowed to
// help run/oversee it.
// ============================================================================

interface AudienceMembership {
  school_id: string
  grade_level_id: string | null
  section_id: string | null
}

function isTargeted(
  room: Pick<JitsiRoom, 'target_campus_id' | 'target_grade_level_id' | 'target_section_id'>
): boolean {
  return !!(room.target_campus_id || room.target_grade_level_id || room.target_section_id)
}

/** Each non-null target column narrows further; a null target column is a wildcard at that level. */
function targetingMatches(
  room: Pick<JitsiRoom, 'target_campus_id' | 'target_grade_level_id' | 'target_section_id'>,
  membership: AudienceMembership
): boolean {
  if (room.target_campus_id && room.target_campus_id !== membership.school_id) return false
  if (room.target_grade_level_id && room.target_grade_level_id !== membership.grade_level_id) return false
  if (room.target_section_id && room.target_section_id !== membership.section_id) return false
  return true
}

async function resolveStudentMembership(profileId: string): Promise<AudienceMembership | null> {
  const { data } = await supabase
    .from('students')
    .select('school_id, grade_level_id, section_id')
    .eq('profile_id', profileId)
    .maybeSingle()
  return data
}

/** All of a parent's linked active children — a match on ANY of them grants access. */
async function resolveParentChildMemberships(profileId: string): Promise<AudienceMembership[]> {
  const { data: parentRow } = await supabase.from('parents').select('id').eq('profile_id', profileId).maybeSingle()
  if (!parentRow) return []

  const { data: links } = await supabase
    .from('parent_student_links')
    .select('student:students(school_id, grade_level_id, section_id)')
    .eq('parent_id', parentRow.id)
    .eq('is_active', true)

  return (links || []).map((l: any) => l.student).filter(Boolean) as AudienceMembership[]
}

async function resolveMembershipsForRole(role: string, profileId: string): Promise<AudienceMembership[]> {
  if (role === 'student') {
    const m = await resolveStudentMembership(profileId)
    return m ? [m] : []
  }
  if (role === 'parent') {
    return resolveParentChildMemberships(profileId)
  }
  return []
}

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

/**
 * The real join/view gate for a room, used everywhere a participant (not
 * just the owner) needs access: getRoom, whiteboard read/write, poll list/
 * results/respond. Two cases:
 *
 *  - Ad-hoc room (no linked online_classes row, e.g. a legacy "My Rooms"
 *    room): same-school is the whole gate, matching the old assertSameSchool
 *    -only behavior exactly, so nothing already using such a room regresses.
 *  - Course-bound room (created via online-class.service.ts): also requires
 *    being the owning teacher, an admin/super_admin, or a currently-enrolled
 *    student of that *active* class. Deliberately queried directly here
 *    (not by importing online-class.service.ts, which already imports this
 *    module) rather than duplicated per-caller — this is the one place that
 *    decision is made.
 *
 * Enrollment is checked against the online_class_enrollments snapshot first
 * (fast, covers the common case — everyone who was on the roster when the
 * session started), then falls back to a live student_schedules lookup so a
 * student who enrolls in the course *after* the session started doesn't need
 * the teacher to restart it to be let in.
 *
 * Returns the linked online_classes id (or null for an ad-hoc room) so
 * callers that need it (getRoom, for the "End Session" control) don't have
 * to run this same lookup a second time.
 */
export async function assertCanAccessRoom(
  room: JitsiRoom,
  caller: CallerContext
): Promise<{ onlineClassId: string | null }> {
  assertSameSchool(room, caller)

  const { data: onlineClass, error: onlineClassError } = await supabase
    .from('online_classes')
    .select('id, teacher_profile_id, status, course_period_id')
    .eq('jitsi_room_id', room.id)
    .maybeSingle()

  if (onlineClassError) throw new Error(`Failed to resolve room access: ${onlineClassError.message}`)
  if (!onlineClass) {
    // Ad-hoc room — same-school check above is the baseline gate, plus
    // campus/grade/section targeting for students/parents (see the
    // AUDIENCE TARGETING helpers above). Teachers/admins are exempt.
    if (isTargeted(room) && (caller.role === 'student' || caller.role === 'parent')) {
      const memberships = await resolveMembershipsForRole(caller.role, caller.profileId)
      if (!memberships.some((m) => targetingMatches(room, m))) {
        throw new Error('Access denied: this session is not for your class')
      }
    }
    return { onlineClassId: null }
  }

  if (isPrivileged(caller.role)) return { onlineClassId: onlineClass.id } // already same-school-checked above
  if (onlineClass.teacher_profile_id === caller.profileId) return { onlineClassId: onlineClass.id }

  if (onlineClass.status !== 'active') {
    throw new Error('This class session is not currently active')
  }

  const { data: snapshotRow } = await supabase
    .from('online_class_enrollments')
    .select('id')
    .eq('online_class_id', onlineClass.id)
    .eq('student_profile_id', caller.profileId)
    .eq('status', 'enrolled')
    .maybeSingle()

  if (snapshotRow) return { onlineClassId: onlineClass.id }

  if (onlineClass.course_period_id) {
    // Not in the roster snapshot — check live enrollment in case the
    // student joined the course after the session started.
    const { data: studentRow } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', caller.profileId)
      .maybeSingle()

    if (studentRow) {
      const { data: scheduleRow } = await supabase
        .from('student_schedules')
        .select('id')
        .eq('course_period_id', onlineClass.course_period_id)
        .eq('student_id', studentRow.id)
        .maybeSingle()

      if (scheduleRow) return { onlineClassId: onlineClass.id }
    }
  }

  throw new Error('Access denied: not enrolled in this class')
}

/**
 * Trusted server-to-server delete — no caller check, same trust level
 * createRoom already gets when called internally from online-class.service.ts.
 * Relies on jitsi_room_whiteboards/jitsi_room_polls/jitsi_room_poll_responses
 * ON DELETE CASCADE (create_live_class_system.sql) to clean up in one call.
 */
export async function deleteRoomInternal(roomId: string): Promise<void> {
  const { error } = await supabase.from('jitsi_rooms').delete().eq('id', roomId)
  if (error) throw new Error(`Failed to delete room: ${error.message}`)
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
      target_campus_id: dto.target_campus_id || null,
      target_grade_level_id: dto.target_grade_level_id || null,
      target_section_id: dto.target_section_id || null,
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
      ...(dto.target_campus_id !== undefined && { target_campus_id: dto.target_campus_id || null }),
      ...(dto.target_grade_level_id !== undefined && { target_grade_level_id: dto.target_grade_level_id || null }),
      ...(dto.target_section_id !== undefined && { target_section_id: dto.target_section_id || null }),
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

/**
 * Returns true only for a plausible hostname: must contain at least one dot
 * and have no empty segments.  Rejects placeholder values like "test" or
 * ".example.com" that would cause the @jitsi/react-sdk to try loading
 * https://test/external_api.js and fail.
 */
function isValidJitsiDomain(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed.includes('.')) return false
  if (trimmed.split('.').some((seg) => seg.length === 0)) return false
  return true
}

export const getRoom = async (
  roomId: string,
  caller: CallerContext
): Promise<JitsiRoom & { jitsi_domain: string | null; online_class_id: string | null }> => {
  const room = await getRoomOrThrow(roomId)
  const { onlineClassId } = await assertCanAccessRoom(room, caller)

  // Resolve the school's custom Jitsi domain here (rather than via the
  // admin-only school-settings endpoint) so any same-school joiner —
  // including students/parents who can't call that admin route — can embed
  // against the right server. Null means fall back to meet.jit.si client-side.
  // school_settings rows may be campus-specific or school-wide (campus_id
  // null) — prefer the campus-specific row, fall back to the school-wide one.
  // Only a syntactically valid hostname is forwarded; placeholders like "test"
  // are silently treated as null so the client defaults to meet.jit.si.
  let jitsiDomain: string | null = null
  const { data: campusRow } = await supabase
    .from('school_settings')
    .select('jitsi_domain')
    .eq('school_id', room.school_id)
    .eq('campus_id', room.campus_id)
    .maybeSingle()
  const rawCampus = campusRow?.jitsi_domain || null
  jitsiDomain = rawCampus && isValidJitsiDomain(rawCampus) ? rawCampus : null

  if (!jitsiDomain) {
    const { data: schoolRow } = await supabase
      .from('school_settings')
      .select('jitsi_domain')
      .eq('school_id', room.school_id)
      .is('campus_id', null)
      .maybeSingle()
    const rawSchool = schoolRow?.jitsi_domain || null
    jitsiDomain = rawSchool && isValidJitsiDomain(rawSchool) ? rawSchool : null
  }

  // Audience target names, for display — fetched separately rather than
  // folded into getRoomOrThrow's plain select() so that helper (also used
  // for internal access checks that don't need them) stays lean.
  const { data: targetNames } = await supabase
    .from('jitsi_rooms')
    .select('target_campus:schools!jitsi_rooms_target_campus_id_fkey(name), target_grade_level:grade_levels(name), target_section:sections(name)')
    .eq('id', roomId)
    .maybeSingle()

  return {
    ...room,
    jitsi_domain: jitsiDomain,
    online_class_id: onlineClassId,
    target_campus: (targetNames as any)?.target_campus || null,
    target_grade_level: (targetNames as any)?.target_grade_level || null,
    target_section: (targetNames as any)?.target_section || null,
  }
}

export const listMyRooms = async (profileId: string): Promise<JitsiRoom[]> => {
  const { data, error } = await supabase
    .from('jitsi_rooms')
    .select('*, target_campus:schools!jitsi_rooms_target_campus_id_fkey(name), target_grade_level:grade_levels(name), target_section:sections(name)')
    .eq('owner_profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list rooms: ${error.message}`)
  return data || []
}

/**
 * Ad-hoc rooms any same-school user can see and join — the actual gate a
 * student/parent/teacher hits when they open one is assertCanAccessRoom's
 * same-school check (identical to what this list applies), so this is pure
 * discoverability, not a new grant. Course-bound rooms are excluded — those
 * are already properly surfaced (with roster/enrollment checks) through the
 * Online Classes flow, listing them again here would be redundant and, for
 * a room whose class isn't active yet, misleadingly joinable-looking.
 */
export const listSchoolRooms = async (caller: CallerContext): Promise<JitsiRoom[]> => {
  const { data: linked, error: linkedError } = await supabase
    .from('online_classes')
    .select('jitsi_room_id')
    .eq('school_id', caller.schoolId)
    .not('jitsi_room_id', 'is', null)

  if (linkedError) throw new Error(`Failed to list rooms: ${linkedError.message}`)
  const linkedIds = (linked || []).map((r) => r.jitsi_room_id).filter(Boolean) as string[]

  let query = supabase
    .from('jitsi_rooms')
    .select('*, target_campus:schools!jitsi_rooms_target_campus_id_fkey(name), target_grade_level:grade_levels(name), target_section:sections(name)')
    .eq('school_id', caller.schoolId)
    .order('created_at', { ascending: false })

  if (linkedIds.length > 0) {
    query = query.not('id', 'in', `(${linkedIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list rooms: ${error.message}`)
  const rooms = data || []

  // Audience targeting: teachers/admins see every room (unchanged). For
  // students/parents, drop any targeted room that doesn't match their own
  // (or their linked children's) campus/grade/section — this must mirror
  // assertCanAccessRoom's check exactly, or a room hidden here but still
  // joinable there (or vice versa) would be a real bug, not a cosmetic one.
  if (caller.role !== 'student' && caller.role !== 'parent') return rooms

  const memberships = await resolveMembershipsForRole(caller.role, caller.profileId)
  return rooms.filter((r) => !isTargeted(r) || memberships.some((m) => targetingMatches(r, m)))
}

// ============================================================================
// WHITEBOARD SNAPSHOT
// ============================================================================

export const getWhiteboardSnapshot = async (
  roomId: string,
  caller: CallerContext
): Promise<WhiteboardSnapshot | null> => {
  const room = await getRoomOrThrow(roomId)
  await assertCanAccessRoom(room, caller)

  const { data, error } = await supabase
    .from('jitsi_room_whiteboards')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch whiteboard: ${error.message}`)
  return (data as WhiteboardSnapshot) || null
}

/**
 * Any participant with access to the room can persist a snapshot (not just
 * the owner) — the frontend already debounces this to one save every 7s per
 * client (WhiteboardPanel.tsx), so write contention isn't a real concern,
 * and owner-only persistence meant a student's drawing could be lost on
 * refresh whenever the teacher's own client wasn't the last to save.
 */
export const upsertWhiteboardSnapshot = async (
  roomId: string,
  sceneData: Record<string, unknown>,
  caller: CallerContext
): Promise<WhiteboardSnapshot> => {
  const room = await getRoomOrThrow(roomId)
  await assertCanAccessRoom(room, caller)

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
