import { supabase } from '../config/supabase'
import { config } from '../config/env'
import crypto from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OAuthCredentials {
  client_id: string
  client_secret: string
  /** Google: hosted domain restriction */
  hosted_domain?: string | null
  /** Microsoft: tenant restriction */
  tenant?: string | null
}

interface OAuthTokens {
  access_token: string
  id_token?: string
  token_type: string
}

interface OAuthUserInfo {
  email: string
  name?: string
  picture?: string
}

// ─── Credential Lookup (campus → school fallback, like SMTP) ─────────────────

const SOCIAL_COLS = 'social_login_config, active_plugins'

/**
 * Load OAuth credentials for a provider, with campus → school-level fallback.
 * Mirrors getSchoolMailer() in email.service.ts exactly.
 */
export async function getOAuthCredentials(
  schoolId: string,
  provider: 'google' | 'microsoft'
): Promise<{ credentials: OAuthCredentials; schoolId: string; campusId: string | null } | null> {
  // Resolve whether schoolId is a campus or a standalone school
  const { data: school } = await supabase
    .from('schools')
    .select('id, parent_school_id')
    .eq('id', schoolId)
    .maybeSingle()

  if (!school) return null

  const parentSchoolId = school.parent_school_id ?? schoolId
  const campusId = school.parent_school_id ? schoolId : null

  // 1. Try campus-specific credentials if this is a campus
  if (campusId) {
    const { data } = await supabase
      .from('school_settings')
      .select(SOCIAL_COLS)
      .eq('school_id', parentSchoolId)
      .eq('campus_id', campusId)
      .maybeSingle()

    const creds = extractCredentials(data, provider)
    if (creds) return { credentials: creds, schoolId: parentSchoolId, campusId }
  }

  // 2. Fall back to school-level credentials
  const { data } = await supabase
    .from('school_settings')
    .select(SOCIAL_COLS)
    .eq('school_id', parentSchoolId)
    .is('campus_id', null)
    .maybeSingle()

  const creds = extractCredentials(data, provider)
  if (creds) return { credentials: creds, schoolId: parentSchoolId, campusId: null }

  return null
}

function extractCredentials(
  data: Record<string, any> | null,
  provider: 'google' | 'microsoft'
): OAuthCredentials | null {
  if (!data?.social_login_config) return null
  const cfg = data.social_login_config
  const plugins = data.active_plugins ?? {}

  if (provider === 'google') {
    if (!plugins.google_social_login) return null
    if (!cfg.google_client_id || !cfg.google_client_secret) return null
    return {
      client_id: cfg.google_client_id,
      client_secret: cfg.google_client_secret,
      hosted_domain: cfg.google_hosted_domain || null,
    }
  }

  if (provider === 'microsoft') {
    if (!plugins.microsoft_social_login) return null
    if (!cfg.microsoft_client_id || !cfg.microsoft_client_secret) return null
    return {
      client_id: cfg.microsoft_client_id,
      client_secret: cfg.microsoft_client_secret,
      tenant: cfg.microsoft_tenant || null,
    }
  }

  return null
}

// ─── OAuth URL Builders ──────────────────────────────────────────────────────

/**
 * Build a Google OAuth 2.0 authorization URL.
 */
export function buildGoogleAuthUrl(
  credentials: OAuthCredentials,
  redirectUri: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  })
  if (credentials.hosted_domain) {
    params.set('hd', credentials.hosted_domain)
  }
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Build a Microsoft OAuth 2.0 authorization URL.
 */
export function buildMicrosoftAuthUrl(
  credentials: OAuthCredentials,
  redirectUri: string,
  state: string
): string {
  const tenant = credentials.tenant || 'common'
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    response_mode: 'query',
    prompt: 'select_account',
  })
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize?${params.toString()}`
}

// ─── Token Exchange ──────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for Google tokens.
 */
export async function exchangeGoogleCode(
  code: string,
  credentials: OAuthCredentials,
  redirectUri: string
): Promise<OAuthTokens> {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  return resp.json() as Promise<OAuthTokens>
}

/**
 * Exchange an authorization code for Microsoft tokens.
 */
export async function exchangeMicrosoftCode(
  code: string,
  credentials: OAuthCredentials,
  redirectUri: string
): Promise<OAuthTokens> {
  const tenant = credentials.tenant || 'common'
  const resp = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid email profile',
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Microsoft token exchange failed: ${err}`)
  }

  return resp.json() as Promise<OAuthTokens>
}

// ─── User Info ───────────────────────────────────────────────────────────────

/**
 * Fetch user info from Google using the access token.
 */
export async function getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resp.ok) throw new Error('Failed to fetch Google user info')
  const data = await resp.json() as { email?: string; name?: string; picture?: string }

  if (!data.email) throw new Error('Google did not return an email address')
  return { email: data.email.toLowerCase(), name: data.name, picture: data.picture }
}

/**
 * Fetch user info from Microsoft Graph using the access token.
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!resp.ok) throw new Error('Failed to fetch Microsoft user info')
  const data = await resp.json() as { mail?: string; userPrincipalName?: string; displayName?: string }

  const email = data.mail || data.userPrincipalName
  if (!email) throw new Error('Microsoft did not return an email address')
  return { email: email.toLowerCase(), name: data.displayName }
}

// ─── Profile Lookup ──────────────────────────────────────────────────────────

/**
 * Look up an existing profile by email. Social login does NOT create accounts.
 */
export async function findProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, school_id, is_active')
    .ilike('email', email)
    .maybeSingle()

  if (error || !data) return null
  if (!data.is_active) return null
  return data
}

// ─── Session Creation ────────────────────────────────────────────────────────

/**
 * Create a Supabase session for a verified user.
 * Uses admin generateLink to create a magic link, then extracts the
 * verification URL for the frontend to complete the session exchange.
 */
export async function createSessionForUser(email: string, redirectTo: string) {
  // First, check if a Supabase auth user exists for this email
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const authUser = users.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!authUser) {
    // Create a Supabase auth user (email confirmed) so the magic link works
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createError) throw new Error(`Failed to create auth user: ${createError.message}`)
  }

  // Generate a magic link (not sent via email — we use it as a redirect URL)
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  if (error) throw new Error(`Failed to generate session link: ${error.message}`)

  // data.properties.action_link is the full Supabase verification URL
  const actionLink = data?.properties?.action_link
  if (!actionLink) throw new Error('No action link returned from Supabase')

  return actionLink
}

// ─── State Management (CSRF protection) ──────────────────────────────────────

/**
 * Encode OAuth state parameter with school context + CSRF token.
 */
export function encodeOAuthState(params: {
  school_id: string
  provider: 'google' | 'microsoft'
}): string {
  const csrf = crypto.randomBytes(16).toString('hex')
  const payload = JSON.stringify({ ...params, csrf, ts: Date.now() })
  return Buffer.from(payload).toString('base64url')
}

/**
 * Decode and validate OAuth state parameter.
 * Rejects state tokens older than 10 minutes.
 */
export function decodeOAuthState(state: string): {
  school_id: string
  provider: 'google' | 'microsoft'
  csrf: string
  ts: number
} | null {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString())
    // Reject if older than 10 minutes
    if (Date.now() - payload.ts > 10 * 60 * 1000) return null
    if (!payload.school_id || !payload.provider) return null
    return payload
  } catch {
    return null
  }
}
