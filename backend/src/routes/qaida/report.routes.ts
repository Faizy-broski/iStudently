import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireQaidaEnabled } from '../../middlewares/qaida-enabled.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { getReport } from '../../controllers/qaida/report.controller';

const router = Router();

router.use(authenticate);
router.use(requireQaidaEnabled);
router.use(requireRole('super_admin', 'admin', 'teacher'));

router.get('/', getReport);

export default router;
