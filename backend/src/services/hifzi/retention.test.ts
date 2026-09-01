import { computeRetentionStrength, retentionBand } from './retention.service'

describe('computeRetentionStrength', () => {
  it('returns 100 at the moment of review (days_elapsed = 0)', () => {
    const now = new Date('2026-06-15T00:00:00Z')
    expect(computeRetentionStrength(10, now, now)).toBeCloseTo(100)
  })

  it('decays as days elapse', () => {
    const reviewedAt = new Date('2026-06-01T00:00:00Z')
    const strengthAtDay5 = computeRetentionStrength(10, reviewedAt, new Date('2026-06-06T00:00:00Z'))
    const strengthAtDay10 = computeRetentionStrength(10, reviewedAt, new Date('2026-06-11T00:00:00Z'))
    expect(strengthAtDay10).toBeLessThan(strengthAtDay5)
    expect(strengthAtDay5).toBeLessThan(100)
  })

  it('decays more slowly for a longer interval_days (a more established unit)', () => {
    const reviewedAt = new Date('2026-06-01T00:00:00Z')
    const now = new Date('2026-06-11T00:00:00Z') // 10 days later
    const shortInterval = computeRetentionStrength(5, reviewedAt, now)
    const longInterval = computeRetentionStrength(50, reviewedAt, now)
    expect(longInterval).toBeGreaterThan(shortInterval)
  })

  it('decays faster with a larger decay_scale', () => {
    const reviewedAt = new Date('2026-06-01T00:00:00Z')
    const now = new Date('2026-06-11T00:00:00Z')
    const fastDecay = computeRetentionStrength(10, reviewedAt, now, 0.5)
    const slowDecay = computeRetentionStrength(10, reviewedAt, now, 3.0)
    expect(fastDecay).toBeLessThan(slowDecay)
  })

  it('defaults decay_scale to 1.5 when not provided', () => {
    const reviewedAt = new Date('2026-06-01T00:00:00Z')
    const now = new Date('2026-06-11T00:00:00Z')
    expect(computeRetentionStrength(10, reviewedAt, now)).toBeCloseTo(computeRetentionStrength(10, reviewedAt, now, 1.5))
  })

  it('defaults `now` to the current time when not provided', () => {
    const justNow = new Date()
    expect(computeRetentionStrength(30, justNow)).toBeCloseTo(100, 0)
  })

  it('throws for a non-positive interval_days (would divide by zero)', () => {
    expect(() => computeRetentionStrength(0, new Date())).toThrow(/must be positive/)
    expect(() => computeRetentionStrength(-1, new Date())).toThrow(/must be positive/)
  })
})

describe('retentionBand', () => {
  it.each([
    [100, 'mastered'],
    [85.01, 'mastered'],
    [85, 'strong'], // boundary: exactly 85 is NOT mastered (spec says "> 85%")
    [70.01, 'strong'],
    [70, 'review_due'], // boundary: exactly 70 is NOT strong
    [50.01, 'review_due'],
    [50, 'weak'], // boundary: exactly 50 is NOT review_due
    [30.01, 'weak'],
    [30, 'critical'], // boundary: exactly 30 is NOT weak
    [0, 'critical'],
  ])('bands strength %s as "%s"', (strength, expected) => {
    expect(retentionBand(strength)).toBe(expected)
  })
})
