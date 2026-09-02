import { supabase } from '../../config/supabase'
import { quranReferenceService } from '../quran/quran-reference.service'
import { hifziNotificationsService } from './notifications.service'
import { hifziMinistrySyllabusService } from './ministry-syllabus.service'
import { decideCompletedUnits, ParentMembership, UnitCompletionCheck, CascadeResult } from './milestone-cascade'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 3: detects when a newly-
// memorized ayah range completes a structural unit (thumn -> hizb -> juz,
// cascading one level at a time) or a student's ministry-mandated syllabus
// range (hifzi_ministry_syllabus, Phase 1), and notifies guardians exactly
// once per milestone — the "exactly once" guarantee is hifzi_milestones_log's
// UNIQUE(student_id, milestone_type, unit_number) constraint (an
// upsert+ignoreDuplicates), not application logic.
//
// Deliberately bounded, never a full-mushaf rescan: only the thumn(s) the
// newly-memorized range itself touches are freshly checked; a sibling unit
// not touched this round is only treated as "already complete" if it was
// previously logged as a milestone — see milestone-cascade.ts's own comment
// for why that's an accepted, documented trade-off.
// ============================================================================

export interface RecordedMilestone {
  id: string
  milestoneType: 'thumn' | 'hizb' | 'juz' | 'syllabus_grade'
  unitNumber: number
}

class HifziMilestonesService {
  /**
   * Called from sessions.service.ts right after a hifzi_unit_states row's
   * first_memorized_at transitions from NULL to set (i.e. `range` was just
   * newly memorized, not merely reviewed) — the caller wraps this in its
   * own try/catch, matching this module's fail-open style for anything that
   * must never undo an already-saved session.
   */
  async checkAndRecordMilestones(studentId: string, schoolId: string, range: { startAyahId: string; endAyahId: string }): Promise<RecordedMilestone[]> {
    const rangeInfo = await this.resolveTouchedThumns(range)
    if (!rangeInfo || rangeInfo.touchedThumns.length === 0) return []
    const { riwayahId, riwayahCode, touchedThumns } = rangeInfo

    // ── Level 1: thumn completion, cascading to hizb ──────────────────
    const thumnCandidates: UnitCompletionCheck[] = await Promise.all(
      touchedThumns.map(async (t) => ({
        unitNumber: t.thumnNumber,
        parentNumber: t.hizbNumber,
        isComplete: await this.isDivisionFullyMemorized(studentId, riwayahCode, 'thumn', t.thumnNumber),
      }))
    )

    const touchedHizbNumbers = [...new Set(thumnCandidates.map((c) => c.parentNumber))]
    const hizbMemberships = await this.fetchSiblingsByParent('hizb_number', touchedHizbNumbers, 'thumn_number')
    const allRelevantThumnNumbers = [...new Set(Object.values(hizbMemberships).flatMap((m) => m.siblingUnitNumbers))]

    const [loggedThumns, loggedHizbs] = await Promise.all([
      this.fetchLoggedUnitNumbers(studentId, 'thumn', allRelevantThumnNumbers),
      this.fetchLoggedUnitNumbers(studentId, 'hizb', touchedHizbNumbers),
    ])
    const completeThumnNumbers = thumnCandidates.filter((c) => c.isComplete).map((c) => c.unitNumber)
    const alreadyCompleteThumns = new Set([...loggedThumns, ...completeThumnNumbers])

    const thumnLevel = decideCompletedUnits(thumnCandidates, hizbMemberships, loggedThumns, alreadyCompleteThumns, loggedHizbs)

    // ── Level 2: for hizbs just completed above, cascade to juz ────────
    let juzLevel: CascadeResult = { newlyCompletedUnits: [], newlyCompletedParents: [] }
    if (thumnLevel.newlyCompletedParents.length > 0) {
      const hizbCandidates: UnitCompletionCheck[] = await Promise.all(
        thumnLevel.newlyCompletedParents.map(async (hizbNumber) => ({
          unitNumber: hizbNumber,
          parentNumber: await this.fetchParentNumber('hizb_number', hizbNumber, 'juz_number'),
          isComplete: true, // already decided complete by the thumn-level cascade above
        }))
      )
      const touchedJuzNumbers = [...new Set(hizbCandidates.map((c) => c.parentNumber))]
      const juzMemberships = await this.fetchSiblingsByParent('juz_number', touchedJuzNumbers, 'hizb_number')
      const allRelevantHizbNumbers = [...new Set(Object.values(juzMemberships).flatMap((m) => m.siblingUnitNumbers))]

      const [loggedHizbsForJuz, loggedJuz] = await Promise.all([
        this.fetchLoggedUnitNumbers(studentId, 'hizb', allRelevantHizbNumbers),
        this.fetchLoggedUnitNumbers(studentId, 'juz', touchedJuzNumbers),
      ])
      const alreadyCompleteHizbs = new Set([...loggedHizbsForJuz, ...thumnLevel.newlyCompletedParents])
      juzLevel = decideCompletedUnits(hizbCandidates, juzMemberships, loggedHizbsForJuz, alreadyCompleteHizbs, loggedJuz)
    }

    // ── Independent: ministry syllabus-grade completion — the assigned
    //    range needn't align to any thumn/hizb/juz boundary at all. ──────
    const syllabusMilestone = await this.checkSyllabusGradeCompletion(studentId, schoolId, riwayahId, riwayahCode)

    const rows: { student_id: string; riwayah_id: string; milestone_type: RecordedMilestone['milestoneType']; unit_number: number }[] = [
      ...thumnLevel.newlyCompletedUnits.map((n) => ({ student_id: studentId, riwayah_id: riwayahId, milestone_type: 'thumn' as const, unit_number: n })),
      ...thumnLevel.newlyCompletedParents.map((n) => ({ student_id: studentId, riwayah_id: riwayahId, milestone_type: 'hizb' as const, unit_number: n })),
      ...juzLevel.newlyCompletedParents.map((n) => ({ student_id: studentId, riwayah_id: riwayahId, milestone_type: 'juz' as const, unit_number: n })),
    ]
    if (syllabusMilestone) {
      rows.push({ student_id: studentId, riwayah_id: riwayahId, milestone_type: 'syllabus_grade', unit_number: syllabusMilestone.ministryGradeNumber })
    }
    if (rows.length === 0) return []

    // ON CONFLICT DO NOTHING via upsert+ignoreDuplicates — the real
    // exactly-once guard (a concurrent session could race past the
    // already-logged checks above); only rows that actually inserted come
    // back, so `recorded` is exactly "what's genuinely new this call".
    const { data: inserted, error } = await supabase
      .from('hifzi_milestones_log')
      .upsert(rows, { onConflict: 'student_id,milestone_type,unit_number', ignoreDuplicates: true })
      .select('id, milestone_type, unit_number')

    if (error) throw new Error(`Failed to record milestones: ${error.message}`)

    const recorded: RecordedMilestone[] = ((inserted as any[]) || []).map((r) => ({ id: r.id, milestoneType: r.milestone_type, unitNumber: r.unit_number }))
    if (recorded.length > 0) await this.notifyGuardians(studentId, schoolId, recorded)
    return recorded
  }

