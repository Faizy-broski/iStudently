import { supabase } from '../config/supabase'
import type {
  PerformanceActionLookup,
  StaffPerformanceLog,
  PerformanceScore,
} from '../types'

// ─── Default seed catalog ────────────────────────────────────────────────────

const DEFAULT_ACTIONS = [
  { action_name_ar: 'التأخر عن طابور الصباح', action_name_en: 'Late for Morning Assembly',    action_type: 'violation_demerit',  escalation_stage: 'verbal_alert',    default_points: -5,  default_fine: 0,  sort_order: 10 },
  { action_name_ar: 'التأخر عن الحصة',         action_name_en: 'Late for Class',                action_type: 'violation_demerit',  escalation_stage: 'verbal_alert',    default_points: -5,  default_fine: 0,  sort_order: 20 },
  { action_name_ar: 'الغياب بدون عذر',          action_name_en: 'Unexcused Absence',             action_type: 'violation_demerit',  escalation_stage: 'written_warning', default_points: -30, default_fine: 50, sort_order: 30 },
  { action_name_ar: 'السلوك غير المهني',        action_name_en: 'Unprofessional Conduct',        action_type: 'violation_demerit',  escalation_stage: 'final_warning',   default_points: -20, default_fine: 0,  sort_order: 40 },
  { action_name_ar: 'شكوى سلوكية',              action_name_en: 'Behavioral Complaint',          action_type: 'violation_demerit',  escalation_stage: 'verbal_alert',    default_points: -10, default_fine: 0,  sort_order: 50 },
  { action_name_ar: 'تغطية حصة بديل',           action_name_en: 'Covering Substitution Class',  action_type: 'reward_redemption',  escalation_stage: 'none',            default_points: 15,  default_fine: 0,  sort_order: 60 },
  { action_name_ar: 'الأداء المتميز',            action_name_en: 'Outstanding Performance',      action_type: 'reward_redemption',  escalation_stage: 'none',            default_points: 20,  default_fine: 0,  sort_order: 70 },
  { action_name_ar: 'أسبوع حضور كامل',           action_name_en: 'Perfect Attendance Week',      action_type: 'reward_redemption',  escalation_stage: 'none',            default_points: 10,  default_fine: 0,  sort_order: 80 },
]

// ─── Catalog ─────────────────────────────────────────────────────────────────

export async function getCatalog(schoolId: string, activeOnly = false): Promise<PerformanceActionLookup[]> {
  let q = supabase
    .from('performance_actions_lookup')
    .select('*')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })

  if (activeOnly) q = (q as any).eq('is_active', true)

  const { data, error } = await q
  if (error) throw error

  // Seed defaults on first use
  if (!data || data.length === 0) {
    const seeds = DEFAULT_ACTIONS.map(a => ({ ...a, school_id: schoolId }))
    const { data: inserted, error: seedErr } = await supabase
      .from('performance_actions_lookup')
      .insert(seeds)
      .select()
    if (seedErr) throw seedErr
    return inserted || []
  }

  return data
}

export async function createAction(data: Omit<PerformanceActionLookup, 'id' | 'created_at' | 'updated_at'>): Promise<PerformanceActionLookup> {
  const { data: row, error } = await supabase
    .from('performance_actions_lookup')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return row
}

