// The address people open to sign in — printed on credentials cards and ID cards and encoded
// in their QR codes. Trailing slash matches next.config's trailingSlash, so it doesn't redirect.
//
// Set NEXT_PUBLIC_LOGIN_URL to point cards at a different host (e.g. a staging or
// school-specific domain) without a code change.
const DEFAULT_LOGIN_URL = 'https://istudent.ly/auth/login/'

export function getLoginUrl(): string {
  return process.env.NEXT_PUBLIC_LOGIN_URL?.trim() || DEFAULT_LOGIN_URL
}
