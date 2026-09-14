import { Router } from 'express';
import { hadithFortyProgressController as ctrl } from '../../controllers/hadith-forty/progress.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireStudent } from '../../middlewares/role.middleware';
import { requireHadithFortyEnabled } from '../../middlewares/hadith-forty-enabled.middleware';

const router = Router();

router.use(authenticate);
router.use(requireHadithFortyEnabled);
// requireStudent's role set already includes admin/teacher/super_admin —
// matches the delivered canRecordProgress() rule: staff may try the module
// themselves, only parent is excluded.
router.get('/state', requireStudent, ctrl.getState);
router.post('/repetition', requireStudent, ctrl.recordRepetition);
router.post('/review', requireStudent, ctrl.recordReview);
router.post('/flags', requireStudent, ctrl.updateFlags);
router.get('/settings', requireStudent, ctrl.getSettings);
router.post('/settings', requireStudent, ctrl.saveSettings);

export default router;
