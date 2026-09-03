import { Request, Response, NextFunction } from 'express'
import { supabaseAuth, supabase } from '../config/supabase'
import { twoFAService } from '../services/two-fa.service'
import { TtlCache } from '../utils/ttl-cache'

export interface AuthRequest extends Request {
  user?: any
  profile?: any
}

interface AuthErrorResponse {
  status: number
  body: Record<string, any>
}

interface CachedAuthContext {
  profile: any
  errorResponse: AuthErrorResponse | null
  twoFARequired: boolean
}

// Resolving req.profile (profile row + role-branch campus/school assignment
// + suspension/trial status + whether 2FA is required for this role) took
// 4-7 sequential Supabase round trips on EVERY authenticated request, even
// though none of it changes between requests in the same short window —
// this was the single biggest, most universal cost behind slow navigation
// (every API call behind every click pays this tax). Cached per
// (user, impersonated school) with a short TTL: short because, unlike
// hifzi-enabled.middleware.ts's 60s plugin-gate cache, this gates
// security-relevant state (account suspension, 2FA requirement). JWT
// verification (getUser, below) is deliberately NOT part of this cache — it
// must run on every request so a revoked/expired token is rejected
// immediately rather than up to `ttlMs` late.
const authContextCache = new TtlCache<CachedAuthContext>(20_000)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolves everything derivable from the profile row alone: role-branch
 * campus/school assignment (student vs. staff/teacher/librarian), super_admin
 * impersonation override, account-active/agreement/suspension/trial checks,
 * and whether 2FA is required for this role. Called only on a cache miss.
 * Returns null when no profile exists for this user (not cached — see caller).
 */
async function buildAuthContext(
  user: any,
  impersonatedSchoolId: string | undefined
): Promise<CachedAuthContext | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('❌ Profile lookup failed:', {
      error: profileError,
      userId: user.id
    })
    return null
  }

  if (!profile.is_active) {
    if (profile.agreement_status === 'rejected') {
      return {
        profile,
        twoFARequired: false,
        errorResponse: {
          status: 403,
          body: {
            success: false,
            error: 'Your account was deactivated because you rejected the school agreement. Visit the reactivation page to restore access.',
            code: 'AGREEMENT_REJECTED',
          }
        }
      }
    }
    return {
      profile,
      twoFARequired: false,
      errorResponse: {
        status: 403,
        body: { success: false, error: 'Account is inactive. Please contact administrator.' }
      }
    }
  }

  // If user is a student, fetch their student record.
  if (typeof profile.role === 'string' && profile.role.toLowerCase() === 'student') {
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('id, school_id, section_id')
      .or(`profile_id.eq.${profile.id},id.eq.${profile.id}`)
      .single()

    if (!studentError && studentRecord) {
      profile.student_id = studentRecord.id
      if (studentRecord.section_id) profile.section_id = studentRecord.section_id

      if (studentRecord.school_id) {
        profile.campus_id = studentRecord.school_id

        // Resolve parent school so that getMarkingPeriods/getAcademicYears work.
        // In this system, marking periods are linked to the main school.
        const { data: campusRecord } = await supabase
          .from('schools')
          .select('id, parent_school_id')
          .eq('id', studentRecord.school_id)
          .single()

        if (campusRecord?.parent_school_id) {
          // The campus is a child school — set school_id to the parent
          profile.school_id = campusRecord.parent_school_id
        } else if (campusRecord) {
          // If parent_school_id is null, the school_id is already the parent
          profile.school_id = campusRecord.id
        }
      }
    } else if (studentError && studentError.code !== 'PGRST116') {
      console.warn('⚠️ Student record lookup failed for profile:', profile.id, studentError)
    }
  }

  // For librarians, teachers and staff: fetch their campus assignment from the staff table.
  // The staff.school_id column stores the CAMPUS id (child school).
  // We also need to resolve the parent school so that getCampuses() works correctly.
  if (profile.role === 'librarian' || profile.role === 'teacher' || profile.role === 'staff') {
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('id, school_id, user_profile_id')
      .eq('profile_id', profile.id)
      .single()

    if (staffRecord?.school_id) {
      profile.campus_id = staffRecord.school_id
      profile.staff_id = staffRecord.id
      profile.user_profile_id = staffRecord.user_profile_id ?? null

      // Resolve parent school so that getCampuses(profile.school_id) works.
      // If the profile already has the parent school_id, skip this lookup.
      const { data: campusRecord } = await supabase
        .from('schools')
        .select('id, parent_school_id')
        .eq('id', staffRecord.school_id)
        .single()

      if (campusRecord?.parent_school_id) {
        // The campus is a child school — set school_id to the parent
        profile.school_id = campusRecord.parent_school_id
      }
      // If parent_school_id is null, school_id is already the parent school — keep it.
    }
  }

  // Super admin school impersonation via X-School-Id header.
  // No DB lookup needed — super_admin is already fully verified.
  if (profile.role === 'super_admin') {
    if (impersonatedSchoolId) {
      profile.school_id = impersonatedSchoolId
      profile.campus_id = undefined
      profile.impersonating_school_id = impersonatedSchoolId
    }
  }

  // ── School suspension / trial-expiry check + 2FA-required lookup ──────────
  // Independent of each other (both only depend on the profile resolved
  // above) — run concurrently instead of sequentially. Super admins are
  // never blocked by suspension — they need access to fix/investigate
  // suspended or trial-expired schools (including while impersonating one).
  const [school, twoFARequired] = await Promise.all([
    profile.role !== 'super_admin' && profile.school_id
      ? supabase.from('schools').select('status, is_trial, trial_ends_at').eq('id', profile.school_id).single().then(r => r.data)
      : Promise.resolve(null),
    twoFAService.isTwoFARequiredForRole(profile.role, profile.school_id, profile.campus_id ?? null),
  ])

  if (school?.status === 'suspended') {
    return {
      profile,
      twoFARequired,
      errorResponse: {
        status: 403,
        body: {
          success: false,
          error: 'This school account has been suspended. Please contact your administrator.',
          code: 'SCHOOL_SUSPENDED'
        }
      }
    }
  }

  if (school?.is_trial && school.trial_ends_at && new Date(school.trial_ends_at) < new Date()) {
    return {
      profile,
      twoFARequired,
      errorResponse: {
        status: 403,
        body: {
          success: false,
          error: 'Your trial period has ended. Please contact us to continue using the system.',
          code: 'TRIAL_EXPIRED'
        }
      }
    }
  }

  return { profile, twoFARequired, errorResponse: null }
}

