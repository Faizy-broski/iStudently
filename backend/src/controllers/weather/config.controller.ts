import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { weatherConfigService } from '../../services/weather/weather-config.service';
import { weatherAlertService } from '../../services/weather/weather-alert.service';
import { testConnection as weatherApiTestConnection } from '../../services/weather/weatherapi-client';

const upsertSchema = z.object({
  severity_threshold: z.enum(['minor', 'moderate', 'severe', 'extreme']).optional(),
  location_query_override: z.string().trim().max(200).nullable().optional(),
});

function resolveCampusId(req: AuthRequest): string | undefined {
  return (req.query.campus_id as string | undefined) || req.body?.campus_id || req.profile?.campus_id;
}

class WeatherConfigController {
  async get(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const campusId = resolveCampusId(req);
      const cfg = await weatherConfigService.getEffectiveConfig(schoolId, campusId);
      res.json({ success: true, data: cfg });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async upsert(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const parsed = upsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Invalid config', details: parsed.error.flatten() });
      }
      const campusId = resolveCampusId(req);
      const saved = await weatherConfigService.upsertConfig({ school_id: schoolId, campus_id: campusId ?? null, ...parsed.data });
      res.json({ success: true, data: saved });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /** Resolves the school's location and makes one live weatherapi.com call — never returns the key. */
  async testConnection(req: AuthRequest, res: Response) {
    try {
      const schoolId = req.profile?.school_id;
      if (!schoolId) return res.status(400).json({ success: false, error: 'Unauthorized' });
      const campusId = resolveCampusId(req);
      const query = await weatherAlertService.resolveLocationQuery(schoolId, campusId);
      const result = await weatherApiTestConnection(query);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const weatherConfigController = new WeatherConfigController();
