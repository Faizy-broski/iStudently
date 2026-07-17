import { supabase } from '../config/supabase'
import { getMainSchoolId } from '../utils/campus.util'
import { ApiResponse } from '../types'
import {
  TimetableRequirement,
  CreateTimetableRequirementDTO,
  UpdateTimetableRequirementDTO,
  RequirementCoverageSummary
} from '../types/timetable-generator.types'

// ============================================================================
// TIMETABLE REQUIREMENTS SERVICE
// CRUD + seeding + coverage checks for the "N periods/week per subject"
// activity definitions consumed by the solver (Phase 1/2).
// Follows the conventions in timetable.service.ts: getMainSchoolId(),
// ApiResponse<T> wrapper, try/catch with console.error + error.message.
// ============================================================================

const REQUIREMENT_SELECT = `
  *,
  section:sections(id, name, grade_level:grade_levels(name)),
  subject:subjects(id, name, code),
  teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name))
`

function flattenRequirement(item: any): TimetableRequirement {
  return {
    ...item,
    section_name: item.section?.name,
    grade_name: item.section?.grade_level?.name,
    subject_name: item.subject?.name,
    subject_code: item.subject?.code,
    teacher_name: item.teacher?.profile
      ? `${item.teacher.profile.first_name} ${item.teacher.profile.last_name}`.trim()
      : undefined
  }
}

export const listRequirements = async (
  academicYearId: string,
  sectionId?: string
): Promise<ApiResponse<TimetableRequirement[]>> => {
  try {
    let query = supabase
      .from('timetable_requirements')
      .select(REQUIREMENT_SELECT)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    if (sectionId) {
      query = query.eq('section_id', sectionId)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw error

    return {
      success: true,
      data: (data || []).map(flattenRequirement)
    }
  } catch (error: any) {
    console.error('Error listing timetable requirements:', error)
    return { success: false, error: error.message }
  }
}

export const createRequirement = async (
  dto: CreateTimetableRequirementDTO
): Promise<ApiResponse<TimetableRequirement>> => {
  try {
    const mainSchoolId = await getMainSchoolId(dto.school_id)

    const { data, error } = await supabase
      .from('timetable_requirements')
      .insert({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || dto.school_id,
        academic_year_id: dto.academic_year_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id,
        teacher_id: dto.teacher_id ?? null,
        periods_per_week: dto.periods_per_week,
        double_period: dto.double_period ?? false,
        preferred_room_type: dto.preferred_room_type ?? null,
        min_gap_days: dto.min_gap_days ?? 0,
        created_by: dto.created_by
      })
      .select(REQUIREMENT_SELECT)
      .single()

    if (error) throw error

    return {
      success: true,
      data: flattenRequirement(data),
      message: 'Requirement created successfully'
    }
  } catch (error: any) {
    console.error('Error creating timetable requirement:', error)
    return { success: false, error: error.message }
  }
}

export interface BulkCreateRequirementsResult {
  success_count: number
  error_count: number
  errors: Array<{ index: number; error: string }>
  created: TimetableRequirement[]
}

/**
 * Batch insert requirements, mirroring the validate-then-insert pattern used
 * by bulkImportTimetable (timetable.service.ts): validate every row first,
 * then perform a single insert call for all valid rows.
 */
export const bulkCreateRequirements = async (
  dtos: CreateTimetableRequirementDTO[]
): Promise<ApiResponse<BulkCreateRequirementsResult>> => {
  try {
    if (!dtos.length) {
      return { success: false, error: 'No requirements provided' }
    }
    if (dtos.length > 500) {
      return { success: false, error: 'Maximum 500 requirements per bulk create' }
    }

    const result: BulkCreateRequirementsResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
      created: []
    }

    const toInsert: any[] = []
    const schoolIdCache = new Map<string, string>()

    for (let i = 0; i < dtos.length; i++) {
      const dto = dtos[i]
      if (!dto.section_id || !dto.subject_id || !dto.academic_year_id || !dto.school_id) {
        result.errors.push({ index: i, error: 'school_id, academic_year_id, section_id and subject_id are required' })
        result.error_count++
        continue
      }
      if (!dto.periods_per_week || dto.periods_per_week < 1 || dto.periods_per_week > 40) {
        result.errors.push({ index: i, error: 'periods_per_week must be between 1 and 40' })
        result.error_count++
        continue
      }

      let mainSchoolId = schoolIdCache.get(dto.school_id)
      if (!mainSchoolId) {
        mainSchoolId = await getMainSchoolId(dto.school_id)
        schoolIdCache.set(dto.school_id, mainSchoolId)
      }

      toInsert.push({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || dto.school_id,
        academic_year_id: dto.academic_year_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id,
        teacher_id: dto.teacher_id ?? null,
        periods_per_week: dto.periods_per_week,
        double_period: dto.double_period ?? false,
        preferred_room_type: dto.preferred_room_type ?? null,
        min_gap_days: dto.min_gap_days ?? 0,
        created_by: dto.created_by
      })
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('timetable_requirements')
        .insert(toInsert)
        .select(REQUIREMENT_SELECT)

      if (insertError) {
        return { success: false, error: `Database insert failed: ${insertError.message}` }
      }

      result.success_count = inserted?.length || toInsert.length
      result.created = (inserted || []).map(flattenRequirement)
    }

    return {
      success: true,
      data: result,
      message: `Created ${result.success_count} requirement(s) with ${result.error_count} error(s)`
    }
  } catch (error: any) {
    console.error('Error bulk creating timetable requirements:', error)
    return { success: false, error: error.message }
  }
}

