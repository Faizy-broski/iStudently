import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { SchoolDashboardService } from '../services/school-dashboard.service'

const schoolDashboardService = new SchoolDashboardService()

export class SchoolDashboardController {
  /**
   * Get dashboard statistics for school admin
   * GET /api/school-dashboard/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = req.query.campus_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      // Use campus_id if provided, otherwise use admin's school_id
      const effectiveSchoolId = campus_id || schoolId

      const stats = await schoolDashboardService.getSchoolStats(effectiveSchoolId)

      return res.json({
        success: true,
        data: stats
      })
    } catch (error: any) {
      console.error('Get school dashboard stats error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch school dashboard statistics'
      })
    }
  }

  /**
   * Get attendance data for the last 7 days
   * GET /api/school-dashboard/attendance
   */
  async getAttendanceData(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = req.query.campus_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      const effectiveSchoolId = campus_id || schoolId

      const data = await schoolDashboardService.getAttendanceData(effectiveSchoolId)

      return res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get attendance data error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch attendance data'
      })
    }
  }

  /**
   * Get student growth data (monthly)
   * GET /api/school-dashboard/student-growth
   */
  async getStudentGrowth(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = req.query.campus_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      const effectiveSchoolId = campus_id || schoolId
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const data = await schoolDashboardService.getStudentGrowth(effectiveSchoolId, year)

      return res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get student growth error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch student growth data'
      })
    }
  }

  /**
   * Get grade-wise distribution
   * GET /api/school-dashboard/grade-distribution
   */
  async getGradeDistribution(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = req.query.campus_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      const effectiveSchoolId = campus_id || schoolId

      const data = await schoolDashboardService.getGradeDistribution(effectiveSchoolId)

      return res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get grade distribution error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch grade distribution'
      })
    }
  }
}
