import { Request, Response } from 'express'
import * as academicsService from '../services/academics.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
  }
}

// ============================================================================
// GRADE LEVELS CONTROLLER
// ============================================================================

export const createGradeLevel = async (req: Request, res: Response) => {
  try {
    const userSchoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).profile?.id
    // Use campus_id from request body if provided, otherwise use user's school_id
    const campusId = req.body.campus_id || userSchoolId
    
    if (!campusId) {
      return res.status(400).json({
        success: false,
        error: 'Campus ID or School ID is required',
      } as ApiResponse)
    }

    const grade = await academicsService.createGradeLevel({
      ...req.body,
      school_id: campusId, // For campus-specific, school_id = campus_id
      created_by: userId,
    })

    res.status(201).json({
      success: true,
      data: grade,
      message: 'Grade level created successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error creating grade level:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create grade level',
    } as ApiResponse)
  }
}

export const getGradeLevels = async (req: Request, res: Response) => {
  try {
    const userSchoolId = (req as AuthRequest).profile?.school_id
    const querySchoolId = req.query.school_id as string
    const schoolId = querySchoolId || userSchoolId
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const grades = await academicsService.getGradeLevels(schoolId)

    res.json({
      success: true,
      data: grades,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching grade levels:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch grade levels',
    } as ApiResponse)
  }
}

export const getGradeLevelById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const grade = await academicsService.getGradeLevelById(id, schoolId)

    if (!grade) {
      return res.status(404).json({
        success: false,
        error: 'Grade level not found',
      } as ApiResponse)
    }

    res.json({
      success: true,
      data: grade,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching grade level:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch grade level',
    } as ApiResponse)
  }
}

export const updateGradeLevel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const grade = await academicsService.updateGradeLevel(id, schoolId, req.body)

    res.json({
      success: true,
      data: grade,
      message: 'Grade level updated successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error updating grade level:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update grade level',
    } as ApiResponse)
  }
}

export const deleteGradeLevel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    await academicsService.deleteGradeLevel(id, schoolId)

    res.json({
      success: true,
      message: 'Grade level deleted successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error deleting grade level:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete grade level',
    } as ApiResponse)
  }
}

// ============================================================================
// SECTIONS CONTROLLER
// ============================================================================

export const createSection = async (req: Request, res: Response) => {
  try {
    const userSchoolId = (req as AuthRequest).profile?.school_id
    // Use campus_id from request body if provided, otherwise use user's school_id
    const campusId = req.body.campus_id || userSchoolId
    
    if (!campusId) {
      return res.status(400).json({
        success: false,
        error: 'Campus ID or School ID is required',
      } as ApiResponse)
    }

    const section = await academicsService.createSection({
      ...req.body,
      school_id: campusId, // For campus-specific, school_id = campus_id
      created_by: (req as AuthRequest).profile?.id,
    })

    res.status(201).json({
      success: true,
      data: section,
      message: 'Section created successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error creating section:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create section',
    } as ApiResponse)
  }
}

export const getSections = async (req: Request, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || (req as AuthRequest).profile?.school_id
    const gradeId = req.query.grade_id as string | undefined

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const sections = await academicsService.getSections(schoolId, gradeId)

    res.json({
      success: true,
      data: sections,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching sections:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sections',
    } as ApiResponse)
  }
}

export const getSectionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const section = await academicsService.getSectionById(id, schoolId)

    if (!section) {
      return res.status(404).json({
        success: false,
        error: 'Section not found',
      } as ApiResponse)
    }

    res.json({
      success: true,
      data: section,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching section:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch section',
    } as ApiResponse)
  }
}

export const updateSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const section = await academicsService.updateSection(id, schoolId, req.body)

    res.json({
      success: true,
      data: section,
      message: 'Section updated successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error updating section:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update section',
    } as ApiResponse)
  }
}

export const deleteSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    await academicsService.deleteSection(id, schoolId)

    res.json({
      success: true,
      message: 'Section deleted successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error deleting section:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete section',
    } as ApiResponse)
  }
}

// ============================================================================
// SUBJECTS CONTROLLER
// ============================================================================

export const createSubject = async (req: Request, res: Response) => {
  try {
    const userSchoolId = (req as AuthRequest).profile?.school_id
    // Use campus_id from request body if provided, otherwise use user's school_id
    const campusId = req.body.campus_id || userSchoolId
    
    if (!campusId) {
      return res.status(400).json({
        success: false,
        error: 'Campus ID or School ID is required',
      } as ApiResponse)
    }

    const subject = await academicsService.createSubject({
      ...req.body,
      school_id: campusId, // For campus-specific, school_id = campus_id
      created_by: (req as AuthRequest).profile?.id,
    })

    res.status(201).json({
      success: true,
      data: subject,
      message: 'Subject created successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error creating subject:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subject',
    } as ApiResponse)
  }
}

export const getSubjects = async (req: Request, res: Response) => {
  try {
    const userSchoolId = (req as AuthRequest).profile?.school_id
    // Use school_id from query if provided (for campus filtering), otherwise use user's school_id
    const campusId = (req.query.school_id as string) || userSchoolId
    const gradeId = req.query.grade_id as string | undefined

    if (!campusId) {
      return res.status(400).json({
        success: false,
        error: 'Campus ID or School ID is required',
      } as ApiResponse)
    }

    const subjects = await academicsService.getSubjects(campusId, gradeId)

    res.json({
      success: true,
      data: subjects,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching subjects:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subjects',
    } as ApiResponse)
  }
}

export const getSubjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const subject = await academicsService.getSubjectById(id, schoolId)

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Subject not found',
      } as ApiResponse)
    }

    res.json({
      success: true,
      data: subject,
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error fetching subject:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subject',
    } as ApiResponse)
  }
}

export const updateSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    const subject = await academicsService.updateSubject(id, schoolId, req.body)

    res.json({
      success: true,
      data: subject,
      message: 'Subject updated successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error updating subject:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update subject',
    } as ApiResponse)
  }
}

export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required',
      } as ApiResponse)
    }

    await academicsService.deleteSubject(id, schoolId)

    res.json({
      success: true,
      message: 'Subject deleted successfully',
    } as ApiResponse)
  } catch (error: any) {
    console.error('Error deleting subject:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete subject',
    } as ApiResponse)
  }
}

// ============================================================================
// ACADEMIC YEAR CONTROLLER (Global - used across all modules)
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

    const result = await academicsService.getAcademicYears(schoolId)
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

    const result = await academicsService.getCurrentAcademicYear(schoolId)
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

    const result = await academicsService.createAcademicYear({
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
    const result = await academicsService.updateAcademicYear(id, req.body)

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

export const deleteAcademicYear = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await academicsService.deleteAcademicYear(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting academic year:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}
