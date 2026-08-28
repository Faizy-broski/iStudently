import { supabase } from '../config/supabase'
import { validateCampusAccess } from '../utils/campus-validation'
import { listAssignedSchoolIds } from '../utils/inspector-access'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

export interface CategoryScore {
  category: string
  avgScore: number // 0-100
}

export interface HeatmapRow {
  label: string
  scoresByCategory: Record<string, number> // category name -> 0-100
}

export interface DashboardStats {
  visitsScheduled: number
  visitsCompleted: number
  avgOverallScore: number | null
  avgScoreByCategory: CategoryScore[]
  openAppealsCount: number
  heatmap: HeatmapRow[]
}

/**
 * Shared core: computes dashboard stats for either an inspector (their own
 * visits, across every assigned campus) or a single campus (an admin's own
 * school). Not a database view/RPC — a few bounded queries aggregated in
 * JS, consistent with this module's existing pattern (see
 * inspection-evaluation.service.ts::getGradeSampleForComparison).
 */
async function computeStats(params: { inspectorProfileId?: string; schoolIds?: string[] }): Promise<DashboardStats> {
  let visitQuery = supabase.from('inspection_visits').select('id, school_id, status')
  if (params.inspectorProfileId) visitQuery = visitQuery.eq('inspector_profile_id', params.inspectorProfileId)
  if (params.schoolIds) visitQuery = visitQuery.in('school_id', params.schoolIds)

  const { data: visits, error: visitsError } = await visitQuery
  if (visitsError) throw new Error(`Failed to load visits: ${visitsError.message}`)

  const visitRows = visits || []
  const visitIds = visitRows.map((v) => v.id)
  // Mutually exclusive with visitsCompleted below — "scheduled" here means
  // still pending (not yet completed, cancelled, or rescheduled away), not
  // "every non-cancelled visit ever" (which would double-count completed
  // ones under a "Scheduled" stat card label).
  const visitsScheduled = visitRows.filter((v) => ['scheduled', 'confirmed', 'in_progress'].includes(v.status)).length
  const visitsCompleted = visitRows.filter((v) => v.status === 'completed').length

  if (visitIds.length === 0) {
    return { visitsScheduled, visitsCompleted, avgOverallScore: null, avgScoreByCategory: [], openAppealsCount: 0, heatmap: [] }
  }

  const { data: evaluations, error: evalError } = await supabase
    .from('inspection_evaluations')
    .select('id, visit_id, overall_score')
    .in('visit_id', visitIds)
    .in('status', ['submitted', 'finalized'])

  if (evalError) throw new Error(`Failed to load evaluations: ${evalError.message}`)
  const evalRows = evaluations || []
  const evaluationIds = evalRows.map((e) => e.id)
  const visitSchoolById = new Map(visitRows.map((v) => [v.id, v.school_id]))

  const scoredEvals = evalRows.filter((e) => e.overall_score !== null)
  const avgOverallScore = scoredEvals.length > 0
    ? Math.round((scoredEvals.reduce((sum, e) => sum + Number(e.overall_score), 0) / scoredEvals.length) * 100) / 100
    : null

  let avgScoreByCategory: CategoryScore[] = []
  let heatmap: HeatmapRow[] = []

  if (evaluationIds.length > 0) {
    const { data: scores, error: scoresError } = await supabase
      .from('inspection_evaluation_scores')
      .select('evaluation_id, score, criterion:rubric_criteria(category:rubric_categories(id, name))')
      .in('evaluation_id', evaluationIds)

    if (scoresError) throw new Error(`Failed to load scores: ${scoresError.message}`)

    const categoryTotals = new Map<string, { sum: number; count: number }>()
    // heatmapKey -> category -> { sum, count }. heatmapKey = school_id (inspector view) or teacher not tracked here (admin view builds its own).
    const heatmapTotals = new Map<string, Map<string, { sum: number; count: number }>>()

    for (const row of (scores || []) as any[]) {
      const categoryName = row.criterion?.category?.name
      if (!categoryName) continue
      const entry = categoryTotals.get(categoryName) || { sum: 0, count: 0 }
      entry.sum += row.score
      entry.count += 1
      categoryTotals.set(categoryName, entry)
    }

    avgScoreByCategory = [...categoryTotals.entries()].map(([category, { sum, count }]) => ({
      category,
      avgScore: Math.round((sum / count / 5) * 100 * 100) / 100,
    }))

    // Heatmap: for the inspector view, rows = campuses; for the admin view,
    // rows = teachers. Grouped by a stable ID, not by display name — two
    // campuses or two teachers can share an identical display name, which
    // would otherwise silently merge their scores into one row.
    const rowLabelById = new Map<string, string>()

    if (params.inspectorProfileId) {
      const evalSchoolById = new Map(evalRows.map((e) => [e.id, visitSchoolById.get(e.visit_id)]))
      const { data: schools } = await supabase.from('schools').select('id, name').in('id', [...new Set(evalSchoolById.values())].filter(Boolean) as string[])
      for (const s of schools || []) rowLabelById.set(s.id, s.name)

      for (const row of (scores || []) as any[]) {
        const categoryName = row.criterion?.category?.name
        if (!categoryName) continue
        const schoolId = evalSchoolById.get(row.evaluation_id)
        if (!schoolId) continue
        const rowMap = heatmapTotals.get(schoolId) || new Map()
        const cell = rowMap.get(categoryName) || { sum: 0, count: 0 }
        cell.sum += row.score
        cell.count += 1
        rowMap.set(categoryName, cell)
        heatmapTotals.set(schoolId, rowMap)
      }
    } else {
      const { data: evalTeachers } = await supabase
        .from('inspection_evaluations')
        .select('id, teacher_profile_id, teacher:profiles!inspection_evaluations_teacher_profile_id_fkey(first_name, last_name)')
        .in('id', evaluationIds)

      const teacherIdByEval = new Map((evalTeachers || []).map((e: any) => [e.id, e.teacher_profile_id]))
      for (const e of (evalTeachers || []) as any[]) {
        rowLabelById.set(e.teacher_profile_id, e.teacher ? `${e.teacher.first_name} ${e.teacher.last_name}` : e.teacher_profile_id)
      }

      for (const row of (scores || []) as any[]) {
        const categoryName = row.criterion?.category?.name
        if (!categoryName) continue
        const teacherId = teacherIdByEval.get(row.evaluation_id)
        if (!teacherId) continue
        const rowMap = heatmapTotals.get(teacherId) || new Map()
        const cell = rowMap.get(categoryName) || { sum: 0, count: 0 }
        cell.sum += row.score
        cell.count += 1
        rowMap.set(categoryName, cell)
        heatmapTotals.set(teacherId, rowMap)
      }
    }

    heatmap = [...heatmapTotals.entries()].map(([id, catMap]) => ({
      label: rowLabelById.get(id) || id,
      scoresByCategory: Object.fromEntries(
        [...catMap.entries()].map(([cat, { sum, count }]) => [cat, Math.round((sum / count / 5) * 100 * 100) / 100])
      ),
    }))
  }

  let openAppealsCount = 0
  if (evaluationIds.length > 0) {
    const { count, error: appealsError } = await supabase
      .from('inspection_appeals')
      .select('id', { count: 'exact', head: true })
      .in('evaluation_id', evaluationIds)
      .in('status', ['submitted', 'under_review', 'escalated'])

    if (appealsError) throw new Error(`Failed to count open appeals: ${appealsError.message}`)
    openAppealsCount = count || 0
  }

  return { visitsScheduled, visitsCompleted, avgOverallScore, avgScoreByCategory, openAppealsCount, heatmap }
}

export async function getInspectorDashboardStats(caller: CallerContext): Promise<DashboardStats> {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  return computeStats({ inspectorProfileId: caller.profileId })
}

export async function getSchoolDashboardStats(caller: CallerContext, schoolId: string): Promise<DashboardStats> {
  if (caller.role !== 'admin' && caller.role !== 'super_admin') {
    throw new Error('Access denied: admin access required')
  }
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }
  return computeStats({ schoolIds: [schoolId] })
}
