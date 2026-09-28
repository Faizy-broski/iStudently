import { Router } from 'express';
import { weatherAlertsController } from '../../controllers/weather/alerts.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';
import { requireWeatherAlertsEnabled } from '../../middlewares/weather-alerts-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireWeatherAlertsEnabled);

// Any authenticated role at a school with the module enabled — the dashboard widget.
router.get('/widget', weatherAlertsController.widget);

// Reviewing/approving drafts is admin-only.
router.get('/', requireAdmin, weatherAlertsController.list);
router.post('/:id/approve', requireAdmin, weatherAlertsController.approve);
router.post('/:id/reject', requireAdmin, weatherAlertsController.reject);

export default router;
