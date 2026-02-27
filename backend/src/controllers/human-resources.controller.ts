import { Request, Response } from 'express'
import * as svc from '../services/human-resources.service'

interface AuthRequest extends Request {
  profile?: { id: string; school_id: string; role: string }
}

// ============================================================================
// ALL QUALIFICATIONS
// ============================================================================

export const getQualifications = async (req: AuthRequest, res: Response) => {
  try {
    const { profile_id } = req.params
    const schoolId = (req.query.school_id as string) || req.profile?.school_id
    if (!schoolId) return res.status(400).json({ data: null, error: 'school_id required' })
    res.json(await svc.getQualifications(profile_id, schoolId))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

// ============================================================================
// SKILLS
// ============================================================================

export const createSkill = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId || !req.body.profile_id || !req.body.title)
      return res.status(400).json({ data: null, error: 'school_id, profile_id, title required' })
    res.status(201).json(await svc.createSkill({ ...req.body, school_id: schoolId }))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const updateSkill = async (req: Request, res: Response) => {
  try {
    res.json(await svc.updateSkill(req.params.id, req.body))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const deleteSkill = async (req: Request, res: Response) => {
  try {
    res.json(await svc.deleteSkill(req.params.id))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

// ============================================================================
// EDUCATION
// ============================================================================

export const createEducation = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId || !req.body.profile_id || !req.body.qualification)
      return res.status(400).json({ data: null, error: 'school_id, profile_id, qualification required' })
    res.status(201).json(await svc.createEducation({ ...req.body, school_id: schoolId }))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const updateEducation = async (req: Request, res: Response) => {
  try {
    res.json(await svc.updateEducation(req.params.id, req.body))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const deleteEducation = async (req: Request, res: Response) => {
  try {
    res.json(await svc.deleteEducation(req.params.id))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

// ============================================================================
// CERTIFICATIONS
// ============================================================================

export const createCertification = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId || !req.body.profile_id || !req.body.title)
      return res.status(400).json({ data: null, error: 'school_id, profile_id, title required' })
    res.status(201).json(await svc.createCertification({ ...req.body, school_id: schoolId }))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const updateCertification = async (req: Request, res: Response) => {
  try {
    res.json(await svc.updateCertification(req.params.id, req.body))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const deleteCertification = async (req: Request, res: Response) => {
  try {
    res.json(await svc.deleteCertification(req.params.id))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

// ============================================================================
// LANGUAGES
// ============================================================================

export const createLanguage = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.body.school_id || req.profile?.school_id
    if (!schoolId || !req.body.profile_id || !req.body.title)
      return res.status(400).json({ data: null, error: 'school_id, profile_id, title required' })
    res.status(201).json(await svc.createLanguage({ ...req.body, school_id: schoolId }))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const updateLanguage = async (req: Request, res: Response) => {
  try {
    res.json(await svc.updateLanguage(req.params.id, req.body))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}

export const deleteLanguage = async (req: Request, res: Response) => {
  try {
    res.json(await svc.deleteLanguage(req.params.id))
  } catch (e: any) { res.status(500).json({ data: null, error: e.message }) }
}
