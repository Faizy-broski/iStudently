import { Router } from 'express';
import { DefaultFieldOrderController } from '../controllers/default-field-order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication; changing a school's form settings is admin-only (any signed-in
// user, including students and parents, could save or reset them before).
router.use(authenticate);
const admin = requireRole('admin', 'super_admin');

// GET /api/default-field-orders/:entityType - Get field orders
router.get('/:entityType', DefaultFieldOrderController.getFieldOrders);

// POST /api/default-field-orders/:entityType/:categoryId - Save field orders
router.post('/:entityType/:categoryId', admin, DefaultFieldOrderController.saveFieldOrders);

// POST /api/default-field-orders/:entityType/:categoryId/required - Toggle a default field's required status
router.post('/:entityType/:categoryId/required', admin, DefaultFieldOrderController.updateFieldRequired);

// DELETE /api/default-field-orders/:entityType/:categoryId - Reset category to defaults
router.delete('/:entityType/:categoryId', admin, DefaultFieldOrderController.deleteFieldOrders);

// DELETE /api/default-field-orders/:entityType - Reset all for entity type
router.delete('/:entityType', admin, DefaultFieldOrderController.resetAllFieldOrders);

export default router;
