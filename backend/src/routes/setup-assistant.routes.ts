import { Router, Request, Response } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { SetupAssistantService } from '../services/setup-assistant.service'

const router = Router()
const service = new SetupAssistantService()

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id?: string
    role?: string
  }
}

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/setup-assistant/config
 * Get which profiles are enabled (admin only)
 */
router.get('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

    const campusId = req.query.campus_id as string | undefined
    const config = await service.getConfig(schoolId, campusId)
    res.json({ success: true, data: config })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/setup-assistant/config
 * Update which profiles are enabled (admin only)
 */
router.put('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' }); return }

    const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
    const { config } = req.body

    if (!config || typeof config !== 'object') {
      res.status(400).json({ success: false, error: 'config must be an object' })
      return
    }

    await service.updateConfig(schoolId, config, campusId)
    res.json({ success: true, message: 'Configuration saved' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/setup-assistant/progress
 * Get current user's progress (completed steps + dismissed state)
 */
router.get('/progress', async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id
    const schoolId = req.profile?.school_id
    if (!profileId || !schoolId) {
      res.status(403).json({ success: false, error: 'No profile or school associated' })
      return
    }

    const progress = await service.getProgress(profileId, schoolId)
    res.json({ success: true, data: progress })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/setup-assistant/complete-step
 * Mark a step as complete for current user
 */
router.post('/complete-step', async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id
    const schoolId = req.profile?.school_id
    if (!profileId || !schoolId) {
      res.status(403).json({ success: false, error: 'No profile or school associated' })
      return
    }

    const { step_id } = req.body
    if (!step_id || typeof step_id !== 'string') {
      res.status(400).json({ success: false, error: 'step_id is required' })
      return
    }

    await service.completeStep(profileId, schoolId, step_id)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/setup-assistant/dismiss
 * Dismiss the assistant for current user
 */
router.post('/dismiss', async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id
    const schoolId = req.profile?.school_id
    if (!profileId || !schoolId) {
      res.status(403).json({ success: false, error: 'No profile or school associated' })
      return
    }

    await service.dismiss(profileId, schoolId)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
