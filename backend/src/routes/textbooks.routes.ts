import { Router } from 'express';
import { textbooksController } from '../controllers/textbooks.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== TEXTBOOK CATALOG ====================
// Admin/librarian-only module — no teacher-scoped variant (see plan decision).
router.get('/', requireRole('admin', 'librarian'), textbooksController.getTextbooks);
router.get('/:id', requireRole('admin', 'librarian'), textbooksController.getTextbookById);
router.post('/', requireRole('admin', 'librarian'), textbooksController.createTextbook);
router.put('/:id', requireRole('admin', 'librarian'), textbooksController.updateTextbook);
router.delete('/:id', requireRole('admin'), textbooksController.deleteTextbook);
router.post('/:id/restock', requireRole('admin', 'librarian'), textbooksController.restockTextbook);

export default router;
