// Layer 4 (mandatory) — device binding and enrolment.
//
// Two distinct crypto operations live here:
//   1. Device certificate issuance/verification — asymmetric (ECDSA P-256),
//      signed by the platform's own enrolment-authority key. This is what
//      binds device_id -> school_id -> role after enrolment.
//   2. Batch signature verification — the device signs every attendance
//      batch with its own private key (generated in secure hardware on the
//      device; this backend only ever sees the device's public key). ECDSA
//      P-256 is chosen because it's what both Android Keystore/StrongBox and
//      iOS Secure Enclave support natively — the scanner-app's custom native
//      plugin (SecureKeystorePlugin) generates exactly this kind of key.
//
// Pure crypto only, no DB — key storage/lookup is the caller's job.

import crypto from 'crypto';

export interface DeviceCertPayload {
  deviceId: string;
  schoolId: string;
  role: 'gate' | 'teacher' | 'admin';
  issuedAt: number; // unix seconds
}

export type DeviceCertVerifyResult =
  | { valid: true; payload: DeviceCertPayload }
  | { valid: false; reason: 'BAD_FORMAT' | 'BAD_SIGNATURE' };

/** Generates an EC P-256 keypair. Used to create the platform's enrolment-authority key, and in tests. */
export function generateP256KeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey: publicKey as string, privateKey: privateKey as string };
}

/** Issues a device certificate, signed by the platform's enrolment-authority private key. Server-side only. */
export function issueDeviceCertificate(payload: DeviceCertPayload, authorityPrivateKeyPem: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.sign('sha256', Buffer.from(data), authorityPrivateKeyPem).toString('base64url');
  return `${data}.${signature}`;
}

/** Verifies a device certificate against the platform's enrolment-authority public key. */
export function verifyDeviceCertificate(cert: string, authorityPublicKeyPem: string): DeviceCertVerifyResult {
  const parts = cert.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'BAD_FORMAT' };
  const [data, signature] = parts;

  let payload: DeviceCertPayload;
  try {
    payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
  } catch {
    return { valid: false, reason: 'BAD_FORMAT' };
  }

  let ok: boolean;
  try {
    ok = crypto.verify('sha256', Buffer.from(data), authorityPublicKeyPem, Buffer.from(signature, 'base64url'));
  } catch {
    return { valid: false, reason: 'BAD_FORMAT' };
  }

  if (!ok) return { valid: false, reason: 'BAD_SIGNATURE' };
  return { valid: true, payload };
}

/**
 * Verifies a device's signature over a canonical JSON batch payload against
 * that device's registered public key (see spec's batch upload contract —
 * "signature": base64 device-key signature over canonical JSON of events).
 * The device's own private key never leaves its secure hardware (or, for the
 * PWA scanner build, a non-extractable browser CryptoKey); the server only
 * ever holds the public key registered at enrolment.
 *
 * dsaEncoding: 'ieee-p1363' — the scanner-app signs via the Web Crypto API
 * (crypto.subtle.sign), which always produces a raw (r‖s) ECDSA signature,
 * not the DER/ASN.1 encoding Node's crypto module defaults to. Node has
 * supported 'ieee-p1363' since v12 specifically for this kind of interop; no
 * manual DER conversion needed on the browser side. A future native
 * (non-browser) device implementation would need to encode the same way.
 */
export function verifyBatchSignature(canonicalJson: string, signatureBase64: string, devicePublicKeyPem: string): boolean {
  try {
    return crypto.verify(
      'sha256',
      Buffer.from(canonicalJson),
      { key: devicePublicKeyPem, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}
