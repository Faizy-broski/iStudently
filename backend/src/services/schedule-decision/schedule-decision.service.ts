// ScheduleDecisionService — evaluates a requested schedule change against the
// current timetable and returns the strict JSON decision from ./types.
//
// The decision itself is made by a DecisionProvider (default: the exact
// in-process engine). This class only adds input validation and, for the
// database path, loads everything the engine needs in ONE round of two
// parallel queries — no per-row round-trips.

import { supabase } from '../../config/supabase'
import { getMainSchoolId } from '../../utils/campus.util'
import { deterministicProvider } from './provider'
import { scheduleConflictInputSchema } from './schemas'
import type {
  DecisionProvider,
  ExistingBooking,
  ScheduleConflictDecision,
  ScheduleConflictInput,
} from './types'

export interface ValidateAgainstDatabaseParams {
  /** The campus the class happens in (timetable_entries.campus_id). */
  campusId: string
  academicYearId: string
  teacherId: string
  /** Free-text room label (timetable_entries.room_number) — preferred when set. */
  roomNumber?: string | null
  /** rooms.id — used when no room_number is given. */
  roomId?: string | null
  dayOfWeek: number
  periodId: string
  subject?: string
  /** Entry being edited — left out so it doesn't conflict with itself. */
  excludeEntryId?: string
}

export interface DatabaseScheduleDecision extends ScheduleConflictDecision {
  /** rooms.id of `suggestedAlternativeRoom`, when it matches a rooms row. */
  suggestedAlternativeRoomId: string | null
}

export class ScheduleDecisionService {
  constructor(private readonly provider: DecisionProvider = deterministicProvider) {}

  /** Validates the payload, then decides. Throws a ZodError on malformed input. */
  validateScheduleChange(data: ScheduleConflictInput): ScheduleConflictDecision {
    return this.provider.decide(scheduleConflictInputSchema.parse(data))
  }

  async validateAgainstDatabase(params: ValidateAgainstDatabaseParams): Promise<DatabaseScheduleDecision> {
    const { campusId, academicYearId, teacherId, dayOfWeek, periodId, excludeEntryId } = params

    const mainSchoolId = await getMainSchoolId(campusId)

    let entriesQuery = supabase
      .from('timetable_entries')
      .select('teacher_id, room_number, room_id, section:sections(name)')
      .eq('campus_id', campusId)
      .eq('academic_year_id', academicYearId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_id', periodId)
      .eq('is_active', true)
    if (excludeEntryId) entriesQuery = entriesQuery.neq('id', excludeEntryId)

    const [entriesRes, roomsRes] = await Promise.all([
      entriesQuery,
      supabase
        .from('rooms')
        .select('id, name')
        .eq('school_id', mainSchoolId)
        .or(`campus_id.eq.${campusId},campus_id.is.null`)
        .eq('is_active', true),
    ])
    if (entriesRes.error) throw new Error(`Failed to load bookings: ${entriesRes.error.message}`)
    if (roomsRes.error) throw new Error(`Failed to load rooms: ${roomsRes.error.message}`)

    const rooms = (roomsRes.data || []) as { id: string; name: string }[]
    const roomNameById = new Map(rooms.map((r) => [r.id, r.name]))
    const roomIdByName = new Map(rooms.map((r) => [r.name.trim().toLowerCase(), r.id]))

    const requestedRoom = (params.roomNumber?.trim() || (params.roomId ? roomNameById.get(params.roomId) : '') || '').trim()
    if (!requestedRoom) throw new Error('A room is required to check for conflicts')

    const timeSlot = `${dayOfWeek}:${periodId}`
    const existingBookings: ExistingBooking[] = (entriesRes.data || []).map((e: any) => {
      const section = Array.isArray(e.section) ? e.section[0] : e.section
      return {
        teacherId: e.teacher_id,
        room: e.room_number?.trim() || (e.room_id ? roomNameById.get(e.room_id) : '') || '(no room)',
        timeSlot,
        classGroup: section?.name || 'another class',
      }
    })

    const decision = this.provider.decide({
      teacherId,
      requestedRoom,
      requestedTimeSlot: timeSlot,
      requestedSubject: params.subject || '',
      existingBookings,
      availableRooms: rooms.map((r) => r.name),
    })

    return {
      ...decision,
      suggestedAlternativeRoomId: decision.suggestedAlternativeRoom
        ? roomIdByName.get(decision.suggestedAlternativeRoom.trim().toLowerCase()) ?? null
        : null,
    }
  }
}

export const scheduleDecisionService = new ScheduleDecisionService()
