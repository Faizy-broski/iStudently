import { computeRawScore, resolveGradeCode, DEFAULT_GRADING_WEIGHTS, DEFAULT_GRADE_BANDS, type GradeBand } from './grading-engine.service'

describe('computeRawScore', () => {
  it('returns 10 for a perfect recitation (no errors)', () => {
    expect(computeRawScore([], DEFAULT_GRADING_WEIGHTS)).toBe(10)
  })

  it('deducts count × weight per error type', () => {
    // 2 major (1.00 each) + 1 minor (0.25) = 2.25 penalty -> 7.75
    const score = computeRawScore(
      [
        { errorType: 'major', count: 2 },
        { errorType: 'minor', count: 1 },
      ],
      DEFAULT_GRADING_WEIGHTS
    )
    expect(score).toBeCloseTo(7.75)
  })

  it('applies the exact default weight table from the spec', () => {
    const allOnce = Object.keys(DEFAULT_GRADING_WEIGHTS).map((errorType) => ({ errorType, count: 1 }))
    const totalWeight = Object.values(DEFAULT_GRADING_WEIGHTS).reduce((a, b) => a + b, 0)
    expect(computeRawScore(allOnce, DEFAULT_GRADING_WEIGHTS)).toBeCloseTo(Math.max(0, 10 - totalWeight))
  })

  it('clamps at 0 for a recitation with overwhelming errors', () => {
    const score = computeRawScore([{ errorType: 'major', count: 50 }], DEFAULT_GRADING_WEIGHTS)
    expect(score).toBe(0)
  })

  it('treats an unweighted (unconfigured) error type as zero penalty, failing open', () => {
    const score = computeRawScore([{ errorType: 'unknown_type', count: 5 }], DEFAULT_GRADING_WEIGHTS)
    expect(score).toBe(10)
  })

  it('the "performance" error type is noted but never deducted (weight 0.00)', () => {
    const score = computeRawScore([{ errorType: 'performance', count: 100 }], DEFAULT_GRADING_WEIGHTS)
    expect(score).toBe(10)
  })

  it('a zero-count error entry has no effect', () => {
    const score = computeRawScore([{ errorType: 'major', count: 0 }], DEFAULT_GRADING_WEIGHTS)
    expect(score).toBe(10)
  })
})

describe('resolveGradeCode', () => {
  it('resolves each default band at its exact lower boundary', () => {
    expect(resolveGradeCode(9.5, DEFAULT_GRADE_BANDS)).toBe('mastered')
    expect(resolveGradeCode(8.5, DEFAULT_GRADE_BANDS)).toBe('excellent')
    expect(resolveGradeCode(7.5, DEFAULT_GRADE_BANDS)).toBe('very_good')
    expect(resolveGradeCode(6.5, DEFAULT_GRADE_BANDS)).toBe('good')
    expect(resolveGradeCode(5.0, DEFAULT_GRADE_BANDS)).toBe('acceptable')
    expect(resolveGradeCode(4.99, DEFAULT_GRADE_BANDS)).toBe('needs_redo')
  })

  it('resolves the top of a band just below the next boundary', () => {
    expect(resolveGradeCode(9.4, DEFAULT_GRADE_BANDS)).toBe('excellent')
    expect(resolveGradeCode(10, DEFAULT_GRADE_BANDS)).toBe('mastered')
    expect(resolveGradeCode(0, DEFAULT_GRADE_BANDS)).toBe('needs_redo')
  })

  it('is indifferent to band input order', () => {
    const shuffled = [...DEFAULT_GRADE_BANDS].reverse()
    expect(resolveGradeCode(8.7, shuffled)).toBe('excellent')
  })

  it('throws when no bands are configured', () => {
    expect(() => resolveGradeCode(8, [])).toThrow(/no grade bands configured/)
  })

  it('falls back to the lowest band when the score is below every band minimum (defensive)', () => {
    const bands: GradeBand[] = [{ code: 'only_band', minScore: 5 }]
    expect(resolveGradeCode(1, bands)).toBe('only_band')
  })

  it('supports fully custom branch-configured weights and bands, not just the defaults', () => {
    const customWeights = { talqeen: 2.0 }
    const customBands: GradeBand[] = [
      { code: 'gold', minScore: 9 },
      { code: 'silver', minScore: 6 },
      { code: 'bronze', minScore: 0 },
    ]
    const score = computeRawScore([{ errorType: 'talqeen', count: 2 }], customWeights) // 10 - 4 = 6
    expect(score).toBe(6)
    expect(resolveGradeCode(score, customBands)).toBe('silver')
  })
})