export async function updateAction(id: string, data: Partial<PerformanceActionLookup>): Promise<PerformanceActionLookup> {
  const { data: row, error } = await supabase
    .from('performance_actions_lookup')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return row
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await supabase
    .from('performance_actions_lookup')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Incident Logs ────────────────────────────────────────────────────────────

export async function getLogs(params: {
  schoolId: string
  staffId?: string
  campusId?: string
  academicYearId?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  unpaginated?: boolean
}): Promise<{ data: StaffPerformanceLog[]; total: number }> {
  const { schoolId, staffId, campusId, academicYearId, startDate, endDate, page = 1, limit = 20, unpaginated } = params

  let q = supabase
    .from('staff_performance_log')
    .select(`
      *,
      action:performance_actions_lookup(*),
      staff:staff(id, employee_number, role, employment_type, department, profiles:profiles!staff_profile_id_fkey(first_name, last_name, profile_photo_url)),
      reporter:profiles!created_by(first_name, last_name)
    `, { count: 'exact' })
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (staffId)        q = (q as any).eq('staff_id', staffId)
  if (campusId)        q = (q as any).eq('campus_id', campusId)
  if (academicYearId)  q = (q as any).eq('academic_year_id', academicYearId)
  if (startDate)       q = (q as any).gte('created_at', startDate)
  if (endDate)         q = (q as any).lte('created_at', `${endDate}T23:59:59.999Z`)

  if (!unpaginated) {
    const from = (page - 1) * limit
    const to   = from + limit - 1
    q = q.range(from, to)
  }

  const { data, error, count } = await q
  if (error) throw error
  return { data: data || [], total: count || 0 }
}

export async function getLogById(id: string): Promise<StaffPerformanceLog | null> {
  const { data, error } = await supabase
    .from('staff_performance_log')
    .select(`
      *,
      action:performance_actions_lookup(*),
      staff:staff(id, employee_number, profiles:profiles!staff_profile_id_fkey(first_name, last_name, profile_photo_url))
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createLog(
  input: {
    school_id: string
    campus_id?: string
    staff_id: string
    action_id: string
    academic_year_id?: string
    custom_points?: number | null
    custom_fine?: number | null
    notes?: string
  },
  adminProfileId: string
): Promise<StaffPerformanceLog> {
  // 1. Fetch catalog item for defaults + escalation stage
  const { data: action, error: aErr } = await supabase
    .from('performance_actions_lookup')
    .select('*')
    .eq('id', input.action_id)
    .single()
  if (aErr || !action) throw aErr || new Error('Action not found')

  const effectiveFine   = input.custom_fine   != null ? input.custom_fine   : action.default_fine
  const effectivePoints = input.custom_points != null ? input.custom_points : action.default_points

  const letterGenerated = ['written_warning', 'final_warning'].includes(action.escalation_stage)

  // 2. Insert log row
  const { data: log, error: lErr } = await supabase
    .from('staff_performance_log')
    .insert({
      school_id:        input.school_id,
      campus_id:        input.campus_id || null,
      staff_id:         input.staff_id,
      action_id:        input.action_id,
      academic_year_id: input.academic_year_id || null,
      custom_points:    input.custom_points ?? null,
      custom_fine:      input.custom_fine    ?? null,
      notes:            input.notes          || null,
      status:           'active',
      letter_generated: letterGenerated,
      salary_adjusted:  false,
      created_by:       adminProfileId,
    })
    .select(`*, action:performance_actions_lookup(*)`)
    .single()
  if (lErr || !log) throw lErr || new Error('Log insert failed')

  // 3. Payroll adjustment when there is a monetary amount
  if (effectiveFine !== 0) {
    await applySalaryAdjustment(input.staff_id, input.school_id, effectiveFine, action.action_type, log.id)
    await supabase
      .from('staff_performance_log')
      .update({ salary_adjusted: true })
      .eq('id', log.id)
    log.salary_adjusted = true
  }

  return log
}

export async function deleteLog(id: string): Promise<void> {
  // 1. Fetch log to reverse payroll if needed
  const { data: log, error: fErr } = await supabase
    .from('staff_performance_log')
    .select(`*, action:performance_actions_lookup(default_fine, action_type)`)
    .eq('id', id)
    .maybeSingle()
  if (fErr) throw fErr

  if (log?.salary_adjusted) {
    const effectiveFine = log.custom_fine != null ? log.custom_fine : (log.action as any)?.default_fine ?? 0
    const oppositeType  = (log.action as any)?.action_type === 'violation_demerit'
      ? 'reward_redemption'
      : 'violation_demerit'
    if (effectiveFine !== 0) {
      await applySalaryAdjustment(log.staff_id, log.school_id, effectiveFine, oppositeType, null)
    }
  }

  const { error } = await supabase
    .from('staff_performance_log')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Payroll bridge ───────────────────────────────────────────────────────────

async function applySalaryAdjustment(
  staffId: string,
  schoolId: string,
  fineAmount: number,
  actionType: string,
  _logId: string | null
): Promise<void> {
  const now  = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  // Find staff record to get profile link
  const { data: staffRow } = await supabase
    .from('staff')
    .select('id')
    .eq('id', staffId)
    .maybeSingle()
  if (!staffRow) return

  // Find existing salary record for this month
  const { data: record } = await supabase
    .from('salary_records')
    .select('id, performance_deductions, performance_bonuses, net_salary, total_deductions, total_allowances, base_salary, attendance_bonus, advance_deduction')
    .eq('staff_id', staffId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (!record) return // No salary record yet — adjustment will be included when generated

  const absAmount = Math.abs(fineAmount)
  let perfDed  = Number(record.performance_deductions || 0)
  let perfBonus = Number(record.performance_bonuses    || 0)

  if (actionType === 'violation_demerit') {
    perfDed = Math.max(0, perfDed + absAmount)
  } else {
    perfBonus = Math.max(0, perfBonus + absAmount)
  }

  const newNet =
    Number(record.base_salary || 0) +
    Number(record.total_allowances || 0) +
    Number(record.attendance_bonus || 0) +
    perfBonus -
    Number(record.total_deductions || 0) -
    perfDed -
    Number(record.advance_deduction || 0)

  await supabase
    .from('salary_records')
    .update({
      performance_deductions: perfDed,
      performance_bonuses:    perfBonus,
      net_salary: Math.max(0, newNet),
    })
    .eq('id', record.id)
}

// ─── Score Engine ─────────────────────────────────────────────────────────────

export async function getStaffScore(
  staffId: string,
  schoolId: string,
  academicYearId?: string
): Promise<PerformanceScore> {
  let q = supabase
    .from('staff_performance_log')
    .select(`
      id, custom_points, custom_fine, status, created_at,
      action:performance_actions_lookup(action_name_ar, action_name_en, action_type, escalation_stage, default_points, default_fine)
    `)
    .eq('staff_id', staffId)
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (academicYearId) q = (q as any).eq('academic_year_id', academicYearId)

  const { data: logs, error } = await q
  if (error) throw error

  let totalDemerit    = 0
  let totalRedemption = 0
  const breakdown: PerformanceScore['breakdown'] = []

  for (const log of logs || []) {
    const action = (log as any).action
    if (!action) continue

    const effectivePoints = log.custom_points != null ? log.custom_points : action.default_points
    const effectiveFine   = log.custom_fine   != null ? log.custom_fine   : action.default_fine

    if (action.action_type === 'violation_demerit') {
      totalDemerit += Math.abs(effectivePoints)
    } else {
      totalRedemption += Math.abs(effectivePoints)
    }

    breakdown.push({
      log_id:           log.id,
      date:             log.created_at,
      name_ar:          action.action_name_ar,
      name_en:          action.action_name_en,
      type:             action.action_type,
      escalation_stage: action.escalation_stage,
      effective_points: effectivePoints,
      effective_fine:   effectiveFine,
    })
  }

  // Formula: 100 - total_demerit + total_redemption, clamped [0,100]
  const rawScore = 100 - totalDemerit + totalRedemption
  const score    = Math.max(0, Math.min(100, rawScore))

  return {
    score,
    total_demerit:    totalDemerit,
    total_redemption: totalRedemption,
    log_count:        (logs || []).length,
    breakdown,
  }
}

/** Zero-trust: get score for the authenticated staff member */
export async function getMyScore(profileId: string, schoolId: string): Promise<PerformanceScore> {
  const { data: staffRow, error } = await supabase
    .from('staff')
    .select('id')
    .eq('profile_id', profileId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  if (!staffRow) throw new Error('Staff record not found for this profile')
  return getStaffScore(staffRow.id, schoolId)
}
