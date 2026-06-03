import { supabase } from '../config/supabase'
import type {
  ScheduleRequest,
  CreateScheduleRequestDTO,
  UpdateScheduleRequestDTO,
  MassCreateRequestDTO,
  SchedulerOptions,
  SchedulerResult,
  TimetableTemplate,
  CreateTemplateDTO,
  SaveTemplateFromSectionDTO,
  ApplyTemplateDTO,
} from '../types/scheduling.types'
import type { ApiResponse } from '../types'
import { enrollStudent } from './scheduling.service'

// ============================================================================
// SCHEDULE REQUESTS SERVICE
// Handles course requests, the auto-scheduler (inspired by RosarioSIS),
// and timetable templates.
// ============================================================================

const getMainSchoolId = async (schoolId: string): Promise<string> => {
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .single()
  return school?.parent_school_id || schoolId
}

// ──────────────────────────────────────────────────────────────────────────
// SCHEDULE REQUESTS CRUD
// ──────────────────────────────────────────────────────────────────────────

export const getRequests = async (
  schoolId: string,
  academicYearId: string,
  filters?: {
    student_id?: string
    course_id?: string
    status?: string
    campus_id?: string
  }
): Promise<ApiResponse<ScheduleRequest[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    let query = supabase
      .from('schedule_requests')
      .select(`
        *,
        student:students(id, profile:profiles!students_profile_id_fkey(first_name, last_name)),
        course:courses(id, title, short_name, subject:subjects(id, name, code)),
        with_teacher:staff!schedule_requests_with_teacher_id_fkey(id, profile:profiles!profile_id(first_name, last_name)),
        not_teacher:staff!schedule_requests_not_teacher_id_fkey(id, profile:profiles!profile_id(first_name, last_name)),
        with_period:periods!schedule_requests_with_period_id_fkey(id, period_name, period_number),
        not_period:periods!schedule_requests_not_period_id_fkey(id, period_name, period_number),
        fulfilled_course_period:course_periods(id, title, section:sections(id, name))
      `)
      .eq('school_id', mainSchoolId)
      .eq('academic_year_id', academicYearId)
      .order('priority', { ascending: false })

    if (filters?.student_id) query = query.eq('student_id', filters.student_id)
    if (filters?.course_id) query = query.eq('course_id', filters.course_id)
    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.campus_id) {
      query = query.or(`campus_id.eq.${filters.campus_id},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return { success: true, data: (data || []) as ScheduleRequest[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const createRequest = async (
  schoolId: string,
  dto: CreateScheduleRequestDTO,
  requestedBy?: string
): Promise<ApiResponse<ScheduleRequest>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    const { data, error } = await supabase
      .from('schedule_requests')
      .insert({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || null,
        student_id: dto.student_id,
        course_id: dto.course_id,
        subject_id: dto.subject_id || null,
        academic_year_id: dto.academic_year_id,
        marking_period_id: dto.marking_period_id || null,
        with_teacher_id: dto.with_teacher_id || null,
        not_teacher_id: dto.not_teacher_id || null,
        with_period_id: dto.with_period_id || null,
        not_period_id: dto.not_period_id || null,
        priority: dto.priority || 0,
        requested_by: requestedBy,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as ScheduleRequest }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const updateRequest = async (
  id: string,
  dto: UpdateScheduleRequestDTO
): Promise<ApiResponse<ScheduleRequest>> => {
  try {
    const { data, error } = await supabase
      .from('schedule_requests')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return { success: true, data: data as ScheduleRequest }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const deleteRequest = async (id: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('schedule_requests')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true, data: undefined }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Mass-create requests for multiple students for the same course.
 */
export const massCreateRequests = async (
  schoolId: string,
  dto: MassCreateRequestDTO,
  requestedBy?: string
): Promise<ApiResponse<{ created: number; errors: string[] }>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)
    const errors: string[] = []
    let created = 0

    for (const studentId of dto.student_ids) {
      const result = await createRequest(mainSchoolId, {
        student_id: studentId,
        course_id: dto.course_id,
        academic_year_id: dto.academic_year_id,
        marking_period_id: dto.marking_period_id,
        campus_id: dto.campus_id,
        priority: dto.priority,
      }, requestedBy)

      if (result.success) {
        created++
      } else {
        errors.push(`Student ${studentId}: ${result.error}`)
      }
    }

    return { success: true, data: { created, errors } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULER (RosarioSIS-inspired)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Run the auto-scheduler to fill pending requests.
 * Algorithm (adapted from RosarioSIS Scheduler.php):
 *
 * 1. Gather all pending requests (optionally for a single course)
 * 2. For each request, find matching course_periods
 * 3. Filter by preferences (with/not teacher, with/not period)
 * 4. Filter by availability (seat count, gender, teacher availability)
 * 5. Pick the best candidate (fewest conflicts, most seats remaining)
 * 6. Enroll the student and mark request fulfilled
 */
export const runScheduler = async (
  options: SchedulerOptions
): Promise<ApiResponse<SchedulerResult>> => {
  try {
    const result: SchedulerResult = {
      total_requests: 0,
      fulfilled: 0,
      unfilled: 0,
      errors: [],
      details: [],
    }

    // 1. Get pending requests
    let reqQuery = supabase
      .from('schedule_requests')
      .select('*')
      .eq('school_id', options.school_id)
      .eq('academic_year_id', options.academic_year_id)
      .eq('status', 'pending')

    if (options.course_id) {
      reqQuery = reqQuery.eq('course_id', options.course_id)
    }
    if (options.campus_id) {
      reqQuery = reqQuery.or(`campus_id.eq.${options.campus_id},campus_id.is.null`)
    }

    // Sort by priority descending (highest first)
    if (options.use_priority_ordering) {
      reqQuery = reqQuery.order('priority', { ascending: false })
    }

    const { data: requests, error: reqErr } = await reqQuery
    if (reqErr) throw reqErr

    if (!requests || requests.length === 0) {
      return { success: true, data: result }
    }

    result.total_requests = requests.length

    // 2. Process each request
    for (const req of requests) {
      // Get all active course_periods for this course
      let cpQuery = supabase
        .from('course_periods')
        .select(`
          id, teacher_id, section_id, period_id, total_seats, filled_seats,
          room_id, days, gender_restriction, is_active
        `)
        .eq('course_id', req.course_id)
        .eq('is_active', true)

      if (req.marking_period_id) {
        cpQuery = cpQuery.or(`marking_period_id.eq.${req.marking_period_id},marking_period_id.is.null`)
      }

      const { data: candidates } = await cpQuery
      if (!candidates || candidates.length === 0) {
        result.unfilled++
        result.details.push({
          student_id: req.student_id,
          course_id: req.course_id,
          status: 'unfilled',
          reason: 'No course periods available for this course',
        })
        await supabase.from('schedule_requests').update({ status: 'unfilled' }).eq('id', req.id)
        continue
      }

      // 3. Filter candidates based on preferences
      let filtered = [...candidates]

      // Teacher preferences
      if (req.with_teacher_id) {
        const preferred = filtered.filter((cp: any) => cp.teacher_id === req.with_teacher_id)
        if (preferred.length > 0) filtered = preferred
        // soft preference: if no match, keep all
      }
      if (req.not_teacher_id) {
        const withoutExcluded = filtered.filter((cp: any) => cp.teacher_id !== req.not_teacher_id)
        if (withoutExcluded.length > 0) filtered = withoutExcluded
      }

      // Period preferences
      if (req.with_period_id) {
        const preferred = filtered.filter((cp: any) => cp.period_id === req.with_period_id)
        if (preferred.length > 0) filtered = preferred
      }
      if (req.not_period_id) {
        const withoutExcluded = filtered.filter((cp: any) => cp.period_id !== req.not_period_id)
        if (withoutExcluded.length > 0) filtered = withoutExcluded
      }

      // 4. Filter by availability
      if (options.respect_room_capacity) {
        filtered = filtered.filter((cp: any) =>
          cp.total_seats === null || cp.filled_seats < cp.total_seats)
      }

      if (options.respect_gender_restrictions) {
        // Get student gender
        const { data: student } = await supabase
          .from('students')
          .select('profile:profiles!students_profile_id_fkey(gender)')
          .eq('id', req.student_id)
          .single()

        const gender = (student as any)?.profile?.gender
        if (gender) {
          filtered = filtered.filter((cp: any) =>
            cp.gender_restriction === 'N' || cp.gender_restriction === gender.charAt(0).toUpperCase())
        }
      }

      if (options.respect_teacher_availability) {
        // For each remaining candidate, check if teacher is available at the slot
        const availableFiltered: any[] = []
        for (const cp of filtered) {
          if (!cp.period_id) {
            availableFiltered.push(cp) // no specific period assigned, allow
            continue
          }

          // Get timetable entries for this course period's section to determine day(s)
          const { data: ttEntries } = await supabase
            .from('timetable_entries')
            .select('day_of_week, period_id')
            .eq('section_id', cp.section_id)
            .eq('academic_year_id', options.academic_year_id)
            .eq('is_active', true)

          if (!ttEntries || ttEntries.length === 0) {
            availableFiltered.push(cp) // no timetable = assume available
            continue
          }

          // Check teacher availability for each slot
          let teacherAvailable = true
          for (const entry of ttEntries) {
            const { data: avail } = await supabase
              .from('teacher_availability')
              .select('status')
              .eq('teacher_id', cp.teacher_id)
              .eq('day_of_week', entry.day_of_week)
              .eq('period_id', entry.period_id)
              .eq('academic_year_id', options.academic_year_id)
              .eq('status', 'unavailable')
              .limit(1)

            if (avail && avail.length > 0) {
              teacherAvailable = false
              break
            }
          }

          if (teacherAvailable) availableFiltered.push(cp)
        }
        filtered = availableFiltered
      }

      if (filtered.length === 0) {
        result.unfilled++
        result.details.push({
          student_id: req.student_id,
          course_id: req.course_id,
          status: 'unfilled',
          reason: 'No course periods match preferences or availability',
        })
        await supabase.from('schedule_requests').update({ status: 'unfilled' }).eq('id', req.id)
        continue
      }

      // 5. Pick best candidate: most remaining seats, then fewest conflicts
      // Sort by remaining capacity descending
      filtered.sort((a: any, b: any) => {
        const remA = a.total_seats ? (a.total_seats - a.filled_seats) : 9999
        const remB = b.total_seats ? (b.total_seats - b.filled_seats) : 9999
        return remB - remA
      })

      // Try enrolling in order until one succeeds (no conflict)
      let enrolled = false
      for (const cp of filtered) {
        const enrollResult = await enrollStudent(options.school_id, {
          student_id: req.student_id,
          course_id: req.course_id,
          course_period_id: cp.id,
          academic_year_id: options.academic_year_id,
          marking_period_id: req.marking_period_id,
          campus_id: options.campus_id,
        })

        if (enrollResult.success) {
          result.fulfilled++
          result.details.push({
            student_id: req.student_id,
            course_id: req.course_id,
            status: 'fulfilled',
            course_period_id: cp.id,
          })

          // Update request status
          await supabase
            .from('schedule_requests')
            .update({
              status: 'fulfilled',
              fulfilled_course_period_id: cp.id,
            })
            .eq('id', req.id)

          enrolled = true
          break
        }
      }

      if (!enrolled) {
        result.unfilled++
        result.details.push({
          student_id: req.student_id,
          course_id: req.course_id,
          status: 'unfilled',
          reason: 'All candidate course periods had conflicts or were full',
        })
        await supabase.from('schedule_requests').update({ status: 'unfilled' }).eq('id', req.id)
      }
    }

    return { success: true, data: result }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// TIMETABLE TEMPLATES
// ──────────────────────────────────────────────────────────────────────────

export const getTemplates = async (
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<TimetableTemplate[]>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    let query = supabase
      .from('timetable_templates')
      .select(`
        *,
        grade_level:grade_levels(id, name),
        entries:timetable_template_entries(
          id, subject_id, period_id, day_of_week, room_id, teacher_id,
          subject:subjects(id, name, code),
          period:periods(id, period_name, period_number, start_time, end_time),
          room:rooms(id, name),
          teacher:staff(id, profile:profiles!profile_id(first_name, last_name))
        )
      `)
      .eq('school_id', mainSchoolId)
      .order('name')

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return { success: true, data: (data || []) as TimetableTemplate[] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const createTemplate = async (
  schoolId: string,
  dto: CreateTemplateDTO,
  createdBy?: string
): Promise<ApiResponse<TimetableTemplate>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // Create template
    const { data: template, error: tErr } = await supabase
      .from('timetable_templates')
      .insert({
        school_id: mainSchoolId,
        campus_id: dto.campus_id || null,
        name: dto.name,
        description: dto.description || null,
        grade_level_id: dto.grade_level_id || null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (tErr) throw tErr

    // Insert entries if provided
    if (dto.entries && dto.entries.length > 0) {
      const rows = dto.entries.map((e) => ({
        template_id: template.id,
        subject_id: e.subject_id || null,
        period_id: e.period_id || null,
        day_of_week: e.day_of_week,
        room_id: e.room_id || null,
        teacher_id: e.teacher_id || null,
      }))

      await supabase.from('timetable_template_entries').insert(rows)
    }

    return { success: true, data: template as TimetableTemplate }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Save existing section timetable as a template.
 */
export const saveTemplateFromSection = async (
  schoolId: string,
  dto: SaveTemplateFromSectionDTO,
  createdBy?: string
): Promise<ApiResponse<TimetableTemplate>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // Get existing timetable entries for section
    const { data: entries, error: eErr } = await supabase
      .from('timetable_entries')
      .select('subject_id, period_id, day_of_week, room_id, teacher_id')
      .eq('section_id', dto.section_id)
      .eq('academic_year_id', dto.academic_year_id)
      .eq('is_active', true)

    if (eErr) throw eErr
    if (!entries || entries.length === 0) {
      return { success: false, error: 'No timetable entries found for this section' }
    }

    // Get section's grade level
    const { data: section } = await supabase
      .from('sections')
      .select('grade_level_id')
      .eq('id', dto.section_id)
      .single()

    return createTemplate(mainSchoolId, {
      name: dto.name,
      description: dto.description,
      grade_level_id: section?.grade_level_id,
      campus_id: dto.campus_id,
      entries: entries.map((e: any) => ({
        subject_id: e.subject_id,
        period_id: e.period_id,
        day_of_week: e.day_of_week,
        room_id: e.room_id,
        teacher_id: e.teacher_id,
      })),
    }, createdBy)
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Apply a template to a section — create timetable entries from template.
 */
export const applyTemplate = async (
  schoolId: string,
  dto: ApplyTemplateDTO
): Promise<ApiResponse<{ entries_created: number }>> => {
  try {
    const mainSchoolId = await getMainSchoolId(schoolId)

    // Get template entries
    const { data: template, error: tErr } = await supabase
      .from('timetable_templates')
      .select(`
        id,
        entries:timetable_template_entries(*)
      `)
      .eq('id', dto.template_id)
      .single()

    if (tErr) throw tErr
    if (!template) return { success: false, error: 'Template not found' }

    const templateEntries = (template as any).entries || []
    if (templateEntries.length === 0) {
      return { success: false, error: 'Template has no entries' }
    }

    // Optionally clear existing timetable for section
    if (dto.clear_existing) {
      await supabase
        .from('timetable_entries')
        .delete()
        .eq('section_id', dto.section_id)
        .eq('academic_year_id', dto.academic_year_id)
    }

    // Create timetable entries from template
    const rows = templateEntries.map((e: any) => ({
      school_id: mainSchoolId,
      section_id: dto.section_id,
      subject_id: e.subject_id,
      teacher_id: e.teacher_id,
      period_id: e.period_id,
      day_of_week: e.day_of_week,
      room_id: e.room_id,
      academic_year_id: dto.academic_year_id,
      is_active: true,
    }))

    const { data: created, error: cErr } = await supabase
      .from('timetable_entries')
      .insert(rows)
      .select()

    if (cErr) throw cErr

    return { success: true, data: { entries_created: (created || []).length } }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const deleteTemplate = async (id: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('timetable_templates')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { success: true, data: undefined }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
