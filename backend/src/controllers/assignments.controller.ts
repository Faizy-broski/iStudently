import { Request, Response } from 'express'
import * as assignmentsService from '../services/assignments.service'

// ============================================================================
// ASSIGNMENT CONTROLLERS
// ============================================================================

export const getTeacherAssignments = async (req: Request, res: Response) => {
  try {
    const { 
      teacher_id, 
      section_id, 
      subject_id, 
      academic_year_id, 
      is_archived,
      search,
      status,
      page,
      limit 
    } = req.query

    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        error: 'teacher_id is required'
      })
    }

    const filters: any = {}
    if (section_id) filters.section_id = section_id as string
    if (subject_id) filters.subject_id = subject_id as string
    if (academic_year_id) filters.academic_year_id = academic_year_id as string
    if (is_archived !== undefined) filters.is_archived = is_archived === 'true'
    if (search) filters.search = search as string
    if (status) filters.status = status as string
    if (page) filters.page = parseInt(page as string, 10)
    if (limit) filters.limit = parseInt(limit as string, 10)

    const result = await assignmentsService.getAssignmentsByTeacher(
      teacher_id as string,
      filters
    )

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getTeacherAssignments:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getSectionAssignments = async (req: Request, res: Response) => {
  try {
    const { section_id, subject_id, academic_year_id } = req.query

    if (!section_id) {
      return res.status(400).json({
        success: false,
        error: 'section_id is required'
      })
    }

    const filters: any = {}
    if (subject_id) filters.subject_id = subject_id as string
    if (academic_year_id) filters.academic_year_id = academic_year_id as string

    const result = await assignmentsService.getAssignmentsBySection(
      section_id as string,
      filters
    )

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getSectionAssignments:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await assignmentsService.getAssignmentById(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(404).json(result)
    }
  } catch (error: any) {
    console.error('Error in getAssignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const dto = req.body

    // Validate required fields
    if (!dto.teacher_id || !dto.section_id || !dto.subject_id || !dto.title || !dto.due_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: teacher_id, section_id, subject_id, title, due_date'
      })
    }

    const result = await assignmentsService.createAssignment(dto)

    if (result.success) {
      res.status(201).json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in createAssignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto = req.body

    const result = await assignmentsService.updateAssignment(id, dto)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in updateAssignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await assignmentsService.deleteAssignment(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in deleteAssignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// ============================================================================
// SUBMISSION CONTROLLERS
// ============================================================================

export const getAssignmentSubmissions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await assignmentsService.getAssignmentSubmissions(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getAssignmentSubmissions:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const submitAssignment = async (req: Request, res: Response) => {
  try {
    const dto = req.body

    if (!dto.assignment_id || !dto.student_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: assignment_id, student_id'
      })
    }

    const result = await assignmentsService.submitAssignment(dto)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in submitAssignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto = req.body

    if (dto.score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'score is required'
      })
    }

    const result = await assignmentsService.gradeSubmission(id, dto)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in gradeSubmission:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const getAssignmentStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await assignmentsService.getAssignmentStats(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getAssignmentStats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
