import { apiRequest } from './index'

// ============================================================================
// Quran Reference Engine — tenant-agnostic, read-only. Mirrors
// backend/src/services/quran/quran-reference.service.ts's shape.
// ============================================================================

export interface QuranRiwayah {
  id: string
  code: string
  name_ar: string
  name_en: string
}

export interface QuranEdition {
  id: string
  code: string
  name_ar: string
  name_en: string
  verified_at: string | null
  quran_riwayat?: { code: string }
}

export interface AyahRange {
  riwayahCode: string
  startAyahId: string
  endAyahId: string
}

export type QuranUnitType = 'surah' | 'juz' | 'hizb' | 'rub' | 'thumn' | 'page' | 'custom'

export async function getRiwayat() {
  return apiRequest<QuranRiwayah[]>('/quran/riwayat')
}

export interface QuranSurah {
  number: number
  nameAr: string
  nameEn: string
  nameTransliterated: string
  revelationPlace: string
  ayahCount: number
}

export async function getSurahs(riwayahCode = 'hafs') {
  return apiRequest<QuranSurah[]>(`/quran/surahs?riwayah=${riwayahCode}`)
}

export async function getEditions(riwayahCode?: string) {
  const qs = riwayahCode ? `?riwayah=${riwayahCode}` : ''
  return apiRequest<QuranEdition[]>(`/quran/editions${qs}`)
}

export async function resolveRange(params: {
  riwayah: string
  unitType: QuranUnitType
  number?: number
  editionCode?: string
  startSurah?: number
  startAyah?: number
  endSurah?: number
  endAyah?: number
}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v))
  })
  return apiRequest<AyahRange>(`/quran/resolve-range?${qs.toString()}`)
}

export async function getAyatOnPage(editionCode: string, page: number) {
  return apiRequest<{ surahNumber: number; ayahNumber: number }[]>(`/quran/page/${editionCode}/${page}/ayat`)
}

export interface AyahWithText {
  id: string
  surahNumber: number
  ayahNumber: number
  textUthmani: string
  sajda: boolean
}

export async function getAyahsInRange(riwayahCode: string, startAyahId: string, endAyahId: string) {
  const qs = new URLSearchParams({ riwayah: riwayahCode, start: startAyahId, end: endAyahId })
  return apiRequest<AyahWithText[]>(`/quran/ayahs-in-range?${qs.toString()}`)
}
