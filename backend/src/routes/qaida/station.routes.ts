import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireQaidaEnabled } from '../../middlewares/qaida-enabled.middleware';
import { generateStation } from '../../controllers/qaida/station.controller';

const router = Router();

router.use(authenticate);
router.use(requireQaidaEnabled);

router.get('/:stationId', generateStation);

export default router;
