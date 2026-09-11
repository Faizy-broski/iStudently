import { Router } from 'express';
import multer from 'multer';
import { miqatAttendanceController } from '../../controllers/miqat/attendance.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireAdmin, requireTeacher } from '../../middlewares/role.middleware';
import { requireMiqatEnabled } from '../../middlewares/miqat-enabled.middleware';

const router = Router();

// Memory storage, streamed to Supabase Storage — matches vault/media.routes.ts's
// convention. Photos are downscaled client-side to <40KB (spec §7), so 2MB
// is a generous cap against a misbehaving client, not an expected size.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Batch upload and photo upload are both device-signature-authenticated, not
// user-authenticated — see attendance.controller.ts's batch()/uploadPhoto()
// for the trust boundary. A scanner device offline for days must still be
// able to sync once connectivity returns, without any platform-user session
// in play.
router.post('/batch', miqatAttendanceController.batch);
router.post('/photos', upload.single('photo'), miqatAttendanceController.uploadPhoto);

router.use(authenticate);
router.use(requireMiqatEnabled);
router.post('/manual', requireAdmin, miqatAttendanceController.manual);
router.get('/day/:date', requireTeacher, miqatAttendanceController.day);
router.get('/summary', requireTeacher, miqatAttendanceController.summary);

export default router;
