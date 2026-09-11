import { Router } from 'express';
import { miqatCardsController } from '../../controllers/miqat/cards.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireMiqatEnabled);
router.post('/issue', requireAdmin, miqatCardsController.issue);
router.post('/report-lost', requireAdmin, miqatCardsController.reportLost);

export default router;
