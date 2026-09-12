import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qaidaService } from '../../services/qaida/qaida.service';
import { getCurrentAcademicYear } from '../../services/academics.service';
import { applySession, emptyProgress, graduated, type QaidaProgress, type AnsweredItem } from '../../services/qaida/progress-engine';
import { WORLDS } from '../../services/qaida/content';

const STATION_IDS = new Set(WORLDS.flatMap((w) => w.stations.map((s) => s.id)));

/**
 * Grades a finished station/review session server-side and persists the
 * result. Previously a bare stub (`{ graded: true }`, nothing saved) despite
 * progress-engine.ts's applySession() — the actual grading/SRS/badge engine,
 * with its own test suite — already existing and being documented as
 * exactly "the function the API route calls". Every session submitted
 * before this fix was silently discarded: stars, XP, and SRS review
 * scheduling never reached the database, which is also why GET
 * /qaida/progress always came back empty for students who had genuinely
 * played stations.
 */
export const submitSession = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'Missing profile ID' });
    }

    const { stationId, worldId, isReview, seconds, items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing items' });
    }
    // Same check the original module's session route.ts validates client
    // input with (bodySchema + STATION_IDS.has(...)) — reject an unknown
    // station id rather than trusting it, since it's about to be written
    // straight into qaida_sessions/qaida_progress.
    if (!isReview && (!stationId || !STATION_IDS.has(stationId))) {
      return res.status(400).json({ success: false, error: 'Unknown station ID' });
    }

    // Same academic-year resolution as progress.controller.ts — the client
    // never sends one, so resolve the school's current year server-side.
    const schoolId = req.profile?.school_id || req.profile?.campus_id;
    const campusId = req.profile?.campus_id;
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'No school on this profile' });
    }
    const yearRes = await getCurrentAcademicYear(campusId || schoolId);
    const academicYearId = yearRes.success && yearRes.data ? yearRes.data.id : null;
    if (!academicYearId) {
      return res.status(400).json({ success: false, error: 'No current academic year is configured for this school' });
    }

    const existingRow = await qaidaService.getProgress(profileId, academicYearId);
    const progress: QaidaProgress = (existingRow?.state as QaidaProgress) || emptyProgress();
    const wasGraduated = !!existingRow?.graduated;

    // Mutates `progress` in place and returns the per-session outcome — the
    // server computes stars/XP/badges from the raw answers so a client can
    // never forge a result (see the Arabic header comment on applySession).
    const outcome = applySession(
      progress,
      {
        stationId: stationId ?? null,
        items: items as AnsweredItem[],
        seconds: Number(seconds) || 0,
        isReview: !!isReview,
      },
    );

    const starsTotal = Object.values(progress.stations).reduce((sum, s) => sum + s.stars, 0);
    const stationsCompleted = Object.values(progress.stations).filter((s) => s.stars > 0).length;
    const accuracy = progress.stats.answered
      ? Math.round((progress.stats.correct / progress.stats.answered) * 10000) / 100
      : 0;
    const isGraduated = graduated(progress);

    const saved = await qaidaService.saveProgress({
      school_id: schoolId,
      campus_id: campusId,
      academic_year_id: academicYearId,
      profile_id: profileId,
      state: progress,
      xp: progress.xp,
      stations_completed: stationsCompleted,
      stars_total: starsTotal,
      accuracy,
      graduated: isGraduated,
      ...(isGraduated && !wasGraduated ? { graduated_at: new Date().toISOString() } : {}),
    });

    await qaidaService.insertSession({
      school_id: schoolId,
      campus_id: campusId,
      academic_year_id: academicYearId,
      profile_id: profileId,
      world_id: worldId || '',
      station_id: stationId || '',
      is_review: !!isReview,
      seconds: Number(seconds) || 0,
      items,
      accuracy: outcome.pct,
      stars: outcome.stars,
      xp_awarded: outcome.gained,
    });

    return res.json({
      success: true,
      data: { outcome, progress: (saved?.state as QaidaProgress) || progress },
    });
  } catch (error) {
    console.error('Error submitting Qaida session:', error);
    return res.status(500).json({ success: false, error: 'Failed to submit session' });
  }
};
