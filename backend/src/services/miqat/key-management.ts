// Encrypts symmetric key material (card_signing_key, beacon rotating
// secrets, staff rotating-code secrets) at rest, under a single server-held
// master key (MIQAT_MASTER_KEY env var — see config/env.ts). No external
// secrets-manager exists in this codebase today, so `_ref` columns in the
// Miqat schema hold this module's ciphertext rather than a lookup key into
// something else — still never plaintext in the DB. Pure functions: the
// caller supplies the master key, nothing here reads env directly.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function encryptKey(raw: Buffer, masterKey: Buffer): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptKey(ciphertext: string, masterKey: Buffer): Buffer {
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Ciphertext too short to contain IV + auth tag');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
