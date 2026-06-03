import { Router, Response } from 'express'
import {
  markingPeriodsService,
  CreateMarkingPeriodDTO,
  UpdateMarkingPeriodDTO,
  MarkingPeriodType,
} from '../services/marking-periods.service'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'

const router = Router()

// Apply auth middleware to all routes
router.use(authenticate)

// ============================================================================
// GET /api/marking-periods
// Get all marking periods for the school (flat list)
// ============================================================================
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const data = await markingPeriodsService.getAll(schoolId, campusId)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching marking periods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// GET /api/marking-periods/grouped
// Get marking periods grouped by type (FY, SEM, QTR, PRO) for UI
// ============================================================================
router.get('/grouped', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const data = await markingPeriodsService.getGroupedByType(schoolId, campusId)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching grouped marking periods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// GET /api/marking-periods/current
// Get currently active marking periods (by date range)
// ============================================================================
router.get('/current', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id
    const mpType = req.query.mp_type as MarkingPeriodType | undefined

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const data = await markingPeriodsService.getCurrent(schoolId, mpType, campusId)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching current marking period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// GET /api/marking-periods/:id
// Get a single marking period by ID
// ============================================================================
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const data = await markingPeriodsService.getById(id)

    if (!data) {
      return res.status(404).json({ success: false, error: 'Marking period not found' })
    }

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching marking period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// GET /api/marking-periods/:id/children
// Get children of a marking period
// ============================================================================
router.get('/:id/children', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const data = await markingPeriodsService.getChildren(id)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching children:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ============================================================================
// POST /api/marking-periods
// Create a new marking period
// ============================================================================
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = req.body.campus_id || req.profile?.campus_id || null

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const dto: CreateMarkingPeriodDTO = {
      mp_type: req.body.mp_type,
      parent_id: req.body.parent_id || null,
      title: req.body.title,
      short_name: req.body.short_name,
      sort_order: req.body.sort_order,
      does_grades: req.body.does_grades,
      does_comments: req.body.does_comments,
      start_date: req.body.start_date || null,
      end_date: req.body.end_date || null,
      post_start_date: req.body.post_start_date || null,
      post_end_date: req.body.post_end_date || null,
    }

    // Validate required fields
    if (!dto.mp_type || !dto.title || !dto.short_name) {
      return res.status(400).json({
        success: false,
        error: 'mp_type, title, and short_name are required',
      })
    }

    if (!['FY', 'SEM', 'QTR', 'PRO'].includes(dto.mp_type)) {
      return res.status(400).json({
        success: false,
        error: 'mp_type must be one of: FY, SEM, QTR, PRO',
      })
    }

    const data = await markingPeriodsService.create(schoolId, campusId, dto)

    res.status(201).json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating marking period:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ============================================================================
// PUT /api/marking-periods/:id
// Update a marking period
// ============================================================================
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const dto: UpdateMarkingPeriodDTO = {}
    if (req.body.title !== undefined) dto.title = req.body.title
    if (req.body.short_name !== undefined) dto.short_name = req.body.short_name
    if (req.body.sort_order !== undefined) dto.sort_order = req.body.sort_order
    if (req.body.does_grades !== undefined) dto.does_grades = req.body.does_grades
    if (req.body.does_comments !== undefined) dto.does_comments = req.body.does_comments
    if (req.body.start_date !== undefined) dto.start_date = req.body.start_date
    if (req.body.end_date !== undefined) dto.end_date = req.body.end_date
    if (req.body.post_start_date !== undefined) dto.post_start_date = req.body.post_start_date
    if (req.body.post_end_date !== undefined) dto.post_end_date = req.body.post_end_date

    const data = await markingPeriodsService.update(id, dto)

    res.json({ success: true, data })
  } catch (error: any) {
    console.error('Error updating marking period:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ============================================================================
// DELETE /api/marking-periods/:id
// Delete a marking period (soft delete, cascades to children)
// ============================================================================
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await markingPeriodsService.delete(id)

    res.json({ success: true, message: 'Marking period deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting marking period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
