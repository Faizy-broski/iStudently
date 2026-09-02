import { supabase } from '../../config/supabase'
import { quranReferenceService } from '../quran/quran-reference.service'
import { hifziMinistrySyllabusService } from './ministry-syllabus.service'
import { validateCampusAccess } from '../../utils/campus-validation'
import { listAssignedSchoolIds } from '../../utils/inspector-access'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 3: syllabus-completion %
// per circle (single-school admin view) or per school (cross-school
// inspector view), following inspection-analytics.service.ts's established
// pattern exactly — "a few bounded queries aggregated in JS", not a
// monolithic SQL rollup, with role authorization living in these two public
// entry points rather than Express middleware (same split that module uses).
// ============================================================================

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

export interface CompletionRow {
  label: string
  completionPercent: number // 0-100, averaged across the row's tracked students
  studentCount: number
}

export interface ComplianceDashboardStats {
  studentsTracked: number
  avgCompletionPercent: number | null
  heatmap: CompletionRow[]
}

interface StudentCompletion {
  studentId: string
  circleId: string
  circleName: string
  schoolId: string
  schoolName: string
  percent: number
}

class HifziComplianceDashboardService {
  /**
   * Per-student completion % against their grade's active
   * hifzi_ministry_syllabus target, for every actively-enrolled Hifzi
   * student in `schoolId`. Bounded concurrency (batches of 10, this
   * session's established convention) — one RPC call per student, never a
   * full-mushaf scan. Students whose grade has no configured syllabus
   * target are silently excluded (nothing to measure against), not errored.
   */
  private async computeStudentCompletions(schoolId: string, academicYearId: string): Promise<StudentCompletion[]> {
    const targets = await hifziMinistrySyllabusService.listSyllabusTargets(schoolId, academicYearId)
    if (targets.length === 0) return []

    const riwayahCodeById = await this.fetchRiwayahCodes([...new Set(targets.map((t) => t.riwayahId))])

    // Expected (denominator) ayah count per grade — invariant per target, computed once, not per student.
    const expectedByGrade = new Map<string, number>()
    for (const t of targets) {
      const code = riwayahCodeById.get(t.riwayahId)
      if (!code) continue
      const count = await quranReferenceService.countAyat(code, { riwayahCode: code, startAyahId: t.startAyahId, endAyahId: t.endAyahId })
      if (count > 0) expectedByGrade.set(t.gradeLevelId, count)
    }
    const targetByGrade = new Map(targets.map((t) => [t.gradeLevelId, t]))

    const { data: enrollments, error } = await supabase
      .from('hifzi_enrollments')
      .select('student_id, circle_id, hifzi_circles!inner(school_id, name_ar, schools(name)), students!inner(grade_level_id)')
      .eq('status', 'active')
      .eq('hifzi_circles.school_id', schoolId)
    if (error) throw new Error(`Failed to fetch enrollments: ${error.message}`)

    const rows = (enrollments || []) as any[]
    const results: StudentCompletion[] = []

    const CONCURRENCY = 10
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY)
      await Promise.all(
        batch.map(async (row) => {
          const gradeLevelId = row.students?.grade_level_id
          const target = gradeLevelId ? targetByGrade.get(gradeLevelId) : undefined
          const expected = gradeLevelId ? expectedByGrade.get(gradeLevelId) : undefined
          if (!target || !expected) return

          const actual = await this.memorizedAyatCount(row.student_id, target.startAyahId, target.endAyahId)
          results.push({
            studentId: row.student_id,
            circleId: row.circle_id,
            circleName: row.hifzi_circles?.name_ar ?? row.circle_id,
            schoolId: row.hifzi_circles?.school_id ?? schoolId,
            schoolName: row.hifzi_circles?.schools?.name ?? row.hifzi_circles?.school_id ?? schoolId,
            percent: Math.min(100, Math.round((actual / expected) * 10000) / 100),
          })
        })
      )
    }
    return results
  }

  private async fetchRiwayahCodes(riwayahIds: string[]): Promise<Map<string, string>> {
    if (riwayahIds.length === 0) return new Map()
    const { data, error } = await supabase.from('quran_riwayat').select('id, code').in('id', riwayahIds)
    if (error) throw new Error(`Failed to fetch riwayat: ${error.message}`)
    return new Map(((data as any[]) || []).map((r) => [r.id, r.code]))
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

  private rollUp(completions: StudentCompletion[], keyFn: (c: StudentCompletion) => string, labelFn: (c: StudentCompletion) => string): ComplianceDashboardStats {
    if (completions.length === 0) return { studentsTracked: 0, avgCompletionPercent: null, heatmap: [] }

    const totals = new Map<string, { label: string; sum: number; count: number }>()
    for (const c of completions) {
      const key = keyFn(c)
      const entry = totals.get(key) ?? { label: labelFn(c), sum: 0, count: 0 }
      entry.sum += c.percent
      entry.count += 1
      totals.set(key, entry)
    }

    const heatmap: CompletionRow[] = [...totals.values()]
      .map((t) => ({ label: t.label, completionPercent: Math.round((t.sum / t.count) * 100) / 100, studentCount: t.count }))
      .sort((a, b) => a.label.localeCompare(b.label))

    const avgCompletionPercent = Math.round((completions.reduce((s, c) => s + c.percent, 0) / completions.length) * 100) / 100
    return { studentsTracked: completions.length, avgCompletionPercent, heatmap }
  }

  /** Single-school view (admin) — heatmap rows are circles. */
  async getSchoolComplianceDashboard(caller: CallerContext, schoolId: string, academicYearId: string): Promise<ComplianceDashboardStats> {
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      throw new Error('Access denied: admin access required')
    }
    if (caller.role === 'admin') {
      const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
      if (!hasAccess) throw new Error('Access denied: different campus')
    }
    const completions = await this.computeStudentCompletions(schoolId, academicYearId)
    return this.rollUp(completions, (c) => c.circleId, (c) => c.circleName)
  }

  /** Cross-school view (ministry inspector) — heatmap rows are schools, across every campus this inspector is assigned to for the hifzi_compliance program. */
  async getInspectorComplianceDashboard(caller: CallerContext, academicYearId: string): Promise<ComplianceDashboardStats> {
    if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
      throw new Error('Access denied: inspector access required')
    }
    const schoolIds = await listAssignedSchoolIds(caller.profileId, 'hifzi_compliance')
    if (schoolIds.length === 0) return { studentsTracked: 0, avgCompletionPercent: null, heatmap: [] }

    const perSchool = await Promise.all(schoolIds.map((schoolId) => this.computeStudentCompletions(schoolId, academicYearId)))
    const completions = perSchool.flat()
    return this.rollUp(completions, (c) => c.schoolId, (c) => c.schoolName)
  }
}

export const hifziComplianceDashboardService = new HifziComplianceDashboardService()
