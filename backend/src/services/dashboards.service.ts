import { supabase } from '../config/supabase'

// ---- Interfaces ----

export interface Dashboard {
  id: string
  school_id: string
  campus_id?: string
  title: string
  description?: string
  is_active: boolean
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
  elements?: DashboardElement[]
}

export interface DashboardElement {
  id: string
  dashboard_id: string
  type: string
  url: string
  title?: string
  width_percent: number
  height_px: number
  sort_order?: number
  refresh_minutes?: number
  custom_css?: string
  created_at: string
  updated_at: string
}

export interface CreateDashboardDTO {
  title: string
  description?: string
  campus_id?: string
}

export interface UpdateDashboardDTO {
  title?: string
  description?: string
  is_active?: boolean
  sort_order?: number
}

export interface CreateElementDTO {
  url: string
  title?: string
  width_percent?: number
  height_px?: number
  sort_order?: number
  refresh_minutes?: number
  custom_css?: string
}

export interface UpdateElementDTO {
  url?: string
  title?: string
  width_percent?: number
  height_px?: number
  sort_order?: number
  refresh_minutes?: number
  custom_css?: string
}

// ---- Service ----

export class DashboardsService {
  /**
   * List all dashboards for a school
   */
  async getDashboards(schoolId: string, campusId?: string): Promise<Dashboard[]> {
    let query = supabase
      .from('dashboards')
      .select('*')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error

    return data || []
  }

  /**
   * Get a single dashboard with its elements
   */
  async getDashboardById(dashboardId: string, schoolId: string): Promise<Dashboard | null> {
    const { data, error } = await supabase
      .from('dashboards')
      .select(`
        *,
        dashboard_elements (
          id, dashboard_id, type, url, title,
          width_percent, height_px, sort_order,
          refresh_minutes, custom_css,
          created_at, updated_at
        )
      `)
      .eq('id', dashboardId)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    // Sort elements by sort_order
    if (data?.dashboard_elements) {
      data.dashboard_elements.sort((a: any, b: any) => {
        const aSort = a.sort_order ?? 9999
        const bSort = b.sort_order ?? 9999
        return aSort - bSort
      })
    }

    return { ...data, elements: data?.dashboard_elements || [] }
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(
    schoolId: string,
    createdBy: string,
    dto: CreateDashboardDTO
  ): Promise<Dashboard> {
    const { data, error } = await supabase
      .from('dashboards')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id || null,
        title: dto.title,
        description: dto.description || null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update a dashboard
   */
  async updateDashboard(
    dashboardId: string,
    schoolId: string,
    dto: UpdateDashboardDTO
  ): Promise<Dashboard> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order

    const { data, error } = await supabase
      .from('dashboards')
      .update(updateData)
      .eq('id', dashboardId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete a dashboard (and its elements via CASCADE)
   */
  async deleteDashboard(dashboardId: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', dashboardId)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  // ---- Dashboard Elements ----

  /**
   * Get all elements for a dashboard
   */
  async getElements(dashboardId: string): Promise<DashboardElement[]> {
    const { data, error } = await supabase
      .from('dashboard_elements')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  }

  /**
   * Add an element to a dashboard
   */
  async createElement(
    dashboardId: string,
    dto: CreateElementDTO
  ): Promise<DashboardElement> {
    const { data, error } = await supabase
      .from('dashboard_elements')
      .insert({
        dashboard_id: dashboardId,
        type: 'iframe',
        url: dto.url,
        title: dto.title || null,
        width_percent: dto.width_percent ?? 100,
        height_px: dto.height_px ?? 400,
        sort_order: dto.sort_order ?? null,
        refresh_minutes: dto.refresh_minutes ?? null,
        custom_css: dto.custom_css || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update an element
   */
  async updateElement(
    elementId: string,
    dashboardId: string,
    dto: UpdateElementDTO
  ): Promise<DashboardElement> {
    const updateData: Record<string, unknown> = {}
    if (dto.url !== undefined) updateData.url = dto.url
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.width_percent !== undefined) updateData.width_percent = dto.width_percent
    if (dto.height_px !== undefined) updateData.height_px = dto.height_px
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order
    if (dto.refresh_minutes !== undefined) updateData.refresh_minutes = dto.refresh_minutes
    if (dto.custom_css !== undefined) updateData.custom_css = dto.custom_css

    const { data, error } = await supabase
      .from('dashboard_elements')
      .update(updateData)
      .eq('id', elementId)
      .eq('dashboard_id', dashboardId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete an element
   */
  async deleteElement(elementId: string, dashboardId: string): Promise<void> {
    const { error } = await supabase
      .from('dashboard_elements')
      .delete()
      .eq('id', elementId)
      .eq('dashboard_id', dashboardId)

    if (error) throw error
  }

  /**
   * Bulk update elements (for reordering)
   */
  async bulkUpdateElements(
    dashboardId: string,
    elements: { id: string; sort_order: number }[]
  ): Promise<void> {
    for (const el of elements) {
      const { error } = await supabase
        .from('dashboard_elements')
        .update({ sort_order: el.sort_order })
        .eq('id', el.id)
        .eq('dashboard_id', dashboardId)

      if (error) throw error
    }
  }
}
