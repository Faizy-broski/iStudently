import { Router } from 'express';
import { textbookDeliveriesController } from '../controllers/textbook-deliveries.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Admin/librarian-only module — no teacher-scoped variant (see plan decision).
// The financial-block override itself is further gated inside the service
// layer (OVERRIDE_ROLES in textbook-deliveries.service.ts), not by this
// route-level role check alone.
const roles = ['admin', 'librarian'] as const;

router.get('/matrix', requireRole(...roles), textbookDeliveriesController.getMatrix);
router.post('/sync', requireRole(...roles), textbookDeliveriesController.sync);
router.post('/bulk-sync', requireRole(...roles), textbookDeliveriesController.bulkSync);
router.post('/:id/return', requireRole(...roles), textbookDeliveriesController.returnDelivery);
router.post('/bulk-return', requireRole(...roles), textbookDeliveriesController.bulkReturn);
router.get('/missing-summary', requireRole(...roles), textbookDeliveriesController.getMissingSummary);

export default router;
