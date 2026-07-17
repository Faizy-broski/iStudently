import { z } from 'zod'

// ============================================================================
// TIMETABLE GENERATOR — ZOD VALIDATION SCHEMAS
// ============================================================================
// Matches the project convention seen in `types/index.ts` (e.g.
// createRoomSchema/updateRoomSchema) and consumed via `schema.parse(req.body)`
// inside a try/catch that returns a 400 on ZodError (see hostel.controller.ts).
// No `schemas/` directory previously existed in backend/src — created here per
// the plan's fallback instruction.

const roomTypeEnum = z.enum(['classroom', 'lab', 'auditorium', 'library', 'gym', 'office', 'other'])

export const createTimetableRequirementSchema = z.object({
  school_id: z.string().uuid(),
  campus_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid(),
  section_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  teacher_id: z.string().uuid().nullable().optional(),
  periods_per_week: z.number().int().min(1).max(40),
  double_period: z.boolean().optional(),
  preferred_room_type: roomTypeEnum.nullable().optional(),
  min_gap_days: z.number().int().min(0).optional(),
  created_by: z.string().uuid().optional(),
})

export const updateTimetableRequirementSchema = z.object({
  teacher_id: z.string().uuid().nullable().optional(),
  periods_per_week: z.number().int().min(1).max(40).optional(),
  double_period: z.boolean().optional(),
  preferred_room_type: roomTypeEnum.nullable().optional(),
  min_gap_days: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

export const bulkCreateTimetableRequirementsSchema = z.object({
  requirements: z.array(createTimetableRequirementSchema).min(1).max(500),
})

export const seedRequirementsFromAssignmentsSchema = z.object({
  school_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  section_id: z.string().uuid().optional(),
  created_by: z.string().uuid().optional(),
})

export const upsertTeacherSchedulingConstraintSchema = z.object({
  school_id: z.string().uuid(),
  campus_id: z.string().uuid().optional(),
  teacher_id: z.string().uuid(),
  academic_year_id: z.string().uuid(),
  max_periods_per_day: z.number().int().min(1).nullable().optional(),
  max_periods_per_week: z.number().int().min(1).nullable().optional(),
  min_gap_between_periods: z.number().int().min(0).optional(),
  max_consecutive_periods: z.number().int().min(1).nullable().optional(),
})

export const updateTimetableGenerationSettingsSchema = z.object({
  school_id: z.string().uuid(),
  campus_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid(),
  default_max_periods_per_day: z.number().int().min(1).optional(),
  default_min_gap_between_periods: z.number().int().min(0).optional(),
  weight_teacher_availability_preferred: z.number().int().min(0).optional(),
  weight_gap_violation: z.number().int().min(0).optional(),
  weight_daily_load_violation: z.number().int().min(0).optional(),
  weight_double_period_broken: z.number().int().min(0).optional(),
  weight_frequency_spread: z.number().int().min(0).optional(),
  solver_time_limit_seconds: z.number().int().min(1).max(600).optional(),
})

// ----------------------------------------------------------------------------
// Generation jobs (Phase 2)
// ----------------------------------------------------------------------------

export const startGenerationSchema = z.object({
  school_id: z.string().uuid(),
  campus_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid(),
  scope: z.enum(['all', 'sections']),
  section_ids: z.array(z.string().uuid()).optional(),
  created_by: z.string().uuid().optional(),
}).refine(
  (v) => v.scope === 'all' || (Array.isArray(v.section_ids) && v.section_ids.length > 0),
  { message: 'section_ids is required and must be non-empty when scope is "sections"', path: ['section_ids'] }
)

// ----------------------------------------------------------------------------
// Lock / unlock timetable entries (Phase 2)
// ----------------------------------------------------------------------------

export const lockTimetableEntrySchema = z.object({
  locked: z.boolean(),
})

export const bulkLockTimetableEntriesSchema = z.object({
  locked: z.boolean(),
  entry_ids: z.array(z.string().uuid()).optional(),
  section_id: z.string().uuid().optional(),
}).refine(
  (v) => (Array.isArray(v.entry_ids) && v.entry_ids.length > 0) || !!v.section_id,
  { message: 'Either entry_ids (non-empty) or section_id is required' }
)

export type CreateTimetableRequirementInput = z.infer<typeof createTimetableRequirementSchema>
export type UpdateTimetableRequirementInput = z.infer<typeof updateTimetableRequirementSchema>
export type UpsertTeacherSchedulingConstraintInput = z.infer<typeof upsertTeacherSchedulingConstraintSchema>
export type UpdateTimetableGenerationSettingsInput = z.infer<typeof updateTimetableGenerationSettingsSchema>
export type StartGenerationInput = z.infer<typeof startGenerationSchema>
export type LockTimetableEntryInput = z.infer<typeof lockTimetableEntrySchema>
export type BulkLockTimetableEntriesInput = z.infer<typeof bulkLockTimetableEntriesSchema>
