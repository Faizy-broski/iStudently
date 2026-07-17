import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as requirementsService from '../services/timetable-requirements.service'
import {
  createTimetableRequirementSchema,
  updateTimetableRequirementSchema,
  bulkCreateTimetableRequirementsSchema,
  seedRequirementsFromAssignmentsSchema
} from '../schemas/timetable-generator.schemas'

// ============================================================================
// TIMETABLE REQUIREMENTS CONTROLLER
// Thin handlers over timetable-requirements.service.ts. Validates req.body
// with Zod, matching the safeParse-free `.parse()` + catch(ZodError) 400
// pattern used in hostel.controller.ts.
// ============================================================================

export const listRequirements = async (req: Request, res: Response) => {
  try {
    const { academic_year_id, section_id } = req.query

    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const result = await requirementsService.listRequirements(
      academic_year_id as string,
      section_id as string | undefined
    )

    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error listing timetable requirements:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createRequirement = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const dto = createTimetableRequirementSchema.parse({
      ...req.body,
      school_id: req.body.school_id || schoolId,
      campus_id: req.body.campus_id || campusId,
      created_by: req.body.created_by || userId
    })

    const result = await requirementsService.createRequirement(dto)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating timetable requirement:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const bulkCreateRequirements = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const campusId = (req as AuthRequest).profile?.campus_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const { requirements } = bulkCreateTimetableRequirementsSchema.parse({
      requirements: (req.body.requirements || []).map((r: any) => ({
        ...r,
        school_id: r.school_id || schoolId,
        campus_id: r.campus_id || campusId,
        created_by: r.created_by || userId
      }))
    })

    const result = await requirementsService.bulkCreateRequirements(requirements)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error bulk creating timetable requirements:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const updateRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto = updateTimetableRequirementSchema.parse(req.body)

    const result = await requirementsService.updateRequirement(id, dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error updating timetable requirement:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const deleteRequirement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await requirementsService.deleteRequirement(id)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error deleting timetable requirement:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const seedFromAssignments = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID is required' })
    }

    const dto = seedRequirementsFromAssignmentsSchema.parse({
      ...req.body,
      school_id: req.body.school_id || schoolId,
      created_by: req.body.created_by || userId
    })

    const result = await requirementsService.seedRequirementsFromAssignments(
      dto.school_id,
      dto.academic_year_id,
      dto.section_id,
      dto.created_by
    )

    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error seeding timetable requirements from assignments:', error)
    res.status(400).json({ success: false, error: error.message })
  }
}

export const getCoverage = async (req: Request, res: Response) => {
  try {
    const { section_id, academic_year_id } = req.query

    if (!section_id || !academic_year_id) {
      return res.status(400).json({ success: false, error: 'section_id and academic_year_id are required' })
    }

    const result = await requirementsService.getCoverageSummary(section_id as string, academic_year_id as string)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching requirement coverage:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
