import { supabase } from '../../config/supabase'

// ============================================================================
// QURAN REFERENCE ENGINE — invariant checks
//
// Pure functions (no DB access) so they're fully unit-testable against fixed
// fixture arrays — see quran-reference.test.ts. `runAllInvariantChecks` below
// is the DB-facing wrapper the seed script calls; it fails the seed run on
// any violation (spec §5.5).
// ============================================================================

export interface InvariantResult {
  ok: boolean
  message?: string
}

/** Every ayah's global_ayah_index must be strictly increasing with no gaps, starting at 1. */
export function checkAyahIndexContiguity(ayahs: { globalAyahIndex: number }[]): InvariantResult {
  if (ayahs.length === 0) return { ok: false, message: 'No ayat provided' }

  const sorted = [...ayahs].sort((a, b) => a.globalAyahIndex - b.globalAyahIndex)
  if (sorted[0].globalAyahIndex !== 1) {
    return { ok: false, message: `Ayah index sequence must start at 1, found ${sorted[0].globalAyahIndex}` }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].globalAyahIndex !== sorted[i - 1].globalAyahIndex + 1) {
      return {
        ok: false,
        message: `Gap or duplicate in ayah index sequence between ${sorted[i - 1].globalAyahIndex} and ${sorted[i].globalAyahIndex}`,
      }
    }
  }
  return { ok: true }
}

/** Within an edition, page_number must be non-decreasing when ayat are ordered by global_ayah_index. */
export function checkPageMonotonicity(pages: { globalAyahIndex: number; pageNumber: number }[]): InvariantResult {
  if (pages.length === 0) return { ok: false, message: 'No page mappings provided' }

  const sorted = [...pages].sort((a, b) => a.globalAyahIndex - b.globalAyahIndex)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].pageNumber < sorted[i - 1].pageNumber) {
      return {
        ok: false,
        message: `Page number decreases between ayah index ${sorted[i - 1].globalAyahIndex} (page ${sorted[i - 1].pageNumber}) and ${sorted[i].globalAyahIndex} (page ${sorted[i].pageNumber})`,
      }
    }
  }
  return { ok: true }
}

/** Each surah's declared ayah_count must equal the number of ayah rows actually seeded for it. */
export function checkSurahAyahCounts(surahs: { surahNumber: number; declaredCount: number; actualCount: number }[]): InvariantResult {
  for (const s of surahs) {
    if (s.declaredCount !== s.actualCount) {
      return {
        ok: false,
        message: `Surah ${s.surahNumber}: declared ayah_count=${s.declaredCount} but ${s.actualCount} ayah rows were seeded`,
      }
    }
  }
  return { ok: true }
}

/**
 * Every ayah must have exactly one juz/hizb/rub assignment, each within its
 * valid numeric range (spec §5.5). thumn_number is the exception: it is NOT
 * a universal Mushaf division (only certain riwayat — e.g. Qalun — mark
 * eighths of a hizb; the standard Hafs Mushaf does not), so it's legitimately
 * NULL for riwayat that don't use it — see migration 287. Only its range is
 * validated, and only when present.
 */
export function checkDivisionAssignments(
  ayahs: { globalAyahIndex: number; juzNumber: number | null; hizbNumber: number | null; rubNumber: number | null; thumnNumber: number | null }[]
): InvariantResult {
  for (const a of ayahs) {
    if (a.juzNumber == null || a.juzNumber < 1 || a.juzNumber > 30) {
      return { ok: false, message: `Ayah index ${a.globalAyahIndex}: invalid or missing juz_number (${a.juzNumber})` }
    }
    if (a.hizbNumber == null || a.hizbNumber < 1 || a.hizbNumber > 60) {
      return { ok: false, message: `Ayah index ${a.globalAyahIndex}: invalid or missing hizb_number (${a.hizbNumber})` }
    }
    if (a.rubNumber == null || a.rubNumber < 1 || a.rubNumber > 240) {
      return { ok: false, message: `Ayah index ${a.globalAyahIndex}: invalid or missing rub_number (${a.rubNumber})` }
    }
    if (a.thumnNumber != null && (a.thumnNumber < 1 || a.thumnNumber > 480)) {
      return { ok: false, message: `Ayah index ${a.globalAyahIndex}: thumn_number out of range (${a.thumnNumber})` }
    }
  }
  return { ok: true }
}

