import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { gradingScalesService } from '../services/grading-scales.service'

// ============================================================================
// GRADING SCALES CONTROLLERS
// ============================================================================

export const getScales = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const campusId = req.query.campus_id as string | undefined
    const data = await gradingScalesService.getScales(schoolId, campusId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getScales:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getScaleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await gradingScalesService.getScaleById(id)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Grading scale not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getScaleById:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createScale = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradingScalesService.createScale(schoolId, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateScale = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await gradingScalesService.updateScale(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteScale = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await gradingScalesService.deleteScale(id)
    res.json({ success: true, message: 'Grading scale deleted' })
  } catch (error: any) {
    console.error('Error in deleteScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getDefaultScale = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const campusId = req.query.campus_id as string | undefined
    const data = await gradingScalesService.getDefaultScale(schoolId, campusId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getDefaultScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const seedDefaultScale = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradingScalesService.seedDefaultScale(schoolId, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in seedDefaultScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// GRADING SCALE GRADES CONTROLLERS
// ============================================================================

export const getGrades = async (req: Request, res: Response) => {
  try {
    const { scaleId } = req.params
    const data = await gradingScalesService.getGrades(scaleId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createGrade = async (req: Request, res: Response) => {
  try {
    const { scaleId } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const data = await gradingScalesService.createGrade(scaleId, schoolId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const bulkCreateGrades = async (req: Request, res: Response) => {
  try {
    const { scaleId } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { grades } = req.body
    if (!Array.isArray(grades)) {
      return res.status(400).json({ success: false, error: 'grades array is required' })
    }

    const data = await gradingScalesService.bulkCreateGrades(scaleId, schoolId, grades)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in bulkCreateGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params
    const data = await gradingScalesService.updateGrade(gradeId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteGrade = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params
    await gradingScalesService.deleteGrade(gradeId)
    res.json({ success: true, message: 'Grade entry deleted' })
  } catch (error: any) {
    console.error('Error in deleteGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const generateGrades = async (req: Request, res: Response) => {
  try {
    const { scaleId } = req.params
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    if (!adminSchoolId) {
      return res.status(400).json({ success: false, error: 'Unauthorized' })
    }

    const { grade_min, grade_max, grade_step, decimal_separator } = req.body

    if (grade_min === undefined || grade_max === undefined || !grade_step) {
      return res.status(400).json({
        success: false,
        error: 'grade_min, grade_max, and grade_step are required',
      })
    }

    const data = await gradingScalesService.generateGrades(
      scaleId,
      adminSchoolId,
      parseFloat(grade_min),
      parseFloat(grade_max),
      parseFloat(grade_step),
      decimal_separator === ',' ? ',' : '.'
    )

    res.json({ success: true, data, message: `Generated ${data.length} grade entries` })
  } catch (error: any) {
    console.error('Error in generateGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const calculateLetterGrade = async (req: Request, res: Response) => {
  try {
    const { scaleId } = req.params
    const { percentage } = req.query

    if (percentage === undefined) {
      return res.status(400).json({ success: false, error: 'percentage is required' })
    }

    const data = await gradingScalesService.calculateLetterGrade(
      parseFloat(percentage as string),
      scaleId
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in calculateLetterGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
