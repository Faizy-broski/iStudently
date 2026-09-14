import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { hadithFortyService, ScopeContext } from '../../services/hadith-forty/hadith-forty.service';
import { getCurrentAcademicYear } from '../../services/academics.service';
import { SCHOOL_UTC_OFFSET_MINUTES } from '../../services/hadith-forty/content';
import { todayIn } from '../../services/hadith-forty/date';

/**
 * The one thing the original delivery explicitly left unbuilt — its own
 * README says listClassProgress/hadith_forty_class_summary were ready in the
 * data layer with no UI on top. Built here in full: teacher/admin roster
 * view (mastered/learning/total-repetitions/due-today per student).
 */
class HadithFortyClassController {
  async summary(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'school_id is required' });
      }

      // See progress.controller.ts's scopeFrom for why this resolves the
      // current academic year server-side rather than requiring the caller
      // (the frontend never sends one) or req.profile.academic_year_id
      // (not a field on Profile).
      let academicYearId = (req.headers['x-academic-year-id'] as string | undefined) || (req.query.academic_year_id as string | undefined);
      if (!academicYearId) {
        const yearRes = await getCurrentAcademicYear(schoolId);
        if (yearRes.success && yearRes.data) academicYearId = yearRes.data.id;
      }
      if (!academicYearId) {
        return res.status(400).json({ success: false, error: 'No current academic year is configured for this school' });
      }

      const ctx: ScopeContext = { schoolId, campusId: (req.query.campus_id as string) || req.profile?.campus_id || null, academicYearId };

      const rows = await hadithFortyService.listClassProgress(ctx, todayIn(SCHOOL_UTC_OFFSET_MINUTES));
      const names = await hadithFortyService.listProfileNames(rows.map((r) => r.profileId));

      res.json({
        success: true,
        data: rows.map((r) => ({
          ...r,
          firstName: names.get(r.profileId)?.firstName ?? '',
          lastName: names.get(r.profileId)?.lastName ?? '',
        })),
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export const hadithFortyClassController = new HadithFortyClassController();
