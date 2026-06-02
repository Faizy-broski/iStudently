import { supabase } from '../config/supabase'
import {
  Assignment,
  CreateAssignmentDTO,
  UpdateAssignmentDTO,
  AssignmentSubmission,
  SubmitAssignmentDTO,
  GradeSubmissionDTO,
  ApiResponse
} from '../types'

// ============================================================================
// ASSIGNMENT CRUD OPERATIONS
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const getAssignmentsByTeacher = async (
  teacherId: string,
  filters?: {
    section_id?: string
    subject_id?: string
    academic_year_id?: string
    is_archived?: boolean
    search?: string
    status?: 'all' | 'active' | 'upcoming' | 'past'
    page?: number
    limit?: number
  }
): Promise<ApiResponse<PaginatedResponse<Assignment>>> => {
  try {
    const page = filters?.page || 1
    const limit = filters?.limit || 10
    const offset = (page - 1) * limit

    let query = supabase
      .from('assignments')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name),
        academic_year:academic_years(id, name)
      `, { count: 'exact' })
      .eq('teacher_id', teacherId)
      .order('due_date', { ascending: false })

    if (filters?.section_id) query = query.eq('section_id', filters.section_id)
    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters?.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id)
    if (filters?.is_archived !== undefined) query = query.eq('is_archived', filters.is_archived)
    
    // Search filter
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    // Status filter based on due_date
    const today = new Date().toISOString().split('T')[0]
    if (filters?.status === 'active') {
      query = query.gte('due_date', today)
    } else if (filters?.status === 'upcoming') {
      query = query.gt('due_date', today)
    } else if (filters?.status === 'past') {
      query = query.lt('due_date', today)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        data: data as Assignment[],
        total,
        page,
        limit,
        totalPages
      }
    }
  } catch (error: any) {
    console.error('Error fetching teacher assignments:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAssignmentsBySection = async (
  sectionId: string,
  filters?: {
    subject_id?: string
    academic_year_id?: string
  }
): Promise<ApiResponse<Assignment[]>> => {
  try {
    let query = supabase
      .from('assignments')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        subject:subjects(id, name)
      `)
      .eq('section_id', sectionId)
      .eq('is_published', true)
      .eq('is_archived', false)
      .order('due_date', { ascending: true })

    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters?.academic_year_id) query = query.eq('academic_year_id', filters.academic_year_id)

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data as Assignment[]
    }
  } catch (error: any) {
    console.error('Error fetching section assignments:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAssignmentById = async (
  assignmentId: string
): Promise<ApiResponse<Assignment>> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, current_strength, grade_level:grade_levels(name)),
        subject:subjects(id, name),
        academic_year:academic_years(id, name)
      `)
      .eq('id', assignmentId)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as Assignment
    }
  } catch (error: any) {
    console.error('Error fetching assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createAssignment = async (
  dto: CreateAssignmentDTO
): Promise<ApiResponse<Assignment>> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        school_id: dto.school_id,
        campus_id: dto.campus_id,  // For multi-campus support
        teacher_id: dto.teacher_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id,
        academic_year_id: dto.academic_year_id,
        title: dto.title,
        description: dto.description,
        instructions: dto.instructions,
        assigned_date: dto.assigned_date || new Date().toISOString().split('T')[0],
        due_date: dto.due_date,
        due_time: dto.due_time,
        max_score: dto.max_score || 100,
        is_graded: dto.is_graded !== false,
        allow_late_submission: dto.allow_late_submission || false,
        attachments: dto.attachments || [],
        is_published: dto.is_published !== false,
        created_by: dto.created_by
      })
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name)
      `)
      .single()

    if (error) throw error

    // Auto-create pending submissions for all students in the section
    await createPendingSubmissions(data.id, dto.section_id, dto.school_id)

    return {
      success: true,
      data: data as Assignment,
      message: 'Assignment created successfully'
    }
  } catch (error: any) {
    console.error('Error creating assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateAssignment = async (
  assignmentId: string,
  dto: UpdateAssignmentDTO
): Promise<ApiResponse<Assignment>> => {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.instructions !== undefined) updateData.instructions = dto.instructions
    if (dto.due_date !== undefined) updateData.due_date = dto.due_date
    if (dto.due_time !== undefined) updateData.due_time = dto.due_time
    if (dto.max_score !== undefined) updateData.max_score = dto.max_score
    if (dto.is_graded !== undefined) updateData.is_graded = dto.is_graded
    if (dto.allow_late_submission !== undefined) updateData.allow_late_submission = dto.allow_late_submission
    if (dto.attachments !== undefined) updateData.attachments = dto.attachments
    if (dto.is_published !== undefined) updateData.is_published = dto.is_published
    if (dto.is_archived !== undefined) updateData.is_archived = dto.is_archived

    const { data, error } = await supabase
      .from('assignments')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`
        *,
        section:sections(id, name, grade_level:grade_levels(name)),
        subject:subjects(id, name)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as Assignment,
      message: 'Assignment updated successfully'
    }
  } catch (error: any) {
    console.error('Error updating assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteAssignment = async (
  assignmentId: string
): Promise<ApiResponse<void>> => {
  try {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId)

    if (error) throw error

    return {
      success: true,
      message: 'Assignment deleted successfully'
    }
  } catch (error: any) {
    console.error('Error deleting assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// SUBMISSION OPERATIONS
// ============================================================================

async function createPendingSubmissions(
  assignmentId: string,
  sectionId: string,
  schoolId: string
): Promise<void> {
  try {
    // Get all students in the section
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('section_id', sectionId)
      .eq('status', 'active')

    if (students && students.length > 0) {
      const submissions = students.map(student => ({
        assignment_id: assignmentId,
        student_id: student.id,
        school_id: schoolId,
        status: 'pending'
      }))

      await supabase
        .from('assignment_submissions')
        .insert(submissions)
    }
  } catch (error) {
    console.error('Error creating pending submissions:', error)
  }
}

export const getAssignmentSubmissions = async (
  assignmentId: string
): Promise<ApiResponse<AssignmentSubmission[]>> => {
  try {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select(`
        *,
        student:students(
          id,
          student_number,
          profile:profiles(first_name, last_name)
        ),
        assignment:assignments(title, max_score)
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false, nullsFirst: false })

    if (error) throw error

    return {
      success: true,
      data: data as AssignmentSubmission[]
    }
  } catch (error: any) {
    console.error('Error fetching submissions:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const submitAssignment = async (
  dto: SubmitAssignmentDTO
): Promise<ApiResponse<AssignmentSubmission>> => {
  try {
    // Get school_id from the student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('school_id')
      .eq('id', dto.student_id)
      .single()

    if (studentError || !student) {
      return {
        success: false,
        error: 'Student not found'
      }
    }

    // First check if submission exists
    const { data: existing } = await supabase
      .from('assignment_submissions')
      .select('id')
      .eq('assignment_id', dto.assignment_id)
      .eq('student_id', dto.student_id)
      .maybeSingle()

    let result

    if (existing) {
      // Update existing submission
      const { data, error } = await supabase
        .from('assignment_submissions')
        .update({
          submission_text: dto.submission_text,
          attachments: dto.attachments || [],
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new submission with school_id
      const { data, error } = await supabase
        .from('assignment_submissions')
        .insert({
          assignment_id: dto.assignment_id,
          student_id: dto.student_id,
          school_id: student.school_id,
          submission_text: dto.submission_text,
          attachments: dto.attachments || [],
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return {
      success: true,
      data: result as AssignmentSubmission,
      message: 'Assignment submitted successfully'
    }
  } catch (error: any) {
    console.error('Error submitting assignment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const gradeSubmission = async (
  submissionId: string,
  dto: GradeSubmissionDTO
): Promise<ApiResponse<AssignmentSubmission>> => {
  try {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .update({
        score: dto.score,
        feedback: dto.feedback,
        status: 'graded',
        graded_at: new Date().toISOString(),
        graded_by: dto.graded_by,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as AssignmentSubmission,
      message: 'Submission graded successfully'
    }
  } catch (error: any) {
    console.error('Error grading submission:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getAssignmentStats = async (
  assignmentId: string
): Promise<ApiResponse<any>> => {
  try {
    const { data, error } = await supabase
      .from('assignment_submissions')
      .select('status, score')
      .eq('assignment_id', assignmentId)

    if (error) throw error

    const stats = {
      total_students: data.length,
      submitted: data.filter(s => ['submitted', 'graded', 'returned'].includes(s.status)).length,
      pending: data.filter(s => s.status === 'pending').length,
      graded: data.filter(s => s.status === 'graded').length,
      average_score: 0
    }

    const gradedSubmissions = data.filter(s => s.score !== null)
    if (gradedSubmissions.length > 0) {
      const totalScore = gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0)
      stats.average_score = Math.round((totalScore / gradedSubmissions.length) * 100) / 100
    }

    return {
      success: true,
      data: stats
    }
  } catch (error: any) {
    console.error('Error fetching assignment stats:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
