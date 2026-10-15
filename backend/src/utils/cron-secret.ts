import { timingSafeEqual } from 'node:crypto'

/**
 * True only when CRON_SECRET is configured and the request's x-cron-secret header matches it.
 * Fails closed: an unset secret used to let any signed-in user run platform-wide fee jobs.
 */
export function cronSecretValid(header: unknown, expected: string | undefined = process.env.CRON_SECRET): boolean {
  if (!expected || typeof header !== 'string') return false
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
