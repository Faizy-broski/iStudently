import { Router } from 'express';
import { miqatSchoolsController } from '../../controllers/miqat/schools.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';

const router = Router();

router.use(authenticate);
router.get('/', requireAdmin, miqatSchoolsController.get);
router.put('/', requireAdmin, miqatSchoolsController.upsert);

export default router;
