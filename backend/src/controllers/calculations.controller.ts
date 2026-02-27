import { Request, Response } from 'express'
import { CalculationsService, RunFilters } from '../services/calculations.service'

export interface AuthRequest extends Request {
  user?: { id: string; email?: string }
  profile?: { id: string; school_id?: string; role?: string; is_active?: boolean }
}

export class CalculationsController {
  private service: CalculationsService

  constructor() {
    this.service = new CalculationsService()
  }

  // ---- Calculations CRUD ----

  async listCalculations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const campusId = req.query.campus_id as string | undefined
      const data = await this.service.getCalculations(schoolId, campusId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list calculations' })
    }
  }

  async getCalculation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const data = await this.service.getCalculationById(req.params.id, schoolId)
      if (!data) { res.status(404).json({ success: false, error: 'Not found' }); return }
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get calculation' })
    }
  }

  async createCalculation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const { title, formula, breakdown, campus_id } = req.body
      if (!title?.trim()) { res.status(400).json({ success: false, error: 'title is required' }); return }
      if (!formula?.trim()) { res.status(400).json({ success: false, error: 'formula is required' }); return }

      const data = await this.service.createCalculation(schoolId, campus_id, profileId, {
        title: title.trim(),
        formula: formula.trim(),
        breakdown,
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create calculation' })
    }
  }

  async updateCalculation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const data = await this.service.updateCalculation(req.params.id, schoolId, req.body)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update calculation' })
    }
  }

  async deleteCalculation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      await this.service.deleteCalculation(req.params.id, schoolId)
      res.json({ success: true, message: 'Calculation deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete calculation' })
    }
  }

  async runCalculation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const filters: RunFilters = {
        campus_id: req.body.campus_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        grade_level_id: req.body.grade_level_id,
        section_id: req.body.section_id,
      }
      const data = await this.service.runCalculation(req.params.id, schoolId, filters)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to run calculation' })
    }
  }

  /**
   * Run an arbitrary formula string without requiring a saved record.
   */
  async runFormula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const { formula, breakdown, campus_id, start_date, end_date, grade_level_id, section_id } = req.body
      if (!formula || !formula.trim()) {
        res.status(400).json({ success: false, error: 'formula is required' })
        return
      }

      const filters: RunFilters = {
        campus_id,
        start_date,
        end_date,
        grade_level_id,
        section_id,
      }

      const data = await this.service.runFormula(formula.trim(), breakdown, schoolId, campus_id, filters)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to run formula' })
    }
  }

  // ---- Reports CRUD ----

  async listReports(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const campusId = req.query.campus_id as string | undefined
      const data = await this.service.getReports(schoolId, campusId)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to list reports' })
    }
  }

  async getReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const data = await this.service.getReportById(req.params.id, schoolId)
      if (!data) { res.status(404).json({ success: false, error: 'Not found' }); return }
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to get report' })
    }
  }

  async createReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      const profileId = req.profile?.id
      if (!schoolId || !profileId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

      const { title, cells, campus_id } = req.body
      if (!title?.trim()) { res.status(400).json({ success: false, error: 'title is required' }); return }

      const data = await this.service.createReport(schoolId, campus_id, profileId, {
        title: title.trim(),
        cells: Array.isArray(cells) ? cells : [[{}]],
      })
      res.status(201).json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to create report' })
    }
  }

  async updateReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const data = await this.service.updateReport(req.params.id, schoolId, req.body)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to update report' })
    }
  }

  async deleteReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      await this.service.deleteReport(req.params.id, schoolId)
      res.json({ success: true, message: 'Report deleted' })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to delete report' })
    }
  }

  async runReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }
      const filters: RunFilters = {
        campus_id: req.body.campus_id,
        start_date: req.body.start_date,
        end_date: req.body.end_date,
        grade_level_id: req.body.grade_level_id,
        section_id: req.body.section_id,
      }
      const data = await this.service.runReport(req.params.id, schoolId, filters)
      res.json({ success: true, data })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to run report' })
    }
  }
}
