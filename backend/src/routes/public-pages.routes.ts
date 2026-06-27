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
  getCustomLinks,
  addCustomLink,
  updateCustomLink,
  deleteCustomLink,
  reorderCustomLinks,
  getLoginLinks,
  getGlobalCustomLinks,
  addGlobalCustomLink,
  updateGlobalCustomLink,
  deleteGlobalCustomLink,
  reorderGlobalCustomLinks,
  getCustomLinksForRole,
  type CustomPageType,
} from '../services/public-pages.service'

const VALID_PAGE_TYPES: CustomPageType[] = ['url', 'embed', 'text', 'image']
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
 * POST /api/public/resolve-username
 * Resolves a username to its associated email for login purposes.
 * No authentication required — needed before the user can sign in.
 * Returns only { email } — no sensitive data exposed.
 */
router.post('/resolve-username', async (req: Request, res: Response) => {
  try {
    const { username } = req.body
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Username is required' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .ilike('username', username.trim())
      .eq('is_active', true)
      .single()

    if (error || !data?.email) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true, email: data.email })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================================================
// PUBLIC LOGIN LINKS — no auth, used by login page
// ============================================================================

/**
 * GET /api/public/login-links
 * Returns active custom link tabs for the school login page. No auth required.
 */
router.get('/login-links', async (_req: Request, res: Response) => {
  try {
    const links = await getLoginLinks()
    res.json({ success: true, data: links })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ============================================================================
// AUTHENTICATED USER — GET PAGES RELEVANT TO THEIR ROLE
// ============================================================================

router.get(
  '/my-pages',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const role = req.profile?.role ?? ''
      const pages = await getCustomLinksForRole(role)
      res.json({ success: true, data: pages })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

// ============================================================================
// SUPER ADMIN GLOBAL CUSTOM PAGES (no school context — single management panel)
// ============================================================================

router.get(
  '/superadmin/global-pages',
  authenticate,
  requireRole('super_admin'),
  async (_req: Request, res: Response) => {
    try {
      const links = await getGlobalCustomLinks()
      res.json({ success: true, data: links })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

router.post(
  '/superadmin/global-pages',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { title, page_type = 'url', url, content, image_url, isActive = true, target_roles, expires_at } = req.body
      if (!title?.trim()) return res.status(400).json({ success: false, error: 'title is required' })
      if (!VALID_PAGE_TYPES.includes(page_type)) return res.status(400).json({ success: false, error: `page_type must be one of: ${VALID_PAGE_TYPES.join(', ')}` })
      if ((page_type === 'url' || page_type === 'embed') && !url?.trim()) return res.status(400).json({ success: false, error: 'url is required for this page type' })
      if (page_type === 'text' && !content?.trim()) return res.status(400).json({ success: false, error: 'content is required for text pages' })
      if (page_type === 'image' && !image_url?.trim()) return res.status(400).json({ success: false, error: 'image_url is required for image pages' })
      const link = await addGlobalCustomLink({
        title, page_type, url, content, image_url,
        isActive: Boolean(isActive),
        target_roles: Array.isArray(target_roles) ? target_roles : [],
        expires_at: expires_at ?? null,
      })
      res.status(201).json({ success: true, data: link })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

router.put(
  '/superadmin/global-pages/reorder',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body
      if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, error: 'orderedIds must be an array' })
      const links = await reorderGlobalCustomLinks(orderedIds)
      res.json({ success: true, data: links })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

router.put(
  '/superadmin/global-pages/:pageId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { pageId } = req.params
      const { title, page_type, url, content, image_url, isActive, target_roles, expires_at } = req.body
      if (page_type !== undefined && !VALID_PAGE_TYPES.includes(page_type)) {
        return res.status(400).json({ success: false, error: `page_type must be one of: ${VALID_PAGE_TYPES.join(', ')}` })
      }
      const link = await updateGlobalCustomLink(pageId, {
        ...(title !== undefined ? { title } : {}),
        ...(page_type !== undefined ? { page_type } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(image_url !== undefined ? { image_url } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(target_roles !== undefined ? { target_roles: Array.isArray(target_roles) ? target_roles : [] } : {}),
        ...(expires_at !== undefined ? { expires_at: expires_at ?? null } : {}),
      })
      res.json({ success: true, data: link })
    } catch (err: any) {
      const status = err.message === 'Custom page not found' ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }
)

router.delete(
  '/superadmin/global-pages/:pageId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { pageId } = req.params
      await deleteGlobalCustomLink(pageId)
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

// ============================================================================
// SUPER ADMIN CUSTOM PAGES MANAGEMENT (per-school — kept for backward compat)
// ============================================================================

/**
 * GET /api/public/superadmin/pages/:schoolId
 * Returns all custom link pages for a school.
 */
router.get(
  '/superadmin/pages/:schoolId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId } = req.params
      const links = await getCustomLinks(schoolId)
      res.json({ success: true, data: links })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

/**
 * POST /api/public/superadmin/pages/:schoolId
 * Add a new custom link page to a school.
 */
router.post(
  '/superadmin/pages/:schoolId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId } = req.params
      const { title, page_type = 'url', url, content, image_url, isActive = true } = req.body

      if (!title?.trim()) return res.status(400).json({ success: false, error: 'title is required' })
      if (!VALID_PAGE_TYPES.includes(page_type)) return res.status(400).json({ success: false, error: `page_type must be one of: ${VALID_PAGE_TYPES.join(', ')}` })

      const link = await addCustomLink(schoolId, { title, page_type, url, content, image_url, isActive: Boolean(isActive) })
      res.status(201).json({ success: true, data: link })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

/**
 * PUT /api/public/superadmin/pages/:schoolId/reorder
 * Reorder custom pages by providing ordered array of IDs.
 * Must be declared BEFORE /:schoolId/:pageId to avoid route conflict.
 */
router.put(
  '/superadmin/pages/:schoolId/reorder',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId } = req.params
      const { orderedIds } = req.body
      if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, error: 'orderedIds must be an array' })
      const links = await reorderCustomLinks(schoolId, orderedIds)
      res.json({ success: true, data: links })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

/**
 * PUT /api/public/superadmin/pages/:schoolId/:pageId
 * Update a custom link page.
 */
router.put(
  '/superadmin/pages/:schoolId/:pageId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId, pageId } = req.params
      const { title, page_type, url, content, image_url, isActive } = req.body
      const link = await updateCustomLink(schoolId, pageId, {
        ...(title !== undefined ? { title } : {}),
        ...(page_type !== undefined ? { page_type } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(image_url !== undefined ? { image_url } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      })
      res.json({ success: true, data: link })
    } catch (err: any) {
      const status = err.message === 'Custom page not found' ? 404 : 500
      res.status(status).json({ success: false, error: err.message })
    }
  }
)

/**
 * DELETE /api/public/superadmin/pages/:schoolId/:pageId
 * Delete a custom link page.
 */
router.delete(
  '/superadmin/pages/:schoolId/:pageId',
  authenticate,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    try {
      const { schoolId, pageId } = req.params
      await deleteCustomLink(schoolId, pageId)
      res.json({ success: true })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message })
    }
  }
)

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
