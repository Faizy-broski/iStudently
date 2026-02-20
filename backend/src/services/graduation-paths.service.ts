import { supabase } from '../config/supabase'
import type {
  GraduationPath,
  GraduationPathGradeLevel,
  GraduationPathSubject,
  GraduationPathStudent,
  CreateGraduationPathDTO,
  UpdateGraduationPathDTO,
} from '../types/grades.types'

// ============================================================================
// GRADUATION PATHS SERVICE
// ============================================================================

class GraduationPathsService {

  // ──────────────────────────────────────────────────────────────────────────
  // PATHS CRUD
  // ──────────────────────────────────────────────────────────────────────────

  async getGraduationPaths(schoolId: string, campusId?: string): Promise<GraduationPath[]> {
    let query = supabase
      .from('graduation_paths')
      .select(`
        *,
        grade_levels:graduation_path_grade_levels(
          id, grade_level_id,
          grade_level:grade_levels(id, name, order_index)
        ),
        subjects:graduation_path_subjects(
          id, subject_id, credits,
          subject:subjects(id, name, code)
        ),
        students:graduation_path_students(
          id, student_id,
          student:students(id, student_number, profile:profiles(first_name, last_name))
        )
      `)
      .eq('school_id', schoolId)

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query.order('title')

    if (error) throw new Error(`Failed to fetch graduation paths: ${error.message}`)

    // Add counts
    return (data || []).map((p: any) => ({
      ...p,
      grade_level_count: p.grade_levels?.length || 0,
      subject_count: p.subjects?.length || 0,
      student_count: p.students?.length || 0,
    })) as GraduationPath[]
  }

