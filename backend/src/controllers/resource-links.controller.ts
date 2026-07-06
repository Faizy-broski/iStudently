import { Request, Response } from 'express'
import { ResourceLinksService } from '../services/resource-links.service'

export interface AuthRequest extends Request {
  user?: { id: string; email?: string }
  profile?: {
    id: string
    school_id?: string
    role?: string
    is_active?: boolean
    campus_id?: string
    section_id?: string
    grade_id?: string
    staff_id?: string
    student_id?: string
  }
}

export class ResourceLinksController {
  private service: ResourceLinksService

  constructor() {
    this.service = new ResourceLinksService()
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const role     = req.profile?.role
      if (!schoolId || !role) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined

      let links
      if (role === 'admin' || role === 'super_admin') {
        links = await this.service.getResourceLinks(schoolId, campusId)
      } else {
        links = await this.service.getVisibleResourceLinks(
          schoolId,
          {
            role,
            sectionId:  req.profile?.section_id  || null,
            gradeId:    req.profile?.grade_id    || null,
            staffId:    req.profile?.staff_id    || null,
            studentId:  req.profile?.student_id  || null,
            profileId:  req.profile?.id          || null,
          },
          campusId
        )
      }

      res.json({ success: true, data: links })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list resource links' })
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const link = await this.service.getResourceLinkById(req.params.id, schoolId)
      if (!link) {
        res.status(404).json({ success: false, error: 'Resource link not found' })
        return
      }
      res.json({ success: true, data: link })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch resource link' })
    }
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId  = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { title, url, visible_to, visible_to_grade_ids, visible_to_section_ids, visible_to_teacher_ids, campus_id, sort_order, category_id } = req.body
      if (!title?.trim()) { res.status(400).json({ success: false, error: 'Title is required' }); return }
      if (!url?.trim())   { res.status(400).json({ success: false, error: 'URL is required' });   return }

      const link = await this.service.createResourceLink(schoolId, profileId, {
        title: title.trim(),
        url:   url.trim(),
        visible_to:             Array.isArray(visible_to)             ? visible_to             : ['admin'],
        visible_to_grade_ids:   Array.isArray(visible_to_grade_ids)   ? visible_to_grade_ids   : [],
        visible_to_section_ids: Array.isArray(visible_to_section_ids) ? visible_to_section_ids : [],
        visible_to_teacher_ids: Array.isArray(visible_to_teacher_ids) ? visible_to_teacher_ids : [],
        campus_id,
        sort_order,
        category_id: category_id ?? null,
      })

      res.status(201).json({ success: true, data: link })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create resource link' })
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const link = await this.service.updateResourceLink(req.params.id, schoolId, req.body)
      res.json({ success: true, data: link })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update resource link' })
    }
  }

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await this.service.deleteResourceLink(req.params.id, schoolId)
      res.json({ success: true, message: 'Resource link deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete resource link' })
    }
  }

  async bulkSave(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId  = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { links, existing_ids } = req.body
      if (!Array.isArray(links)) {
        res.status(400).json({ success: false, error: 'links array is required' })
        return
      }

      for (const link of links) {
        if (!link.title?.trim()) { res.status(400).json({ success: false, error: 'Each link must have a title' }); return }
        if (!link.url?.trim())   { res.status(400).json({ success: false, error: 'Each link must have a URL' });   return }
      }

      const results = await this.service.bulkSave(
        schoolId,
        profileId,
        links.map((l: any, i: number) => ({
          id:                      l.id || undefined,
          title:                   l.title.trim(),
          url:                     l.url.trim(),
          visible_to:              Array.isArray(l.visible_to)              ? l.visible_to              : ['admin'],
          visible_to_grade_ids:    Array.isArray(l.visible_to_grade_ids)    ? l.visible_to_grade_ids    : [],
          visible_to_section_ids:  Array.isArray(l.visible_to_section_ids)  ? l.visible_to_section_ids  : [],
          visible_to_teacher_ids:  Array.isArray(l.visible_to_teacher_ids)  ? l.visible_to_teacher_ids  : [],
          visible_to_student_ids:  Array.isArray(l.visible_to_student_ids)  ? l.visible_to_student_ids  : [],
          sort_order:              l.sort_order ?? i + 1,
          category_id:             l.category_id ?? null,
        })),
        Array.isArray(existing_ids) ? existing_ids : []
      )

      res.json({ success: true, data: results })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to save resource links' })
    }
  }
}
