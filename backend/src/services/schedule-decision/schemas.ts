// Input validation for schedule conflict decisions. Pure — no DB.
import { z } from 'zod'

const nonEmpty = z.string().trim().min(1).max(200)

export const scheduleConflictInputSchema = z.object({
  teacherId: nonEmpty,
  requestedRoom: nonEmpty,
  requestedTimeSlot: nonEmpty,
  requestedSubject: nonEmpty,
  existingBookings: z
    .array(
      z.object({
        teacherId: nonEmpty,
        room: nonEmpty,
        timeSlot: nonEmpty,
        classGroup: nonEmpty,
      })
    )
    .max(20000),
  availableRooms: z.array(nonEmpty).max(5000),
})
