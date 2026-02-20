import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export type MarkingPeriodType = 'FY' | 'SEM' | 'QTR' | 'PRO'

export interface MarkingPeriod {
  id: string
  school_id: string
  campus_id?: string | null
  mp_type: MarkingPeriodType
  parent_id?: string | null
  title: string
  short_name: string
  sort_order: number
  does_grades: boolean
  does_comments: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateMarkingPeriodDTO {
  mp_type: MarkingPeriodType
  parent_id?: string | null
  title: string
  short_name: string
  sort_order: number
  does_grades?: boolean
  does_comments?: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
}

export interface UpdateMarkingPeriodDTO {
  title?: string
  short_name?: string
  sort_order?: number
  does_grades?: boolean
  does_comments?: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
}

// Hierarchy mapping: which mp_type can be parent of which
const VALID_PARENT_TYPES: Record<MarkingPeriodType, MarkingPeriodType | null> = {
  'FY': null,     // Full Year has no parent
  'SEM': 'FY',    // Semester belongs to Full Year
  'QTR': 'SEM',   // Quarter belongs to Semester
  'PRO': 'QTR',   // Progress Period belongs to Quarter
}

const MP_TYPE_LABELS: Record<MarkingPeriodType, string> = {
  'FY': 'Full Year',
  'SEM': 'Semester',
  'QTR': 'Quarter',
  'PRO': 'Progress Period',
}

// ============================================================================
// SERVICE
// ============================================================================

class MarkingPeriodsService {

  /**
   * Get all marking periods for a school, organized by type
   */
  async getAll(schoolId: string, campusId?: string): Promise<MarkingPeriod[]> {
    let query = supabase
      .from('marking_periods')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('mp_type', { ascending: true })
      .order('sort_order', { ascending: true })

    if (campusId) {
      // Include school-wide (null campus) AND campus-specific
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching marking periods:', error)
      throw new Error('Failed to fetch marking periods')
    }

    return data || []
  }

  /**
   * Get marking periods grouped by type for the RosarioSIS-style UI
   */
  async getGroupedByType(schoolId: string, campusId?: string): Promise<Record<MarkingPeriodType, MarkingPeriod[]>> {
    const all = await this.getAll(schoolId, campusId)

    const grouped: Record<MarkingPeriodType, MarkingPeriod[]> = {
      'FY': [],
      'SEM': [],
      'QTR': [],
      'PRO': [],
    }

    for (const mp of all) {
      if (grouped[mp.mp_type as MarkingPeriodType]) {
        grouped[mp.mp_type as MarkingPeriodType].push(mp)
      }
    }

    return grouped
  }

  /**
   * Get a single marking period by ID
   */
  async getById(id: string): Promise<MarkingPeriod | null> {
    const { data, error } = await supabase
      .from('marking_periods')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching marking period:', error)
      throw new Error('Failed to fetch marking period')
    }

    return data
  }

  /**
   * Get children of a marking period
   */
  async getChildren(parentId: string): Promise<MarkingPeriod[]> {
    const { data, error } = await supabase
      .from('marking_periods')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching children:', error)
      throw new Error('Failed to fetch children')
    }

