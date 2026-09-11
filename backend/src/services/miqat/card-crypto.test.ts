import { signCardPayload, verifyCardPayload, base32Encode, base32Decode, CardPayload } from './card-crypto';
import crypto from 'crypto';

const key1 = crypto.randomBytes(32);
const key2 = crypto.randomBytes(32); // "previous" key for rotation tests

const payload: CardPayload = {
  schoolId: '11111111-1111-1111-1111-111111111111',
  personId: '22222222-2222-2222-2222-222222222222',
  cardRevision: 3,
  issuedAt: 1_757_000_000,
};

describe('base32Encode/base32Decode', () => {
  it('round-trips arbitrary byte buffers, including non-multiple-of-5-bit lengths', () => {
    for (const input of [Buffer.from([]), Buffer.from([1]), Buffer.from([1, 2, 3]), crypto.randomBytes(57)]) {
      expect(base32Decode(base32Encode(input))).toEqual(input);
    }
  });

  it('uses only the RFC 4648 alphabet (no padding characters)', () => {
    const encoded = base32Encode(crypto.randomBytes(20));
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
  });
});

describe('signCardPayload / verifyCardPayload', () => {
  it('round-trips a signed payload back to its original fields', () => {
    const encoded = signCardPayload(payload, key1);
    const result = verifyCardPayload(encoded, [key1]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload).toEqual(payload);
    }
  });

  it('rejects a card signed with an unknown key', () => {
    const encoded = signCardPayload(payload, key1);
    const result = verifyCardPayload(encoded, [key2]);
    expect(result).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
  });

  it('accepts during key-rotation overlap when either current or previous key matches', () => {
    const encodedWithOldKey = signCardPayload(payload, key2);
    // scanner offers both current (key1) and previous (key2) verification keys
    const result = verifyCardPayload(encodedWithOldKey, [key1, key2]);
    expect(result.valid).toBe(true);
  });

  it('rejects a tampered payload (person_id swapped) even though signature bytes are unchanged', () => {
    const encoded = signCardPayload(payload, key1);
    const tamperedPayload = { ...payload, personId: '33333333-3333-3333-3333-333333333333' };
    const reEncoded = signCardPayload(tamperedPayload, key2); // attacker doesn't have key1, must forge with something
    expect(verifyCardPayload(reEncoded, [key1]).valid).toBe(false);
    // sanity: the original untampered payload still verifies fine
    expect(verifyCardPayload(encoded, [key1]).valid).toBe(true);
  });

  it('rejects garbage input as BAD_FORMAT', () => {
    expect(verifyCardPayload('not-a-real-card!!!', [key1])).toEqual({ valid: false, reason: 'BAD_FORMAT' });
    expect(verifyCardPayload('', [key1])).toEqual({ valid: false, reason: 'BAD_FORMAT' });
  });

  it('rejects a payload of the wrong length as BAD_FORMAT', () => {
    const tooShort = base32Encode(Buffer.from([1, 2, 3]));
    expect(verifyCardPayload(tooShort, [key1])).toEqual({ valid: false, reason: 'BAD_FORMAT' });
  });

  it('rejects an unsupported version byte', () => {
    const encoded = signCardPayload(payload, key1);
    const raw = base32Decode(encoded);
    raw.writeUInt8(2, 0); // corrupt version byte to something this module doesn't know
    const reEncoded = base32Encode(raw);
    expect(verifyCardPayload(reEncoded, [key1])).toEqual({ valid: false, reason: 'UNSUPPORTED_VERSION' });
  });

  it('throws when signing a payload with a malformed UUID (programming-error guard)', () => {
    expect(() => signCardPayload({ ...payload, schoolId: 'not-a-uuid' }, key1)).toThrow('Invalid UUID');
  });

  it('preserves card_revision and issued_at exactly through the round trip', () => {
    const bigRevision: CardPayload = { ...payload, cardRevision: 4_000_000_000, issuedAt: 4_000_000_000 };
    const encoded = signCardPayload(bigRevision, key1);
    const result = verifyCardPayload(encoded, [key1]);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.cardRevision).toBe(4_000_000_000);
      expect(result.payload.issuedAt).toBe(4_000_000_000);
    }
  });
});
