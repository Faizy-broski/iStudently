import { Router, Response } from 'express'
import { periodsService, CreatePeriodDTO, UpdatePeriodDTO } from '../services/periods.service'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'

const router = Router()

// Apply auth middleware to all routes
router.use(authenticate)

/**
 * GET /api/periods
 * Get all periods for the school
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const periods = await periodsService.getPeriods(schoolId, campusId)
    
    res.json({
      success: true,
      data: periods
    })
  } catch (error: any) {
    console.error('Error fetching periods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/periods/by-name/:shortName
 * Get a single period by short_name
 */
router.get('/by-name/:shortName', async (req: AuthRequest, res: Response) => {
  try {
    const { shortName } = req.params
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const period = await periodsService.getPeriodByShortName(decodeURIComponent(shortName), schoolId, campusId)
    
    if (!period) {
      return res.status(404).json({ success: false, error: 'Period not found' })
    }

    res.json({
      success: true,
      data: period
    })
  } catch (error: any) {
    console.error('Error fetching period by name:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/periods/by-name/:shortName/classes
 * Get all timetable entries (classes) for a specific period by short_name
 */
router.get('/by-name/:shortName/classes', async (req: AuthRequest, res: Response) => {
  try {
    const { shortName } = req.params
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    // First get the period by name
    const period = await periodsService.getPeriodByShortName(decodeURIComponent(shortName), schoolId, campusId)
    
    if (!period) {
      return res.status(404).json({ success: false, error: 'Period not found' })
    }

    // Then get the classes for this period
    const classes = await periodsService.getPeriodClasses(period.id, campusId)
    
    res.json({
      success: true,
      data: classes
    })
  } catch (error: any) {
    console.error('Error fetching period classes by name:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/periods/:id
 * Get a single period by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const period = await periodsService.getPeriodById(id)
    
    if (!period) {
      return res.status(404).json({ success: false, error: 'Period not found' })
    }

    res.json({
      success: true,
      data: period
    })
  } catch (error: any) {
    console.error('Error fetching period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/periods/:id/classes
 * Get all timetable entries (classes) for a specific period
 */
router.get('/:id/classes', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const campusId = (req.query.campus_id as string | undefined) || req.profile?.campus_id

    const classes = await periodsService.getPeriodClasses(id, campusId)
    
    res.json({
      success: true,
      data: classes
    })
  } catch (error: any) {
    console.error('Error fetching period classes:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/periods
 * Create a new period
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = req.body.campus_id || req.profile?.campus_id || null

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    const periodData: CreatePeriodDTO = {
      title: req.body.title,
      short_name: req.body.short_name,
      sort_order: req.body.sort_order,
      start_time: req.body.start_time || null,
      end_time: req.body.end_time || null,
      length_minutes: req.body.length_minutes,
      block: req.body.block
    }

    // Validate required fields
    if (!periodData.title || !periodData.short_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and short name are required' 
      })
    }

    const period = await periodsService.createPeriod(schoolId, campusId, periodData)
    
    res.status(201).json({
      success: true,
      data: period
    })
  } catch (error: any) {
    console.error('Error creating period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/periods/:id
 * Update a period
 */
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const updateData: UpdatePeriodDTO = {}
    if (req.body.title !== undefined) updateData.title = req.body.title
    if (req.body.short_name !== undefined) updateData.short_name = req.body.short_name
    if (req.body.sort_order !== undefined) updateData.sort_order = req.body.sort_order
    if (req.body.start_time !== undefined) updateData.start_time = req.body.start_time
    if (req.body.end_time !== undefined) updateData.end_time = req.body.end_time
    if (req.body.length_minutes !== undefined) updateData.length_minutes = req.body.length_minutes
    if (req.body.block !== undefined) updateData.block = req.body.block

    const period = await periodsService.updatePeriod(id, updateData)
    
    res.json({
      success: true,
      data: period
    })
  } catch (error: any) {
    console.error('Error updating period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/periods/:id
 * Delete a period
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await periodsService.deletePeriod(id)
    
    res.json({
      success: true,
      message: 'Period deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting period:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/periods/bulk
 * Save all periods (replaces existing)
 */
router.post('/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = req.body.campus_id || req.profile?.campus_id || null
    const periods = req.body.periods as CreatePeriodDTO[]

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    if (!Array.isArray(periods)) {
      return res.status(400).json({ success: false, error: 'Periods array required' })
    }

    const savedPeriods = await periodsService.saveAllPeriods(schoolId, campusId, periods)
    
    res.json({
      success: true,
      data: savedPeriods
    })
  } catch (error: any) {
    console.error('Error saving periods:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
