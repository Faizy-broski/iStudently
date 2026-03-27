import { Router, Request, Response } from 'express'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import type { AuthRequest } from '../middlewares/auth.middleware'
import {
  getSchoolBySlug,
  getPublicPagesConfig,
  savePublicPagesConfig,
  getPublicSchoolInfo,
  getPublicEvents,
  getPublicMarkingPeriods,
  getPublicCourses,
  getPublicActivities,
  getPublicStaff,
  ALL_PUBLIC_PAGES,
} from '../services/public-pages.service'
import { supabase } from '../config/supabase'

const router = Router()

// ============================================================================
// HELPERS
// ============================================================================

/** If the school IS a campus (has parent_school_id), use its own id as campusId. */
function resolveCampusId(school: { id: string; parent_school_id: string | null }) {
  return school.parent_school_id ? school.id : null
}

/** Look up school by slug and validate the public_pages plugin is active for a given page. */
async function resolvePublicSchool(slug: string, pageId?: string) {
  const school = await getSchoolBySlug(slug)
  if (!school) return { school: null, config: null, campusId: null, dataSchoolId: null, error: 'School not found' }

  const campusId = resolveCampusId(school)
  // For campuses, school_settings and data rows use parent_school_id as school_id
  const settingsSchoolId = school.parent_school_id ?? school.id
  // Data (events, courses, etc.) is stored under parent_school_id for campuses
  const dataSchoolId = school.parent_school_id ?? school.id
  const { config, isActive } = await getPublicPagesConfig(settingsSchoolId, campusId)

  if (!isActive) {
    return { school, config, campusId, dataSchoolId, error: 'Public pages are not enabled for this school' }
  }

  if (pageId && !config.pages.includes(pageId as any)) {
    return { school, config, campusId, dataSchoolId, error: `Page '${pageId}' is not enabled` }
  }

  return { school, config, campusId, dataSchoolId, error: null }
}

// ============================================================================
// ADMIN CONFIG ROUTES — MUST be registered BEFORE /:slug to avoid shadowing
// ============================================================================

/**
 * GET /api/public/config/settings
 * Returns full public pages config for the admin's school (includes custom page content)
 */
