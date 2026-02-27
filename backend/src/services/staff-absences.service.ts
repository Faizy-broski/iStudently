import { supabase } from '../config/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface StaffAbsenceField {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  type: string
  select_options?: string | null
  default_selection?: string | null
  sort_order?: number | null
  required: boolean
  created_at: string
  updated_at: string
}

export interface StaffAbsence {
  id: string
  school_id: string
  campus_id?: string | null
  staff_id: string
  created_by: string
  academic_year_id?: string | null
  start_date: string
  end_date: string
  reason?: string | null
  notes?: string | null
  status: 'pending' | 'approved' | 'rejected'
  custom_fields?: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined fields
  staff_name?: string
  staff_email?: string
  staff_role?: string
  cancelled_course_periods?: string[]
}

export interface CreateStaffAbsenceDTO {
  school_id: string
  campus_id?: string
  staff_id: string
  created_by: string
  academic_year_id?: string
  start_date: string
  end_date: string
  reason?: string
  notes?: string
  status?: 'pending' | 'approved' | 'rejected'
  custom_fields?: Record<string, unknown>
  cancelled_course_period_ids?: string[]
}

export interface UpdateStaffAbsenceDTO {
  start_date?: string
  end_date?: string
  reason?: string
  notes?: string
  status?: 'pending' | 'approved' | 'rejected'
  custom_fields?: Record<string, unknown>
  cancelled_course_period_ids?: string[]
}

export interface StaffAbsenceFilters {
  school_id: string
  campus_id?: string
  staff_id?: string
  start_date?: string
  end_date?: string
  status?: string
  academic_year_id?: string
}

interface ApiResponse<T> {
  data: T | null
  error: string | null
}

// ============================================================================
// STAFF ABSENCE FIELDS
// ============================================================================

