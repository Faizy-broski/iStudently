import { Request, Response } from 'express'
import { EventService } from '../services/event.service'
import { CreateEventDTO, UpdateEventDTO, EventFilters } from '../types'

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

export class EventController {
  private eventService: EventService

  constructor() {
    this.eventService = new EventService()
  }

  /**
   * GET /api/events
   * Get all events with optional filters
   */
  async getEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 50

      const filters: EventFilters = {
        category: req.query.category as any,
        start_date: req.query.start_date as string,
        end_date: req.query.end_date as string,
        user_role: req.query.user_role as any,
        grade_level: req.query.grade_level as string
      }

      const result = await this.eventService.getEvents(schoolId, filters, page, limit)

      res.json({
        success: true,
        data: result.events,
        pagination: result.pagination
      })
    } catch (error: any) {
      console.error('Error fetching events:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch events'
      })
    }
  }

  /**
   * GET /api/events/range
   * Get events for a specific date range (for calendar)
   */
  async getEventsForRange(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const { start_date, end_date, category, user_role } = req.query

      if (!start_date || !end_date) {
        res.status(400).json({
          success: false,
          error: 'start_date and end_date are required'
        })
        return
      }

      const events = await this.eventService.getEventsForRange(
        schoolId,
        start_date as string,
        end_date as string,
        category as any,
        user_role as any
      )

      res.json({
        success: true,
        data: events
      })
    } catch (error: any) {
      console.error('Error fetching events for range:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch events for date range'
      })
    }
  }

  /**
   * GET /api/events/upcoming
   * Get upcoming events (next 30 days)
   */
  async getUpcomingEvents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const limit = parseInt(req.query.limit as string) || 10
      const userRole = req.query.user_role as any

      const events = await this.eventService.getUpcomingEvents(schoolId, userRole, limit)

      res.json({
        success: true,
        data: events
      })
    } catch (error: any) {
      console.error('Error fetching upcoming events:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch upcoming events'
      })
    }
  }

  /**
   * GET /api/events/categories/counts
   * Get event counts by category
   */
  async getCategoryCounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const counts = await this.eventService.getEventCategoryCounts(schoolId)

      res.json({
        success: true,
        data: counts
      })
    } catch (error: any) {
      console.error('Error fetching category counts:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch category counts'
      })
    }
  }

  /**
   * GET /api/events/:id
   * Get a single event by ID
   */
  async getEventById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const { id } = req.params

      const event = await this.eventService.getEventById(id, schoolId)

      if (!event) {
        res.status(404).json({
          success: false,
          error: 'Event not found'
        })
        return
      }

      res.json({
        success: true,
        data: event
      })
    } catch (error: any) {
      console.error('Error fetching event:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch event'
      })
    }
  }

  /**
   * POST /api/events
   * Create a new event
   */
  async createEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const userId = req.user?.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const eventData: CreateEventDTO = {
        ...req.body,
        school_id: schoolId,
        created_by: userId
      }

      const event = await this.eventService.createEvent(eventData)

      res.status(201).json({
        success: true,
        data: event,
        message: 'Event created successfully'
      })
    } catch (error: any) {
      console.error('Error creating event:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create event'
      })
    }
  }

  /**
   * PUT /api/events/:id
   * Update an event
   */
  async updateEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const { id } = req.params
      const updates: UpdateEventDTO = req.body

      const event = await this.eventService.updateEvent(id, schoolId, updates)

      res.json({
        success: true,
        data: event,
        message: 'Event updated successfully'
      })
    } catch (error: any) {
      console.error('Error updating event:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update event'
      })
    }
  }

  /**
   * DELETE /api/events/:id
   * Delete an event
   */
  async deleteEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const { id } = req.params

      await this.eventService.deleteEvent(id, schoolId)

      res.json({
        success: true,
        message: 'Event deleted successfully'
      })
    } catch (error: any) {
      console.error('Error deleting event:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete event'
      })
    }
  }

  /**
   * PATCH /api/events/hijri-offset
   * Update Hijri offset for a category
   */
  async updateHijriOffset(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const { category, offset } = req.body

      if (!category || offset === undefined) {
        res.status(400).json({
          success: false,
          error: 'category and offset are required'
        })
        return
      }

      const updatedCount = await this.eventService.updateHijriOffset(
        schoolId,
        category,
        offset
      )

      res.json({
        success: true,
        data: { updated_count: updatedCount },
        message: `Hijri offset updated for ${updatedCount} ${category} events`
      })
    } catch (error: any) {
      console.error('Error updating Hijri offset:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update Hijri offset'
      })
    }
  }
}
