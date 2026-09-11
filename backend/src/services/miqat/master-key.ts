// Resolves the AES-256-GCM master key (see key-management.ts) used to
// encrypt/decrypt Miqat secrets at rest (card_signing_key_ref etc.). Dev-only
// fallback mirrors devices.controller.ts's authority-keypair fallback —
// generated once per process, never in production (config/env.ts warns
// loudly there if MIQAT_MASTER_KEY is unset).

import crypto from 'crypto';
import { config } from '../../config/env';

let devMasterKey: Buffer | null = null;

export function getMasterKey(): Buffer {
  if (config.miqat.masterKeyBase64) {
    const key = Buffer.from(config.miqat.masterKeyBase64, 'base64');
    if (key.length !== 32) throw new Error('MIQAT_MASTER_KEY must decode to exactly 32 bytes');
    return key;
  }
  if (config.nodeEnv === 'production') {
    throw new Error('MIQAT_MASTER_KEY is not configured');
  }
  if (!devMasterKey) devMasterKey = crypto.randomBytes(32);
  return devMasterKey;
}
