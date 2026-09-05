// ============================================================================
// QuranReferenceService — unit tests against a mocked Supabase client.
//
// No live database dependency: this repo's existing services/fina/*.test.ts
// suite also runs against a mocked Supabase client rather than a live test
// DB, so mocking here matches the established pattern. The correct way to
// hit high branch coverage on this DB-coupled service without flaky
// live-infra dependence is to mock the query builder's chainable/thenable
// shape and assert on each branch.
//
// The mock queues results PER TABLE NAME (not a flat call-order queue),
// because several service methods run two Promise.all'd sub-calls
// concurrently (e.g. resolving both endpoints of a custom range), which
// interleaves the underlying .from() calls: both start.eq('quran_surahs')
// and end.eq('quran_surahs') resolve before either's .eq('quran_ayahs')
// follow-up, not start-then-end sequentially. Per-table FIFO queues are
// robust to that interleaving because calls to the *same* table are still
// issued in a stable, predictable order even when calls across *different*
// tables interleave.
// ============================================================================

jest.mock('../../config/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '../../config/supabase'
import { quranReferenceService } from './quran-reference.service'

type Result = { data: any; error: any; count?: number }

/** A chainable + thenable stand-in for supabase-js's PostgrestFilterBuilder. */
function chainable(result: Result) {
  const obj: any = {}
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'order', 'in', 'limit']) {
    obj[m] = jest.fn(() => obj)
  }
  obj.single = jest.fn(() => Promise.resolve(result))
  obj.maybeSingle = jest.fn(() => Promise.resolve(result))
  // supabase-js builders are themselves thenable when awaited without a terminal
  // method (used by countAyat's head-count query and ayatOnPage's plain select).
  obj.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return obj
}

const fromMock = supabase.from as jest.Mock
let tableQueues: Record<string, Result[]> = {}

function queue(table: string, result: Result) {
  ;(tableQueues[table] ??= []).push(result)
}

beforeEach(() => {
  tableQueues = {}
  fromMock.mockReset()
  fromMock.mockImplementation((table: string) => {
    const q = tableQueues[table]
    if (!q || q.length === 0) {
      throw new Error(`Unexpected supabase.from("${table}") call — no queued mock result for this table`)
    }
    return chainable(q.shift()!)
  })
  delete process.env.HIFZI_ALLOW_UNVERIFIED_QURAN_DATA
})

const RIWAYAH_ROW: Result = { data: { id: 'riwayah-hafs' }, error: null }
const EDITION_ROW: Result = { data: { id: 'edition-1', riwayah_id: 'riwayah-hafs', verified_at: '2026-01-01T00:00:00Z' }, error: null }
const UNVERIFIED_EDITION_ROW: Result = { data: { id: 'edition-2', riwayah_id: 'riwayah-hafs', verified_at: null }, error: null }

/** Queues one getAyahBySurahAyah() lookup (a quran_surahs row, then a quran_ayahs row). */
function queueAyahLookup(surahId: string, ayahId: string, globalIndex: number) {
  queue('quran_surahs', { data: { id: surahId }, error: null })
  queue('quran_ayahs', { data: { id: ayahId, global_ayah_index: globalIndex }, error: null })
}

