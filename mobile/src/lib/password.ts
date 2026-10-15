import { getRandomBytes } from 'expo-crypto'

// No look-alikes (0/O, 1/l/I).
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '@#$%&*!?'
const ALL = UPPER + LOWER + DIGITS + SYMBOLS

/** Uniform integer in [0, n) from the secure RNG (rejection sampling, no modulo bias). */
function randomInt(n: number): number {
  const limit = 2 ** 32 - (2 ** 32 % n)
  while (true) {
    const [a, b, c, d] = getRandomBytes(4)
    const v = ((a << 24) >>> 0) + (b << 16) + (c << 8) + d
    if (v < limit) return v % n
  }
}

const pick = (set: string) => set[randomInt(set.length)]

/** Strong random password with at least one of each character class. */
export function generatePassword(length = 14): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < length) chars.push(pick(ALL))
  // Fisher-Yates with secure randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

/** "Al Noor School" -> "al-noor-school" (Latin letters/digits only; Arabic names need a manual slug). */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}
