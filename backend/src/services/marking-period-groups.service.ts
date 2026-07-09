import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface MarkingPeriodGroup {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMarkingPeriodGroupDTO {
  name: string
}

export interface UpdateMarkingPeriodGroupDTO {
  name?: string
}

// ============================================================================
// SERVICE
// ============================================================================

class MarkingPeriodGroupsService {
  /**
   * Get all groups for a school, optionally scoped to a campus (school-wide + campus-specific)
   */
  async getAll(schoolId: string, campusId?: string): Promise<MarkingPeriodGroup[]> {
    let query = supabase
      .from('marking_period_groups')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching marking period groups:', error)
      throw new Error('Failed to fetch marking period groups')
    }

    return data || []
  }

  async getById(id: string): Promise<MarkingPeriodGroup | null> {
    const { data, error } = await supabase
      .from('marking_period_groups')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching marking period group:', error)
      throw new Error('Failed to fetch marking period group')
    }

    return data
  }

  /**
   * Get (or lazily create) the Default group for a school/campus — used as the
   * fallback for marking periods/grade levels that don't specify a group.
   */
  async getOrCreateDefaultGroup(schoolId: string, campusId: string | null): Promise<MarkingPeriodGroup> {
    let query = supabase
      .from('marking_period_groups')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_default', true)

    query = campusId ? query.eq('campus_id', campusId) : query.is('campus_id', null)

    const { data: existing } = await query.maybeSingle()
    if (existing) return existing

    const { data, error } = await supabase
      .from('marking_period_groups')
      .insert({ school_id: schoolId, campus_id: campusId, name: 'Default', is_default: true, is_active: true })
      .select()
      .single()

    if (error) {
      console.error('Error creating default marking period group:', error)
      throw new Error('Failed to create default marking period group')
    }

    return data
  }

  async create(schoolId: string, campusId: string | null, dto: CreateMarkingPeriodGroupDTO): Promise<MarkingPeriodGroup> {
    if (!dto.name?.trim()) {
      throw new Error('Group name is required')
    }

    const { data, error } = await supabase
      .from('marking_period_groups')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        name: dto.name.trim(),
        is_default: false,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating marking period group:', error)
      throw new Error('Failed to create marking period group: ' + error.message)
    }

    return data
  }

  async update(id: string, dto: UpdateMarkingPeriodGroupDTO): Promise<MarkingPeriodGroup> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Marking period group not found')

    const updateData: Record<string, unknown> = {}
    if (dto.name !== undefined) updateData.name = dto.name.trim()

    const { data, error } = await supabase
      .from('marking_period_groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating marking period group:', error)
      throw new Error(error.message || 'Failed to update marking period group')
    }

    return data
  }

  /**
   * Delete (soft) a group. The Default group can never be deleted.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.getById(id)
    if (!existing) throw new Error('Marking period group not found')
    if (existing.is_default) {
      throw new Error('The Default group cannot be deleted')
    }

    const { error } = await supabase
      .from('marking_period_groups')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting marking period group:', error)
      throw new Error('Failed to delete marking period group')
    }
  }
}

export const markingPeriodGroupsService = new MarkingPeriodGroupsService()
