import { Router } from 'express';
import { CustomFieldCategoryOrderController } from '../controllers/custom-field-category-order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';

const router = Router();

router.use(authenticate);

// GET /api/custom-field-category-orders/:entityType - Get category orders
router.get('/:entityType', CustomFieldCategoryOrderController.getCategoryOrders);

// POST /api/custom-field-category-orders/:entityType - Save category orders
// Admin pages only (staff reach them through the permission-limited admin shell).
router.post('/:entityType', requireRole('admin', 'super_admin', 'staff'), CustomFieldCategoryOrderController.saveCategoryOrders);

export default router;