  /** Read-side: every milestone recorded for a student, most recent first — for a progress view (parent/student/teacher/admin), guarded by hifzi-access.ts's assertCanAccessStudent at the controller layer. */
  async listMilestonesForStudent(studentId: string): Promise<RecordedMilestone[]> {
    const { data, error } = await supabase
      .from('hifzi_milestones_log')
      .select('id, milestone_type, unit_number')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch milestones: ${error.message}`)
    return ((data as any[]) || []).map((r) => ({ id: r.id, milestoneType: r.milestone_type, unitNumber: r.unit_number }))
  }

  private async resolveTouchedThumns(range: { startAyahId: string; endAyahId: string }): Promise<{ riwayahId: string; riwayahCode: string; touchedThumns: { thumnNumber: number; hizbNumber: number }[] } | null> {
    const [{ data: start, error: startError }, { data: end, error: endError }] = await Promise.all([
      supabase.from('quran_ayahs').select('riwayah_id, global_ayah_index').eq('id', range.startAyahId).single(),
      supabase.from('quran_ayahs').select('global_ayah_index').eq('id', range.endAyahId).single(),
    ])
    if (startError || !start || endError || !end) return null

    const { data: riwayah, error: riwayahError } = await supabase.from('quran_riwayat').select('code').eq('id', start.riwayah_id).single()
    if (riwayahError || !riwayah) return null

    const { data: ayahs, error } = await supabase
      .from('quran_ayahs')
      .select('thumn_number, hizb_number')
      .eq('riwayah_id', start.riwayah_id)
      .gte('global_ayah_index', start.global_ayah_index)
      .lte('global_ayah_index', end.global_ayah_index)
    if (error || !ayahs) return null

    const byThumn = new Map<number, number>() // thumnNumber -> hizbNumber
    for (const row of ayahs as any[]) byThumn.set(row.thumn_number, row.hizb_number)

    return {
      riwayahId: start.riwayah_id,
      riwayahCode: riwayah.code,
      touchedThumns: [...byThumn.entries()].map(([thumnNumber, hizbNumber]) => ({ thumnNumber, hizbNumber })),
    }
  }

  private async isDivisionFullyMemorized(studentId: string, riwayahCode: string, unitType: 'thumn' | 'hizb' | 'juz', unitNumber: number): Promise<boolean> {
    const divisionRange = await quranReferenceService.resolveRange(riwayahCode, { unitType, number: unitNumber })
    const [expected, actual] = await Promise.all([
      quranReferenceService.countAyat(riwayahCode, divisionRange),
      this.memorizedAyatCount(studentId, divisionRange.startAyahId, divisionRange.endAyahId),
    ])
    return expected > 0 && actual >= expected
  }

  private async memorizedAyatCount(studentId: string, startAyahId: string, endAyahId: string): Promise<number> {
    const { data, error } = await supabase.rpc('hifzi_student_memorized_ayat_count', {
      p_student_id: studentId,
      p_start_ayah_id: startAyahId,
      p_end_ayah_id: endAyahId,
    })
    if (error) throw new Error(`Failed to compute memorized ayah count: ${error.message}`)
    return data ?? 0
  }

  /** Every child unit number belonging to each of `parentNumbers` (e.g. every thumn_number in a given hizb_number) — a small, per-parent-bounded query, never a full-mushaf scan. */
  private async fetchSiblingsByParent(parentColumn: 'hizb_number' | 'juz_number', parentNumbers: number[], childColumn: 'thumn_number' | 'hizb_number'): Promise<Record<number, ParentMembership>> {
    if (parentNumbers.length === 0) return {}
    const { data, error } = await supabase.from('quran_ayahs').select(`${parentColumn}, ${childColumn}`).in(parentColumn, parentNumbers)
    if (error) throw new Error(`Failed to fetch ${childColumn} siblings: ${error.message}`)

    const map: Record<number, ParentMembership> = {}
    for (const row of (data as any[]) || []) {
      const parentNumber = row[parentColumn]
      const childNumber = row[childColumn]
      const entry = map[parentNumber] ?? (map[parentNumber] = { parentNumber, siblingUnitNumbers: [] })
      if (!entry.siblingUnitNumbers.includes(childNumber)) entry.siblingUnitNumbers.push(childNumber)
    }
    return map
  }

  private async fetchParentNumber(childColumn: 'hizb_number', childValue: number, parentColumn: 'juz_number'): Promise<number> {
    const { data, error } = await supabase.from('quran_ayahs').select(parentColumn).eq(childColumn, childValue).limit(1).single()
    if (error || !data) throw new Error(`Failed to resolve ${parentColumn} for ${childColumn}=${childValue}`)
    return (data as any)[parentColumn]
  }

  private async fetchLoggedUnitNumbers(studentId: string, milestoneType: 'thumn' | 'hizb' | 'juz' | 'syllabus_grade', unitNumbers: number[]): Promise<Set<number>> {
    if (unitNumbers.length === 0) return new Set()
    const { data, error } = await supabase
      .from('hifzi_milestones_log')
      .select('unit_number')
      .eq('student_id', studentId)
      .eq('milestone_type', milestoneType)
      .in('unit_number', unitNumbers)
    if (error) throw new Error(`Failed to fetch logged ${milestoneType} milestones: ${error.message}`)
    return new Set(((data as any[]) || []).map((r) => r.unit_number))
  }

  /** Independent of the thumn/hizb/juz cascade — a ministry-assigned range (Phase 1's hifzi_ministry_syllabus) need not align to any division boundary at all. */
  private async checkSyllabusGradeCompletion(studentId: string, schoolId: string, riwayahId: string, riwayahCode: string): Promise<{ ministryGradeNumber: number } | null> {
    const { data: student } = await supabase.from('students').select('grade_level_id').eq('id', studentId).single()
    if (!student?.grade_level_id) return null

    const { data: year } = await supabase.from('academic_years').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
    if (!year) return null

    const target = await hifziMinistrySyllabusService.getSyllabusTarget(schoolId, student.grade_level_id, year.id)
    if (!target || target.riwayahId !== riwayahId) return null

    const alreadyLogged = await this.fetchLoggedUnitNumbers(studentId, 'syllabus_grade', [target.ministryGradeNumber])
    if (alreadyLogged.has(target.ministryGradeNumber)) return null

    const [expected, actual] = await Promise.all([
      quranReferenceService.countAyat(riwayahCode, { riwayahCode, startAyahId: target.startAyahId, endAyahId: target.endAyahId }),
      this.memorizedAyatCount(studentId, target.startAyahId, target.endAyahId),
    ])
    return expected > 0 && actual >= expected ? { ministryGradeNumber: target.ministryGradeNumber } : null
  }

  private async notifyGuardians(studentId: string, schoolId: string, milestones: RecordedMilestone[]): Promise<void> {
    const [{ data: studentRow }, { data: guardianLinks }] = await Promise.all([
      supabase.from('students').select('profile:profiles(first_name, last_name)').eq('id', studentId).single(),
      supabase.from('parent_student_links').select('parent:parents(profile_id)').eq('student_id', studentId).eq('is_active', true),
    ])
    const profile = (studentRow as any)?.profile
    const studentName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'الطالب'

    for (const milestone of milestones) {
      const label = this.milestoneLabel(milestone)
      for (const link of (guardianLinks as any[]) || []) {
        const guardianProfileId = link.parent?.profile_id
        if (!guardianProfileId) continue
        await hifziNotificationsService.notifyMilestone(schoolId, guardianProfileId, studentName, label, milestone.id)
      }
    }
  }

  private milestoneLabel(m: RecordedMilestone): string {
    switch (m.milestoneType) {
      case 'thumn': return `الثُمن رقم ${m.unitNumber}`
      case 'hizb': return `الحزب رقم ${m.unitNumber}`
      case 'juz': return `الجزء رقم ${m.unitNumber}`
      case 'syllabus_grade': return `منهج الصف ${m.unitNumber} المقرر وزارياً`
    }
  }
}

export const hifziMilestonesService = new HifziMilestonesService()
