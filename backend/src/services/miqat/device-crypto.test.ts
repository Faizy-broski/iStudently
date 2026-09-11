import {
  generateP256KeyPair,
  issueDeviceCertificate,
  verifyDeviceCertificate,
  verifyBatchSignature,
  DeviceCertPayload,
} from './device-crypto';
import crypto from 'crypto';

describe('generateP256KeyPair', () => {
  it('produces a distinct PEM-encoded public/private pair each call', () => {
    const a = generateP256KeyPair();
    const b = generateP256KeyPair();
    expect(a.publicKey).toMatch(/BEGIN PUBLIC KEY/);
    expect(a.privateKey).toMatch(/BEGIN PRIVATE KEY/);
    expect(a.publicKey).not.toBe(b.publicKey);
  });
});

describe('device certificate issuance/verification', () => {
  const authority = generateP256KeyPair();
  const otherAuthority = generateP256KeyPair();

  const payload: DeviceCertPayload = {
    deviceId: 'device-1',
    schoolId: 'school-1',
    role: 'gate',
    issuedAt: 1_757_000_000,
  };

  it('round-trips a valid certificate', () => {
    const cert = issueDeviceCertificate(payload, authority.privateKey);
    const result = verifyDeviceCertificate(cert, authority.publicKey);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.payload).toEqual(payload);
  });

  it('rejects a certificate verified against the wrong authority key', () => {
    const cert = issueDeviceCertificate(payload, authority.privateKey);
    const result = verifyDeviceCertificate(cert, otherAuthority.publicKey);
    expect(result).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
  });

  it('rejects a tampered payload (role escalated from teacher to admin)', () => {
    const cert = issueDeviceCertificate({ ...payload, role: 'teacher' }, authority.privateKey);
    const [data, signature] = cert.split('.');
    const tamperedPayload = { ...payload, role: 'admin' as const };
    const tamperedData = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const forged = `${tamperedData}.${signature}`;
    expect(verifyDeviceCertificate(forged, authority.publicKey).valid).toBe(false);
  });

  it('rejects malformed certificate strings', () => {
    expect(verifyDeviceCertificate('not-a-cert', authority.publicKey)).toEqual({ valid: false, reason: 'BAD_FORMAT' });
    expect(verifyDeviceCertificate('a.b.c', authority.publicKey)).toEqual({ valid: false, reason: 'BAD_FORMAT' });
    expect(verifyDeviceCertificate('####.####', authority.publicKey).valid).toBe(false);
  });

  it('does not throw when handed a malformed authority public key (crypto.verify itself throws internally)', () => {
    const cert = issueDeviceCertificate(payload, authority.privateKey);
    expect(verifyDeviceCertificate(cert, 'not-a-valid-pem-key')).toEqual({ valid: false, reason: 'BAD_FORMAT' });
  });
});

describe('verifyBatchSignature', () => {
  const device = generateP256KeyPair();
  const otherDevice = generateP256KeyPair();
  const canonicalJson = JSON.stringify({ batch_id: 'b1', events: [{ event_id: 'e1' }] });

  // ieee-p1363 (raw r‖s) — matches what the browser scanner-app produces via
  // crypto.subtle.sign, NOT Node's DER default. See device-crypto.ts's
  // verifyBatchSignature doc comment.
  function signIeeeP1363(data: string, privateKey: string): string {
    return crypto.sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
  }

  it('accepts a signature produced by the matching device key', () => {
    const signature = signIeeeP1363(canonicalJson, device.privateKey);
    expect(verifyBatchSignature(canonicalJson, signature, device.publicKey)).toBe(true);
  });

  it('rejects a signature produced by a different device key', () => {
    const signature = signIeeeP1363(canonicalJson, otherDevice.privateKey);
    expect(verifyBatchSignature(canonicalJson, signature, device.publicKey)).toBe(false);
  });

  it('rejects when the batch payload changes after signing', () => {
    const signature = signIeeeP1363(canonicalJson, device.privateKey);
    const tampered = JSON.stringify({ batch_id: 'b1', events: [{ event_id: 'e1-tampered' }] });
    expect(verifyBatchSignature(tampered, signature, device.publicKey)).toBe(false);
  });

  it('rejects a DER-encoded signature (wrong encoding, not raw ieee-p1363)', () => {
    const derSignature = crypto.sign('sha256', Buffer.from(canonicalJson), device.privateKey).toString('base64');
    expect(verifyBatchSignature(canonicalJson, derSignature, device.publicKey)).toBe(false);
  });

  it('rejects garbage signature input without throwing', () => {
    expect(verifyBatchSignature(canonicalJson, 'not-base64-!!!', device.publicKey)).toBe(false);
  });

  it('rejects a garbage public key without throwing', () => {
    const signature = crypto.sign('sha256', Buffer.from(canonicalJson), device.privateKey).toString('base64');
    expect(verifyBatchSignature(canonicalJson, signature, 'not-a-real-key')).toBe(false);
  });
});