// PostgREST (Supabase's query layer) caps a single .select() response at
// 1000 rows by default — silently, with no error, no matter how many rows
// actually match. quran_ayahs has 6236 rows (a real Hafs corpus), well past
// that cap, so an unpaginated .select() here only ever sees an arbitrary,
// unordered ~1000-row slice — exactly the shape of bug that stays hidden
// against the old 10-row placeholder fixture and only surfaces the first
// time a real, full-size dataset runs through this function. Every query
// here that can plausibly exceed 1000 rows must page through with .range().
const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  runPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await runPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

/**
 * DB-facing wrapper: runs every invariant check against a seeded riwayah/edition,
 * called at the end of the seed script (backend/scripts/seed-quran-reference.ts)
 * and separately exercisable in CI against a real seeded database.
 * Throws on the first violation found.
 */
export async function runAllInvariantChecks(riwayahId: string, editionId?: string): Promise<void> {
  let ayahRows: { global_ayah_index: number; juz_number: number | null; hizb_number: number | null; rub_number: number | null; thumn_number: number | null; surah_id: string }[]
  try {
    ayahRows = await fetchAllRows((from, to) =>
      supabase
        .from('quran_ayahs')
        .select('global_ayah_index, juz_number, hizb_number, rub_number, thumn_number, surah_id')
        .eq('riwayah_id', riwayahId)
        .range(from, to)
    )
  } catch (e: any) {
    throw new Error(`runAllInvariantChecks: failed to fetch ayat — ${e.message}`)
  }

  const ayahs = ayahRows.map((r) => ({
    globalAyahIndex: r.global_ayah_index,
    juzNumber: r.juz_number,
    hizbNumber: r.hizb_number,
    rubNumber: r.rub_number,
    thumnNumber: r.thumn_number,
  }))

  const contiguity = checkAyahIndexContiguity(ayahs)
  if (!contiguity.ok) throw new Error(`Invariant violation (ayah index contiguity): ${contiguity.message}`)

  const divisions = checkDivisionAssignments(ayahs)
  if (!divisions.ok) throw new Error(`Invariant violation (division assignments): ${divisions.message}`)

  const { data: surahRows, error: surahError } = await supabase
    .from('quran_surahs')
    .select('id, number, ayah_count')
    .eq('riwayah_id', riwayahId)

  if (surahError || !surahRows) throw new Error(`runAllInvariantChecks: failed to fetch surahs — ${surahError?.message}`)

  const actualCounts = new Map<string, number>()
  for (const row of ayahRows) {
    actualCounts.set(row.surah_id, (actualCounts.get(row.surah_id) ?? 0) + 1)
  }

  const surahCheck = checkSurahAyahCounts(
    surahRows.map((s) => ({
      surahNumber: s.number,
      declaredCount: s.ayah_count,
      actualCount: actualCounts.get(s.id) ?? 0,
    }))
  )
  if (!surahCheck.ok) throw new Error(`Invariant violation (surah ayah counts): ${surahCheck.message}`)

  if (editionId) {
    let pageRows: { page_number: number; quran_ayahs: { global_ayah_index: number } }[]
    try {
      pageRows = await fetchAllRows((from, to) =>
        supabase
          .from('quran_edition_ayah_pages')
          .select('page_number, quran_ayahs!inner(global_ayah_index)')
          .eq('edition_id', editionId)
          .range(from, to)
      ) as any
    } catch (e: any) {
      throw new Error(`runAllInvariantChecks: failed to fetch page mappings — ${e.message}`)
    }

    const pageCheck = checkPageMonotonicity(
      pageRows.map((r) => ({ globalAyahIndex: r.quran_ayahs.global_ayah_index, pageNumber: r.page_number }))
    )
    if (!pageCheck.ok) throw new Error(`Invariant violation (page monotonicity): ${pageCheck.message}`)
  }
}
