import { supabase } from '../config/supabase'

// ---- Interfaces ----

export interface ResourceLink {
  id: string
  school_id: string
  campus_id?: string
  title: string
  url: string
  visible_to: string[]                   // roles: admin, teacher, student, parent, …
  visible_to_grade_ids: string[]         // student/parent grade sub-filter (empty = all)
  visible_to_section_ids: string[]       // student section sub-filter — overrides grade when set
  visible_to_teacher_ids: string[]       // teacher sub-filter (empty = all teachers)
  visible_to_student_ids: string[]       // specific student record IDs (empty = all in section/grade)
  sort_order?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateResourceLinkDTO {
  title: string
  url: string
  visible_to?: string[]
  visible_to_grade_ids?: string[]
  visible_to_section_ids?: string[]
  visible_to_teacher_ids?: string[]
  visible_to_student_ids?: string[]
  campus_id?: string
  sort_order?: number
}

export interface UpdateResourceLinkDTO {
  title?: string
  url?: string
  visible_to?: string[]
  visible_to_grade_ids?: string[]
  visible_to_section_ids?: string[]
  visible_to_teacher_ids?: string[]
  visible_to_student_ids?: string[]
  sort_order?: number
}

interface UserContext {
  role: string
  sectionId?:  string | null
  gradeId?:    string | null
  staffId?:    string | null
  studentId?:  string | null   // students.id (record id, not profile id)
  profileId?:  string | null   // profiles.id — used to look up parent's children
  childStudentIds?: string[]   // resolved lazily for parent role
}

// ---- Service ----

export class ResourceLinksService {
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

  async getVisibleResourceLinks(
    schoolId: string,
    ctx: UserContext,
    campusId?: string
  ): Promise<ResourceLink[]> {
    let query = supabase
      .from('resource_links')
      .select('*')
      .eq('school_id', schoolId)
      .contains('visible_to', [ctx.role])
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true })

    if (campusId) {
      query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
    }

    const { data, error } = await query
    if (error) throw error

    let links: ResourceLink[] = data || []

    // For parents: if any link targets specific students, resolve their children now
    if (ctx.role === 'parent' && ctx.profileId && links.some(l => l.visible_to_student_ids?.length > 0)) {
      const { data: psl } = await supabase
        .from('parent_student_links')
        .select('student_id')
        .eq('parent_id', ctx.profileId)
      ctx.childStudentIds = (psl || []).map((r: any) => r.student_id)
    }

