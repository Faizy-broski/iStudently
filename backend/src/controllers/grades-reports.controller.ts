import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { gradesReportsService } from '../services/grades-reports.service'

// ============================================================================
// HONOR ROLL (RosarioSIS-style — no rules, direct per-grade threshold check)
// ============================================================================

export const getHonorRollStudents = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })

    const { marking_period_id, academic_year_id } = req.query
    if (!marking_period_id) {
      return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    }

    const campusId = req.query.campus_id as string | undefined
    const data = await gradesReportsService.getHonorRollStudents(
      schoolId, marking_period_id as string, academic_year_id as string, campusId
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getHonorRollStudents:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// CLASS RANK
// ============================================================================

export const getClassRanks = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })

    const { academic_year_id, marking_period_id, section_id, grade_level_id } = req.query
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const campus_id = req.query.campus_id as string | undefined
    const data = await gradesReportsService.getClassRanks(schoolId, academic_year_id as string, {
      marking_period_id: marking_period_id as string,
      section_id: section_id as string,
      grade_level_id: grade_level_id as string,
      campus_id,
    })
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getClassRanks:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const recalculateRanks = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })

    const { academic_year_id, marking_period_id } = req.body
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const count = await gradesReportsService.recalculateRanks(schoolId, academic_year_id, marking_period_id)
    res.json({ success: true, data: { students_ranked: count } })
  } catch (error: any) {
    console.error('Error in recalculateRanks:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// PER-COURSE CLASS RANK
// ============================================================================

export const getCourseClassRank = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })

    const { course_period_id, marking_period_id } = req.query
    if (!course_period_id || !marking_period_id) {
      return res.status(400).json({
        success: false,
        error: 'course_period_id and marking_period_id are required',
      })
    }

    const data = await gradesReportsService.getCourseClassRank(
      schoolId,
      course_period_id as string,
      marking_period_id as string
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCourseClassRank:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// TRANSCRIPTS
// ============================================================================

export const getTranscript = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const data = await gradesReportsService.getTranscript(studentId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getTranscript:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const generateTranscript = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { academic_year_id, marking_period_id } = req.body
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const count = await gradesReportsService.generateTranscriptFromFinalGrades(
      studentId, academic_year_id, marking_period_id
    )
    res.json({ success: true, data: { records_created: count } })
  } catch (error: any) {
    console.error('Error in generateTranscript:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * POST /grades-reports/transcripts/generate
 * Batch generate transcript data for printing (multiple students).
 */
export const generateTranscripts = async (req: Request, res: Response) => {
  try {
    const { student_ids, options, campus_id } = req.body
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' })
    }

    const data = await gradesReportsService.generateTranscripts(
      student_ids,
      { ...options, campus_id }
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in generateTranscripts:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const addTransferCredit = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const data = await gradesReportsService.addTransferCredit(schoolId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in addTransferCredit:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCumulativeGPA = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const data = await gradesReportsService.getCumulativeGPA(studentId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCumulativeGPA:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
