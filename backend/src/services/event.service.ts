import { supabase } from '../config/supabase'
import { 
  SchoolEvent, 
  CreateEventDTO, 
  UpdateEventDTO,
  EventFilters,
  EventCategory,
  UserRole
} from '../types'

export class EventService {
  /**
   * Get all events for a school with optional filters
   */
  async getEvents(
    schoolId: string,
    filters?: EventFilters,
    page: number = 1,
    limit: number = 50,
    campusId?: string
  ) {
    const offset = (page - 1) * limit

    let query = supabase
      .from('school_events')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('start_at', { ascending: true })

    // Filter by campus: show events for this campus OR school-wide (null campus_id)
    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    // Apply filters
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.start_date) {
      query = query.gte('start_at', filters.start_date)
    }

    if (filters?.end_date) {
      query = query.lte('end_at', filters.end_date)
    }

    if (filters?.user_role) {
      query = query.contains('visible_to_roles', [filters.user_role])
    }

    if (filters?.grade_level) {
      query = query.contains('target_grades', [filters.grade_level])
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    return {
      events: data || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }
  }

  /**
   * Get events for a date range (for calendar view)
   * An event should appear if it overlaps with the date range at all
   */
  async getEventsForRange(
    schoolId: string,
    startDate: string,
    endDate: string,
    category?: EventCategory,
    userRole?: UserRole,
    campusId?: string
  ) {
    let query = supabase
      .from('school_events')
      .select('*')
      .eq('school_id', schoolId)
      // Event overlaps if: event_start <= range_end AND event_end >= range_start
      .lte('start_at', endDate)
      .gte('end_at', startDate)
      .order('start_at', { ascending: true })

    // Filter by campus: show events for this campus OR school-wide (null campus_id)
    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (userRole) {
      query = query.contains('visible_to_roles', [userRole])
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch events for range: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a single event by ID
   */
  async getEventById(eventId: string, schoolId: string): Promise<SchoolEvent | null> {
    const { data, error } = await supabase
      .from('school_events')
      .select('*')
      .eq('id', eventId)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to fetch event: ${error.message}`)
    }

    return data
  }

  /**
   * Create a new event
   */
  async createEvent(eventData: CreateEventDTO): Promise<SchoolEvent> {
    const { data, error } = await supabase
      .from('school_events')
      .insert({
        school_id: eventData.school_id,
        campus_id: eventData.campus_id || null,
        title: eventData.title,
        description: eventData.description || null,
        category: eventData.category,
        start_at: eventData.start_at,
        end_at: eventData.end_at,
        is_all_day: eventData.is_all_day ?? false,
        visible_to_roles: eventData.visible_to_roles || ['student', 'parent', 'teacher', 'admin'],
        target_grades: eventData.target_grades || null,
        color_code: eventData.color_code || '#3b82f6',
        send_reminder: eventData.send_reminder ?? false,
        hijri_offset: eventData.hijri_offset ?? 0,
        // Only sent when set, so ordinary event creation keeps working even
        // before the marking_period_id migration has been applied.
        ...(eventData.marking_period_id ? { marking_period_id: eventData.marking_period_id } : {}),
        created_by: eventData.created_by || null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create event: ${error.message}`)
    }

    return data
  }

