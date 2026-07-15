import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { MessagingService } from '../services/messaging.service'
import { getEffectiveSchoolId } from '../utils/campus-validation'

const messagingService = new MessagingService()

export class MessagingController {
  async sendMessage(req: AuthRequest, res: Response) {
    try {
      const { recipient_ids, subject, body, campus_id, reply_to_message_id, attachments } = req.body

      if (!recipient_ids?.length) {
        res.status(400).json({ success: false, error: 'No recipients selected' })
        return
      }
      if (!subject?.trim()) {
        res.status(400).json({ success: false, error: 'Subject is required' })
        return
      }
      if (!body?.trim()) {
        res.status(400).json({ success: false, error: 'Message body is required' })
        return
      }

      let validAttachments: { url: string; name: string; mime_type: string; size: number; path: string }[] | undefined
      if (attachments !== undefined) {
        if (!Array.isArray(attachments) || attachments.some((a: any) => !a || typeof a.url !== 'string' || !a.url)) {
          res.status(400).json({ success: false, error: 'Invalid attachments' })
          return
        }
        validAttachments = attachments
      }

      const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)

      const message = await messagingService.sendMessage({
        schoolId,
        senderProfileId: req.profile.id,
        subject: subject.trim(),
        body,
        recipientProfileIds: recipient_ids,
        replyToMessageId: reply_to_message_id || undefined,
        attachments: validAttachments,
      })

      res.json({ success: true, data: message })
    } catch (error: any) {
      console.error('sendMessage error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to send message' })
    }
  }

  async listMessages(req: AuthRequest, res: Response) {
    try {
      const view = (req.query.view as string) || 'inbox'
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

      if (!['inbox', 'read', 'archived', 'sent'].includes(view)) {
        res.status(400).json({ success: false, error: 'Invalid view' })
        return
      }

      const result = await messagingService.listMessages(req.profile.id, view as any, page, limit)

      res.json({
        success: true,
        data: result.data,
        pagination: { total: result.total, page: result.page, limit, totalPages: result.totalPages },
      })
    } catch (error: any) {
      console.error('listMessages error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list messages' })
    }
  }

  async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const count = await messagingService.getUnreadCount(req.profile.id)
      res.json({ success: true, data: { count } })
    } catch (error: any) {
      console.error('getUnreadCount error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to get unread count' })
    }
  }

  async getThread(req: AuthRequest, res: Response) {
    try {
      const messages = await messagingService.getThread(req.params.id, {
        id: req.profile.id,
        role: req.profile.role,
        user_profile_id: req.profile.user_profile_id,
      })

      if (!messages) {
        res.status(404).json({ success: false, error: 'Message not found' })
        return
      }

      res.json({ success: true, data: { messages } })
    } catch (error: any) {
      console.error('getThread error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch message thread' })
    }
  }

  async archiveMessage(req: AuthRequest, res: Response) {
    try {
      const archived = await messagingService.archiveMessage(req.params.id, req.profile.id)

      if (!archived) {
        res.status(404).json({ success: false, error: 'Message not found' })
        return
      }

      res.json({ success: true })
    } catch (error: any) {
      console.error('archiveMessage error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to archive message' })
    }
  }

  async deleteMessage(req: AuthRequest, res: Response) {
    try {
      const deleted = await messagingService.deleteMessage(req.params.id, {
        id: req.profile.id,
        role: req.profile.role,
        user_profile_id: req.profile.user_profile_id,
      })

      if (!deleted) {
        res.status(403).json({ success: false, error: 'You are not allowed to delete this message' })
        return
      }

      res.json({ success: true, message: 'Message deleted' })
    } catch (error: any) {
      console.error('deleteMessage error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete message' })
    }
  }

  async listRecipients(req: AuthRequest, res: Response) {
    try {
      const type = (req.query.type as string) || 'teachers'
      const search = req.query.search as string | undefined
      const campusId = req.query.campus_id as string | undefined
      const gradeLevelId = req.query.grade_level_id as string | undefined
      const sectionId = req.query.section_id as string | undefined

      if (!['students', 'teachers', 'staff', 'parents'].includes(type)) {
        res.status(400).json({ success: false, error: 'Invalid recipient type' })
        return
      }

      const schoolId = await getEffectiveSchoolId(req.profile.school_id, campusId)
      const recipients = await messagingService.listRecipients(
        schoolId,
        req.profile.role,
        type as any,
        search,
        gradeLevelId,
        sectionId
      )

      res.json({ success: true, data: recipients })
    } catch (error: any) {
      console.error('listRecipients error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list recipients' })
    }
  }

  async listTemplates(req: AuthRequest, res: Response) {
    try {
      const templates = await messagingService.listTemplates(req.profile.id)
      res.json({ success: true, data: templates })
    } catch (error: any) {
      console.error('listTemplates error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to list templates' })
    }
  }

  async saveTemplate(req: AuthRequest, res: Response) {
    try {
      const { title, subject, body, campus_id } = req.body

      if (!title?.trim()) {
        res.status(400).json({ success: false, error: 'Template title is required' })
        return
      }

      const schoolId = await getEffectiveSchoolId(req.profile.school_id, campus_id)

      const template = await messagingService.saveTemplate({
        schoolId,
        ownerProfileId: req.profile.id,
        title: title.trim(),
        subject: subject || '',
        body: body || '',
      })

      res.json({ success: true, data: template })
    } catch (error: any) {
      console.error('saveTemplate error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to save template' })
    }
  }

  async deleteTemplate(req: AuthRequest, res: Response) {
    try {
      const deleted = await messagingService.deleteTemplate(req.params.id, req.profile.id)

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Template not found' })
        return
      }

      res.json({ success: true })
    } catch (error: any) {
      console.error('deleteTemplate error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to delete template' })
    }
  }

  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await messagingService.getMessagingSettings()
      res.json({ success: true, data: settings })
    } catch (error: any) {
      console.error('getSettings error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch messaging settings' })
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await messagingService.updateMessagingSettings(req.body)
      res.json({ success: true, data: settings, message: 'Messaging settings updated' })
    } catch (error: any) {
      console.error('updateSettings error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to update messaging settings' })
    }
  }
}
