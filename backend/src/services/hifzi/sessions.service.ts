import { supabase } from '../../config/supabase'
import { computeRawScore, resolveGradeCode, ErrorTally } from './grading-engine.service'
import { applySm2, scoreToQuality, UnitState as Sm2UnitState } from './srs-engine.service'
import { hifziSettingsService } from './settings.service'
import { hifziMilestonesService } from './milestones.service'

// ============================================================================
// The recitation core write path (spec §8.5 / §6.5). hifzi_sessions is
// APPEND-ONLY: corrections insert a new row and set superseded_by_id on the
// old one — never UPDATE a saved session's scoring fields. All reads filter
// WHERE superseded_by_id IS NULL, which every query below does.
//
// idempotencyKey is the double-submit guard for the fast-online recitation
// screen's autosave (spec §6): a debounced re-POST with the same key
// upserts rather than creating a duplicate row.
// ============================================================================

export interface SessionErrorInput {
  ayahId: string
  wordIndex?: number
  errorType: string
  severity?: 'major' | 'minor'
}

export interface CreateSessionDTO {
  studentId: string
  circleId?: string | null
  teacherProfileId: string
  sessionType: 'new' | 'near_review' | 'far_review' | 'consolidation' | 'continuous' | 'tajweed' | 'exam'
  source?: 'in_person' | 'remote_voice' | 'group' | 'imported'
  startAyahId: string
  endAyahId: string
  errors: SessionErrorInput[]
  overrideScore?: number | null
  overrideReason?: string | null
  idempotencyKey: string
  startedAt?: string
  endedAt?: string
  audioStorageKey?: string | null
  voiceNoteStorageKey?: string | null
}

const DEFAULT_ERROR_TYPE_SEVERITY: Record<string, 'major' | 'minor'> = {
  major: 'major',
  skipped_ayah: 'major',
  prompt: 'major',
  similar_jump: 'major',
  minor: 'minor',
  skipped_word: 'minor',
  substituted: 'minor',
  added: 'minor',
  hesitation: 'minor',
  repetition: 'minor',
  bad_waqf: 'minor',
  performance: 'minor',
}

class HifziSessionsService {
  async createSession(dto: CreateSessionDTO, schoolId: string, campusId?: string | null) {
    // 1. Idempotency — a debounced re-POST of the same in-progress recitation
    //    returns the existing row instead of creating a duplicate.
    const { data: existing } = await supabase
      .from('hifzi_sessions')
      .select('*, hifzi_session_errors(*)')
      .eq('idempotency_key', dto.idempotencyKey)
      .maybeSingle()
    if (existing) return existing

    if (dto.overrideScore != null && !dto.overrideReason?.trim()) {
      throw new Error('An overridden score requires a non-empty override reason')
    }

    const settings = await hifziSettingsService.getEffectiveSettings(schoolId, campusId)

    // 2. Compute score via GradingEngine, using this school's configured weights/bands.
    const tallies: ErrorTally[] = Object.entries(
      dto.errors.reduce<Record<string, number>>((acc, e) => {
        acc[e.errorType] = (acc[e.errorType] ?? 0) + 1
        return acc
      }, {})
    ).map(([errorType, count]) => ({ errorType, count }))

    const rawScore = computeRawScore(tallies, settings.gradingWeights)
    const finalScore = dto.overrideScore ?? rawScore
    const gradeCode = resolveGradeCode(finalScore, settings.gradeBands)

    // 3. Insert the session row.
    const { data: session, error: sessionError } = await supabase
      .from('hifzi_sessions')
      .insert({
        school_id: schoolId,
        student_id: dto.studentId,
        circle_id: dto.circleId ?? null,
        teacher_profile_id: dto.teacherProfileId,
        session_type: dto.sessionType,
        source: dto.source ?? 'in_person',
        start_ayah_id: dto.startAyahId,
        end_ayah_id: dto.endAyahId,
        raw_score: finalScore,
        grade_code: gradeCode,
        overridden: dto.overrideScore != null,
        override_reason: dto.overrideReason ?? null,
        started_at: dto.startedAt ?? null,
        ended_at: dto.endedAt ?? new Date().toISOString(),
        audio_storage_key: dto.audioStorageKey ?? null,
        voice_note_storage_key: dto.voiceNoteStorageKey ?? null,
        idempotency_key: dto.idempotencyKey,
      })
      .select()
      .single()

    if (sessionError) throw new Error(`Failed to save recitation session: ${sessionError.message}`)

    // 4. Insert error rows.
    if (dto.errors.length > 0) {
      const { error: errorsError } = await supabase.from('hifzi_session_errors').insert(
        dto.errors.map((e) => ({
          session_id: session.id,
          ayah_id: e.ayahId,
          word_index: e.wordIndex ?? null,
          error_type: e.errorType,
          severity: e.severity ?? DEFAULT_ERROR_TYPE_SEVERITY[e.errorType] ?? 'minor',
        }))
      )
      if (errorsError) console.error('Failed to save session errors (session itself was saved):', errorsError)
    }

    // 5. Update SRS state for the recited range — best-effort: a failure here
    //    must not undo the already-saved session (the teacher's work is not lost).
    let wasNewlyMemorized = false
    try {
      wasNewlyMemorized = await this.updateUnitStateForRange(dto.studentId, dto.startAyahId, dto.endAyahId, finalScore, settings)
    } catch (err) {
      console.error('Failed to update SRS unit state after session save:', err)
    }

    // 6. Ministerial Decree 1205 compliance: check for a newly-completed
    //    structural unit or syllabus-grade milestone — only on an actual
    //    first-time memorization, never a review. Best-effort, same
    //    fail-open reasoning as step 5 (see milestones.service.ts).
    if (wasNewlyMemorized) {
      try {
        await hifziMilestonesService.checkAndRecordMilestones(dto.studentId, schoolId, { startAyahId: dto.startAyahId, endAyahId: dto.endAyahId })
      } catch (err) {
        console.error('Failed to check Hifzi milestones after session save:', err)
      }
    }

    return session
  }

