import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { hadithFortyService, ScopeContext } from '../../services/hadith-forty/hadith-forty.service';
import { getCurrentAcademicYear } from '../../services/academics.service';
import { SCHOOL_UTC_OFFSET_MINUTES } from '../../services/hadith-forty/content';
import { addDays, todayIn } from '../../services/hadith-forty/date';
import { activityWindow, computeStats, computeStreak } from '../../services/hadith-forty/progress';
import { buildSession, schedule } from '../../services/hadith-forty/scheduler';
import { repetitionInputSchema, reviewInputSchema, flagsInputSchema, settingsInputSchema } from '../../services/hadith-forty/schemas';

const ACTIVITY_WINDOW_DAYS = 7;

function today(): string {
  return todayIn(SCHOOL_UTC_OFFSET_MINUTES);
}

// Profiles don't carry an academic_year_id field (that's a per-enrollment
// concept, not a profile one), and no frontend caller ever sends
// ?academic_year_id/x-academic-year-id — the same gap already hit and fixed
// for Qaida's progress controller. Resolve the school's current academic
// year server-side as the ambient default; an explicit header/query value
// still wins if some future caller sends one.
async function scopeFrom(req: AuthRequest): Promise<ScopeContext | null> {
  const schoolId = req.profile?.school_id;
  if (!schoolId) return null;

  let academicYearId = (req.headers['x-academic-year-id'] as string | undefined) || (req.query.academic_year_id as string | undefined) || (req.body?.academic_year_id as string | undefined);
  if (!academicYearId) {
    const yearRes = await getCurrentAcademicYear(schoolId);
    if (yearRes.success && yearRes.data) academicYearId = yearRes.data.id;
  }
  if (!academicYearId) return null;

  const campusId = (req.query.campus_id as string | undefined) || (req.body?.campus_id as string | undefined) || req.profile?.campus_id || null;
  return { schoolId, campusId, academicYearId };
}

/**
 * Every write below follows the delivered design exactly: the client sends
 * only "what happened" (a repetition tap, a review outcome, a flag toggle),
 * and every number that matters — the new repetition count, the next box,
 * the next due date — is computed here, server-side, from the current
 * stored state. Nothing gradeable or state-changing is ever trusted from
 * the request body directly.
 */
class HadithFortyProgressController {
  async getState(req: AuthRequest, res: Response) {
    try {
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;
      const day = today();

      const [progress, settings, activity] = await Promise.all([
        hadithFortyService.listProgress(ctx, profileId),
        hadithFortyService.getSettings(ctx, profileId),
        hadithFortyService.listActivity(ctx, profileId, addDays(day, -(ACTIVITY_WINDOW_DAYS * 8))),
      ]);

      res.json({
        success: true,
        data: {
          progress,
          settings,
          stats: computeStats(progress, day),
          activity: activityWindow(activity, day, ACTIVITY_WINDOW_DAYS, settings.dailyGoal),
          streak: computeStreak(activity, day),
          session: buildSession(progress, day, settings.sessionCap),
          today: day,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async recordRepetition(req: AuthRequest, res: Response) {
    try {
      const parsed = repetitionInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;

      const current = await hadithFortyService.getProgress(ctx, profileId, parsed.data.hadithNumber);
      const next = {
        ...current,
        repetitions: current.repetitions + parsed.data.delta,
        state: current.state === 'new' ? ('learning' as const) : current.state,
      };
      const saved = await hadithFortyService.upsertProgress(ctx, profileId, next);
      await hadithFortyService.bumpActivity(ctx, profileId, today(), parsed.data.delta);
      res.json({ success: true, data: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async recordReview(req: AuthRequest, res: Response) {
    try {
      const parsed = reviewInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;
      const day = today();

      const current = await hadithFortyService.getProgress(ctx, profileId, parsed.data.hadithNumber);
      const result = schedule(current.box, parsed.data.outcome, day);
      const saved = await hadithFortyService.upsertProgress(ctx, profileId, {
        ...current,
        box: result.box,
        dueOn: result.dueOn,
        lastReviewedOn: result.lastReviewedOn,
        state: parsed.data.outcome === 'pass' ? 'mastered' : 'learning',
      });
      await hadithFortyService.bumpActivity(ctx, profileId, day, 1);
      res.json({ success: true, data: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async updateFlags(req: AuthRequest, res: Response) {
    try {
      const parsed = flagsInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;
      const day = today();

      const current = await hadithFortyService.getProgress(ctx, profileId, parsed.data.hadithNumber);
      // Manually flagging a hadith "mastered" (without having gone through a
      // review) still needs a real schedule so it re-enters spaced review
      // later instead of being stuck with dueOn: null forever.
      const becameMastered = parsed.data.state === 'mastered' && current.dueOn === null;
      const scheduled = becameMastered ? schedule(current.box, 'pass', day) : null;

      const saved = await hadithFortyService.upsertProgress(ctx, profileId, {
        ...current,
        isFavorite: parsed.data.isFavorite ?? current.isFavorite,
        state: parsed.data.state ?? current.state,
        note: parsed.data.note ?? current.note,
        box: scheduled?.box ?? current.box,
        dueOn: scheduled?.dueOn ?? current.dueOn,
        lastReviewedOn: scheduled?.lastReviewedOn ?? current.lastReviewedOn,
      });
      res.json({ success: true, data: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getSettings(req: AuthRequest, res: Response) {
    try {
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const settings = await hadithFortyService.getSettings(ctx, req.profile.id);
      res.json({ success: true, data: settings });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async saveSettings(req: AuthRequest, res: Response) {
    try {
      const parsed = settingsInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;

      const current = await hadithFortyService.getSettings(ctx, profileId);
      const saved = await hadithFortyService.saveSettings(ctx, profileId, {
        dailyGoal: parsed.data.dailyGoal ?? current.dailyGoal,
        sessionCap: parsed.data.sessionCap ?? current.sessionCap,
      });
      res.json({ success: true, data: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const hadithFortyProgressController = new HadithFortyProgressController();
