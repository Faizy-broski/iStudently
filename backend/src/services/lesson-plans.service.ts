import { supabase } from '../config/supabase'

// ==================
// Types
// ==================

export interface LessonPlanLesson {
  id: string
  school_id: string
  campus_id?: string
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  // Joined data
  course_period?: any
  teacher?: any
  items?: LessonPlanItem[]
  files?: LessonPlanFile[]
}

export interface LessonPlanItem {
  id: string
  lesson_id: string
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
  created_at: string
  updated_at: string
}

export interface LessonPlanFile {
  id: string
  lesson_id: string
  file_name: string
  file_url: string
  file_type?: string
  file_size?: number
  uploaded_at: string
  uploaded_by?: string
}

export interface CreateLessonDTO {
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  items?: CreateLessonItemDTO[]
}

export interface UpdateLessonDTO {
  title?: string
  on_date?: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  is_published?: boolean
}

export interface CreateLessonItemDTO {
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
}

export interface UpdateLessonItemDTO {
  sort_order?: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
}

// Select string for full lesson with joins
const LESSON_SELECT = `
  *,
  course_period:course_periods!course_period_id(
    id, title, short_name,
    course:courses!course_id(id, title, short_name),
    section:sections!section_id(id, name, grade_level:grade_levels(id, name)),
    period:periods!period_id(id, title, short_name, sort_order),
    teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name))
  ),
  teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
  items:lesson_plan_items(*),
  files:lesson_plan_files(*)
`

