import { supabase } from '../config/supabase'
import { ApiResponse } from '../types'
import {
  TimetableGenerationJob,
  TimetableRequirement,
  RoomType
} from '../types/timetable-generator.types'
import { buildActivities } from './timetable-solver/buildActivities'
import { computeDomains } from './timetable-solver/domains'
import { solve } from './timetable-solver/solver'
import {
  SolverContext,
  SolverExtendedContext,
  SolverPeriod,
  SolverRoom,
  SolverTeacherAvailability,
  LockedEntryInfo,
  TeacherConstraintInfo
} from './timetable-solver/types'
import { getSettings } from './timetable-generation-settings.service'
import { getMainSchoolId } from '../utils/campus.util'

// ============================================================================
// TIMETABLE GENERATION ORCHESTRATOR (Phase 2)
// The only place in the generator feature that touches Supabase for an
// actual generation run: loads all inputs, resolves null-teacher
// requirements, drives the pure solver (timetable-solver/*), and commits the
// result atomically via the apply_generation_result RPC (Phase 0).
//
// Runs "fire-and-forget" from the controller: startGeneration() creates the
// job row synchronously and returns immediately; runGeneration() executes in
// the background and is responsible for never leaving the job row stuck at
// 'running' — every code path below is wrapped so a thrown error is caught
// and persisted as status='failed'.
//
// KNOWN LIMITATION (documented per plan Phase 2 step 5/6): solver.ts's
// solve() is a single synchronous, CPU-bound call with no setImmediate/await
// yield points, so it blocks the Node event loop for its full duration. That
// means:
//   - progress_percent cannot be updated *during* the solve (no way to run
//     an async DB write mid-call); we approximate it as 0% -> 100% around
//     the call (0 before, 100 after) rather than a live counter. Because
//     solve() typically completes well within solver_time_limit_seconds for
//     the documented scale target, this is an acceptable v1 gap — a true
//     live counter needs the solver to be chunked/cooperative or moved to a
//     worker thread (the plan's documented v1.1 upgrade path).
//   - cancelRequested() can only reflect a value read from the DB *before*
//     solve() starts (there is no way for an in-flight synchronous call to
//     observe a concurrent DB write). We read cancel_requested once,
//     immediately before invoking solve(), and also check it once at the
//     very start of runGeneration() so a job cancelled while still 'queued'
//     never solves at all.
// ============================================================================

export class GenerationConflictError extends Error {
  existing_job_id: string
  constructor(existingJobId: string) {
    super(`A generation job is already running or queued for overlapping sections (job ${existingJobId})`)
    this.name = 'GenerationConflictError'
    this.existing_job_id = existingJobId
  }
}

export interface StartGenerationParams {
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  scope: 'all' | 'sections'
  section_ids?: string[]
  created_by?: string
}

// ----------------------------------------------------------------------------
// Pure helper (no Supabase) — resolves requirements with a null teacher_id
// against teacher_subject_assignments rows, preferring is_primary. Exported
// standalone so it's unit-testable without mocking the DB.
// ----------------------------------------------------------------------------

export interface AssignmentLite {
  teacher_id: string
  subject_id: string
  section_id: string
  is_primary?: boolean | null
}

export interface UnresolvedRequirement {
  requirement_id: string
  section_id: string
  subject_id: string
  reason: string
}

export interface ResolveTeachersResult {
  resolved: TimetableRequirement[]
  unresolved: UnresolvedRequirement[]
}

export function resolveRequirementTeachers(
  requirements: TimetableRequirement[],
  assignments: AssignmentLite[]
): ResolveTeachersResult {
  const bySectionSubject = new Map<string, AssignmentLite[]>()
  for (const a of assignments) {
    const key = `${a.section_id}|${a.subject_id}`
    const list = bySectionSubject.get(key) || []
    list.push(a)
    bySectionSubject.set(key, list)
  }

  const resolved: TimetableRequirement[] = []
  const unresolved: UnresolvedRequirement[] = []

  for (const req of requirements) {
    if (req.teacher_id) {
      resolved.push(req)
      continue
    }

    const candidates = bySectionSubject.get(`${req.section_id}|${req.subject_id}`) || []
    if (candidates.length === 0) {
      unresolved.push({
        requirement_id: req.id,
        section_id: req.section_id,
        subject_id: req.subject_id,
        reason: 'No teacher_subject_assignments row exists for this section/subject — cannot resolve a teacher. Assign a teacher or set one explicitly on the requirement.'
      })
      continue
    }

    const primary = candidates.find((c) => c.is_primary) || candidates[0]
    resolved.push({ ...req, teacher_id: primary.teacher_id })
  }

  return { resolved, unresolved }
}