export const updateRequirement = async (
  id: string,
  dto: UpdateTimetableRequirementDTO
): Promise<ApiResponse<TimetableRequirement>> => {
  try {
    const { data, error } = await supabase
      .from('timetable_requirements')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(REQUIREMENT_SELECT)
      .single()

    if (error) throw error

    return {
      success: true,
      data: flattenRequirement(data),
      message: 'Requirement updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating timetable requirement:', error)
    return { success: false, error: error.message }
  }
}

export const deleteRequirement = async (id: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('timetable_requirements')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) throw error

    return { success: true, message: 'Requirement deleted successfully' }
  } catch (error: any) {
    console.error('Error deleting timetable requirement:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Bootstraps timetable_requirements rows from existing
 * teacher_subject_assignments: one requirement per distinct
 * (section_id, subject_id, teacher_id) combo, with a default
 * periods_per_week of 5. Skips combos that already have a requirement.
 */
export const seedRequirementsFromAssignments = async (
  schoolId: string,
  academicYearId: string,
  sectionId?: string,
  createdBy?: string
): Promise<ApiResponse<BulkCreateRequirementsResult>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    let assignmentQuery = supabase
      .from('teacher_subject_assignments')
      .select('teacher_id, subject_id, section_id, school_id')
      .eq('academic_year_id', academicYearId)

    if (sectionId) {
      assignmentQuery = assignmentQuery.eq('section_id', sectionId)
    }

    const { data: assignments, error: assignmentError } = await assignmentQuery
    if (assignmentError) throw assignmentError

    if (!assignments || assignments.length === 0) {
      return {
        success: true,
        data: { success_count: 0, error_count: 0, errors: [], created: [] },
        message: 'No teacher_subject_assignments found to seed from'
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from('timetable_requirements')
      .select('section_id, subject_id, teacher_id')
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    if (existingError) throw existingError

    const existingKeys = new Set(
      (existing || []).map((r: any) => `${r.section_id}|${r.subject_id}|${r.teacher_id}`)
    )

    // De-dupe assignments themselves (in case of multiple rows for same combo)
    const seenAssignmentKeys = new Set<string>()
    const toInsert: any[] = []

    for (const a of assignments) {
      const key = `${a.section_id}|${a.subject_id}|${a.teacher_id}`
      if (existingKeys.has(key) || seenAssignmentKeys.has(key)) continue
      seenAssignmentKeys.add(key)

      toInsert.push({
        school_id: mainSchoolId,
        campus_id: a.school_id || schoolId,
        academic_year_id: academicYearId,
        section_id: a.section_id,
        subject_id: a.subject_id,
        teacher_id: a.teacher_id,
        periods_per_week: 5,
        double_period: false,
        preferred_room_type: null,
        min_gap_days: 0,
        created_by: createdBy
      })
    }

    const result: BulkCreateRequirementsResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
      created: []
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('timetable_requirements')
        .insert(toInsert)
        .select(REQUIREMENT_SELECT)

      if (insertError) {
        return { success: false, error: `Database insert failed: ${insertError.message}` }
      }

      result.success_count = inserted?.length || toInsert.length
      result.created = (inserted || []).map(flattenRequirement)
    }

    return {
      success: true,
      data: result,
      message: `Seeded ${result.success_count} requirement(s) from teacher assignments (${assignments.length - toInsert.length} already existed)`
    }
  } catch (error: any) {
    console.error('Error seeding timetable requirements from assignments:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Coverage summary: sum of periods_per_week required for a section vs the
 * number of available (non-break) slots per week.
 *
 * Available slots = (count of non-break periods for the section's school) x
 * (number of distinct school days). School days are derived from the
 * distinct day_of_week values already used in `timetable_entries` for the
 * academic year; if none exist yet (e.g. first-ever generation), we fall
 * back to a documented default of 5 weekdays (Mon-Fri, day_of_week 0-4).
 */
export const getCoverageSummary = async (
  sectionId: string,
  academicYearId: string
): Promise<ApiResponse<RequirementCoverageSummary>> => {
  try {
    const { data: requirements, error: reqError } = await supabase
      .from('timetable_requirements')
      .select('periods_per_week, school_id')
      .eq('section_id', sectionId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    if (reqError) throw reqError

    const requiredPeriodsPerWeek = (requirements || []).reduce(
      (sum: number, r: any) => sum + (r.periods_per_week || 0),
      0
    )

    const schoolId = requirements?.[0]?.school_id

    let nonBreakPeriodCount = 0
    if (schoolId) {
      const { count } = await supabase
        .from('periods')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_break', false)
        .eq('is_active', true)
      nonBreakPeriodCount = count || 0
    }

    // Derive distinct school days already used; default to 5 (Mon-Fri) if none.
    const { data: dayRows } = await supabase
      .from('timetable_entries')
      .select('day_of_week')
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)

    const distinctDays = new Set((dayRows || []).map((r: any) => r.day_of_week))
    const schoolDaysCount = distinctDays.size > 0 ? distinctDays.size : 5

    const availablePeriodsPerWeek = nonBreakPeriodCount * schoolDaysCount

    return {
      success: true,
      data: {
        section_id: sectionId,
        academic_year_id: academicYearId,
        required_periods_per_week: requiredPeriodsPerWeek,
        available_periods_per_week: availablePeriodsPerWeek,
        is_over_capacity: availablePeriodsPerWeek > 0 && requiredPeriodsPerWeek > availablePeriodsPerWeek,
        requirement_count: requirements?.length || 0
      }
    }
  } catch (error: any) {
    console.error('Error computing requirement coverage summary:', error)
    return { success: false, error: error.message }
  }
}