describe('resolveRange', () => {
  it('unitType "custom" resolves a start/end ayah span', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1) // start
    queueAyahLookup('surah-1', 'ayah-5', 5) // end

    const range = await quranReferenceService.resolveRange('hafs', {
      unitType: 'custom',
      startAyah: { surahNumber: 1, ayahNumber: 1 },
      endAyah: { surahNumber: 1, ayahNumber: 5 },
    })

    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'ayah-1', endAyahId: 'ayah-5' })
  })

  it('unitType "custom" throws if endAyah precedes startAyah', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-5', 5) // start
    queueAyahLookup('surah-1', 'ayah-1', 1) // end

    await expect(
      quranReferenceService.resolveRange('hafs', {
        unitType: 'custom',
        startAyah: { surahNumber: 1, ayahNumber: 5 },
        endAyah: { surahNumber: 1, ayahNumber: 1 },
      })
    ).rejects.toThrow(/precedes/)
  })

  it('unitType "custom" throws if startAyah/endAyah are missing', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'custom' })).rejects.toThrow(/requires startAyah/)
  })

  it('unitType "surah" resolves the first and last ayah of the surah', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: { id: 'surah-1' }, error: null })
    queue('quran_ayahs', {
      data: [{ id: 'ayah-1', global_ayah_index: 1 }, { id: 'ayah-7', global_ayah_index: 7 }],
      error: null,
    })

    const range = await quranReferenceService.resolveRange('hafs', { unitType: 'surah', number: 1 })
    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'ayah-1', endAyahId: 'ayah-7' })
  })

  it('unitType "surah" throws when the surah is not found', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'surah', number: 999 })).rejects.toThrow(/not found/)
  })

  it('unitType "surah" throws when number is missing', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'surah' })).rejects.toThrow(/requires number/)
  })

  it('unitType "surah" throws when the surah exists but has no seeded ayat', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: { id: 'surah-1' }, error: null })
    queue('quran_ayahs', { data: [], error: null })
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'surah', number: 1 })).rejects.toThrow(/No ayat found for surah/)
  })

  it('throws for an unsupported unitType (defensive branch, bypassing the type system)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    await expect(
      quranReferenceService.resolveRange('hafs', { unitType: 'bogus' as any, number: 1 })
    ).rejects.toThrow(/unsupported unitType/)
  })

  it.each(['juz', 'hizb', 'rub', 'thumn'] as const)('unitType "%s" resolves via the matching division column', async (unitType) => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', {
      data: [{ id: 'ayah-10', global_ayah_index: 10 }, { id: 'ayah-20', global_ayah_index: 20 }],
      error: null,
    })

    const range = await quranReferenceService.resolveRange('hafs', { unitType, number: 1 })
    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'ayah-10', endAyahId: 'ayah-20' })
  })

  it('unitType "juz" throws when nothing matches', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: [], error: null })
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'juz', number: 1 })).rejects.toThrow(/No ayat found/)
  })

  it('unitType "juz" throws when number is missing', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'juz' })).rejects.toThrow(/requires number/)
  })

  it('unitType "page" resolves via ayatOnPage then the first/last ayah lookup', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', EDITION_ROW) // ayatOnPage -> getEdition
    queue('quran_edition_ayah_pages', {
      data: [
        { ayah_id: 'a2', quran_ayahs: { ayah_number_in_surah: 2, global_ayah_index: 2, quran_surahs: { number: 1 } } },
        { ayah_id: 'a1', quran_ayahs: { ayah_number_in_surah: 1, global_ayah_index: 1, quran_surahs: { number: 1 } } },
      ],
      error: null,
    })
    queueAyahLookup('surah-1', 'ayah-1', 1) // getAyahBySurahAyah(start = ayah 1)
    queueAyahLookup('surah-1', 'ayah-2', 2) // getAyahBySurahAyah(end = ayah 2)

    const range = await quranReferenceService.resolveRange('hafs', { unitType: 'page', editionCode: 'madani', number: 1 })
    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'ayah-1', endAyahId: 'ayah-2' })
  })

  it('unitType "page" throws when editionCode/number are missing', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    await expect(quranReferenceService.resolveRange('hafs', { unitType: 'page' })).rejects.toThrow(/requires editionCode/)
  })

  it('unitType "page" throws when the page has no ayat', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', EDITION_ROW)
    queue('quran_edition_ayah_pages', { data: [], error: null })
    await expect(
      quranReferenceService.resolveRange('hafs', { unitType: 'page', editionCode: 'madani', number: 999 })
    ).rejects.toThrow(/No ayat found on page/)
  })

  it('throws for an unknown riwayah code', async () => {
    queue('quran_riwayat', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.resolveRange('bogus', { unitType: 'surah', number: 1 })).rejects.toThrow(/Unknown riwayah/)
  })
})

