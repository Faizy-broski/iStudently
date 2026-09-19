// Deterministic schedule/room conflict engine. Pure — no DB, no network.
//
// Conflict detection is exact set membership (same room + same slot, same
// teacher + same slot), so it is computed directly rather than estimated by a
// model: always correct, microseconds, and no schedule data leaves the server.

import type { ConflictType, ScheduleConflictDecision, ScheduleConflictInput } from './types'

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function evaluateScheduleChange(input: ScheduleConflictInput): ScheduleConflictDecision {
  const slot = norm(input.requestedTimeSlot)
  const room = norm(input.requestedRoom)
  const teacher = norm(input.teacherId)

  const sameSlot = input.existingBookings.filter((b) => norm(b.timeSlot) === slot)
  const roomClash = sameSlot.find((b) => norm(b.room) === room)
  const teacherClash = sameSlot.find((b) => norm(b.teacherId) === teacher)

  if (!roomClash && !teacherClash) {
    return {
      hasConflict: false,
      conflictType: 'none',
      conflictReason: 'No room or teacher availability conflicts found.',
      suggestedAlternativeRoom: null,
      canAutoApprove: true,
    }
  }

  const conflictType: ConflictType =
    roomClash && teacherClash ? 'both' : roomClash ? 'room_double_booked' : 'teacher_double_booked'

  const reasons: string[] = []
  if (roomClash) {
    reasons.push(`Room ${input.requestedRoom.trim()} is already assigned to ${roomClash.classGroup} during this time slot.`)
  }
  if (teacherClash) {
    reasons.push(`Teacher is already teaching ${teacherClash.classGroup} in ${teacherClash.room} during this time slot.`)
  }

  // An alternative room only helps a room clash; a teacher clash can't be
  // fixed by moving rooms.
  let suggestedAlternativeRoom: string | null = null
  if (roomClash) {
    const bookedRooms = new Set(sameSlot.map((b) => norm(b.room)))
    suggestedAlternativeRoom =
      input.availableRooms.find((r) => norm(r) !== room && !bookedRooms.has(norm(r))) ?? null
  }

  return {
    hasConflict: true,
    conflictType,
    conflictReason: reasons.join(' '),
    suggestedAlternativeRoom,
    canAutoApprove: false,
  }
}
