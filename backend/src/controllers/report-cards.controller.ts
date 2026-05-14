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
    const { title, sort_order, campus_id, color } = req.body
    const data = await reportCardsService.createCategory(schoolId, title, sort_order, campus_id, color)
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

// ============================================================================
// TUTOR / HOMEROOM COMMENTS
// ============================================================================

export const getEligibleMarkingPeriods = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    const { academic_year_id } = req.query
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id is required' })
    if (!academic_year_id) return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    const data = await reportCardsService.getEligibleMarkingPeriods(schoolId, academic_year_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getEligibleMarkingPeriods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getTutorComment = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { marking_period_id, academic_year_id, campus_id } = req.query
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    if (!adminSchoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })
    if (!marking_period_id || !academic_year_id) {
      return res.status(400).json({ success: false, error: 'marking_period_id and academic_year_id are required' })
    }
    const data = await reportCardsService.getTutorComment(
      studentId,
      marking_period_id as string,
      academic_year_id as string,
      adminSchoolId,
      campus_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getTutorComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const upsertTutorComment = async (req: Request, res: Response) => {
  try {
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).user?.id
    if (!adminSchoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })
    const { student_id, marking_period_id, academic_year_id, campus_id, comment, tutor_name } = req.body
    if (!student_id || !marking_period_id || !academic_year_id || !comment) {
      return res.status(400).json({ success: false, error: 'student_id, marking_period_id, academic_year_id, and comment are required' })
    }
    const data = await reportCardsService.upsertTutorComment(
      { student_id, marking_period_id, academic_year_id, campus_id, comment, tutor_name },
      adminSchoolId,
      userId
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in upsertTutorComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteTutorComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    const { campus_id } = req.query
    if (!adminSchoolId) return res.status(400).json({ success: false, error: 'Unauthorized' })
    await reportCardsService.deleteTutorComment(id, adminSchoolId, campus_id as string | undefined)
    res.json({ success: true, message: 'Tutor comment deleted' })
  } catch (error: any) {
    console.error('Error in deleteTutorComment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// TEACHER-SCOPED COMMENT CODES
// No data leaks: teachers can read school-wide (staff_id IS NULL) + own codes;
// create/update/delete are enforced to staff_id ownership in the service.
// ============================================================================

export const getTeacherCodeScales = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const schoolId = profile?.school_id
    const staffId = profile?.staff_id
    if (!schoolId || !staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await reportCardsService.getTeacherCodeScales(schoolId, staffId)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createTeacherCodeScale = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const schoolId = profile?.school_id
    const staffId = profile?.staff_id
    if (!schoolId || !staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const { title, comment } = req.body
    if (!title) return res.status(400).json({ success: false, error: 'title is required' })
    const data = await reportCardsService.createTeacherCodeScale(schoolId, staffId, title, comment)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateTeacherCodeScale = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const staffId = profile?.staff_id
    if (!staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const { id } = req.params
    const { title, comment } = req.body
    const data = await reportCardsService.updateTeacherCodeScale(id, staffId, { title, comment })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message })
  }
}

export const deleteTeacherCodeScale = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const staffId = profile?.staff_id
    if (!staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    await reportCardsService.deleteTeacherCodeScale(req.params.id, staffId)
    res.json({ success: true, message: 'Scale deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createTeacherCode = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const schoolId = profile?.school_id
    const staffId = profile?.staff_id
    if (!schoolId || !staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const { scaleId } = req.params
    const { title, short_name, comment, sort_order } = req.body
    if (!title) return res.status(400).json({ success: false, error: 'title is required' })
    const data = await reportCardsService.createTeacherCode(scaleId, staffId, schoolId, { title, short_name, comment, sort_order })
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    res.status(error.message.includes('school-wide') ? 403 : 500).json({ success: false, error: error.message })
  }
}

export const updateTeacherCode = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const staffId = profile?.staff_id
    if (!staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const { title, short_name, comment, sort_order } = req.body
    const data = await reportCardsService.updateTeacherCode(req.params.id, staffId, { title, short_name, comment, sort_order })
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ success: false, error: error.message })
  }
}

export const deleteTeacherCode = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    const staffId = profile?.staff_id
    if (!staffId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    await reportCardsService.deleteTeacherCode(req.params.id, staffId)
    res.json({ success: true, message: 'Code deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
