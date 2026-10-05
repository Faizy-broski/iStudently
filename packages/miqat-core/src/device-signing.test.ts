import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
// The real backend verifier: if this passes, the server accepts phone signatures.
import { verifyBatchSignature } from '../../../backend/src/services/miqat/device-crypto'
import {
  base64ToBytes,
  bytesToBase64,
  generateDeviceKeyPair,
  signDeviceRequest,
  signEventBatch,
  signMessage,
} from './device-signing'

describe('device signing is accepted by the backend verifier', () => {
  const kp = generateDeviceKeyPair()

  it('public key is a valid SPKI PEM for P-256', () => {
    const key = crypto.createPublicKey(kp.publicKeyPem)
    expect(key.asymmetricKeyType).toBe('ec')
    expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1')
  })

  it('signed read request (bootstrap) verifies', () => {
    const { timestamp, signature } = signDeviceRequest('bootstrap', 'dev-1', kp.secretKeyB64)
    expect(verifyBatchSignature(`bootstrap:dev-1:${timestamp}`, signature, kp.publicKeyPem)).toBe(true)
  })

  it('signed event batch verifies after a JSON round trip (as Express parses it)', () => {
    const events = [{ event_id: 'e1', card: 'ABC', ts: 1759700000, direction: 'in', note: 'مرحبا' }]
    const { signature } = signEventBatch(events, kp.secretKeyB64)
    const received = JSON.parse(JSON.stringify({ events })).events
    expect(verifyBatchSignature(JSON.stringify(received), signature, kp.publicKeyPem)).toBe(true)
  })

  it('rejects tampered message and wrong key', () => {
    const sig = signMessage('hello', kp.secretKeyB64)
    expect(verifyBatchSignature('hellO', sig, kp.publicKeyPem)).toBe(false)
    expect(verifyBatchSignature('hello', sig, generateDeviceKeyPair().publicKeyPem)).toBe(false)
  })

  it('signature is 64 raw bytes', () => {
    expect(base64ToBytes(signMessage('x', kp.secretKeyB64))).toHaveLength(64)
  })

  it('base64 helpers match Node', () => {
    for (const len of [0, 1, 2, 3, 31, 32, 64, 65]) {
      const bytes = crypto.randomBytes(len)
      expect(bytesToBase64(bytes)).toBe(bytes.toString('base64'))
      expect(Buffer.from(base64ToBytes(bytes.toString('base64')))).toEqual(bytes)
    }
  })
})
