import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as schedulingService from '../services/scheduling.service'
import type {
  EnrollStudentDTO,
  DropStudentDTO,
  MassEnrollDTO,
  MassDropDTO,
  SetTeacherAvailabilityDTO,
  UpdateCoursePeriodSchedulingDTO,
} from '../types/scheduling.types'

// ============================================================================
// SCHEDULING CONTROLLER
// ============================================================================

// ── Student Enrollment ──────────────────────────────────────────────────

export const enrollStudent = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: EnrollStudentDTO = req.body

    const result = await schedulingService.enrollStudent(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const dropStudent = async (req: Request, res: Response) => {
  try {
    const dto: DropStudentDTO = req.body
    const result = await schedulingService.dropStudent(dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const massEnroll = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const userId = (req as AuthRequest).user?.id
    const dto: MassEnrollDTO = req.body

    const result = await schedulingService.massEnroll(schoolId, dto, userId)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const massDrop = async (req: Request, res: Response) => {
  try {
    const dto: MassDropDTO = req.body
    const result = await schedulingService.massDrop(dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Student Schedule ────────────────────────────────────────────────────

export const getStudentSchedule = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const result = await schedulingService.getStudentSchedule(studentId, academicYearId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getStudentScheduleHistory = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params
    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const result = await schedulingService.getStudentScheduleHistory(studentId, academicYearId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Class List ──────────────────────────────────────────────────────────

export const getClassList = async (req: Request, res: Response) => {
  try {
    const { coursePeriodId } = req.params
    const result = await schedulingService.getClassList(coursePeriodId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Course Period Scheduling Fields ─────────────────────────────────────

export const updateCoursePeriodScheduling = async (req: Request, res: Response) => {
  try {
    const { coursePeriodId } = req.params
    const dto: UpdateCoursePeriodSchedulingDTO = req.body

    const result = await schedulingService.updateCoursePeriodScheduling(coursePeriodId, dto)
    if (!result.success) return res.status(400).json(result)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Conflict Check ──────────────────────────────────────────────────────

export const checkConflicts = async (req: Request, res: Response) => {
  try {
    const studentId = req.query.student_id as string
    const coursePeriodId = req.query.course_period_id as string
    const academicYearId = req.query.academic_year_id as string

    if (!studentId || !coursePeriodId || !academicYearId) {
      return res.status(400).json({ success: false, error: 'student_id, course_period_id, academic_year_id required' })
    }

    const result = await schedulingService.checkConflicts(studentId, coursePeriodId, academicYearId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Add/Drop Log ────────────────────────────────────────────────────────

export const getAddDropLog = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const startDate = req.query.start_date as string | undefined
    const endDate = req.query.end_date as string | undefined
    const campusId = req.query.campus_id as string | undefined

    const result = await schedulingService.getAddDropLog(schoolId, academicYearId, startDate, endDate, campusId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Teacher Availability ────────────────────────────────────────────────

export const getTeacherAvailability = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params
    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const result = await schedulingService.getTeacherAvailability(teacherId, academicYearId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const setTeacherAvailability = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const campusId = req.query.campus_id as string | undefined
    const dto: SetTeacherAvailabilityDTO = req.body

    const result = await schedulingService.setTeacherAvailability(schoolId, dto, campusId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const getAvailableTeachersForSlot = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const academicYearId = req.query.academic_year_id as string
    const dayOfWeek = parseInt(req.query.day_of_week as string)
    const periodId = req.query.period_id as string
    const campusId = req.query.campus_id as string | undefined

    if (!academicYearId || isNaN(dayOfWeek) || !periodId) {
      return res.status(400).json({ success: false, error: 'academic_year_id, day_of_week, period_id required' })
    }

    const result = await schedulingService.getAvailableTeachersForSlot(schoolId, academicYearId, dayOfWeek, periodId, campusId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Scheduling Dashboard Stats (mirrors RosarioSIS Dashboard.inc.php) ──

export const getSchedulingDashboardStats = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) return res.status(400).json({ success: false, error: 'school_id required' })

    const academicYearId = req.query.academic_year_id as string
    if (!academicYearId) return res.status(400).json({ success: false, error: 'academic_year_id required' })

    const markingPeriodId = req.query.marking_period_id as string | undefined
    const result = await schedulingService.getSchedulingDashboardStats(schoolId, academicYearId, markingPeriodId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

// ── Course Period School Periods (multi-period M2M) ──

export const getCoursePeriodSchoolPeriods = async (req: Request, res: Response) => {
  try {
    const { coursePeriodId } = req.params
    const result = await schedulingService.getCoursePeriodSchoolPeriods(coursePeriodId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}

export const setCoursePeriodSchoolPeriods = async (req: Request, res: Response) => {
  try {
    const { coursePeriodId } = req.params
    const { period_ids, days } = req.body

    if (!Array.isArray(period_ids)) {
      return res.status(400).json({ success: false, error: 'period_ids must be an array' })
    }

    const result = await schedulingService.setCoursePeriodSchoolPeriods(coursePeriodId, period_ids, days)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
}
