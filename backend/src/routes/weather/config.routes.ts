import { Router } from 'express';
import { weatherConfigController } from '../../controllers/weather/config.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';

const router = Router();

router.use(authenticate);
// Admin-only, no requireWeatherAlertsEnabled gate — same as miqat/schools.routes.ts:
// configuration must be reachable before the plugin is even turned on.
router.get('/', requireAdmin, weatherConfigController.get);
router.put('/', requireAdmin, weatherConfigController.upsert);
router.post('/test', requireAdmin, weatherConfigController.testConnection);

export default router;
