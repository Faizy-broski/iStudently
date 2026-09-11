import { Router } from 'express';
import { miqatPermissionsController } from '../../controllers/miqat/permissions.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireMiqatEnabled);
router.post('/', miqatPermissionsController.create);
router.patch('/:id', requireAdmin, miqatPermissionsController.decide);

export default router;
