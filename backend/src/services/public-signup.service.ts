import crypto from 'crypto'

// Encryption key must be exactly 32 bytes for AES-256.
// Set SIGNUP_ENCRYPTION_KEY env var to a 32-char secret in production.
function getEncryptionKey(): Buffer {
  const raw = process.env.SIGNUP_ENCRYPTION_KEY ?? 'studently_signup_key_32chars_xx!'
  return Buffer.from(raw.substring(0, 32).padEnd(32, '0'))
}

const IV_LENGTH = 16 // AES block size

/**
 * AES-256-CBC encrypt — stores password securely for later use on approval.
 * We need reversible encryption (not one-way hash) because on approval we must
 * pass the original password to supabase.auth.admin.createUser().
 */
export function encryptPassword(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-cbc', getEncryptionKey(), iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return `${iv.toString('hex')}:${encrypted}`
}

export function decryptPassword(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 2) throw new Error('Invalid encrypted password format')
  const iv = Buffer.from(parts[0], 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', getEncryptionKey(), iv)
  let decrypted = decipher.update(parts[1], 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export interface SignupLinkPublicInfo {
  role: string
  label: string | null
  school_name: string
  school_logo_url: string | null
  campus_name: string | null
}

// Password strength: 0–4
export function measurePasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(4, score)
}
