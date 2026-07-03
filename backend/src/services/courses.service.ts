import { supabase } from '../config/supabase'
import type {
  Course,
  CoursePeriod,
  CreateCourseDTO,
  UpdateCourseDTO,
  CreateCoursePeriodDTO,
  UpdateCoursePeriodDTO,
} from '../types/grades.types'

// ============================================================================
// COURSES SERVICE
// ============================================================================

// Maps the single-character day code used in course_periods.days → day_of_week int
const DAY_CHAR_MAP: Record<string, number> = {
  M: 0, // Monday
  T: 1, // Tuesday
  W: 2, // Wednesday
  R: 3, // Thursday
  F: 4, // Friday
  S: 5, // Saturday
  U: 6, // Sunday
}

function parseDays(days: string | null | undefined): number[] {
  if (!days) return []
  return days.split('').filter(d => d in DAY_CHAR_MAP).map(d => DAY_CHAR_MAP[d])
}

class CoursesService {

  // ──────────────────────────────────────────────────────────────────────────
  // COURSES CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async getCourses(schoolId: string, academicYearId?: string, campusId?: string): Promise<Course[]> {
    let query = supabase
      .from('courses')
      .select(`
        *,
        subject:subjects(id, name, code, subject_type),
        academic_year:academic_years(id, name),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('school_id', schoolId)
      .order('title')

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId)
    }
    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch courses: ${error.message}`)
    return (data || []) as Course[]
  }

  async getCourseById(id: string): Promise<Course | null> {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        subject:subjects(id, name, code, subject_type),
        academic_year:academic_years(id, name),
        grading_scale:grading_scales(id, title, type),
        course_periods(
          id, teacher_id, section_id, period_id, marking_period_id,
          grading_scale_id, title, short_name, does_breakoff, is_active,
          teacher:staff(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
          section:sections(id, name, grade_level_id)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch course: ${error.message}`)
    }
    return data as Course
  }

  async createCourse(schoolId: string, dto: CreateCourseDTO, createdBy?: string): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id || null,
        subject_id: dto.subject_id,
        name: dto.title,
        title: dto.title,
        short_name: dto.short_name,
        academic_year_id: dto.academic_year_id,
        grading_scale_id: dto.grading_scale_id,
        credit_hours: dto.credit_hours || 1.00,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create course: ${error.message}`)
    return data as Course
  }

  async updateCourse(id: string, dto: UpdateCourseDTO): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update course: ${error.message}`)
    return data as Course
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete course: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // COURSE PERIODS CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async getAllCoursePeriods(schoolId: string, campusId?: string): Promise<CoursePeriod[]> {
    // Course periods always keep school_id = the top-level school (see createCoursePeriod below);
    // campus_id is a separate nullable column, same convention as getCourses() above.
    let query = supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, short_name, subject_id),
        teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        period:periods(id, period_name, period_number),
        marking_period:marking_periods(id, title, short_name, mp_type)
      `)
      .eq('school_id', schoolId)
      .order('title')

    if (campusId) query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
  }

  async getCoursePeriods(courseId: string): Promise<CoursePeriod[]> {
    const { data, error } = await supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, subject_id, subjects:subjects(id, name, code)),
        teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        secondary_teacher:staff!secondary_teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        period:periods(id, period_name, period_number, start_time, end_time),
        marking_period:marking_periods(id, title, short_name, mp_type),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('course_id', courseId)
      .order('title')

    if (error) throw new Error(`Failed to fetch course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
  }

  async getCoursePeriodById(id: string): Promise<CoursePeriod | null> {
    const { data, error } = await supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, subject_id, grading_scale_id, credit_hours, subjects:subjects(id, name, code)),
        teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        secondary_teacher:staff!secondary_teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        period:periods(id, period_name, period_number, start_time, end_time),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch course period: ${error.message}`)
    }
    return data as CoursePeriod
  }

  // ── Timetable auto-sync helpers ────────────────────────────────────────────
  //
  // When a course period has period_id + section_id + days set, the system
  // automatically maintains matching rows in timetable_entries so that teacher
  // and student schedule views reflect the setup without manual timetable entry.
  //
  // Strategy (no DB migration required):
  //   • Composite key: (school_id, academic_year_id, section_id, period_id,
  //                      teacher_id, subject_id) identifies the slot.
  //   • On create  → insert one timetable_entry per day in `days` string.
  //   • On update  → delete entries for OLD slot key, insert for NEW slot key.
  //   • On delete  → delete entries for the slot key.
  //
  // Sync failures are logged but never propagate — course period CRUD must
  // never fail because of a timetable sync problem.

  private async fetchCPForSync(id: string): Promise<{
    id: string
    school_id: string
    campus_id: string | null
    academic_year_id: string
    section_id: string | null
    period_id: string | null
    teacher_id: string
    days: string | null
    room: string | null
    subject_id: string | null
  } | null> {
    const { data } = await supabase
      .from('course_periods')
      .select(`
        id, school_id, campus_id, academic_year_id,
        section_id, period_id, teacher_id, days, room,
        course:courses!course_id(subject_id)
      `)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return {
      ...(data as any),
      subject_id: (data as any).course?.subject_id ?? null,
    }
  }

  private async deleteTimetableSlot(
    schoolId: string,
    academicYearId: string,
    sectionId: string,
    periodId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<void> {
    await supabase
      .from('timetable_entries')
      .delete()
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .eq('section_id', sectionId)
      .eq('period_id', periodId)
      .eq('teacher_id', teacherId)
      .eq('subject_id', subjectId)
  }

  private async insertTimetableSlot(cp: {
    school_id: string
    campus_id: string | null
    academic_year_id: string
    section_id: string
    period_id: string
    teacher_id: string
    subject_id: string
    days: string
    room: string | null
  }): Promise<void> {
    const dayOfWeeks = parseDays(cp.days)
    if (dayOfWeeks.length === 0) return

    const entries = dayOfWeeks.map(day => ({
      school_id: cp.school_id,
      campus_id: cp.campus_id,
      academic_year_id: cp.academic_year_id,
      section_id: cp.section_id,
      subject_id: cp.subject_id,
      teacher_id: cp.teacher_id,
      period_id: cp.period_id,
      day_of_week: day,
      room_number: cp.room,
      created_by: null,
    }))

    const { error } = await supabase.from('timetable_entries').insert(entries)
    // Ignore duplicate-key errors — the entry already exists; anything else log
    if (error && error.code !== '23505') {
      console.error('[syncTimetable] insert error:', error.message)
    }
  }

  private async syncTimetableOnCreate(cpId: string): Promise<void> {
    try {
      const cp = await this.fetchCPForSync(cpId)
      if (!cp || !cp.period_id || !cp.section_id || !cp.days || !cp.subject_id) return
      await this.insertTimetableSlot({
        school_id: cp.school_id,
        campus_id: cp.campus_id,
        academic_year_id: cp.academic_year_id,
        section_id: cp.section_id,
        period_id: cp.period_id,
        teacher_id: cp.teacher_id,
        subject_id: cp.subject_id,
        days: cp.days,
        room: cp.room,
      })
    } catch (e) {
      console.error('[syncTimetable] onCreate failed:', e)
    }
  }

  private async syncTimetableOnUpdate(cpId: string, oldCp: {
    school_id: string
    academic_year_id: string
    section_id: string | null
    period_id: string | null
    teacher_id: string
    subject_id: string | null
  }): Promise<void> {
    try {
      // 1. Remove entries for the OLD slot
      if (oldCp.section_id && oldCp.period_id && oldCp.subject_id) {
        await this.deleteTimetableSlot(
          oldCp.school_id, oldCp.academic_year_id,
          oldCp.section_id, oldCp.period_id,
          oldCp.teacher_id, oldCp.subject_id,
        )
      }
      // 2. Insert entries for the NEW slot
      const newCp = await this.fetchCPForSync(cpId)
      if (!newCp || !newCp.period_id || !newCp.section_id || !newCp.days || !newCp.subject_id) return
      await this.insertTimetableSlot({
        school_id: newCp.school_id,
        campus_id: newCp.campus_id,
        academic_year_id: newCp.academic_year_id,
        section_id: newCp.section_id,
        period_id: newCp.period_id,
        teacher_id: newCp.teacher_id,
        subject_id: newCp.subject_id,
        days: newCp.days,
        room: newCp.room,
      })
    } catch (e) {
      console.error('[syncTimetable] onUpdate failed:', e)
    }
  }

  private async syncTimetableOnDelete(cp: {
    school_id: string
    academic_year_id: string
    section_id: string | null
    period_id: string | null
    teacher_id: string
    subject_id: string | null
  }): Promise<void> {
    try {
      if (!cp.section_id || !cp.period_id || !cp.subject_id) return
      await this.deleteTimetableSlot(
        cp.school_id, cp.academic_year_id,
        cp.section_id, cp.period_id,
        cp.teacher_id, cp.subject_id,
      )
    } catch (e) {
      console.error('[syncTimetable] onDelete failed:', e)
    }
  }

  // ── Course Period CRUD ─────────────────────────────────────────────────────

  async createCoursePeriod(schoolId: string, dto: CreateCoursePeriodDTO, createdBy?: string): Promise<CoursePeriod> {
    // ── Auto-generate short_name when not supplied ────────────────────────────
    // Each course period must have a short_name so multiple periods for the
    // same teacher/course remain distinguishable (e.g. "P1", "P2", "ara1").
    let shortName = dto.short_name?.trim() || null
    if (!shortName) {
      const { count } = await supabase
        .from('course_periods')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', dto.course_id)
        .eq('teacher_id', dto.teacher_id)
      shortName = `P${(count ?? 0) + 1}`
    }

    // ── Friendly duplicate detection ──────────────────────────────────────────
    // If a period_id is specified, check whether this teacher already teaches
    // this course in that same period slot (avoids a cryptic DB constraint error).
    if (dto.period_id) {
      let query = supabase
        .from('course_periods')
        .select('id, short_name, days')
        .eq('course_id', dto.course_id)
        .eq('teacher_id', dto.teacher_id)
        .eq('period_id', dto.period_id)

      if (dto.marking_period_id) {
        query = query.eq('marking_period_id', dto.marking_period_id)
      } else {
        query = query.is('marking_period_id', null)
      }

      const { data: existingPeriods } = await query

      if (existingPeriods && existingPeriods.length > 0) {
        // Check for day overlaps
        const hasConflict = existingPeriods.some(existing => {
          // If either has no specific days defined (null/empty), assume it meets every day and thus conflicts
          if (!existing.days || !dto.days) return true
          
          // Otherwise, check for any intersecting characters (e.g. 'MWF' vs 'TR')
          const existingDays = existing.days.split('')
          const newDays = dto.days.split('')
          return existingDays.some(day => newDays.includes(day))
        })

        if (hasConflict) {
          const conflictNames = existingPeriods.map(e => e.short_name || e.id).join(', ')
          throw new Error(
            `This teacher is already assigned to this course for that period slot on overlapping days (${conflictNames}). ` +
            `Please choose different meeting days, a different period, or edit the existing one.`
          )
        }
      }
    }

    const { data, error } = await supabase
      .from('course_periods')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id,
        course_id: dto.course_id,
        teacher_id: dto.teacher_id,
        secondary_teacher_id: dto.secondary_teacher_id || null,
        section_id: dto.section_id || null,
        period_id: dto.period_id || null,
        marking_period_id: dto.marking_period_id || null,
        grading_scale_id: dto.grading_scale_id || null,
        title: dto.title || shortName,
        short_name: shortName,
        does_breakoff: dto.does_breakoff || false,
        does_honor_roll: dto.does_honor_roll !== false, // default true
        takes_attendance: dto.takes_attendance || false,
        calendar_id: dto.calendar_id || null,
        allow_teacher_grade_scale: dto.allow_teacher_grade_scale || false,
        credits: dto.credits ?? null,
        affects_class_rank: dto.affects_class_rank || false,
        parent_course_period_id: dto.parent_course_period_id || null,
        room: dto.room || null,
        total_seats: dto.total_seats ?? null,
        days: dto.days || null,
        gender_restriction: dto.gender_restriction || 'N',
        academic_year_id: dto.academic_year_id,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) {
      // Surface a user-friendly message when the DB constraint fires anyway
      if (error.code === '23505') {
        throw new Error(
          'A course period with this teacher and period slot already exists. ' +
          'Please select a different period slot or use the Short Name field to differentiate.'
        )
      }
      throw new Error(`Failed to create course period: ${error.message}`)
    }

    // Non-blocking timetable sync — fire and forget; errors are logged inside
    this.syncTimetableOnCreate((data as CoursePeriod).id)

    return data as CoursePeriod
  }

  async updateCoursePeriod(id: string, dto: UpdateCoursePeriodDTO): Promise<CoursePeriod> {
    // Snapshot the OLD slot before applying changes so sync can remove stale entries
    const oldSnap = await this.fetchCPForSync(id)
    const oldSlot = oldSnap
      ? {
          school_id: oldSnap.school_id,
          academic_year_id: oldSnap.academic_year_id,
          section_id: oldSnap.section_id,
          period_id: oldSnap.period_id,
          teacher_id: oldSnap.teacher_id,
          subject_id: oldSnap.subject_id,
        }
      : null

    const { data, error } = await supabase
      .from('course_periods')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update course period: ${error.message}`)

    // Non-blocking timetable sync
    if (oldSlot) this.syncTimetableOnUpdate(id, oldSlot)

    return data as CoursePeriod
  }

  async deleteCoursePeriod(id: string): Promise<void> {
    // Snapshot slot info before deletion so we can clean up timetable entries
    const snap = await this.fetchCPForSync(id)

    const { error } = await supabase
      .from('course_periods')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete course period: ${error.message}`)

    // Non-blocking timetable cleanup
    if (snap) {
      this.syncTimetableOnDelete({
        school_id: snap.school_id,
        academic_year_id: snap.academic_year_id,
        section_id: snap.section_id,
        period_id: snap.period_id,
        teacher_id: snap.teacher_id,
        subject_id: snap.subject_id,
      })
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // QUERY HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all course periods taught by a specific teacher.
   */
  async getCoursePeriodsByTeacher(teacherId: string, academicYearId?: string, markingPeriodId?: string): Promise<CoursePeriod[]> {
    let query = supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        period:periods(id, period_name, period_number, start_time, end_time),
        marking_period:marking_periods(id, title, short_name, mp_type),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId)
    }
    if (markingPeriodId) {
      query = query.eq('marking_period_id', markingPeriodId)
    }

    const { data, error } = await query.order('title')
    if (error) throw new Error(`Failed to fetch teacher course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
  }

  /**
   * Get students enrolled in a course period's section.
   * Verifies the course period belongs to the requesting teacher.
   */
  async getStudentsByCoursePeriod(cpId: string, teacherId: string): Promise<any[]> {
    // Fetch course period and verify teacher ownership
    const { data: cp, error: cpErr } = await supabase
      .from('course_periods')
      .select('id, section_id, school_id, teacher_id')
      .eq('id', cpId)
      .single()

    if (cpErr || !cp) throw new Error('Course period not found')
    if (cp.teacher_id !== teacherId) throw new Error('Access denied: not your course period')
    if (!cp.section_id) return []

    const { data, error } = await supabase
      .from('students')
      .select(`
        id,
        student_number,
        section_id,
        is_active,
        profile:profiles!profile_id(first_name, last_name, email, phone)
      `)
      .eq('section_id', cp.section_id)
      .eq('school_id', cp.school_id)
      .eq('is_active', true)

    if (error) throw new Error(`Failed to fetch students: ${error.message}`)
    return data || []
  }

  /**
   * Get all course periods a student is enrolled in (via section).
   */
  async getCoursePeriodsByStudent(studentId: string, academicYearId?: string): Promise<CoursePeriod[]> {
    // First get the student's section(s) from enrollment
    const { data: enrollment, error: enrollErr } = await supabase
      .from('student_enrollment')
      .select('section_id')
      .eq('student_id', studentId)
      .order('start_date', { ascending: false })
      .limit(1)
      .single()

    if (enrollErr || !enrollment?.section_id) {
      // Fallback: try students table directly
      const { data: student } = await supabase
        .from('students')
        .select('section_id')
        .eq('id', studentId)
        .single()

      if (!student?.section_id) return []

      let query = supabase
        .from('course_periods')
        .select(`
          *,
          course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
          teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
          grading_scale:grading_scales(id, title, type)
        `)
        .eq('section_id', student.section_id)
        .eq('is_active', true)

      if (academicYearId) query = query.eq('academic_year_id', academicYearId)
      const { data, error } = await query.order('title')
      if (error) throw new Error(`Failed to fetch student course periods: ${error.message}`)
      return (data || []) as CoursePeriod[]
    }

    let query = supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
        teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('section_id', enrollment.section_id)
      .eq('is_active', true)

    if (academicYearId) query = query.eq('academic_year_id', academicYearId)
    const { data, error } = await query.order('title')
    if (error) throw new Error(`Failed to fetch student course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
  }

  /**
   * Get all course periods available to assign for a section's timetable slot.
   * In RosarioSIS architecture, course_periods.section_id is NULL — they belong to a
   * teacher + course, not directly to a section. We resolve by school + academic year.
   */
  async getCoursePeriodsBySection(sectionId: string, academicYearId?: string, schoolId?: string): Promise<CoursePeriod[]> {
    // Resolve school_id from section if not provided
    let resolvedSchoolId = schoolId
    if (!resolvedSchoolId) {
      const { data: section } = await supabase
        .from('sections')
        .select('school_id')
        .eq('id', sectionId)
        .single()
      resolvedSchoolId = section?.school_id
    }

    if (!resolvedSchoolId) throw new Error('Could not resolve school_id for section')

    let query = supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, short_name, subject:subjects(id, name, code)),
        teacher:staff!teacher_id(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
        period:periods(id, period_name, period_number, start_time, end_time),
        marking_period:marking_periods(id, title, short_name, mp_type)
      `)
      .eq('school_id', resolvedSchoolId)
      .eq('is_active', true)

    if (academicYearId) query = query.eq('academic_year_id', academicYearId)
    const { data, error } = await query.order('title')
    if (error) throw new Error(`Failed to fetch section course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
  }

  /**
   * Sync courses and course_periods from existing teacher_subject_assignments.
   */
  async syncFromTeacherAssignments(schoolId: string, academicYearId: string): Promise<{ courses_created: number; course_periods_created: number }> {
    // Get all teacher-subject assignments for this year
    const { data: tsas, error: tsaErr } = await supabase
      .from('teacher_subject_assignments')
      .select('*, subject:subjects(id, name, code)')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)

    if (tsaErr) throw new Error(`Failed to fetch teacher assignments: ${tsaErr.message}`)
    if (!tsas || tsas.length === 0) return { courses_created: 0, course_periods_created: 0 }

    // Get default grading scale
    const { data: defaultScale } = await supabase
      .from('grading_scales')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_default', true)
      .limit(1)
      .single()

    const defaultScaleId = defaultScale?.id || null

    // Group by subject to create courses
    const subjectMap = new Map<string, { name: string; code: string; assignments: typeof tsas }>()
    for (const tsa of tsas) {
      if (!subjectMap.has(tsa.subject_id)) {
        subjectMap.set(tsa.subject_id, {
          name: tsa.subject?.name || 'Unknown',
          code: tsa.subject?.code || '',
          assignments: [],
        })
      }
      subjectMap.get(tsa.subject_id)!.assignments.push(tsa)
    }

    let coursesCreated = 0
    let cpsCreated = 0

    for (const [subjectId, info] of subjectMap) {
      // Upsert course
      const { data: course, error: cErr } = await supabase
        .from('courses')
        .upsert({
          school_id: schoolId,
          subject_id: subjectId,
          title: info.name,
          short_name: info.code,
          academic_year_id: academicYearId,
          grading_scale_id: defaultScaleId,
        }, { onConflict: 'school_id,subject_id,academic_year_id' })
        .select('id')
        .single()

      if (cErr) {
        console.warn(`Failed to upsert course for subject ${subjectId}: ${cErr.message}`)
        continue
      }

      coursesCreated++

      // Create course_periods from each teacher-section pair
      for (const tsa of info.assignments) {
        const { error: cpErr } = await supabase
          .from('course_periods')
          .upsert({
            school_id: schoolId,
            course_id: course.id,
            teacher_id: tsa.teacher_id,
            section_id: tsa.section_id,
            grading_scale_id: defaultScaleId,
            academic_year_id: academicYearId,
            title: info.name,
            short_name: info.code,
          }, { onConflict: 'course_id,section_id,teacher_id,period_id' })

        if (cpErr) {
          console.warn(`Failed to upsert course period: ${cpErr.message}`)
          continue
        }
        cpsCreated++
      }
    }

    return { courses_created: coursesCreated, course_periods_created: cpsCreated }
  }
}

export const coursesService = new CoursesService()
