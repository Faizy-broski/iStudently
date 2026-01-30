import { Request, Response } from 'express'
import * as teacherService from '../services/teacher.service'
import { ApiResponse } from '../types'
import { getEffectiveSchoolId, validateCampusAccess } from '../utils/campus-validation'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
  }
}

// ============================================================================
// TEACHER / STAFF CONTROLLER
// ============================================================================

export const getAllTeachers = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    // Extract pagination and filter parameters
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = req.query.search as string
    const campus_id = req.query.campus_id as string

    const result = await teacherService.getAllTeachers(schoolId, { page, limit, search, campus_id })
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teachers:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getTeacherById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    
    // Get teacher without school filter first
    const result = await teacherService.getTeacherById(id)
    
    if (!result.success) {
      return res.status(404).json(result)
    }
    
    // SECURITY: Validate admin has access to this teacher's campus
    if (adminSchoolId && result.data?.school_id) {
      const hasAccess = await validateCampusAccess(adminSchoolId, result.data.school_id)
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Teacher belongs to a different school'
        } as ApiResponse)
      }
    }
    
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const createTeacher = async (req: Request, res: Response) => {
  try {
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).profile?.id

    if (!adminSchoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    // Get the effective school ID (campus) to use
    const effectiveSchoolId = await getEffectiveSchoolId(
      adminSchoolId,
      req.body.campus_id || req.body.school_id
    )

    const result = await teacherService.createTeacher({
      ...req.body,
      school_id: effectiveSchoolId,
      created_by: userId
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('❌ Error creating teacher:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const updateTeacher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminSchoolId = (req as AuthRequest).profile?.school_id

    // SECURITY: First verify admin has access to this teacher
    if (adminSchoolId) {
      const existing = await teacherService.getTeacherById(id)
      if (!existing.success || !existing.data) {
        return res.status(404).json({
          success: false,
          error: 'Teacher not found'
        } as ApiResponse)
      }
      
      // Validate admin has access to this teacher's campus
      const hasAccess = await validateCampusAccess(adminSchoolId, existing.data.school_id)
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Cannot update teacher from different school'
        } as ApiResponse)
      }
    }

    const result = await teacherService.updateTeacher(id, req.body)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating teacher:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const deleteTeacher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminSchoolId = (req as AuthRequest).profile?.school_id

    // SECURITY: First verify admin has access to this teacher
    if (adminSchoolId) {
      const existing = await teacherService.getTeacherById(id)
      if (!existing.success || !existing.data) {
        return res.status(404).json({
          success: false,
          error: 'Teacher not found'
        } as ApiResponse)
      }
      
      // Validate admin has access to this teacher's campus
      const hasAccess = await validateCampusAccess(adminSchoolId, existing.data.school_id)
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: Cannot delete teacher from different school'
        } as ApiResponse)
      }
    }

    const result = await teacherService.deleteTeacher(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting teacher:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// STEP 1: WORKLOAD ALLOCATION
// ============================================================================

export const getTeacherAssignments = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const { teacher_id, academic_year_id } = req.query
    
    const result = await teacherService.getTeacherAssignments(
      schoolId,
      teacher_id as string,
      academic_year_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher assignments:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const createTeacherAssignment = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.createTeacherAssignment({
      ...req.body,
      school_id: schoolId,
      assigned_by: userId
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating teacher assignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const deleteTeacherAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await teacherService.deleteTeacherAssignment(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting teacher assignment:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// ACADEMIC YEAR CONTROLLER
// ============================================================================

export const getAcademicYears = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.getAcademicYears(schoolId)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching academic years:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getCurrentAcademicYear = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.getCurrentAcademicYear(schoolId)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching current academic year:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const createAcademicYear = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.createAcademicYear({
      ...req.body,
      school_id: schoolId
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating academic year:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const updateAcademicYear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await teacherService.updateAcademicYear(id, req.body)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating academic year:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// PERIOD CONTROLLER
// ============================================================================

export const getPeriods = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const { campus_id } = req.query
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.getPeriods(schoolId, campus_id as string)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching periods:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const createPeriod = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await teacherService.createPeriod({
      ...req.body,
      school_id: schoolId,
      campus_id: req.body.campus_id || schoolId // Use school_id as campus_id fallback
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating period:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const updatePeriod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await teacherService.updatePeriod(id, req.body)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating period:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const deletePeriod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await teacherService.deletePeriod(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting period:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}
