import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { readingLogsService } from '../services/reading-logs.service'

function effectiveSchoolId(req: AuthRequest): string | null {
  const p = req.profile
  if (!p) return null
  return p.campus_id || p.school_id || null
}

export class ReadingLogsController {
  // POST /api/reading-logs — student submits a new log
  async create(req: AuthRequest, res: Response) {
    try {
      const profile = req.profile
      if (!profile) return res.status(401).json({ success: false, error: 'Unauthorized' })

      const schoolId = effectiveSchoolId(req)
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

      const {
        book_id, book_title, book_author,
        session_date, pages_read, notes, audio_file_path,
      } = req.body

      if (!book_title?.trim()) {
        return res.status(400).json({ success: false, error: 'book_title is required' })
      }

      const log = await readingLogsService.create({
        student_id: profile.id,
        school_id: schoolId,
        book_id: book_id || null,
        book_title: book_title.trim(),
        book_author: book_author?.trim() || null,
        session_date: session_date || null,
        pages_read: pages_read ? Number(pages_read) : null,
        notes: notes?.trim() || null,
        audio_file_path: audio_file_path || null,
      })

      res.status(201).json({ success: true, data: log })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // PATCH /api/reading-logs/:id/audio — attach audio path after upload
  async setAudio(req: AuthRequest, res: Response) {
    try {
      const profile = req.profile
      if (!profile) return res.status(401).json({ success: false, error: 'Unauthorized' })

      const { id } = req.params
      const { audio_file_path } = req.body

      if (!audio_file_path) {
        return res.status(400).json({ success: false, error: 'audio_file_path is required' })
      }

      await readingLogsService.setAudioPath(id, profile.id, audio_file_path)
      res.json({ success: true })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // GET /api/reading-logs/my — student's own logs
  async getMine(req: AuthRequest, res: Response) {
    try {
      const profile = req.profile
      if (!profile) return res.status(401).json({ success: false, error: 'Unauthorized' })

      const schoolId = effectiveSchoolId(req)
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

      const logs = await readingLogsService.getStudentLogs(profile.id, schoolId)
      res.json({ success: true, data: logs })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  // GET /api/reading-logs — teacher/admin views all logs for the school
  async getSchoolLogs(req: AuthRequest, res: Response) {
    try {
      const schoolId = effectiveSchoolId(req)
      if (!schoolId) return res.status(400).json({ success: false, error: 'School ID required' })

      const studentId = req.query.student_id as string | undefined
      const logs = await readingLogsService.getSchoolLogs(schoolId, studentId)
      res.json({ success: true, data: logs })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

export const readingLogsController = new ReadingLogsController()
