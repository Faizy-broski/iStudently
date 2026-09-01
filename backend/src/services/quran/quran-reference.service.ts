import { supabase } from '../../config/supabase'

// ============================================================================
// QURAN REFERENCE ENGINE
//
// Tenant-agnostic, read-only service over the quran_* reference tables
// (259_create_quran_reference_tables.sql / 260_create_quran_edition_pages_similar.sql).
//
// This is the ONLY module allowed to translate between a page number and an
// ayah range. Every Hifzi tenant table stores ayah-range FKs; nothing else in
// the codebase may hardcode a page number, juz count, or surah length against
// an ayah — those are always resolved through this service, at read time.
// ============================================================================

export interface AyahRef {
  surahNumber: number
  ayahNumber: number
}

export interface AyahRange {
  riwayahCode: string
  startAyahId: string
  endAyahId: string
}

export interface AyahWithText {
  id: string
  surahNumber: number
  ayahNumber: number
  textUthmani: string
  sajda: boolean
}

export type QuranUnitType = 'surah' | 'juz' | 'hizb' | 'rub' | 'thumn' | 'page' | 'custom'

export interface RangeSpec {
  unitType: QuranUnitType
  number?: number // required for surah|juz|hizb|rub|thumn|page
  editionCode?: string // required for page (page mapping is edition-specific)
  startAyah?: AyahRef // required for custom
  endAyah?: AyahRef // required for custom
}

interface AyahRow {
  id: string
  surah_id: string
  ayah_number_in_surah: number
  global_ayah_index: number
}

const DIVISION_COLUMN: Partial<Record<QuranUnitType, string>> = {
  juz: 'juz_number',
  hizb: 'hizb_number',
  rub: 'rub_number',
  thumn: 'thumn_number',
}

class QuranReferenceService {
  private async getRiwayahIdByCode(riwayahCode: string): Promise<string> {
    const { data, error } = await supabase
      .from('quran_riwayat')
      .select('id')
      .eq('code', riwayahCode)
      .single()

    if (error || !data) throw new Error(`Unknown riwayah code "${riwayahCode}"`)
    return data.id
  }

  private async getEdition(editionCode: string): Promise<{ id: string; riwayah_id: string; verified_at: string | null }> {
    const { data, error } = await supabase
      .from('quran_editions')
      .select('id, riwayah_id, verified_at')
      .eq('code', editionCode)
      .single()

    if (error || !data) throw new Error(`Unknown edition code "${editionCode}"`)

    if (!data.verified_at && process.env.HIFZI_ALLOW_UNVERIFIED_QURAN_DATA !== 'true') {
      throw new Error(
        `Edition "${editionCode}" has not been signed off by a religious authority (verified_at is NULL). ` +
        `Set HIFZI_ALLOW_UNVERIFIED_QURAN_DATA=true in development to bypass this gate.`
      )
    }

    return data
  }

  private async getAyahBySurahAyah(riwayahId: string, ayah: AyahRef): Promise<AyahRow> {
    const { data: surah, error: surahError } = await supabase
      .from('quran_surahs')
      .select('id')
      .eq('riwayah_id', riwayahId)
      .eq('number', ayah.surahNumber)
      .single()

    if (surahError || !surah) throw new Error(`Surah ${ayah.surahNumber} not found for this riwayah`)

    const { data: ayahRow, error: ayahError } = await supabase
      .from('quran_ayahs')
      .select('id, surah_id, ayah_number_in_surah, global_ayah_index')
      .eq('surah_id', surah.id)
      .eq('ayah_number_in_surah', ayah.ayahNumber)
      .single()

    if (ayahError || !ayahRow) {
      throw new Error(`Ayah ${ayah.surahNumber}:${ayah.ayahNumber} not found for this riwayah`)
    }
    return ayahRow as AyahRow
  }

