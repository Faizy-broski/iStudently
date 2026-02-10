import { supabase } from '../config/supabase'

export interface Period {
  id: string
  school_id: string
  campus_id?: string
  title: string
  short_name: string
  sort_order: number
  length_minutes: number
  block?: string
  is_active: boolean
  created_at: string
}

export interface CreatePeriodDTO {
  title: string
  short_name: string
  sort_order: number
  length_minutes: number
  block?: string
}

export interface UpdatePeriodDTO {
  title?: string
  short_name?: string
  sort_order?: number
  length_minutes?: number
  block?: string
}

export interface PeriodWithStats extends Period {
  course_periods_count: number
}

class PeriodsService {
  /**
   * Get all periods for a school/campus
   */
  async getPeriods(schoolId: string, campusId?: string): Promise<PeriodWithStats[]> {
    let query = supabase
      .from('periods')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      // Order by sort_order first (new schema), then period_number (old schema) as fallback
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('period_number', { ascending: true })

    // Filter by campus if provided, or show all if no campus specified
    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data: periods, error } = await query

    if (error) {
      console.error('Error fetching periods:', error)
      throw new Error('Failed to fetch periods')
    }

    // Get course periods count for each period and normalize data for backward compatibility
    const periodsWithStats = await Promise.all(
      (periods || []).map(async (period) => {
        const { count } = await supabase
          .from('timetable_entries')
          .select('*', { count: 'exact', head: true })
          .eq('period_id', period.id)
          .eq('is_active', true)

        return {
          ...period,
          // Ensure backward compatibility: populate period_number from sort_order if missing
          period_number: period.period_number || period.sort_order || 0,
          period_name: period.period_name || period.title || null,
          course_periods_count: count || 0
        }
      })
    )

