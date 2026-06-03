import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as svc from '../services/withdrawal-analytics.service'
import { ApiResponse } from '../types'

export const getCumulative = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }

    const { academicYearId, granularity = 'annual', campusId, semester } = req.query as Record<string, string>

    if (!academicYearId) {
      res.status(400).json({ success: false, error: 'academicYearId is required' } as ApiResponse)
      return
    }

    const data = await svc.getWithdrawalCumulative({
      schoolId,
      campusId: campusId || undefined,
      academicYearId,
      granularity: granularity === 'semester' ? 'semester' : 'annual',
      semester: semester === '1' || semester === '2' ? semester : undefined,
    })

    res.json({ success: true, data } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getComparison = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }

    const { academicYearIds, granularity = 'annual', campusId } = req.query as Record<string, string>

    if (!academicYearIds) {
      res.status(400).json({ success: false, error: 'academicYearIds is required' } as ApiResponse)
      return
    }

    const ids = academicYearIds.split(',').map((s) => s.trim()).filter(Boolean)

    const data = await svc.getWithdrawalComparison({
      schoolId,
      campusId: campusId || undefined,
      academicYearIds: ids,
      granularity: granularity === 'semester' ? 'semester' : 'annual',
    })

    res.json({ success: true, data } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'School context required' } as ApiResponse)
      return
    }

    const { academicYearId, campusId } = req.query as Record<string, string>

    if (!academicYearId) {
      res.status(400).json({ success: false, error: 'academicYearId is required' } as ApiResponse)
      return
    }

    const data = await svc.getWithdrawalSummary({
      schoolId,
      campusId: campusId || undefined,
      academicYearId,
    })

    res.json({ success: true, data } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
