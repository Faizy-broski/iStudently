import { Router } from 'express';
import { hadithFortyQuizController as ctrl } from '../../controllers/hadith-forty/quiz.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireStudent } from '../../middlewares/role.middleware';
import { requireHadithFortyEnabled } from '../../middlewares/hadith-forty-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireHadithFortyEnabled);
router.post('/start', requireStudent, ctrl.start);
router.post('/submit', requireStudent, ctrl.submit);

export default router;
