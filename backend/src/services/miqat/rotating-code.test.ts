import crypto from 'crypto';
import { generateRotatingCode, verifyRotatingCode } from './rotating-code';

const secret = crypto.randomBytes(32);
const otherSecret = crypto.randomBytes(32);
const personId = 'staff-1';

describe('generateRotatingCode', () => {
  it('defaults to the current time when no `now` is passed', () => {
    const { code } = generateRotatingCode(personId, secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces a 6-digit numeric code', () => {
    const { code } = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:00Z'));
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces the same code within the same 30s step', () => {
    const a = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:00.000Z'));
    const b = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:29.999Z'));
    expect(a.code).toBe(b.code);
    expect(a.step).toBe(b.step);
  });

  it('produces a different code in the next step', () => {
    const a = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:00.000Z'));
    const b = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:30.000Z'));
    expect(a.step).not.toBe(b.step);
    // codes could theoretically collide by chance, but step must differ
  });

  it('produces different codes for different secrets at the same step', () => {
    const a = generateRotatingCode(personId, secret, new Date('2026-09-12T07:00:00Z'));
    const b = generateRotatingCode(personId, otherSecret, new Date('2026-09-12T07:00:00Z'));
    expect(a.code).not.toBe(b.code);
  });
});

describe('verifyRotatingCode', () => {
  it('accepts a code generated for the current step', () => {
    const now = new Date('2026-09-12T07:00:00Z');
    const { code } = generateRotatingCode(personId, secret, now);
    expect(verifyRotatingCode(code, secret, now)).toBe(true);
  });

  it('accepts a code from one step behind (clock drift tolerance)', () => {
    const genTime = new Date('2026-09-12T07:00:00Z');
    const verifyTime = new Date('2026-09-12T07:00:30Z'); // one step later
    const { code } = generateRotatingCode(personId, secret, genTime);
    expect(verifyRotatingCode(code, secret, verifyTime)).toBe(true);
  });

  it('accepts a code from one step ahead (clock drift tolerance)', () => {
    const genTime = new Date('2026-09-12T07:00:30Z');
    const verifyTime = new Date('2026-09-12T07:00:00Z'); // one step earlier
    const { code } = generateRotatingCode(personId, secret, genTime);
    expect(verifyRotatingCode(code, secret, verifyTime)).toBe(true);
  });

  it('rejects a code more than one step away', () => {
    const genTime = new Date('2026-09-12T07:00:00Z');
    const verifyTime = new Date('2026-09-12T07:02:00Z'); // 4 steps later
    const { code } = generateRotatingCode(personId, secret, genTime);
    expect(verifyRotatingCode(code, secret, verifyTime)).toBe(false);
  });

  it('rejects a code verified against the wrong secret', () => {
    const now = new Date('2026-09-12T07:00:00Z');
    const { code } = generateRotatingCode(personId, secret, now);
    expect(verifyRotatingCode(code, otherSecret, now)).toBe(false);
  });

  it('rejects a code of the wrong length without throwing', () => {
    expect(verifyRotatingCode('123', secret)).toBe(false);
    expect(verifyRotatingCode('1234567', secret)).toBe(false);
  });
});
