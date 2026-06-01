import { Request, Response } from 'express'
import { ResourceLinksService } from '../services/resource-links.service'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  profile?: {
    id: string
    school_id?: string
    role?: string
    is_active?: boolean
  }
}

export class ResourceLinksController {
  private service: ResourceLinksService

  constructor() {
    this.service = new ResourceLinksService()
  }

  /**
   * GET /api/resource-links
   * List all resource links (admin sees all, others see only visible_to their role)
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const role = req.profile?.role
      if (!schoolId || !role) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined

      let links
      if (role === 'admin' || role === 'super_admin') {
        // Admin sees all links (for management)
        links = await this.service.getResourceLinks(schoolId, campusId)
      } else {
        // Other roles see only links visible to them
        links = await this.service.getVisibleResourceLinks(schoolId, role, campusId)
      }

      res.json({ success: true, data: links })
    } catch (error: any) {
      console.error('Error listing resource links:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list resource links' })
    }
  }

  /**
   * GET /api/resource-links/:id
   */
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
      console.error('Error fetching resource link:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch resource link' })
    }
  }

  /**
   * POST /api/resource-links
   * Create a single resource link (admin only)
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { title, url, visible_to, campus_id, sort_order } = req.body
      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ success: false, error: 'Title is required' })
        return
      }
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({ success: false, error: 'URL is required' })
        return
      }

      const link = await this.service.createResourceLink(schoolId, profileId, {
        title: title.trim(),
        url: url.trim(),
        visible_to: Array.isArray(visible_to) ? visible_to : ['admin'],
        campus_id,
        sort_order,
      })

      res.status(201).json({ success: true, data: link })
    } catch (error: any) {
      console.error('Error creating resource link:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to create resource link' })
    }
  }

  /**
   * PUT /api/resource-links/:id
   * Update a resource link (admin only)
   */
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
      console.error('Error updating resource link:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update resource link' })
    }
  }

  /**
   * DELETE /api/resource-links/:id
   * Delete a resource link (admin only)
   */
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
      console.error('Error deleting resource link:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete resource link' })
    }
  }

  /**
   * PUT /api/resource-links/bulk-save
   * Bulk save all resource links (create/update/delete in one call)
   * Matches RosarioSIS "Save" button behavior
   */
  async bulkSave(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
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

      // Validate each link
      for (const link of links) {
        if (!link.title || typeof link.title !== 'string' || !link.title.trim()) {
          res.status(400).json({ success: false, error: 'Each link must have a title' })
          return
        }
        if (!link.url || typeof link.url !== 'string' || !link.url.trim()) {
          res.status(400).json({ success: false, error: 'Each link must have a URL' })
          return
        }
      }

      const results = await this.service.bulkSave(
        schoolId,
        profileId,
        links.map((l: any) => ({
          id: l.id || undefined,
          title: l.title.trim(),
          url: l.url.trim(),
          visible_to: Array.isArray(l.visible_to) ? l.visible_to : ['admin'],
          sort_order: l.sort_order,
        })),
        Array.isArray(existing_ids) ? existing_ids : []
      )

      res.json({ success: true, data: results })
    } catch (error: any) {
      console.error('Error bulk saving resource links:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to save resource links' })
    }
  }
}
