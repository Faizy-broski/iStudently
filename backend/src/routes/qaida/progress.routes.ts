import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireQaidaEnabled } from '../../middlewares/qaida-enabled.middleware';
import { getProgress } from '../../controllers/qaida/progress.controller';

const router = Router();

router.use(authenticate);
router.use(requireQaidaEnabled);

router.get('/', getProgress);

export default router;