  /**
   * Bulk-create events for one marking period (spreadsheet import).
   * Every row is validated independently; valid rows are inserted in one
   * batch and invalid ones are reported back by row number without blocking
   * the rest. Event dates must fall inside the marking period's own
   * start/end dates.
   */
  async bulkCreateEvents(params: {
    schoolId: string
    campusId?: string | null
    markingPeriodId: string
    createdBy?: string
    rows: Array<{
      row: number
      title?: string
      category?: string
      start_date?: string
      end_date?: string
      description?: string
      target_grades?: string[]
      color_code?: string
    }>
  }): Promise<{ created: number; errors: { row: number; error: string }[] }> {
    const { schoolId, campusId, markingPeriodId, createdBy, rows } = params
    const errors: { row: number; error: string }[] = []

    const { data: mp, error: mpErr } = await supabase
      .from('marking_periods')
      .select('id, school_id, campus_id, title, start_date, end_date')
      .eq('id', markingPeriodId)
      .maybeSingle()
    if (mpErr) throw new Error(`Failed to load marking period: ${mpErr.message}`)
    const allowedOwners = [schoolId, campusId].filter(Boolean) as string[]
    if (!mp || !(allowedOwners.includes(mp.school_id) || (mp.campus_id && allowedOwners.includes(mp.campus_id)))) {
      throw new Error('Marking period not found for this school')
    }
    if (!mp.start_date || !mp.end_date) {
      throw new Error('This marking period has no start/end dates set — set them first, then import')
    }

    const CATEGORIES: EventCategory[] = ['academic', 'holiday', 'exam', 'meeting', 'activity', 'reminder']
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
    const isRealDate = (d: string) => DATE_RE.test(d) && !isNaN(new Date(d + 'T00:00:00Z').getTime())

    const inserts: any[] = []
    for (const r of rows) {
      const title = (r.title || '').trim()
      const category = (r.category || '').trim().toLowerCase() as EventCategory
      const start = (r.start_date || '').trim()
      const end = (r.end_date || '').trim() || start
      if (!title) { errors.push({ row: r.row, error: 'Title is required' }); continue }
      if (!CATEGORIES.includes(category)) {
        errors.push({ row: r.row, error: `Category must be one of: ${CATEGORIES.join(', ')}` }); continue
      }
      if (!isRealDate(start) || !isRealDate(end)) {
        errors.push({ row: r.row, error: 'Dates must be valid and formatted YYYY-MM-DD' }); continue
      }
      if (end < start) { errors.push({ row: r.row, error: 'End date is before start date' }); continue }
      if (start < mp.start_date || end > mp.end_date) {
        errors.push({ row: r.row, error: `Dates must be within the marking period (${mp.start_date} to ${mp.end_date})` }); continue
      }
      inserts.push({
        school_id: schoolId,
        campus_id: campusId || null,
        marking_period_id: mp.id,
        title,
        description: (r.description || '').trim() || null,
        category,
        start_at: `${start}T00:00:00.000Z`,
        end_at: `${end}T23:59:59.000Z`,
        is_all_day: true,
        visible_to_roles: ['student', 'parent', 'teacher', 'admin'],
        target_grades: r.target_grades && r.target_grades.length > 0 ? r.target_grades : null,
        color_code: /^#[0-9a-fA-F]{6}$/.test(r.color_code || '') ? r.color_code : '#3b82f6',
        send_reminder: false,
        hijri_offset: 0,
        created_by: createdBy || null,
      })
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('school_events').insert(inserts)
      if (error) throw new Error(`Failed to import events: ${error.message}`)
    }
    return { created: inserts.length, errors }
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    schoolId: string,
    updates: UpdateEventDTO
  ): Promise<SchoolEvent> {
    const { data, error } = await supabase
      .from('school_events')
      .update(updates)
      .eq('id', eventId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update event: ${error.message}`)
    }

    return data
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('school_events')
      .delete()
      .eq('id', eventId)
      .eq('school_id', schoolId)

    if (error) {
      throw new Error(`Failed to delete event: ${error.message}`)
    }
  }

  /**
   * Get event categories with counts
   */
  async getEventCategoryCounts(schoolId: string, startDate?: string, endDate?: string, campusId?: string) {
    let query = supabase
      .from('school_events')
      .select('category, start_at')
      .eq('school_id', schoolId)

    // Filter by campus: show events for this campus OR school-wide (null campus_id)
    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    // Apply date range filter if provided
    if (startDate) {
      query = query.gte('start_at', startDate)
    }
    if (endDate) {
      query = query.lte('start_at', endDate)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch category counts: ${error.message}`)
    }

    const counts: Record<EventCategory, number> = {
      academic: 0,
      holiday: 0,
      exam: 0,
      meeting: 0,
      activity: 0,
      reminder: 0
    }

    data?.forEach((event: any) => {
      if (event.category && counts[event.category as EventCategory] !== undefined) {
        counts[event.category as EventCategory]++
      }
    })

    return counts
  }

  /**
   * Update Hijri offset globally for religious holidays
   */
  async updateHijriOffset(
    schoolId: string,
    category: EventCategory,
    offset: number
  ): Promise<number> {
    const { data, error } = await supabase
      .from('school_events')
      .update({ hijri_offset: offset })
      .eq('school_id', schoolId)
      .eq('category', category)
      .select()

    if (error) {
      throw new Error(`Failed to update Hijri offset: ${error.message}`)
    }

    return data?.length || 0
  }

  /**
   * Get upcoming events (next 30 days)
   */
  async getUpcomingEvents(schoolId: string, userRole?: UserRole, limit: number = 10) {
    const now = new Date().toISOString()
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('school_events')
      .select('*')
      .eq('school_id', schoolId)
      .gte('start_at', now)
      .lte('start_at', thirtyDaysLater)
      .order('start_at', { ascending: true })
      .limit(limit)

    if (userRole) {
      query = query.contains('visible_to_roles', [userRole])
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch upcoming events: ${error.message}`)
    }

    return data || []
  }
}