describe('resolveDivisionRange', () => {
  it('resolves a range spanning multiple divisions (start-of-first-division through end-of-last-division)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW) // start resolveRange's getRiwayahIdByCode
    queue('quran_riwayat', RIWAYAH_ROW) // end resolveRange's getRiwayahIdByCode
    queue('quran_ayahs', { data: [{ id: 'ayah-470-start', global_ayah_index: 100 }, { id: 'ayah-470-end', global_ayah_index: 105 }], error: null }) // thumn 470
    queue('quran_ayahs', { data: [{ id: 'ayah-472-start', global_ayah_index: 106 }, { id: 'ayah-472-end', global_ayah_index: 112 }], error: null }) // thumn 472
    queue('quran_ayahs', { data: { global_ayah_index: 100 }, error: null }) // re-check: resolved start ayah
    queue('quran_ayahs', { data: { global_ayah_index: 112 }, error: null }) // re-check: resolved end ayah

    const range = await quranReferenceService.resolveDivisionRange('hafs', 'thumn', 470, 472)
    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'ayah-470-start', endAyahId: 'ayah-472-end' })
  })

  it('resolves a single-division range when startNumber === endNumber', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: [{ id: 'a1', global_ayah_index: 1 }, { id: 'a8', global_ayah_index: 8 }], error: null })
    queue('quran_ayahs', { data: [{ id: 'a1', global_ayah_index: 1 }, { id: 'a8', global_ayah_index: 8 }], error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 8 }, error: null })

    const range = await quranReferenceService.resolveDivisionRange('hafs', 'juz', 1, 1)
    expect(range).toEqual({ riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a8' })
  })

  it('throws immediately when endNumber precedes startNumber, without querying anything', async () => {
    await expect(quranReferenceService.resolveDivisionRange('hafs', 'thumn', 472, 470)).rejects.toThrow(/precedes start/)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws when a resolved endpoint ayah cannot be re-fetched (defensive not-found guard)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: [{ id: 'a1', global_ayah_index: 1 }], error: null })
    queue('quran_ayahs', { data: [{ id: 'a2', global_ayah_index: 2 }], error: null })
    queue('quran_ayahs', { data: null, error: { message: 'not found' } })
    queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })

    await expect(quranReferenceService.resolveDivisionRange('hafs', 'thumn', 1, 2)).rejects.toThrow(/resolved ayah not found/)
  })

  it('throws when the resolved range end precedes the resolved start (numbering inconsistent with global_ayah_index)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: [{ id: 'a-high', global_ayah_index: 50 }], error: null })
    queue('quran_ayahs', { data: [{ id: 'a-low', global_ayah_index: 10 }], error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 50 }, error: null }) // resolved start
    queue('quran_ayahs', { data: { global_ayah_index: 10 }, error: null }) // resolved end — precedes start

    await expect(quranReferenceService.resolveDivisionRange('hafs', 'thumn', 1, 2)).rejects.toThrow(/resolved range end precedes start/)
  })
})

describe('the religious sign-off gate (getEdition, exercised via ayatOnPage)', () => {
  it('refuses to serve an unverified edition by default', async () => {
    queue('quran_editions', UNVERIFIED_EDITION_ROW)
    await expect(quranReferenceService.ayatOnPage('unverified-edition', 1)).rejects.toThrow(/not been signed off/)
  })

  it('serves an unverified edition when HIFZI_ALLOW_UNVERIFIED_QURAN_DATA=true', async () => {
    process.env.HIFZI_ALLOW_UNVERIFIED_QURAN_DATA = 'true'
    queue('quran_editions', UNVERIFIED_EDITION_ROW)
    queue('quran_edition_ayah_pages', { data: [], error: null })
    await expect(quranReferenceService.ayatOnPage('unverified-edition', 1)).resolves.toEqual([])
  })

  it('throws for an unknown edition code', async () => {
    queue('quran_editions', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.ayatOnPage('bogus', 1)).rejects.toThrow(/Unknown edition/)
  })
})

