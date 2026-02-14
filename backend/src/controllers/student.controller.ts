import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { StudentService } from '../services/student.service'
import { CreateStudentDTO, UpdateStudentDTO } from '../types'
import { getEffectiveSchoolId } from '../utils/campus-validation'

const studentService = new StudentService()

export class StudentController {
  /**
   * Get all students for the authenticated user's school
   * GET /api/students
   * Requires: admin or teacher role
   */
  async getStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return // FIX: Must return after sending error response
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const search = req.query.search as string
      const gradeLevel = req.query.grade_level as string
      const campusId = req.query.campus_id as string

      // Use campus_id if provided and not empty, otherwise use admin's school_id
      const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : schoolId

      const result = await studentService.getStudents(
        effectiveSchoolId,
        page,
        limit,
        search,
        gradeLevel
      )

      res.json({
        success: true,
        data: result.students,
        pagination: result.pagination
      })
    } catch (error: any) {
      console.error('Get students error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch students'
      })
    }
  }

  /**
   * Get students report with proper grade/section joins
   * GET /api/students/report
   * Requires: admin role
   */
  async getStudentsReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 1000
      const campusId = req.query.campus_id as string
      
      // IMPORTANT: Only use campus_id if it's explicitly provided and not empty
      // If empty string or undefined, use admin's school_id (which might be parent school)
      const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : schoolId

      const result = await studentService.getStudentsReport(
        effectiveSchoolId,
        page,
        limit
      )

      res.json({
        success: true,
        data: result.students,
        pagination: result.pagination
      })
    } catch (error: any) {
      console.error('Get students report error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch students report'
      })
    }
  }

  /**
   * Get a single student by ID
   * GET /api/students/:id
   * Requires: admin or teacher role
   */
  async getStudentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const student = await studentService.getStudentById(studentId, schoolId)

      if (!student) {
        res.status(404).json({
          success: false,
          error: 'Student not found'
        })
      }

      res.json({
        success: true,
        data: student
      })
    } catch (error: any) {
      console.error('Get student by ID error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch student'
      })
    }
  }

  /**
   * Get student by student number
   * GET /api/students/number/:studentNumber
   * Requires: admin or teacher role
   */
  async getStudentByNumber(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const studentNumber = req.params.studentNumber

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const student = await studentService.getStudentByNumber(studentNumber, schoolId)

      if (!student) {
        res.status(404).json({
          success: false,
          error: 'Student not found'
        })
        return
      }

      res.json({
        success: true,
        data: student
      })
    } catch (error: any) {
      console.error('Get student by number error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch student'
      })
    }
  }

  /**
   * Create a new student
   * POST /api/students
   * Requires: admin role
   */
  async createStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id

      if (!adminSchoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      // Get the effective school ID (campus) to use
      // If campus_id is provided in request body and admin has access, use it
      // Otherwise, fall back to admin's school_id
      const effectiveSchoolId = await getEffectiveSchoolId(
        adminSchoolId,
        req.body.campus_id || req.body.school_id
      )

      const studentData: CreateStudentDTO = {
        ...req.body,
        school_id: effectiveSchoolId // Use campus ID if provided and valid
      }

      const student = await studentService.createStudent(studentData)

      res.status(201).json({
        success: true,
        data: student,
        message: 'Student created successfully'
      })
    } catch (error: any) {
      console.error('Create student error:', error)
      
      // Handle specific errors
      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message
        })
      }

      if (error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create student'
      })
    }
  }

  /**
   * Update a student
   * PUT /api/students/:id
   * Requires: admin role
   */
  async updateStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.params.id
      const campusId = req.query.campus_id as string

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      // Use campus_id if provided, otherwise use school_id
      const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : schoolId

      const updateData: UpdateStudentDTO = req.body

      const student = await studentService.updateStudent(studentId, effectiveSchoolId, updateData)

      res.json({
        success: true,
        data: student,
        message: 'Student updated successfully'
      })
    } catch (error: any) {
      console.error('Update student error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
        return
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update student'
      })
    }
  }

  /**
   * Delete a student
   * DELETE /api/students/:id
   * Requires: admin role
   */
  async deleteStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      await studentService.deleteStudent(studentId, schoolId)

      res.json({
        success: true,
        message: 'Student deleted successfully'
      })
    } catch (error: any) {
      console.error('Delete student error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete student'
      })
    }
  }

  /**
   * Get students by grade level
   * GET /api/students/grade/:gradeLevel
   * Requires: admin or teacher role
   */
  async getStudentsByGrade(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const gradeLevel = req.params.gradeLevel

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const students = await studentService.getStudentsByGrade(schoolId, gradeLevel)

      res.json({
        success: true,
        data: students
      })
    } catch (error: any) {
      console.error('Get students by grade error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch students by grade'
      })
    }
  }

  /**
   * Get student statistics
   * GET /api/students/stats
   * Requires: admin role
   */
  async getStudentStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      const stats = await studentService.getStudentStats(schoolId)

      res.json({
        success: true,
        data: stats
      })
    } catch (error: any) {
      console.error('Get student stats error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch student statistics'
      })
    }
  }

  /**
   * Get students info for printing with selected categories
   * POST /api/students/print-info
   * Requires: admin role
   * Body: { studentIds: string[], categoryIds: string[], campusId?: string }
   */
  async getStudentsPrintInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const { studentIds, categoryIds, campusId } = req.body

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Please select at least one student'
        })
        return
      }

      if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Please select at least one category'
        })
        return
      }

      const effectiveSchoolId = campusId || schoolId

      const result = await studentService.getStudentsPrintInfo(
        effectiveSchoolId,
        studentIds,
        categoryIds
      )

      res.json({
        success: true,
        data: result
      })
    } catch (error: any) {
      console.error('Get students print info error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch students print info'
      })
    }
  }
}
