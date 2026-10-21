import { createHmac } from 'node:crypto'

import QRCode from 'qrcode'

import { JC_QR_PREFIX, luhnDigit, qrPrecheck } from '../../../lib/jahbadh'

/**
 * QR payloads of exam control (brief C7.3): digits only (keyboard-wedge scanners type through the
 * keyboard layout; Latin letters break under an Arabic layout), fixed-length fields, a type prefix,
 * the session code, a Luhn check digit and a 6-digit HMAC signature that only the server can make.
 *
 *   booklet  11 + session(4) + secret(7) + check(1) + sig(6)              = 20 digits
 *   stub     12 + session(4) + secret(7) + seat(6) + check(1) + sig(6)    = 26 digits
 *   card     13 + session(4) + seat(6) + check(1) + sig(6)                = 19 digits
 */
export type JcQrKind = 'booklet' | 'stub' | 'card'
const PREFIX = JC_QR_PREFIX

function serverSecret(): string {
  const s = process.env.JC_QR_SECRET || process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!s) throw new Error('JC_QR_SECRET (or CREDENTIALS_ENCRYPTION_KEY) is not configured')
  return s
}

/** First 6 decimal digits of HMAC-SHA256(serverSecret, payload). */
export function qrSignature(payload: string): string {
  const hex = createHmac('sha256', serverSecret()).update(payload).digest('hex')
  return BigInt(`0x${hex}`).toString().slice(0, 6)
}

const pad = (n: number, len: number) => String(n).padStart(len, '0')

export function buildQrPayload(kind: JcQrKind, sessionCode: string, x: { secret?: number; seat?: number }): string {
  const session = pad(Number(sessionCode) || 0, 4)
  let body = PREFIX[kind] + session
  if (kind === 'booklet') body += pad(x.secret ?? 0, 7)
  if (kind === 'stub') body += pad(x.secret ?? 0, 7) + pad(x.seat ?? 0, 6)
  if (kind === 'card') body += pad(x.seat ?? 0, 6)
  const withCheck = body + luhnDigit(body)
  return withCheck + qrSignature(withCheck)
}

export type JcQrParse =
  | { ok: true; kind: JcQrKind; sessionCode: string; secret?: number; seat?: number }
  | { ok: false; reason: 'format' | 'prefix' | 'length' | 'check' | 'signature' | 'session' | 'kind' }

/** Validates a scanned payload: digits, prefix, length, check digit, signature and session. */
export function parseQrPayload(raw: string, sessionCode: string, expect?: JcQrKind): JcQrParse {
  // Digits, prefix, kind, length and check digit: the same pre-check the scan inputs run in the browser/app.
  const pre = qrPrecheck(raw, expect)
  if (!pre.ok) return { ok: false, reason: (pre as { reason: 'format' | 'prefix' | 'kind' | 'length' | 'check' }).reason }
  const { kind, digits } = pre as { kind: JcQrKind; digits: string }
  const withCheck = digits.slice(0, -6)
  if (qrSignature(withCheck) !== digits.slice(-6)) return { ok: false, reason: 'signature' }
  const session = digits.slice(2, 6)
  if (session !== pad(Number(sessionCode) || 0, 4)) return { ok: false, reason: 'session' }
  const rest = digits.slice(6, -7)
  if (kind === 'booklet') return { ok: true, kind, sessionCode: session, secret: Number(rest) }
  if (kind === 'stub') return { ok: true, kind, sessionCode: session, secret: Number(rest.slice(0, 7)), seat: Number(rest.slice(7)) }
  return { ok: true, kind, sessionCode: session, seat: Number(rest) }
}

/** SVG QR (error correction M, 4-module quiet zone) for printing. */
export async function qrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 4 })
}
