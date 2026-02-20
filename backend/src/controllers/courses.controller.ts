import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { coursesService } from '../services/courses.service'

// ============================================================================
// COURSES CONTROLLERS
// ============================================================================

export const getCourses = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const academicYearId = req.query.academic_year_id as string | undefined
    const campusId = req.query.campus_id as string | undefined
    const data = await coursesService.getCourses(schoolId, academicYearId, campusId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCourses:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCourseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await coursesService.getCourseById(id)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Course not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCourseById:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCourse = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await coursesService.createCourse(schoolId, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createCourse:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const data = await coursesService.updateCourse(id, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateCourse:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCourse = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await coursesService.deleteCourse(id)
    res.json({ success: true, message: 'Course deleted' })
  } catch (error: any) {
    console.error('Error in deleteCourse:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// COURSE PERIODS CONTROLLERS
// ============================================================================

export const getCoursePeriods = async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params
    const data = await coursesService.getCoursePeriods(courseId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCoursePeriods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCoursePeriodById = async (req: Request, res: Response) => {
  try {
    const { cpId } = req.params
    const data = await coursesService.getCoursePeriodById(cpId)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Course period not found' })
    }
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCoursePeriodById:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const createCoursePeriod = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const userId = (req as AuthRequest).user?.id
    const data = await coursesService.createCoursePeriod(schoolId, req.body, userId)
    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error in createCoursePeriod:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const updateCoursePeriod = async (req: Request, res: Response) => {
  try {
    const { cpId } = req.params
    const data = await coursesService.updateCoursePeriod(cpId, req.body)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in updateCoursePeriod:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const deleteCoursePeriod = async (req: Request, res: Response) => {
  try {
    const { cpId } = req.params
    await coursesService.deleteCoursePeriod(cpId)
    res.json({ success: true, message: 'Course period deleted' })
  } catch (error: any) {
    console.error('Error in deleteCoursePeriod:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

export const getCoursePeriodsByTeacher = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params
    const academicYearId = req.query.academic_year_id as string | undefined
    const data = await coursesService.getCoursePeriodsByTeacher(teacherId, academicYearId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCoursePeriodsByTeacher:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getCoursePeriodsByStudent = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const academicYearId = req.query.academic_year_id as string | undefined
    const data = await coursesService.getCoursePeriodsByStudent(studentId, academicYearId)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in getCoursePeriodsByStudent:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

export const syncFromTeacherAssignments = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const { academic_year_id } = req.body
    if (!academic_year_id) {
      return res.status(400).json({ success: false, error: 'academic_year_id is required' })
    }

    const data = await coursesService.syncFromTeacherAssignments(schoolId, academic_year_id)
    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error in syncFromTeacherAssignments:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
