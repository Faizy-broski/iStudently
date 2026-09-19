import { evaluateScheduleChange } from './conflict-engine'
import { scheduleConflictInputSchema } from './schemas'
import { deterministicProvider } from './provider'
import type { ScheduleConflictInput } from './types'

const make = (overrides: Partial<ScheduleConflictInput> = {}): ScheduleConflictInput => ({
  teacherId: 't1',
  requestedRoom: 'Room 102',
  requestedTimeSlot: '1:p3',
  requestedSubject: 'Math',
  existingBookings: [],
  availableRooms: ['Room 102', 'Room 105', 'Room 106'],
  ...overrides,
})

describe('evaluateScheduleChange', () => {
  it('returns no conflict when nothing overlaps', () => {
    expect(evaluateScheduleChange(make())).toEqual({
      hasConflict: false,
      conflictType: 'none',
      conflictReason: 'No room or teacher availability conflicts found.',
      suggestedAlternativeRoom: null,
      canAutoApprove: true,
    })
  })

  it('ignores bookings in other time slots', () => {
    const d = evaluateScheduleChange(make({
      existingBookings: [{ teacherId: 't1', room: 'Room 102', timeSlot: '1:p4', classGroup: 'Grade 5' }],
    }))
    expect(d.hasConflict).toBe(false)
  })

  it('detects a room double-booking and suggests the first free room', () => {
    const d = evaluateScheduleChange(make({
      existingBookings: [
        { teacherId: 't9', room: 'Room 102', timeSlot: '1:p3', classGroup: 'Grade 5' },
        { teacherId: 't8', room: 'Room 105', timeSlot: '1:p3', classGroup: 'Grade 6' },
      ],
    }))
    expect(d).toEqual({
      hasConflict: true,
      conflictType: 'room_double_booked',
      conflictReason: 'Room Room 102 is already assigned to Grade 5 during this time slot.',
      suggestedAlternativeRoom: 'Room 106',
      canAutoApprove: false,
    })
  })

  it('returns a null suggestion when every room is taken', () => {
    const d = evaluateScheduleChange(make({
      availableRooms: ['Room 102'],
      existingBookings: [{ teacherId: 't9', room: 'Room 102', timeSlot: '1:p3', classGroup: 'Grade 5' }],
    }))
    expect(d.conflictType).toBe('room_double_booked')
    expect(d.suggestedAlternativeRoom).toBeNull()
  })

  it('returns a null suggestion when there are no available rooms at all', () => {
    const d = evaluateScheduleChange(make({
      availableRooms: [],
      existingBookings: [{ teacherId: 't9', room: 'Room 102', timeSlot: '1:p3', classGroup: 'Grade 5' }],
    }))
    expect(d.suggestedAlternativeRoom).toBeNull()
  })

  it('detects a teacher double-booking without suggesting a room', () => {
    const d = evaluateScheduleChange(make({
      existingBookings: [{ teacherId: 't1', room: 'Room 200', timeSlot: '1:p3', classGroup: 'Grade 3' }],
    }))
    expect(d).toEqual({
      hasConflict: true,
      conflictType: 'teacher_double_booked',
      conflictReason: 'Teacher is already teaching Grade 3 in Room 200 during this time slot.',
      suggestedAlternativeRoom: null,
      canAutoApprove: false,
    })
  })

  it('reports both when room and teacher clash', () => {
    const d = evaluateScheduleChange(make({
      existingBookings: [
        { teacherId: 't9', room: 'Room 102', timeSlot: '1:p3', classGroup: 'Grade 5' },
        { teacherId: 't1', room: 'Room 300', timeSlot: '1:p3', classGroup: 'Grade 3' },
      ],
    }))
    expect(d.conflictType).toBe('both')
    expect(d.conflictReason).toContain('Room Room 102 is already assigned to Grade 5')
    expect(d.conflictReason).toContain('Teacher is already teaching Grade 3 in Room 300')
    expect(d.suggestedAlternativeRoom).toBe('Room 105')
    expect(d.canAutoApprove).toBe(false)
  })

  it('matches case- and whitespace-insensitively', () => {
    const d = evaluateScheduleChange(make({
      requestedRoom: '  room   102 ',
      requestedTimeSlot: ' 1:P3',
      teacherId: 'T1',
      existingBookings: [{ teacherId: ' t1 ', room: 'ROOM 102', timeSlot: '1:p3 ', classGroup: 'Grade 5' }],
    }))
    expect(d.conflictType).toBe('both')
  })
})

describe('scheduleConflictInputSchema', () => {
  it('accepts a valid payload and trims strings', () => {
    const parsed = scheduleConflictInputSchema.parse({ ...make(), teacherId: '  t1 ' })
    expect(parsed.teacherId).toBe('t1')
  })
  it('rejects empty required strings', () => {
    expect(scheduleConflictInputSchema.safeParse({ ...make(), requestedRoom: '  ' }).success).toBe(false)
  })
  it('rejects malformed bookings', () => {
    expect(scheduleConflictInputSchema.safeParse({ ...make(), existingBookings: [{ room: 'x' }] }).success).toBe(false)
  })
})

describe('deterministicProvider', () => {
  it('delegates to the engine', () => {
    expect(deterministicProvider.decide(make()).hasConflict).toBe(false)
  })
  it('handles a 5,000-booking input quickly', () => {
    const bookings = Array.from({ length: 5000 }, (_, i) => ({
      teacherId: `t${i}`, room: `R${i}`, timeSlot: `1:p${i % 10}`, classGroup: `G${i}`,
    }))
    const start = performance.now()
    evaluateScheduleChange(make({ existingBookings: bookings }))
    expect(performance.now() - start).toBeLessThan(50)
  })
})
