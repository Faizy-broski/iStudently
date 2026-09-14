import { Router } from 'express';
import { hadithFortyContentController as ctrl } from '../../controllers/hadith-forty/content.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireHadithFortyEnabled } from '../../middlewares/hadith-forty-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireHadithFortyEnabled);
router.get('/', ctrl.list);

export default router;
