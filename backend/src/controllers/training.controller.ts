import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { trainingService } from '../services/training.service'
import {
  CreateTrainingSessionDTO,
  UpdateTrainingSessionDTO,
  RegisterForTrainingDTO,
} from '../types'

export class TrainingController {
  private schoolId(req: AuthRequest): string {
    return (req.profile?.campus_id ?? req.profile?.school_id) as string
  }

  // ─── Admin: Sessions ──────────────────────────────────────────────────────

  async listSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await trainingService.listSessions(this.schoolId(req))
      res.json({ success: true, data })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async createSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dto: CreateTrainingSessionDTO = req.body
      if (!dto.title || !dto.start_date || !dto.end_date || !dto.total_seats) {
        res.status(400).json({ success: false, error: 'title, start_date, end_date, and total_seats are required' })
        return
      }
      if (new Date(dto.start_date) >= new Date(dto.end_date)) {
        res.status(400).json({ success: false, error: 'start_date must be before end_date' })
        return
      }
      const data = await trainingService.createSession(this.schoolId(req), dto)
      res.status(201).json({ success: true, data })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async getSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await trainingService.getSessionById(req.params.id, this.schoolId(req))
      if (!data) {
        res.status(404).json({ success: false, error: 'Session not found' })
        return
      }
      res.json({ success: true, data })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async updateSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dto: UpdateTrainingSessionDTO = req.body
      const data = await trainingService.updateSession(req.params.id, this.schoolId(req), dto)
      res.json({ success: true, data })
    } catch (err: any) {
      const status = err.message.includes('Cannot reduce') ? 400 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async deleteSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      await trainingService.deleteSession(req.params.id, this.schoolId(req))
      res.status(204).send()
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  // ─── Admin: Registrations ─────────────────────────────────────────────────

  async listRegistrations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 20
      const filters = {
        registration_status: req.query.status as string | undefined,
        payment_status: req.query.payment_status as string | undefined,
        search: req.query.search as string | undefined,
      }
      const result = await trainingService.listRegistrations(
        req.params.id,
        this.schoolId(req),
        filters,
        page,
        limit
      )
      res.json({ success: true, ...result })
    } catch (err: any) {
      const status = err.message === 'Session not found' ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async exportCSV(req: AuthRequest, res: Response): Promise<void> {
    try {
      const csv = await trainingService.exportRegistrationsCSV(req.params.id, this.schoolId(req))
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="registrations-${req.params.id}.csv"`
      )
      res.send(csv)
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async toggleAttendance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { session_id } = req.body
      if (!session_id) {
        res.status(400).json({ success: false, error: 'session_id is required' })
        return
      }
      const data = await trainingService.toggleAttendance(
        req.params.id,
        session_id,
        this.schoolId(req)
      )
      res.json({ success: true, data })
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async updatePaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { session_id, payment_status } = req.body
      if (!session_id || !payment_status) {
        res.status(400).json({ success: false, error: 'session_id and payment_status are required' })
        return
      }
      const data = await trainingService.updatePaymentStatus(
        req.params.id,
        session_id,
        this.schoolId(req),
        payment_status
      )
      res.json({ success: true, data })
    } catch (err: any) {
      const status = err.message === 'Invalid payment status' ? 400 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async cancelRegistration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { session_id } = req.body
      if (!session_id) {
        res.status(400).json({ success: false, error: 'session_id is required' })
        return
      }
      await trainingService.cancelRegistration(req.params.id, session_id, this.schoolId(req))
      res.json({ success: true, message: 'Registration cancelled' })
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async promoteWaitlistRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { session_id } = req.body
      if (!session_id) {
        res.status(400).json({ success: false, error: 'session_id is required' })
        return
      }
      const promoted = await trainingService.promoteWaitlistRecord(
        req.params.id,
        session_id,
        this.schoolId(req)
      )
      if (!promoted) {
        res.status(409).json({ success: false, error: 'Seat already filled by another action' })
        return
      }
      res.json({ success: true, message: 'Registration promoted to confirmed' })
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  async hardDeleteRegistration(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { session_id } = req.body
      if (!session_id) {
        res.status(400).json({ success: false, error: 'session_id is required' })
        return
      }
      await trainingService.hardDeleteRegistration(req.params.id, session_id, this.schoolId(req))
      res.status(204).send()
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  async getPublicSession(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await trainingService.getPublicSession(req.params.token)
      if (!data) {
        res.status(404).json({ success: false, error: 'Session not found' })
        return
      }
      res.json({ success: true, data })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async lookupStudent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const studentNumber = req.query.student_number as string
      if (!studentNumber) {
        res.status(400).json({ success: false, error: 'student_number query param is required' })
        return
      }
      const data = await trainingService.lookupStudentByNumber(studentNumber, req.params.token)
      if (!data) {
        res.status(404).json({ success: false, error: 'Student not found' })
        return
      }
      res.json({ success: true, data })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }

  async register(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dto: RegisterForTrainingDTO = req.body
      if (!dto.student_type) {
        res.status(400).json({ success: false, error: 'student_type is required' })
        return
      }
      const data = await trainingService.registerForSession(req.params.token, dto)
      res.status(201).json({ success: true, data })
    } catch (err: any) {
      const status =
        err.message === 'Session not found' ? 404
        : err.message.includes('closed') ? 403
        : err.message.includes('required') || err.message.includes('not found in this school') ? 400
        : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }
}

export const trainingController = new TrainingController()