  async getGraduationPath(id: string): Promise<GraduationPath | null> {
    const { data, error } = await supabase
      .from('graduation_paths')
      .select(`
        *,
        grade_levels:graduation_path_grade_levels(
          id, grade_level_id,
          grade_level:grade_levels(id, name, order_index)
        ),
        subjects:graduation_path_subjects(
          id, subject_id, credits,
          subject:subjects(id, name, code)
        ),
        students:graduation_path_students(
          id, student_id,
          student:students(id, student_number, profile:profiles(first_name, last_name))
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch graduation path: ${error.message}`)
    }
    return {
      ...data,
      grade_level_count: data.grade_levels?.length || 0,
      subject_count: data.subjects?.length || 0,
      student_count: data.students?.length || 0,
    } as GraduationPath
  }

  async createGraduationPath(schoolId: string, dto: CreateGraduationPathDTO, createdBy?: string): Promise<GraduationPath> {
    const { data, error } = await supabase
      .from('graduation_paths')
      .insert({
        school_id: schoolId,
        title: dto.title,
        comment: dto.comment || null,
        created_by: createdBy || null,
        campus_id: dto.campus_id || null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create graduation path: ${error.message}`)
    return data as GraduationPath
  }

  async updateGraduationPath(id: string, dto: UpdateGraduationPathDTO): Promise<GraduationPath> {
    const updates: Record<string, any> = {}
    if (dto.title !== undefined) updates.title = dto.title
    if (dto.comment !== undefined) updates.comment = dto.comment
    if (dto.is_active !== undefined) updates.is_active = dto.is_active

    const { data, error } = await supabase
      .from('graduation_paths')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update graduation path: ${error.message}`)
    return data as GraduationPath
  }

  async deleteGraduationPath(id: string): Promise<void> {
    const { error } = await supabase
      .from('graduation_paths')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete graduation path: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GRADE LEVELS ASSIGNMENT
  // ──────────────────────────────────────────────────────────────────────────

  async getPathGradeLevels(pathId: string): Promise<GraduationPathGradeLevel[]> {
    const { data, error } = await supabase
      .from('graduation_path_grade_levels')
      .select(`
        *,
        grade_level:grade_levels(id, name, order_index)
      `)
      .eq('graduation_path_id', pathId)

    if (error) throw new Error(`Failed to fetch path grade levels: ${error.message}`)
    return (data || []) as GraduationPathGradeLevel[]
  }

  async assignGradeLevels(pathId: string, gradeLevelIds: string[]): Promise<GraduationPathGradeLevel[]> {
    if (gradeLevelIds.length === 0) return []

    const rows = gradeLevelIds.map(glId => ({
      graduation_path_id: pathId,
      grade_level_id: glId,
    }))

    const { data, error } = await supabase
      .from('graduation_path_grade_levels')
      .upsert(rows, { onConflict: 'graduation_path_id,grade_level_id' })
      .select(`
        *,
        grade_level:grade_levels(id, name, order_index)
      `)

    if (error) throw new Error(`Failed to assign grade levels: ${error.message}`)
    return (data || []) as GraduationPathGradeLevel[]
  }

  async removeGradeLevel(pathId: string, gradeLevelId: string): Promise<void> {
    const { error } = await supabase
      .from('graduation_path_grade_levels')
      .delete()
      .eq('graduation_path_id', pathId)
      .eq('grade_level_id', gradeLevelId)

    if (error) throw new Error(`Failed to remove grade level: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SUBJECTS ASSIGNMENT
  // ──────────────────────────────────────────────────────────────────────────

  async getPathSubjects(pathId: string): Promise<GraduationPathSubject[]> {
    const { data, error } = await supabase
      .from('graduation_path_subjects')
      .select(`
        *,
        subject:subjects(id, name, code)
      `)
      .eq('graduation_path_id', pathId)

    if (error) throw new Error(`Failed to fetch path subjects: ${error.message}`)
    return (data || []) as GraduationPathSubject[]
  }

  async assignSubjects(pathId: string, items: { subject_id: string; credits: number }[]): Promise<GraduationPathSubject[]> {
    if (items.length === 0) return []

    const rows = items.map(item => ({
      graduation_path_id: pathId,
      subject_id: item.subject_id,
      credits: item.credits,
    }))

    const { data, error } = await supabase
      .from('graduation_path_subjects')
      .upsert(rows, { onConflict: 'graduation_path_id,subject_id' })
      .select(`
        *,
        subject:subjects(id, name, code)
      `)

    if (error) throw new Error(`Failed to assign subjects: ${error.message}`)
    return (data || []) as GraduationPathSubject[]
  }

  async updateSubjectCredits(pathId: string, subjectId: string, credits: number): Promise<GraduationPathSubject> {
    const { data, error } = await supabase
      .from('graduation_path_subjects')
      .update({ credits })
      .eq('graduation_path_id', pathId)
      .eq('subject_id', subjectId)
      .select(`
        *,
        subject:subjects(id, name, code)
      `)
      .single()

    if (error) throw new Error(`Failed to update subject credits: ${error.message}`)
    return data as GraduationPathSubject
  }

  async removeSubject(pathId: string, subjectId: string): Promise<void> {
    const { error } = await supabase
      .from('graduation_path_subjects')
      .delete()
      .eq('graduation_path_id', pathId)
      .eq('subject_id', subjectId)

    if (error) throw new Error(`Failed to remove subject: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STUDENTS ASSIGNMENT
  // ──────────────────────────────────────────────────────────────────────────

  async getPathStudents(pathId: string): Promise<GraduationPathStudent[]> {
    const { data, error } = await supabase
      .from('graduation_path_students')
      .select(`
        *,
        student:students(id, student_number, profile:profiles(first_name, last_name))
      `)
      .eq('graduation_path_id', pathId)

    if (error) throw new Error(`Failed to fetch path students: ${error.message}`)
    return (data || []) as GraduationPathStudent[]
  }

  async assignStudents(pathId: string, studentIds: string[]): Promise<GraduationPathStudent[]> {
    if (studentIds.length === 0) return []

    const rows = studentIds.map(sid => ({
      graduation_path_id: pathId,
      student_id: sid,
    }))

    const { data, error } = await supabase
      .from('graduation_path_students')
      .upsert(rows, { onConflict: 'graduation_path_id,student_id' })
      .select(`
        *,
        student:students(id, student_number, profile:profiles(first_name, last_name))
      `)

    if (error) throw new Error(`Failed to assign students: ${error.message}`)
    return (data || []) as GraduationPathStudent[]
  }

  async removeStudent(pathId: string, studentId: string): Promise<void> {
    const { error } = await supabase
      .from('graduation_path_students')
      .delete()
      .eq('graduation_path_id', pathId)
      .eq('student_id', studentId)

    if (error) throw new Error(`Failed to remove student: ${error.message}`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STUDENT CREDITS DETAIL
  // Compute credits earned by a student for a given graduation path
  // by looking at final_grades for the path's subjects across all years
  // ──────────────────────────────────────────────────────────────────────────

  async getStudentCredits(pathId: string, studentId: string): Promise<{
    subject_id: string
    subject_name: string
    credits_required: number
    credits_earned: number
  }[]> {
    // 1. Get path subjects
    const { data: pathSubjects, error: psErr } = await supabase
      .from('graduation_path_subjects')
      .select('subject_id, credits, subject:subjects(id, name)')
      .eq('graduation_path_id', pathId)

    if (psErr) throw new Error(`Failed to fetch path subjects: ${psErr.message}`)

    // 2. For each subject, sum credits from final_grades via course → subject link
    const results = []
    for (const ps of (pathSubjects || [])) {
      // Find courses linked to this subject
      const { data: courses } = await supabase
        .from('courses')
        .select('id, credit_hours')
        .eq('subject_id', ps.subject_id)

      const courseIds = (courses || []).map((c: any) => c.id)
      let creditsEarned = 0

      if (courseIds.length > 0) {
        // Find course_periods for these courses
        const { data: cps } = await supabase
          .from('course_periods')
          .select('id')
          .in('course_id', courseIds)

        const cpIds = (cps || []).map((cp: any) => cp.id)

        if (cpIds.length > 0) {
          // Sum credits from final_grades where student passed
          const { data: grades } = await supabase
            .from('final_grades')
            .select('course_period_id, grade_percent')
            .eq('student_id', studentId)
            .in('course_period_id', cpIds)

          // Count each passed final grade's course credit_hours
          for (const grade of (grades || [])) {
            // Find course for this course_period
            const cp = (cps || []).find((c: any) => c.id === grade.course_period_id)
            if (cp) {
              const course = (courses || []).find((c: any) => c.id)
              creditsEarned += course?.credit_hours || 0
            }
          }
        }
      }

      const subjectData = ps.subject as any
      results.push({
        subject_id: ps.subject_id,
        subject_name: subjectData?.name || 'Unknown',
        credits_required: ps.credits,
        credits_earned: creditsEarned,
      })
    }

    return results
  }
}

export const graduationPathsService = new GraduationPathsService()
