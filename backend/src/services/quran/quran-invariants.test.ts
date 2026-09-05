jest.mock('../../config/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '../../config/supabase'
import {
  checkAyahIndexContiguity,
  checkPageMonotonicity,
  checkSurahAyahCounts,
  checkDivisionAssignments,
  runAllInvariantChecks,
} from './quran-invariants'

// ============================================================================
// Pure invariant-check functions — no database involved, so these run fast
// and exercise every branch directly against fixed fixture arrays.
// (NFR: 100% branch coverage on RangeResolver-equivalent logic — see
// backend/jest.config.js's coverageThreshold for services/quran/*.ts.)
// ============================================================================

describe('checkAyahIndexContiguity', () => {
  it('passes for a contiguous 1..N sequence', () => {
    const ayahs = [1, 2, 3, 4, 5].map((n) => ({ globalAyahIndex: n }))
    expect(checkAyahIndexContiguity(ayahs)).toEqual({ ok: true })
  })

  it('passes regardless of input order (sorts internally)', () => {
    const ayahs = [3, 1, 2].map((n) => ({ globalAyahIndex: n }))
    expect(checkAyahIndexContiguity(ayahs)).toEqual({ ok: true })
  })

  it('fails on an empty array', () => {
    const result = checkAyahIndexContiguity([])
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no ayat/i)
  })

  it('fails when the sequence does not start at 1', () => {
    const ayahs = [2, 3, 4].map((n) => ({ globalAyahIndex: n }))
    const result = checkAyahIndexContiguity(ayahs)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/must start at 1/)
  })

  it('fails on a gap in the sequence', () => {
    const ayahs = [1, 2, 4].map((n) => ({ globalAyahIndex: n }))
    const result = checkAyahIndexContiguity(ayahs)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/gap or duplicate/i)
  })

  it('fails on a duplicate index', () => {
    const ayahs = [1, 2, 2, 3].map((n) => ({ globalAyahIndex: n }))
    const result = checkAyahIndexContiguity(ayahs)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/gap or duplicate/i)
  })
})

describe('checkPageMonotonicity', () => {
  it('passes for a non-decreasing page sequence', () => {
    const pages = [
      { globalAyahIndex: 1, pageNumber: 1 },
      { globalAyahIndex: 2, pageNumber: 1 },
      { globalAyahIndex: 3, pageNumber: 2 },
    ]
    expect(checkPageMonotonicity(pages)).toEqual({ ok: true })
  })

  it('passes regardless of input order (sorts internally)', () => {
    const pages = [
      { globalAyahIndex: 3, pageNumber: 2 },
      { globalAyahIndex: 1, pageNumber: 1 },
      { globalAyahIndex: 2, pageNumber: 1 },
    ]
    expect(checkPageMonotonicity(pages)).toEqual({ ok: true })
  })

  it('fails on an empty array', () => {
    const result = checkPageMonotonicity([])
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no page mappings/i)
  })

  it('fails when a later ayah maps to an earlier page', () => {
    const pages = [
      { globalAyahIndex: 1, pageNumber: 2 },
      { globalAyahIndex: 2, pageNumber: 1 },
    ]
    const result = checkPageMonotonicity(pages)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/page number decreases/i)
  })
})

describe('checkSurahAyahCounts', () => {
  it('passes when declared counts match actual counts', () => {
    const surahs = [
      { surahNumber: 1, declaredCount: 7, actualCount: 7 },
      { surahNumber: 2, declaredCount: 286, actualCount: 286 },
    ]
    expect(checkSurahAyahCounts(surahs)).toEqual({ ok: true })
  })

  it('passes on an empty list (vacuously true)', () => {
    expect(checkSurahAyahCounts([])).toEqual({ ok: true })
  })

  it('fails when a surah is under-seeded', () => {
    const surahs = [{ surahNumber: 1, declaredCount: 7, actualCount: 6 }]
    const result = checkSurahAyahCounts(surahs)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/Surah 1/)
  })

  it('fails when a surah is over-seeded', () => {
    const surahs = [{ surahNumber: 1, declaredCount: 7, actualCount: 8 }]
    const result = checkSurahAyahCounts(surahs)
    expect(result.ok).toBe(false)
  })
})

describe('checkDivisionAssignments', () => {
  const valid = { globalAyahIndex: 1, juzNumber: 1, hizbNumber: 1, rubNumber: 1, thumnNumber: 1 }

  it('passes for a fully-assigned, in-range ayah', () => {
    expect(checkDivisionAssignments([valid])).toEqual({ ok: true })
  })

  it('passes on an empty list (vacuously true)', () => {
    expect(checkDivisionAssignments([])).toEqual({ ok: true })
  })

  it.each([
    ['juzNumber', null, /juz_number/],
    ['juzNumber', 0, /juz_number/],
    ['juzNumber', 31, /juz_number/],
    ['hizbNumber', null, /hizb_number/],
    ['hizbNumber', 0, /hizb_number/],
    ['hizbNumber', 61, /hizb_number/],
    ['rubNumber', null, /rub_number/],
    ['rubNumber', 0, /rub_number/],
    ['rubNumber', 241, /rub_number/],
    ['thumnNumber', 0, /thumn_number/],
    ['thumnNumber', 481, /thumn_number/],
  ])('fails when %s is %p', (field, value, expectedMessage) => {
    const ayah = { ...valid, [field]: value }
    const result = checkDivisionAssignments([ayah])
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(expectedMessage)
  })

  it('accepts the boundary values 30/60/240/480', () => {
    const boundary = { globalAyahIndex: 1, juzNumber: 30, hizbNumber: 60, rubNumber: 240, thumnNumber: 480 }
    expect(checkDivisionAssignments([boundary])).toEqual({ ok: true })
  })

  it('passes when thumnNumber is null — not every riwayah marks eighths of a hizb (e.g. Hafs)', () => {
    const ayah = { ...valid, thumnNumber: null }
    expect(checkDivisionAssignments([ayah])).toEqual({ ok: true })
  })
})

