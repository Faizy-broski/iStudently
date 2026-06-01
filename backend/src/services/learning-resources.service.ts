import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'

// ============================================================================
// TYPES
// ============================================================================

export interface LearningResource {
  id: string
  school_id: string
  campus_id?: string
  academic_year_id: string
  teacher_id: string
  section_id?: string
  subject_id?: string
  grade_level_id?: string
  title: string
  description?: string
  resource_type: 'link' | 'book' | 'post' | 'file' | 'video'
  url?: string
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  book_cover_url?: string
  tags?: string[]
  is_pinned: boolean
  is_published: boolean
  view_count: number
  created_at: string
  updated_at: string
  // Joined data
  teacher?: {
    id: string
    profile: {
      first_name: string
      last_name: string
    }
  }
  section?: {
    id: string
    name: string
    grade_level: {
      id: string
      name: string
    }
  }
  subject?: {
    id: string
    name: string
  }
}

export interface CreateResourceDTO {
  school_id: string
  campus_id?: string
  academic_year_id: string
  teacher_id: string
  section_id?: string
  subject_id?: string
  grade_level_id?: string
  title: string
  description?: string
  resource_type: 'link' | 'book' | 'post' | 'file' | 'video'
  url?: string
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  book_cover_url?: string
  tags?: string[]
  is_pinned?: boolean
  is_published?: boolean
}