  /**
   * Resolve any unit reference (surah, juz, hizb, rub, thumn, page, or an
   * explicit custom ayah-to-ayah span) into a canonical ayah range.
   */
  async resolveRange(riwayahCode: string, spec: RangeSpec): Promise<AyahRange> {
    const riwayahId = await this.getRiwayahIdByCode(riwayahCode)

    if (spec.unitType === 'custom') {
      if (!spec.startAyah || !spec.endAyah) {
        throw new Error('resolveRange: unitType "custom" requires startAyah and endAyah')
      }
      const [start, end] = await Promise.all([
        this.getAyahBySurahAyah(riwayahId, spec.startAyah),
        this.getAyahBySurahAyah(riwayahId, spec.endAyah),
      ])
      if (end.global_ayah_index < start.global_ayah_index) {
        throw new Error('resolveRange: endAyah precedes startAyah')
      }
      return { riwayahCode, startAyahId: start.id, endAyahId: end.id }
    }

    if (spec.unitType === 'surah') {
      if (!spec.number) throw new Error('resolveRange: unitType "surah" requires number')
      const { data: surah, error: surahError } = await supabase
        .from('quran_surahs')
        .select('id')
        .eq('riwayah_id', riwayahId)
        .eq('number', spec.number)
        .single()
      if (surahError || !surah) throw new Error(`Surah ${spec.number} not found for this riwayah`)

      const { data: ayahs, error } = await supabase
        .from('quran_ayahs')
        .select('id, global_ayah_index')
        .eq('surah_id', surah.id)
        .order('global_ayah_index', { ascending: true })
      if (error || !ayahs || ayahs.length === 0) throw new Error(`No ayat found for surah ${spec.number}`)

      return { riwayahCode, startAyahId: ayahs[0].id, endAyahId: ayahs[ayahs.length - 1].id }
    }

    if (spec.unitType === 'page') {
      if (!spec.editionCode || !spec.number) {
        throw new Error('resolveRange: unitType "page" requires editionCode and number')
      }
      const refs = await this.ayatOnPage(spec.editionCode, spec.number)
      if (refs.length === 0) throw new Error(`No ayat found on page ${spec.number} of edition "${spec.editionCode}"`)

      const [start, end] = await Promise.all([
        this.getAyahBySurahAyah(riwayahId, refs[0]),
        this.getAyahBySurahAyah(riwayahId, refs[refs.length - 1]),
      ])
      return { riwayahCode, startAyahId: start.id, endAyahId: end.id }
    }

    // juz | hizb | rub | thumn — traditional equal divisions, riwayah-level (not edition-specific)
    const column = DIVISION_COLUMN[spec.unitType]
    if (!column) throw new Error(`resolveRange: unsupported unitType "${spec.unitType}"`)
    if (!spec.number) throw new Error(`resolveRange: unitType "${spec.unitType}" requires number`)

    const { data: ayahs, error } = await supabase
      .from('quran_ayahs')
      .select('id, global_ayah_index')
      .eq('riwayah_id', riwayahId)
      .eq(column, spec.number)
      .order('global_ayah_index', { ascending: true })

    if (error || !ayahs || ayahs.length === 0) {
      throw new Error(`No ayat found for ${spec.unitType} ${spec.number} in riwayah "${riwayahCode}"`)
    }

    return { riwayahCode, startAyahId: ayahs[0].id, endAyahId: ayahs[ayahs.length - 1].id }
  }

  /** All ayat that appear on a given page of a given edition, in Quran order. */
  async ayatOnPage(editionCode: string, pageNumber: number): Promise<AyahRef[]> {
    const edition = await this.getEdition(editionCode)

    const { data, error } = await supabase
      .from('quran_edition_ayah_pages')
      .select('ayah_id, quran_ayahs!inner(ayah_number_in_surah, global_ayah_index, surah_id, quran_surahs!inner(number))')
      .eq('edition_id', edition.id)
      .eq('page_number', pageNumber)

    if (error) throw new Error(`Failed to fetch page ${pageNumber} of edition "${editionCode}": ${error.message}`)
    if (!data) return []

    return (data as any[])
      .map((row) => ({
        surahNumber: row.quran_ayahs.quran_surahs.number as number,
        ayahNumber: row.quran_ayahs.ayah_number_in_surah as number,
        _sort: row.quran_ayahs.global_ayah_index as number,
      }))
      .sort((a, b) => a._sort - b._sort)
      .map(({ surahNumber, ayahNumber }) => ({ surahNumber, ayahNumber }))
  }

  /** The page number a given ayah appears on, for a given edition. */
  async pageOfAyah(editionCode: string, ayah: AyahRef): Promise<number> {
    const edition = await this.getEdition(editionCode)
    const ayahRow = await this.getAyahBySurahAyah(edition.riwayah_id, ayah)

    const { data, error } = await supabase
      .from('quran_edition_ayah_pages')
      .select('page_number')
      .eq('edition_id', edition.id)
      .eq('ayah_id', ayahRow.id)
      .single()

    if (error || !data) throw new Error(`No page mapping found for ${ayah.surahNumber}:${ayah.ayahNumber} in edition "${editionCode}"`)
    return data.page_number
  }

