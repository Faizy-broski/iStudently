import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qaidaService } from '../../services/qaida/qaida.service';

export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id;
    const campusId = req.query.campus_id as string;
    const academicYearId = req.headers['x-academic-year-id'] as string || req.query.academic_year_id as string;

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
