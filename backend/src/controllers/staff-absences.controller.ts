import { Request, Response } from 'express'
import * as service from '../services/staff-absences.service'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
  }
}

// ============================================================================
// ABSENCE FIELDS
// ============================================================================

export const getAbsenceFields = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })
    const campusId = req.query.campus_id as string | undefined
    const result = await service.getAbsenceFields(schoolId, campusId)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const createAbsenceField = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId || !req.body.title || !req.body.type) {
      return res.status(400).json({ data: null, error: 'school_id, title, and type are required' })
    }
    const result = await service.createAbsenceField({ ...req.body, school_id: schoolId })
    res.status(201).json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const updateAbsenceField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await service.updateAbsenceField(id, req.body)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const deleteAbsenceField = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await service.deleteAbsenceField(id)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

// ============================================================================
// ABSENCES
// ============================================================================

export const getAbsences = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })

    const filters: service.StaffAbsenceFilters = {
      school_id: schoolId,
      campus_id: req.query.campus_id as string | undefined,
      staff_id: req.query.staff_id as string | undefined,
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
      status: req.query.status as string | undefined,
      academic_year_id: req.query.academic_year_id as string | undefined,
    }

    const result = await service.getAbsences(filters)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const getAbsenceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await service.getAbsenceById(id)
    if (!result.data) return res.status(404).json({ data: null, error: 'Not found' })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const createAbsence = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    const createdBy = req.body.created_by || req.profile?.id

    if (!schoolId || !req.body.staff_id || !req.body.start_date || !req.body.end_date) {
      return res.status(400).json({ data: null, error: 'school_id, staff_id, start_date, end_date are required' })
    }

    const result = await service.createAbsence({
      ...req.body,
      school_id: schoolId,
      created_by: createdBy,
    })
    res.status(201).json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const updateAbsence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await service.updateAbsence(id, req.body)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const deleteAbsence = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const result = await service.deleteAbsence(id)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

// ============================================================================
// REPORTS
// ============================================================================

export const getCancelledClasses = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })

    const filters: service.StaffAbsenceFilters = {
      school_id: schoolId,
      campus_id: req.query.campus_id as string | undefined,
      staff_id: req.query.staff_id as string | undefined,
      start_date: req.query.start_date as string | undefined,
      end_date: req.query.end_date as string | undefined,
    }

    const result = await service.getCancelledClasses(filters)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const getAbsenceBreakdown = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })

    const startDate = (req.query.start_date as string) || new Date().getFullYear() + '-01-01'
    const endDate = (req.query.end_date as string) || new Date().toISOString().slice(0, 10)
    const campusId = req.query.campus_id as string | undefined

    const result = await service.getAbsenceBreakdown(schoolId, startDate, endDate, campusId)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export const getStaffList = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })
    const campusId = req.query.campus_id as string | undefined
    const result = await service.getStaffList(schoolId, campusId)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}

export const getStaffCoursePeriods = async (req: AuthRequest, res: Response) => {
  try {
    const { staff_id } = req.params
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })
    const campusId = req.query.campus_id as string | undefined
    const result = await service.getStaffCoursePeriods(staff_id, schoolId, campusId)
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ data: null, error: e.message })
  }
}
