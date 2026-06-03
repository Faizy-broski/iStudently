import { Request, Response } from 'express'
import { DashboardsService } from '../services/dashboards.service'

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

export class DashboardsController {
  private service: DashboardsService

  constructor() {
    this.service = new DashboardsService()
  }

  // ---- Dashboards CRUD ----

  /**
   * GET /api/resource-dashboards
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined
      const dashboards = await this.service.getDashboards(schoolId, campusId)

      res.json({ success: true, data: dashboards })
    } catch (error: any) {
      console.error('Error listing dashboards:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list dashboards' })
    }
  }

  /**
   * GET /api/resource-dashboards/:id
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const dashboard = await this.service.getDashboardById(req.params.id, schoolId)
      if (!dashboard) {
        res.status(404).json({ success: false, error: 'Dashboard not found' })
        return
      }

      res.json({ success: true, data: dashboard })
    } catch (error: any) {
      console.error('Error fetching dashboard:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch dashboard' })
    }
  }

  /**
   * POST /api/resource-dashboards
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { title, description, campus_id } = req.body
      if (!title || typeof title !== 'string' || !title.trim()) {
        res.status(400).json({ success: false, error: 'Title is required' })
        return
      }

      const dashboard = await this.service.createDashboard(schoolId, profileId, {
        title: title.trim(),
        description,
        campus_id,
      })

      res.status(201).json({ success: true, data: dashboard })
    } catch (error: any) {
      console.error('Error creating dashboard:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to create dashboard' })
    }
  }

  /**
   * PUT /api/resource-dashboards/:id
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const dashboard = await this.service.updateDashboard(req.params.id, schoolId, req.body)

      res.json({ success: true, data: dashboard })
    } catch (error: any) {
      console.error('Error updating dashboard:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update dashboard' })
    }
  }

  /**
   * DELETE /api/resource-dashboards/:id
   */
  async remove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      await this.service.deleteDashboard(req.params.id, schoolId)

      res.json({ success: true, message: 'Dashboard deleted' })
    } catch (error: any) {
      console.error('Error deleting dashboard:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete dashboard' })
    }
  }

  // ---- Dashboard Elements ----

  /**
   * GET /api/resource-dashboards/:id/elements
   */
  async listElements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const elements = await this.service.getElements(req.params.id)
      res.json({ success: true, data: elements })
    } catch (error: any) {
      console.error('Error listing elements:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list elements' })
    }
  }

  /**
   * POST /api/resource-dashboards/:id/elements
   */
  async addElement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { url, title, width_percent, height_px, sort_order, refresh_minutes, custom_css } = req.body
      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'URL is required' })
        return
      }

      const element = await this.service.createElement(req.params.id, {
        url,
        title,
        width_percent,
        height_px,
        sort_order,
        refresh_minutes,
        custom_css,
      })

      res.status(201).json({ success: true, data: element })
    } catch (error: any) {
      console.error('Error adding element:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to add element' })
    }
  }

  /**
   * PUT /api/resource-dashboards/:id/elements/:elementId
   */
  async updateElement(req: AuthRequest, res: Response): Promise<void> {
    try {
      const element = await this.service.updateElement(
        req.params.elementId,
        req.params.id,
        req.body
      )

      res.json({ success: true, data: element })
    } catch (error: any) {
      console.error('Error updating element:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update element' })
    }
  }

  /**
   * DELETE /api/resource-dashboards/:id/elements/:elementId
   */
  async removeElement(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.service.deleteElement(req.params.elementId, req.params.id)
      res.json({ success: true, message: 'Element deleted' })
    } catch (error: any) {
      console.error('Error deleting element:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete element' })
    }
  }

  /**
   * PUT /api/resource-dashboards/:id/elements/reorder
   */
  async reorderElements(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { elements } = req.body
      if (!Array.isArray(elements)) {
        res.status(400).json({ success: false, error: 'Elements array is required' })
        return
      }

      await this.service.bulkUpdateElements(req.params.id, elements)
      res.json({ success: true, message: 'Elements reordered' })
    } catch (error: any) {
      console.error('Error reordering elements:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to reorder elements' })
    }
  }
}
