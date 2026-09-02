import { supabase } from '../../config/supabase'
import { hifziSettingsService } from './settings.service'
import { computeRetentionStrength } from './retention.service'
import {
  buildDailyAssignment,
  NearReviewUnit,
  DueReviewCandidate,
  NewMemorizationCandidate,
} from './assignment-builder.service'
import { getLocalDayAndTime, isLocalMidnightWindow } from '../../utils/school-time'
import { enqueueHifziJob } from '../../utils/hifzi-jobs'
import { registerHifziJobHandler } from './jobs'

// ============================================================================
// Plans + the Daily Assignment Builder's DB-facing wrapper. The pure
// orchestration logic lives in assignment-builder.service.ts (100%
// branch-covered, no DB access); this file's job is only to fetch the
// inputs it needs and persist the result — see spec §7.4's pseudocode,
// which this mirrors 1:1 at the fetch/persist layer.
// ============================================================================

export interface CreatePlanDTO {
  studentId: string
  circleId?: string | null
  planType?: 'time_based' | 'quantity_based' | 'staged' | 'custom' | 'intensive'
  riwayahId: string
  targetStartAyahId?: string | null
  targetEndAyahId?: string | null
  dailyNewAyatTarget?: number | null
}

class HifziPlansService {
  async createPlan(dto: CreatePlanDTO, schoolId: string, createdBy?: string) {
    const { data, error } = await supabase
      .from('hifzi_plans')
      .insert({
        school_id: schoolId,
        student_id: dto.studentId,
        circle_id: dto.circleId ?? null,
        plan_type: dto.planType ?? 'quantity_based',
        riwayah_id: dto.riwayahId,
        target_start_ayah_id: dto.targetStartAyahId ?? null,
        target_end_ayah_id: dto.targetEndAyahId ?? null,
        daily_new_ayat_target: dto.dailyNewAyatTarget ?? null,
        created_by: createdBy ?? null,
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create plan: ${error.message}`)
    return data
  }

  async getPlansForStudent(studentId: string) {
    const { data, error } = await supabase
      .from('hifzi_plans')
      .select('*, hifzi_plan_items(*)')
      .eq('student_id', studentId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch plans: ${error.message}`)
    return data || []
  }

  /** Minimal fetch used to authorize an update/deactivate against the plan's real student_id before mutating — mirrors updatePlan's own school_id-scoped filter. */
  async getPlanById(planId: string, schoolId: string): Promise<{ id: string; student_id: string } | null> {
    const { data, error } = await supabase
      .from('hifzi_plans')
      .select('id, student_id')
      .eq('id', planId)
      .eq('school_id', schoolId)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch plan: ${error.message}`)
    return data
  }

  async updatePlan(planId: string, schoolId: string, updates: Partial<Omit<CreatePlanDTO, 'studentId'>>) {
    const payload: Record<string, any> = {}
    if (updates.circleId !== undefined) payload.circle_id = updates.circleId
    if (updates.planType !== undefined) payload.plan_type = updates.planType
    if (updates.riwayahId !== undefined) payload.riwayah_id = updates.riwayahId
    if (updates.targetStartAyahId !== undefined) payload.target_start_ayah_id = updates.targetStartAyahId
    if (updates.targetEndAyahId !== undefined) payload.target_end_ayah_id = updates.targetEndAyahId
    if (updates.dailyNewAyatTarget !== undefined) payload.daily_new_ayat_target = updates.dailyNewAyatTarget

    const { data, error } = await supabase
      .from('hifzi_plans')
      .update(payload)
      .eq('id', planId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update plan: ${error.message}`)
    return data
  }

  /**
   * Soft delete (is_active = false), matching getPlansForStudent's own
   * `.eq('is_active', true)` filter and the same convention used elsewhere
   * in this codebase (hifzi_circles, textbooks, ...) — reversible, and
   * avoids cascading away hifzi_plan_items history for a plan that was
   * actually used.
   */
  async deactivatePlan(planId: string, schoolId: string) {
    const { data, error } = await supabase
      .from('hifzi_plans')
      .update({ is_active: false })
      .eq('id', planId)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw new Error(`Failed to delete plan: ${error.message}`)
    return data
  }

  async getAssignmentForStudent(studentId: string, date: string) {
    const { data, error } = await supabase
      .from('hifzi_daily_assignments')
      .select('*, hifzi_assignment_items(*, hifzi_reason_codes(label_ar, label_en))')
      .eq('student_id', studentId)
      .eq('assignment_date', date)
      .maybeSingle()

    if (error) throw new Error(`Failed to fetch assignment: ${error.message}`)
    return data
  }

