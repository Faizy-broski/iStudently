import { Router } from 'express';
import multer from 'multer';
import { qirtasiWorksheetsController } from '../../controllers/qirtasi/worksheets.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { requireQirtasiEnabled } from '../../middlewares/qirtasi-enabled.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.use(authenticate);
router.use(requireQirtasiEnabled);

router.get('/', qirtasiWorksheetsController.listWorksheets);
router.get('/:id', qirtasiWorksheetsController.getWorksheetById);
router.get('/:id/download', qirtasiWorksheetsController.downloadWorksheet);
router.get('/:id/thumbnail', qirtasiWorksheetsController.thumbnailWorksheet);
router.get('/:id/answer-key', qirtasiWorksheetsController.answerKeyWorksheet);

router.post(
  '/',
  requireRole('admin', 'teacher', 'librarian'),
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }, { name: 'answerKey', maxCount: 1 }]),
  qirtasiWorksheetsController.createWorksheet
);
router.put('/:id', requireRole('admin', 'teacher', 'librarian'), qirtasiWorksheetsController.updateWorksheet);
router.delete('/:id', requireRole('admin', 'teacher', 'librarian'), qirtasiWorksheetsController.deleteWorksheet);

export default router;
