import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { reportCardsService } from '../services/report-cards.service'

// ============================================================================
// COMMENT CATEGORIES
// ============================================================================

export const getCategories = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const data = await reportCardsService.getCategories(schoolId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCategories:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCategory = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const { title, sort_order, campus_id } = req.body
    const data = await reportCardsService.createCategory(schoolId, title, sort_order, campus_id)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createCategory:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await reportCardsService.updateCategory(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateCategory:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await reportCardsService.deleteCategory(id)
    res.json({ success: true, message: 'Category deleted' })
  } catch (error: any) {
    console.error('Error in deleteCategory:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

export const getComments = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const data = await reportCardsService.getComments(schoolId, req.query.category_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getComments:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createComment = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const data = await reportCardsService.createComment(schoolId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await reportCardsService.updateComment(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await reportCardsService.deleteComment(id)
    res.json({ success: true, message: 'Comment deleted' })
  } catch (error: any) {
    console.error('Error in deleteComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// COMMENT CODE SCALES & CODES
// ============================================================================

export const getCodeScales = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const data = await reportCardsService.getCodeScales(schoolId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCodeScales:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCodeScale = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const { title, comment, campus_id } = req.body
    const data = await reportCardsService.createCodeScale(schoolId, title, comment, campus_id)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createCodeScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCode = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const { scaleId } = req.params
    const data = await reportCardsService.createCode(scaleId, schoolId, req.body)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createCode:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCodeScale = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await reportCardsService.deleteCodeScale(id)
    res.json({ success: true, message: 'Code scale deleted' })
  } catch (error: any) {
    console.error('Error in deleteCodeScale:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await reportCardsService.deleteCode(id)
    res.json({ success: true, message: 'Code deleted' })
  } catch (error: any) {
    console.error('Error in deleteCode:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// STUDENT COMMENTS
// ============================================================================

export const getStudentComments = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { marking_period_id, course_period_id } = req.query
    if (!marking_period_id) {
      return res.status(400).json({ success: false, error: 'marking_period_id is required' })
    }
    const data = await reportCardsService.getStudentComments(
      studentId, marking_period_id as string, course_period_id as string
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getStudentComments:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const saveStudentComment = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    const userId = (req as AuthRequest).user?.id
    const data = await reportCardsService.saveStudentComment(schoolId, req.body, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in saveStudentComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteStudentComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await reportCardsService.deleteStudentComment(id)
    res.json({ success: true, message: 'Student comment deleted' })
  } catch (error: any) {
    console.error('Error in deleteStudentComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// REPORT CARD GENERATION
// ============================================================================

export const generateReportCard = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { marking_period_id, academic_year_id } = req.query
    if (!marking_period_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'marking_period_id and academic_year_id are required',
      })
    }

    const data = await reportCardsService.generateReportCard(
      studentId,
      marking_period_id as string,
      academic_year_id as string
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in generateReportCard:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const generateReportCards = async (req: Request, res: Response) => {
  try {
    const { student_ids, options, campus_id } = req.body
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' })
    }
    if (!options || !options.marking_period_ids || options.marking_period_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'options.marking_period_ids is required' })
    }
    const data = await reportCardsService.generateReportCards(
      student_ids,
      { ...options, campus_id }
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in generateReportCards:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
