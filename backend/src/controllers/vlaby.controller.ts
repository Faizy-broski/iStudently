import { Request, Response } from 'express'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id: string
    campus_id?: string
    role: string
  }
}

const VLABY_BASE = 'https://vlaby.com/api'

// ─── Supported locales ────────────────────────────────────────────────────────

const SUPPORTED_LOCALES = ['en', 'ar', 'fr', 'de', 'id']

function resolveLocale(req: Request): string {
  const raw = (req.headers['x-locale'] as string | undefined) ?? 'en'
  const lang = raw.slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(lang) ? lang : 'en'
}

// ─── VLaby proxy helpers ──────────────────────────────────────────────────────

async function proxyGet(
  url: string,
  token?: string | null,
  locale = 'en'
): Promise<{ httpStatus: number; body: any }> {
  const headers: Record<string, string> = { locale }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const response = await fetch(url, { headers })
  const body = await response.json().catch(() => null)
  return { httpStatus: response.status, body }
}

async function proxyPost(
  url: string,
  data: Record<string, string>,
  locale = 'en'
): Promise<{ httpStatus: number; body: any }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', locale },
    body: JSON.stringify(data),
  })
  const body = await response.json().catch(() => null)
  return { httpStatus: response.status, body }
}

function sendTokenExpired(res: Response): void {
  res.status(401).json({
    success: false,
    error: 'VLaby session expired. Please log in again.',
    code: 'VLABY_TOKEN_EXPIRED',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' })
    return
  }

  try {
    const { body } = await proxyPost(
      `${VLABY_BASE}/login`,
      { email, password },
      resolveLocale(req)
    )

    if (!body?.status || !body?.data?.user?.token) {
      const msg = body?.errors
        ? Array.isArray(body.errors)
          ? body.errors.join(' ')
          : JSON.stringify(body.errors)
        : body?.message || body?.msg || 'Login failed'
      res.status(401).json({ success: false, error: msg })
      return
    }

    res.json({ success: true, data: { token: body.data.user.token, user: body.data.user } })
  } catch (err: any) {
    console.error('VLaby login error:', err)
    res.status(502).json({ success: false, error: 'Could not reach VLaby API' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public catalog (no VLaby token required)
// ─────────────────────────────────────────────────────────────────────────────

export const getCatalog = async (req: AuthRequest, res: Response): Promise<void> => {
  const { country_id, level_id, level_class_id, semester_id, subject_id, search, page, length_page } = req.query
  const qs = new URLSearchParams()
  if (country_id)     qs.set('country_id',    String(country_id))
  if (level_id)       qs.set('level_id',       String(level_id))
  if (level_class_id) qs.set('level_class_id', String(level_class_id))
  if (semester_id)    qs.set('semester_id',    String(semester_id))
  if (subject_id)     qs.set('subject_id',     String(subject_id))
  if (search)         qs.set('search',         String(search))
  if (page)           qs.set('page',           String(page))
  if (length_page)    qs.set('length_page',    String(length_page))

  const url = `${VLABY_BASE}/experiments${qs.toString() ? '?' + qs.toString() : ''}`

  try {
    const { body } = await proxyGet(url, null, resolveLocale(req))

    if (!body?.status) {
      res.status(502).json({ success: false, error: body?.message || body?.msg || 'Failed to fetch catalog' })
      return
    }

    // VLaby wraps the paginator under body.data.experiments
    // Normalise to a flat paginator: { data: [...], current_page, last_page, total }
    const paginator = body.data?.experiments ?? body.data
    res.json({ success: true, data: paginator })
  } catch (err: any) {
    console.error('VLaby catalog error:', err)
    res.status(502).json({ success: false, error: 'Could not reach VLaby API' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User-specific experiments (requires VLaby token)
// ─────────────────────────────────────────────────────────────────────────────

export const getUserExperiments = async (req: AuthRequest, res: Response): Promise<void> => {
  const vlabyToken = req.headers['x-vlaby-token'] as string | undefined
  if (!vlabyToken) {
    res.status(401).json({ success: false, error: 'VLaby session token missing. Please log in to VLaby first.' })
    return
  }

  try {
    const { httpStatus, body } = await proxyGet(
      `${VLABY_BASE}/user/experiments`,
      vlabyToken,
      resolveLocale(req)
    )

    if (!body?.status) {
      if (httpStatus === 401) { sendTokenExpired(res); return }
      res.status(502).json({ success: false, error: body?.message || body?.msg || 'Failed to fetch experiments' })
      return
    }

    res.json({ success: true, data: { experiments: body?.data?.experiments ?? [] } })
  } catch (err: any) {
    console.error('VLaby user experiments error:', err)
    res.status(502).json({ success: false, error: 'Could not reach VLaby API' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single experiment detail (requires VLaby token)
// ─────────────────────────────────────────────────────────────────────────────

export const getExperiment = async (req: AuthRequest, res: Response): Promise<void> => {
  const vlabyToken = req.headers['x-vlaby-token'] as string | undefined
  if (!vlabyToken) {
    res.status(401).json({ success: false, error: 'VLaby session token missing. Please log in to VLaby first.' })
    return
  }

  const { id } = req.params
  if (!id || !/^\d+$/.test(id)) {
    res.status(400).json({ success: false, error: 'Invalid experiment ID' })
    return
  }

  try {
    const { httpStatus, body } = await proxyGet(
      `${VLABY_BASE}/experiment/${id}`,
      vlabyToken,
      resolveLocale(req)
    )

    if (!body?.status) {
      if (httpStatus === 401) { sendTokenExpired(res); return }
      res.status(502).json({ success: false, error: body?.message || body?.msg || 'Failed to fetch experiment' })
      return
    }

    res.json({ success: true, data: { experiment: body?.data?.experiment ?? null } })
  } catch (err: any) {
    console.error('VLaby experiment error:', err)
    res.status(502).json({ success: false, error: 'Could not reach VLaby API' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups (public)
// ─────────────────────────────────────────────────────────────────────────────

export const getGroups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/getGroup`, null, resolveLocale(req))
    if (!body?.status) {
      res.status(502).json({ success: false, error: body?.message || body?.msg || 'Failed to fetch groups' })
      return
    }
    res.json({ success: true, data: body.data })
  } catch (err: any) {
    console.error('VLaby groups error:', err)
    res.status(502).json({ success: false, error: 'Could not reach VLaby API' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Relations — cascading filter dropdowns (all public)
// ─────────────────────────────────────────────────────────────────────────────

export const getCountries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/model/country`, null, resolveLocale(req))
    if (!body?.status) { res.status(502).json({ success: false, error: 'Failed to fetch countries' }); return }
    res.json({ success: true, data: body.data })
  } catch { res.status(502).json({ success: false, error: 'Could not reach VLaby API' }) }
}

export const getLevelsByCountry = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/model/country/${req.params.countryId}/levels`, null, resolveLocale(req))
    if (!body?.status) { res.status(502).json({ success: false, error: 'Failed to fetch levels' }); return }
    res.json({ success: true, data: body.data })
  } catch { res.status(502).json({ success: false, error: 'Could not reach VLaby API' }) }
}

export const getClassesByLevel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/model/level/${req.params.levelId}/classes`, null, resolveLocale(req))
    if (!body?.status) { res.status(502).json({ success: false, error: 'Failed to fetch classes' }); return }
    res.json({ success: true, data: body.data })
  } catch { res.status(502).json({ success: false, error: 'Could not reach VLaby API' }) }
}

export const getSemestersByClass = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/model/levelClass/${req.params.classId}/semesters`, null, resolveLocale(req))
    if (!body?.status) { res.status(502).json({ success: false, error: 'Failed to fetch semesters' }); return }
    res.json({ success: true, data: body.data })
  } catch { res.status(502).json({ success: false, error: 'Could not reach VLaby API' }) }
}

export const getSubjectsBySemester = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { body } = await proxyGet(`${VLABY_BASE}/model/semester/${req.params.semesterId}/subjects`, null, resolveLocale(req))
    if (!body?.status) { res.status(502).json({ success: false, error: 'Failed to fetch subjects' }); return }
    res.json({ success: true, data: body.data })
  } catch { res.status(502).json({ success: false, error: 'Could not reach VLaby API' }) }
}