  /**
   * DB-facing wrapper around assignment-builder.service.ts's pure
   * buildDailyAssignment. Idempotent per (student, date) — re-running for
   * the same day replaces that day's items rather than duplicating them,
   * so a manual "regenerate" admin action (spec's `assignments/generate`
   * endpoint) is safe to call repeatedly.
   *
   * `precomputedSettings` lets a caller looping over many students in the
   * same school (the nightly job handler below) fetch settings once per
   * school instead of once per student — settings don't vary by student.
   * The single-student controller path omits it and gets the old
   * fetch-per-call behavior (still a cache hit after the first call, per
   * settings.service.ts's TTL cache).
   */
  async generateDailyAssignmentForStudent(studentId: string, date: string, schoolId: string, campusId?: string | null, precomputedSettings?: Awaited<ReturnType<typeof hifziSettingsService.getEffectiveSettings>>) {
    const settings = precomputedSettings ?? (await hifziSettingsService.getEffectiveSettings(schoolId, campusId))
    const now = new Date()

    // These three reads are independent of each other — fetch concurrently
    // instead of one after another.
    const [unitStatesResult, recentResult, planItemResult] = await Promise.all([
      // Every unit_state for this student, with strength computed on read (never stored — retention.service.ts).
      supabase.from('hifzi_unit_states').select('*').eq('student_id', studentId),
      // "Last N memorized units" — the most recently first-memorized ones, per spec §7.4's mandatory near-review.
      supabase
        .from('hifzi_unit_states')
        .select('id, start_ayah_id, end_ayah_id')
        .eq('student_id', studentId)
        .not('first_memorized_at', 'is', null)
        .order('first_memorized_at', { ascending: false })
        .limit(settings.assignmentNearReviewCount),
      // Next not-yet-done plan item, from the student's active plan(s).
      supabase
        .from('hifzi_plan_items')
        .select('start_ayah_id, end_ayah_id, hifzi_plans!inner(student_id, is_active)')
        .eq('hifzi_plans.student_id', studentId)
        .eq('hifzi_plans.is_active', true)
        .neq('status', 'done')
        .order('sequence_number', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    const { data: unitStateRows, error: unitStatesError } = unitStatesResult
    if (unitStatesError) throw new Error(`Failed to fetch unit states: ${unitStatesError.message}`)

    const withStrength = (unitStateRows || []).map((row) => ({
      ...row,
      strength: row.last_reviewed_at ? computeRetentionStrength(row.interval_days, new Date(row.last_reviewed_at), now, settings.retentionDecayScale) : 0,
    }))

    const criticalRows = withStrength.filter((r) => r.strength < settings.assignmentCriticalThreshold)
    const criticalUnits: NearReviewUnit[] = criticalRows.map((r) => ({ unitId: r.id, startAyahId: r.start_ayah_id, endAyahId: r.end_ayah_id }))

    const dueRows = withStrength.filter((r) => r.due_at && r.due_at <= date)
    const dueReviews: DueReviewCandidate[] = dueRows.map((r) => ({
      unitId: r.id,
      startAyahId: r.start_ayah_id,
      endAyahId: r.end_ayah_id,
      strength: r.strength,
      hasSimilar: !!r.has_similar,
    }))

    const { data: recentRows } = recentResult
    const nearReviewUnits: NearReviewUnit[] = (recentRows || []).map((r) => ({ unitId: r.id, startAyahId: r.start_ayah_id, endAyahId: r.end_ayah_id }))

    const { data: planItemRow } = planItemResult
    const newMemorizationCandidate: NewMemorizationCandidate | null = planItemRow
      ? { startAyahId: planItemRow.start_ayah_id, endAyahId: planItemRow.end_ayah_id }
      : null

    const result = buildDailyAssignment({
      nearReviewUnits,
      dueReviews,
      criticalUnits,
      criticalCount: criticalRows.length,
      newMemorizationCandidate,
      config: {
        criticalThreshold: settings.assignmentCriticalThreshold,
        newMemorizationBlockThreshold: settings.assignmentNewBlockThreshold,
        maxDailyReviewUnits: settings.assignmentMaxDailyReviewUnits,
        nearReviewCount: settings.assignmentNearReviewCount,
      },
    })

    // Persist: upsert the daily_assignments row, replace its items.
    const { data: assignment, error: assignmentError } = await supabase
      .from('hifzi_daily_assignments')
      .upsert(
        { school_id: schoolId, student_id: studentId, assignment_date: date, generated_at: now.toISOString(), generation_source: 'auto' },
        { onConflict: 'student_id,assignment_date' }
      )
      .select()
      .single()

    if (assignmentError) throw new Error(`Failed to save daily assignment: ${assignmentError.message}`)

    await supabase.from('hifzi_assignment_items').delete().eq('daily_assignment_id', assignment.id)

    if (result.items.length > 0) {
      const { error: itemsError } = await supabase.from('hifzi_assignment_items').insert(
        result.items.map((item, i) => ({
          daily_assignment_id: assignment.id,
          item_type: item.itemType,
          start_ayah_id: item.startAyahId,
          end_ayah_id: item.endAyahId,
          reason_code: item.reasonCode,
          sort_order: i,
        }))
      )
      if (itemsError) throw new Error(`Failed to save assignment items: ${itemsError.message}`)
    }

    return { assignment, ...result }
  }
}

export const hifziPlansService = new HifziPlansService()

// ============================================================================
// Nightly trigger — enqueues one 'generate_daily_assignments' hifzi_jobs row
// per active, Hifzi-enabled school once that school crosses local midnight
// (schools.timezone-aware, via backend/src/utils/school-time.ts). The actual
// per-student generation work runs in the hifzi_jobs poller (jobs.ts),
// getting retry/backoff for free if a run fails partway through a large
// school — see the approved plan §7 for the reasoning behind this two-step
// design (a cheap frequent tick that only enqueues, vs. the queue that does
// the real work).
//
// generateDailyAssignmentForStudent's upsert-by-(student_id, assignment_date)
// makes re-running for the same day idempotent, so an edge-of-window double
// enqueue (this tick's 15-minute cadence vs. the midnight window) just
// redoes idempotent work rather than corrupting anything.
// ============================================================================

async function enqueueNightlyAssignmentJobs(now: Date = new Date()): Promise<void> {
  // school_settings_school_id_fkey named explicitly — schools/school_settings
  // have two FKs between them (school_id and campus_id), so PostgREST can't
  // auto-pick one (PGRST201) without it. See attendance-alert.service.ts's
  // identical fix for the full explanation.
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, timezone, school_settings!school_settings_school_id_fkey(active_plugins)')
  if (error) {
    console.error('enqueueNightlyAssignmentJobs: failed to fetch schools:', error)
    return
  }

  for (const school of schools || []) {
    const hifziEnabled = ((school as any).school_settings || []).some((row: any) => row.active_plugins?.hifzi)
    if (!hifziEnabled) continue

    const timezone = (school as any).timezone || 'Asia/Karachi'
    if (!isLocalMidnightWindow(timezone, now, 15)) continue

    const { date } = getLocalDayAndTime(timezone, now)
    await enqueueHifziJob('generate_daily_assignments', { schoolId: school.id, date }, 3)
  }
}

registerHifziJobHandler('generate_daily_assignments', async (payload) => {
  const { schoolId, date } = payload as { schoolId: string; date: string }

  const { data: activeEnrollments, error } = await supabase
    .from('hifzi_enrollments')
    .select('student_id, hifzi_circles!inner(school_id)')
    .eq('status', 'active')
    .eq('hifzi_circles.school_id', schoolId)

  if (error) throw new Error(`Failed to fetch active students for school ${schoolId}: ${error.message}`)

  const studentIds = [...new Set((activeEnrollments || []).map((e) => e.student_id))]

  // Fetched once for the whole school rather than once per student —
  // settings don't vary by student, only by (school, campus).
  const settings = await hifziSettingsService.getEffectiveSettings(schoolId)

  // Bounded concurrency instead of one student fully sequentially: keeps the
  // "one student's failure can't abort the batch" guarantee (each call is
  // still individually try/caught) while not serializing hundreds of
  // students' worth of round trips one at a time.
  const CONCURRENCY = 10
  for (let i = 0; i < studentIds.length; i += CONCURRENCY) {
    const batch = studentIds.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (studentId) => {
        try {
          await hifziPlansService.generateDailyAssignmentForStudent(studentId, date, schoolId, undefined, settings)
        } catch (err) {
          // One student's failure must not abort the whole school's batch.
          console.error(`generate_daily_assignments: failed for student ${studentId} (school ${schoolId}):`, err)
        }
      })
    )
  }
})

const NIGHTLY_TICK_INTERVAL_MS = Number(process.env.HIFZI_NIGHTLY_TICK_INTERVAL_MS || 15 * 60 * 1000) // 15 minutes
let nightlyTickTimer: ReturnType<typeof setInterval> | null = null

export function startHifziNightlyAssignmentCron(): void {
  if (nightlyTickTimer) return
  nightlyTickTimer = setInterval(() => {
    enqueueNightlyAssignmentJobs().catch((err) => console.error('Hifzi nightly-assignment tick failed:', err))
  }, NIGHTLY_TICK_INTERVAL_MS)
  console.log(`⏰ Hifzi nightly-assignment cron started (interval ${NIGHTLY_TICK_INTERVAL_MS}ms)`)
}

export function stopHifziNightlyAssignmentCron(): void {
  if (nightlyTickTimer) {
    clearInterval(nightlyTickTimer)
    nightlyTickTimer = null
  }
}
