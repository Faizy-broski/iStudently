import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { StudentDashboardService } from '../services/student-dashboard.service'

const dashboardService = new StudentDashboardService()

export class StudentDashboardController {
  private getStudentId(req: AuthRequest): string | undefined {
    if (!req.profile) return undefined
    const role = typeof req.profile.role === 'string' ? req.profile.role.toLowerCase() : ''
    if (role !== 'student') return undefined
    return req.profile.student_id || req.profile.id
  }

  private sendMissingStudentProfile(res: Response): void {
    res.status(403).json({
      success: false,
      error: 'No student profile found'
    })
  }

  /**
   * GET /api/student-dashboard/overview
   * Get student dashboard overview (At a Glance)
   * Returns: today's timetable, due assignments, recent feedback
   */
  async getDashboardOverview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)
      const { status } = req.query

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)
      const limit = parseInt(req.query.limit as string) || 5

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
   * Query params: ?month=2026-01 (optional, defaults to current month)
   */
  async getSubjectWiseAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      const month = req.query.month as string | undefined

      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }

      const attendance = await dashboardService.getSubjectWiseAttendance(studentId, month)

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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
   * GET /api/student-dashboard/grades
   * Get all grades for the logged-in student, grouped by subject/course-period
   */
  async getStudentGrades(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const data = await dashboardService.getStudentGrades(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch grades' })
    }
  }

  /**
   * GET /api/student-dashboard/report-card
   * Get the student's report card summary (subject averages + comments)
   * Query params: ?marking_period_id=xxx (optional)
   */
  async getStudentReportCard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const markingPeriodId = req.query.marking_period_id as string | undefined
      const data = await dashboardService.getStudentReportCard(studentId, markingPeriodId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch report card' })
    }
  }

  /**
   * GET /api/student-dashboard/discipline
   * Get logged-in student's own discipline referrals
   */
  async getStudentDiscipline(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const data = await dashboardService.getStudentDisciplineReferrals(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch discipline referrals' })
    }
  }

  /**
   * GET /api/student-dashboard/activities
   * Get activities the logged-in student is enrolled in
   */
  async getStudentActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const data = await dashboardService.getStudentEnrolledActivities(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch activities' })
    }
  }

  /**
   * GET /api/student-dashboard/hostel
   * Get student's hostel room assignment
   */
  async getHostelAssignment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const data = await dashboardService.getHostelAssignment(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch hostel assignment' })
    }
  }

  /**
   * GET /api/student-dashboard/class-diary
   * Get class diary entries for student's section
   */
  async getClassDiary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) {
        this.sendMissingStudentProfile(res)
        return
      }
      const data = await dashboardService.getClassDiaryEntries(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch class diary' })
    }
  }

  async getStudentFees(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentFees(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch fees' })
    }
  }

  async getStudentPaymentHistory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentPaymentHistory(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch payments' })
    }
  }

  async getStudentCourses(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentCourses(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch courses' })
    }
  }

  async getStudentFinalGrades(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentFinalGrades(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch final grades' })
    }
  }

  async getStudentGpaRank(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentGpaRank(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch GPA/rank' })
    }
  }

  /**
   * GET /api/student-dashboard/scheduling/class-pictures
   */
  async getClassPictures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const data = await dashboardService.getStudentClassPictures(studentId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch class pictures' })
    }
  }

  /**
   * GET /api/student-dashboard/scheduling/lesson-plans
   */
  async getLessonPlans(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const coursePeriodId = req.query.course_period_id as string | undefined
      const data = await dashboardService.getStudentLessonPlans(studentId, coursePeriodId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch lesson plans' })
    }
  }

  /**
   * GET /api/student-dashboard/info
   * Get comprehensive student info (General Info + Addresses & Contacts)
   */
  async getStudentInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)
      if (!studentId) { this.sendMissingStudentProfile(res); return }
      const info = await dashboardService.getStudentInfo(studentId)
      res.json({ success: true, data: info })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch student info' })
    }
  }

  /**
   * GET /api/student-dashboard/profile/id-card
   * Get student's digital ID card information
   */
  async getDigitalIdCard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentId = this.getStudentId(req)

      if (!studentId) {
        this.sendMissingStudentProfile(res)
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
