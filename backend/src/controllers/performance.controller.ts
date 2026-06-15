import { Request, Response } from 'express'
import type { AuthRequest } from '../middlewares/auth.middleware'
import * as svc from '../services/performance.service'
import { getEffectiveSchoolId } from '../utils/campus-validation'

// ─── Catalog ──────────────────────────────────────────────────────────────────

export async function getCatalog(req: Request, res: Response): Promise<void> {
  try {
    const schoolId   = (req as AuthRequest).profile?.school_id
    const activeOnly = req.query.active_only === 'true'
    if (!schoolId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const data = await svc.getCatalog(schoolId, activeOnly)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function createAction(req: Request, res: Response): Promise<void> {
  try {
    const schoolId = (req as AuthRequest).profile?.school_id
    if (!schoolId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const { action_name_ar, action_name_en, action_type, escalation_stage,
            default_points, default_fine, sort_order } = req.body

    if (!action_name_ar || !action_name_en || !action_type) {
      res.status(400).json({ success: false, error: 'action_name_ar, action_name_en, and action_type are required' })
      return
    }

    const data = await svc.createAction({
      school_id: schoolId,
      action_name_ar,
      action_name_en,
      action_type,
      escalation_stage: escalation_stage || 'none',
      default_points:   Number(default_points) || 0,
      default_fine:     Number(default_fine)   || 0,
      is_active:        req.body.is_active ?? true,
      sort_order:       Number(sort_order)  || 0,
    })
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function updateAction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const data = await svc.updateAction(id, req.body)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function deleteAction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    await svc.deleteAction(id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    const adminProfile  = (req as AuthRequest).profile
    if (!adminProfile) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const { staff_id, campus_id, academic_year_id, page, limit } = req.query

    // Validate and resolve campus_id the same way as staff controller
    const effectiveCampusId = campus_id
      ? await getEffectiveSchoolId(adminProfile.school_id, campus_id as string)
      : undefined

    const result = await svc.getLogs({
      schoolId:       adminProfile.school_id,
      staffId:        staff_id as string | undefined,
      campusId:       effectiveCampusId,
      academicYearId: academic_year_id as string | undefined,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 20,
    })
    res.json({ success: true, data: result.data, pagination: { total: result.total } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function getLogById(req: Request, res: Response): Promise<void> {
  try {
    const log = await svc.getLogById(req.params.id)
    if (!log) { res.status(404).json({ success: false, error: 'Not found' }); return }
    res.json({ success: true, data: log })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function createLog(req: Request, res: Response): Promise<void> {
  try {
    const adminProfile = (req as AuthRequest).profile
    if (!adminProfile) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const { staff_id, action_id, academic_year_id, campus_id,
            custom_points, custom_fine, notes } = req.body

    if (!staff_id || !action_id) {
      res.status(400).json({ success: false, error: 'staff_id and action_id are required' })
      return
    }

    // Validate campus_id belongs to this admin's school hierarchy
    const effectiveCampusId = campus_id
      ? await getEffectiveSchoolId(adminProfile.school_id, campus_id)
      : undefined

    const data = await svc.createLog(
      {
        school_id:        adminProfile.school_id,
        campus_id:        effectiveCampusId || undefined,
        staff_id,
        action_id,
        academic_year_id: academic_year_id || undefined,
        custom_points:    custom_points != null ? Number(custom_points) : null,
        custom_fine:      custom_fine   != null ? Number(custom_fine)   : null,
        notes,
      },
      adminProfile.id
    )
    res.status(201).json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function deleteLog(req: Request, res: Response): Promise<void> {
  try {
    await svc.deleteLog(req.params.id)
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

// ─── Score ───────────────────────────────────────────────────────────────────

export async function getStaffScore(req: Request, res: Response): Promise<void> {
  try {
    const schoolId      = (req as AuthRequest).profile?.school_id
    if (!schoolId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const { staffId } = req.params
    const { academic_year_id } = req.query

    const data = await svc.getStaffScore(
      staffId,
      schoolId,
      academic_year_id as string | undefined
    )
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
}

export async function getMyScore(req: Request, res: Response): Promise<void> {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) { res.status(401).json({ success: false, error: 'Unauthorized' }); return }

    const data = await svc.getMyScore(profile.id, profile.school_id)
    res.json({ success: true, data })
  } catch (err: any) {
    if (err.message === 'Staff record not found for this profile') {
      res.status(404).json({ success: false, error: err.message })
    } else {
      res.status(500).json({ success: false, error: err.message })
    }
  }
}
