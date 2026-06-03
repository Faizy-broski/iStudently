import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { parentAgreementService } from '../services/parent-agreement.service'
import { supabase } from '../config/supabase'

const router = Router()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/parent-agreement/check
 * Check if the logged-in parent needs to accept the agreement,
 * or if a student is blocked because their parent hasn't accepted.
 * Works for both parent and student roles.
 */
router.get('/check', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }

    const schoolId = profile.school_id
    if (!schoolId) {
      res.json({ success: true, data: { must_accept: false, blocked: false } })
      return
    }

    if (profile.role === 'parent') {
      // Resolve parent_id from parents table
      const { data: parentRecord } = await supabase
        .from('parents')
        .select('id')
        .eq('profile_id', profile.id)
        .single()

      if (!parentRecord) {
        res.json({ success: true, data: { must_accept: false, blocked: false } })
        return
      }

      const result = await parentAgreementService.checkParentStatus(parentRecord.id, schoolId)
      res.json({
        success: true,
        data: {
          must_accept: result.must_accept,
          blocked: false,
          agreement: result.agreement || null,
          students_needing_acceptance: result.students_needing_acceptance || [],
        },
      })
      return
    }

    if (profile.role === 'student') {
      const studentId = profile.student_id
      if (!studentId) {
        res.json({ success: true, data: { must_accept: false, blocked: false } })
        return
      }

      // Resolve campus_id from student's section
      const { data: studentRecord } = await supabase
        .from('students')
        .select('section:sections(campus_id)')
        .eq('id', studentId)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const campusId = (studentRecord as any)?.section?.campus_id || null

      const result = await parentAgreementService.checkStudentStatus(studentId, schoolId, campusId)
      res.json({
        success: true,
        data: {
          must_accept: false,
          blocked: result.blocked,
          message: result.message || null,
        },
      })
      return
    }

    // Other roles — not affected
    res.json({ success: true, data: { must_accept: false, blocked: false } })
  } catch (error: any) {
    console.error('Parent agreement check error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/parent-agreement/accept
 * Parent accepts the agreement for all their linked students.
 */
router.post('/accept', requireRole('parent'), async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile?.school_id) {
      res.status(400).json({ success: false, error: 'Parent profile required' })
      return
    }

    // Resolve parent_id from parents table
    const { data: parentRecord } = await supabase
      .from('parents')
      .select('id')
      .eq('profile_id', profile.id)
      .single()

    if (!parentRecord) {
      res.status(400).json({ success: false, error: 'Parent record not found' })
      return
    }

    await parentAgreementService.acceptAgreement(parentRecord.id, profile.school_id)

    res.json({ success: true, message: 'Agreement accepted' })
  } catch (error: any) {
    console.error('Parent agreement accept error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/parent-agreement/config
 * Admin: get agreement configuration (title + content) for the current campus.
 */
router.get('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated' })
      return
    }

    const campusId = req.query.campus_id as string | undefined

    const config = await parentAgreementService.getConfig(schoolId, campusId || null)

    res.json({ success: true, data: config })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/parent-agreement/config
 * Admin: update agreement configuration (title + content).
 */
router.put('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated' })
      return
    }

    const campusId = (req.query.campus_id as string | undefined) || req.body.campus_id || null
    const { title, content } = req.body

    if (!title || !content) {
      res.status(400).json({ success: false, error: 'Title and content are required' })
      return
    }

    await parentAgreementService.updateConfig(schoolId, campusId, { title, content })

    res.json({ success: true, message: 'Agreement configuration saved' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
