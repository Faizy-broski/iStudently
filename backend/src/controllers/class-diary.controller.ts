import { Request, Response } from 'express'
import { ClassDiaryService } from '../services/class-diary.service'

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

export class ClassDiaryController {
  private diaryService: ClassDiaryService

  constructor() {
    this.diaryService = new ClassDiaryService()
  }

  /**
   * GET /api/class-diary
   */
  async getDiaryEntries(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const filters = {
        diary_date: req.query.diary_date as string,
        section_id: req.query.section_id as string,
        subject_id: req.query.subject_id as string,
        teacher_id: req.query.teacher_id as string,
        campus_id: req.query.campus_id as string,
        day_of_week: req.query.day_of_week ? parseInt(req.query.day_of_week as string) : undefined,
      }

      const result = await this.diaryService.getDiaryEntries(schoolId, filters, page, limit)

      res.json({
        success: true,
        data: result.entries,
        pagination: result.pagination,
      })
    } catch (error: any) {
      console.error('Error fetching diary entries:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch diary entries' })
    }
  }

  /**
   * GET /api/class-diary/read
   */
  async getDiaryReadView(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const diaryDate = req.query.diary_date as string
      if (!diaryDate) {
        res.status(400).json({ success: false, error: 'diary_date is required' })
        return
      }

      const sectionId = req.query.section_id as string
      const teacherId = req.query.teacher_id as string
      const campusId = req.query.campus_id as string

      const entries = await this.diaryService.getDiaryReadView(
        schoolId, diaryDate, sectionId, teacherId, campusId
      )

      res.json({ success: true, data: entries })
    } catch (error: any) {
      console.error('Error fetching diary read view:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch diary read view' })
    }
  }

  /**
   * GET /api/class-diary/:id
   */
  async getDiaryEntryById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const entry = await this.diaryService.getDiaryEntryById(req.params.id)
      res.json({ success: true, data: entry })
    } catch (error: any) {
      console.error('Error fetching diary entry:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch diary entry' })
    }
  }

  /**
   * POST /api/class-diary
   */
  async createDiaryEntry(req: AuthRequest, res: Response): Promise<void> {
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

      const { content, section_id, teacher_id, subject_id, diary_date, day_of_week, timetable_entry_id, entry_time, enable_comments } = req.body

      if (!content || !section_id || !teacher_id || !diary_date) {
        res.status(400).json({
          success: false,
          error: 'content, section_id, teacher_id, and diary_date are required',
        })
        return
      }

      const campusId = req.body.campus_id || req.query.campus_id as string

      const entry = await this.diaryService.createDiaryEntry(schoolId, campusId, userId, {
        content,
        section_id,
        teacher_id,
        subject_id,
        diary_date,
        day_of_week,
        timetable_entry_id,
        entry_time,
        enable_comments,
      })

      res.status(201).json({ success: true, data: entry })
    } catch (error: any) {
      console.error('Error creating diary entry:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to create diary entry' })
    }
  }

  /**
   * PUT /api/class-diary/:id
   */
  async updateDiaryEntry(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { content, enable_comments, is_published } = req.body

      const entry = await this.diaryService.updateDiaryEntry(req.params.id, {
        content,
        enable_comments,
        is_published,
      })

      res.json({ success: true, data: entry })
    } catch (error: any) {
      console.error('Error updating diary entry:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update diary entry' })
    }
  }

  /**
   * DELETE /api/class-diary/:id
   */
  async deleteDiaryEntry(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.diaryService.deleteDiaryEntry(req.params.id)
      res.json({ success: true, message: 'Diary entry deleted' })
    } catch (error: any) {
      console.error('Error deleting diary entry:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete diary entry' })
    }
  }

  /**
   * POST /api/class-diary/:id/files
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

      const file = await this.diaryService.addFile(req.params.id, userId, {
        file_name, file_url, file_type, file_size,
      })

      res.status(201).json({ success: true, data: file })
    } catch (error: any) {
      console.error('Error adding file:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to add file' })
    }
  }

  /**
   * DELETE /api/class-diary/files/:fileId
   */
  async removeFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.diaryService.removeFile(req.params.fileId)
      res.json({ success: true, message: 'File removed' })
    } catch (error: any) {
      console.error('Error removing file:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to remove file' })
    }
  }

  /**
   * POST /api/class-diary/:id/comments
   */
  async addComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const authorId = req.profile?.id
      if (!authorId) {
        res.status(403).json({ success: false, error: 'User profile not found' })
        return
      }

      const { content } = req.body
      if (!content) {
        res.status(400).json({ success: false, error: 'content is required' })
        return
      }

      const comment = await this.diaryService.addComment(req.params.id, authorId, content)
      res.status(201).json({ success: true, data: comment })
    } catch (error: any) {
      console.error('Error adding comment:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to add comment' })
    }
  }

  /**
   * DELETE /api/class-diary/comments/:commentId
   */
  async deleteComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.diaryService.deleteComment(req.params.commentId)
      res.json({ success: true, message: 'Comment deleted' })
    } catch (error: any) {
      console.error('Error deleting comment:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete comment' })
    }
  }

  /**
   * PATCH /api/class-diary/:id/toggle-comments
   */
  async toggleComments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { enable } = req.body
      if (enable === undefined) {
        res.status(400).json({ success: false, error: 'enable (boolean) is required' })
        return
      }

      const entry = await this.diaryService.toggleComments(req.params.id, enable)
      res.json({ success: true, data: entry })
    } catch (error: any) {
      console.error('Error toggling comments:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to toggle comments' })
    }
  }
}
