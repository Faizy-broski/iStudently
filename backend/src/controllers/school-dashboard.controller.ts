import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { SchoolDashboardService } from '../services/school-dashboard.service'
import { resolveSchoolId } from '../utils/campus-validation'

const schoolDashboardService = new SchoolDashboardService()

/**
 * ?campus_id must be the caller's own school or one of its campuses (was trusted as-is, so any
 * school's dashboard could be read). Sends 403 and returns null when it isn't.
 */
async function allowedCampusId(req: AuthRequest, res: Response): Promise<string | undefined | null> {
  const requested = (req.query.campus_id as string) || undefined
  if (!requested) return undefined
  const resolved = await resolveSchoolId(req, requested)
  if (resolved.error) {
    res.status(resolved.status ?? 403).json({ success: false, error: resolved.error })
    return null
  }
  return resolved.schoolId ?? undefined
}

export class SchoolDashboardController {
  /**
   * Get dashboard statistics for school admin
   * GET /api/school-dashboard/stats
   */
  async getStats(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = await allowedCampusId(req, res)
      if (campus_id === null) return res
      const academic_year_id = req.query.academic_year_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      const stats = await schoolDashboardService.getSchoolStats(schoolId, campus_id || undefined, academic_year_id || undefined)

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
      const campus_id = await allowedCampusId(req, res)
      if (campus_id === null) return res

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
      const campus_id = await allowedCampusId(req, res)
      if (campus_id === null) return res

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
      const campus_id = await allowedCampusId(req, res)
      if (campus_id === null) return res

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

  /**
   * Get student counts per class (grade + section)
   * GET /api/school-dashboard/class-breakdown
   */
  async getClassBreakdown(req: AuthRequest, res: Response): Promise<Response> {
    try {
      const schoolId = req.profile?.school_id
      const campus_id = await allowedCampusId(req, res)
      if (campus_id === null) return res
      const academic_year_id = req.query.academic_year_id as string

      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID not found'
        })
      }

      const data = await schoolDashboardService.getClassBreakdown(schoolId, campus_id || undefined, academic_year_id || undefined)

      return res.json({
        success: true,
        data
      })
    } catch (error: any) {
      console.error('Get class breakdown error:', error)
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch class breakdown'
      })
    }
  }
}