describe('ayatOnPage', () => {
  it('returns ayat sorted by Quran order regardless of query order', async () => {
    queue('quran_editions', EDITION_ROW)
    queue('quran_edition_ayah_pages', {
      data: [
        { ayah_id: 'a3', quran_ayahs: { ayah_number_in_surah: 3, global_ayah_index: 3, quran_surahs: { number: 2 } } },
        { ayah_id: 'a1', quran_ayahs: { ayah_number_in_surah: 1, global_ayah_index: 1, quran_surahs: { number: 2 } } },
      ],
      error: null,
    })

    const refs = await quranReferenceService.ayatOnPage('madani', 5)
    expect(refs).toEqual([
      { surahNumber: 2, ayahNumber: 1 },
      { surahNumber: 2, ayahNumber: 3 },
    ])
  })

  it('throws on a query error', async () => {
    queue('quran_editions', EDITION_ROW)
    queue('quran_edition_ayah_pages', { data: null, error: { message: 'db down' } })
    await expect(quranReferenceService.ayatOnPage('madani', 5)).rejects.toThrow(/db down/)
  })

  it('returns an empty array when the query succeeds with no data (defensive null-guard)', async () => {
    queue('quran_editions', EDITION_ROW)
    queue('quran_edition_ayah_pages', { data: null, error: null })
    await expect(quranReferenceService.ayatOnPage('madani', 5)).resolves.toEqual([])
  })
})

describe('pageOfAyah', () => {
  it('returns the page number for a known ayah', async () => {
    queue('quran_editions', EDITION_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_edition_ayah_pages', { data: { page_number: 3 }, error: null })

    const page = await quranReferenceService.pageOfAyah('madani', { surahNumber: 1, ayahNumber: 1 })
    expect(page).toBe(3)
  })

  it('throws when no page mapping exists', async () => {
    queue('quran_editions', EDITION_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_edition_ayah_pages', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.pageOfAyah('madani', { surahNumber: 1, ayahNumber: 1 })).rejects.toThrow(/No page mapping/)
  })

  it('throws when the surah does not exist for this riwayah (getAyahBySurahAyah)', async () => {
    queue('quran_editions', EDITION_ROW)
    queue('quran_surahs', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.pageOfAyah('madani', { surahNumber: 999, ayahNumber: 1 })).rejects.toThrow(/Surah 999 not found/)
  })

  it('throws when the ayah number does not exist within an otherwise-valid surah (getAyahBySurahAyah)', async () => {
    queue('quran_editions', EDITION_ROW)
    queue('quran_surahs', { data: { id: 'surah-1' }, error: null })
    queue('quran_ayahs', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.pageOfAyah('madani', { surahNumber: 1, ayahNumber: 999 })).rejects.toThrow(/Ayah 1:999 not found/)
  })
})

describe('ayahsInRange', () => {
  it('returns ayah text ordered by Quran order', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', { data: [{ verified_at: '2026-01-01T00:00:00Z' }], error: null }) // assertRiwayahTextIsVerified
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null }) // start endpoint lookup
    queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null }) // end endpoint lookup
    queue('quran_ayahs', {
      data: [
        { id: 'a1', ayah_number_in_surah: 1, text_uthmani: 'بِسْمِ اللَّهِ', sajda: false, global_ayah_index: 1, quran_surahs: { number: 1 } },
        { id: 'a2', ayah_number_in_surah: 2, text_uthmani: 'الْحَمْدُ لِلَّهِ', sajda: false, global_ayah_index: 2, quran_surahs: { number: 1 } },
      ],
      error: null,
    })

    const result = await quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
    expect(result).toEqual([
      { id: 'a1', surahNumber: 1, ayahNumber: 1, textUthmani: 'بِسْمِ اللَّهِ', sajda: false },
      { id: 'a2', surahNumber: 1, ayahNumber: 2, textUthmani: 'الْحَمْدُ لِلَّهِ', sajda: false },
    ])
  })

  it('throws when the start ayah id is not found', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', { data: [{ verified_at: '2026-01-01T00:00:00Z' }], error: null })
    queue('quran_ayahs', { data: null, error: { message: 'not found' } })
    queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })
    await expect(
      quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'bad', endAyahId: 'a2' })
    ).rejects.toThrow(/not found/)
  })

  it('throws when the end precedes the start', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', { data: [{ verified_at: '2026-01-01T00:00:00Z' }], error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 5 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    await expect(
      quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a5', endAyahId: 'a1' })
    ).rejects.toThrow(/precedes/)
  })

  it('throws when the range query fails', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', { data: [{ verified_at: '2026-01-01T00:00:00Z' }], error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })
    queue('quran_ayahs', { data: null, error: { message: 'db down' } })
    await expect(
      quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
    ).rejects.toThrow(/ayahsInRange failed/)
  })

  it('returns an empty array when the query succeeds with no data (defensive null-guard)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_editions', { data: [{ verified_at: '2026-01-01T00:00:00Z' }], error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })
    queue('quran_ayahs', { data: null, error: null })
    const result = await quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
    expect(result).toEqual([])
  })

  describe('the religious sign-off gate (assertRiwayahTextIsVerified)', () => {
    it('refuses to serve text when no edition of the riwayah is verified', async () => {
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_editions', { data: [{ verified_at: null }], error: null })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).rejects.toThrow(/not been signed off/)
    })

    it('refuses to serve text when the riwayah has no editions at all', async () => {
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_editions', { data: [], error: null })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).rejects.toThrow(/not been signed off/)
    })

    it('refuses to serve text when the editions query succeeds with null data (defensive null-guard)', async () => {
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_editions', { data: null, error: null })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).rejects.toThrow(/not been signed off/)
    })

    it('passes as soon as ANY edition of the riwayah is verified', async () => {
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_editions', { data: [{ verified_at: null }, { verified_at: '2026-01-01T00:00:00Z' }], error: null })
      queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
      queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })
      queue('quran_ayahs', { data: [], error: null })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).resolves.toEqual([])
    })

    it('serves unverified text when HIFZI_ALLOW_UNVERIFIED_QURAN_DATA=true (dev bypass, no editions query issued)', async () => {
      process.env.HIFZI_ALLOW_UNVERIFIED_QURAN_DATA = 'true'
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
      queue('quran_ayahs', { data: { global_ayah_index: 2 }, error: null })
      queue('quran_ayahs', { data: [], error: null })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).resolves.toEqual([])
    })

    it('throws when the editions query itself errors', async () => {
      queue('quran_riwayat', RIWAYAH_ROW)
      queue('quran_editions', { data: null, error: { message: 'db down' } })
      await expect(
        quranReferenceService.ayahsInRange('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a2' })
      ).rejects.toThrow(/failed to check editions/)
    })
  })
})

