// Device identity for Miqat scanning on the phone.
//
// Must match the backend verifier byte for byte
// (backend/src/services/miqat/device-crypto.ts verifyBatchSignature):
//   - ECDSA P-256 over SHA-256 of the UTF-8 message
//   - signature: raw r||s (ieee-p1363, 64 bytes), standard base64
//   - public key: SPKI PEM, sent once at enrolment (POST /miqat/devices/enrol `public_key`)
//   - read endpoints sign `${purpose}:${deviceId}:${unixSeconds}` (+-60 s window)
//   - batch uploads sign JSON.stringify(events) exactly as sent
//
// Pure JS (@noble/curves) because Hermes has no WebCrypto. The secret key is
// extractable here; the app stores it in expo-secure-store. A hardware-backed
// native keystore module can replace `signer` later without changing callers.

import { p256 } from '@noble/curves/nist.js'

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64[n & 63] : '='
  }
  return out
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let buf = 0
  let bits = 0
  let j = 0
  for (const ch of clean) {
    const v = B64.indexOf(ch)
    if (v < 0) throw new Error('Invalid base64')
    buf = (buf << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[j++] = (buf >> bits) & 0xff
    }
  }
  return out
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

// DER prefix of SubjectPublicKeyInfo for id-ecPublicKey + prime256v1 with a 65-byte uncompressed point.
const P256_SPKI_PREFIX = new Uint8Array([
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce,
  0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
])

export function publicKeyToSpkiPem(uncompressedPoint: Uint8Array): string {
  if (uncompressedPoint.length !== 65 || uncompressedPoint[0] !== 0x04) {
    throw new Error('Expected a 65-byte uncompressed P-256 point')
  }
  const der = new Uint8Array(P256_SPKI_PREFIX.length + 65)
  der.set(P256_SPKI_PREFIX)
  der.set(uncompressedPoint, P256_SPKI_PREFIX.length)
  const body = bytesToBase64(der).match(/.{1,64}/g)!.join('\n')
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`
}

export interface DeviceKeyPair {
  /** 32-byte secret, base64. Store in secure storage only. */
  secretKeyB64: string
  /** SPKI PEM to send at enrolment. */
  publicKeyPem: string
}

export function generateDeviceKeyPair(): DeviceKeyPair {
  const secretKey = p256.utils.randomSecretKey()
  const publicKey = p256.getPublicKey(secretKey, false)
  return { secretKeyB64: bytesToBase64(secretKey), publicKeyPem: publicKeyToSpkiPem(publicKey) }
}

/** Signs a message; returns base64 of the 64-byte r||s signature. */
export function signMessage(message: string, secretKeyB64: string): string {
  const sig = p256.sign(utf8(message), base64ToBytes(secretKeyB64), { prehash: true, format: 'compact' })
  return bytesToBase64(sig)
}

/** Query params for signed device GET endpoints (bootstrap, etc.). */
export function signDeviceRequest(
  purpose: string,
  deviceId: string,
  secretKeyB64: string,
  nowMs: number = Date.now(),
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(nowMs / 1000))
  return { timestamp, signature: signMessage(`${purpose}:${deviceId}:${timestamp}`, secretKeyB64) }
}

/** Signs a batch of events; send `events` and `signature` together, without re-serialising differently. */
export function signEventBatch<T>(events: T[], secretKeyB64: string): { events: T[]; signature: string } {
  return { events, signature: signMessage(JSON.stringify(events), secretKeyB64) }
}
