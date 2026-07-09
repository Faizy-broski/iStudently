import crypto from 'crypto'

// AES-256-GCM symmetric encryption for values that must be recoverable by the
// backend (e.g. a login password to redisplay for printing), as opposed to
// bcrypt hashes which are one-way. Key must be a 32-byte value, base64-encoded,
// in CREDENTIALS_ENCRYPTION_KEY. Losing/rotating the key strands existing values.

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes')
  }
  return key
}

// Output format: base64(iv [12 bytes] + authTag [16 bytes] + ciphertext)
export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

export function decryptSecret(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
