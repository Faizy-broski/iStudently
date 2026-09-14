import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { hadithFortyService, ScopeContext } from '../../services/hadith-forty/hadith-forty.service';
import { getCurrentAcademicYear } from '../../services/academics.service';
import { buildQuiz, createSeed, gradeQuiz, toClientQuiz } from '../../services/hadith-forty/quiz';
import { schedule } from '../../services/hadith-forty/scheduler';
import { SCHOOL_UTC_OFFSET_MINUTES } from '../../services/hadith-forty/content';
import { todayIn } from '../../services/hadith-forty/date';
import { quizSubmitInputSchema } from '../../services/hadith-forty/schemas';
import { z } from 'zod';

// See progress.controller.ts's identical scopeFrom for why this resolves the
// current academic year server-side instead of requiring req.profile.academic_year_id
// (not a field on Profile) or a caller-supplied value (no caller sends one).
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

const startQuizSchema = z.object({ hadithNumber: z.number().int().min(1).max(42) });

class HadithFortyQuizController {
  /** Stores only the seed — the questions themselves are never persisted, so there's nothing gradeable sitting in the DB either. */
  async start(req: AuthRequest, res: Response) {
    try {
      const parsed = startQuizSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'hadithNumber is required' });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });

      const seed = createSeed();
      const attempt = await hadithFortyService.createAttempt(ctx, req.profile.id, parsed.data.hadithNumber, seed);
      res.status(201).json({
        success: true,
        data: {
          attemptId: attempt.id,
          hadithNumber: parsed.data.hadithNumber,
          questions: toClientQuiz(buildQuiz(parsed.data.hadithNumber, seed)),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Grading happens entirely here: the stored seed regenerates the exact
   * same questions, which are compared against the client's option indexes.
   * The client can never submit a score directly — quizSubmitInputSchema
   * only accepts attemptId + answers, and zod silently drops anything else.
   */
  async submit(req: AuthRequest, res: Response) {
    try {
      const parsed = quizSubmitInputSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid input', details: parsed.error.flatten() });
      const ctx = await scopeFrom(req);
      if (!ctx) return res.status(400).json({ success: false, error: 'Missing academic year context' });
      const profileId = req.profile.id;

      const attempt = await hadithFortyService.getAttempt(ctx, profileId, parsed.data.attemptId);
      if (!attempt) return res.status(404).json({ success: false, error: 'attempt_not_found' });
      if (attempt.submittedAt !== null) return res.status(409).json({ success: false, error: 'already_submitted' });

      const questions = buildQuiz(attempt.hadithNumber, attempt.seed);
      if (parsed.data.answers.length !== questions.length) {
        return res.status(400).json({ success: false, error: 'answer_count_mismatch' });
      }
      const grade = gradeQuiz(questions, parsed.data.answers);

      const claimed = await hadithFortyService.finalizeAttempt(ctx, profileId, parsed.data.attemptId, parsed.data.answers, grade);
      if (!claimed) return res.status(409).json({ success: false, error: 'already_submitted' });

      // A quiz pass/fail feeds the same spaced-repetition schedule as a
      // manual review — the quiz IS a review, just a server-graded one.
      const day = todayIn(SCHOOL_UTC_OFFSET_MINUTES);
      const current = await hadithFortyService.getProgress(ctx, profileId, attempt.hadithNumber);
      const result = schedule(current.box, grade.passed ? 'pass' : 'fail', day);
      const progress = await hadithFortyService.upsertProgress(ctx, profileId, {
        ...current,
        box: result.box,
        dueOn: result.dueOn,
        lastReviewedOn: result.lastReviewedOn,
        state: grade.passed ? 'mastered' : 'learning',
      });
      await hadithFortyService.bumpActivity(ctx, profileId, day, 1);

      res.json({ success: true, data: { grade, progress } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const hadithFortyQuizController = new HadithFortyQuizController();
