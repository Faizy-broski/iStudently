import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'

// ============================================================================
// TYPES
// ============================================================================

export interface ExamType {
  id: string
  school_id: string
  name: string
  description?: string
  weightage: number
  is_active: boolean
}

export interface Exam {
  id: string
  school_id: string
  exam_type_id: string
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  exam_name: string
  exam_date?: string
  duration_minutes?: number
  max_marks: number
  passing_marks: number
  grading_scale?: string
  instructions?: string
  is_published: boolean
  is_completed: boolean
  created_at: string
  updated_at: string
  
  // Joined fields
  exam_type?: ExamType
  section?: any
  subject?: any
  academic_year?: any
}

export interface ExamResult {
  id: string
  school_id: string
  exam_id: string
  student_id: string
  marks_obtained?: number
  is_absent: boolean
  percentage?: number
  grade?: string
  remarks?: string
  marked_at?: string
  marked_by?: string
  created_at: string
  updated_at: string
  
  // Joined fields
  student?: any
}

export interface CreateExamDTO {
  school_id: string
  exam_type_id: string
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  exam_name: string
  exam_date?: string
  duration_minutes?: number
  max_marks: number
  passing_marks: number
  grading_scale?: string
  instructions?: string
}

export interface UpdateExamDTO {
  exam_name?: string
  exam_date?: string
  duration_minutes?: number
  max_marks?: number
  passing_marks?: number
  grading_scale?: string
  instructions?: string
  is_published?: boolean
  is_completed?: boolean
}

export interface RecordMarksDTO {
  exam_id: string
  student_id: string
  marks_obtained?: number
  is_absent: boolean
  remarks?: string
  marked_by: string
}

// ============================================================================
// EXAM TYPE OPERATIONS
// ============================================================================

export const getExamTypes = async (schoolId: string): Promise<ApiResponse<ExamType[]>> => {
  try {
    const { data, error } = await supabase
      .from('exam_types')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('name')

    if (error) throw error

    return {
      success: true,
      data: data as ExamType[]
    }
  } catch (error: any) {
    console.error('Error fetching exam types:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// EXAM OPERATIONS
// ============================================================================

export const getTeacherExams = async (
  teacherId: string,
  filters?: {
    section_id?: string
    subject_id?: string
    academic_year_id?: string
    is_completed?: boolean
  }
): Promise<ApiResponse<Exam[]>> => {
  try {
    let query = supabase
      .from('exams')
      .select(`
        *,
        exam_type:exam_types(id, name, weightage),
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name),
        academic_year:academic_years(id, name)
      `)
      .eq('teacher_id', teacherId)
      .order('exam_date', { ascending: false })

    if (filters?.section_id) query = query.eq('section_id', filters.section_id)
    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters?.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id)
    if (filters?.is_completed !== undefined) query = query.eq('is_completed', filters.is_completed)

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data as Exam[]
    }
  } catch (error: any) {
    console.error('Error fetching teacher exams:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createExam = async (dto: CreateExamDTO): Promise<ApiResponse<Exam>> => {
  try {
    const { data, error } = await supabase
      .from('exams')
      .insert([dto])
      .select()
      .single()

    if (error) throw error

    // Auto-create exam results for all students in the section
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', dto.section_id)
      .eq('is_active', true)

    if (studentsError) throw studentsError

    if (students && students.length > 0) {
      const resultsToInsert = students.map(student => ({
        school_id: dto.school_id,
        exam_id: data.id,
        student_id: student.id,
        is_absent: false
      }))

      const { error: resultsError } = await supabase
        .from('exam_results')
        .insert(resultsToInsert)

      if (resultsError) throw resultsError
    }

    return {
      success: true,
      data: data as Exam,
      message: 'Exam created successfully'
    }
  } catch (error: any) {
    console.error('Error creating exam:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateExam = async (
  examId: string,
  dto: UpdateExamDTO
): Promise<ApiResponse<Exam>> => {
  try {
    const { data, error } = await supabase
      .from('exams')
      .update(dto)
      .eq('id', examId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as Exam,
      message: 'Exam updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating exam:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteExam = async (examId: string): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', examId)

    if (error) throw error

    return {
      success: true,
      message: 'Exam deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting exam:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// EXAM RESULTS OPERATIONS
// ============================================================================

export const getExamResults = async (examId: string): Promise<ApiResponse<ExamResult[]>> => {
  try {
    const { data, error } = await supabase
      .from('exam_results')
      .select(`
        *,
        student:students(
          id,
          admission_number,
          profile:profiles!students_profile_id_fkey(first_name, last_name)
        )
      `)
      .eq('exam_id', examId)
      .order('student(profile(first_name))')

    if (error) throw error

    return {
      success: true,
      data: data as ExamResult[]
    }
  } catch (error: any) {
    console.error('Error fetching exam results:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const recordMarks = async (dto: RecordMarksDTO): Promise<ApiResponse<ExamResult>> => {
  try {
    // Get exam details to calculate percentage
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('max_marks, passing_marks')
      .eq('id', dto.exam_id)
      .single()

    if (examError) throw examError

    let percentage: number | undefined
    let grade: string | undefined

    if (!dto.is_absent && dto.marks_obtained !== undefined) {
      percentage = (dto.marks_obtained / exam.max_marks) * 100

      // Simple grading logic
      if (percentage >= 90) grade = 'A+'
      else if (percentage >= 80) grade = 'A'
      else if (percentage >= 70) grade = 'B+'
      else if (percentage >= 60) grade = 'B'
      else if (percentage >= 50) grade = 'C+'
      else if (percentage >= 40) grade = 'C'
      else grade = 'F'
    }

    const { data, error } = await supabase
      .from('exam_results')
      .update({
        marks_obtained: dto.marks_obtained,
        is_absent: dto.is_absent,
        percentage,
        grade,
        remarks: dto.remarks,
        marked_at: new Date().toISOString(),
        marked_by: dto.marked_by
      })
      .eq('exam_id', dto.exam_id)
      .eq('student_id', dto.student_id)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as ExamResult,
      message: 'Marks recorded successfully'
    }
  } catch (error: any) {
    console.error('Error recording marks:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