export class LessonPlansService {
  /**
   * Get lesson plans for a school/course period
   */
  async getLessons(
    schoolId: string,
    filters?: {
      course_period_id?: string
      teacher_id?: string
      campus_id?: string
      academic_year_id?: string
      date_from?: string
      date_to?: string
      on_date?: string
    },
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit

    let query = supabase
      .from('lesson_plan_lessons')
      .select(LESSON_SELECT, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('on_date', { ascending: false })
      .order('lesson_number', { ascending: true })

    if (filters?.course_period_id) {
      query = query.eq('course_period_id', filters.course_period_id)
    }
    if (filters?.teacher_id) {
      query = query.eq('teacher_id', filters.teacher_id)
    }
    if (filters?.campus_id) {
      query = query.eq('campus_id', filters.campus_id)
    }
    if (filters?.academic_year_id) {
      query = query.eq('academic_year_id', filters.academic_year_id)
    }
    if (filters?.on_date) {
      query = query.eq('on_date', filters.on_date)
    }
    if (filters?.date_from) {
      query = query.gte('on_date', filters.date_from)
    }
    if (filters?.date_to) {
      query = query.lte('on_date', filters.date_to)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch lesson plans: ${error.message}`)
    }

    // Sort items by sort_order
    const lessons = (data || []).map((lesson: any) => ({
      ...lesson,
      items: (lesson.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    }))

    return {
      lessons,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    }
  }

  /**
   * Get a single lesson plan by ID
   */
  async getLessonById(lessonId: string) {
    const { data, error } = await supabase
      .from('lesson_plan_lessons')
      .select(LESSON_SELECT)
      .eq('id', lessonId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch lesson plan: ${error.message}`)
    }

    // Sort items
    if (data?.items) {
      data.items.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    return data
  }

  /**
   * Get lesson plan summary grouped by course period
   */
  async getLessonPlanSummary(
    schoolId: string,
    filters?: {
      teacher_id?: string
      campus_id?: string
      academic_year_id?: string
    }
  ) {
    let query = supabase
      .from('lesson_plan_lessons')
      .select(`
        course_period_id,
        course_period:course_periods!course_period_id(
          id, title, short_name,
          course:courses!course_id(id, title, short_name),
          section:sections!section_id(id, name, grade_level:grade_levels(id, name)),
          period:periods!period_id(id, title, short_name),
          teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name))
        ),
        on_date,
        id
      `)
      .eq('school_id', schoolId)
      .eq('is_published', true)
      .order('on_date', { ascending: false })

    if (filters?.teacher_id) {
      query = query.eq('teacher_id', filters.teacher_id)
    }
    if (filters?.campus_id) {
      query = query.eq('campus_id', filters.campus_id)
    }
    if (filters?.academic_year_id) {
      query = query.eq('academic_year_id', filters.academic_year_id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch lesson plan summary: ${error.message}`)
    }

    // Group by course_period_id
    const grouped: Record<string, { course_period: any; count: number; last_date: string }> = {}
    for (const row of data || []) {
      const cpId = row.course_period_id
      if (!grouped[cpId]) {
        grouped[cpId] = {
          course_period: row.course_period,
          count: 0,
          last_date: row.on_date,
        }
      }
      grouped[cpId].count++
      if (row.on_date > grouped[cpId].last_date) {
        grouped[cpId].last_date = row.on_date
      }
    }

    return Object.entries(grouped).map(([course_period_id, info]) => ({
      course_period_id,
      ...info,
    }))
  }

  /**
   * Create a new lesson plan with items
   */
  async createLesson(
    schoolId: string,
    campusId: string | undefined,
    userId: string,
    dto: CreateLessonDTO
  ) {
    // Create the lesson
    const { data: lesson, error: lessonError } = await supabase
      .from('lesson_plan_lessons')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        course_period_id: dto.course_period_id,
        teacher_id: dto.teacher_id,
        academic_year_id: dto.academic_year_id,
        title: dto.title,
        on_date: dto.on_date,
        lesson_number: dto.lesson_number || 1,
        length_minutes: dto.length_minutes || null,
        learning_objectives: dto.learning_objectives || null,
        evaluation: dto.evaluation || null,
        inclusiveness: dto.inclusiveness || null,
        created_by: userId,
      })
      .select()
      .single()

    if (lessonError) {
      throw new Error(`Failed to create lesson plan: ${lessonError.message}`)
    }

    // Create items if provided
    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map((item, index) => ({
        lesson_id: lesson.id,
        sort_order: item.sort_order ?? index,
        time_minutes: item.time_minutes || null,
        teacher_activity: item.teacher_activity || null,
        learner_activity: item.learner_activity || null,
        formative_assessment: item.formative_assessment || null,
        learning_materials: item.learning_materials || null,
      }))

      const { error: itemsError } = await supabase
        .from('lesson_plan_items')
        .insert(itemsToInsert)

      if (itemsError) {
        throw new Error(`Failed to create lesson plan items: ${itemsError.message}`)
      }
    }

    // Return full lesson with items
    return this.getLessonById(lesson.id)
  }

  /**
   * Update a lesson plan
   */
  async updateLesson(lessonId: string, dto: UpdateLessonDTO) {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.on_date !== undefined) updateData.on_date = dto.on_date
    if (dto.lesson_number !== undefined) updateData.lesson_number = dto.lesson_number
    if (dto.length_minutes !== undefined) updateData.length_minutes = dto.length_minutes
    if (dto.learning_objectives !== undefined) updateData.learning_objectives = dto.learning_objectives
    if (dto.evaluation !== undefined) updateData.evaluation = dto.evaluation
    if (dto.inclusiveness !== undefined) updateData.inclusiveness = dto.inclusiveness
    if (dto.is_published !== undefined) updateData.is_published = dto.is_published

    const { data, error } = await supabase
      .from('lesson_plan_lessons')
      .update(updateData)
      .eq('id', lessonId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update lesson plan: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a lesson plan (cascades to items and files)
   */
  async deleteLesson(lessonId: string) {
    const { error } = await supabase
      .from('lesson_plan_lessons')
      .delete()
      .eq('id', lessonId)

    if (error) {
      throw new Error(`Failed to delete lesson plan: ${error.message}`)
    }
  }

  /**
   * Replace all items for a lesson (used when saving the whole form)
   */
  async replaceItems(lessonId: string, items: CreateLessonItemDTO[]) {
    // Delete existing items
    const { error: deleteError } = await supabase
      .from('lesson_plan_items')
      .delete()
      .eq('lesson_id', lessonId)

    if (deleteError) {
      throw new Error(`Failed to clear lesson plan items: ${deleteError.message}`)
    }

    // Insert new items
    if (items.length > 0) {
      const itemsToInsert = items.map((item, index) => ({
        lesson_id: lessonId,
        sort_order: item.sort_order ?? index,
        time_minutes: item.time_minutes || null,
        teacher_activity: item.teacher_activity || null,
        learner_activity: item.learner_activity || null,
        formative_assessment: item.formative_assessment || null,
        learning_materials: item.learning_materials || null,
      }))

      const { error: insertError } = await supabase
        .from('lesson_plan_items')
        .insert(itemsToInsert)

      if (insertError) {
        throw new Error(`Failed to create lesson plan items: ${insertError.message}`)
      }
    }

    return this.getLessonById(lessonId)
  }

  /**
   * Add a file attachment to a lesson
   */
  async addFile(
    lessonId: string,
    userId: string,
    file: { file_name: string; file_url: string; file_type?: string; file_size?: number }
  ) {
    const { data, error } = await supabase
      .from('lesson_plan_files')
      .insert({
        lesson_id: lessonId,
        file_name: file.file_name,
        file_url: file.file_url,
        file_type: file.file_type || null,
        file_size: file.file_size || null,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add file: ${error.message}`)
    }

    return data
  }

  /**
   * Remove a file attachment
   */
  async removeFile(fileId: string) {
    const { error } = await supabase
      .from('lesson_plan_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      throw new Error(`Failed to remove file: ${error.message}`)
    }
  }
}