// ============================================================================
// runAllInvariantChecks — the DB-facing wrapper the seed script calls.
// Mocked-Supabase, same approach as quran-reference.test.ts (per-table FIFO
// queues; all calls here are sequential, not Promise.all'd, so a flat queue
// per table is sufficient — no interleaving to account for).
// ============================================================================

describe('runAllInvariantChecks', () => {
  type Result = { data: any; error: any }

  function chainable(result: Result) {
    const obj: any = {}
    for (const m of ['select', 'eq', 'range']) obj[m] = jest.fn(() => obj)
    obj.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
    return obj
  }

  const fromMock = supabase.from as jest.Mock
  let queues: Record<string, Result[]> = {}
  const queue = (table: string, result: Result) => (queues[table] ??= []).push(result)

  beforeEach(() => {
    queues = {}
    fromMock.mockReset()
    fromMock.mockImplementation((table: string) => {
      const q = queues[table]
      if (!q || q.length === 0) throw new Error(`Unexpected supabase.from("${table}") — no queued result`)
      return chainable(q.shift()!)
    })
  })

  const VALID_AYAH = { global_ayah_index: 1, juz_number: 1, hizb_number: 1, rub_number: 1, thumn_number: 1, surah_id: 's1' }

  it('resolves without throwing when every check passes (no editionId)', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null })
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 1 }], error: null })
    await expect(runAllInvariantChecks('riwayah-1')).resolves.toBeUndefined()
  })

  it('pages through results past the 1000-row PostgREST default cap (regression test for the false-alarm bug this fixed)', async () => {
    // A single unpaginated .select() silently truncates at 1000 rows — this
    // is exactly the bug that made a real, complete 6236-ayah Hafs seed look
    // "broken" (fake gaps past row 1000) even though every row was correctly
    // written. Exercise a first page at exactly PAGE_SIZE (1000) — forcing a
    // second .from() call — followed by a shorter final page.
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({ ...VALID_AYAH, global_ayah_index: i + 1, surah_id: 's1' }))
    const secondPage = [{ ...VALID_AYAH, global_ayah_index: 1001, surah_id: 's1' }]
    queue('quran_ayahs', { data: firstPage, error: null })
    queue('quran_ayahs', { data: secondPage, error: null })
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 1001 }], error: null })
    await expect(runAllInvariantChecks('riwayah-1')).resolves.toBeUndefined()
  })

  it('resolves without throwing when every check passes (with editionId, page monotonicity checked)', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null })
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 1 }], error: null })
    queue('quran_edition_ayah_pages', { data: [{ page_number: 1, quran_ayahs: { global_ayah_index: 1 } }], error: null })
    await expect(runAllInvariantChecks('riwayah-1', 'edition-1')).resolves.toBeUndefined()
  })

  it('throws when the ayat query fails', async () => {
    queue('quran_ayahs', { data: null, error: { message: 'db error' } })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/failed to fetch ayat/)
  })

  it('treats a null (but errorless) data page as "no more rows" rather than crashing', async () => {
    queue('quran_ayahs', { data: null, error: null })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/ayah index contiguity/)
  })

  it('throws on an ayah-index contiguity violation', async () => {
    queue('quran_ayahs', { data: [{ ...VALID_AYAH, global_ayah_index: 2 }], error: null })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/ayah index contiguity/)
  })

  it('throws on a division-assignment violation', async () => {
    queue('quran_ayahs', { data: [{ ...VALID_AYAH, juz_number: null }], error: null })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/division assignments/)
  })

  it('throws when the surahs query fails', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null })
    queue('quran_surahs', { data: null, error: { message: 'db error' } })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/failed to fetch surahs/)
  })

  it('throws on a surah-ayah-count mismatch', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null })
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 5 }], error: null }) // declared 5, only 1 seeded
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/surah ayah counts/)
  })

  it('throws when a declared surah has zero seeded ayat at all (the actualCounts fallback branch)', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null }) // belongs to surah 's1'
    queue('quran_surahs', {
      data: [
        { id: 's1', number: 1, ayah_count: 1 },
        { id: 's2', number: 2, ayah_count: 3 }, // no ayah rows reference 's2' at all
      ],
      error: null,
    })
    await expect(runAllInvariantChecks('riwayah-1')).rejects.toThrow(/Surah 2: declared ayah_count=3 but 0 ayah rows/)
  })

  it('throws when the page-mapping query fails', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH], error: null })
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 1 }], error: null })
    queue('quran_edition_ayah_pages', { data: null, error: { message: 'db error' } })
    await expect(runAllInvariantChecks('riwayah-1', 'edition-1')).rejects.toThrow(/failed to fetch page mappings/)
  })

  it('throws on a page-monotonicity violation', async () => {
    queue('quran_ayahs', { data: [VALID_AYAH, { ...VALID_AYAH, global_ayah_index: 2 }], error: null })
    // declared+actual both 2 so the surah-count check passes and we reach the page check
    queue('quran_surahs', { data: [{ id: 's1', number: 1, ayah_count: 2 }], error: null })
    queue('quran_edition_ayah_pages', {
      data: [
        { page_number: 3, quran_ayahs: { global_ayah_index: 1 } },
        { page_number: 1, quran_ayahs: { global_ayah_index: 2 } },
      ],
      error: null,
    })
    await expect(runAllInvariantChecks('riwayah-1', 'edition-1')).rejects.toThrow(/page monotonicity/)
  })
})
