import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { speedReadingService, WordResult } from '../services/speed-reading.service'

class SpeedReadingController {
  async getTexts(req: AuthRequest, res: Response) {
    try {
      const schoolId = (req.query.school_id as string) || req.profile?.school_id
      if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
      const gradeLevelId = req.query.grade_level_id as string | undefined
      const campusId = req.query.campus_id as string | undefined
      const data = await speedReadingService.getTexts(schoolId, gradeLevelId, campusId)
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getTexts error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getText(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const data = await speedReadingService.getText(id)
      if (!data) return res.status(404).json({ success: false, error: 'Text not found' })
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getText error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async createText(req: AuthRequest, res: Response) {
    try {
      const createdBy = req.profile?.id
      const { title, language, content, grade_level_id, quiz_questions, campus_id } = req.body
      const schoolId = campus_id || req.profile?.school_id
      if (!schoolId) return res.status(400).json({ success: false, error: 'school_id not found in token' })
      if (!title || !content) return res.status(400).json({ success: false, error: 'title and content are required' })
      const data = await speedReadingService.createText(schoolId, createdBy, { title, language: language || 'en', content, grade_level_id, quiz_questions })
      return res.status(201).json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading createText error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async updateText(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { title, language, content, grade_level_id, quiz_questions } = req.body
      const dto: Record<string, any> = { title, language, content, quiz_questions }
      if ('grade_level_id' in req.body) dto.grade_level_id = grade_level_id
      const data = await speedReadingService.updateText(id, dto)
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading updateText error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async deleteText(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      await speedReadingService.deleteText(id)
      return res.json({ success: true })
    } catch (error: any) {
      console.error('speed-reading deleteText error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async submitLog(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.profile?.id
      if (!schoolId || !studentId) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const { text_id, target_wpm, correct_words, incorrect_words, accuracy_percentage, comprehension_bonus, grading_mode, audio_url, word_results } = req.body
      if (!text_id || target_wpm == null) return res.status(400).json({ success: false, error: 'text_id and target_wpm are required' })
      const data = await speedReadingService.submitLog(schoolId, studentId, {
        text_id,
        target_wpm: Number(target_wpm),
        correct_words: Number(correct_words ?? 0),
        incorrect_words: Number(incorrect_words ?? 0),
        accuracy_percentage: Number(accuracy_percentage ?? 0),
        comprehension_bonus: Boolean(comprehension_bonus),
        grading_mode: grading_mode || 'voice',
        audio_url: audio_url || undefined,
        word_results: Array.isArray(word_results) ? word_results as WordResult[] : undefined,
      })
      return res.status(201).json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading submitLog error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getSessionLog(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const data = await speedReadingService.getSessionLog(req.params.id, schoolId)
      if (!data) return res.status(404).json({ success: false, error: 'Session not found' })
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getSessionLog error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async listSessionLogs(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const filters = {
        student_id: req.query.student_id as string | undefined,
        text_id: req.query.text_id as string | undefined,
        date_from: req.query.date_from as string | undefined,
        date_to: req.query.date_to as string | undefined,
      }
      const result = await speedReadingService.listSessionLogs(schoolId, filters, page, limit)
      return res.json({ success: true, ...result })
    } catch (error: any) {
      console.error('speed-reading listSessionLogs error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getStudentLogs(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.profile?.id
      if (!schoolId || !studentId) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const result = await speedReadingService.getStudentLogs(schoolId, studentId, page, limit)
      return res.json({ success: true, ...result })
    } catch (error: any) {
      console.error('speed-reading getStudentLogs error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getLeaderboard(req: AuthRequest, res: Response) {
    try {
      const schoolId = (req.query.school_id as string) || req.profile?.school_id
      if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
      const limit = Number(req.query.limit ?? 20)
      const data = await speedReadingService.getLeaderboard(schoolId, limit)
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getLeaderboard error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getMyStats(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.profile?.id
      if (!schoolId || !studentId) return res.status(401).json({ success: false, error: 'Unauthorized' })
      const data = await speedReadingService.getStudentStats(schoolId, studentId)
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getMyStats error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }

  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const schoolId = (req.query.school_id as string) || req.profile?.school_id
      if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
      const data = await speedReadingService.getDashboardStats(schoolId)
      return res.json({ success: true, data })
    } catch (error: any) {
      console.error('speed-reading getDashboardStats error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  }
}

export const speedReadingController = new SpeedReadingController()
