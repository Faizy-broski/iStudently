import { Request, Response } from 'express'
import { AttendanceCalendarsService } from '../services/attendance-calendars.service'

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

export class AttendanceCalendarsController {
  private service: AttendanceCalendarsService

  constructor() {
    this.service = new AttendanceCalendarsService()
  }

  /**
   * GET /api/attendance-calendars
   * List all named calendars for the school
   */
  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const campusId = req.query.campus_id as string | undefined
      const calendars = await this.service.getCalendars(schoolId, campusId)
      res.json({ success: true, data: calendars })
    } catch (error: any) {
      console.error('Error listing calendars:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/attendance-calendars/:id
   * Get a single calendar by ID
   */
  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const calendar = await this.service.getCalendarById(req.params.id)
      if (!calendar) {
        res.status(404).json({ success: false, error: 'Calendar not found' })
        return
      }
      res.json({ success: true, data: calendar })
    } catch (error: any) {
      console.error('Error getting calendar:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/attendance-calendars
   * Create a new named calendar
   */
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { title, calendar_type, start_date, end_date, weekdays, default_minutes, is_default, campus_id, academic_year_id, copy_from_calendar_id } = req.body

      if (!title || !start_date || !end_date) {
        res.status(400).json({ success: false, error: 'Title, start date, and end date are required' })
        return
      }

      const calendar = await this.service.createCalendar({
        school_id: schoolId,
        campus_id: campus_id || null,
        title,
        calendar_type: calendar_type || 'gregorian',
        start_date,
        end_date,
        weekdays,
        default_minutes,
        is_default: is_default || false,
        academic_year_id: academic_year_id || null,
        created_by: profileId || null,
        copy_from_calendar_id: copy_from_calendar_id || null,
      })

      res.status(201).json({ success: true, data: calendar })
    } catch (error: any) {
      console.error('Error creating calendar:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/attendance-calendars/:id
   * Update a named calendar
   */
  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const calendar = await this.service.updateCalendar(req.params.id, req.body)
      res.json({ success: true, data: calendar })
    } catch (error: any) {
      console.error('Error updating calendar:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * DELETE /api/attendance-calendars/:id
   * Delete a named calendar
   */
  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      await this.service.deleteCalendar(req.params.id)
      res.json({ success: true, data: { deleted: true } })
    } catch (error: any) {
      console.error('Error deleting calendar:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/attendance-calendars/:id/days
   * Get all days for a calendar (with optional date range)
   */
  async getDays(req: AuthRequest, res: Response): Promise<void> {
    try {
      const calendarId = req.params.id
      const startDate = req.query.start_date as string | undefined
      const endDate = req.query.end_date as string | undefined

      let days
      if (startDate && endDate) {
        days = await this.service.getCalendarDays(calendarId, startDate, endDate)
      } else {
        days = await this.service.getAllCalendarDays(calendarId)
      }

      res.json({ success: true, data: days })
    } catch (error: any) {
      console.error('Error getting calendar days:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/attendance-calendars/:id/days/:dayId/toggle
   * Toggle a day's school day status
   */
  async toggleDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { dayId } = req.params
      const { is_school_day, minutes } = req.body

      const day = await this.service.toggleCalendarDay(dayId, is_school_day, minutes)
      res.json({ success: true, data: day })
    } catch (error: any) {
      console.error('Error toggling calendar day:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * PUT /api/attendance-calendars/:id/days/:dayId
   * Update a calendar day
   */
  async updateDay(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { dayId } = req.params
      const day = await this.service.updateCalendarDay(dayId, req.body)
      res.json({ success: true, data: day })
    } catch (error: any) {
      console.error('Error updating calendar day:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * POST /api/attendance-calendars/:id/regenerate
   * Regenerate all days for a calendar
   */
  async regenerate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const count = await this.service.regenerateCalendarDays(req.params.id)
      res.json({ success: true, data: { days_created: count } })
    } catch (error: any) {
      console.error('Error regenerating calendar:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * GET /api/attendance-calendars/:id/summary
   * Get summary stats for a calendar
   */
  async getSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const summary = await this.service.getCalendarDaySummary(req.params.id)
      res.json({ success: true, data: summary })
    } catch (error: any) {
      console.error('Error getting calendar summary:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }
}
