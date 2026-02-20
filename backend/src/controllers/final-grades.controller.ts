import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { finalGradesService } from '../services/final-grades.service'

// ============================================================================
// FINAL GRADES
// ============================================================================

export const getFinalGrades = async (req: Request, res: Response) => {
  try {
    const { course_period_id, marking_period_id } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await finalGradesService.getFinalGrades(
      course_period_id as string,
      marking_period_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getFinalGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getStudentFinalGrades = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { academic_year_id } = req.query
    const data = await finalGradesService.getStudentFinalGrades(
      studentId,
      academic_year_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getStudentFinalGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const saveFinalGrade = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }
    const userId = (req as AuthRequest).user?.id
    const data = await finalGradesService.saveFinalGrade(schoolId, req.body, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in saveFinalGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const calculateAndSaveFinalGrades = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id, marking_period_id, academic_year_id } = req.body
    if (!course_period_id || !marking_period_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'course_period_id, marking_period_id, and academic_year_id are required',
      })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await finalGradesService.calculateAndSaveFinalGrades(
      schoolId, course_period_id, marking_period_id, academic_year_id, userId
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in calculateAndSaveFinalGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// SEMESTER / FULL YEAR CASCADE
// ============================================================================

export const calculateCascadingGrades = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id, marking_period_id, academic_year_id, mode } = req.body
    if (!course_period_id || !marking_period_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'course_period_id, marking_period_id, and academic_year_id are required',
      })
    }

    const userId = (req as AuthRequest).user?.id

    // mode: 'auto' = cascade from QTR → SEM → FY automatically
    //        'sem'  = calculate only the SEM from child QTRs
    //        'fy'   = calculate only the FY from child SEMs
    let data: any
    if (mode === 'sem') {
      data = await finalGradesService.calculateSemFinalGrades(
        schoolId, course_period_id, marking_period_id, academic_year_id, userId
      )
    } else if (mode === 'fy') {
      data = await finalGradesService.calculateFYFinalGrades(
        schoolId, course_period_id, marking_period_id, academic_year_id, userId
      )
    } else {
      // Default: auto-cascade from QTR upward
      data = await finalGradesService.cascadeAllMPGrades(
        schoolId, course_period_id, marking_period_id, academic_year_id, userId
      )
    }

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in calculateCascadingGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// TEACHER COMPLETION
// ============================================================================

export const getCompletionStatus = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }
    const { marking_period_id, academic_year_id, school_period_id, campus_id } = req.query
    if (!marking_period_id) {
      return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    }
    const data = await finalGradesService.getCompletionStatus(
      schoolId,
      marking_period_id as string,
      academic_year_id as string | undefined,
      school_period_id as string | undefined,
      campus_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCompletionStatus:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const markCompleted = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id, teacher_id, marking_period_id, academic_year_id } = req.body
    if (!course_period_id || !teacher_id || !marking_period_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'course_period_id, teacher_id, marking_period_id, and academic_year_id are required',
      })
    }

    const data = await finalGradesService.markCompleted(
      schoolId, course_period_id, teacher_id, marking_period_id, academic_year_id
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in markCompleted:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const unmarkCompleted = async (req: Request, res: Response) => {
  try {
    const { course_period_id, teacher_id, marking_period_id } = req.body
    if (!course_period_id || !teacher_id || !marking_period_id) {
      return res.status(400).json({
        success: false,
        error: 'course_period_id, teacher_id, and marking_period_id are required',
      })
    }

    await finalGradesService.unmarkCompleted(course_period_id, teacher_id, marking_period_id)
    res.json({ success: true, message: 'Completion status removed' })
  } catch (error: any) {
    console.error('Error in unmarkCompleted:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// GRADE BREAKDOWN
// ============================================================================

export const getGradeBreakdown = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { academic_year_id, marking_period_id } = req.query
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const data = await finalGradesService.getGradeBreakdown(
      studentId,
      academic_year_id as string,
      marking_period_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGradeBreakdown:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// FINAL GRADE LISTS (batch generation for printing)
// ============================================================================

export const generateGradeLists = async (req: Request, res: Response) => {
  try {
    const { student_ids, marking_period_ids, options, campus_id } = req.body
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' })
    }
    if (!marking_period_ids || !Array.isArray(marking_period_ids) || marking_period_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'marking_period_ids array is required' })
    }

    const data = await finalGradesService.generateGradeLists(
      student_ids,
      marking_period_ids,
      { ...options, campus_id }
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in generateGradeLists:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
