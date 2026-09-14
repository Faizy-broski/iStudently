import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { HADITHS, HADITH_CATEGORIES, NARRATORS } from '../../services/hadith-forty/content';

/**
 * The 42 hadith themselves (matn, narrator, source, category) — safe,
 * non-gradeable, static content. Separate from quiz.controller.ts, which is
 * the ONLY place answer-bearing data is handled; this endpoint never touches
 * quiz questions/answers at all.
 */
class HadithFortyContentController {
  async list(_req: AuthRequest, res: Response) {
    res.json({ success: true, data: { hadiths: HADITHS, narrators: NARRATORS, categories: HADITH_CATEGORIES } });
  }
}

export const hadithFortyContentController = new HadithFortyContentController();
