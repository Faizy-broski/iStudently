import { supabase } from '../config/supabase'

// ---- Interfaces ----

export interface ResourceLink {
  id: string
  school_id: string
  campus_id?: string
  title: string
  url: string
  visible_to: string[]
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateResourceLinkDTO {
  title: string
  url: string
  visible_to?: string[]
  campus_id?: string
  sort_order?: number
}

export interface UpdateResourceLinkDTO {
  title?: string
  url?: string
  visible_to?: string[]
  sort_order?: number
}

// ---- Service ----

export class ResourceLinksService {
  /**
   * List all resource links for a school
   */
  async getResourceLinks(schoolId: string, campusId?: string): Promise<ResourceLink[]> {
    let query = supabase
      .from('resource_links')
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
   * List resource links visible to a specific role
   */
  async getVisibleResourceLinks(
    schoolId: string,
    role: string,
    campusId?: string
  ): Promise<ResourceLink[]> {
    let query = supabase
      .from('resource_links')
      .select('*')
      .eq('school_id', schoolId)
      .contains('visible_to', [role])
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
   * Get a single resource link
   */
  async getResourceLinkById(linkId: string, schoolId: string): Promise<ResourceLink | null> {
    const { data, error } = await supabase
      .from('resource_links')
      .select('*')
      .eq('id', linkId)
      .eq('school_id', schoolId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return data
  }

  /**
   * Create a new resource link
   */
  async createResourceLink(
    schoolId: string,
    createdBy: string,
    dto: CreateResourceLinkDTO
  ): Promise<ResourceLink> {
    const { data, error } = await supabase
      .from('resource_links')
      .insert({
        school_id: schoolId,
        campus_id: dto.campus_id || null,
        title: dto.title,
        url: dto.url,
        visible_to: dto.visible_to || ['admin'],
        sort_order: dto.sort_order ?? null,
        created_by: createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Update a resource link
   */
  async updateResourceLink(
    linkId: string,
    schoolId: string,
    dto: UpdateResourceLinkDTO
  ): Promise<ResourceLink> {
    const updateData: Record<string, unknown> = {}
    if (dto.title !== undefined) updateData.title = dto.title
    if (dto.url !== undefined) updateData.url = dto.url
    if (dto.visible_to !== undefined) updateData.visible_to = dto.visible_to
    if (dto.sort_order !== undefined) updateData.sort_order = dto.sort_order

    const { data, error } = await supabase
      .from('resource_links')
      .update(updateData)
      .eq('id', linkId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * Delete a resource link
   */
  async deleteResourceLink(linkId: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('resource_links')
      .delete()
      .eq('id', linkId)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  /**
   * Bulk save (create/update/delete) resource links — for "Save" button workflow
   */
  async bulkSave(
    schoolId: string,
    createdBy: string,
    links: Array<{
      id?: string
      title: string
      url: string
      visible_to: string[]
      sort_order?: number
    }>,
    existingIds: string[]
  ): Promise<ResourceLink[]> {
    // Delete links that were removed (existingIds not in the new set)
    const newIds = links.filter((l) => l.id).map((l) => l.id!)
    const toDelete = existingIds.filter((id) => !newIds.includes(id))

    for (const id of toDelete) {
      await this.deleteResourceLink(id, schoolId)
    }

    const results: ResourceLink[] = []

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      if (link.id) {
        // Update existing
        const updated = await this.updateResourceLink(link.id, schoolId, {
          title: link.title,
          url: link.url,
          visible_to: link.visible_to,
          sort_order: i + 1,
        })
        results.push(updated)
      } else {
        // Create new
        const created = await this.createResourceLink(schoolId, createdBy, {
          title: link.title,
          url: link.url,
          visible_to: link.visible_to,
          sort_order: i + 1,
        })
        results.push(created)
      }
    }

    return results
  }
}
