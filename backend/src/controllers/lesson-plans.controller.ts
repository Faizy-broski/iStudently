import { Request, Response } from 'express'
import { LessonPlansService } from '../services/lesson-plans.service'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  profile?: {
    id: string
    school_id?: string
    campus_id?: string
    role?: string
    is_active?: boolean
  }
}

export class LessonPlansController {
  private service: LessonPlansService

  constructor() {
    this.service = new LessonPlansService()
  }

  /**
   * GET /api/lesson-plans
   */
  async getLessons(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const filters = {
        course_period_id: req.query.course_period_id as string,
        teacher_id: req.query.teacher_id as string,
        campus_id: req.query.campus_id as string,
        academic_year_id: req.query.academic_year_id as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        on_date: req.query.on_date as string,
      }

      const result = await this.service.getLessons(schoolId, filters, page, limit)

      res.json({
        success: true,
        data: result.lessons,
        pagination: result.pagination,
      })
    } catch (error: any) {
      console.error('Error fetching lesson plans:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch lesson plans' })
    }
  }

  /**
   * GET /api/lesson-plans/summary
   */
  async getLessonPlanSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const filters = {
        teacher_id: req.query.teacher_id as string,
        campus_id: req.query.campus_id as string,
        academic_year_id: req.query.academic_year_id as string,
      }

      const summary = await this.service.getLessonPlanSummary(schoolId, filters)

      res.json({ success: true, data: summary })
    } catch (error: any) {
      console.error('Error fetching lesson plan summary:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch lesson plan summary' })
    }
  }

  /**
   * GET /api/lesson-plans/:id
   */
  async getLessonById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const lesson = await this.service.getLessonById(req.params.id)
      res.json({ success: true, data: lesson })
    } catch (error: any) {
      console.error('Error fetching lesson plan:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch lesson plan' })
    }
  }

  /**
   * POST /api/lesson-plans
   */
  async createLesson(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const userId = req.profile?.id
      if (!userId) {
        res.status(403).json({ success: false, error: 'User profile not found' })
        return
      }

      const {
        course_period_id,
        teacher_id,
        academic_year_id,
        title,
        on_date,
        lesson_number,
        length_minutes,
        learning_objectives,
        evaluation,
        inclusiveness,
        items,
      } = req.body

      if (!course_period_id || !teacher_id || !academic_year_id || !title || !on_date) {
        res.status(400).json({
          success: false,
          error: 'course_period_id, teacher_id, academic_year_id, title, and on_date are required',
        })
        return
      }

      const campusId = req.body.campus_id || req.profile?.campus_id

      const lesson = await this.service.createLesson(schoolId, campusId, userId, {
        course_period_id,
        teacher_id,
        academic_year_id,
        title,
        on_date,
        lesson_number,
        length_minutes,
        learning_objectives,
        evaluation,
        inclusiveness,
        items,
      })

      res.status(201).json({ success: true, data: lesson })
    } catch (error: any) {
      console.error('Error creating lesson plan:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to create lesson plan' })
    }
  }

  /**
   * PUT /api/lesson-plans/:id
   */
  async updateLesson(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        title,
        on_date,
        lesson_number,
        length_minutes,
        learning_objectives,
        evaluation,
        inclusiveness,
        is_published,
      } = req.body

      const lesson = await this.service.updateLesson(req.params.id, {
        title,
        on_date,
        lesson_number,
        length_minutes,
        learning_objectives,
        evaluation,
        inclusiveness,
        is_published,
      })

      res.json({ success: true, data: lesson })
    } catch (error: any) {
      console.error('Error updating lesson plan:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update lesson plan' })
    }
  }

  /**
   * DELETE /api/lesson-plans/:id
   */
  async deleteLesson(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.service.deleteLesson(req.params.id)
      res.json({ success: true, message: 'Lesson plan deleted' })
    } catch (error: any) {
      console.error('Error deleting lesson plan:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete lesson plan' })
    }
  }

  /**
   * PUT /api/lesson-plans/:id/items
   * Replace all items for a lesson
   */
  async replaceItems(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { items } = req.body

      if (!Array.isArray(items)) {
        res.status(400).json({ success: false, error: 'items must be an array' })
        return
      }

      const lesson = await this.service.replaceItems(req.params.id, items)
      res.json({ success: true, data: lesson })
    } catch (error: any) {
      console.error('Error replacing lesson plan items:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to replace lesson plan items' })
    }
  }

  /**
   * POST /api/lesson-plans/:id/files
   */
  async addFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.profile?.id
      if (!userId) {
        res.status(403).json({ success: false, error: 'User profile not found' })
        return
      }

      const { file_name, file_url, file_type, file_size } = req.body

      if (!file_name || !file_url) {
        res.status(400).json({ success: false, error: 'file_name and file_url are required' })
        return
      }

      const file = await this.service.addFile(req.params.id, userId, {
        file_name,
        file_url,
        file_type,
        file_size,
      })

      res.status(201).json({ success: true, data: file })
    } catch (error: any) {
      console.error('Error adding file:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to add file' })
    }
  }

  /**
   * DELETE /api/lesson-plans/files/:fileId
   */
  async removeFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.service.removeFile(req.params.fileId)
      res.json({ success: true, message: 'File removed' })
    } catch (error: any) {
      console.error('Error removing file:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to remove file' })
    }
  }
}
