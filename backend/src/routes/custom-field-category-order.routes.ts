import { Router } from 'express';
import { CustomFieldCategoryOrderController } from '../controllers/custom-field-category-order.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/custom-field-category-orders/:entityType - Get category orders
router.get('/:entityType', CustomFieldCategoryOrderController.getCategoryOrders);

// POST /api/custom-field-category-orders/:entityType - Save category orders
router.post('/:entityType', CustomFieldCategoryOrderController.saveCategoryOrders);

export default router;
