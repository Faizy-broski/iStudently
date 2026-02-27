import { Request, Response } from 'express'
import { SchoolInventoryService, CategoryType } from '../services/school-inventory.service'

export interface AuthRequest extends Request {
  user?: { id: string; email?: string }
  profile?: { id: string; school_id?: string; role?: string; is_active?: boolean }
}

export class SchoolInventoryController {
  private service: SchoolInventoryService

  constructor() {
    this.service = new SchoolInventoryService()
  }

  // ---- Categories ----

  async listCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const campusId = req.query.campus_id as string | undefined
      const type = req.query.type as CategoryType | undefined
      const data = await this.service.getCategories(schoolId, campusId, type)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list categories' })
    }
  }

  async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const { category_type, title, sort_order, color, campus_id } = req.body
      if (!category_type || !title?.trim()) {
        res.status(400).json({ success: false, error: 'category_type and title are required' })
        return
      }
      const data = await this.service.createCategory(schoolId, campus_id, {
        category_type,
        title: title.trim(),
        sort_order,
        color,
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create category' })
    }
  }

  async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const data = await this.service.updateCategory(req.params.id, schoolId, req.body)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update category' })
    }
  }

  async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await this.service.deleteCategory(req.params.id, schoolId)
      res.json({ success: true, message: 'Category deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete category' })
    }
  }

  async bulkSaveCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const { categories, existing_ids, campus_id } = req.body
      if (!Array.isArray(categories)) {
        res.status(400).json({ success: false, error: 'categories array is required' })
        return
      }
      for (const cat of categories) {
        if (!cat.title?.trim() || !cat.category_type) {
          res.status(400).json({ success: false, error: 'Each category must have title and category_type' })
          return
        }
      }
      const data = await this.service.bulkSaveCategories(
        schoolId,
        campus_id,
        categories.map((c: any) => ({ ...c, title: c.title.trim() })),
        Array.isArray(existing_ids) ? existing_ids : []
      )
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to save categories' })
    }
  }

  // ---- Items ----

  async listItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const campusId = req.query.campus_id as string | undefined
      const category_id = req.query.category_id as string | undefined
      const data = await this.service.getItems(schoolId, campusId, category_id ? { category_id } : undefined)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list items' })
    }
  }

  async getItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const data = await this.service.getItemById(req.params.id, schoolId)
      if (!data) {
        res.status(404).json({ success: false, error: 'Item not found' })
        return
      }
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get item' })
    }
  }

  async createItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const { title, quantity, comments, sort_order, category_ids, campus_id } = req.body
      if (!title?.trim()) {
        res.status(400).json({ success: false, error: 'title is required' })
        return
      }
      const data = await this.service.createItem(schoolId, campus_id, profileId, {
        title: title.trim(),
        quantity: quantity ?? 0,
        comments,
        sort_order,
        category_ids: Array.isArray(category_ids) ? category_ids : [],
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create item' })
    }
  }

  async updateItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const data = await this.service.updateItem(req.params.id, schoolId, req.body)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update item' })
    }
  }

  async deleteItem(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await this.service.deleteItem(req.params.id, schoolId)
      res.json({ success: true, message: 'Item deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete item' })
    }
  }

  async bulkSaveItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const { items, existing_ids, campus_id } = req.body
      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'items array is required' })
        return
      }
      for (const item of items) {
        if (!item.title?.trim()) {
          res.status(400).json({ success: false, error: 'Each item must have a title' })
          return
        }
      }
      const data = await this.service.bulkSaveItems(
        schoolId,
        campus_id,
        profileId,
        items.map((i: any) => ({ ...i, title: i.title.trim() })),
        Array.isArray(existing_ids) ? existing_ids : []
      )
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to save items' })
    }
  }

  // ---- Snapshots ----

  async listSnapshots(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const campusId = req.query.campus_id as string | undefined
      const data = await this.service.getSnapshots(schoolId, campusId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list snapshots' })
    }
  }

  async createSnapshot(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const { title, campus_id } = req.body
      if (!title?.trim()) {
        res.status(400).json({ success: false, error: 'title is required' })
        return
      }
      const data = await this.service.createSnapshot(schoolId, campus_id, profileId, title.trim())
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create snapshot' })
    }
  }

  async getSnapshot(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const data = await this.service.getSnapshotDetail(req.params.id, schoolId)
      if (!data) {
        res.status(404).json({ success: false, error: 'Snapshot not found' })
        return
      }
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get snapshot' })
    }
  }

  async deleteSnapshot(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await this.service.deleteSnapshot(req.params.id, schoolId)
      res.json({ success: true, message: 'Snapshot deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete snapshot' })
    }
  }
}