// ----------------------------------------------------------------------------
// startGeneration
// ----------------------------------------------------------------------------

export const startGeneration = async (
  params: StartGenerationParams
): Promise<ApiResponse<{ job_id: string }>> => {
  try {
    if (params.scope === 'sections' && (!params.section_ids || params.section_ids.length === 0)) {
      return { success: false, error: 'section_ids is required when scope is "sections"' }
    }

    // Normalize school_id/campus_id the same way createRequirement /
    // bulkImportTimetable do: school_id becomes the main (parent) school,
    // campus_id becomes the campus-level school the caller actually passed
    // (falling back to school_id for non-campus schools). Getting this
    // wrong would let a campus-scoped run tag its job/entries with the
    // wrong school_id, breaking the campus-isolation RLS policies.
    const mainSchoolId = await getMainSchoolId(params.school_id)
    const campusId = params.campus_id || params.school_id

    // ── Concurrency guard ──────────────────────────────────────────────────
    const { data: activeJobs, error: activeJobsError } = await supabase
      .from('timetable_generation_jobs')
      .select('id, scope, section_ids')
      .eq('academic_year_id', params.academic_year_id)
      .in('status', ['queued', 'running'])

    if (activeJobsError) throw activeJobsError

    const newSections = new Set(params.section_ids || [])
    for (const job of activeJobs || []) {
      const overlaps =
        params.scope === 'all' ||
        job.scope === 'all' ||
        (job.section_ids || []).some((id: string) => newSections.has(id))
      if (overlaps) {
        throw new GenerationConflictError(job.id)
      }
    }

    // ── Create job row (status='queued') ───────────────────────────────────
    const { data: job, error: insertError } = await supabase
      .from('timetable_generation_jobs')
      .insert({
        school_id: mainSchoolId,
        campus_id: campusId,
        academic_year_id: params.academic_year_id,
        status: 'queued',
        scope: params.scope,
        section_ids: params.scope === 'sections' ? params.section_ids : null,
        created_by: params.created_by || null
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    const jobId = job.id as string

    // ── Fire-and-forget: never let a rejection escape unhandled ────────────
    runGeneration(jobId).catch(async (err: any) => {
      console.error(`[timetable-generation] job ${jobId} crashed outside runGeneration's own guard:`, err)
      try {
        await supabase
          .from('timetable_generation_jobs')
          .update({
            status: 'failed',
            error_message: safeErrorMessage(err),
            finished_at: new Date().toISOString()
          })
          .eq('id', jobId)
      } catch (persistErr) {
        console.error(`[timetable-generation] job ${jobId} failed AND failed to persist failure status:`, persistErr)
      }
    })

    return { success: true, data: { job_id: jobId } }
  } catch (error: any) {
    if (error instanceof GenerationConflictError) {
      return { success: false, error: error.message, data: { job_id: error.existing_job_id } as any }
    }
    console.error('Error starting timetable generation:', error)
    return { success: false, error: error.message }
  }
}

function safeErrorMessage(err: any): string {
  // Never leak raw stack traces to the job row / API response; log full
  // detail server-side (callers of this already console.error the raw err).
  const msg = err?.message || String(err)
  return msg.length > 1000 ? msg.slice(0, 1000) + '…' : msg
}

// ----------------------------------------------------------------------------
// runGeneration — the actual generation pipeline
// ----------------------------------------------------------------------------

export const runGeneration = async (jobId: string): Promise<void> => {
  const startedAt = Date.now()

  try {
    const { data: job, error: jobError } = await supabase
      .from('timetable_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error(`[timetable-generation] job ${jobId} not found at start of runGeneration:`, jobError)
      return
    }

    if (job.cancel_requested) {
      await markJob(jobId, { status: 'cancelled', finished_at: new Date().toISOString() })
      console.log(`[timetable-generation] job ${jobId} cancelled before it started`)
      return
    }

    await markJob(jobId, { status: 'running', started_at: new Date().toISOString() })

    const schoolId: string = job.school_id
    const campusId: string | null = job.campus_id
    const academicYearId: string = job.academic_year_id
    const scope: 'all' | 'sections' = job.scope

    // ── Resolve target section ids ─────────────────────────────────────────
    let targetSectionIds: string[]
    if (scope === 'sections') {
      targetSectionIds = job.section_ids || []
    } else {
      // scope === 'all': target every section that already has at least one
      // active requirement for this year (sections with none simply have
      // nothing to generate — not a failure, unlike an explicit scope:
      // 'sections' request naming a section with zero requirements).
      const { data: reqSectionRows, error: reqSectionErr } = await supabase
        .from('timetable_requirements')
        .select('section_id')
        .eq('academic_year_id', academicYearId)
        .eq('school_id', schoolId)
        .eq('is_active', true)
      if (reqSectionErr) throw reqSectionErr
      targetSectionIds = Array.from(new Set((reqSectionRows || []).map((r: any) => r.section_id)))
    }

    if (targetSectionIds.length === 0) {
      await failJob(jobId, scope === 'all'
        ? 'No sections with active requirements were found for this academic year — define requirements first.'
        : 'No target sections resolved for this job.')
      return
    }

    // ── Fetch all inputs in parallel (batch-fetch pattern, like bulkImportTimetable) ──
    const [
      { data: requirementsRaw, error: reqErr },
      { data: assignmentsRaw, error: asgErr },
      { data: periodsRaw, error: perErr },
      { data: roomsRaw, error: roomErr },
      { data: availabilityRaw, error: availErr },
      { data: constraintsRaw, error: consErr },
      { data: entriesRaw, error: entErr },
      settingsResult
    ] = await Promise.all([
      supabase
        .from('timetable_requirements')
        .select('*')
        .eq('academic_year_id', academicYearId)
        .eq('is_active', true)
        .in('section_id', targetSectionIds),
      supabase
        .from('teacher_subject_assignments')
        .select('teacher_id, subject_id, section_id, is_primary')
        .eq('academic_year_id', academicYearId)
        .in('section_id', targetSectionIds),
      supabase
        .from('periods')
        .select('id, period_number, is_break, is_active')
        .eq('school_id', campusId || schoolId)
        .eq('is_active', true)
        .eq('is_break', false),
      supabase
        .from('rooms')
        .select('id, name, room_type, is_active')
        .or(`school_id.eq.${schoolId},campus_id.eq.${campusId || schoolId}`)
        .eq('is_active', true),
      supabase
        .from('teacher_availability')
        .select('teacher_id, day_of_week, period_id, status')
        .eq('academic_year_id', academicYearId),
      supabase
        .from('teacher_scheduling_constraints')
        .select('teacher_id, max_periods_per_day, max_periods_per_week, min_gap_between_periods, max_consecutive_periods')
        .eq('academic_year_id', academicYearId),
      supabase
        .from('timetable_entries')
        .select('id, section_id, subject_id, teacher_id, period_id, day_of_week, room_id, locked')
        .eq('academic_year_id', academicYearId)
        .eq('is_active', true)
        .in('section_id', targetSectionIds),
      getSettings(schoolId, campusId, academicYearId)
    ])

    if (reqErr) throw reqErr
    if (asgErr) throw asgErr
    if (perErr) throw perErr
    if (roomErr) throw roomErr
    if (availErr) throw availErr
    if (consErr) throw consErr
    if (entErr) throw entErr
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error(settingsResult.error || 'Failed to load generation settings')
    }
    const settings = settingsResult.data

    // ── Pre-flight: every explicitly-requested section must have >=1 requirement ──
    if (scope === 'sections') {
      const sectionsWithReq = new Set((requirementsRaw || []).map((r: any) => r.section_id))
      const missing = targetSectionIds.filter((id) => !sectionsWithReq.has(id))
      if (missing.length > 0) {
        await failJob(
          jobId,
          `No requirements defined for section(s): ${missing.join(', ')} — define them on the requirements page before generating.`
        )
        return
      }
    }

    const requirements: TimetableRequirement[] = (requirementsRaw || []) as TimetableRequirement[]
    const lockedEntriesRaw = (entriesRaw || []).filter((e: any) => e.locked)

    const lockedEntries: LockedEntryInfo[] = lockedEntriesRaw.map((e: any) => ({
      section_id: e.section_id,
      subject_id: e.subject_id,
      teacher_id: e.teacher_id,
      day_of_week: e.day_of_week,
      period_id: e.period_id,
      room_id: e.room_id
    }))

    // ── Resolve null-teacher requirements ──────────────────────────────────
    const { resolved: resolvedRequirements, unresolved } = resolveRequirementTeachers(
      requirements,
      (assignmentsRaw || []) as AssignmentLite[]
    )

    // ── Coverage warning (soft — does not block generation) ────────────────
    const periods: SolverPeriod[] = (periodsRaw || []).map((p: any) => ({
      id: p.id,
      period_number: p.period_number,
      sort_order: p.period_number,
      is_break: false
    }))
    const days = await resolveSchoolDays(academicYearId)
    const availableSlotsPerWeek = periods.length * days.length

    const coverageWarnings: Array<{ section_id: string; required: number; available: number }> = []
    const bySection = new Map<string, number>()
    for (const r of resolvedRequirements) {
      bySection.set(r.section_id, (bySection.get(r.section_id) || 0) + r.periods_per_week)
    }
    for (const [sectionId, required] of bySection.entries()) {
      if (availableSlotsPerWeek > 0 && required > availableSlotsPerWeek) {
        coverageWarnings.push({ section_id: sectionId, required, available: availableSlotsPerWeek })
      }
    }

    // ── Build activities / domains / solve ─────────────────────────────────
    const activities = buildActivities(resolvedRequirements, lockedEntries)

    const rooms: SolverRoom[] = (roomsRaw || []).map((r: any) => ({ id: r.id, room_type: r.room_type as RoomType }))
    const roomNameById = new Map<string, string>((roomsRaw || []).map((r: any) => [r.id, r.name]))
    const teacherAvailability: SolverTeacherAvailability[] = (availabilityRaw || []).map((a: any) => ({
      teacher_id: a.teacher_id,
      day_of_week: a.day_of_week,
      period_id: a.period_id,
      status: a.status
    }))

    const teacherConstraints = new Map<string, TeacherConstraintInfo>()
    for (const c of constraintsRaw || []) {
      teacherConstraints.set(c.teacher_id, {
        max_periods_per_day: c.max_periods_per_day,
        max_periods_per_week: c.max_periods_per_week,
        min_gap_between_periods: c.min_gap_between_periods,
        max_consecutive_periods: c.max_consecutive_periods
      })
    }

    const baseContext: SolverContext = {
      periods,
      days,
      teacherAvailability,
      lockedEntries,
      rooms
    }

    const domains = computeDomains(activities, baseContext)

    // Re-check cancellation right before the (blocking, synchronous) solve —
    // see the KNOWN LIMITATION note at the top of this file.
    const { data: preSolveJob } = await supabase
      .from('timetable_generation_jobs')
      .select('cancel_requested')
      .eq('id', jobId)
      .single()
    const cancelledBeforeSolve = !!preSolveJob?.cancel_requested
    const cancelFlagAtSolveTime = cancelledBeforeSolve

    if (cancelledBeforeSolve) {
      await markJob(jobId, {
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        progress_percent: 0,
        total_activities: activities.length,
        placed_activities: 0,
        unplaced_activities: activities.length
      })
      console.log(`[timetable-generation] job ${jobId} cancelled before solve started`)
      return
    }

    const extendedContext: SolverExtendedContext = {
      ...baseContext,
      teacherConstraints,
      cancelRequested: () => cancelFlagAtSolveTime,
      weights: {
        teacher_availability_preferred: settings.weight_teacher_availability_preferred,
        gap_violation: settings.weight_gap_violation,
        daily_load_violation: settings.weight_daily_load_violation,
        double_period_broken: settings.weight_double_period_broken,
        frequency_spread: settings.weight_frequency_spread
      }
    }

    const timeLimitMs = Math.max(1, settings.solver_time_limit_seconds) * 1000

    const result = solve(activities, domains, extendedContext, { timeLimitMs })

    if (result.hard_violations > 0) {
      // Should be structurally impossible by solver construction — log loudly
      // so it's diagnosable, but still proceed (a partial result with logged
      // violations beats discarding a mostly-good solve entirely).
      console.error(
        `[timetable-generation] job ${jobId} solver returned ${result.hard_violations} hard violation(s) — this indicates a solver bug and should be investigated.`
      )
    }

    // ── Map assignments -> timetable_entries rows and apply atomically ─────
    const activityById = new Map(activities.map((a) => [a.id, a]))
    const newEntries = result.assignments.map((asg) => {
      const activity = activityById.get(asg.activity_id)!
      return {
        school_id: schoolId,
        campus_id: campusId,
        academic_year_id: academicYearId,
        section_id: activity.section_id,
        subject_id: activity.subject_id,
        teacher_id: activity.teacher_id,
        period_id: asg.period_id,
        day_of_week: asg.day_of_week,
        room_id: asg.room_id,
        // room_number is a denormalized display field other modules (calendar/schedule
        // view, iCal export, parent/student dashboards) read directly instead of
        // joining `rooms` — keep it in sync with room_id so generated entries show a
        // room there too, not just in the timetable builder.
        room_number: asg.room_id ? roomNameById.get(asg.room_id) ?? null : null,
        locked: false,
        created_by: job.created_by
      }
    })

    const { data: applyResult, error: applyError } = await supabase.rpc('apply_generation_result', {
      p_job_id: jobId,
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
      p_section_ids: targetSectionIds,
      p_new_entries: newEntries
    })

    if (applyError) throw applyError

    const applied = Array.isArray(applyResult) ? applyResult[0] : applyResult

    // Note: true mid-solve cancellation isn't achievable with the current
    // synchronous solver (see KNOWN LIMITATION at the top of this file) — by
    // the time we reach this point, cancellation would already have been
    // caught by the pre-solve check above and returned early. A solve that
    // merely hit its time limit (result.timed_out) still produced a usable
    // best-partial solution and is reported as 'completed', with timed_out
    // surfaced in result_summary for the UI to show.
    const finalStatus = 'completed'

    const resultSummary = {
      unplaced: result.unplaced,
      unresolved_requirements: unresolved,
      coverage_warnings: coverageWarnings,
      timed_out: result.timed_out,
      deactivated_count: applied?.deactivated_count ?? null,
      inserted_count: applied?.inserted_count ?? null,
      known_limitations: [
        'progress_percent is not updated live during the solve (single synchronous CPU-bound call); it jumps from a small value to 100 on completion.',
        'cancellation is only observed before the solve call starts, not mid-search.'
      ]
    }

    await markJob(jobId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
      progress_percent: 100,
      total_activities: activities.length,
      placed_activities: result.assignments.length,
      unplaced_activities: result.unplaced.length,
      hard_violations: result.hard_violations,
      soft_score: result.soft_score,
      result_summary: resultSummary
    })

    const durationMs = Date.now() - startedAt
    console.log(
      `[timetable-generation] job ${jobId} ${finalStatus} in ${durationMs}ms — placed=${result.assignments.length}/${activities.length}, unplaced=${result.unplaced.length}, hard_violations=${result.hard_violations}, soft_score=${result.soft_score}`
    )
  } catch (error: any) {
    console.error(`[timetable-generation] job ${jobId} failed:`, error)
    await failJob(jobId, safeErrorMessage(error))
    const durationMs = Date.now() - startedAt
    console.log(`[timetable-generation] job ${jobId} failed after ${durationMs}ms`)
  }
}

