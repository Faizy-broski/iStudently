import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { StudentDashboardService } from '../services/student-dashboard.service'

const dashboardService = new StudentDashboardService()

export class StudentDashboardController {
  /**
   * GET /api/student-dashboard/overview
   * Get student dashboard overview (At a Glance)
   * Returns: today's timetable, due assignments, recent feedback
   */
  async getDashboardOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const overview = await dashboardService.getDashboardOverview(studentId)

      res.json({
        success: true,
        data: overview
      })
    } catch (error: any) {
      console.error('Get dashboard overview error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch dashboard overview'
      })
    }
  }

  /**
   * GET /api/student-dashboard/timetable/today
   * Get today's timetable for the student
   */
  async getTodayTimetable(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const timetable = await dashboardService.getTodayTimetable(studentId)

      res.json({
        success: true,
        data: timetable
      })
    } catch (error: any) {
      console.error('Get today timetable error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch today\'s timetable'
      })
    }
  }

  /**
   * GET /api/student-dashboard/timetable/week
   * Get weekly timetable for the student
   */
  async getWeeklyTimetable(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const timetable = await dashboardService.getWeeklyTimetable(studentId)

      res.json({
        success: true,
        data: timetable
      })
    } catch (error: any) {
      console.error('Get weekly timetable error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch weekly timetable'
      })
    }
  }

  /**
   * GET /api/student-dashboard/assignments/due
   * Get assignments due soon (next 48 hours)
   */
  async getDueAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const assignments = await dashboardService.getDueAssignments(studentId)

      res.json({
        success: true,
        data: assignments
      })
    } catch (error: any) {
      console.error('Get due assignments error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch due assignments'
      })
    }
  }

  /**
   * GET /api/student-dashboard/assignments
   * Get all assignments with status filtering (to do, submitted, graded)
   */
  async getStudentAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id
      const { status } = req.query

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const assignments = await dashboardService.getStudentAssignments(
        studentId,
        status as string | undefined
      )

      res.json({
        success: true,
        data: assignments
      })
    } catch (error: any) {
      console.error('Get student assignments error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch assignments'
      })
    }
  }

  /**
   * GET /api/student-dashboard/feedback/recent
   * Get recent feedback/grades from teachers
   */
  async getRecentFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id
      const limit = parseInt(req.query.limit as string) || 5

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const feedback = await dashboardService.getRecentFeedback(studentId, limit)

      res.json({
        success: true,
        data: feedback
      })
    } catch (error: any) {
      console.error('Get recent feedback error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch recent feedback'
      })
    }
  }

  /**
   * GET /api/student-dashboard/attendance
   * Get student's attendance summary
   */
  async getAttendanceSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const attendance = await dashboardService.getAttendanceSummary(studentId)

      res.json({
        success: true,
        data: attendance
      })
    } catch (error: any) {
      console.error('Get attendance summary error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch attendance summary'
      })
    }
  }

  /**
   * GET /api/student-dashboard/attendance/subjects
   * Get subject-wise attendance breakdown
   */
  async getSubjectWiseAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const attendance = await dashboardService.getSubjectWiseAttendance(studentId)

      res.json({
        success: true,
        data: attendance
      })
    } catch (error: any) {
      console.error('Get subject-wise attendance error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch subject-wise attendance'
      })
    }
  }

  /**
   * GET /api/student-dashboard/attendance/detailed
   * Get detailed attendance records with date, period, and subject
   * Query params: ?month=1&year=2026
   */
  async getDetailedAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const month = req.query.month ? parseInt(req.query.month as string) : undefined
      const year = req.query.year ? parseInt(req.query.year as string) : undefined

      const attendance = await dashboardService.getDetailedAttendance(studentId, month, year)

      res.json({
        success: true,
        data: attendance
      })
    } catch (error: any) {
      console.error('Get detailed attendance error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch detailed attendance'
      })
    }
  }

  /**
   * GET /api/student-dashboard/exams/upcoming
   * Get upcoming exams for the student
   */
  async getUpcomingExams(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const exams = await dashboardService.getUpcomingExams(studentId)

      res.json({
        success: true,
        data: exams
      })
    } catch (error: any) {
      console.error('Get upcoming exams error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch upcoming exams'
      })
    }
  }

  /**
   * GET /api/student-dashboard/profile/id-card
   * Get student's digital ID card information
   */
  async getDigitalIdCard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = req.profile?.student_id

      if (!studentId) {
        res.status(403).json({
          success: false,
          error: 'No student profile found'
        })
        return
      }

      const idCard = await dashboardService.getDigitalIdCard(studentId)

      res.json({
        success: true,
        data: idCard
      })
    } catch (error: any) {
      console.error('Get digital ID card error:', error)
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch digital ID card'
      })
    }
  }
}
