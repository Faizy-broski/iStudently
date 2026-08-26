import { Response } from 'express'
import type { AuthRequest } from '../middlewares/auth.middleware'
import { resolveSchoolId } from '../utils/campus-validation'
import {
  generateTemplateWorkbook,
  validateImport,
  startImportJob,
  getImportJob,
  listImportJobs,
  rollbackImportJob,
  ImportTokenExpiredError
} from '../services/school-data-import.service'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25MB — generous for a school's full dataset, still bounded

export const downloadTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const buffer = await generateTemplateWorkbook()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="studently-school-data-import-template.xlsx"')
    res.send(buffer)
  } catch (error: any) {
    console.error('Error generating school-data-import template:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to generate template' })
  }
}

export const validate = async (req: AuthRequest, res: Response) => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) return res.status(403).json({ success: false, error: 'No school associated with your account' })

    const file = (req as any).file
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded — attach the workbook as "file"' })
    if (file.size > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ success: false, error: `File too large — max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB` })
    }

    const { schoolId, error, status } = await resolveSchoolId(req, req.body.school_id || req.body.campus_id)
    if (error || !schoolId) return res.status(status || 403).json({ success: false, error })

    const { token, report } = await validateImport(schoolId, file.buffer)
    res.json({ success: true, data: { token, report } })
  } catch (error: any) {
    console.error('Error validating school data import:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to validate workbook' })
  }
}

export const commit = async (req: AuthRequest, res: Response) => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) return res.status(403).json({ success: false, error: 'No school associated with your account' })

    const { token, original_filename } = req.body
    if (!token) return res.status(400).json({ success: false, error: 'token is required (from a prior /validate call)' })

    const { schoolId, error, status } = await resolveSchoolId(req, req.body.school_id || req.body.campus_id)
    if (error || !schoolId) return res.status(status || 403).json({ success: false, error })

    const { jobId } = await startImportJob({
      schoolId,
      token,
      originalFilename: original_filename,
      createdBy: req.profile?.id
    })
    res.status(202).json({ success: true, data: { job_id: jobId } })
  } catch (error: any) {
    if (error instanceof ImportTokenExpiredError) {
      return res.status(410).json({ success: false, error: error.message })
    }
    console.error('Error starting school data import:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to start import' })
  }
}

export const getJob = async (req: AuthRequest, res: Response) => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) return res.status(403).json({ success: false, error: 'No school associated with your account' })

    const { schoolId, error, status } = await resolveSchoolId(req, req.query.school_id as string | undefined)
    if (error || !schoolId) return res.status(status || 403).json({ success: false, error })

    const job = await getImportJob(req.params.id, schoolId)
    if (!job) return res.status(404).json({ success: false, error: 'Import job not found' })
    res.json({ success: true, data: job })
  } catch (error: any) {
    console.error('Error fetching school data import job:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch job' })
  }
}

export const listJobs = async (req: AuthRequest, res: Response) => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) return res.status(403).json({ success: false, error: 'No school associated with your account' })

    const { schoolId, error, status } = await resolveSchoolId(req, req.query.school_id as string | undefined)
    if (error || !schoolId) return res.status(status || 403).json({ success: false, error })

    const jobs = await listImportJobs(schoolId)
    res.json({ success: true, data: jobs })
  } catch (error: any) {
    console.error('Error listing school data import jobs:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to list jobs' })
  }
}

export const rollback = async (req: AuthRequest, res: Response) => {
  try {
    const adminSchoolId = req.profile?.school_id
    if (!adminSchoolId) return res.status(403).json({ success: false, error: 'No school associated with your account' })

    const { schoolId, error, status } = await resolveSchoolId(req, req.body.school_id || req.body.campus_id)
    if (error || !schoolId) return res.status(status || 403).json({ success: false, error })

    const result = await rollbackImportJob(req.params.id, schoolId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Error rolling back school data import job:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to roll back import' })
  }
}