    return data || []
  }

  /**
   * Create a new marking period
   */
  async create(
    schoolId: string,
    campusId: string | null,
    dto: CreateMarkingPeriodDTO
  ): Promise<MarkingPeriod> {
    // Validate parent relationship
    await this.validateParent(dto.mp_type, dto.parent_id || null)

    // Validate date ranges don't overlap with siblings of same type under same parent
    if (dto.start_date && dto.end_date) {
      await this.validateDateOverlap(
        schoolId,
        campusId,
        dto.mp_type,
        dto.parent_id || null,
        dto.start_date,
        dto.end_date,
        null // no existing id (new record)
      )
    }

    const { data, error } = await supabase
      .from('marking_periods')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        mp_type: dto.mp_type,
        parent_id: dto.parent_id || null,
        title: dto.title,
        short_name: dto.short_name,
        sort_order: dto.sort_order,
        does_grades: dto.does_grades ?? true,
        does_comments: dto.does_comments ?? false,
        start_date: dto.start_date || null,
        end_date: dto.end_date || null,
        post_start_date: dto.post_start_date || null,
        post_end_date: dto.post_end_date || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating marking period:', error)
      throw new Error('Failed to create marking period: ' + error.message)
    }

    return data
  }

  /**
   * Update a marking period
   */
  async update(id: string, dto: UpdateMarkingPeriodDTO): Promise<MarkingPeriod> {
    // Get existing to check type for date validation
    const existing = await this.getById(id)
    if (!existing) throw new Error('Marking period not found')

    // If dates changed, validate overlap
    const startDate = dto.start_date !== undefined ? dto.start_date : existing.start_date
    const endDate = dto.end_date !== undefined ? dto.end_date : existing.end_date

    if (startDate && endDate) {
      await this.validateDateOverlap(
        existing.school_id,
        existing.campus_id || null,
        existing.mp_type as MarkingPeriodType,
        existing.parent_id || null,
        startDate,
        endDate,
        id
      )
    }

    const updateData: any = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.short_name !== undefined) updateData.short_name = dto.short_name
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order
    if (dto.does_grades !== undefined) updateData.does_grades = dto.does_grades
    if (dto.does_comments !== undefined) updateData.does_comments = dto.does_comments
    if (dto.start_date !== undefined) updateData.start_date = dto.start_date || null
    if (dto.end_date !== undefined) updateData.end_date = dto.end_date || null
    if (dto.post_start_date !== undefined) updateData.post_start_date = dto.post_start_date || null
    if (dto.post_end_date !== undefined) updateData.post_end_date = dto.post_end_date || null

    const { data, error } = await supabase
      .from('marking_periods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating marking period:', error)
      throw new Error('Failed to update marking period')
    }

    return data
  }

  /**
   * Delete a marking period (soft delete)
   * Also soft-deletes all children recursively
   */
  async delete(id: string): Promise<void> {
    // Recursively soft-delete children first
    const children = await this.getChildren(id)
    for (const child of children) {
      await this.delete(child.id)
    }

    const { error } = await supabase
      .from('marking_periods')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deleting marking period:', error)
      throw new Error('Failed to delete marking period')
    }
  }

  /**
   * Get the currently active marking period by date
   */
  async getCurrent(
    schoolId: string,
    mpType?: MarkingPeriodType,
    campusId?: string
  ): Promise<MarkingPeriod[]> {
    const today = new Date().toISOString().split('T')[0]

    let query = supabase
      .from('marking_periods')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .lte('start_date', today)
      .gte('end_date', today)
      .order('mp_type', { ascending: true })
      .order('sort_order', { ascending: true })

    if (mpType) {
      query = query.eq('mp_type', mpType)
    }

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching current marking period:', error)
      throw new Error('Failed to fetch current marking period')
    }

    return data || []
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  /**
   * Validate that the parent_id is correct for the given mp_type
   */
  private async validateParent(
    mpType: MarkingPeriodType,
    parentId: string | null
  ): Promise<void> {
    const expectedParentType = VALID_PARENT_TYPES[mpType]

    if (expectedParentType === null) {
      // FY should not have a parent
      if (parentId) {
        throw new Error('Full Year marking periods cannot have a parent')
      }
      return
    }

    // Non-FY types must have a parent
    if (!parentId) {
      throw new Error(`${MP_TYPE_LABELS[mpType]} must have a parent ${MP_TYPE_LABELS[expectedParentType]}`)
    }

    // Validate the parent exists and is the right type
    const parent = await this.getById(parentId)
    if (!parent) {
      throw new Error('Parent marking period not found')
    }

    if (parent.mp_type !== expectedParentType) {
      throw new Error(
        `${MP_TYPE_LABELS[mpType]} must have a ${MP_TYPE_LABELS[expectedParentType]} as parent, ` +
        `but the specified parent is a ${MP_TYPE_LABELS[parent.mp_type as MarkingPeriodType]}`
      )
    }
  }

  /**
   * Validate that dates don't overlap with siblings of the same type under the same parent
   */
  private async validateDateOverlap(
    schoolId: string,
    campusId: string | null,
    mpType: MarkingPeriodType,
    parentId: string | null,
    startDate: string,
    endDate: string,
    excludeId: string | null
  ): Promise<void> {
    let query = supabase
      .from('marking_periods')
      .select('id, title, start_date, end_date')
      .eq('school_id', schoolId)
      .eq('mp_type', mpType)
      .eq('is_active', true)
      .not('start_date', 'is', null)
      .not('end_date', 'is', null)

    if (parentId) {
      query = query.eq('parent_id', parentId)
    } else {
      query = query.is('parent_id', null)
    }

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data: siblings, error } = await query

    if (error) {
      console.error('Error checking date overlap:', error)
      return // Don't block on validation error
    }

    for (const sibling of siblings || []) {
      const sStart = sibling.start_date!
      const sEnd = sibling.end_date!

      // Check overlap: two ranges overlap if start1 <= end2 AND end1 >= start2
      if (startDate <= sEnd && endDate >= sStart) {
        throw new Error(
          `Date range overlaps with "${sibling.title}" (${sStart} to ${sEnd}). ` +
          `Only one ${MP_TYPE_LABELS[mpType]} can be active at a time.`
        )
      }
    }
  }
}

export const markingPeriodsService = new MarkingPeriodsService()