    links = links.filter(link => this.matchesUserContext(link, ctx))
    return links
  }

  private matchesUserContext(link: ResourceLink, ctx: UserContext): boolean {
    const { role, sectionId, gradeId, staffId, studentId, profileId, childStudentIds } = ctx

    if (role === 'student') {
      // Student-specific filter (most granular)
      if (link.visible_to_student_ids?.length > 0) {
        return studentId ? link.visible_to_student_ids.includes(studentId) : false
      }
      // Section filter
      if (link.visible_to_section_ids?.length > 0) {
        return sectionId ? link.visible_to_section_ids.includes(sectionId) : false
      }
      // Grade filter
      if (link.visible_to_grade_ids?.length > 0) {
        return gradeId ? link.visible_to_grade_ids.includes(gradeId) : false
      }
      return true
    }

    if (role === 'parent') {
      // Student-specific: check if any of parent's children match
      if (link.visible_to_student_ids?.length > 0) {
        if (!childStudentIds?.length) return false
        return childStudentIds.some(cid => link.visible_to_student_ids.includes(cid))
      }
      // Section / grade: parents share context via their children
      // We don't have parent's child section/grade in the profile, so treat same as unfiltered
      // (the role filter already ensures only parents see this)
      return true
    }

    if (role === 'teacher') {
      if (link.visible_to_teacher_ids?.length > 0) {
        return staffId ? link.visible_to_teacher_ids.includes(staffId) : false
      }
      return true
    }

    // admin, librarian, staff: no sub-filter
    return true
  }

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

  async createResourceLink(
    schoolId: string,
    createdBy: string,
    dto: CreateResourceLinkDTO
  ): Promise<ResourceLink> {
    const { data, error } = await supabase
      .from('resource_links')
      .insert({
        school_id:               schoolId,
        campus_id:               dto.campus_id || null,
        title:                   dto.title,
        url:                     dto.url,
        visible_to:              dto.visible_to              || ['admin'],
        visible_to_grade_ids:    dto.visible_to_grade_ids    || [],
        visible_to_section_ids:  dto.visible_to_section_ids  || [],
        visible_to_teacher_ids:  dto.visible_to_teacher_ids  || [],
        visible_to_student_ids:  dto.visible_to_student_ids  || [],
        sort_order:              dto.sort_order ?? null,
        created_by:              createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateResourceLink(
    linkId: string,
    schoolId: string,
    dto: UpdateResourceLinkDTO
  ): Promise<ResourceLink> {
    const updateData: Record<string, unknown> = {}
    if (dto.title                   !== undefined) updateData.title                   = dto.title
    if (dto.url                     !== undefined) updateData.url                     = dto.url
    if (dto.visible_to              !== undefined) updateData.visible_to              = dto.visible_to
    if (dto.visible_to_grade_ids    !== undefined) updateData.visible_to_grade_ids    = dto.visible_to_grade_ids
    if (dto.visible_to_section_ids  !== undefined) updateData.visible_to_section_ids  = dto.visible_to_section_ids
    if (dto.visible_to_teacher_ids  !== undefined) updateData.visible_to_teacher_ids  = dto.visible_to_teacher_ids
    if (dto.visible_to_student_ids  !== undefined) updateData.visible_to_student_ids  = dto.visible_to_student_ids
    if (dto.sort_order              !== undefined) updateData.sort_order              = dto.sort_order

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

  async deleteResourceLink(linkId: string, schoolId: string): Promise<void> {
    const { error } = await supabase
      .from('resource_links')
      .delete()
      .eq('id', linkId)
      .eq('school_id', schoolId)

    if (error) throw error
  }

  async bulkSave(
    schoolId: string,
    createdBy: string,
    links: Array<{
      id?: string
      title: string
      url: string
      visible_to: string[]
      visible_to_grade_ids: string[]
      visible_to_section_ids: string[]
      visible_to_teacher_ids: string[]
      visible_to_student_ids: string[]
      sort_order?: number
    }>,
    existingIds: string[]
  ): Promise<ResourceLink[]> {
    const newIds = links.filter(l => l.id).map(l => l.id!)
    const toDelete = existingIds.filter(id => !newIds.includes(id))

    for (const id of toDelete) {
      await this.deleteResourceLink(id, schoolId)
    }

    const results: ResourceLink[] = []

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      const dto: UpdateResourceLinkDTO = {
        title:                  link.title,
        url:                    link.url,
        visible_to:             link.visible_to,
        visible_to_grade_ids:   link.visible_to_grade_ids,
        visible_to_section_ids: link.visible_to_section_ids,
        visible_to_teacher_ids: link.visible_to_teacher_ids,
        visible_to_student_ids: link.visible_to_student_ids,
        sort_order:             i + 1,
      }

      if (link.id) {
        results.push(await this.updateResourceLink(link.id, schoolId, dto))
      } else {
        results.push(await this.createResourceLink(schoolId, createdBy, {
          title:                  link.title,
          url:                    link.url,
          visible_to:             link.visible_to,
          visible_to_grade_ids:   link.visible_to_grade_ids,
          visible_to_section_ids: link.visible_to_section_ids,
          visible_to_teacher_ids: link.visible_to_teacher_ids,
          visible_to_student_ids: link.visible_to_student_ids,
          sort_order:             i + 1,
        }))
      }
    }

    return results
  }
}
