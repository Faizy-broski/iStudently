import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as generationService from '../services/timetable-generation.service'
import { startGenerationSchema } from '../schemas/timetable-generator.schemas'

// ============================================================================
// TIMETABLE GENERATION CONTROLLER
// start/status/list/cancel/rollback for the FET-style CSP generator job
// lifecycle. Mirrors the error-handling shape used throughout
// timetable.controller.ts.
// ============================================================================

export const startGeneration = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const dto = startGenerationSchema.parse({
      ...req.body,
      school_id: req.body.school_id || schoolId,
      campus_id: req.body.campus_id || campusId,
      created_by: req.body.created_by || userId
    })

    const result = await generationService.startGeneration(dto)

    if (!result.success) {
      // Concurrency guard trip: service returns data.job_id of the
      // conflicting job so the client can offer to view/cancel it.
      const existingJobId = (result.data as any)?.job_id
      if (existingJobId) {
        return res.status(409).json({ success: false, error: result.error, existing_job_id: existingJobId })
      }
      return res.status(400).json(result)
    }

    res.status(202).json(result)
  } catch (error: any) {
    console.error('Error starting timetable generation:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const getJobStatus = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params
    const result = await generationService.getJobStatus(jobId)
    if (!result.success) return res.status(404).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching generation job status:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const listJobs = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const { academic_year_id, page, limit } = req.query

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const result = await generationService.listJobs(schoolId, academic_year_id as string, {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined
    })

    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error listing generation jobs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const cancelJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params
    const result = await generationService.cancelGeneration(jobId)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error cancelling generation job:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const rollbackJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params
    const userId = (req as AuthRequest).profile?.id
    const result = await generationService.rollbackGeneration(jobId, userId)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error rolling back generation job:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
