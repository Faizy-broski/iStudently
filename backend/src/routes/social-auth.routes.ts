import { Router, Request, Response } from 'express'
import { config } from '../config/env'
import {
  getOAuthCredentials,
  buildGoogleAuthUrl,
  buildMicrosoftAuthUrl,
  exchangeGoogleCode,
  exchangeMicrosoftCode,
  getGoogleUserInfo,
  getMicrosoftUserInfo,
  findProfileByEmail,
  createSessionForUser,
  encodeOAuthState,
  decodeOAuthState,
} from '../services/social-auth.service'

const router = Router()

const FRONTEND_URL = config.frontend.url

/**
 * Helper: build the OAuth callback URL for a given provider.
 * This is the URL registered in Google Cloud Console / Azure Portal.
 */
function getCallbackUrl(req: Request, provider: 'google' | 'microsoft'): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${protocol}://${host}/api/auth/social/${provider}/callback`
}

/**
 * Redirect to error page on the frontend.
 */
function redirectError(res: Response, message: string): void {
  const errorUrl = `${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(message)}`
  res.redirect(errorUrl)
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

/**
 * GET /api/auth/social/google
 * Initiates Google OAuth flow.
 * Query params: school_id (required)
 */
router.get('/google', async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string
    if (!schoolId) {
      return redirectError(res, 'Missing school_id parameter')
    }

    const result = await getOAuthCredentials(schoolId, 'google')
    if (!result) {
      return redirectError(res, 'Google login is not configured for this school')
    }

    const state = encodeOAuthState({ school_id: schoolId, provider: 'google' })
    const redirectUri = getCallbackUrl(req, 'google')
    const authUrl = buildGoogleAuthUrl(result.credentials, redirectUri, state)

    res.redirect(authUrl)
  } catch (err: any) {
    console.error('Google OAuth init error:', err)
    redirectError(res, 'Failed to start Google login')
  }
})

/**
 * GET /api/auth/social/google/callback
 * Handles the redirect from Google after user authenticates.
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) {
      return redirectError(res, `Google login cancelled: ${oauthError}`)
    }

    if (!code || !state) {
      return redirectError(res, 'Invalid callback parameters')
    }

    // Decode and validate state
    const stateData = decodeOAuthState(state as string)
    if (!stateData || stateData.provider !== 'google') {
      return redirectError(res, 'Invalid or expired login session. Please try again.')
    }

    // Load credentials
    const result = await getOAuthCredentials(stateData.school_id, 'google')
    if (!result) {
      return redirectError(res, 'Google login configuration not found')
    }

    // Exchange code for tokens
    const redirectUri = getCallbackUrl(req, 'google')
    const tokens = await exchangeGoogleCode(code as string, result.credentials, redirectUri)

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.access_token)

    // Verify hosted domain restriction
    if (result.credentials.hosted_domain) {
      const emailDomain = userInfo.email.split('@')[1]
      if (emailDomain !== result.credentials.hosted_domain) {
        return redirectError(
          res,
          `Only @${result.credentials.hosted_domain} accounts are allowed`
        )
      }
    }

    // Find profile by email
    const profile = await findProfileByEmail(userInfo.email)
    if (!profile) {
      return redirectError(
        res,
        'No account found for this email. Please contact your administrator to create an account first.'
      )
    }

    // Create Supabase session and redirect
    const actionLink = await createSessionForUser(
      userInfo.email,
      `${FRONTEND_URL}/auth/callback`
    )
    res.redirect(actionLink)
  } catch (err: any) {
    console.error('Google OAuth callback error:', err)
    redirectError(res, 'Google login failed. Please try again.')
  }
})

// ─── Microsoft OAuth ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/social/microsoft
 * Initiates Microsoft OAuth flow.
 * Query params: school_id (required)
 */
router.get('/microsoft', async (req: Request, res: Response) => {
  try {
    const schoolId = req.query.school_id as string
    if (!schoolId) {
      return redirectError(res, 'Missing school_id parameter')
    }

    const result = await getOAuthCredentials(schoolId, 'microsoft')
    if (!result) {
      return redirectError(res, 'Microsoft login is not configured for this school')
    }

    const state = encodeOAuthState({ school_id: schoolId, provider: 'microsoft' })
    const redirectUri = getCallbackUrl(req, 'microsoft')
    const authUrl = buildMicrosoftAuthUrl(result.credentials, redirectUri, state)

    res.redirect(authUrl)
  } catch (err: any) {
    console.error('Microsoft OAuth init error:', err)
    redirectError(res, 'Failed to start Microsoft login')
  }
})

/**
 * GET /api/auth/social/microsoft/callback
 * Handles the redirect from Microsoft after user authenticates.
 */
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query

    if (oauthError) {
      const desc = error_description ? `: ${error_description}` : ''
      return redirectError(res, `Microsoft login cancelled${desc}`)
    }

    if (!code || !state) {
      return redirectError(res, 'Invalid callback parameters')
    }

    // Decode and validate state
    const stateData = decodeOAuthState(state as string)
    if (!stateData || stateData.provider !== 'microsoft') {
      return redirectError(res, 'Invalid or expired login session. Please try again.')
    }

    // Load credentials
    const result = await getOAuthCredentials(stateData.school_id, 'microsoft')
    if (!result) {
      return redirectError(res, 'Microsoft login configuration not found')
    }

    // Exchange code for tokens
    const redirectUri = getCallbackUrl(req, 'microsoft')
    const tokens = await exchangeMicrosoftCode(code as string, result.credentials, redirectUri)

    // Get user info
    const userInfo = await getMicrosoftUserInfo(tokens.access_token)

    // Find profile by email
    const profile = await findProfileByEmail(userInfo.email)
    if (!profile) {
      return redirectError(
        res,
        'No account found for this email. Please contact your administrator to create an account first.'
      )
    }

    // Create Supabase session and redirect
    const actionLink = await createSessionForUser(
      userInfo.email,
      `${FRONTEND_URL}/auth/callback`
    )
    res.redirect(actionLink)
  } catch (err: any) {
    console.error('Microsoft OAuth callback error:', err)
    redirectError(res, 'Microsoft login failed. Please try again.')
  }
})

export default router
