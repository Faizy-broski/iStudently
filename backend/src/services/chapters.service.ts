import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface Chapter {
  id: string
  school_id: string
  subject_id: string
  title: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// CRUD
// ============================================================================

export const getChapters = async (
  subjectId: string,
  schoolId: string,
  includeInactive = false
): Promise<Chapter[]> => {
  let q = supabase
    .from('chapters')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('school_id', schoolId)
    .order('order_index', { ascending: true })
    .order('title', { ascending: true })

  if (!includeInactive) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) throw error
  return data as Chapter[]
}

export const getChapter = async (id: string): Promise<Chapter> => {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Chapter
}

export const createChapter = async (
  dto: Pick<Chapter, 'school_id' | 'subject_id' | 'title' | 'order_index'>
): Promise<Chapter> => {
  const { data, error } = await supabase
    .from('chapters')
    .insert({
      school_id: dto.school_id,
      subject_id: dto.subject_id,
      title: dto.title,
      order_index: dto.order_index ?? 0,
    })
    .select()
    .single()
  if (error) throw error
  return data as Chapter
}

export const updateChapter = async (
  id: string,
  dto: Partial<Pick<Chapter, 'title' | 'order_index' | 'is_active'>>
): Promise<Chapter> => {
  const { data, error } = await supabase
    .from('chapters')
    .update({ ...dto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Chapter
}

export const deleteChapter = async (id: string): Promise<void> => {
  const { error } = await supabase.from('chapters').delete().eq('id', id)
  if (error) throw error
}
