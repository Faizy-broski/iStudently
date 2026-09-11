import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireQaidaEnabled } from '../../middlewares/qaida-enabled.middleware';
import { submitSession } from '../../controllers/qaida/session.controller';

const router = Router();

router.use(authenticate);
router.use(requireQaidaEnabled);

router.post('/', submitSession);

export default router;
