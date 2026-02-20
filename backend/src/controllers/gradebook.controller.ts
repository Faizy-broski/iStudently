import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { gradebookService } from '../services/gradebook.service'

// ============================================================================
// ASSIGNMENT TYPES CONTROLLERS
// ============================================================================

export const getAssignmentTypes = async (req: Request, res: Response) => {
  try {
    const { course_period_id } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await gradebookService.getAssignmentTypes(course_period_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getAssignmentTypes:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getAssignmentTypesByCourse = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params
    const data = await gradebookService.getAssignmentTypesByCourse(courseId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getAssignmentTypesByCourse:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createAssignmentType = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id } = req.body
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradebookService.createAssignmentType(schoolId, course_period_id, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createAssignmentType:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateAssignmentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await gradebookService.updateAssignmentType(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateAssignmentType:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteAssignmentType = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await gradebookService.deleteAssignmentType(id)
    res.json({ success: true, message: 'Assignment type deleted' })
  } catch (error: any) {
    console.error('Error in deleteAssignmentType:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// ASSIGNMENTS CONTROLLERS
// ============================================================================

export const getAssignments = async (req: Request, res: Response) => {
  try {
    const { course_period_id, assignment_type_id } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await gradebookService.getAssignments(
      course_period_id as string,
      assignment_type_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getAssignments:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getAssignmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await gradebookService.getAssignmentById(id)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Assignment not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getAssignmentById:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id } = req.body
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradebookService.createAssignment(schoolId, course_period_id, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createAssignment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await gradebookService.updateAssignment(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateAssignment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await gradebookService.deleteAssignment(id)
    res.json({ success: true, message: 'Assignment deleted' })
  } catch (error: any) {
    console.error('Error in deleteAssignment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// GRADES CONTROLLERS
// ============================================================================

export const getGradesForAssignment = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params
    const data = await gradebookService.getGradesForAssignment(assignmentId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGradesForAssignment:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getGradesForStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { course_period_id } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await gradebookService.getGradesForStudent(studentId, course_period_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGradesForStudent:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const enterGrade = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradebookService.enterGrade(schoolId, req.body, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in enterGrade:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const bulkEnterGrades = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradebookService.bulkEnterGrades(schoolId, req.body, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in bulkEnterGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// CALCULATIONS & VIEWS
// ============================================================================

export const calculateStudentAverage = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const { course_period_id } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await gradebookService.calculateStudentAverage(studentId, course_period_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in calculateStudentAverage:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getGradebookView = async (req: Request, res: Response) => {
  try {
    const { course_period_id, section_id } = req.query
    if (!course_period_id || !section_id) {
      return res.status(400).json({ success: false, error: 'course_period_id and section_id are required' })
    }
    const data = await gradebookService.getGradebookView(course_period_id as string, section_id as string)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGradebookView:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getAnomalousGrades = async (req: Request, res: Response) => {
  try {
    const { course_period_id, threshold } = req.query
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    const data = await gradebookService.getAnomalousGrades(
      course_period_id as string,
      threshold ? parseFloat(threshold as string) : 20
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getAnomalousGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// IMPORT FROM CSV/EXCEL
// ============================================================================

export const importGradebookGrades = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id, mappings } = req.body
    if (!course_period_id) {
      return res.status(400).json({ success: false, error: 'course_period_id is required' })
    }
    if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one column mapping is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await gradebookService.importGradebookGrades(schoolId, req.body, userId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in importGradebookGrades:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// CONFIG
// ============================================================================

export const getConfig = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }
    const coursePeriodId = req.query.course_period_id as string | undefined
    const data = await gradebookService.getConfig(schoolId, coursePeriodId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getConfig:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const setConfig = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { course_period_id, key, value } = req.body
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, error: 'key and value are required' })
    }

    await gradebookService.setConfig(schoolId, course_period_id || null, key, value)
    res.json({ success: true, message: 'Config saved' })
  } catch (error: any) {
    console.error('Error in setConfig:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// PROGRESS REPORTS (batch generation for printing)
// ============================================================================

export const generateProgressReports = async (req: Request, res: Response) => {
  try {
    const { student_ids, options, campus_id } = req.body
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' })
    }

    const data = await gradebookService.generateProgressReports(
      student_ids,
      { ...options, campus_id }
    )
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in generateProgressReports:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