  /** Marks `sessionId` as superseded by a newly-inserted correcting session. Never mutates the original row's scoring fields. */
  async correctSession(sessionId: string, dto: Omit<CreateSessionDTO, 'idempotencyKey'> & { idempotencyKey: string }, schoolId: string, campusId?: string | null) {
    const { data: original, error: fetchError } = await supabase.from('hifzi_sessions').select('id').eq('id', sessionId).single()
    if (fetchError || !original) throw new Error('Original session not found')

    const corrected = await this.createSession(dto, schoolId, campusId)

    const { error } = await supabase.from('hifzi_sessions').update({ superseded_by_id: corrected.id }).eq('id', sessionId)
    if (error) throw new Error(`Failed to mark original session as superseded: ${error.message}`)

    return corrected
  }

  async getSession(sessionId: string) {
    const { data, error } = await supabase.from('hifzi_sessions').select('*, hifzi_session_errors(*)').eq('id', sessionId).single()
    if (error) throw new Error(`Session not found: ${error.message}`)
    return data
  }

  async getSessionsForStudent(studentId: string, limit = 50) {
    const { data, error } = await supabase
      .from('hifzi_sessions')
      .select('*, hifzi_session_errors(*)')
      .eq('student_id', studentId)
      .is('superseded_by_id', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(`Failed to fetch sessions: ${error.message}`)
    return data || []
  }

  /**
   * DB-facing wrapper around srs-engine.service.ts's pure applySm2 — reads
   * (or lazily creates) the hifzi_unit_states row for this exact ayah range,
   * applies the SM-2 update, and persists it. A session's range is treated
   * as one SRS unit keyed by (student, start_ayah, end_ayah) — a session
   * spanning a different range than any prior review creates a new unit.
   */
  /** Returns true iff this call is the moment the unit's first_memorized_at transitioned from unset to set — i.e. this is a first-time memorization, not a review — the signal milestones.service.ts's cascade check is gated on. */
  private async updateUnitStateForRange(studentId: string, startAyahId: string, endAyahId: string, rawScore: number, settings: Awaited<ReturnType<typeof hifziSettingsService.getEffectiveSettings>>): Promise<boolean> {
    // Independent reads — neither depends on the other's result — run concurrently
    // instead of sequentially to save one round trip off this write path.
    const [hasSimilar, existingResult] = await Promise.all([
      this.rangeHasSimilarPassage(startAyahId),
      supabase
        .from('hifzi_unit_states')
        .select('*')
        .eq('student_id', studentId)
        .eq('start_ayah_id', startAyahId)
        .eq('end_ayah_id', endAyahId)
        .maybeSingle(),
    ])
    const { data: existing } = existingResult

    const now = new Date()
    const state: Sm2UnitState = existing
      ? {
          easeFactor: Number(existing.ease_factor),
          repetitions: existing.repetitions,
          intervalDays: existing.interval_days,
          lapseCount: existing.lapse_count,
          hasSimilar,
          difficultyFactor: Number(existing.difficulty_factor),
          firstMemorizedAt: existing.first_memorized_at ? new Date(existing.first_memorized_at) : null,
        }
      : { easeFactor: 2.5, repetitions: 0, intervalDays: 1, lapseCount: 0, hasSimilar, difficultyFactor: 1.0, firstMemorizedAt: now }

    const quality = scoreToQuality(rawScore)
    const result = applySm2(
      state,
      quality,
      {
        similarityFactor: settings.srsSimilarityFactor,
        reviewIntensity: settings.srsReviewIntensity,
        recencyFactor: settings.srsRecencyFactor,
        maxIntervalDays: settings.srsMaxIntervalDays,
      },
      now
    )

    const payload = {
      student_id: studentId,
      start_ayah_id: startAyahId,
      end_ayah_id: endAyahId,
      ease_factor: result.easeFactor,
      repetitions: result.repetitions,
      interval_days: result.intervalDays,
      lapse_count: result.lapseCount,
      has_similar: hasSimilar,
      last_reviewed_at: result.lastReviewedAt.toISOString(),
      due_at: result.dueAt.toISOString().slice(0, 10),
      first_memorized_at: existing?.first_memorized_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    }

    const { error } = await supabase.from('hifzi_unit_states').upsert(payload, { onConflict: 'student_id,start_ayah_id,end_ayah_id' })
    if (error) throw new Error(`Failed to persist SRS unit state: ${error.message}`)

    return !existing?.first_memorized_at
  }

  private async rangeHasSimilarPassage(startAyahId: string): Promise<boolean> {
    // No separate ayah-existence check: startAyahId is FK-constrained onto
    // quran_ayahs by the hifzi_unit_states table itself, so it's guaranteed
    // to exist — that lookup was a redundant round trip on every save.
    const { count } = await supabase.from('quran_similar_members').select('id', { count: 'exact', head: true }).eq('ayah_id', startAyahId)
    return (count ?? 0) > 0
  }
}

export const hifziSessionsService = new HifziSessionsService()
