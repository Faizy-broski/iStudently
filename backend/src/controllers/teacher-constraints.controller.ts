import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as constraintsService from '../services/teacher-constraints.service'
import * as settingsService from '../services/timetable-generation-settings.service'
import {
  upsertTeacherSchedulingConstraintSchema,
  updateTimetableGenerationSettingsSchema
} from '../schemas/timetable-generator.schemas'

// ============================================================================
// TEACHER SCHEDULING CONSTRAINTS + GENERATION SETTINGS CONTROLLER
// Grouped in one file (matching scheduling.controller.ts's precedent of
// bundling several small related concerns rather than one file per concept —
// both concerns here are small per-year config CRUD consumed by the solver).
// ============================================================================

// ── Teacher scheduling constraints ─────────────────────────────────────────

export const listTeacherConstraints = async (req: Request, res: Response) => {
  try {
    const { academic_year_id } = req.query
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const result = await constraintsService.listTeacherConstraints(academic_year_id as string)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error listing teacher constraints:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getTeacherConstraints = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params
    const { academic_year_id } = req.query
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const result = await constraintsService.getTeacherConstraints(teacherId, academic_year_id as string)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher constraints:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const upsertTeacherConstraints = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const dto = upsertTeacherSchedulingConstraintSchema.parse({
      ...req.body,
      teacher_id: req.body.teacher_id || req.params.teacherId,
      school_id: req.body.school_id || schoolId,
      campus_id: req.body.campus_id || campusId
    })

    const result = await constraintsService.upsertTeacherConstraints(dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error upserting teacher constraints:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

// ── Generation settings ─────────────────────────────────────────────────────

export const getGenerationSettings = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id
    const { academic_year_id } = req.query

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const result = await settingsService.getSettings(schoolId, campusId, academic_year_id as string)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching generation settings:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateGenerationSettings = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const dto = updateTimetableGenerationSettingsSchema.parse({
      ...req.body,
      school_id: req.body.school_id || schoolId,
      campus_id: req.body.campus_id || campusId
    })

    const result = await settingsService.upsertSettings(dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error updating generation settings:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}
