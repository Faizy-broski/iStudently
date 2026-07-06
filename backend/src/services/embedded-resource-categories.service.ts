import { supabase } from '../config/supabase'

export interface EmbeddedResourceCategory {
  id: string
  school_id: string
  name: string
  sort_order?: number
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface CreateEmbeddedResourceCategoryDTO {
  school_id: string
  name: string
  sort_order?: number
  created_by?: string | null
}

export interface UpdateEmbeddedResourceCategoryDTO {
  name?: string
  sort_order?: number
}

export const getCategories = async (schoolId: string): Promise<EmbeddedResourceCategory[]> => {
  const { data, error } = await supabase
    .from('embedded_resource_categories')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (error) throw error
  return data || []
}

export const createCategory = async (
  dto: CreateEmbeddedResourceCategoryDTO
): Promise<EmbeddedResourceCategory> => {
  const { data, error } = await supabase
    .from('embedded_resource_categories')
    .insert({
      school_id:  dto.school_id,
      name:       dto.name,
      sort_order: dto.sort_order ?? 0,
      created_by: dto.created_by || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const updateCategory = async (
  id: string,
  schoolId: string,
  dto: UpdateEmbeddedResourceCategoryDTO
): Promise<EmbeddedResourceCategory> => {
  const payload: Record<string, unknown> = {}
  if (dto.name       !== undefined) payload.name       = dto.name
  if (dto.sort_order !== undefined) payload.sort_order = dto.sort_order

  const { data, error } = await supabase
    .from('embedded_resource_categories')
    .update(payload)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('Category not found or access denied')
  return data
}

export const deleteCategory = async (id: string, schoolId: string): Promise<void> => {
  const { error } = await supabase
    .from('embedded_resource_categories')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)

  if (error) throw error
}