export const getAbsenceFields = async (
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<StaffAbsenceField[]>> => {
  try {
    let q = supabase
      .from('staff_absence_fields')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    if (campusId) q = q.eq('campus_id', campusId)

    const { data, error } = await q
    if (error) return { data: null, error: error.message }
    return { data: data as StaffAbsenceField[], error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export const createAbsenceField = async (
  dto: Omit<StaffAbsenceField, 'id' | 'created_at' | 'updated_at'>
): Promise<ApiResponse<StaffAbsenceField>> => {
  try {
    const { data, error } = await supabase
      .from('staff_absence_fields')
      .insert(dto)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as StaffAbsenceField, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export const updateAbsenceField = async (
  id: string,
  dto: Partial<Omit<StaffAbsenceField, 'id' | 'school_id' | 'created_at' | 'updated_at'>>
): Promise<ApiResponse<StaffAbsenceField>> => {
  try {
    const { data, error } = await supabase
      .from('staff_absence_fields')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return { data: null, error: error.message }
    return { data: data as StaffAbsenceField, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

export const deleteAbsenceField = async (
  id: string
): Promise<ApiResponse<null>> => {
  try {
    const { error } = await supabase
      .from('staff_absence_fields')
      .delete()
      .eq('id', id)
    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// STAFF ABSENCES - LIST
// ============================================================================

export const getAbsences = async (
  filters: StaffAbsenceFilters
): Promise<ApiResponse<StaffAbsence[]>> => {
  try {
    let q = supabase
      .from('staff_absences')
      .select(`
        *,
        staff:profiles!staff_absences_staff_id_fkey(id, first_name, last_name, email, role),
        staff_absence_course_periods(course_period_id)
      `)
      .eq('school_id', filters.school_id)
      .order('start_date', { ascending: false })

    if (filters.campus_id) q = q.eq('campus_id', filters.campus_id)
    if (filters.staff_id) q = q.eq('staff_id', filters.staff_id)
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.academic_year_id) q = q.eq('academic_year_id', filters.academic_year_id)
    if (filters.start_date) q = q.gte('start_date', filters.start_date)
    if (filters.end_date) q = q.lte('start_date', filters.end_date + 'T23:59:59')

    const { data, error } = await q
    if (error) return { data: null, error: error.message }

    const absences = (data || []).map((row: any) => ({
      ...row,
      staff_name: row.staff
        ? `${row.staff.first_name || ''} ${row.staff.last_name || ''}`.trim()
        : '',
      staff_email: row.staff?.email || '',
      staff_role: row.staff?.role || '',
      cancelled_course_periods: (row.staff_absence_course_periods || []).map(
        (cp: any) => cp.course_period_id
      ),
    }))

    return { data: absences, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// STAFF ABSENCES - SINGLE
// ============================================================================

export const getAbsenceById = async (
  id: string
): Promise<ApiResponse<StaffAbsence>> => {
  try {
    const { data, error } = await supabase
      .from('staff_absences')
      .select(`
        *,
        staff:profiles!staff_absences_staff_id_fkey(id, first_name, last_name, email, role),
        staff_absence_course_periods(course_period_id)
      `)
      .eq('id', id)
      .single()

    if (error) return { data: null, error: error.message }

    const absence = {
      ...data,
      staff_name: data.staff
        ? `${data.staff.first_name || ''} ${data.staff.last_name || ''}`.trim()
        : '',
      staff_email: data.staff?.email || '',
      staff_role: data.staff?.role || '',
      cancelled_course_periods: (data.staff_absence_course_periods || []).map(
        (cp: any) => cp.course_period_id
      ),
    }

    return { data: absence as StaffAbsence, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// STAFF ABSENCES - CREATE
// ============================================================================

export const createAbsence = async (
  dto: CreateStaffAbsenceDTO
): Promise<ApiResponse<StaffAbsence>> => {
  try {
    const { cancelled_course_period_ids, ...absenceData } = dto

    const { data, error } = await supabase
      .from('staff_absences')
      .insert(absenceData)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    // Insert cancelled course periods
    if (cancelled_course_period_ids?.length) {
      const cpRows = cancelled_course_period_ids.map(cpId => ({
        staff_absence_id: data.id,
        course_period_id: cpId,
      }))
      await supabase.from('staff_absence_course_periods').insert(cpRows)
    }

    return await getAbsenceById(data.id)
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// STAFF ABSENCES - UPDATE
// ============================================================================

export const updateAbsence = async (
  id: string,
  dto: UpdateStaffAbsenceDTO
): Promise<ApiResponse<StaffAbsence>> => {
  try {
    const { cancelled_course_period_ids, ...updateData } = dto

    const { error } = await supabase
      .from('staff_absences')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { data: null, error: error.message }

    // Replace cancelled course periods if provided
    if (cancelled_course_period_ids !== undefined) {
      await supabase
        .from('staff_absence_course_periods')
        .delete()
        .eq('staff_absence_id', id)

      if (cancelled_course_period_ids.length) {
        const cpRows = cancelled_course_period_ids.map(cpId => ({
          staff_absence_id: id,
          course_period_id: cpId,
        }))
        await supabase.from('staff_absence_course_periods').insert(cpRows)
      }
    }

    return await getAbsenceById(id)
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// STAFF ABSENCES - DELETE
// ============================================================================

export const deleteAbsence = async (id: string): Promise<ApiResponse<null>> => {
  try {
    const { error } = await supabase
      .from('staff_absences')
      .delete()
      .eq('id', id)
    if (error) return { data: null, error: error.message }
    return { data: null, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// CANCELLED CLASSES REPORT
// ============================================================================

export interface CancelledClassRow {
  absence_id: string
  staff_name: string
  staff_id: string
  start_date: string
  end_date: string
  course_period_id: string
  course_period_title: string
  short_name: string
}

export const getCancelledClasses = async (
  filters: StaffAbsenceFilters
): Promise<ApiResponse<CancelledClassRow[]>> => {
  try {
    let q = supabase
      .from('staff_absence_course_periods')
      .select(`
        id,
        course_period_id,
        staff_absence_id,
        staff_absences!inner(
          id, start_date, end_date, staff_id, school_id, campus_id,
          staff:profiles!staff_absences_staff_id_fkey(first_name, last_name)
        ),
        course_periods!inner(title, short_name)
      `)
      .eq('staff_absences.school_id', filters.school_id)

    if (filters.campus_id) {
      q = q.eq('staff_absences.campus_id', filters.campus_id)
    }
    if (filters.staff_id) {
      q = q.eq('staff_absences.staff_id', filters.staff_id)
    }
    if (filters.start_date) {
      q = q.gte('staff_absences.start_date', filters.start_date)
    }
    if (filters.end_date) {
      q = q.lte('staff_absences.start_date', filters.end_date + 'T23:59:59')
    }

    const { data, error } = await q
    if (error) return { data: null, error: error.message }

    const rows: CancelledClassRow[] = (data || []).map((row: any) => ({
      absence_id: row.staff_absences?.id || '',
      staff_id: row.staff_absences?.staff_id || '',
      staff_name: row.staff_absences?.staff
        ? `${row.staff_absences.staff.first_name || ''} ${row.staff_absences.staff.last_name || ''}`.trim()
        : '',
      start_date: row.staff_absences?.start_date || '',
      end_date: row.staff_absences?.end_date || '',
      course_period_id: row.course_period_id,
      course_period_title: row.course_periods?.title || '',
      short_name: row.course_periods?.short_name || '',
    }))

    return { data: rows, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// BREAKDOWN REPORT – absences count grouped by month + staff
// ============================================================================

export interface BreakdownRow {
  staff_id: string
  staff_name: string
  month: string  // YYYY-MM
  days_absent: number
}

export const getAbsenceBreakdown = async (
  schoolId: string,
  startDate: string,
  endDate: string,
  campusId?: string
): Promise<ApiResponse<BreakdownRow[]>> => {
  try {
    let q = supabase
      .from('staff_absences')
      .select(`
        id, staff_id, start_date, end_date, campus_id,
        staff:profiles!staff_absences_staff_id_fkey(first_name, last_name)
      `)
      .eq('school_id', schoolId)
      .gte('start_date', startDate)
      .lte('start_date', endDate + 'T23:59:59')

    if (campusId) q = q.eq('campus_id', campusId)

    const { data, error } = await q
    if (error) return { data: null, error: error.message }

    // Group by staff + month
    const grouped: Record<string, BreakdownRow> = {}

    for (const row of data || []) {
      const month = row.start_date?.slice(0, 7) || ''
      const key = `${row.staff_id}::${month}`
      const staffName = row.staff
        ? `${row.staff.first_name || ''} ${row.staff.last_name || ''}`.trim()
        : row.staff_id

      // Calculate days absent (difference in days)
      const start = new Date(row.start_date)
      const end = new Date(row.end_date)
      const diffMs = end.getTime() - start.getTime()
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24) * 10) / 10 || 0.5

      if (!grouped[key]) {
        grouped[key] = { staff_id: row.staff_id, staff_name: staffName, month, days_absent: 0 }
      }
      grouped[key].days_absent += days
    }

    return { data: Object.values(grouped), error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// GET STAFF LIST (for dropdown)
// ============================================================================

export const getStaffList = async (
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<{ id: string; name: string; role: string }[]>> => {
  try {
    let q = supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('school_id', schoolId)
      .in('role', ['admin', 'teacher', 'staff'])
      .eq('is_active', true)
      .order('first_name', { ascending: true })

    if (campusId) q = q.eq('campus_id', campusId)

    const { data, error } = await q
    if (error) return { data: null, error: error.message }

    const staff = (data || []).map((p: any) => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      role: p.role,
    }))

    return { data: staff, error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

// ============================================================================
// GET COURSE PERIODS for a staff member (for cancelled classes selection)
// ============================================================================

export const getStaffCoursePeriods = async (
  staffId: string,
  schoolId: string,
  campusId?: string
): Promise<ApiResponse<{ id: string; title: string; short_name: string }[]>> => {
  try {
    let q = supabase
      .from('course_periods')
      .select('id, title, short_name')
      .eq('school_id', schoolId)
      .eq('teacher_id', staffId)

    if (campusId) q = q.eq('campus_id', campusId)

    const { data, error } = await q
    if (error) return { data: null, error: error.message }
    return { data: data || [], error: null }
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}