/**
 * Middleware to authenticate requests using JWT token
 * Verifies the token and attaches user and profile to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please include Authorization header.'
      })
    }

    const token = authHeader.replace('Bearer ', '').trim()

    // Validate token format (JWT should have 3 parts separated by dots)
    if (!token || token.split('.').length !== 3) {
      console.error('❌ Malformed JWT token:', {
        hasToken: !!token,
        tokenLength: token?.length,
        segments: token?.split('.').length,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'empty'
      })
      return res.status(401).json({
        success: false,
        error: 'Malformed authentication token. Please sign in again.'
      })
    }

    // Verify JWT token with Supabase
    let user: any = null
    let userError: any = null
    try {
      const result = await supabaseAuth.auth.getUser(token)
      user = result.data?.user
      userError = result.error
    } catch (fetchErr: any) {
      // Network-level failure (ECONNRESET, ETIMEDOUT, fetch failed, etc.)
      // This is NOT an auth failure — the token may be perfectly valid.
      const msg = fetchErr?.message || String(fetchErr)
      const isNetworkError =
        msg.includes('fetch failed') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('network') ||
        msg.includes('socket')
      console.error('❌ Auth service unreachable (network error):', msg)
      if (isNetworkError) {
        return res.status(503).json({
          success: false,
          error: 'Auth service temporarily unreachable. Please retry.',
          retryable: true
        })
      }
      throw fetchErr
    }

    if (userError || !user) {
      // Distinguish transient Supabase network errors from real auth errors
      const errMsg = userError?.message || ''
      const isNetworkError =
        errMsg.includes('fetch failed') ||
        errMsg.includes('ECONNRESET') ||
        errMsg.includes('ETIMEDOUT') ||
        errMsg.includes('network') ||
        errMsg.includes('socket') ||
        userError?.status === 0
      if (isNetworkError) {
        console.error('❌ Auth service network error (not a bad token):', errMsg)
        return res.status(503).json({
          success: false,
          error: 'Auth service temporarily unreachable. Please retry.',
          retryable: true
        })
      }
      console.error('❌ Token verification failed:', {
        error: userError?.message,
        errorCode: userError?.code,
        hasUser: !!user
      })
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        details: process.env.NODE_ENV === 'development' ? userError?.message : undefined
      })
    }

    // Cache key includes the impersonation header so that a super_admin
    // switching between schools never serves one school's cached
    // profile/campus/suspension context for another school's requests.
    const rawImpersonationHeader = req.headers['x-school-id'] as string | undefined
    const impersonatedSchoolId = rawImpersonationHeader && UUID_RE.test(rawImpersonationHeader)
      ? rawImpersonationHeader
      : undefined
    const cacheKey = `${user.id}:${impersonatedSchoolId ?? ''}`

    let authContext = authContextCache.get(cacheKey)
    if (authContext === undefined) {
      const built = await buildAuthContext(user, impersonatedSchoolId)
      if (!built) {
        return res.status(401).json({
          success: false,
          error: 'User profile not found. Please contact administrator to set up your account.'
        })
      }
      authContext = built
      authContextCache.set(cacheKey, authContext)
    }

    if (authContext.errorResponse) {
      return res.status(authContext.errorResponse.status).json(authContext.errorResponse.body)
    }

    // Shallow-copy the cached profile per request — the cached object is
    // shared across concurrent/future requests for this user, and downstream
    // route handlers are not guaranteed not to mutate req.profile.
    const profile = { ...authContext.profile }

    // Attach user and profile to request
    req.user = user
    req.profile = profile

    // ── 2FA enforcement ──────────────────────────────────────────────────────
    // Integrated here so it runs for every authenticated route without modifying
    // individual route files. Skipped for 2FA action paths and other excluded paths.
    // Session verification is deliberately NOT cached above — it's tied to this
    // specific token/session and must be checked fresh every request.
    try {
      const path = req.originalUrl.split('?')[0]  // full path, no query string
      const skipPaths = ['/two-fa/', '/auth/change-password', '/auth/language',
        '/user-agreements/check', '/user-agreements/accept', '/user-agreements/reject']
      const should2FACheck = !skipPaths.some(p => path.includes(p))

      if (should2FACheck && authContext.twoFARequired) {
        // Check skip grace period
        const skipUntil = profile.totp_skip_until ? new Date(profile.totp_skip_until) : null
        const inGrace = skipUntil && skipUntil > new Date()

        if (!inGrace) {
          if (!profile.totp_enabled) {
            return res.status(403).json({ success: false, code: 'TWO_FA_SETUP_REQUIRED', error: '2FA setup is required' })
          }

          const bearerToken = (req.headers.authorization || '').replace('Bearer ', '')
          const sessionId = twoFAService.extractSessionId(bearerToken)
          if (!sessionId) {
            return res.status(403).json({ success: false, code: 'TWO_FA_REQUIRED', error: '2FA verification required' })
          }

          const verified = await twoFAService.isSessionVerified(profile.id, sessionId)
          if (!verified) {
            return res.status(403).json({ success: false, code: 'TWO_FA_REQUIRED', error: '2FA verification required' })
          }
        }
      }
    } catch (twoFAErr) {
      // Fail open — don't block authenticated requests on 2FA lookup errors
      console.error('⚠️ 2FA check error (failing open):', twoFAErr)
    }
    // ── End 2FA enforcement ──────────────────────────────────────────────────

    return next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    })
  }
}

// Paths excluded from 2FA enforcement
const TWO_FA_SKIP_PATHS = [
  '/api/two-fa/',
  '/two-fa/',
  '/api/auth/change-password',
  '/auth/change-password',
  '/api/auth/language',
  '/auth/language',
  '/api/user-agreements/check',
  '/user-agreements/check',
  '/api/user-agreements/accept',
  '/user-agreements/accept',
  '/api/user-agreements/reject',
  '/user-agreements/reject',
  '/api/public',
  '/public',
  '/api/health',
  '/health',
  '/api/status',
]

/**
 * Global 2FA enforcement middleware.
 * Applied after authenticate() — only runs if profile exists and 2FA is required for their role.
 * Returns 403 with code TWO_FA_REQUIRED or TWO_FA_SETUP_REQUIRED.
 * Add to app.ts after all route registration but before the 404 handler.
 */
