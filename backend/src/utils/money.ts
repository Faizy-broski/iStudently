/**
 * Rounds a monetary value to 2 decimal places before it is persisted,
 * avoiding accumulated binary-float drift (e.g. 123.45999999999998).
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Parses a monetary amount from user input, rejecting NaN/negative values.
 * Throws if the value is not a valid non-negative number.
 */
export function parseMoney(value: unknown, fieldName = 'amount'): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}: must be a number`)
  }
  if (parsed < 0) {
    throw new Error(`Invalid ${fieldName}: must not be negative`)
  }
  return round2(parsed)
}
