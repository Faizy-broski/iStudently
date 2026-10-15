// Quran reference engine (read-only, not tenant-scoped). Same endpoints as
// frontend/src/lib/api/quran.ts; router: quran/reference.routes.ts. Used by every Hifzi screen.
import type { ApiClient } from '../client'
import { qs } from '../query'

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

export interface QuranSurah {
  number: number
  nameAr: string
  nameEn: string
  nameTransliterated: string
  revelationPlace: string
  ayahCount: number
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

export function quranApi(api: ApiClient) {
  return {
    riwayat: () => api.get<QuranRiwayah[]>('/quran/riwayat'),
    surahs: (riwayahCode = 'hafs') => api.get<QuranSurah[]>(`/quran/surahs${qs({ riwayah: riwayahCode })}`),
    editions: (riwayahCode?: string) => api.get<QuranEdition[]>(`/quran/editions${qs({ riwayah: riwayahCode })}`),
    resolveRange: (p: { riwayah: string; unitType: QuranUnitType; number?: number; editionCode?: string; startSurah?: number; startAyah?: number; endSurah?: number; endAyah?: number }) =>
      api.get<AyahRange>(`/quran/resolve-range${qs(p)}`),
    ayahsInRange: (riwayahCode: string, startAyahId: string, endAyahId: string) =>
      api.get<AyahWithText[]>(`/quran/ayahs-in-range${qs({ riwayah: riwayahCode, start: startAyahId, end: endAyahId })}`),
  }
}
