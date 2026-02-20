import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as scheduleRequestsService from '../services/schedule-requests.service'
import type {
  CreateScheduleRequestDTO,
  UpdateScheduleRequestDTO,
  MassCreateRequestDTO,
  SchedulerOptions,
  SaveTemplateFromSectionDTO,
  CreateTemplateDTO,
  ApplyTemplateDTO,
} from '../types/scheduling.types'

// ============================================================================
// SCHEDULE REQUESTS CONTROLLER
// ============================================================================

// ── Requests CRUD ───────────────────────────────────────────────────────

export const getRequests = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const filters = {
      student_id: req.query.student_id as string | undefined,
      course_id: req.query.course_id as string | undefined,
      status: req.query.status as string | undefined,
      campus_id: req.query.campus_id as string | undefined,
    }

    const result = await scheduleRequestsService.getRequests(schoolId, academicYearId, filters)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createRequest = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: CreateScheduleRequestDTO = req.body

    const result = await scheduleRequestsService.createRequest(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto: UpdateScheduleRequestDTO = req.body

    const result = await scheduleRequestsService.updateRequest(id, dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await scheduleRequestsService.deleteRequest(id)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const massCreateRequests = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: MassCreateRequestDTO = req.body

    const result = await scheduleRequestsService.massCreateRequests(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Auto-Scheduler ──────────────────────────────────────────────────────

export const runScheduler = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const options: SchedulerOptions = {
      school_id: schoolId,
      campus_id: req.body.campus_id,
      academic_year_id: req.body.academic_year_id,
      marking_period_id: req.body.marking_period_id,
      course_id: req.body.course_id,
      respect_teacher_availability: req.body.respect_teacher_availability ?? true,
      respect_room_capacity: req.body.respect_room_capacity ?? true,
      respect_gender_restrictions: req.body.respect_gender_restrictions ?? true,
      use_priority_ordering: req.body.use_priority_ordering ?? true,
    }

    if (!options.academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id required' })
    }

    const result = await scheduleRequestsService.runScheduler(options)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Templates ───────────────────────────────────────────────────────────

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const campusId = req.query.campus_id as string | undefined
    const result = await scheduleRequestsService.getTemplates(schoolId, campusId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: CreateTemplateDTO = req.body

    const result = await scheduleRequestsService.createTemplate(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const saveTemplateFromSection = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: SaveTemplateFromSectionDTO = req.body

    const result = await scheduleRequestsService.saveTemplateFromSection(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const applyTemplate = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const dto: ApplyTemplateDTO = req.body

    const result = await scheduleRequestsService.applyTemplate(schoolId, dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await scheduleRequestsService.deleteTemplate(id)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