describe('countAyat', () => {
  it('counts ayat between the range endpoints inclusive', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null }) // start endpoint lookup
    queue('quran_ayahs', { data: { global_ayah_index: 5 }, error: null }) // end endpoint lookup
    queue('quran_ayahs', { data: null, error: null, count: 5 }) // head-count query

    const count = await quranReferenceService.countAyat('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a5' })
    expect(count).toBe(5)
  })

  it('throws when the start ayah id is not found', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: null, error: { message: 'not found' } })
    queue('quran_ayahs', { data: { global_ayah_index: 5 }, error: null })
    await expect(
      quranReferenceService.countAyat('hafs', { riwayahCode: 'hafs', startAyahId: 'bad', endAyahId: 'a5' })
    ).rejects.toThrow(/not found/)
  })

  it('throws when the end precedes the start', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: { global_ayah_index: 5 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    await expect(
      quranReferenceService.countAyat('hafs', { riwayahCode: 'hafs', startAyahId: 'a5', endAyahId: 'a1' })
    ).rejects.toThrow(/precedes/)
  })

  it('throws when the head-count query errors', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 5 }, error: null })
    queue('quran_ayahs', { data: null, error: { message: 'db down' } })
    await expect(
      quranReferenceService.countAyat('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a5' })
    ).rejects.toThrow(/countAyat failed/)
  })

  it('returns 0 when the count comes back null (defensive fallback)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: { global_ayah_index: 1 }, error: null })
    queue('quran_ayahs', { data: null, error: null, count: undefined })
    const count = await quranReferenceService.countAyat('hafs', { riwayahCode: 'hafs', startAyahId: 'a1', endAyahId: 'a1' })
    expect(count).toBe(0)
  })
})