async function markJob(jobId: string, fields: Record<string, any>): Promise<void> {
  const { error } = await supabase
    .from('timetable_generation_jobs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) {
    console.error(`[timetable-generation] failed to update job ${jobId} with`, fields, error)
  }
}

async function failJob(jobId: string, message: string): Promise<void> {
  await markJob(jobId, {
    status: 'failed',
    error_message: message,
    finished_at: new Date().toISOString()
  })
}

/**
 * Distinct day_of_week values already used in timetable_entries for this
 * academic year; falls back to a documented default of Mon-Fri (0-4) if
 * nothing has been scheduled yet (e.g. first-ever generation). Mirrors
 * timetable-requirements.service.ts's getCoverageSummary logic.
 */
async function resolveSchoolDays(academicYearId: string): Promise<number[]> {
  const { data } = await supabase
    .from('timetable_entries')
    .select('day_of_week')
    .eq('academic_year_id', academicYearId)
    .eq('is_active', true)

  const distinct = Array.from(new Set((data || []).map((r: any) => r.day_of_week))) as number[]
  return distinct.length > 0 ? distinct.sort((a, b) => a - b) : [0, 1, 2, 3, 4]
}

// ----------------------------------------------------------------------------
// cancelGeneration
// ----------------------------------------------------------------------------