export interface UpdateResourceDTO extends Partial<Omit<CreateResourceDTO, 'school_id' | 'teacher_id'>> {}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export const getResourcesByTeacher = async (
  teacherId: string,
  filters?: {
    section_id?: string
    subject_id?: string
    resource_type?: string
    is_published?: boolean
    search?: string
  },
  pagination?: {
    page?: number
    limit?: number
  }
): Promise<ApiResponse<PaginatedResponse<LearningResource>>> => {
  try {
    const page = pagination?.page || 1
    const limit = pagination?.limit || 10
    const offset = (page - 1) * limit

    let query = supabase
      .from('learning_resources')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        subject:subjects(id, name)
      `, { count: 'exact' })
      .eq('teacher_id', teacherId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.section_id) query = query.eq('section_id', filters.section_id)
    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters?.resource_type) query = query.eq('resource_type', filters.resource_type)
    if (filters?.is_published !== undefined) query = query.eq('is_published', filters.is_published)
    if (filters?.search) query = query.ilike('title', `%${filters.search}%`)

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        data: data as LearningResource[],
        total,
        page,
        limit,
        totalPages
      }
    }
  } catch (error: any) {
    console.error('Error fetching teacher resources:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getResourcesBySection = async (
  sectionId: string,
  filters?: {
    subject_id?: string
    resource_type?: string
    search?: string
  },
  pagination?: {
    page?: number
    limit?: number
  }
): Promise<ApiResponse<PaginatedResponse<LearningResource>>> => {
  try {
    const page = pagination?.page || 1
    const limit = pagination?.limit || 10
    const offset = (page - 1) * limit

    let query = supabase
      .from('learning_resources')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        subject:subjects(id, name)
      `, { count: 'exact' })
      .eq('section_id', sectionId)
      .eq('is_published', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters?.resource_type) query = query.eq('resource_type', filters.resource_type)
    if (filters?.search) query = query.ilike('title', `%${filters.search}%`)

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data: {
        data: data as LearningResource[],
        total,
        page,
        limit,
        totalPages
      }
    }
  } catch (error: any) {
    console.error('Error fetching section resources:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getResourceById = async (
  resourceId: string
): Promise<ApiResponse<LearningResource>> => {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        subject:subjects(id, name)
      `)
      .eq('id', resourceId)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as LearningResource
    }
  } catch (error: any) {
    console.error('Error fetching resource:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const createResource = async (
  dto: CreateResourceDTO
): Promise<ApiResponse<LearningResource>> => {
  try {
    const { data, error } = await supabase
      .from('learning_resources')
      .insert({
        school_id: dto.school_id,
        campus_id: dto.campus_id,
        academic_year_id: dto.academic_year_id,
        teacher_id: dto.teacher_id,
        section_id: dto.section_id,
        subject_id: dto.subject_id,
        grade_level_id: dto.grade_level_id,
        title: dto.title,
        description: dto.description,
        resource_type: dto.resource_type,
        url: dto.url,
        content: dto.content,
        file_urls: dto.file_urls || [],
        book_title: dto.book_title,
        book_author: dto.book_author,
        book_isbn: dto.book_isbn,
        book_cover_url: dto.book_cover_url,
        tags: dto.tags || [],
        is_pinned: dto.is_pinned || false,
        is_published: dto.is_published ?? true
      })
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        subject:subjects(id, name)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as LearningResource
    }
  } catch (error: any) {
    console.error('Error creating resource:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const updateResource = async (
  resourceId: string,
  dto: UpdateResourceDTO
): Promise<ApiResponse<LearningResource>> => {
  try {
    const updateData: any = { updated_at: new Date().toISOString() }

    // Only include fields that are provided
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.resource_type !== undefined) updateData.resource_type = dto.resource_type
    if (dto.url !== undefined) updateData.url = dto.url
    if (dto.content !== undefined) updateData.content = dto.content
    if (dto.file_urls !== undefined) updateData.file_urls = dto.file_urls
    if (dto.book_title !== undefined) updateData.book_title = dto.book_title
    if (dto.book_author !== undefined) updateData.book_author = dto.book_author
    if (dto.book_isbn !== undefined) updateData.book_isbn = dto.book_isbn
    if (dto.book_cover_url !== undefined) updateData.book_cover_url = dto.book_cover_url
    if (dto.tags !== undefined) updateData.tags = dto.tags
    if (dto.is_pinned !== undefined) updateData.is_pinned = dto.is_pinned
    if (dto.is_published !== undefined) updateData.is_published = dto.is_published
    if (dto.section_id !== undefined) updateData.section_id = dto.section_id
    if (dto.subject_id !== undefined) updateData.subject_id = dto.subject_id

    const { data, error } = await supabase
      .from('learning_resources')
      .update(updateData)
      .eq('id', resourceId)
      .select(`
        *,
        teacher:staff!teacher_id(id, profile:profiles!staff_profile_id_fkey(first_name, last_name)),
        section:sections(id, name, grade_level:grade_levels(id, name)),
        subject:subjects(id, name)
      `)
      .single()

    if (error) throw error

    return {
      success: true,
      data: data as LearningResource
    }
  } catch (error: any) {
    console.error('Error updating resource:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const deleteResource = async (
  resourceId: string
): Promise<ApiResponse<{ deleted: boolean }>> => {
  try {
    const { error } = await supabase
      .from('learning_resources')
      .delete()
      .eq('id', resourceId)

    if (error) throw error

    return {
      success: true,
      data: { deleted: true }
    }
  } catch (error: any) {
    console.error('Error deleting resource:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// VIEW TRACKING
// ============================================================================

export const recordResourceView = async (
  resourceId: string,
  studentId: string
): Promise<ApiResponse<{ recorded: boolean }>> => {
  try {
    // Upsert to handle duplicate views
    const { error } = await supabase
      .from('learning_resource_views')
      .upsert({
        resource_id: resourceId,
        student_id: studentId,
        viewed_at: new Date().toISOString()
      }, {
        onConflict: 'resource_id,student_id'
      })

    if (error) throw error

    // Increment view count
    await supabase.rpc('increment_resource_view_count', { resource_id: resourceId })

    return {
      success: true,
      data: { recorded: true }
    }
  } catch (error: any) {
    console.error('Error recording resource view:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export const getResourceViewStats = async (
  resourceId: string
): Promise<ApiResponse<{ total_views: number; unique_views: number }>> => {
  try {
    // Get total and unique views
    const { data: resource, error: resourceError } = await supabase
      .from('learning_resources')
      .select('view_count')
      .eq('id', resourceId)
      .single()

    if (resourceError) throw resourceError

    const { count, error: countError } = await supabase
      .from('learning_resource_views')
      .select('*', { count: 'exact', head: true })
      .eq('resource_id', resourceId)

    if (countError) throw countError

    return {
      success: true,
      data: {
        total_views: resource.view_count || 0,
        unique_views: count || 0
      }
    }
  } catch (error: any) {
    console.error('Error getting resource view stats:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
