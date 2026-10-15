type QueryValue = string | number | boolean | undefined | null | (string | number)[]

/** Builds "?a=1&b=x" from defined values; arrays repeat the key (a=1&a=2). Empty -> "". */
export function qs(params: Record<string, QueryValue>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.length ? `?${parts.join('&')}` : ''
}
