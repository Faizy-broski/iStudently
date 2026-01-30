import { Request, Response } from 'express'
import * as timetableService from '../services/timetable.service'
import * as attendanceService from '../services/attendance.service'
import { ApiResponse, DayOfWeek } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
  }
}

// ============================================================================
// STEP 2: TIMETABLE CONSTRUCTION CONTROLLER
// ============================================================================

export const getTimetableBySection = async (req: Request, res: Response) => {
  try {
    const { section_id, academic_year_id } = req.query

    if (!section_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'Section ID and Academic Year ID are required'
      } as ApiResponse)
    }

    const result = await timetableService.getTimetableBySection(
      section_id as string,
      academic_year_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching timetable by section:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getTimetableByTeacher = async (req: Request, res: Response) => {
  try {
    const { teacher_id, academic_year_id } = req.query

    if (!teacher_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID and Academic Year ID are required'
      } as ApiResponse)
    }

    const result = await timetableService.getTimetableByTeacher(
      teacher_id as string,
      academic_year_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching timetable by teacher:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getAvailableSubjectsForSection = async (req: Request, res: Response) => {
  try {
    const { section_id, academic_year_id } = req.query

    if (!section_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'Section ID and Academic Year ID are required'
      } as ApiResponse)
    }

    const result = await timetableService.getAvailableSubjectsForSection(
      section_id as string,
      academic_year_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching available subjects:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const checkTeacherConflict = async (req: Request, res: Response) => {
  try {
    const { teacher_id, day_of_week, period_id, academic_year_id, exclude_entry_id } = req.query

    if (!teacher_id || day_of_week === undefined || !period_id || !academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID, Day of Week, Period ID, and Academic Year ID are required'
      } as ApiResponse)
    }

    const result = await timetableService.checkTeacherConflict(
      teacher_id as string,
      parseInt(day_of_week as string) as DayOfWeek,
      period_id as string,
      academic_year_id as string,
      exclude_entry_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error checking teacher conflict:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const createTimetableEntry = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    const userId = (req as AuthRequest).profile?.id

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        error: 'School ID is required'
      } as ApiResponse)
    }

    const result = await timetableService.createTimetableEntry({
      ...req.body,
      school_id: schoolId,
      campus_id: req.body.campus_id || schoolId, // Use school_id as campus_id fallback
      created_by: userId
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating timetable entry:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const updateTimetableEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await timetableService.updateTimetableEntry(id, req.body)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating timetable entry:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const deleteTimetableEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await timetableService.deleteTimetableEntry(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error deleting timetable entry:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// STEP 4: TEACHER'S SCHEDULE VIEW
// ============================================================================

export const getTeacherSchedule = async (req: Request, res: Response) => {
  try {
    const { teacher_id, date } = req.query

    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required'
      } as ApiResponse)
    }

    const result = await timetableService.getTeacherScheduleForDate(
      teacher_id as string,
      date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher schedule:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getTeacherTimetable = async (req: Request, res: Response) => {
  try {
    const { teacher_id, academic_year_id } = req.query

    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required'
      } as ApiResponse)
    }

    if (!academic_year_id) {
      return res.status(400).json({
        success: false,
        error: 'Academic year ID is required'
      } as ApiResponse)
    }

    const result = await timetableService.getTimetableByTeacher(
      teacher_id as string,
      academic_year_id as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher timetable:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getCurrentClass = async (req: Request, res: Response) => {
  try {
    const { teacher_id } = req.query

    if (!teacher_id) {
      // Try to get teacher ID from profile
      const profile = (req as AuthRequest).profile
      if (profile?.role === 'teacher') {
        // TODO: Get teacher staff ID from profile
      }

      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required'
      } as ApiResponse)
    }

    const result = await timetableService.getCurrentClassForTeacher(teacher_id as string)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching current class:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getNextClass = async (req: Request, res: Response) => {
  try {
    const { teacher_id } = req.query

    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required'
      } as ApiResponse)
    }

    const result = await timetableService.getNextClassForTeacher(teacher_id as string)
    res.json(result)
  } catch (error: any) {
    console.error('Error fetching next class:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// STEP 3: AUTO-GENERATE ATTENDANCE
// ============================================================================

export const generateDailyAttendance = async (req: Request, res: Response) => {
  try {
    const { date } = req.body
    const result = await attendanceService.generateDailyAttendance(date)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error generating daily attendance:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

// ============================================================================
// STEP 4: TEACHER ATTENDANCE MARKING
// ============================================================================

export const getAttendanceForClass = async (req: Request, res: Response) => {
  try {
    const { timetable_entry_id, date } = req.query

    if (!timetable_entry_id || !date) {
      return res.status(400).json({
        success: false,
        error: 'Timetable Entry ID and Date are required'
      } as ApiResponse)
    }

    const result = await attendanceService.getAttendanceForClass(
      timetable_entry_id as string,
      date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching attendance for class:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getAttendanceForSectionDate = async (req: Request, res: Response) => {
  try {
    const { section_id, date } = req.query

    if (!section_id || !date) {
      return res.status(400).json({
        success: false,
        error: 'Section ID and Date are required'
      } as ApiResponse)
    }

    const result = await attendanceService.getAttendanceForSectionDate(
      section_id as string,
      date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching attendance for section/date:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const updateAttendanceRecord = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = (req as AuthRequest).profile?.id

    const result = await attendanceService.updateAttendanceRecord(id, {
      ...req.body,
      marked_by: userId
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating attendance:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const bulkUpdateAttendance = async (req: Request, res: Response) => {
  try {
    const { timetable_entry_id, date, updates } = req.body
    const userId = (req as AuthRequest).profile?.id

    if (!timetable_entry_id || !date || !updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Timetable Entry ID, Date, and Updates array are required'
      } as ApiResponse)
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID is required'
      } as ApiResponse)
    }

    const result = await attendanceService.bulkUpdateAttendance(
      timetable_entry_id,
      date,
      updates,
      userId
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error bulk updating attendance:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getAttendanceStats = async (req: Request, res: Response) => {
  try {
    const { timetable_entry_id, date } = req.query

    if (!timetable_entry_id || !date) {
      return res.status(400).json({
        success: false,
        error: 'Timetable Entry ID and Date are required'
      } as ApiResponse)
    }

    const result = await attendanceService.getAttendanceStats(
      timetable_entry_id as string,
      date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching attendance stats:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getStudentAttendanceHistory = async (req: Request, res: Response) => {
  try {
    const { student_id, start_date, end_date } = req.query

    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      } as ApiResponse)
    }

    const result = await attendanceService.getStudentAttendanceHistory(
      student_id as string,
      start_date as string,
      end_date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching student attendance history:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getClassAttendanceSummary = async (req: Request, res: Response) => {
  try {
    const { section_id, start_date, end_date } = req.query

    if (!section_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Section ID, Start Date, and End Date are required'
      } as ApiResponse)
    }

    const result = await attendanceService.getClassAttendanceSummary(
      section_id as string,
      start_date as string,
      end_date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching class attendance summary:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}

export const getTeacherAttendanceOverview = async (req: Request, res: Response) => {
  try {
    const { teacher_id, date } = req.query

    if (!teacher_id || !date) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID and Date are required'
      } as ApiResponse)
    }

    const result = await attendanceService.getTeacherAttendanceOverview(
      teacher_id as string,
      date as string
    )

    res.json(result)
  } catch (error: any) {
    console.error('Error fetching teacher attendance overview:', error)
    res.status(500).json({
      success: false,
      error: error.message
    } as ApiResponse)
  }
}
