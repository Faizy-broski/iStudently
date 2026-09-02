import { supabase } from '../../config/supabase'
import { quranReferenceService, RangeSpec } from '../quran/quran-reference.service'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 1a: maps a school's grade levels
// (1-12) to a ministry-mandated Quran memorization range per academic year.
// Everything downstream (gradebook bridge, syllabus-completion %, parent
// "grade syllabus completed" milestones) measures against this.
//
// A range is resolved to start_ayah_id/end_ayah_id at WRITE time via
// QuranReferenceService — never stored as a raw juz/hizb/thumn number, per
// the platform-wide rule (259_create_quran_reference_tables.sql) that ayah
// IDs are the only unit of measure a Hifzi table may store.
// ============================================================================

export type SyllabusRangeInput =
  | RangeSpec // single unit (surah|juz|hizb|rub|thumn|page|custom) — resolved via resolveRange
  | { unitType: 'juz' | 'hizb' | 'rub' | 'thumn'; startNumber: number; endNumber: number } // a span of divisions — resolved via resolveDivisionRange

export interface UpsertSyllabusTargetDTO {
  gradeLevelId: string
  ministryGradeNumber: number
  academicYearId: string
  riwayahId: string
  range: SyllabusRangeInput
  unitLabel?: string | null
  notes?: string | null
  createdBy?: string | null
}

export interface SyllabusTarget {
  id: string
  schoolId: string
  gradeLevelId: string
  ministryGradeNumber: number
  academicYearId: string
  riwayahId: string
  startAyahId: string
  endAyahId: string
  unitLabel: string | null
  notes: string | null
  isActive: boolean
}

function isDivisionRangeInput(range: SyllabusRangeInput): range is { unitType: 'juz' | 'hizb' | 'rub' | 'thumn'; startNumber: number; endNumber: number } {
  return 'startNumber' in range && 'endNumber' in range
}

function rowToTarget(row: any): SyllabusTarget {
  return {
    id: row.id,
    schoolId: row.school_id,
    gradeLevelId: row.grade_level_id,
    ministryGradeNumber: row.ministry_grade_number,
    academicYearId: row.academic_year_id,
    riwayahId: row.riwayah_id,
    startAyahId: row.start_ayah_id,
    endAyahId: row.end_ayah_id,
    unitLabel: row.unit_label,
    notes: row.notes,
    isActive: row.is_active,
  }
}

class HifziMinistrySyllabusService {
  /** riwayah_id is the UUID the frontend already has from getRiwayat() (same convention circles/plans use) — resolved to its code here since QuranReferenceService's resolve methods key off the code, not the id. */
  private async getRiwayahCode(riwayahId: string): Promise<string> {
    const { data, error } = await supabase.from('quran_riwayat').select('code').eq('id', riwayahId).single()
    if (error || !data) throw new Error(`Unknown riwayah id "${riwayahId}"`)
    return data.code
  }

  /**
   * Creates a new active syllabus target, deactivating (not deleting) any
   * prior active target for the same (school, grade, year) — matching
   * hifzi_enrollments' own active/withdrawn convention: history stays
   * queryable, never destroyed.
   */
  async upsertSyllabusTarget(schoolId: string, dto: UpsertSyllabusTargetDTO): Promise<SyllabusTarget> {
    const riwayahCode = await this.getRiwayahCode(dto.riwayahId)

    const range = isDivisionRangeInput(dto.range)
      ? await quranReferenceService.resolveDivisionRange(riwayahCode, dto.range.unitType, dto.range.startNumber, dto.range.endNumber)
      : await quranReferenceService.resolveRange(riwayahCode, dto.range)

    await supabase
      .from('hifzi_ministry_syllabus')
      .update({ is_active: false })
      .eq('school_id', schoolId)
      .eq('grade_level_id', dto.gradeLevelId)
      .eq('academic_year_id', dto.academicYearId)
      .eq('is_active', true)

    const { data, error } = await supabase
      .from('hifzi_ministry_syllabus')
      .insert({
        school_id: schoolId,
        grade_level_id: dto.gradeLevelId,
        ministry_grade_number: dto.ministryGradeNumber,
        academic_year_id: dto.academicYearId,
        riwayah_id: dto.riwayahId,
        start_ayah_id: range.startAyahId,
        end_ayah_id: range.endAyahId,
        unit_label: dto.unitLabel ?? null,
        notes: dto.notes ?? null,
        created_by: dto.createdBy ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to save syllabus target: ${error.message}`)
    return rowToTarget(data)
  }

  async getSyllabusTarget(schoolId: string, gradeLevelId: string, academicYearId: string): Promise<SyllabusTarget | null> {
    const { data, error } = await supabase
      .from('hifzi_ministry_syllabus')
      .select('*')
      .eq('school_id', schoolId)
      .eq('grade_level_id', gradeLevelId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch syllabus target: ${error.message}`)
    return data ? rowToTarget(data) : null
  }

  async listSyllabusTargets(schoolId: string, academicYearId: string, gradeLevelId?: string): Promise<SyllabusTarget[]> {
    let query = supabase
      .from('hifzi_ministry_syllabus')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('ministry_grade_number', { ascending: true })

    if (gradeLevelId) query = query.eq('grade_level_id', gradeLevelId)

    const { data, error } = await query
    if (error) throw new Error(`Failed to fetch syllabus targets: ${error.message}`)
    return (data || []).map(rowToTarget)
  }
}

export const hifziMinistrySyllabusService = new HifziMinistrySyllabusService()
