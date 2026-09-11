// Layer 1 (mandatory) — cryptographically signed card payload.
//
// Payload struct (spec §5, Layer 1): v | school_id | person_id | card_revision
// | issued_at | sig, packed as binary then Base32-encoded for QR density (QR
// alphanumeric mode is denser in Base32 than Base64). Pure crypto only — this
// module never touches the DB; revocation (checking card_revision against the
// person's minimum accepted revision) is the caller's job, using the
// `revocationMinRevision` map synced onto the scanner device.
//
// HMAC (not asymmetric) is deliberate: this key is distributed to every
// scanner device for offline local verification (spec §11), which only makes
// sense for a symmetric verification secret — an asymmetric private key would
// have to leave the server to do the same job, defeating the point.

import crypto from 'crypto';

const VERSION = 1;
const SIG_BYTES = 16;
const UNSIGNED_LENGTH = 1 + 16 + 16 + 4 + 4; // v + school_id + person_id + card_revision + issued_at

export interface CardPayload {
  schoolId: string;
  personId: string;
  cardRevision: number;
  issuedAt: number; // unix seconds
}

export type CardVerifyFailureReason = 'BAD_FORMAT' | 'BAD_SIGNATURE' | 'UNSUPPORTED_VERSION';

export type CardVerifyResult =
  | { valid: true; payload: CardPayload }
  | { valid: false; reason: CardVerifyFailureReason };

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 Base32, no padding — chosen over Base64 for QR alphanumeric-mode density. */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function base32Decode(str: string): Buffer {
  // Deliberately strict, not lenient: this decodes untrusted scanned QR
  // input, so a stray/corrupted character should surface as a decode
  // failure (BAD_FORMAT) rather than be silently dropped.
  const clean = str.toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid Base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) throw new Error(`Invalid UUID: ${uuid}`);
  return Buffer.from(hex, 'hex');
}

function bytesToUuid(buf: Buffer): string {
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function packUnsigned(payload: CardPayload): Buffer {
  const buf = Buffer.alloc(UNSIGNED_LENGTH);
  let offset = 0;
  buf.writeUInt8(VERSION, offset);
  offset += 1;
  uuidToBytes(payload.schoolId).copy(buf, offset);
  offset += 16;
  uuidToBytes(payload.personId).copy(buf, offset);
  offset += 16;
  buf.writeUInt32BE(payload.cardRevision, offset);
  offset += 4;
  buf.writeUInt32BE(payload.issuedAt, offset);
  return buf;
}

function computeSignature(unsigned: Buffer, signingKey: Buffer): Buffer {
  return crypto.createHmac('sha256', signingKey).update(unsigned).digest().subarray(0, SIG_BYTES);
}

/** Signs a card payload with the school's current card_signing_key. Server-side only. */
export function signCardPayload(payload: CardPayload, signingKey: Buffer): string {
  const unsigned = packUnsigned(payload);
  const sig = computeSignature(unsigned, signingKey);
  return base32Encode(Buffer.concat([unsigned, sig]));
}

/**
 * Verifies a scanned card against one or more accepted signing keys (current
 * + previous, for the key-rotation overlap window — see spec §5 Layer 1 "Key
 * management"). The first key that produces a matching signature wins; this
 * function does not know or care which key index matched.
 */
export function verifyCardPayload(encoded: string, signingKeys: Buffer[]): CardVerifyResult {
  let raw: Buffer;
  try {
    raw = base32Decode(encoded);
  } catch {
    return { valid: false, reason: 'BAD_FORMAT' };
  }

  if (raw.length !== UNSIGNED_LENGTH + SIG_BYTES) {
    return { valid: false, reason: 'BAD_FORMAT' };
  }

  const unsigned = raw.subarray(0, UNSIGNED_LENGTH);
  const sig = raw.subarray(UNSIGNED_LENGTH);
  const version = unsigned.readUInt8(0);
  if (version !== VERSION) {
    return { valid: false, reason: 'UNSUPPORTED_VERSION' };
  }

  const matches = signingKeys.some((key) => {
    const expected = computeSignature(unsigned, key);
    return expected.length === sig.length && crypto.timingSafeEqual(expected, sig);
  });

  if (!matches) {
    return { valid: false, reason: 'BAD_SIGNATURE' };
  }

  return {
    valid: true,
    payload: {
      schoolId: bytesToUuid(unsigned.subarray(1, 17)),
      personId: bytesToUuid(unsigned.subarray(17, 33)),
      cardRevision: unsigned.readUInt32BE(33),
      issuedAt: unsigned.readUInt32BE(37),
    },
  };
}
