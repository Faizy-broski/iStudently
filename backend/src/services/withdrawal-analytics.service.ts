import { supabase } from '../config/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WithdrawalDataPoint {
  date: string       // 'YYYY-MM' (absolute) or 'Month 1' (normalized for comparison)
  label: string      // 'Jan 2025' or 'Month 1'
  count: number      // new withdrawals this period
  cumulative: number // running total
}

export interface WithdrawalComparisonData {
  [yearName: string]: WithdrawalDataPoint[]
}

export interface WithdrawalSummary {
  total: number
  vsLastYear: number | null   // percentage change, null if no prior year data
  peakMonth: string | null
  trend: 'up' | 'down' | 'stable'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7) // 'YYYY-MM'
}

function formatLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-')
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
}

/** All months between two ISO date strings, inclusive, sorted ascending */
function monthRange(startIso: string, endIso: string): string[] {
  const months: string[] = []
  const end = new Date(endIso)
  const cur = new Date(startIso.substring(0, 7) + '-01')
  const last = new Date(end.getFullYear(), end.getMonth(), 1)

  while (cur <= last) {
    months.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
    )
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

/** Fetch academic year date range */
async function getAcademicYearRange(
  academicYearId: string
): Promise<{ name: string; start_date: string; end_date: string } | null> {
  const { data } = await supabase
    .from('academic_years')
    .select('name, start_date, end_date')
    .eq('id', academicYearId)
    .maybeSingle()
  return data
}

/** Raw withdrawal rows for a school + academic year */
async function fetchWithdrawals(params: {
  schoolId: string
  campusId?: string
  academicYearId: string
}): Promise<{ end_date: string | null; updated_at: string }[]> {
  // student_enrollment.school_id stores the campus_id when records belong to a campus.
  // Use campusId directly as school_id when provided; fall back to the admin's school_id.
  const effectiveSchoolId = params.campusId ?? params.schoolId

  const { data, error } = await supabase
    .from('student_enrollment')
    .select('end_date, updated_at')
    .eq('school_id', effectiveSchoolId)
    .eq('academic_year_id', params.academicYearId)
    .in('rollover_status', ['dropped', 'transferred'])

  if (error) throw error
  return data ?? []
}

/** Group rows by month → { 'YYYY-MM': count } */
function groupByMonth(
  rows: { end_date: string | null; updated_at: string }[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const dateStr = row.end_date ?? row.updated_at
    if (!dateStr) continue
    const ym = toYearMonth(dateStr)
    counts[ym] = (counts[ym] || 0) + 1
  }
  return counts
}

/** Build cumulative data points from a counts map and ordered months array */
function buildCumulative(
  months: string[],
  countsByMonth: Record<string, number>
): WithdrawalDataPoint[] {
  let cumulative = 0
  return months.map((ym) => {
    const count = countsByMonth[ym] || 0
    cumulative += count
    return { date: ym, label: formatLabel(ym), count, cumulative }
  })
}

// ── Public Functions ─────────────────────────────────────────────────────────

export async function getWithdrawalCumulative(params: {
  schoolId: string
  campusId?: string
  academicYearId: string
  granularity: 'semester' | 'annual'
  semester?: '1' | '2'
}): Promise<WithdrawalDataPoint[]> {
  const ay = await getAcademicYearRange(params.academicYearId)
  if (!ay) return []

  const endBound = ay.end_date || new Date().toISOString().substring(0, 10)
  const allMonths = monthRange(ay.start_date, endBound)
  if (allMonths.length === 0) return []

  // Semester filter: split year in two halves
  let months = allMonths
  if (params.granularity === 'semester' && params.semester) {
    const half = Math.ceil(allMonths.length / 2)
    months = params.semester === '1'
      ? allMonths.slice(0, half)
      : allMonths.slice(half)
  }

  const rows = await fetchWithdrawals(params)
  const countsByMonth = groupByMonth(rows)
  return buildCumulative(months, countsByMonth)
}

export async function getWithdrawalComparison(params: {
  schoolId: string
  campusId?: string
  academicYearIds: string[]
  granularity: 'semester' | 'annual'
}): Promise<WithdrawalComparisonData> {
  const result: WithdrawalComparisonData = {}

  await Promise.all(
    params.academicYearIds.map(async (ayId) => {
      const ay = await getAcademicYearRange(ayId)
      if (!ay) return

      const endBound = ay.end_date || new Date().toISOString().substring(0, 10)
      const allMonths = monthRange(ay.start_date, endBound)
      if (allMonths.length === 0) return

      const rows = await fetchWithdrawals({
        schoolId: params.schoolId,
        campusId: params.campusId,
        academicYearId: ayId,
      })
      const countsByMonth = groupByMonth(rows)
      const rawPoints = buildCumulative(allMonths, countsByMonth)

      // Normalize to relative position for overlay comparison
      result[ay.name] = rawPoints.map((p, i) => ({
        ...p,
        date: `M${i + 1}`,
        label: `Month ${i + 1}`,
      }))
    })
  )

  return result
}

export async function getWithdrawalSummary(params: {
  schoolId: string
  campusId?: string
  academicYearId: string
}): Promise<WithdrawalSummary> {
  const ay = await getAcademicYearRange(params.academicYearId)
  if (!ay) return { total: 0, vsLastYear: null, peakMonth: null, trend: 'stable' }

  const rows = await fetchWithdrawals(params)
  const total = rows.length

  // Peak month
  const countsByMonth = groupByMonth(rows)
  let peakMonth: string | null = null
  let peakCount = 0
  for (const [ym, count] of Object.entries(countsByMonth)) {
    if (count > peakCount) {
      peakCount = count
      peakMonth = formatLabel(ym)
    }
  }

  // Compare with previous academic year
  // Academic years are stored under the parent school_id (not the campus_id)
  const { data: prevAy } = await supabase
    .from('academic_years')
    .select('id')
    .eq('school_id', params.schoolId)
    .lt('start_date', ay.start_date)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  let vsLastYear: number | null = null
  let trend: 'up' | 'down' | 'stable' = 'stable'

  if (prevAy) {
    const prevRows = await fetchWithdrawals({
      schoolId: params.schoolId,
      campusId: params.campusId,
      academicYearId: prevAy.id,
    })
    const prevTotal = prevRows.length

    if (prevTotal > 0) {
      vsLastYear = parseFloat((((total - prevTotal) / prevTotal) * 100).toFixed(1))
      trend = vsLastYear > 5 ? 'up' : vsLastYear < -5 ? 'down' : 'stable'
    } else if (total > 0) {
      vsLastYear = 100
      trend = 'up'
    }
  }

  return { total, vsLastYear, peakMonth, trend }
}
