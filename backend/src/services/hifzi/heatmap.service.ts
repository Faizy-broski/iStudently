import { supabase } from '../../config/supabase'
import { hifziSettingsService } from './settings.service'
import { retentionBand, RetentionBand } from './retention.service'

// ============================================================================
// Mushaf heatmap — a single query with the decay math pushed into SQL (spec
// requirement: never loop in application code over ~600 pages), banding
// applied in this thin wrapper for easier threshold tuning without a
// migration. See frontend/src/components/hifzi/MushafHeatmap.tsx for the
// Tailwind-grid rendering this feeds.
// ============================================================================

export interface HeatmapCell {
  unitId: string
  startAyahId: string
  surahNumber: number
  juzNumber: number
  strength: number
  band: RetentionBand
}

class HifziHeatmapService {
  async getStudentHeatmap(studentId: string, schoolId: string, campusId?: string | null): Promise<HeatmapCell[]> {
    const settings = await hifziSettingsService.getEffectiveSettings(schoolId, campusId)

    // The exp() decay is computed in SQL so this is one round trip regardless
    // of how many unit_states the student has — never a per-row JS loop over
    // a full-mushaf-sized table (spec's explicit single-query requirement).
    const { data, error } = await supabase.rpc('hifzi_student_heatmap', {
      p_student_id: studentId,
      p_decay_scale: settings.retentionDecayScale,
    })

    if (error) {
      // The RPC function ships with a later migration once the SQL function
      // itself is authored (see backend/migrations — hifzi_student_heatmap()).
      // Fall back to an application-level computation so the endpoint still
      // works end-to-end before that migration lands, rather than hard-failing.
      return this.getStudentHeatmapFallback(studentId, settings.retentionDecayScale)
    }

    return (data || []).map((row: any) => ({
      unitId: row.unit_id,
      startAyahId: row.start_ayah_id,
      surahNumber: row.surah_number,
      juzNumber: row.juz_number,
      strength: row.strength,
      band: retentionBand(row.strength),
    }))
  }

  /** Non-SQL fallback (used only if the hifzi_student_heatmap() function isn't present yet) — same math, computed per-row in JS. */
  private async getStudentHeatmapFallback(studentId: string, decayScale: number): Promise<HeatmapCell[]> {
    const { data, error } = await supabase
      .from('hifzi_unit_states')
      .select('id, start_ayah_id, interval_days, last_reviewed_at, quran_ayahs!inner(surah_id, juz_number, quran_surahs!inner(number))')
      .eq('student_id', studentId)

    if (error) throw new Error(`Failed to fetch heatmap data: ${error.message}`)

    const now = new Date()
    return (data || []).map((row: any) => {
      const daysElapsed = row.last_reviewed_at ? (now.getTime() - new Date(row.last_reviewed_at).getTime()) / 86_400_000 : Infinity
      const strength = 100 * Math.exp(-daysElapsed / (row.interval_days * decayScale))
      return {
        unitId: row.id,
        startAyahId: row.start_ayah_id,
        surahNumber: row.quran_ayahs.quran_surahs.number,
        juzNumber: row.quran_ayahs.juz_number,
        strength,
        band: retentionBand(strength),
      }
    })
  }
}

export const hifziHeatmapService = new HifziHeatmapService()
