import crypto from 'crypto';
import { encryptKey, decryptKey } from './key-management';

const masterKey = crypto.randomBytes(32);
const otherMasterKey = crypto.randomBytes(32);

describe('encryptKey / decryptKey', () => {
  it('round-trips arbitrary key material', () => {
    const raw = crypto.randomBytes(32);
    const ciphertext = encryptKey(raw, masterKey);
    expect(decryptKey(ciphertext, masterKey)).toEqual(raw);
  });

  it('produces a different ciphertext each call (random IV) for the same input', () => {
    const raw = crypto.randomBytes(32);
    expect(encryptKey(raw, masterKey)).not.toBe(encryptKey(raw, masterKey));
  });

  it('fails to decrypt with the wrong master key', () => {
    const raw = crypto.randomBytes(32);
    const ciphertext = encryptKey(raw, masterKey);
    expect(() => decryptKey(ciphertext, otherMasterKey)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (GCM auth tag catches it)', () => {
    const raw = crypto.randomBytes(32);
    const ciphertext = encryptKey(raw, masterKey);
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip a bit in the encrypted payload
    const tampered = buf.toString('base64');
    expect(() => decryptKey(tampered, masterKey)).toThrow();
  });

  it('rejects a ciphertext too short to contain an IV and auth tag', () => {
    expect(() => decryptKey(Buffer.from([1, 2, 3]).toString('base64'), masterKey)).toThrow('Ciphertext too short');
  });
});
