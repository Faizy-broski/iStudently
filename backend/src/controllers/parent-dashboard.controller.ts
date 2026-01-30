import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { parentDashboardService } from '../services/parent-dashboard.service'
import { supabase } from '../config/supabase'

export class ParentDashboardController {
  /**
   * Helper method to get parent ID from profile ID
   */
  private async getParentId(profileId: string): Promise<string | null> {
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('profile_id', profileId)
      .single()
    
    return parent?.id || null
  }
  /**
   * GET /api/parent-dashboard/students
   * Get list of all children for logged-in parent
   */
  async getStudents(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      // First, get the parent ID from the parents table using profile_id
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .select('id')
        .eq('profile_id', profileId)
        .single()

      if (parentError || !parent) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      const students = await parentDashboardService.getStudentsList(parent.id)

      return res.json({
        success: true,
        data: students
      })
    } catch (error: any) {
      console.error('Error fetching parent students:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch students'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/dashboard/:studentId
   * Get consolidated dashboard data for a specific student
   */
  async getDashboardData(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID is required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      const dashboardData = await parentDashboardService.getDashboardData(parentId, studentId)

      return res.json({
        success: true,
        data: dashboardData
      })
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard data'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/attendance/:studentId/today
   * Get today's attendance for a student
   */
  async getAttendanceToday(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const attendance = await parentDashboardService.getAttendanceToday(studentId)

      return res.json({
        success: true,
        data: attendance
      })
    } catch (error: any) {
      console.error('Error fetching attendance:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch attendance'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/attendance/:studentId/history
   * Get attendance history for a student
   */
  async getAttendanceHistory(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params
      const days = parseInt(req.query.days as string) || 30

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const history = await parentDashboardService.getAttendanceHistory(studentId, days)

      return res.json({
        success: true,
        data: history
      })
    } catch (error: any) {
      console.error('Error fetching attendance history:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch attendance history'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/fees/:studentId/status
   * Get fee status for a student
   */
  async getFeeStatus(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const feeStatus = await parentDashboardService.getFeeStatus(studentId)

      return res.json({
        success: true,
        data: feeStatus
      })
    } catch (error: any) {
      console.error('Error fetching fee status:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch fee status'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/exams/:studentId/upcoming
   * Get upcoming exams for a student
   */
  async getUpcomingExams(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params
      const limit = parseInt(req.query.limit as string) || 5

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const exams = await parentDashboardService.getUpcomingExams(studentId, limit)

      return res.json({
        success: true,
        data: exams
      })
    } catch (error: any) {
      console.error('Error fetching upcoming exams:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch exams'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/grades/:studentId/recent
   * Get recent grades for a student
   */
  async getRecentGrades(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params
      const limit = parseInt(req.query.limit as string) || 5

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const grades = await parentDashboardService.getRecentGrades(studentId, limit)

      return res.json({
        success: true,
        data: grades
      })
    } catch (error: any) {
      console.error('Error fetching recent grades:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch grades'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/gradebook/:studentId
   * Get complete gradebook for a student
   */
  async getGradebook(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const gradebook = await parentDashboardService.getGradebook(studentId)

      return res.json({
        success: true,
        data: gradebook
      })
    } catch (error: any) {
      console.error('Error fetching gradebook:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch gradebook'
      })
    }
  }

  /**
   * GET /api/parent-dashboard/homework/:studentId
   * Get homework/assignments for a student
   */
  async getHomework(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { studentId } = req.params
      const days = parseInt(req.query.days as string) || 7

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: 'Parent authentication required'
        })
      }

      const parentId = await this.getParentId(profileId)
      if (!parentId) {
        return res.status(404).json({
          success: false,
          error: 'Parent record not found'
        })
      }

      // Verify parent owns this student
      const students = await parentDashboardService.getStudentsList(parentId)
      if (!students.find(s => s.id === studentId)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this student'
        })
      }

      const homework = await parentDashboardService.getHomeworkDiary(studentId, days)

      return res.json({
        success: true,
        data: homework
      })
    } catch (error: any) {
      console.error('Error fetching homework:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch homework'
      })
    }
  }
}

export const parentDashboardController = new ParentDashboardController()
