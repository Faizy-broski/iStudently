import { Router } from 'express';
import { miqatStaffCodeController } from '../../controllers/miqat/staff-code.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireStaff } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireMiqatEnabled);
router.get('/mine', requireStaff, miqatStaffCodeController.mine);
router.post('/verify', requireStaff, miqatStaffCodeController.verify);

export default router;
