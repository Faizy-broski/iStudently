import crypto from 'crypto';

const SECRET = process.env.QAIDA_TOKEN_SECRET || 'qaida-dev-secret-do-not-use-in-prod';
const ALGORITHM = 'sha256';

export interface TokenPayload {
  stationId: string;
  itemKey: string;
  correctKey: string;
  exp: number;
}

export function signAttemptToken(
  stationId: string, 
  itemKey: string, 
  correctKey: string, 
  ttlSeconds: number = 600
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload: TokenPayload = { stationId, itemKey, correctKey, exp };
  
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac(ALGORITHM, SECRET);
  hmac.update(data);
  const signature = hmac.digest('base64url');
  
  return `${data}.${signature}`;
}

export function verifyAttemptToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    
    const [data, signature] = parts;
    const hmac = crypto.createHmac(ALGORITHM, SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('base64url');
    
    // Constant time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }
    
    const payload: TokenPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}
