import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qaidaService } from '../../services/qaida/qaida.service';
import { getCurrentAcademicYear } from '../../services/academics.service';

export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id;
    const campusId = req.query.campus_id as string;

    // Same fix as progress.controller.ts — no caller actually sends
    // x-academic-year-id/?academic_year_id, so resolve the school's current
    // academic year server-side instead of requiring the client supply one.
    let academicYearId = req.headers['x-academic-year-id'] as string || req.query.academic_year_id as string;
    if (!academicYearId && schoolId) {
      const yearRes = await getCurrentAcademicYear(campusId || schoolId);
      if (yearRes.success && yearRes.data) academicYearId = yearRes.data.id;
    }

    if (!schoolId || !academicYearId) {
      return res.status(400).json({ success: false, error: 'Missing school ID or academic year ID' });
    }

    const data = await qaidaService.listClassProgress(schoolId, campusId, academicYearId);
    
    return res.json({ 
      success: true, 
      data 
    });
  } catch (error) {
    console.error('Error fetching Qaida report:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch report' });
  }
};
