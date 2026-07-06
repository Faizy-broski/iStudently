import { Request, Response } from 'express'
import { ResourceLinkCategoriesService } from '../services/resource-link-categories.service'

export interface AuthRequest extends Request {
  user?: { id: string; email?: string }
  profile?: {
    id: string
    school_id?: string
    role?: string
    is_active?: boolean
    campus_id?: string
  }
}

export class ResourceLinkCategoriesController {
  private service: ResourceLinkCategoriesService

  constructor() {
    this.service = new ResourceLinkCategoriesService()
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined
      const categories = await this.service.getCategories(schoolId, campusId)

      res.json({ success: true, data: categories })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list resource link categories' })
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

      const { name, campus_id, sort_order } = req.body
      if (!name?.trim()) { res.status(400).json({ success: false, error: 'Name is required' }); return }

      const category = await this.service.createCategory(schoolId, profileId, {
        name: name.trim(),
        campus_id,
        sort_order,
      })

      res.status(201).json({ success: true, data: category })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create resource link category' })
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const category = await this.service.updateCategory(req.params.id, schoolId, req.body)
      res.json({ success: true, data: category })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update resource link category' })
    }
  }

  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await this.service.deleteCategory(req.params.id, schoolId)
      res.json({ success: true, message: 'Resource link category deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete resource link category' })
    }
  }
}
