import crypto from 'crypto'
import { generateSecret, generate, verify, generateURI } from 'otplib'
import QRCode from 'qrcode'
import bcrypt from 'bcrypt'
import { supabase } from '../config/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TwoFAConfig {
  roles_required: string[]
  setup_skippable: boolean
  skip_grace_days: number
}

export interface TwoFAUserRow {
  id: string
  name: string
  email: string
  role: string
  totp_enabled: boolean
  totp_enabled_at: string | null
  campus_id: string | null
}

// ── Encryption helpers ─────────────────────────────────────────────────────────
// Format: v1:<ivHex>:<authTagHex>:<ciphertextHex>
// The version prefix allows key rotation without an emergency re-keying run.

function getKeyForVersion(version: string): Buffer {
  const raw = process.env[`TOTP_ENCRYPTION_KEY_${version.toUpperCase()}`]
  if (!raw) {
    throw new Error(`Missing env var TOTP_ENCRYPTION_KEY_${version.toUpperCase()}`)
  }
  // Strip surrounding quotes and whitespace that dotenv sometimes adds
  const envKey = raw.trim().replace(/^["']|["']$/g, '')
  const key = Buffer.from(envKey, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `TOTP_ENCRYPTION_KEY_${version.toUpperCase()} must be 32 bytes (64 hex chars). ` +
      `Got ${envKey.length} chars → ${key.length} bytes. ` +
      `Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  return key
}

function encryptSecret(plain: string): string {
  const key = getKeyForVersion('V1')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptSecret(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted secret format')
  const [version, ivHex, authTagHex, ciphertextHex] = parts
  const key = getKeyForVersion(version.toUpperCase())
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

// ── TOTP helpers ──────────────────────────────────────────────────────────────

async function generateTOTPSecret(label: string, issuer: string): Promise<{ secret: string; otpauthUrl: string }> {
  const secret = await generateSecret()
  const otpauthUrl = await generateURI({ label, issuer, secret })
  return { secret, otpauthUrl }
}

async function generateQRCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl)
}

function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(8)
  const hex = bytes.toString('hex').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`
}

async function verifyTOTP(encryptedSecret: string, token: string): Promise<boolean> {
  try {
    const secret = decryptSecret(encryptedSecret)
    // window: 1 means ±1 TOTP step tolerance (30s)
    const result = await verify({ token, secret })
    return typeof result === 'object' ? result.valid : !!result
  } catch {
    return false
  }
}

// ── JWT payload extraction ─────────────────────────────────────────────────────
// Extract session_id from JWT payload without re-verifying the signature.
// supabase.auth.getUser() has already validated the token in authenticate().

function extractSessionId(bearerToken: string): string | null {
  try {
    const parts = bearerToken.replace('Bearer ', '').split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload.session_id ?? null
  } catch {
    return null
  }
}

function extractExpFromToken(bearerToken: string): Date {
  try {
    const parts = bearerToken.replace('Bearer ', '').split('.')
    if (parts.length !== 3) throw new Error('bad jwt')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (payload.exp) return new Date(payload.exp * 1000)
  } catch {
    // fall through
  }
  // Default: 30 days from now
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
}

// ── TwoFAService ──────────────────────────────────────────────────────────────

class TwoFAService {

  // ── Session table ──────────────────────────────────────────────────────────

  extractSessionId(bearerToken: string): string | null {
    return extractSessionId(bearerToken)
  }

  async isSessionVerified(profileId: string, sessionId: string): Promise<boolean> {
    // Lazy sweep: delete this user's expired rows before the SELECT (free, zero infra)
    await supabase
      .from('two_fa_sessions')
      .delete()
      .eq('profile_id', profileId)
      .lt('expires_at', new Date().toISOString())

    const { data } = await supabase
      .from('two_fa_sessions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('supabase_session_id', sessionId)
      .maybeSingle()

    return !!data
  }

  async markSessionVerified(profileId: string, sessionId: string, expiresAt: Date): Promise<void> {
    await supabase
      .from('two_fa_sessions')
      .upsert(
        { profile_id: profileId, supabase_session_id: sessionId, expires_at: expiresAt.toISOString() },
        { onConflict: 'profile_id,supabase_session_id', ignoreDuplicates: false }
      )
  }

  // ── Setup flow ────────────────────────────────────────────────────────────

  async beginSetup(profileId: string, email: string): Promise<{
    secret: string
    otpauthUrl: string
    qrCodeDataUrl: string
    recoveryCode: string
  }> {
    const issuer = 'Studently'
    const { secret, otpauthUrl } = await generateTOTPSecret(email, issuer)
    const qrCodeDataUrl = await generateQRCode(otpauthUrl)
    const recoveryCode = generateRecoveryCode()
    return { secret, otpauthUrl, qrCodeDataUrl, recoveryCode }
  }

  async completeSetup(
    profileId: string,
    rawSecret: string,
    rawRecovery: string,
    token: string,
    bearerToken: string
  ): Promise<void> {
    const verifyResult = await verify({ token, secret: rawSecret })
    const isValid = typeof verifyResult === 'object' ? (verifyResult as any).valid : !!verifyResult
    if (!isValid) {
      throw new Error('Invalid TOTP code. Please try again.')
    }

    const encryptedSecret = encryptSecret(rawSecret)
    const recoveryHash = await bcrypt.hash(rawRecovery, 10)

    const { error } = await supabase
      .from('profiles')
      .update({
        totp_secret_encrypted: encryptedSecret,
        totp_recovery_hash: recoveryHash,
        totp_enabled: true,
        totp_enabled_at: new Date().toISOString(),
        totp_skip_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    if (error) throw error

    // Mark this session as verified immediately after setup
    const sessionId = extractSessionId(bearerToken)
    if (sessionId) {
      const expiresAt = extractExpFromToken(bearerToken)
      await this.markSessionVerified(profileId, sessionId, expiresAt)
    }
  }

  // ── Verify TOTP ───────────────────────────────────────────────────────────

  async verifyAndMarkSession(
    profileId: string,
    token: string,
    bearerToken: string,
    encryptedSecret: string
  ): Promise<boolean> {
    if (!(await verifyTOTP(encryptedSecret, token))) return false

    const sessionId = extractSessionId(bearerToken)
    if (!sessionId) return false

    const expiresAt = extractExpFromToken(bearerToken)
    await this.markSessionVerified(profileId, sessionId, expiresAt)
    return true
  }

  // ── Recovery ──────────────────────────────────────────────────────────────

  async verifyRecoveryCode(
    profileId: string,
    code: string,
    bearerToken: string
  ): Promise<boolean> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_recovery_hash')
      .eq('id', profileId)
      .maybeSingle()

    if (!profile?.totp_recovery_hash) return false

    const normalised = code.toUpperCase().replace(/\s/g, '')
    const match = await bcrypt.compare(normalised, profile.totp_recovery_hash)
    if (!match) return false

    // Disable 2FA (user lost device — they must re-enroll)
    await supabase
      .from('profiles')
      .update({
        totp_secret_encrypted: null,
        totp_recovery_hash: null,
        totp_enabled: false,
        totp_enabled_at: null,
        totp_skip_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    // Delete all 2FA sessions for this user
    await supabase.from('two_fa_sessions').delete().eq('profile_id', profileId)

    // Mark current session as "verified" so they can reach the dashboard
    const sessionId = extractSessionId(bearerToken)
    if (sessionId) {
      const expiresAt = extractExpFromToken(bearerToken)
      await this.markSessionVerified(profileId, sessionId, expiresAt)
    }

    return true
  }

  // ── Self-disable ──────────────────────────────────────────────────────────

  async disableTwoFA(profileId: string, token: string): Promise<void> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_secret_encrypted')
      .eq('id', profileId)
      .maybeSingle()

    if (!profile?.totp_secret_encrypted) throw new Error('2FA is not enabled')

    if (!(await verifyTOTP(profile.totp_secret_encrypted, token))) {
      throw new Error('Invalid TOTP code')
    }

    await supabase
      .from('profiles')
      .update({
        totp_secret_encrypted: null,
        totp_recovery_hash: null,
        totp_enabled: false,
        totp_enabled_at: null,
        totp_skip_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)

    await supabase.from('two_fa_sessions').delete().eq('profile_id', profileId)
  }

  // ── Skip grace period ─────────────────────────────────────────────────────

  async skipSetup(profileId: string, schoolId: string, campusId: string | null): Promise<void> {
    const config = await this.getTwoFAConfig(schoolId, campusId)
    if (!config.setup_skippable) throw new Error('Setup cannot be skipped for this role')

    const days = config.skip_grace_days ?? 7
    const skipUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    await supabase
      .from('profiles')
      .update({ totp_skip_until: skipUntil.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', profileId)
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(profileId: string, role: string, schoolId: string, campusId: string | null): Promise<{
    enabled: boolean
    required: boolean
    setup_skippable: boolean
    skip_grace_days: number
    skip_until: string | null
  }> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('totp_enabled, totp_skip_until')
      .eq('id', profileId)
      .maybeSingle()

    const config = await this.getTwoFAConfig(schoolId, campusId)
    const required = config.roles_required.includes(role)

    return {
      enabled: profile?.totp_enabled ?? false,
      required,
      setup_skippable: config.setup_skippable,
      skip_grace_days: config.skip_grace_days,
      skip_until: profile?.totp_skip_until ?? null,
    }
  }

  // ── Config ────────────────────────────────────────────────────────────────

  async getTwoFAConfig(schoolId: string, campusId: string | null): Promise<TwoFAConfig> {
    const parse = (cfg: TwoFAConfig | null): TwoFAConfig => ({
      roles_required: cfg?.roles_required ?? [],
      setup_skippable: cfg?.setup_skippable ?? true,
      skip_grace_days: cfg?.skip_grace_days ?? 1,
    })

    // Try campus-specific config first when campusId is provided
    if (campusId) {
      const { data } = await supabase
        .from('school_settings')
        .select('two_fa_config')
        .eq('school_id', schoolId)
        .eq('campus_id', campusId)
        .maybeSingle()
      const cfg = data?.two_fa_config as TwoFAConfig | null
      if (cfg) return parse(cfg)
    }

    // Fall back to parent-school config (campus_id IS NULL)
    const { data } = await supabase
      .from('school_settings')
      .select('two_fa_config')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()

    const schoolConfig = parse(data?.two_fa_config as TwoFAConfig | null)

    // When no campusId (e.g. parents/school-scoped roles), also union campus-level
    // roles_required. Admins configure 2FA per-campus — parents have no campus so they
    // would always get roles_required=[] and never be required to do 2FA otherwise.
    if (!campusId) {
      const { data: campusRows } = await supabase
        .from('school_settings')
        .select('two_fa_config')
        .eq('school_id', schoolId)
        .not('campus_id', 'is', null)

      if (campusRows && campusRows.length > 0) {
        const allRoles = new Set<string>(schoolConfig.roles_required)
        let setupSkippable = schoolConfig.setup_skippable
        let skipGraceDays = schoolConfig.skip_grace_days

        for (const row of campusRows) {
          const cfg = row.two_fa_config as TwoFAConfig | null
          if (!cfg) continue
          for (const role of (cfg.roles_required ?? [])) allRoles.add(role)
          if (!cfg.setup_skippable) setupSkippable = false
          if ((cfg.skip_grace_days ?? 1) > skipGraceDays) skipGraceDays = cfg.skip_grace_days ?? 1
        }

        return {
          roles_required: Array.from(allRoles),
          setup_skippable: setupSkippable,
          skip_grace_days: skipGraceDays,
        }
      }
    }

    return schoolConfig
  }

  async updateTwoFAConfig(
    schoolId: string,
    campusId: string | null,
    cfg: TwoFAConfig
  ): Promise<void> {
    const updates = { two_fa_config: cfg, updated_at: new Date().toISOString() }

    let q = supabase.from('school_settings').update(updates).eq('school_id', schoolId)
    q = campusId ? q.eq('campus_id', campusId) : q.is('campus_id', null)
    const { data: updated, error: updateErr } = await q.select('id')

    if (updateErr) throw updateErr

    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabase.from('school_settings').insert({
        school_id: schoolId,
        campus_id: campusId ?? null,
        ...updates,
      })
      if (insertErr) throw insertErr
    }
  }

  async isTwoFARequiredForRole(
    role: string,
    schoolId: string,
    campusId: string | null
  ): Promise<boolean> {
    const config = await this.getTwoFAConfig(schoolId, campusId)
    return config.roles_required.includes(role)
  }

  // ── Admin: reset user 2FA ─────────────────────────────────────────────────

  async resetUserTwoFA(targetProfileId: string, adminSchoolId: string): Promise<void> {
    // Verify the target user belongs to the admin's school
    const { data: target } = await supabase
      .from('profiles')
      .select('id, school_id')
      .eq('id', targetProfileId)
      .maybeSingle()

    if (!target) throw new Error('User not found')
    if (target.school_id !== adminSchoolId) throw new Error('Access denied')

    await supabase
      .from('profiles')
      .update({
        totp_secret_encrypted: null,
        totp_recovery_hash: null,
        totp_enabled: false,
        totp_enabled_at: null,
        totp_skip_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetProfileId)

    await supabase.from('two_fa_sessions').delete().eq('profile_id', targetProfileId)
  }

  // ── Admin: list users with 2FA status ─────────────────────────────────────

  async listUsersWithTwoFAStatus(
    schoolId: string,
    campusId: string | null
  ): Promise<TwoFAUserRow[]> {
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, totp_enabled, totp_enabled_at, campus_id')
      .eq('school_id', schoolId)
      .not('role', 'in', '(super_admin)')
      .order('last_name', { ascending: true })

    if (campusId) query = query.eq('campus_id', campusId)

    const { data, error } = await query
    if (error) throw error

    return (data ?? []).map((p: any) => ({
      id: p.id,
      name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
      email: p.email || '',
      role: p.role,
      totp_enabled: p.totp_enabled ?? false,
      totp_enabled_at: p.totp_enabled_at ?? null,
      campus_id: p.campus_id ?? null,
    }))
  }

  // ── Daily cron sweep (Option B) ────────────────────────────────────────────

  async sweepExpiredSessions(): Promise<void> {
    await supabase
      .from('two_fa_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
  }
}

export const twoFAService = new TwoFAService()
