import { Request, Response } from 'express'
import * as codesService from '../services/attendance-codes.service'
import * as calendarService from '../services/attendance-calendar.service'
import * as adminService from '../services/attendance-admin.service'
import * as exportService from '../services/attendance-export.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
  }
}

// ============================================================================
// ATTENDANCE CODES (SETUP > Attendance Codes)
// ============================================================================

export const getAttendanceCodes = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const includeInactive = req.query.include_inactive === 'true'
    const campusId = req.query.campus_id as string | undefined

    const result = await codesService.getAttendanceCodes(schoolId, campusId, includeInactive)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getAttendanceCodeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await codesService.getAttendanceCodeById(id)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const createAttendanceCode = async (req: AuthRequest, res: Response) => {
  try {
    const dto = {
      ...req.body,
      school_id: req.body.school_id || req.profile?.school_id
    }

    if (!dto.school_id || !dto.title || !dto.short_name || !dto.state_code) {
      return res.status(400).json({
        data: null,
        error: 'school_id, title, short_name, and state_code are required'
      })
    }

    if (!['P', 'A', 'H'].includes(dto.state_code)) {
      return res.status(400).json({
        data: null,
        error: 'state_code must be P, A, or H'
      })
    }

    const result = await codesService.createAttendanceCode(dto)
    res.status(201).json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const updateAttendanceCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const dto = req.body

    if (dto.state_code && !['P', 'A', 'H'].includes(dto.state_code)) {
      return res.status(400).json({
        data: null,
        error: 'state_code must be P, A, or H'
      })
    }

    const result = await codesService.updateAttendanceCode(id, dto)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const deleteAttendanceCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await codesService.deleteAttendanceCode(id)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// ATTENDANCE CALENDAR (Administration)
// ============================================================================

export const getCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await calendarService.getCalendar(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const generateCalendar = async (req: AuthRequest, res: Response) => {
  try {
    const dto = {
      school_id: req.body.school_id || req.profile?.school_id,
      academic_year_id: req.body.academic_year_id,
      campus_id: req.body.campus_id
    }

    if (!dto.school_id || !dto.academic_year_id) {
      return res.status(400).json({
        data: null,
        error: 'school_id and academic_year_id are required'
      })
    }

    const result = await calendarService.generateCalendar(dto)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const updateCalendarDay = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await calendarService.updateCalendarDay(id, req.body)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const bulkUpdateCalendarDays = async (req: Request, res: Response) => {
  try {
    const { day_ids, ...updates } = req.body
    if (!day_ids || !Array.isArray(day_ids) || day_ids.length === 0) {
      return res.status(400).json({ data: null, error: 'day_ids array is required' })
    }

    const result = await calendarService.bulkUpdateCalendarDays(day_ids, updates)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getSchoolDayCount = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await calendarService.getSchoolDayCount(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// ADD ABSENCES (Administration > Add Absences)
// ============================================================================

export const addAbsences = async (req: AuthRequest, res: Response) => {
  try {
    const dto = {
      ...req.body,
      school_id: req.body.school_id || req.profile?.school_id,
      override_by: req.profile?.id
    }

    if (!dto.school_id || !dto.student_ids || !dto.attendance_date ||
        !dto.period_ids || !dto.attendance_code_id) {
      return res.status(400).json({
        data: null,
        error: 'school_id, student_ids, attendance_date, period_ids, and attendance_code_id are required'
      })
    }

    const result = await adminService.addAbsences(dto)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const overrideAttendanceRecord = async (req: AuthRequest, res: Response) => {
  try {
    const dto = {
      ...req.body,
      override_by: req.profile?.id
    }

    if (!dto.attendance_record_id || !dto.attendance_code_id || !dto.override_reason) {
      return res.status(400).json({
        data: null,
        error: 'attendance_record_id, attendance_code_id, and override_reason are required'
      })
    }

    const result = await adminService.overrideAttendanceRecord(dto)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// REPORTS
// ============================================================================

export const getTeacherCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0]
    const campusId = req.query.campus_id as string | undefined
    const periodFilter = req.query.period_id as string | undefined

    const result = await adminService.getTeacherCompletion(schoolId, date, campusId, periodFilter)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getAverageDailyAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id, grade_id, section_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.getAverageDailyAttendance(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined,
      grade_id as string | undefined,
      section_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getADAByGrade = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.getADAByGrade(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getDailySummaryGrid = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id, filter_mode, grade_id, section_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.getDailySummaryGrid(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined,
      (filter_mode as string) || 'daily',
      grade_id as string | undefined,
      section_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getAttendanceChart = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id, group_by } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.getAttendanceChart(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined,
      (group_by as 'day' | 'week' | 'month') || 'day'
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getAttendanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id, grade_id, section_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.getAttendanceSummary(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined,
      grade_id as string | undefined,
      section_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// PRINT ATTENDANCE SHEETS (REPORTS > Print Attendance Sheets)
// ============================================================================

export const printAttendanceSheets = async (req: AuthRequest, res: Response) => {
  try {
    const params = {
      school_id: (req.query.school_id as string) || req.profile?.school_id || '',
      campus_id: req.query.campus_id as string | undefined,
      section_id: req.query.section_id as string | undefined,
      grade_id: req.query.grade_id as string | undefined,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      include_data: req.query.include_data !== 'false'
    }

    if (!params.school_id || !params.start_date || !params.end_date) {
      return res.status(400).json({
        data: null,
        error: 'school_id, start_date, and end_date are required'
      })
    }

    const { buffer, filename } = await exportService.generateAttendanceSheet(params)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const exportAttendanceSummary = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id, grade_id, section_id } = req.query
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    // Get summary data
    const { data: summaryData, error } = await adminService.getAttendanceSummary(
      schoolId,
      start_date as string,
      end_date as string,
      campus_id as string | undefined,
      grade_id as string | undefined,
      section_id as string | undefined
    )

    if (error || !summaryData) {
      return res.status(500).json({ data: null, error: error || 'No data' })
    }

    // Get school name
    const { data: school } = await (await import('../config/supabase')).supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()

    const { buffer, filename } = await exportService.generateAttendanceSummarySheet(
      summaryData,
      school?.name || 'School',
      { start: start_date as string, end: end_date as string }
    )

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

export const recalculateDailyAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { start_date, end_date, campus_id } = req.body
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    const result = await adminService.recalculateDailyAttendance(
      schoolId, start_date, end_date, campus_id
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const findDuplicateAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const result = await adminService.findDuplicateAttendance(
      schoolId,
      req.query.start_date as string | undefined,
      req.query.end_date as string | undefined,
      req.query.campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const deleteDuplicateAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const result = await adminService.deleteDuplicateAttendance(
      schoolId,
      req.body.start_date,
      req.body.end_date,
      req.body.campus_id
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// ADMINISTRATION (Admin attendance view + drill-down)
// ============================================================================

export const getAdminAttendanceView = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0]

    const result = await adminService.getAdminAttendanceView(
      schoolId,
      date,
      req.query.section_id as string | undefined,
      req.query.grade_id as string | undefined,
      req.query.campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getAdminPeriodGrid = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0]

    const result = await adminService.getAdminPeriodGrid(
      schoolId,
      date,
      req.query.section_id as string | undefined,
      req.query.grade_id as string | undefined,
      req.query.campus_id as string | undefined
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const bulkOverrideAttendanceRecords = async (req: AuthRequest, res: Response) => {
  try {
    const { changes } = req.body
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ data: null, error: 'changes array is required' })
    }

    const overrideBy = req.profile?.id || ''
    const result = await adminService.bulkOverrideAttendanceRecords(changes, overrideBy)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const updateDailyComment = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { student_id, date, comment } = req.body
    if (!student_id || !date) {
      return res.status(400).json({ data: null, error: 'student_id and date are required' })
    }

    const result = await adminService.updateDailyComment(schoolId, student_id, date, comment || '')
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const getStudentPeriodAttendance = async (req: Request, res: Response) => {
  try {
    const { student_id } = req.params
    const date = req.query.date as string

    if (!date) {
      return res.status(400).json({ data: null, error: 'date query parameter is required' })
    }

    const result = await adminService.getStudentPeriodAttendance(student_id, date)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// ATTENDANCE COMPLETION (Teacher marks completion)
// ============================================================================

export const markAttendanceCompleted = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { staff_id, school_date, period_id, table_name } = req.body
    const resolvedStaffId = staff_id || req.profile?.id

    if (!resolvedStaffId || !school_date || !period_id) {
      return res.status(400).json({
        data: null,
        error: 'staff_id (or auth), school_date, and period_id are required'
      })
    }

    const result = await adminService.markAttendanceCompleted(
      schoolId, resolvedStaffId, school_date, period_id, table_name || 0, req.body.campus_id
    )
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

// ============================================================================
// COURSE PERIOD SHEETS (RosarioSIS PrintAttendanceSheets)
// ============================================================================

export const getCoursePeriods = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const campusId = req.query.campus_id as string | undefined
    const result = await adminService.getCoursePeriods(schoolId, campusId)
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}

export const downloadCoursePeriodSheets = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'School ID required' })

    const { course_period_ids, start_date, end_date, campus_id, include_inactive } = req.body

    if (!course_period_ids || !Array.isArray(course_period_ids) || course_period_ids.length === 0) {
      return res.status(400).json({ data: null, error: 'course_period_ids array required' })
    }
    if (!start_date || !end_date) {
      return res.status(400).json({ data: null, error: 'start_date and end_date are required' })
    }

    // Fetch the course periods list, then filter to selected IDs
    const { data: allPeriods, error } = await adminService.getCoursePeriods(schoolId, campus_id)
    if (error || !allPeriods) {
      return res.status(500).json({ data: null, error: error || 'Failed to fetch course periods' })
    }

    const selected = allPeriods.filter((cp: any) => course_period_ids.includes(cp.id))
    if (selected.length === 0) {
      return res.status(400).json({ data: null, error: 'No matching course periods found' })
    }

    const inputs = selected.map((cp: any) => ({
      timetable_entry_id: cp.id,
      section_id: cp.section_id,
      period_id: cp.period_id,
      teacher_id: cp.teacher_id,
      label: cp.label
    }))

    const { buffer, filename } = await exportService.generateCoursePeriodSheets(
      schoolId, inputs, start_date, end_date, campus_id, include_inactive || false
    )

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error: any) {
    res.status(500).json({ data: null, error: error.message })
  }
}
