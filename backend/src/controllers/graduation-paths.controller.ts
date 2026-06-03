import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { graduationPathsService } from '../services/graduation-paths.service'

// ============================================================================
// GRADUATION PATHS — CRUD
// ============================================================================

export const getGraduationPaths = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }
    const campusId = req.query.campus_id as string | undefined
    const data = await graduationPathsService.getGraduationPaths(schoolId, campusId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGraduationPaths:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getGraduationPath = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await graduationPathsService.getGraduationPath(id)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Graduation path not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getGraduationPath:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createGraduationPath = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }
    const userId = (req as AuthRequest).user?.id
    const data = await graduationPathsService.createGraduationPath(schoolId, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createGraduationPath:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateGraduationPath = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await graduationPathsService.updateGraduationPath(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateGraduationPath:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteGraduationPath = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await graduationPathsService.deleteGraduationPath(id)
    res.json({ success: true, message: 'Graduation path deleted' })
  } catch (error: any) {
    console.error('Error in deleteGraduationPath:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// GRADE LEVELS ASSIGNMENT
// ============================================================================

export const getPathGradeLevels = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await graduationPathsService.getPathGradeLevels(id)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getPathGradeLevels:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const assignGradeLevels = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { grade_level_ids } = req.body
    if (!Array.isArray(grade_level_ids) || grade_level_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'grade_level_ids array is required' })
    }
    const data = await graduationPathsService.assignGradeLevels(id, grade_level_ids)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in assignGradeLevels:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const removeGradeLevel = async (req: Request, res: Response) => {
  try {
    const { id, gradeLevelId } = req.params
    await graduationPathsService.removeGradeLevel(id, gradeLevelId)
    res.json({ success: true, message: 'Grade level removed from path' })
  } catch (error: any) {
    console.error('Error in removeGradeLevel:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// SUBJECTS ASSIGNMENT
// ============================================================================

export const getPathSubjects = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await graduationPathsService.getPathSubjects(id)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getPathSubjects:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const assignSubjects = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { subjects } = req.body
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ success: false, error: 'subjects array is required' })
    }
    const data = await graduationPathsService.assignSubjects(id, subjects)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in assignSubjects:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateSubjectCredits = async (req: Request, res: Response) => {
  try {
    const { id, subjectId } = req.params
    const { credits } = req.body
    if (credits === undefined || credits === null) {
      return res.status(400).json({ success: false, error: 'credits is required' })
    }
    const data = await graduationPathsService.updateSubjectCredits(id, subjectId, credits)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateSubjectCredits:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const removeSubject = async (req: Request, res: Response) => {
  try {
    const { id, subjectId } = req.params
    await graduationPathsService.removeSubject(id, subjectId)
    res.json({ success: true, message: 'Subject removed from path' })
  } catch (error: any) {
    console.error('Error in removeSubject:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// STUDENTS ASSIGNMENT
// ============================================================================

export const getPathStudents = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await graduationPathsService.getPathStudents(id)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getPathStudents:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const assignStudents = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { student_ids } = req.body
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'student_ids array is required' })
    }
    const data = await graduationPathsService.assignStudents(id, student_ids)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in assignStudents:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const removeStudent = async (req: Request, res: Response) => {
  try {
    const { id, studentId } = req.params
    await graduationPathsService.removeStudent(id, studentId)
    res.json({ success: true, message: 'Student removed from path' })
  } catch (error: any) {
    console.error('Error in removeStudent:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getStudentCredits = async (req: Request, res: Response) => {
  try {
    const { id, studentId } = req.params
    const data = await graduationPathsService.getStudentCredits(id, studentId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getStudentCredits:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
