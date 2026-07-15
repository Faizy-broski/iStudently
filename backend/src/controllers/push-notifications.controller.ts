import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { pushNotificationsService } from '../services/push-notifications.service'

export class PushNotificationsController {
  /**
   * GET /api/push/vapid-public-key
   * Public within an authenticated session — the frontend needs this to
   * construct the applicationServerKey for pushManager.subscribe().
   */
  async getPublicKey(req: AuthRequest, res: Response) {
    const key = pushNotificationsService.getPublicKey()
    if (!key) {
      return res.status(503).json({ success: false, error: 'Push notifications are not configured' })
    }
    res.json({ success: true, data: { publicKey: key } })
  }

  /**
   * POST /api/push/subscribe
   * Body: { endpoint, keys: { p256dh, auth } }
   */
  async subscribe(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const schoolId = req.profile?.school_id
      const campusId = req.profile?.campus_id

      if (!profileId || !schoolId) {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }

      const { endpoint, keys } = req.body
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ success: false, error: 'endpoint and keys.p256dh/keys.auth are required' })
      }

      await pushNotificationsService.subscribe({
        profileId,
        schoolId,
        campusId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers['user-agent'],
      })

      res.status(201).json({ success: true })
    } catch (error: any) {
      console.error('Push subscribe error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to save subscription' })
    }
  }

  /**
   * DELETE /api/push/subscribe
   * Body: { endpoint }
   */
  async unsubscribe(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      const { endpoint } = req.body

      if (!profileId) {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }
      if (!endpoint) {
        return res.status(400).json({ success: false, error: 'endpoint is required' })
      }

      await pushNotificationsService.unsubscribe(profileId, endpoint)
      res.json({ success: true })
    } catch (error: any) {
      console.error('Push unsubscribe error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to remove subscription' })
    }
  }

  /**
   * GET /api/push/stats?campus_id=...
   * Admin-only: active subscription count for the admin's school, by role.
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id
      if (!schoolId) {
        return res.status(403).json({ success: false, error: 'No school associated' })
      }

      const campusId = (req.query.campus_id as string | undefined) ?? null
      const stats = await pushNotificationsService.getStats(schoolId, campusId)
      res.json({ success: true, data: { isConfigured: stats.configured, total: stats.total, byRole: stats.byRole } })
    } catch (error: any) {
      console.error('Push stats error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to load push stats' })
    }
  }

  /**
   * POST /api/push/test
   * Admin-only: sends a test push notification to the calling admin's own subscriptions.
   */
  async sendTest(req: AuthRequest, res: Response) {
    try {
      const profileId = req.profile?.id
      if (!profileId) {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }

      const result = await pushNotificationsService.sendTest(profileId)
      if (result.sent === 0) {
        return res.status(400).json({ success: false, error: 'No active push subscription found for your account. Enable notifications on this device first.' })
      }
      res.json({ success: true, data: result })
    } catch (error: any) {
      console.error('Push test send error:', error)
      res.status(500).json({ success: false, error: error.message || 'Failed to send test notification' })
    }
  }
}

export const pushNotificationsController = new PushNotificationsController()