router.get(
  '/config/settings',
  authenticate,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const profile = (req as AuthRequest).profile
      const schoolId = profile?.school_id
      if (!schoolId) return res.status(403).json({ success: false, error: 'No school associated with account' })

      const campusId = profile?.campus_id || null
      const { config } = await getPublicPagesConfig(schoolId, campusId)

      res.json({ success: true, data: { config, available_pages: ALL_PUBLIC_PAGES } })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

/**
 * PUT /api/public/config/settings
 * Save public pages config for the admin's school
 */
router.put(
  '/config/settings',
  authenticate,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response) => {
    try {
      const profile = (req as AuthRequest).profile
      const schoolId = profile?.school_id
      if (!schoolId) return res.status(403).json({ success: false, error: 'No school associated with account' })

      const campusId = profile?.campus_id || null
      const { enabled, pages, default_page, custom_page_title, custom_page_content } = req.body

      const config = {
        enabled: Boolean(enabled),
        pages: Array.isArray(pages) ? pages : [],
        default_page: default_page || 'login',
        custom_page_title: custom_page_title || '',
        custom_page_content: custom_page_content || '',
      }

      await savePublicPagesConfig(schoolId, config, campusId)

      res.json({ success: true, message: 'Public pages configuration saved', data: config })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

// ============================================================================
// PUBLIC ROUTES — no authentication required
// ============================================================================

/**
 * GET /api/public/social-login-config
 * Returns which social login providers are enabled AND have credentials configured.
 * No authentication required — the login page needs this before the user signs in.
 * Returns school_id so the login page can pass it to the OAuth initiation endpoint.
 */
router.get('/social-login-config', async (_req: Request, res: Response) => {
  try {
    // Find parent schools (schools without a parent_school_id)
    const { data: parentSchools, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .is('parent_school_id', null)
      .eq('status', 'active')
      .limit(1)

    if (schoolError || !parentSchools?.length) {
      return res.json({
        success: true,
        data: { google_enabled: false, microsoft_enabled: false, school_id: null },
      })
    }

    const schoolId = parentSchools[0].id

    // Get school-level settings (campus_id IS NULL)
    const { data: settings } = await supabase
      .from('school_settings')
      .select('active_plugins, social_login_config')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()

    const cfg = settings?.social_login_config ?? {}

    // Only show a provider as enabled if both: plugin is active AND credentials are configured
    const googleEnabled = settings?.active_plugins?.google_social_login === true &&
      !!cfg.google_client_id && !!cfg.google_client_secret
    const microsoftEnabled = settings?.active_plugins?.microsoft_social_login === true &&
      !!cfg.microsoft_client_id && !!cfg.microsoft_client_secret

    res.json({
      success: true,
      data: {
        google_enabled: googleEnabled,
        microsoft_enabled: microsoftEnabled,
        school_id: schoolId,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug
 * Returns school info + public pages config (which pages are enabled, default page)
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const school = await getSchoolBySlug(slug)

    if (!school) {
      return res.status(404).json({ success: false, error: 'School not found' })
    }

    const campusId = resolveCampusId(school)
    const settingsSchoolId = school.parent_school_id ?? school.id
    const { config, isActive } = await getPublicPagesConfig(settingsSchoolId, campusId)

    if (!isActive) {
      return res.status(403).json({ success: false, error: 'Public pages are not enabled for this school' })
    }

    const info = await getPublicSchoolInfo(school.id)

    res.json({
      success: true,
      data: {
        school: info,
        config: {
          pages: config.pages,
          default_page: config.default_page,
          custom_page_title: config.custom_page_title,
        },
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/events
 */
router.get('/:slug/events', async (req: Request, res: Response) => {
  try {
    const { school, campusId, dataSchoolId, error } = await resolvePublicSchool(req.params.slug, 'events')
    if (error || !school || !dataSchoolId) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    const data = await getPublicEvents(dataSchoolId, campusId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/marking-periods
 */
router.get('/:slug/marking-periods', async (req: Request, res: Response) => {
  try {
    const { school, campusId, dataSchoolId, error } = await resolvePublicSchool(req.params.slug, 'marking-periods')
    if (error || !school || !dataSchoolId) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    const data = await getPublicMarkingPeriods(dataSchoolId, campusId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/courses
 */
router.get('/:slug/courses', async (req: Request, res: Response) => {
  try {
    const { school, campusId, dataSchoolId, error } = await resolvePublicSchool(req.params.slug, 'courses')
    if (error || !school || !dataSchoolId) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    const data = await getPublicCourses(dataSchoolId, campusId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/activities
 */
router.get('/:slug/activities', async (req: Request, res: Response) => {
  try {
    const { school, campusId, dataSchoolId, error } = await resolvePublicSchool(req.params.slug, 'activities')
    if (error || !school || !dataSchoolId) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    const data = await getPublicActivities(dataSchoolId, campusId)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/staff
 */
router.get('/:slug/staff', async (req: Request, res: Response) => {
  try {
    const { school, campusId, error } = await resolvePublicSchool(req.params.slug, 'staff')
    if (error || !school) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    // Staff is stored with school_id = campus's own id (via getEffectiveSchoolId in staff controller)
    const staffSchoolId = campusId ?? school.id
    const data = await getPublicStaff(staffSchoolId, null)
    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/public/:slug/custom
 * Returns the custom page title + HTML content
 */
router.get('/:slug/custom', async (req: Request, res: Response) => {
  try {
    const { school, config, error } = await resolvePublicSchool(req.params.slug, 'custom')
    if (error || !school || !config) return res.status(error === 'School not found' ? 404 : 403).json({ success: false, error })

    res.json({
      success: true,
      data: {
        title: config.custom_page_title,
        content: config.custom_page_content,
      },
    })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
