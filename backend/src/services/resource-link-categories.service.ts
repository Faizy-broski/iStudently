import { supabase } from '../config/supabase'

export interface ResourceLinkCategory {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateResourceLinkCategoryDTO {
  name: string
  campus_id?: string | null
  sort_order?: number
}

export interface UpdateResourceLinkCategoryDTO {
  name?: string
  sort_order?: number
}

export class ResourceLinkCategoriesService {
  async getCategories(schoolId: string, campusId?: string): Promise<ResourceLinkCategory[]> {
    let query = supabase
      .from('resource_link_categories')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  async createCategory(
    schoolId: string,
    createdBy: string,
    dto: CreateResourceLinkCategoryDTO
  ): Promise<ResourceLinkCategory> {
    const { data, error } = await supabase
      .from('resource_link_categories')
      .insert({
        school_id:  schoolId,
        campus_id:  dto.campus_id || null,
        name:       dto.name,
        sort_order: dto.sort_order ?? 0,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateCategory(
    categoryId: string,
    schoolId: string,
    dto: UpdateResourceLinkCategoryDTO
  ): Promise<ResourceLinkCategory> {
    const updateData: Record<string, unknown> = {}
    if (dto.name       !== undefined) updateData.name       = dto.name
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order

    const { data, error } = await supabase
      .from('resource_link_categories')
      .update(updateData)
      .eq('id', categoryId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteCategory(categoryId: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('resource_link_categories')
      .delete()
      .eq('id', categoryId)
      .eq('school_id', schoolId)

    if (error) throw error
  }
}
