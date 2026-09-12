// Layer 6 (v3, optional inversion) — staff rotating code. Spec's exact
// construction: code = HMAC-SHA256(staff_device_secret, floor(unix_time/30)),
// truncated and encoded together with person_id. ±1 step tolerance absorbs
// clock drift between the staff phone and the verifying admin device.

import crypto from 'crypto';

const STEP_SECONDS = 30;
const CODE_BYTES = 6; // truncated HMAC, encoded as digits — enough entropy for a 30s-lived code, short enough to read off a screen

export interface RotatingCodePayload {
  personId: string;
  code: string; // numeric string
  step: number;
}

function computeCodeForStep(secret: Buffer, step: number): string {
  const stepBuf = Buffer.alloc(8);
  stepBuf.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha256', secret).update(stepBuf).digest();
  // Dynamic truncation (RFC 4226 style): use the low nibble of the last byte
  // to pick an offset, keeps the derived number well-distributed.
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** CODE_BYTES).padStart(CODE_BYTES, '0');
}

/** Staff app calls this every render to show the current code. */
export function generateRotatingCode(personId: string, secret: Buffer, now: Date = new Date()): RotatingCodePayload {
  const step = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
  return { personId, code: computeCodeForStep(secret, step), step };
}

/** Verifying device accepts the current step plus one step either side (±30s), per spec. */
export function verifyRotatingCode(code: string, secret: Buffer, now: Date = new Date()): boolean {
  const currentStep = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
  for (const step of [currentStep, currentStep - 1, currentStep + 1]) {
    const expected = computeCodeForStep(secret, step);
    if (expected.length === code.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}
