import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { weatherAlertService, type AlertStatus } from '../../services/weather/weather-alert.service';

const STATUSES: AlertStatus[] = ['draft', 'approved', 'sent', 'rejected', 'expired'];

function resolveCampusId(req: AuthRequest): string | undefined {
  return (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id;
}

class WeatherAlertsController {
  async list(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const campusId = resolveCampusId(req);
      const statusParam = req.query.status as string | undefined;
      const status = statusParam && STATUSES.includes(statusParam as AlertStatus) ? (statusParam as AlertStatus) : undefined;
      const data = await weatherAlertService.listAlerts(schoolId, campusId ?? null, status);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async approve(req: AuthRequest, res: Response) {
    try {
      const reviewerProfileId = req.profile?.id;
      if (!reviewerProfileId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const alert = await weatherAlertService.approveAndSend(req.params.id, reviewerProfileId);
      res.json({ success: true, data: alert });
    } catch (error: any) {
      const status = error.message === 'Alert not found' ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  async reject(req: AuthRequest, res: Response) {
    try {
      const reviewerProfileId = req.profile?.id;
      if (!reviewerProfileId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const parsed = z.object({ reason: z.string().trim().min(1).max(500) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ success: false, error: 'A rejection reason is required' });
      const alert = await weatherAlertService.reject(req.params.id, reviewerProfileId, parsed.data.reason);
      res.json({ success: true, data: alert });
    } catch (error: any) {
      const status = error.message === 'Alert not found' ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  }

  /** Current conditions + short forecast for the dashboard widget — any authenticated role. */
  async widget(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const campusId = resolveCampusId(req);
      const [weather, activeAlerts] = await Promise.all([
        weatherAlertService.getWidgetData(schoolId, campusId),
        weatherAlertService.listAlerts(schoolId, campusId ?? null, 'sent'),
      ]);
      const now = Date.now();
      const stillActive = activeAlerts.filter((a) => !a.expires || new Date(a.expires).getTime() > now);
      res.json({ success: true, data: { weather, activeAlert: stillActive[0] ?? null } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const weatherAlertsController = new WeatherAlertsController();
