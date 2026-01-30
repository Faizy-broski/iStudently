import { Router } from 'express';
import { DefaultFieldOrderController } from '../controllers/default-field-order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/default-field-orders/:entityType - Get field orders
router.get('/:entityType', DefaultFieldOrderController.getFieldOrders);

// POST /api/default-field-orders/:entityType/:categoryId - Save field orders
router.post('/:entityType/:categoryId', DefaultFieldOrderController.saveFieldOrders);

// DELETE /api/default-field-orders/:entityType/:categoryId - Reset category to defaults
router.delete('/:entityType/:categoryId', DefaultFieldOrderController.deleteFieldOrders);

// DELETE /api/default-field-orders/:entityType - Reset all for entity type
router.delete('/:entityType', DefaultFieldOrderController.resetAllFieldOrders);

export default router;
