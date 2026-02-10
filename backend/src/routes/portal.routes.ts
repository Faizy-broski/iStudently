import { Router, Response } from 'express'
import { portalService } from '../services/portal.service'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'

const router = Router()

// Apply authentication to all routes
router.use(authenticate)

// ================================================================
// DEBUG ROUTE (Remove after testing)
// ================================================================
router.get('/debug/notes', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string) || req.profile?.campus_id
    
    // Get ALL notes without any filtering
    const { data: allNotes, error } = await supabase
      .from('portal_notes')
      .select('id, title, school_id, campus_id, visible_to_roles, is_active, visible_from, visible_until')
      .eq('school_id', schoolId)
    
    console.log('🔍 DEBUG - All notes in school:', allNotes)
    console.log('🔍 DEBUG - Looking for campus_id:', campusId)
    
    // Filter to show what matches
    const matchingCampus = allNotes?.filter(n => n.campus_id === campusId)
    console.log('🔍 DEBUG - Notes matching campus:', matchingCampus)
    
    res.json({ 
      success: true, 
      debug: {
        school_id: schoolId,
        requested_campus_id: campusId,
        total_notes_in_school: allNotes?.length || 0,
        notes_matching_campus: matchingCampus?.length || 0,
        all_notes: allNotes,
        matching_notes: matchingCampus
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ================================================================
// NOTES ROUTES
// ================================================================

/**
 * GET /portal/notes
 * Get all notes for the school (with role-based filtering for non-admins)
 */
router.get('/notes', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const campusId = (req.query.campus_id as string) || req.profile?.campus_id
    const role = req.profile?.role
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const includeInactive = req.query.include_inactive === 'true' && role === 'admin'

    console.log('🔔 GET /notes - Profile:', { 
      role, 
      schoolId, 
      campusId, 
      profileCampusId: req.profile?.campus_id,
      queryCampusId: req.query.campus_id 
    })

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    if (!campusId) {
      return res.status(400).json({ success: false, error: 'Campus ID required' })
    }

    // Admins see all notes, others see only their role's notes
    const filterRole = role === 'admin' ? undefined : role
    console.log('🔔 GET /notes - Filtering with role:', filterRole)

    const result = await portalService.getNotes(schoolId, campusId, {
      role: filterRole,
      includeInactive,
      page,
      limit
    })

    res.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error fetching notes:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /portal/notes/:id
 * Get a single note by ID
 */
router.get('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const note = await portalService.getNoteById(id)

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' })
    }

    res.json({ success: true, data: note })
  } catch (error: any) {
    console.error('Error fetching note:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /portal/notes
 * Create a new note (admin only)
 */
router.post('/notes', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const userId = req.profile?.id
    const role = req.profile?.role
    const campusId = req.body.campus_id || req.profile?.campus_id

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can create notes' })
    }

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    if (!campusId) {
      return res.status(400).json({ success: false, error: 'Campus ID required' })
    }

    const note = await portalService.createNote({
      ...req.body,
      school_id: schoolId,
      campus_id: campusId,
      created_by: userId
    })

    res.status(201).json({ success: true, data: note })
  } catch (error: any) {
    console.error('Error creating note:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /portal/notes/:id
 * Update a note (admin only)
 */
router.put('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can update notes' })
    }

    const note = await portalService.updateNote(id, req.body)

    res.json({ success: true, data: note })
  } catch (error: any) {
    console.error('Error updating note:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /portal/notes/:id
 * Delete a note (admin only)
 */
router.delete('/notes/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can delete notes' })
    }

    await portalService.deleteNote(id)

    res.json({ success: true, message: 'Note deleted' })
  } catch (error: any) {
    console.error('Error deleting note:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ================================================================
// POLLS ROUTES
// ================================================================

/**
 * GET /portal/polls
 * Get all polls for the school
 */
router.get('/polls', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const userId = req.profile?.id
    const campusId = (req.query.campus_id as string) || req.profile?.campus_id
    const role = req.profile?.role
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const includeInactive = req.query.include_inactive === 'true' && role === 'admin'

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    if (!campusId) {
      return res.status(400).json({ success: false, error: 'Campus ID required' })
    }

    const result = await portalService.getPolls(schoolId, campusId, {
      role: role === 'admin' ? undefined : role,
      userId,
      includeInactive,
      page,
      limit
    })

    res.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Error fetching polls:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /portal/polls/:id
 * Get a single poll with questions
 */
router.get('/polls/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.profile?.id

    const poll = await portalService.getPollById(id, userId)

    if (!poll) {
      return res.status(404).json({ success: false, error: 'Poll not found' })
    }

    res.json({ success: true, data: poll })
  } catch (error: any) {
    console.error('Error fetching poll:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /portal/polls
 * Create a new poll with questions (admin only)
 */
router.post('/polls', async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    const userId = req.profile?.id
    const role = req.profile?.role
    const campusId = req.body.campus_id || req.profile?.campus_id

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can create polls' })
    }

    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'School ID required' })
    }

    if (!campusId) {
      return res.status(400).json({ success: false, error: 'Campus ID required' })
    }

    const poll = await portalService.createPoll({
      ...req.body,
      school_id: schoolId,
      campus_id: campusId,
      created_by: userId
    })

    res.status(201).json({ success: true, data: poll })
  } catch (error: any) {
    console.error('Error creating poll:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /portal/polls/:id
 * Update a poll (admin only)
 */
router.put('/polls/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can update polls' })
    }

    const poll = await portalService.updatePoll(id, req.body)

    res.json({ success: true, data: poll })
  } catch (error: any) {
    console.error('Error updating poll:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /portal/polls/:id
 * Delete a poll (admin only)
 */
router.delete('/polls/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can delete polls' })
    }

    await portalService.deletePoll(id)

    res.json({ success: true, message: 'Poll deleted' })
  } catch (error: any) {
    console.error('Error deleting poll:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /portal/polls/:id/results
 * Get poll results (admin only, or if show_results is enabled)
 */
router.get('/polls/:id/results', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    // Check if user can view results
    const poll = await portalService.getPollById(id)
    if (!poll) {
      return res.status(404).json({ success: false, error: 'Poll not found' })
    }

    if (role !== 'admin' && !poll.show_results) {
      return res.status(403).json({ success: false, error: 'Results not available' })
    }

    const results = await portalService.getPollResults(id)

    res.json({ success: true, data: results })
  } catch (error: any) {
    console.error('Error fetching results:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /portal/polls/:id/respond
 * Submit responses to a poll
 */
router.post('/polls/:id/respond', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.profile?.id
    const { responses } = req.body

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ success: false, error: 'Responses array required' })
    }

    // Check if poll exists and is active
    const poll = await portalService.getPollById(id)
    if (!poll) {
      return res.status(404).json({ success: false, error: 'Poll not found' })
    }

    if (!poll.is_active) {
      return res.status(400).json({ success: false, error: 'Poll is closed' })
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' })
    }

    await portalService.submitResponses(
      id,
      userId,
      responses
    )

    res.json({ success: true, message: 'Response submitted' })
  } catch (error: any) {
    console.error('Error submitting response:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /portal/polls/:id/my-responses
 * Get current user's responses to a poll
 */
router.get('/polls/:id/my-responses', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.profile?.id

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID required' })
    }

    const responses = await portalService.getUserResponses(id, userId)

    res.json({ success: true, data: responses })
  } catch (error: any) {
    console.error('Error fetching responses:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ================================================================
// QUESTIONS ROUTES (Admin only)
// ================================================================

/**
 * POST /portal/polls/:pollId/questions
 * Add a question to a poll
 */
router.post('/polls/:pollId/questions', async (req: AuthRequest, res: Response) => {
  try {
    const { pollId } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can add questions' })
    }

    const question = await portalService.addQuestion(pollId, req.body)

    res.status(201).json({ success: true, data: question })
  } catch (error: any) {
    console.error('Error adding question:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /portal/questions/:id
 * Update a question
 */
router.put('/questions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can update questions' })
    }

    const question = await portalService.updateQuestion(id, req.body)

    res.json({ success: true, data: question })
  } catch (error: any) {
    console.error('Error updating question:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /portal/questions/:id
 * Delete a question
 */
router.delete('/questions/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const role = req.profile?.role

    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can delete questions' })
    }

    await portalService.deleteQuestion(id)

    res.json({ success: true, message: 'Question deleted' })
  } catch (error: any) {
    console.error('Error deleting question:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
