import { Request, Response } from 'express'
import * as service from '../services/physics-labs.service'
import { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    role: string
    grade_id?: string
    campus_id?: string
    student_id?: string
  }
}

function resolveSchoolId(req: Request, source: 'query' | 'body' = 'query'): string | null {
  const profile = (req as AuthRequest).profile
  const explicit =
    source === 'query'
      ? (req.query.school_id as string | undefined)
      : (req.body.campus_id as string | undefined) || (req.body.school_id as string | undefined)
  return explicit || profile?.campus_id || profile?.school_id || null
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAll = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const labs = await service.getPhysicsLabs(schoolId)
    res.json({ success: true, data: labs } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch physics labs' } as ApiResponse)
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const { sim_key, subject_id, grade_id, custom_note, is_active } = req.body
    if (!sim_key) return res.status(400).json({ success: false, error: 'sim_key is required' } as ApiResponse)

    const schoolId = resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const lab = await service.createPhysicsLab({
      school_id:   schoolId,
      sim_key,
      subject_id:  subject_id  || null,
      grade_id:    grade_id    || null,
      custom_note: custom_note || null,
      is_active:   is_active   ?? true,
      created_by:  profile.id,
    })
    res.status(201).json({ success: true, data: lab, message: 'Physics lab assigned' } as ApiResponse)
  } catch (error: any) {
    // Unique constraint violation — already assigned for this school+sim+grade combination
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'This simulation is already assigned for that grade' } as ApiResponse)
    }
    res.status(500).json({ success: false, error: error.message || 'Failed to assign physics lab' } as ApiResponse)
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query') || resolveSchoolId(req, 'body')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const lab = await service.updatePhysicsLab(req.params.id, schoolId, req.body)
    res.json({ success: true, data: lab, message: 'Physics lab updated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update physics lab' } as ApiResponse)
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    await service.deletePhysicsLab(req.params.id, schoolId)
    res.json({ success: true, message: 'Physics lab removed' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to remove physics lab' } as ApiResponse)
  }
}

// ── Student-facing ────────────────────────────────────────────────────────────

export const getForStudent = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const schoolId = profile.campus_id || profile.school_id
    const gradeId  = (req.query.grade_id as string | undefined) || profile.grade_id || null

    const labs = await service.getStudentPhysicsLabs(schoolId, gradeId)
    res.json({ success: true, data: labs } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch physics labs' } as ApiResponse)
  }
}

// ── Submissions ───────────────────────────────────────────────────────────────

export const submitFindings = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile) return res.status(400).json({ success: false, error: 'Profile required' } as ApiResponse)

    const { lab_id, findings_text, time_spent_s } = req.body
    if (!lab_id || !findings_text?.trim()) {
      return res.status(400).json({ success: false, error: 'lab_id and findings_text are required' } as ApiResponse)
    }

    const schoolId = profile.campus_id || profile.school_id
    const submission = await service.createSubmission({
      school_id:     schoolId,
      lab_id,
      student_id:    profile.id,
      findings_text: findings_text.trim(),
      time_spent_s:  time_spent_s || null,
    })
    res.status(201).json({ success: true, data: submission, message: 'Findings submitted' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to submit findings' } as ApiResponse)
  }
}

export const getSubmissions = async (req: Request, res: Response) => {
  try {
    const schoolId = resolveSchoolId(req, 'query')
    if (!schoolId) return res.status(400).json({ success: false, error: 'School ID is required' } as ApiResponse)

    const submissions = await service.getLabSubmissions(req.params.id, schoolId)
    res.json({ success: true, data: submissions } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch submissions' } as ApiResponse)
  }
}