  /**
   * Every ayah's Uthmani-script text between a range's endpoints (inclusive),
   * in Quran order. This is what the recitation screen renders word-by-word
   * (spec §8.5) — it's the one method here that returns actual Quranic
   * text rather than just IDs/positions, since every render surface needs it.
   */
  async ayahsInRange(riwayahCode: string, range: AyahRange): Promise<AyahWithText[]> {
    const riwayahId = await this.getRiwayahIdByCode(riwayahCode)

    const [{ data: start, error: startError }, { data: end, error: endError }] = await Promise.all([
      supabase.from('quran_ayahs').select('global_ayah_index').eq('id', range.startAyahId).single(),
      supabase.from('quran_ayahs').select('global_ayah_index').eq('id', range.endAyahId).single(),
    ])

    if (startError || !start || endError || !end) throw new Error('ayahsInRange: startAyahId/endAyahId not found')
    if (end.global_ayah_index < start.global_ayah_index) throw new Error('ayahsInRange: range end precedes range start')

    const { data, error } = await supabase
      .from('quran_ayahs')
      .select('id, ayah_number_in_surah, text_uthmani, sajda, global_ayah_index, quran_surahs!inner(number)')
      .eq('riwayah_id', riwayahId)
      .gte('global_ayah_index', start.global_ayah_index)
      .lte('global_ayah_index', end.global_ayah_index)
      .order('global_ayah_index', { ascending: true })

    if (error) throw new Error(`ayahsInRange failed: ${error.message}`)

    return ((data as any[]) || []).map((row) => ({
      id: row.id,
      surahNumber: row.quran_surahs.number,
      ayahNumber: row.ayah_number_in_surah,
      textUthmani: row.text_uthmani,
      sajda: row.sajda,
    }))
  }

  /** Canonical size of a range, measured in ayat (the internal unit of measure — never pages/thumns directly). */
  async countAyat(riwayahCode: string, range: AyahRange): Promise<number> {
    const riwayahId = await this.getRiwayahIdByCode(riwayahCode)

    const [{ data: start, error: startError }, { data: end, error: endError }] = await Promise.all([
      supabase.from('quran_ayahs').select('global_ayah_index').eq('id', range.startAyahId).single(),
      supabase.from('quran_ayahs').select('global_ayah_index').eq('id', range.endAyahId).single(),
    ])

    if (startError || !start || endError || !end) throw new Error('countAyat: startAyahId/endAyahId not found')
    if (end.global_ayah_index < start.global_ayah_index) throw new Error('countAyat: range end precedes range start')

    // Sanity-check both ayat belong to the requested riwayah (a range must not span riwayat).
    const { count, error: countError } = await supabase
      .from('quran_ayahs')
      .select('id', { count: 'exact', head: true })
      .eq('riwayah_id', riwayahId)
      .gte('global_ayah_index', start.global_ayah_index)
      .lte('global_ayah_index', end.global_ayah_index)

    if (countError) throw new Error(`countAyat failed: ${countError.message}`)
    return count ?? 0
  }

  /** Ayat from the curated similar-passages (Mutashabihat) dataset that are near-identical to the given ayah. */
  async similarPassagesFor(riwayahCode: string, ayah: AyahRef): Promise<AyahRef[]> {
    const riwayahId = await this.getRiwayahIdByCode(riwayahCode)
    const ayahRow = await this.getAyahBySurahAyah(riwayahId, ayah)

    const { data: memberships, error: membershipError } = await supabase
      .from('quran_similar_members')
      .select('group_id')
      .eq('ayah_id', ayahRow.id)

    if (membershipError) throw new Error(`similarPassagesFor failed: ${membershipError.message}`)
    if (!memberships || memberships.length === 0) return []

    const groupIds = memberships.map((m) => m.group_id)

    const { data: siblings, error: siblingsError } = await supabase
      .from('quran_similar_members')
      .select('quran_ayahs!inner(ayah_number_in_surah, quran_surahs!inner(number))')
      .in('group_id', groupIds)
      .neq('ayah_id', ayahRow.id)

    if (siblingsError) throw new Error(`similarPassagesFor failed: ${siblingsError.message}`)

    return ((siblings as any[]) || []).map((row) => ({
      surahNumber: row.quran_ayahs.quran_surahs.number as number,
      ayahNumber: row.quran_ayahs.ayah_number_in_surah as number,
    }))
  }

  async surahMeta(riwayahCode: string, surahNumber: number): Promise<{ nameAr: string; nameEn: string; ayahCount: number }> {
    const riwayahId = await this.getRiwayahIdByCode(riwayahCode)

    const { data, error } = await supabase
      .from('quran_surahs')
      .select('name_ar, name_en, ayah_count')
      .eq('riwayah_id', riwayahId)
      .eq('number', surahNumber)
      .single()

    if (error || !data) throw new Error(`Surah ${surahNumber} not found for this riwayah`)
    return { nameAr: data.name_ar, nameEn: data.name_en, ayahCount: data.ayah_count }
  }
}

export const quranReferenceService = new QuranReferenceService()
