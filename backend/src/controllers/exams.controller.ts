import { Request, Response } from 'express'
import * as examsService from '../services/exams.service'

// ============================================================================
// EXAM TYPE CONTROLLERS
// ============================================================================

export const getExamTypes = async (req: Request, res: Response) => {
  try {
    const { school_id } = req.query

    if (!school_id) {
      return res.status(400).json({
        success: false,
        error: 'school_id is required'
      })
    }

    const result = await examsService.getExamTypes(school_id as string)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getExamTypes:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// ============================================================================
// EXAM CONTROLLERS
// ============================================================================

export const getTeacherExams = async (req: Request, res: Response) => {
  try {
    const { teacher_id, section_id, subject_id, academic_year_id, is_completed } = req.query

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
    if (is_completed !== undefined) filters.is_completed = is_completed === 'true'

    const result = await examsService.getTeacherExams(
      teacher_id as string,
      filters
    )

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getTeacherExams:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const createExam = async (req: Request, res: Response) => {
  try {
    const result = await examsService.createExam(req.body)

    if (result.success) {
      res.status(201).json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in createExam:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const updateExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await examsService.updateExam(id, req.body)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in updateExam:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const deleteExam = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await examsService.deleteExam(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in deleteExam:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

// ============================================================================
// EXAM RESULTS CONTROLLERS
// ============================================================================

export const getExamResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await examsService.getExamResults(id)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in getExamResults:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}

export const recordMarks = async (req: Request, res: Response) => {
  try {
    const result = await examsService.recordMarks(req.body)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error: any) {
    console.error('Error in recordMarks:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}