export const cancelGeneration = async (jobId: string): Promise<ApiResponse<TimetableGenerationJob>> => {
  try {
    const { data: job, error: fetchError } = await supabase
      .from('timetable_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      return { success: false, error: 'Generation job not found' }
    }

    if (!['queued', 'running'].includes(job.status)) {
      return { success: false, error: `Cannot cancel a job with status '${job.status}'` }
    }

    const { data, error } = await supabase
      .from('timetable_generation_jobs')
      .update({ cancel_requested: true, updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .select('*')
      .single()

    if (error) throw error

    return { success: true, data: data as TimetableGenerationJob, message: 'Cancellation requested' }
  } catch (error: any) {
    console.error('Error cancelling generation job:', error)
    return { success: false, error: error.message }
  }
}

// ----------------------------------------------------------------------------
// rollbackGeneration
// ----------------------------------------------------------------------------

export interface RollbackResult {
  rolled_back_count: number
}

export const rollbackGeneration = async (
  jobId: string,
  requestedBy?: string
): Promise<ApiResponse<RollbackResult>> => {
  try {
    const { data: job, error: fetchError } = await supabase
      .from('timetable_generation_jobs')
      .select('id, school_id')
      .eq('id', jobId)
      .single()

    if (fetchError || !job) {
      return { success: false, error: 'Generation job not found' }
    }

    // Soft-delete (is_active=false), matching the codebase's general
    // preference for soft-delete over hard-delete on timetable_entries-like
    // audit-relevant data (see deleteRequirement in
    // timetable-requirements.service.ts). Never touch locked entries.
    const { data, error } = await supabase
      .from('timetable_entries')
      .update({ is_active: false })
      .eq('generated_by_job_id', jobId)
      .eq('locked', false)
      .select('id')

    if (error) throw error

    const rolledBackCount = data?.length || 0

    console.log(
      `[timetable-generation] job ${jobId} rolled back by ${requestedBy || 'unknown'} at ${new Date().toISOString()} — ${rolledBackCount} entr${rolledBackCount === 1 ? 'y' : 'ies'} deactivated`
    )

    // Audit trail: record the rollback in the job's result_summary rather
    // than silently deleting with no trace (plan Phase 4.4 auditability).
    const { data: currentJob } = await supabase
      .from('timetable_generation_jobs')
      .select('result_summary')
      .eq('id', jobId)
      .single()

    await supabase
      .from('timetable_generation_jobs')
      .update({
        result_summary: {
          ...(currentJob?.result_summary || {}),
          rolled_back: {
            at: new Date().toISOString(),
            by: requestedBy || null,
            count: rolledBackCount
          }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)

    return {
      success: true,
      data: { rolled_back_count: rolledBackCount },
      message: `Rolled back ${rolledBackCount} generated timetable entr${rolledBackCount === 1 ? 'y' : 'ies'}`
    }
  } catch (error: any) {
    console.error('Error rolling back generation job:', error)
    return { success: false, error: error.message }
  }
}

// ----------------------------------------------------------------------------
// getJobStatus / listJobs
// ----------------------------------------------------------------------------

export const getJobStatus = async (jobId: string): Promise<ApiResponse<TimetableGenerationJob>> => {
  try {
    const { data, error } = await supabase
      .from('timetable_generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) throw error
    if (!data) return { success: false, error: 'Generation job not found' }

    return { success: true, data: data as TimetableGenerationJob }
  } catch (error: any) {
    console.error('Error fetching generation job status:', error)
    return { success: false, error: error.message }
  }
}

export interface ListJobsPagination {
  page?: number
  limit?: number
}

export const listJobs = async (
  schoolId: string,
  academicYearId: string,
  pagination: ListJobsPagination = {}
): Promise<ApiResponse<TimetableGenerationJob[]>> => {
  try {
    const page = Math.max(1, pagination.page || 1)
    const limit = Math.min(100, Math.max(1, pagination.limit || 20))
    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('timetable_generation_jobs')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return {
      success: true,
      data: (data || []) as TimetableGenerationJob[],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }
    } as ApiResponse<TimetableGenerationJob[]>
  } catch (error: any) {
    console.error('Error listing generation jobs:', error)
    return { success: false, error: error.message }
  }
}

// ----------------------------------------------------------------------------
// Startup reconciliation — called once from app.ts at boot. A job left
// 'running'/'queued' can only mean the process died mid-generation (this
// orchestrator's own try/catch guarantees every normal exit path sets a
// terminal status), so on restart we mark them failed with a clear message
// rather than leaving them stuck forever.
// ----------------------------------------------------------------------------

export const reconcileOrphanedJobs = async (): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('timetable_generation_jobs')
      .update({
        status: 'failed',
        error_message: 'Server restarted during generation',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('status', ['queued', 'running'])
      .select('id')

    if (error) {
      console.error('[timetable-generation] reconcileOrphanedJobs failed:', error)
      return
    }

    if (data && data.length > 0) {
      console.log(`[timetable-generation] reconciled ${data.length} orphaned job(s) from before restart`)
    }
  } catch (error) {
    console.error('[timetable-generation] reconcileOrphanedJobs threw:', error)
  }
}
