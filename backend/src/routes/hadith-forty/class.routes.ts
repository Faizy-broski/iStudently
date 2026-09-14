import { Router } from 'express';
import { hadithFortyClassController as ctrl } from '../../controllers/hadith-forty/class.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireTeacher } from '../../middlewares/role.middleware';
import { requireHadithFortyEnabled } from '../../middlewares/hadith-forty-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireHadithFortyEnabled);
router.get('/summary', requireTeacher, ctrl.summary);

export default router;
