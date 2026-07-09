import { Router, Response } from 'express'
import {
  markingPeriodGroupsService,
  CreateMarkingPeriodGroupDTO,
  UpdateMarkingPeriodGroupDTO,
} from '../services/marking-period-groups.service'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// ============================================================================
// GET /api/marking-period-groups
// List groups for the school (readable by any authenticated user — needed to
// resolve/filter the Quarters dropdown for every role)
// ============================================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const data = await markingPeriodGroupsService.getAll(schoolId, campusId)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching marking period groups:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// GET /api/marking-period-groups/:id
// ============================================================================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const data = await markingPeriodGroupsService.getById(id)

    if (!data) {
      return res.status(404).json({ success: false, error: 'Marking period group not found' })
    }

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching marking period group:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// POST /api/marking-period-groups (admin only)
// ============================================================================
router.post('/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = req.body.campus_id || req.profile?.campus_id || null

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const dto: CreateMarkingPeriodGroupDTO = { name: req.body.name }
    const data = await markingPeriodGroupsService.create(schoolId, campusId, dto)

    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating marking period group:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ============================================================================
// PUT /api/marking-period-groups/:id (admin only)
// ============================================================================
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const dto: UpdateMarkingPeriodGroupDTO = {}
    if (req.body.name !== undefined) dto.name = req.body.name

    const data = await markingPeriodGroupsService.update(id, dto)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating marking period group:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ============================================================================
// DELETE /api/marking-period-groups/:id (admin only) — Default group is protected
// ============================================================================
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    await markingPeriodGroupsService.delete(id)

    res.json({ success: true, message: 'Marking period group deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting marking period group:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
