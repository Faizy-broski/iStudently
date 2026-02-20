import { Request, Response } from 'express'
import { DiaryReminderService } from '../services/diary-reminder.service'

interface AuthRequest extends Request {
  user?: {
    id: string
    email?: string
  }
  profile?: {
    id: string
    school_id?: string
    role?: string
    is_active?: boolean
    email?: string
  }
}

export class SchoolSettingsController {
  private reminderService: DiaryReminderService

  constructor() {
    this.reminderService = new DiaryReminderService()
  }

  /**
   * GET /api/school-settings
   * Get school settings for the current user's school
   */
  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const settings = await this.reminderService.getSettings(schoolId)

      res.json({
        success: true,
        data: settings || {
          school_id: schoolId,
          diary_reminder_enabled: false,
          diary_reminder_time: '07:00',
          diary_reminder_days: [1, 2, 3, 4, 5],
        },
      })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/school-settings
   * Update school settings
   */
  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { diary_reminder_enabled, diary_reminder_time, diary_reminder_days } = req.body

      // Validate time format
      if (diary_reminder_time && !/^\d{2}:\d{2}$/.test(diary_reminder_time)) {
        res.status(400).json({ success: false, error: 'Invalid time format. Use HH:MM (24h)' })
        return
      }

      // Validate days array
      if (diary_reminder_days) {
        if (!Array.isArray(diary_reminder_days) || diary_reminder_days.some((d: number) => d < 0 || d > 6)) {
          res.status(400).json({ success: false, error: 'Invalid days. Must be array of 0-6 (Mon=0, Sun=6)' })
          return
        }
      }

      const settings = await this.reminderService.updateSettings(schoolId, {
        diary_reminder_enabled,
        diary_reminder_time,
        diary_reminder_days,
      })

      res.json({ success: true, data: settings })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/test-diary-reminder
   * Send a test diary reminder email to the current admin's email
   */
  async sendTestReminder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const toEmail = req.body.email || req.profile?.email || req.user?.email
      if (!toEmail) {
        res.status(400).json({ success: false, error: 'No email address available. Please provide one.' })
        return
      }

      const result = await this.reminderService.sendTestReminder(schoolId, toEmail)
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/school-settings/trigger-diary-reminders
   * Manually trigger diary reminders (for testing/debugging)
   */
  async triggerReminders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await this.reminderService.sendDiaryReminders()
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}
