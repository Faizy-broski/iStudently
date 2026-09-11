import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { StudentService } from '../services/student.service'
import { CreateStudentDTO, UpdateStudentDTO } from '../types'
import { getEffectiveSchoolId } from '../utils/campus-validation'
import { stripConfidentialFamilyStatus, canWriteConfidentialFamilyStatus, VALID_CONFIDENTIAL_STATUSES } from '../utils/confidential-family-status'

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
      const gradeLevelParam = req.query.grade_level
      const campusId = req.query.campus_id as string
      const sectionIdParam = req.query.section_id
      const isActiveParam = req.query.is_active as string | undefined
      const isActive = isActiveParam === undefined ? undefined : isActiveParam === 'true'
      const VALID_SORT_KEYS = ['student_number', 'name', 'grade', 'status', 'contact'] as const
      const sortKeyParam = req.query.sort_key as string | undefined
      const sortKey = (VALID_SORT_KEYS as readonly string[]).includes(sortKeyParam || '')
        ? (sortKeyParam as typeof VALID_SORT_KEYS[number])
        : 'name'
      const sortDir = req.query.sort_dir === 'desc' ? 'desc' : 'asc'

      const gradeLevels = Array.isArray(gradeLevelParam)
        ? (gradeLevelParam as string[])
        : gradeLevelParam
          ? String(gradeLevelParam).split(',').map((value) => value.trim()).filter(Boolean)
          : undefined

      const sectionIds = Array.isArray(sectionIdParam)
        ? (sectionIdParam as string[])
        : sectionIdParam
          ? String(sectionIdParam).split(',').map((value) => value.trim()).filter(Boolean)
          : undefined

      // Use campus_id if provided and not empty, otherwise use admin's school_id
      const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : schoolId

      const result = await studentService.getStudents(
        effectiveSchoolId,
        page,
        limit,
        search,
        gradeLevels,
        sectionIds,
        isActive,
        sortKey,
        sortDir
      )

      const sanitizedStudents = stripConfidentialFamilyStatus(result.students, req.profile?.role)

      res.json({
        success: true,
        data: sanitizedStudents,
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
        data: stripConfidentialFamilyStatus(result.students, req.profile?.role),
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
        return
      }

      // Enforce self/linked-record ownership for student and parent callers
      const role = req.profile?.role
      const callerProfileId = req.profile?.id
      const callerStudentId = req.profile?.student_id

      if (role === 'student') {
        const isSelf = (callerStudentId && callerStudentId === student.id) ||
                       (student.profile_id && student.profile_id === callerProfileId) ||
                       (callerProfileId && callerProfileId === student.id)
        if (!isSelf) {
          res.status(403).json({
            success: false,
            error: 'Forbidden: You can only view your own student record'
          })
          return
        }
      } else if (role === 'parent') {
        const isLinkedChild = (student as any).parent_links?.some(
          (link: any) => link.parent?.profile?.id === callerProfileId || link.parent?.profile_id === callerProfileId
        )
        if (!isLinkedChild) {
          res.status(403).json({
            success: false,
            error: 'Forbidden: You can only view your linked children records'
          })
          return
        }
      }

      res.json({
        success: true,
        data: stripConfidentialFamilyStatus(student, role)
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
        data: stripConfidentialFamilyStatus(student, req.profile?.role)
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
      const isSuperAdmin = req.profile?.role === 'super_admin'
      const headerSchoolId = (req.headers['x-school-id'] as string) || (req.headers['school_id'] as string)
      const adminSchoolId = req.profile?.school_id || req.profile?.impersonating_school_id || headerSchoolId || req.body.school_id || req.body.campus_id

      let effectiveSchoolId = req.body.campus_id || req.body.school_id || headerSchoolId || adminSchoolId

      if (!isSuperAdmin && adminSchoolId) {
        effectiveSchoolId = await getEffectiveSchoolId(
          adminSchoolId,
          req.body.campus_id || req.body.school_id
        )
      }

      if (!effectiveSchoolId) {
        res.status(400).json({
          success: false,
          error: 'School ID is required'
        })
        return
      }

      const studentData: CreateStudentDTO = {
        ...req.body,
        school_id: effectiveSchoolId
      }

      const student = await studentService.createStudent(studentData)

      res.status(201).json({
        success: true,
        data: stripConfidentialFamilyStatus(student, req.profile?.role),
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
        return
      }

      if (error.message.includes('required')) {
        res.status(400).json({
          success: false,
          error: error.message
        })
        return
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

      const updateData = req.body
      const callerRole = req.profile?.role
      const student = await studentService.updateStudent(studentId, effectiveSchoolId, updateData, callerRole)

      res.json({
        success: true,
        data: stripConfidentialFamilyStatus(student, callerRole),
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

      if (error.message.includes('required')) {
        res.status(400).json({
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
        return
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
        data: stripConfidentialFamilyStatus(students, req.profile?.role)
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
   * Download a CSV template for student bulk import
   * GET /api/students/import-template
   * Requires: admin role
   */
  async getImportTemplate(_req: AuthRequest, res: Response): Promise<void> {
    const headers = [
      'first_name', 'father_name', 'grandfather_name', 'last_name',
      'email', 'phone', 'gender', 'date_of_birth', 'national_id'
    ]
    const example = [
      'John', 'Robert', 'James', 'Smith',
      'john.smith@school.com', '+1234567890', 'male', '2012-05-14', 'A123456789'
    ]
    const csv = [headers.join(','), example.join(',')].join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"')
    res.send(csv)
  }

  /**
   * Bulk import students from a parsed CSV/Excel payload
   * POST /api/students/bulk-import
   * Requires: admin role
   * Body: { students: Record<string,any>[], campus_id?: string }
   */
  async bulkImportStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id

      if (!adminSchoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { students, campus_id, grade_level_id, section_id } = req.body

      if (!Array.isArray(students) || students.length === 0) {
        res.status(400).json({ success: false, error: 'students array is required and must not be empty' })
        return
      }

      if (students.length > 500) {
        res.status(400).json({ success: false, error: 'Maximum 500 students per import batch' })
        return
      }

      // grade_level_id is required either as a single uniform target (Single
      // Class mode) OR on every individual row (Whole School mode, resolved
      // client-side from the file's own Grade Level column).
      if (!grade_level_id && !students.every((s: any) => s.grade_level_id)) {
        res.status(400).json({ success: false, error: 'grade_level_id is required' })
        return
      }

      const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
      const result = await studentService.bulkImportStudents(students, effectiveSchoolId, { grade_level_id, section_id })

      res.status(200).json({
        success: true,
        data: result,
        message: `Imported ${result.success_count} student(s) with ${result.error_count} error(s)`
      })
    } catch (error: any) {
      console.error('Bulk import students error:', error)
      res.status(500).json({ success: false, error: error.message || 'Bulk import failed' })
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

  /**
   * Bulk delete students by explicit IDs and/or grade/section filter
   * POST /api/students/bulk-delete
   * Requires: super_admin role only
   * Body: { student_ids?: string[], grade_level_id?: string, section_id?: string, campus_id?: string }
   */
  async bulkDeleteStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id

      if (!adminSchoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { student_ids, grade_level_id, section_id, campus_id } = req.body

      if ((!student_ids || student_ids.length === 0) && !grade_level_id) {
        res.status(400).json({ success: false, error: 'Provide student_ids and/or grade_level_id to select students to delete' })
        return
      }

      const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
      const result = await studentService.bulkDeleteStudents(effectiveSchoolId, { student_ids, grade_level_id, section_id })

      res.json({
        success: true,
        data: result,
        message: `Deleted ${result.deleted} student(s)`
      })
    } catch (error: any) {
      console.error('Bulk delete students error:', error)
      res.status(500).json({ success: false, error: error.message || 'Bulk delete failed' })
    }
  }

  /**
   * Bulk activate or deactivate students across selected IDs, grade level, or whole school
   * POST /api/students/bulk-status
   * Requires: admin role
   * Body: { mode: 'selected' | 'grade' | 'school', is_active: boolean, student_ids?: string[], grade_level_id?: string, section_id?: string, campus_id?: string }
   */
  async bulkUpdateStudentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id

      if (!adminSchoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { mode, is_active, student_ids, grade_level_id, section_id, campus_id } = req.body

      if (is_active === undefined || !mode) {
        res.status(400).json({ success: false, error: 'mode and is_active parameters are required' })
        return
      }

      const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
      const result = await studentService.bulkUpdateStudentStatus(effectiveSchoolId, {
        mode,
        is_active: Boolean(is_active),
        student_ids,
        grade_level_id,
        section_id
      })

      res.json({
        success: true,
        data: result,
        message: `${result.updated} student(s) ${is_active ? 'activated' : 'deactivated'} successfully`
      })
    } catch (error: any) {
      console.error('Bulk update student status error:', error)
      res.status(500).json({ success: false, error: error.message || 'Bulk update status failed' })
    }
  }

  /**
   * Group Assign: apply grade level / section / active status / custom fields
   * to a selected group of students in one action. Any field omitted is left
   * untouched on every selected student.
   * POST /api/students/group-assign
   * Requires: admin role
   * Body: { student_ids: string[], grade_level_id?: string, section_id?: string,
   *         is_active?: boolean, confidential_family_status?: string,
   *         custom_field_updates?: {category_id, field_key, value}[], campus_id?: string }
   */
  async groupAssignStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const adminSchoolId = req.profile?.school_id
      const callerRole = req.profile?.role

      if (!adminSchoolId) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const { student_ids, grade_level_id, section_id, is_active, confidential_family_status, custom_field_updates, campus_id } = req.body

      if (!Array.isArray(student_ids) || student_ids.length === 0) {
        res.status(400).json({ success: false, error: 'student_ids is required and must be a non-empty array' })
        return
      }

      const hasCustomFieldUpdates = Array.isArray(custom_field_updates) && custom_field_updates.length > 0
      if (grade_level_id === undefined && is_active === undefined && confidential_family_status === undefined && !hasCustomFieldUpdates) {
        res.status(400).json({ success: false, error: 'Provide at least one field to assign (grade_level_id, is_active, confidential_family_status, or custom_field_updates)' })
        return
      }

      // Same restricted-write check as the single-student endpoint — group
      // assign must not become a back door for a role that can't write this
      // field one at a time (route is admin-only today, so this is
      // currently always true, but the check travels with the field rather
      // than relying on the route staying admin-only forever).
      if (confidential_family_status !== undefined && !canWriteConfidentialFamilyStatus(callerRole)) {
        res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions to update confidential family status' })
        return
      }
      if (confidential_family_status !== undefined && !VALID_CONFIDENTIAL_STATUSES.includes(confidential_family_status)) {
        res.status(400).json({ success: false, error: `Invalid confidential_family_status. Must be one of: ${VALID_CONFIDENTIAL_STATUSES.join(', ')}` })
        return
      }

      const effectiveSchoolId = await getEffectiveSchoolId(adminSchoolId, campus_id)
      const result = await studentService.groupAssignStudents(effectiveSchoolId, {
        student_ids,
        grade_level_id,
        section_id,
        is_active: is_active === undefined ? undefined : Boolean(is_active),
        confidential_family_status,
        custom_field_updates
      })

      res.json({
        success: true,
        data: result,
        message: result.errors.length > 0
          ? `${result.updated} student(s) updated, ${result.errors.length} failed`
          : `${result.updated} student(s) updated successfully`
      })
    } catch (error: any) {
      console.error('Group assign students error:', error)
      res.status(500).json({ success: false, error: error.message || 'Group assign failed' })
    }
  }

  /**
   * Update student's confidential family status
   * PATCH /api/students/:id/confidential-status
   * Requires: admin, super_admin, or counselor role
   */
  async updateConfidentialFamilyStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const studentId = req.params.id
      const campusId = req.query.campus_id as string
      const callerRole = req.profile?.role
      const { status } = req.body

      if (!schoolId) {
        res.status(403).json({
          success: false,
          error: 'No school associated with your account'
        })
        return
      }

      // Use campus_id if provided, otherwise use school_id — same resolution
      // as updateStudent above. Without this, a network admin whose
      // profile.school_id is the root school (not the campus the student
      // actually belongs to) fails checkStudentOwnership and gets a false
      // "Student not found or does not belong to this school".
      const effectiveSchoolId = (campusId && campusId.trim() !== '') ? campusId : schoolId

      if (!canWriteConfidentialFamilyStatus(callerRole)) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: Insufficient permissions to update confidential family status'
        })
        return
      }

      if (!status || !VALID_CONFIDENTIAL_STATUSES.includes(status)) {
        res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${VALID_CONFIDENTIAL_STATUSES.join(', ')}`
        })
        return
      }

      const student = await studentService.updateStudent(
        studentId,
        effectiveSchoolId,
        { confidential_family_status: status },
        callerRole
      )

      res.json({
        success: true,
        data: stripConfidentialFamilyStatus(student, callerRole),
        message: 'Confidential family status updated successfully'
      })
    } catch (error: any) {
      console.error('Update confidential family status error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update confidential family status'
      })
    }
  }
}