export const requireTwoFA = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const profile = (req as AuthRequest).profile
    // No profile = unauthenticated route — let the route's own auth handle it
    if (!profile) { next(); return }

    // Skip 2FA check for excluded paths
    if (TWO_FA_SKIP_PATHS.some(p => req.path.startsWith(p))) { next(); return }

    const isRequired = await twoFAService.isTwoFARequiredForRole(
      profile.role,
      profile.school_id,
      profile.campus_id ?? null
    )
    if (!isRequired) { next(); return }

    // Check skip grace period
    if (profile.totp_skip_until) {
      const skipUntil = new Date(profile.totp_skip_until)
      if (skipUntil > new Date()) { next(); return }
    }

    if (!profile.totp_enabled) {
      res.status(403).json({ success: false, code: 'TWO_FA_SETUP_REQUIRED', error: '2FA setup required' })
      return
    }

    const token = req.headers.authorization || ''
    const sessionId = twoFAService.extractSessionId(token)
    if (!sessionId) {
      res.status(403).json({ success: false, code: 'TWO_FA_REQUIRED', error: '2FA verification required' })
      return
    }

    const verified = await twoFAService.isSessionVerified(profile.id, sessionId)
    if (!verified) {
      res.status(403).json({ success: false, code: 'TWO_FA_REQUIRED', error: '2FA verification required' })
      return
    }

    next()
  } catch (error) {
    console.error('requireTwoFA error:', error)
    next() // fail open — don't block requests on internal errors
  }
}
