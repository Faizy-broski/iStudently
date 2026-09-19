// Types for the schedule/room conflict decision. Input and output mirror the
// JSON contract in the feature spec exactly, so any DecisionProvider (the
// deterministic engine today, a model-backed one later) is a drop-in swap.

export type ConflictType = 'none' | 'room_double_booked' | 'teacher_double_booked' | 'both'

export interface ExistingBooking {
  teacherId: string
  room: string
  timeSlot: string
  classGroup: string
}

export interface ScheduleConflictInput {
  teacherId: string
  requestedRoom: string
  requestedTimeSlot: string
  requestedSubject: string
  /**
   * Bookings already in force. When the request MOVES an existing booking,
   * the caller must leave that booking out of this list — otherwise the
   * booking would conflict with itself (the contract has no booking id).
   */
  existingBookings: ExistingBooking[]
  /** Candidate pool for `suggestedAlternativeRoom`. */
  availableRooms: string[]
}

export interface ScheduleConflictDecision {
  hasConflict: boolean
  conflictType: ConflictType
  conflictReason: string
  suggestedAlternativeRoom: string | null
  canAutoApprove: boolean
}

export interface DecisionProvider {
  decide(input: ScheduleConflictInput): ScheduleConflictDecision
}
