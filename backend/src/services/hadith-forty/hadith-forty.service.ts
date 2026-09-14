import { supabase } from '../../config/supabase';
import { emptyProgress } from './progress';
import { DailyActivity, HadithProgress, IsoDate, ModuleSettings, QuizGrade } from './types';

export const DEFAULT_SETTINGS: ModuleSettings = { dailyGoal: 20, sessionCap: 10 };

export interface ScopeContext {
  schoolId: string;
  campusId: string | null;
  academicYearId: string;
}

interface ProgressRow {
  hadith_number: number;
  repetitions: number;
  state: HadithProgress['state'];
  box: number;
  due_on: string | null;
  last_reviewed_on: string | null;
  is_favorite: boolean;
  note: string | null;
}

function toProgress(row: ProgressRow): HadithProgress {
  return {
    hadithNumber: row.hadith_number,
    repetitions: row.repetitions,
    state: row.state,
    box: row.box,
    dueOn: row.due_on,
    lastReviewedOn: row.last_reviewed_on,
    isFavorite: row.is_favorite,
    note: row.note ?? '',
  };
}

function scope(ctx: ScopeContext, profileId: string) {
  return { school_id: ctx.schoolId, campus_id: ctx.campusId, academic_year_id: ctx.academicYearId, profile_id: profileId };
}

const PROGRESS_COLUMNS = 'hadith_number, repetitions, state, box, due_on, last_reviewed_on, is_favorite, note';

export class HadithFortyService {
  async listProgress(ctx: ScopeContext, profileId: string): Promise<HadithProgress[]> {
    const { data, error } = await supabase
      .from('hadith_forty_progress')
      .select(PROGRESS_COLUMNS)
      .match(scope(ctx, profileId))
      .order('hadith_number', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => toProgress(row as unknown as ProgressRow));
  }

  async getProgress(ctx: ScopeContext, profileId: string, hadithNumber: number): Promise<HadithProgress> {
    const { data, error } = await supabase
      .from('hadith_forty_progress')
      .select(PROGRESS_COLUMNS)
      .match({ ...scope(ctx, profileId), hadith_number: hadithNumber })
      .maybeSingle();
    if (error) throw error;
    return data ? toProgress(data as unknown as ProgressRow) : emptyProgress(hadithNumber);
  }

  async upsertProgress(ctx: ScopeContext, profileId: string, progress: HadithProgress): Promise<HadithProgress> {
    const { data, error } = await supabase
      .from('hadith_forty_progress')
      .upsert(
        {
          ...scope(ctx, profileId),
          hadith_number: progress.hadithNumber,
          repetitions: progress.repetitions,
          state: progress.state,
          box: progress.box,
          due_on: progress.dueOn,
          last_reviewed_on: progress.lastReviewedOn,
          is_favorite: progress.isFavorite,
          note: progress.note,
        },
        { onConflict: 'profile_id,academic_year_id,hadith_number' }
      )
      .select(PROGRESS_COLUMNS)
      .single();
    if (error) throw error;
    return toProgress(data as unknown as ProgressRow);
  }

  async listActivity(ctx: ScopeContext, profileId: string, since: IsoDate): Promise<DailyActivity[]> {
    const { data, error } = await supabase
      .from('hadith_forty_activity')
      .select('activity_date, repetitions')
      .match(scope(ctx, profileId))
      .gte('activity_date', since)
      .order('activity_date', { ascending: true });
    if (error) throw error;
    return (data || []).map((row: any) => ({ activityDate: row.activity_date, repetitions: row.repetitions }));
  }

  /** Atomic increment via RPC — avoids a read-then-write race between concurrent repetition taps. */
  async bumpActivity(ctx: ScopeContext, profileId: string, date: IsoDate, delta: number): Promise<number> {
    const { data, error } = await supabase.rpc('hadith_forty_bump_activity', {
      p_school_id: ctx.schoolId,
      p_campus_id: ctx.campusId,
      p_academic_year_id: ctx.academicYearId,
      p_profile_id: profileId,
      p_activity_date: date,
      p_delta: delta,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  }

  async getSettings(ctx: ScopeContext, profileId: string): Promise<ModuleSettings> {
    const { data, error } = await supabase
      .from('hadith_forty_settings')
      .select('daily_goal, session_cap')
      .match(scope(ctx, profileId))
      .maybeSingle();
    if (error) throw error;
    if (!data) return DEFAULT_SETTINGS;
    return { dailyGoal: data.daily_goal ?? DEFAULT_SETTINGS.dailyGoal, sessionCap: data.session_cap ?? DEFAULT_SETTINGS.sessionCap };
  }

  async saveSettings(ctx: ScopeContext, profileId: string, settings: ModuleSettings): Promise<ModuleSettings> {
    const { error } = await supabase
      .from('hadith_forty_settings')
      .upsert(
        { ...scope(ctx, profileId), daily_goal: settings.dailyGoal, session_cap: settings.sessionCap },
        { onConflict: 'profile_id,academic_year_id' }
      );
    if (error) throw error;
    return settings;
  }

  async createAttempt(ctx: ScopeContext, profileId: string, hadithNumber: number, seed: number) {
    const { data, error } = await supabase
      .from('hadith_forty_attempts')
      .insert({ ...scope(ctx, profileId), hadith_number: hadithNumber, seed })
      .select('id, hadith_number, seed, submitted_at')
      .single();
    if (error) throw error;
    return { id: data.id as string, hadithNumber: data.hadith_number as number, seed: data.seed as number, submittedAt: data.submitted_at as string | null };
  }

  async getAttempt(ctx: ScopeContext, profileId: string, attemptId: string) {
    const { data, error } = await supabase
      .from('hadith_forty_attempts')
      .select('id, hadith_number, seed, submitted_at')
      .match({ ...scope(ctx, profileId), id: attemptId })
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id as string, hadithNumber: data.hadith_number as number, seed: data.seed as number, submittedAt: data.submitted_at as string | null };
  }

  /** `submitted_at is null` guard prevents a resubmission from overwriting an already-graded attempt. */
  async finalizeAttempt(ctx: ScopeContext, profileId: string, attemptId: string, answers: readonly number[], grade: QuizGrade): Promise<boolean> {
    const { data, error } = await supabase
      .from('hadith_forty_attempts')
      .update({ answers, score: grade.score, total: grade.total, passed: grade.passed, submitted_at: new Date().toISOString() })
      .match({ ...scope(ctx, profileId), id: attemptId })
      .is('submitted_at', null)
      .select('id');
    if (error) throw error;
    return (data || []).length > 0;
  }

  async listClassProgress(ctx: ScopeContext, today: IsoDate) {
    const { data, error } = await supabase.rpc('hadith_forty_class_summary', {
      p_school_id: ctx.schoolId,
      p_campus_id: ctx.campusId,
      p_academic_year_id: ctx.academicYearId,
      p_today: today,
    });
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      profileId: String(row.profile_id),
      mastered: Number(row.mastered ?? 0),
      learning: Number(row.learning ?? 0),
      totalRepetitions: Number(row.total_repetitions ?? 0),
      dueToday: Number(row.due_today ?? 0),
    }));
  }

  /** Names for the class-summary rows — the RPC only returns profile_id. */
  async listProfileNames(profileIds: string[]): Promise<Map<string, { firstName: string; lastName: string }>> {
    if (profileIds.length === 0) return new Map();
    const { data, error } = await supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds);
    if (error) throw error;
    return new Map((data || []).map((p: any) => [p.id, { firstName: p.first_name, lastName: p.last_name }]));
  }
}

export const hadithFortyService = new HadithFortyService();
