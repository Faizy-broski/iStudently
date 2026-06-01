import { Request, Response } from 'express'
import * as learningResourcesService from '../services/learning-resources.service'

// ============================================================================
// RESOURCE CONTROLLERS
// ============================================================================

export const getTeacherResources = async (req: Request, res: Response) => {
  try {
    const { teacher_id, section_id, subject_id, resource_type, is_published, search, page, limit } = req.query

    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        error: 'teacher_id is required'
      })
    }

    const filters: any = {}
    if (section_id) filters.section_id = section_id as string
    if (subject_id) filters.subject_id = subject_id as string
    if (resource_type) filters.resource_type = resource_type as string
    if (is_published !== undefined) filters.is_published = is_published === 'true'
    if (search) filters.search = search as string

    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10
    }

    const result = await learningResourcesService.getResourcesByTeacher(
      teacher_id as string,
      filters,
      pagination
    )

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getTeacherResources:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getSectionResources = async (req: Request, res: Response) => {
  try {
    const { section_id, subject_id, resource_type, search, page, limit } = req.query

    if (!section_id) {
      return res.status(400).json({
        success: false,
        error: 'section_id is required'
      })
    }

    const filters: any = {}
    if (subject_id) filters.subject_id = subject_id as string
    if (resource_type) filters.resource_type = resource_type as string
    if (search) filters.search = search as string

    const pagination = {
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10
    }

    const result = await learningResourcesService.getResourcesBySection(
      section_id as string,
      filters,
      pagination
    )

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getSectionResources:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await learningResourcesService.getResourceById(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(404).json(result)
    }
  } catch (error: any) {
    console.error('Error in getResource:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const createResource = async (req: Request, res: Response) => {
  try {
    const dto = req.body

    if (!dto.school_id || !dto.teacher_id || !dto.academic_year_id || !dto.title || !dto.resource_type) {
      return res.status(400).json({
        success: false,
        error: 'school_id, teacher_id, academic_year_id, title, and resource_type are required'
      })
    }

    const result = await learningResourcesService.createResource(dto)

    if (result.success) {
      res.status(201).json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in createResource:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const updateResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto = req.body

    const result = await learningResourcesService.updateResource(id, dto)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in updateResource:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const deleteResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await learningResourcesService.deleteResource(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in deleteResource:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// ============================================================================
// VIEW TRACKING
// ============================================================================

export const recordView = async (req: Request, res: Response) => {
  try {
    const { resource_id, student_id } = req.body

    if (!resource_id || !student_id) {
      return res.status(400).json({
        success: false,
        error: 'resource_id and student_id are required'
      })
    }

    const result = await learningResourcesService.recordResourceView(resource_id, student_id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in recordView:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getViewStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await learningResourcesService.getResourceViewStats(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getViewStats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
