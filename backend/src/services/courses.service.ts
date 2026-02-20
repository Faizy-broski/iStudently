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

  async createCoursePeriod(schoolId: string, dto: CreateCoursePeriodDTO, createdBy?: string): Promise<CoursePeriod> {
    const { data, error } = await supabase
      .from('course_periods')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id,
        course_id: dto.course_id,
        teacher_id: dto.teacher_id,
        secondary_teacher_id: dto.secondary_teacher_id || null,
        section_id: dto.section_id || null,
        period_id: dto.period_id,
        marking_period_id: dto.marking_period_id,
        grading_scale_id: dto.grading_scale_id,
        title: dto.title,
        short_name: dto.short_name,
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

    if (error) throw new Error(`Failed to create course period: ${error.message}`)
    return data as CoursePeriod
  }

  async updateCoursePeriod(id: string, dto: UpdateCoursePeriodDTO): Promise<CoursePeriod> {
    const { data, error } = await supabase
      .from('course_periods')
      .update(dto)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update course period: ${error.message}`)
    return data as CoursePeriod
  }

  async deleteCoursePeriod(id: string): Promise<void> {
    const { error } = await supabase
      .from('course_periods')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete course period: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // QUERY HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get all course periods taught by a specific teacher.
   */
  async getCoursePeriodsByTeacher(teacherId: string, academicYearId?: string): Promise<CoursePeriod[]> {
    let query = supabase
      .from('course_periods')
      .select(`
        *,
        course:courses(id, title, short_name, credit_hours, subject:subjects(id, name, code)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        period:periods(id, period_name, period_number, start_time, end_time),
        grading_scale:grading_scales(id, title, type)
      `)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)

    if (academicYearId) {
      query = query.eq('academic_year_id', academicYearId)
    }

    const { data, error } = await query.order('title')
    if (error) throw new Error(`Failed to fetch teacher course periods: ${error.message}`)
    return (data || []) as CoursePeriod[]
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
          teacher:staff(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
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
        teacher:staff(id, profile_id, profile:profiles!profile_id(first_name, last_name)),
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
