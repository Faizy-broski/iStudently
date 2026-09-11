import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { qaidaService } from '../../services/qaida/qaida.service';

export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id;
    const academicYearId = req.headers['x-academic-year-id'] as string || req.query.academic_year_id as string;

    if (!profileId || !academicYearId) {
      return res.status(400).json({ success: false, error: 'Missing profile ID or academic year ID' });
    }

    const progress = await qaidaService.getProgress(profileId, academicYearId);
    
    // If no progress, return empty state for frontend to initialize
    return res.json({ 
      success: true, 
      data: progress || {
        state: {},
        xp: 0,
        stations_completed: 0,
        stars_total: 0,
        accuracy: 0,
        graduated: false
      }
    });
  } catch (error) {
    console.error('Error fetching Qaida progress:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
};
