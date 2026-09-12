import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qaidaService } from '../../services/qaida/qaida.service';
import { getCurrentAcademicYear } from '../../services/academics.service';
import { emptyProgress } from '../../services/qaida/progress-engine';

export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'Missing profile ID' });
    }

    // No caller (useQaidaProgress.ts included) ever actually sends
    // x-academic-year-id or ?academic_year_id — this always fell through to
    // the 400 below, which is what made the widget permanently show "Could
    // not load your progress." Resolve the school's current academic year
    // server-side instead, same as the rest of the app treats it (an
    // ambient default, not something every caller must supply); an explicit
    // header/query value — if some future caller does send one — still wins.
    let academicYearId = req.headers['x-academic-year-id'] as string || req.query.academic_year_id as string;
    if (!academicYearId) {
      const schoolId = req.profile?.campus_id || req.profile?.school_id;
      if (schoolId) {
        const yearRes = await getCurrentAcademicYear(schoolId);
        if (yearRes.success && yearRes.data) academicYearId = yearRes.data.id;
      }
    }

    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'No current academic year is configured for this school' });
    }

    const row = await qaidaService.getProgress(profileId, academicYearId);

    // `data` must be a QaidaProgress (xp/streak/stats/badges/stations/mastery/
    // srs) — that's the shape lib/qaida/progress.ts's dueItems()/recordAnswer()
    // etc. operate on directly, and what useQaidaProgress.ts hands them
    // as-is. The DB row itself is a flatter wrapper (school_id, xp,
    // stations_completed, stars_total, accuracy, graduated, ...) with the
    // actual engine state nested under `state` — returning the raw row (or a
    // fallback shaped like the row instead of like `state`) left `.srs`,
    // `.streak`, `.stations` etc. undefined, which is what crashed dueItems()
    // with "Cannot convert undefined or null to object" for every
    // brand-new/no-progress-yet student.
    return res.json({
      success: true,
      data: (row?.state as ReturnType<typeof emptyProgress>) || emptyProgress(),
    });
  } catch (error) {
    console.error('Error fetching Qaida progress:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
};