describe('similarPassagesFor', () => {
  it('returns an empty array when the ayah belongs to no similar-passage group', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_similar_members', { data: [], error: null })

    const result = await quranReferenceService.similarPassagesFor('hafs', { surahNumber: 1, ayahNumber: 1 })
    expect(result).toEqual([])
  })

  it('returns sibling ayat from the same group, excluding itself', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_similar_members', { data: [{ group_id: 'g1' }], error: null }) // membership query
    queue('quran_similar_members', {
      data: [{ quran_ayahs: { ayah_number_in_surah: 4, quran_surahs: { number: 2 } } }],
      error: null,
    }) // siblings query

    const result = await quranReferenceService.similarPassagesFor('hafs', { surahNumber: 1, ayahNumber: 1 })
    expect(result).toEqual([{ surahNumber: 2, ayahNumber: 4 }])
  })

  it('throws when the membership query errors', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_similar_members', { data: null, error: { message: 'db down' } })
    await expect(quranReferenceService.similarPassagesFor('hafs', { surahNumber: 1, ayahNumber: 1 })).rejects.toThrow(
      /similarPassagesFor failed/
    )
  })

  it('throws when the siblings query errors', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_similar_members', { data: [{ group_id: 'g1' }], error: null })
    queue('quran_similar_members', { data: null, error: { message: 'db down' } })
    await expect(quranReferenceService.similarPassagesFor('hafs', { surahNumber: 1, ayahNumber: 1 })).rejects.toThrow(
      /similarPassagesFor failed/
    )
  })

  it('returns an empty array when the siblings query succeeds with no data (defensive null-guard)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queueAyahLookup('surah-1', 'ayah-1', 1)
    queue('quran_similar_members', { data: [{ group_id: 'g1' }], error: null })
    queue('quran_similar_members', { data: null, error: null })
    await expect(quranReferenceService.similarPassagesFor('hafs', { surahNumber: 1, ayahNumber: 1 })).resolves.toEqual([])
  })
})

describe('listSurahs', () => {
  it('returns all surahs for a riwayah, ordered by number', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', {
      data: [
        { number: 1, name_ar: 'الفاتحة', name_en: 'The Opening', name_transliterated: 'Al-Fatihah', revelation_place: 'meccan', ayah_count: 7 },
        { number: 2, name_ar: 'البقرة', name_en: 'The Cow', name_transliterated: 'Al-Baqarah', revelation_place: 'medinan', ayah_count: 286 },
      ],
      error: null,
    })

    const surahs = await quranReferenceService.listSurahs('hafs')
    expect(surahs).toEqual([
      { number: 1, nameAr: 'الفاتحة', nameEn: 'The Opening', nameTransliterated: 'Al-Fatihah', revelationPlace: 'meccan', ayahCount: 7 },
      { number: 2, nameAr: 'البقرة', nameEn: 'The Cow', nameTransliterated: 'Al-Baqarah', revelationPlace: 'medinan', ayahCount: 286 },
    ])
  })

  it('throws when the query errors', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: null, error: { message: 'db down' } })
    await expect(quranReferenceService.listSurahs('hafs')).rejects.toThrow(/listSurahs failed/)
  })

  it('returns an empty array when the query succeeds with no data (defensive null-guard)', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: null, error: null })
    await expect(quranReferenceService.listSurahs('hafs')).resolves.toEqual([])
  })

  it('throws for an unknown riwayah code', async () => {
    queue('quran_riwayat', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.listSurahs('bogus')).rejects.toThrow(/Unknown riwayah/)
  })
})

describe('surahMeta', () => {
  it('returns surah metadata', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: { name_ar: 'الفاتحة', name_en: 'Al-Fatihah', ayah_count: 7 }, error: null })
    const meta = await quranReferenceService.surahMeta('hafs', 1)
    expect(meta).toEqual({ nameAr: 'الفاتحة', nameEn: 'Al-Fatihah', ayahCount: 7 })
  })

  it('throws when the surah is not found', async () => {
    queue('quran_riwayat', RIWAYAH_ROW)
    queue('quran_surahs', { data: null, error: { message: 'not found' } })
    await expect(quranReferenceService.surahMeta('hafs', 999)).rejects.toThrow(/not found/)
  })
})
