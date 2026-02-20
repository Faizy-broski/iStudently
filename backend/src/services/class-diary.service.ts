import { supabase } from '../config/supabase'

export interface DiaryEntry {
  id: string
  school_id: string
  campus_id?: string
  timetable_entry_id?: string
  teacher_id: string
  section_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  content: string
  entry_time?: string
  enable_comments: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  // Joined data
  teacher?: any
  section?: any
  subject?: any
  files?: DiaryFile[]
  comments?: DiaryComment[]
}

export interface DiaryFile {
  id: string
  diary_entry_id: string
  file_name: string
  file_url: string
  file_type?: string
  file_size?: number
  uploaded_at: string
  uploaded_by?: string
}

export interface DiaryComment {
  id: string
  diary_entry_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: any
}

export interface CreateDiaryEntryDTO {
  timetable_entry_id?: string
  teacher_id: string
  section_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  content: string
  entry_time?: string
  enable_comments?: boolean
}

export interface UpdateDiaryEntryDTO {
  content?: string
  enable_comments?: boolean
  is_published?: boolean
}

export class ClassDiaryService {
  /**
   * Get diary entries for a school/campus on a specific date
   */
  async getDiaryEntries(
    schoolId: string,
    filters?: {
      diary_date?: string
      section_id?: string
      subject_id?: string
      teacher_id?: string
      campus_id?: string
      day_of_week?: number
    },
    page: number = 1,
    limit: number = 50
  ) {
    const offset = (page - 1) * limit

    let query = supabase
      .from('class_diary_entries')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
        section:sections!section_id(id, name, grade_level:grade_levels(id, name)),
        subject:subjects!subject_id(id, name),
        files:class_diary_files(*),
        comments:class_diary_comments(
          *,
          author:profiles!author_id(id, first_name, last_name, role)
        )
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('entry_time', { ascending: false })

    if (filters?.diary_date) {
      query = query.eq('diary_date', filters.diary_date)
    }

    if (filters?.section_id) {
      query = query.eq('section_id', filters.section_id)
    }

    if (filters?.subject_id) {
      query = query.eq('subject_id', filters.subject_id)
    }

    if (filters?.teacher_id) {
      query = query.eq('teacher_id', filters.teacher_id)
    }

    if (filters?.campus_id) {
      query = query.eq('campus_id', filters.campus_id)
    }

    if (filters?.day_of_week !== undefined) {
      query = query.eq('day_of_week', filters.day_of_week)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch diary entries: ${error.message}`)
    }

    return {
      entries: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  /**
   * Get a single diary entry by ID
   */
  async getDiaryEntryById(entryId: string) {
    const { data, error } = await supabase
      .from('class_diary_entries')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
        section:sections!section_id(id, name, grade_level:grade_levels(id, name)),
        subject:subjects!subject_id(id, name),
        files:class_diary_files(*),
        comments:class_diary_comments(
          *,
          author:profiles!author_id(id, first_name, last_name, role)
        )
      `)
      .eq('id', entryId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch diary entry: ${error.message}`)
    }

    return data
  }

  /**
   * Create a new diary entry
   */
  async createDiaryEntry(
    schoolId: string,
    campusId: string | undefined,
    userId: string,
    dto: CreateDiaryEntryDTO
  ) {
    const { data, error } = await supabase
      .from('class_diary_entries')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        timetable_entry_id: dto.timetable_entry_id || null,
        teacher_id: dto.teacher_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id || null,
        diary_date: dto.diary_date,
        day_of_week: dto.day_of_week,
        content: dto.content,
        entry_time: dto.entry_time || new Date().toLocaleTimeString('en-US', { hour12: false }),
        enable_comments: dto.enable_comments !== undefined ? dto.enable_comments : true,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create diary entry: ${error.message}`)
    }

    return data
  }

  /**
   * Update a diary entry
   */
  async updateDiaryEntry(entryId: string, dto: UpdateDiaryEntryDTO) {
    const updateData: any = { updated_at: new Date().toISOString() }

    if (dto.content !== undefined) updateData.content = dto.content
    if (dto.enable_comments !== undefined) updateData.enable_comments = dto.enable_comments
    if (dto.is_published !== undefined) updateData.is_published = dto.is_published

    const { data, error } = await supabase
      .from('class_diary_entries')
      .update(updateData)
      .eq('id', entryId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update diary entry: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a diary entry
   */
  async deleteDiaryEntry(entryId: string) {
    const { error } = await supabase
      .from('class_diary_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      throw new Error(`Failed to delete diary entry: ${error.message}`)
    }
  }

  /**
   * Add a file attachment to a diary entry
   */
  async addFile(
    entryId: string,
    userId: string,
    file: { file_name: string; file_url: string; file_type?: string; file_size?: number }
  ) {
    const { data, error } = await supabase
      .from('class_diary_files')
      .insert({
        diary_entry_id: entryId,
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
      .from('class_diary_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      throw new Error(`Failed to remove file: ${error.message}`)
    }
  }

  /**
   * Add a comment to a diary entry
   */
  async addComment(entryId: string, authorId: string, content: string) {
    // Verify comments are enabled
    const { data: entry, error: entryError } = await supabase
      .from('class_diary_entries')
      .select('enable_comments')
      .eq('id', entryId)
      .single()

    if (entryError) {
      throw new Error(`Diary entry not found: ${entryError.message}`)
    }

    if (!entry.enable_comments) {
      throw new Error('Comments are disabled for this diary entry')
    }

    const { data, error } = await supabase
      .from('class_diary_comments')
      .insert({
        diary_entry_id: entryId,
        author_id: authorId,
        content,
      })
      .select(`
        *,
        author:profiles!author_id(id, first_name, last_name, role)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to add comment: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string) {
    const { error } = await supabase
      .from('class_diary_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      throw new Error(`Failed to delete comment: ${error.message}`)
    }
  }

  /**
   * Get diary entries for the read view (by day + section/teacher)
   */
  async getDiaryReadView(
    schoolId: string,
    diaryDate: string,
    sectionId?: string,
    teacherId?: string,
    campusId?: string
  ) {
    let query = supabase
      .from('class_diary_entries')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!profile_id(first_name, last_name)),
        section:sections!section_id(id, name, grade_level:grade_levels(id, name)),
        subject:subjects!subject_id(id, name),
        files:class_diary_files(*),
        comments:class_diary_comments(
          *,
          author:profiles!author_id(id, first_name, last_name, role)
        )
      `)
      .eq('school_id', schoolId)
      .eq('diary_date', diaryDate)
      .eq('is_published', true)
      .order('entry_time', { ascending: true })

    if (sectionId) {
      query = query.eq('section_id', sectionId)
    }

    if (teacherId) {
      query = query.eq('teacher_id', teacherId)
    }

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch diary read view: ${error.message}`)
    }

    return data || []
  }

  /**
   * Toggle enable_comments on a diary entry
   */
  async toggleComments(entryId: string, enable: boolean) {
    const { data, error } = await supabase
      .from('class_diary_entries')
      .update({ enable_comments: enable, updated_at: new Date().toISOString() })
      .eq('id', entryId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to toggle comments: ${error.message}`)
    }

    return data
  }
}
