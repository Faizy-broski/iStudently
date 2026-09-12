import { Router } from 'express';
import { miqatDevicesController } from '../../controllers/miqat/devices.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

// enrol/bootstrap are deliberately NOT behind `authenticate` — the scanner
// device is not a logged-in platform user. enrol is gated by a single-use
// enrolment code; bootstrap is gated by the device proving possession of its
// own registered private key (see devices.controller.ts comments).
router.post('/enrol', miqatDevicesController.enrol);
router.get('/:id/bootstrap', miqatDevicesController.bootstrap);
router.get('/:id/my-periods', miqatDevicesController.myPeriods);
router.get('/:id/period-roster', miqatDevicesController.periodRoster);

router.use(authenticate);
router.use(requireMiqatEnabled);
router.post('/generate-code', requireAdmin, miqatDevicesController.generateCode);
router.get('/', requireAdmin, miqatDevicesController.list);
router.post('/:id/revoke', requireAdmin, miqatDevicesController.revoke);

export default router;