    return periodsWithStats
  }

  /**
   * Get a single period by ID
   */
  async getPeriodById(periodId: string): Promise<Period | null> {
    const { data, error } = await supabase
      .from('periods')
      .select('*')
      .eq('id', periodId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching period:', error)
      throw new Error('Failed to fetch period')
    }

    return data
  }

  /**
   * Get a single period by short_name
   */
  async getPeriodByShortName(shortName: string, schoolId: string, campusId?: string): Promise<Period | null> {
    let query = supabase
      .from('periods')
      .select('*')
      .eq('short_name', shortName)
      .eq('school_id', schoolId)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') return null
      console.error('Error fetching period by short_name:', error)
      throw new Error('Failed to fetch period')
    }

    return data
  }

  /**
   * Get all timetable entries (classes) for a specific period
   */
  async getPeriodClasses(periodId: string, campusId?: string): Promise<any[]> {
    let query = supabase
      .from('timetable_entries')
      .select(`
        id,
        day_of_week,
        room_number,
        section:sections(
          id,
          name,
          grade_level:grade_levels(name)
        ),
        subject:subjects(
          id,
          name,
          code
        ),
        teacher:staff!teacher_id(
          id,
          profile:profiles!staff_profile_id_fkey(first_name, last_name)
        ),
        period:periods(
          id,
          title,
          short_name,
          sort_order,
          length_minutes
        )
      `)
      .eq('period_id', periodId)
      .eq('is_active', true)

    if (campusId) {
      query = query.eq('campus_id', campusId)
    }

    const { data, error } = await query.order('day_of_week', { ascending: true })

    if (error) {
      console.error('Error fetching period classes:', error)
      throw new Error('Failed to fetch period classes')
    }

    // Transform data
    return (data || []).map((entry: any) => ({
      id: entry.id,
      day_of_week: entry.day_of_week,
      day_name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][entry.day_of_week] || 'Unknown',
      room_number: entry.room_number,
      section_id: entry.section?.id,
      section_name: entry.section?.name,
      grade_name: entry.section?.grade_level?.name,
      subject_id: entry.subject?.id,
      subject_name: entry.subject?.name,
      subject_code: entry.subject?.code,
      teacher_id: entry.teacher?.id,
      teacher_name: entry.teacher?.profile 
        ? `${entry.teacher.profile.first_name} ${entry.teacher.profile.last_name}`.trim()
        : 'Unassigned',
      period_title: entry.period?.title,
      period_short_name: entry.period?.short_name
    }))
  }

  /**
   * Create a new period
   */
  async createPeriod(
    schoolId: string,
    campusId: string | null,
    data: CreatePeriodDTO
  ): Promise<Period> {
    const { data: period, error } = await supabase
      .from('periods')
      .insert({
        school_id: schoolId,
        campus_id: campusId,
        title: data.title,
        short_name: data.short_name,
        sort_order: data.sort_order,
        length_minutes: data.length_minutes,
        block: data.block || null,
        period_name: data.title, // For backward compatibility
        period_number: data.sort_order, // For backward compatibility
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating period:', error)
      throw new Error('Failed to create period: ' + error.message)
    }

    return period
  }

  /**
   * Update a period
   */
  async updatePeriod(periodId: string, data: UpdatePeriodDTO): Promise<Period> {
    const updateData: any = {}
    
    if (data.title !== undefined) {
      updateData.title = data.title
      updateData.period_name = data.title // For backward compatibility
    }
    if (data.short_name !== undefined) updateData.short_name = data.short_name
    if (data.sort_order !== undefined) {
      updateData.sort_order = data.sort_order
      updateData.period_number = data.sort_order // For backward compatibility
    }
    if (data.length_minutes !== undefined) updateData.length_minutes = data.length_minutes
    if (data.block !== undefined) updateData.block = data.block

    const { data: period, error } = await supabase
      .from('periods')
      .update(updateData)
      .eq('id', periodId)
      .select()
      .single()

    if (error) {
      console.error('Error updating period:', error)
      throw new Error('Failed to update period')
    }

    return period
  }

  /**
   * Delete a period (soft delete)
   */
  async deletePeriod(periodId: string): Promise<void> {
    // Check if period is used in timetable
    const { count } = await supabase
      .from('timetable_entries')
      .select('*', { count: 'exact', head: true })
      .eq('period_id', periodId)
      .eq('is_active', true)

    if (count && count > 0) {
      throw new Error(`Cannot delete period. It is used in ${count} timetable entries.`)
    }

    const { error } = await supabase
      .from('periods')
      .update({ is_active: false })
      .eq('id', periodId)

    if (error) {
      console.error('Error deleting period:', error)
      throw new Error('Failed to delete period')
    }
  }

  /**
   * Bulk upsert periods (for the spreadsheet-like interface)
   */
  async bulkUpsertPeriods(
    schoolId: string,
    campusId: string | null,
    periods: CreatePeriodDTO[]
  ): Promise<Period[]> {
    // First, soft-delete all existing periods for this school/campus that are not in the new list
    const { data: existingPeriods } = await supabase
      .from('periods')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_active', true)

    // Insert/update all periods
    const results: Period[] = []
    
    for (const period of periods) {
      const { data, error } = await supabase
        .from('periods')
        .upsert({
          school_id: schoolId,
          campus_id: campusId,
          title: period.title,
          short_name: period.short_name,
          sort_order: period.sort_order,
          length_minutes: period.length_minutes,
          block: period.block || null,
          period_name: period.title,
          period_number: period.sort_order,
          is_active: true
        }, {
          onConflict: 'school_id,period_number',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting period:', error)
        // Continue with other periods
      } else if (data) {
        results.push(data)
      }
    }

    return results
  }

  /**
   * Save all periods (replace existing)
   * Uses upsert to handle the unique constraint properly
   */
  async saveAllPeriods(
    schoolId: string,
    campusId: string | null,
    periods: CreatePeriodDTO[]
  ): Promise<Period[]> {
    // Get all existing period IDs for this school/campus
    let existingQuery = supabase
      .from('periods')
      .select('id, sort_order')
      .eq('school_id', schoolId)
      .eq('is_active', true)
    
    if (campusId) {
      existingQuery = existingQuery.eq('campus_id', campusId)
    } else {
      existingQuery = existingQuery.is('campus_id', null)
    }
    
    const { data: existingPeriods } = await existingQuery
    const existingIds = new Set((existingPeriods || []).map(p => p.id))
    
    // Build a map of sort_order to existing period for updates
    const sortOrderToExisting = new Map<number, string>()
    for (const ep of existingPeriods || []) {
      sortOrderToExisting.set(ep.sort_order, ep.id)
    }

    const results: Period[] = []
    const processedIds = new Set<string>()

    // Update or insert each period
    for (const period of periods) {
      const sortOrder = period.sort_order
      const existingId = sortOrderToExisting.get(sortOrder)
      
      if (existingId) {
        // Update existing period
        const { data, error } = await supabase
          .from('periods')
          .update({
            title: period.title,
            short_name: period.short_name,
            length_minutes: period.length_minutes,
            block: period.block || null,
            period_name: period.title,
            is_active: true
          })
          .eq('id', existingId)
          .select()
          .single()

        if (error) {
          console.error('Error updating period:', error)
        } else if (data) {
          results.push(data)
          processedIds.add(existingId)
        }
      } else {
        // Insert new period
        const { data, error } = await supabase
          .from('periods')
          .insert({
            school_id: schoolId,
            campus_id: campusId,
            title: period.title,
            short_name: period.short_name,
            sort_order: sortOrder,
            length_minutes: period.length_minutes,
            block: period.block || null,
            period_name: period.title,
            period_number: sortOrder,
            is_active: true
          })
          .select()
          .single()

        if (error) {
          console.error('Error inserting period:', error)
          throw new Error('Failed to save periods: ' + error.message)
        } else if (data) {
          results.push(data)
          processedIds.add(data.id)
        }
      }
    }

    // Soft-delete periods that were not in the new list
    const idsToDelete = [...existingIds].filter(id => !processedIds.has(id))
    if (idsToDelete.length > 0) {
      await supabase
        .from('periods')
        .update({ is_active: false })
        .in('id', idsToDelete)
    }

    return results
  }
}

export const periodsService = new PeriodsService()
