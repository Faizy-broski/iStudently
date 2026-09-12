import { Router } from 'express';
import { miqatReportsController } from '../../controllers/miqat/reports.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin, requireTeacher } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireMiqatEnabled);
router.get('/timesheet', requireAdmin, miqatReportsController.timesheet);
router.get('/ministry', requireAdmin, miqatReportsController.ministry);
router.get('/flags', requireTeacher, miqatReportsController.listFlags);
router.post('/flags/:id/acknowledge', requireTeacher, miqatReportsController.acknowledgeFlag);

export default router;
