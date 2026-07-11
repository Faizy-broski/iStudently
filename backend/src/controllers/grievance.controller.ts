import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { GrievanceService, GrievanceProfile } from '../services/grievance.service'
import { getEffectiveSchoolId } from '../utils/campus-validation'

const grievanceService = new GrievanceService()

function toGrievanceProfile(req: AuthRequest): GrievanceProfile | null {
  if (!req.profile?.id || !req.profile?.school_id) return null
  return {
    id: req.profile.id,
    role: req.profile.role,
    school_id: req.profile.school_id,
    user_profile_id: req.profile.user_profile_id ?? null,
  }
}

export class GrievanceController {
  async createGrievance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const effectiveSchoolId = await getEffectiveSchoolId(profile.school_id, req.body.campus_id)

      const grievance = await grievanceService.createGrievance({
        school_id: effectiveSchoolId,
        title: req.body.title,
        description: req.body.description,
        category_id: req.body.category_id,
        priority: req.body.priority,
        department: req.body.department,
        submitter_profile_id: profile.id,
        person_involved_profile_id: req.body.person_involved_profile_id,
        is_anonymous: req.body.is_anonymous,
        is_confidential: req.body.is_confidential,
        attachments: req.body.attachments,
      })

      res.status(201).json({ success: true, data: grievance, message: 'Complaint submitted successfully' })
    } catch (error: any) {
      console.error('Create grievance error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to submit complaint' })
    }
  }

  async listGrievances(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const view = (req.query.view as 'mine' | 'assigned' | 'all') || 'mine'
      const result = await grievanceService.listGrievances(profile, view, {
        status: req.query.status as string,
        priority: req.query.priority as string,
        category_id: req.query.category_id as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      })

      res.json({ success: true, data: result.data, pagination: { total: result.total, page: result.page, limit: 20, totalPages: result.totalPages } })
    } catch (error: any) {
      console.error('List grievances error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to fetch complaints' })
    }
  }

  async getGrievance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const grievance = await grievanceService.getGrievanceById(req.params.id, profile)
      if (!grievance) {
        res.status(404).json({ success: false, error: 'Complaint not found' })
        return
      }

      res.json({ success: true, data: grievance })
    } catch (error: any) {
      console.error('Get grievance error:', error)
      res.status(403).json({ success: false, error: error.message || 'Failed to fetch complaint' })
    }
  }

  async addComment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      if (!req.body.body || !req.body.body.trim()) {
        res.status(400).json({ success: false, error: 'Comment body is required' })
        return
      }

      const comment = await grievanceService.addComment(req.params.id, profile, req.body.body, !!req.body.is_internal_note)

      if (req.body.attachments && req.body.attachments.length > 0) {
        await grievanceService.addAttachments(req.params.id, profile, req.body.attachments, comment.id)
      }

      res.status(201).json({ success: true, data: comment })
    } catch (error: any) {
      console.error('Add comment error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to add comment' })
    }
  }

  async uploadAttachments(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      if (!Array.isArray(req.body.files) || req.body.files.length === 0) {
        res.status(400).json({ success: false, error: 'files array is required' })
        return
      }

      const attachments = await grievanceService.addAttachments(req.params.id, profile, req.body.files)
      res.status(201).json({ success: true, data: attachments })
    } catch (error: any) {
      console.error('Upload attachments error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to upload attachments' })
    }
  }

  /** POST /:id/attachments/upload — multipart, field name "file". The only path that actually writes to storage. */
  async uploadAttachmentFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }

      const file = (req as any).file as Express.Multer.File | undefined
      if (!file) {
        res.status(400).json({ success: false, error: 'No file uploaded' })
        return
      }

      const attachment = await grievanceService.uploadAttachmentFile(
        req.params.id,
        profile,
        {
          buffer: file.buffer,
          mimetype: file.mimetype,
          size: file.size,
          originalname: file.originalname,
        },
        req.body?.comment_id || undefined
      )

      res.status(201).json({ success: true, data: attachment })
    } catch (error: any) {
      console.error('Upload attachment file error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to upload attachment' })
    }
  }

  /** GET /:id/attachments/:attachmentId/url — authorizes, logs the download, and returns a short-lived signed URL. */
  async getAttachmentUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const result = await grievanceService.getAttachmentSignedUrl(req.params.id, req.params.attachmentId, profile)
      res.json({ success: true, data: result })
    } catch (error: any) {
      res.status(403).json({ success: false, error: error.message || 'Failed to access attachment' })
    }
  }

  async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      if (!req.body.status) {
        res.status(400).json({ success: false, error: 'status is required' })
        return
      }

      const grievance = await grievanceService.updateStatus(req.params.id, profile, req.body.status, req.body.note)
      res.json({ success: true, data: grievance, message: 'Status updated' })
    } catch (error: any) {
      console.error('Update status error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to update status' })
    }
  }

  async assignGrievance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      if (!req.body.assignee_profile_id) {
        res.status(400).json({ success: false, error: 'assignee_profile_id is required' })
        return
      }

      const assignment = await grievanceService.assignGrievance(req.params.id, profile, req.body.assignee_profile_id, req.body.role_label)
      res.status(201).json({ success: true, data: assignment, message: 'Complaint assigned' })
    } catch (error: any) {
      console.error('Assign grievance error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to assign complaint' })
    }
  }

  async escalateGrievance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await grievanceService.escalateGrievance(req.params.id, profile, req.body.note)
      res.json({ success: true, message: 'Complaint escalated' })
    } catch (error: any) {
      console.error('Escalate grievance error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to escalate complaint' })
    }
  }

  async reopenGrievance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await grievanceService.reopenGrievance(req.params.id, profile, req.body.note)
      res.json({ success: true, message: 'Complaint reopened' })
    } catch (error: any) {
      console.error('Reopen grievance error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to reopen complaint' })
    }
  }

  async submitFeedback(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      if (!req.body.rating) {
        res.status(400).json({ success: false, error: 'rating is required' })
        return
      }
      const feedback = await grievanceService.submitFeedback(req.params.id, profile, req.body.rating, req.body.feedback_text)
      res.status(201).json({ success: true, data: feedback })
    } catch (error: any) {
      console.error('Submit feedback error:', error)
      res.status(400).json({ success: false, error: error.message || 'Failed to submit feedback' })
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const count = await grievanceService.getUnreadCount(profile.id)
      res.json({ success: true, data: { count } })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch unread count' })
    }
  }

  async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const stats = await grievanceService.getDashboardStats(profile.school_id)
      res.json({ success: true, data: stats })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch dashboard stats' })
    }
  }

  async getReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const report = await grievanceService.getReport(profile.school_id, {
        from: req.query.from as string,
        to: req.query.to as string,
        category_id: req.query.category_id as string,
        department: req.query.department as string,
        status: req.query.status as string,
      })
      res.json({ success: true, data: report })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to generate report' })
    }
  }

  async getCategories(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const categories = await grievanceService.getCategories(profile.school_id)
      res.json({ success: true, data: categories })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch categories' })
    }
  }

  async createCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      if (!req.body.name) {
        res.status(400).json({ success: false, error: 'name is required' })
        return
      }
      const category = await grievanceService.createCategory(profile.school_id, req.body.name, req.body.sla_days)
      res.status(201).json({ success: true, data: category })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to create category' })
    }
  }

  async updateCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const category = await grievanceService.updateCategory(profile.school_id, req.params.id, req.body)
      res.json({ success: true, data: category })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to update category' })
    }
  }

  async deleteCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      await grievanceService.deleteCategory(profile.school_id, req.params.id)
      res.json({ success: true, message: 'Category removed' })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to delete category' })
    }
  }

  async getSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const settings = await grievanceService.getSettings(profile.school_id)
      res.json({ success: true, data: settings })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch settings' })
    }
  }

  async updateSettings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const profile = toGrievanceProfile(req)
      if (!profile) {
        res.status(403).json({ success: false, error: 'No school associated with your account' })
        return
      }
      const settings = await grievanceService.updateSettings(profile.school_id, req.body)
      res.json({ success: true, data: settings, message: 'Settings updated' })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to update settings' })
    }
  }
}
