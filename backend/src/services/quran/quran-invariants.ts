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

/** Every ayah must have exactly one juz/hizb/rub/thumn assignment and each must sit within its valid numeric range (spec §5.5). */
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
    if (a.thumnNumber == null || a.thumnNumber < 1 || a.thumnNumber > 480) {
      return { ok: false, message: `Ayah index ${a.globalAyahIndex}: invalid or missing thumn_number (${a.thumnNumber})` }
    }
  }
  return { ok: true }
}

/**
 * DB-facing wrapper: runs every invariant check against a seeded riwayah/edition,
 * called at the end of the seed script (backend/scripts/seed-quran-reference.ts)
 * and separately exercisable in CI against a real seeded database.
 * Throws on the first violation found.
 */
export async function runAllInvariantChecks(riwayahId: string, editionId?: string): Promise<void> {
  const { data: ayahRows, error: ayahError } = await supabase
    .from('quran_ayahs')
    .select('global_ayah_index, juz_number, hizb_number, rub_number, thumn_number, surah_id')
    .eq('riwayah_id', riwayahId)

  if (ayahError || !ayahRows) throw new Error(`runAllInvariantChecks: failed to fetch ayat — ${ayahError?.message}`)

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
    const { data: pageRows, error: pageError } = await supabase
      .from('quran_edition_ayah_pages')
      .select('page_number, quran_ayahs!inner(global_ayah_index)')
      .eq('edition_id', editionId)

    if (pageError || !pageRows) throw new Error(`runAllInvariantChecks: failed to fetch page mappings — ${pageError?.message}`)

    const pageCheck = checkPageMonotonicity(
      (pageRows as any[]).map((r) => ({ globalAyahIndex: r.quran_ayahs.global_ayah_index, pageNumber: r.page_number }))
    )
    if (!pageCheck.ok) throw new Error(`Invariant violation (page monotonicity): ${pageCheck.message}`)
  }
}
