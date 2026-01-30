import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { ParentService } from '../services/parent.service'
import { CreateParentDTO, UpdateParentDTO, CreateParentStudentLinkDTO } from '../types'
import { getEffectiveSchoolId } from '../utils/campus-validation'

const parentService = new ParentService()

export class ParentController {
  /**
   * Get all parents for the authenticated user's school
   * GET /api/parents
   * Requires: admin or teacher role
   */
  async getParents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const search = req.query.search as string

      const result = await parentService.getParents(schoolId, page, limit, search)

      res.json({
        success: true,
        data: result.parents,
        pagination: result.pagination
      })
    } catch (error: any) {
      console.error('Get parents error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch parents'
      })
    }
  }

  /**
   * Get all parents with their children
   * GET /api/parents/with-children
   * Requires: admin or teacher role
   */
  async getParentsWithChildren(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const search = req.query.search as string

      const result = await parentService.getParentsWithChildren(
        schoolId,
        page,
        limit,
        search
      )

      res.json({
        success: true,
        data: result.parents,
        pagination: result.pagination
      })
    } catch (error: any) {
      console.error('Get parents with children error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch parents with children'
      })
    }
  }

  /**
   * Get a single parent by ID
   * GET /api/parents/:id
   * Requires: admin or teacher role
   */
  async getParentById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const parent = await parentService.getParentById(parentId, schoolId)

      if (!parent) {
        res.status(404).json({
          success: false,
          error: 'Parent not found'
        })
      }

      res.json({
        success: true,
        data: parent
      })
    } catch (error: any) {
      console.error('Get parent by ID error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch parent'
      })
    }
  }

  /**
   * Get a parent with their children
   * GET /api/parents/:id/children
   * Requires: admin or teacher role
   */
  async getParentWithChildren(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const parent = await parentService.getParentWithChildren(parentId, schoolId)

      if (!parent) {
        res.status(404).json({
          success: false,
          error: 'Parent not found'
        })
      }

      res.json({
        success: true,
        data: parent
      })
    } catch (error: any) {
      console.error('Get parent with children error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch parent with children'
      })
    }
  }

  /**
   * Create a new parent
   * POST /api/parents
   * Requires: admin role
   */
  async createParent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id

      if (!adminSchoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      // Get the effective school ID (campus) to use
      // For parents, always use the admin's base school_id
      // Parents are school-wide, not campus-specific
      const effectiveSchoolId = adminSchoolId

      const parentData: CreateParentDTO = {
        ...req.body,
        school_id: effectiveSchoolId // Always use admin's base school_id for parents
      }

      const parent = await parentService.createParent(parentData)

      res.status(201).json({
        success: true,
        data: parent,
        message: 'Parent created successfully'
      })
    } catch (error: any) {
      console.error('Create parent error:', error)

      if (error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create parent'
      })
    }
  }

  /**
   * Update a parent
   * PUT /api/parents/:id
   * Requires: admin role
   */
  async updateParent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const updateData: UpdateParentDTO = req.body

      const parent = await parentService.updateParent(parentId, schoolId, updateData)

      res.json({
        success: true,
        data: parent,
        message: 'Parent updated successfully'
      })
    } catch (error: any) {
      console.error('Update parent error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update parent'
      })
    }
  }

  /**
   * Delete a parent
   * DELETE /api/parents/:id
   * Requires: admin role
   */
  async deleteParent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      await parentService.deleteParent(parentId, schoolId)

      res.json({
        success: true,
        message: 'Parent deleted successfully'
      })
    } catch (error: any) {
      console.error('Delete parent error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete parent'
      })
    }
  }

  /**
   * Link a parent to a student (association)
   * POST /api/parents/:parentId/link-student
   * Requires: admin role
   */
  async linkParentToStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.parentId

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const { student_id, relationship, is_emergency_contact } = req.body

      if (!student_id || !relationship) {
        res.status(400).json({
          success: false,
          error: 'student_id and relationship are required'
        })
      }

      const linkData: CreateParentStudentLinkDTO = {
        parent_id: parentId,
        student_id,
        relationship,
        relation_type: relationship,
        is_emergency_contact
      }

      await parentService.linkParentToStudent(linkData, schoolId)

      res.status(201).json({
        success: true,
        message: 'Parent linked to student successfully'
      })
    } catch (error: any) {
      console.error('Link parent to student error:', error)

      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: error.message
        })
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to link parent to student'
      })
    }
  }

  /**
   * Unlink a parent from a student
   * DELETE /api/parents/:parentId/unlink-student/:studentId
   * Requires: admin role
   */
  async unlinkParentFromStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.parentId
      const studentId = req.params.studentId

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      await parentService.unlinkParentFromStudent(parentId, studentId, schoolId)

      res.json({
        success: true,
        message: 'Parent unlinked from student successfully'
      })
    } catch (error: any) {
      console.error('Unlink parent from student error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to unlink parent from student'
      })
    }
  }

  /**
   * Get all children for a parent
   * GET /api/parents/:id/students
   * Requires: admin or teacher role
   */
  async getParentChildren(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const parentId = req.params.id

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const children = await parentService.getParentChildren(parentId, schoolId)

      res.json({
        success: true,
        data: children
      })
    } catch (error: any) {
      console.error('Get parent children error:', error)

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch parent children'
      })
    }
  }

  /**
   * Search parents by name, email, or phone
   * GET /api/parents/search
   * Requires: admin or teacher role
   */
  async searchParents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const query = (req.query.q as string) || ''

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
      }

      const parents = await parentService.searchParents(schoolId, query)

      res.json({
        success: true,
        data: parents
      })
    } catch (error: any) {
      console.error('Search parents error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to search parents'
      })
    }
  }

  /**
   * Get fees for logged-in parent's children
   * GET /api/parents/my/children/fees
   * Requires: parent role
   */
  async getMyChildrenFees(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const userId = req.user?.id

      if (!schoolId || !userId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      // Find parent record for this user
      const { data: parent, error: parentError } = await require('../config/supabase').supabase
        .from('parents')
        .select('id')
        .eq('profile_id', userId)
        .eq('school_id', schoolId)
        .single()

      if (parentError || !parent) {
        res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
        return
      }

      const result = await parentService.getChildrenFees(parent.id, schoolId)

      res.json({
        success: true,
        data: result
      })
    } catch (error: any) {
      console.error('Get children fees error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch children fees'
      })
    }
  }

  /**
   * Get library data for logged-in parent's children
   * GET /api/parents/my/children/library
   * Requires: parent role
   */
  async getMyChildrenLibrary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const userId = req.user?.id

      if (!schoolId || !userId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      // Find parent record for this user
      const { data: parent, error: parentError } = await require('../config/supabase').supabase
        .from('parents')
        .select('id')
        .eq('profile_id', userId)
        .eq('school_id', schoolId)
        .single()

      if (parentError || !parent) {
        res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
        return
      }

      const result = await parentService.getChildrenLibraryData(parent.id, schoolId)

      res.json({
        success: true,
        data: result
      })
    } catch (error: any) {
      console.error('Get children library error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch children library data'
      })
    }
  }
}
