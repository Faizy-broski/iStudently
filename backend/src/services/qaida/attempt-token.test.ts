import { signAttemptToken, verifyAttemptToken } from './attempt-token';

describe('attempt-token', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-11T00:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('signs and verifies a valid token', () => {
    const token = signAttemptToken('W1_S1', 'item_1', 'correct_ans', 600);
    const payload = verifyAttemptToken(token);
    
    expect(payload).not.toBeNull();
    expect(payload?.stationId).toBe('W1_S1');
    expect(payload?.itemKey).toBe('item_1');
    expect(payload?.correctKey).toBe('correct_ans');
  });

  it('signs a token with default ttl', () => {
    const token = signAttemptToken('W1_S1', 'item_1', 'correct_ans');
    const payload = verifyAttemptToken(token);
    expect(payload?.exp).toBe(Math.floor(Date.now() / 1000) + 600);
  });

  it('rejects an expired token', () => {
    const token = signAttemptToken('W1_S1', 'item_1', 'correct_ans', 600);
    
    // Advance time by 601 seconds
    jest.advanceTimersByTime(601 * 1000);
    
    const payload = verifyAttemptToken(token);
    expect(payload).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyAttemptToken('invalid.token.format')).toBeNull();
    expect(verifyAttemptToken('invalidtokenformat')).toBeNull();
  });

  it('rejects a tampered token signature', () => {
    const token = signAttemptToken('W1_S1', 'item_1', 'correct_ans', 600);
    const [data, sig] = token.split('.');
    
    const tamperedToken = `${data}.tampered${sig}`;
    expect(verifyAttemptToken(tamperedToken)).toBeNull();
  });

  it('rejects tampered data with valid format', () => {
    const token = signAttemptToken('W1_S1', 'item_1', 'correct_ans', 600);
    const [data, sig] = token.split('.');
    
    // Tamper with base64url data
    const tamperedData = Buffer.from(JSON.stringify({ stationId: 'hack', exp: 9999999999 })).toString('base64url');
    const tamperedToken = `${tamperedData}.${sig}`;
    
    expect(verifyAttemptToken(tamperedToken)).toBeNull();
  });

  it('handles JSON parse errors safely', () => {
    const data = Buffer.from('not json').toString('base64url');
    const hmac = require('crypto').createHmac('sha256', process.env.QAIDA_TOKEN_SECRET || 'qaida-dev-secret-do-not-use-in-prod');
    hmac.update(data);
    const signature = hmac.digest('base64url');
    
    const token = `${data}.${signature}`;
    expect(verifyAttemptToken(token)).toBeNull();
  });
});
