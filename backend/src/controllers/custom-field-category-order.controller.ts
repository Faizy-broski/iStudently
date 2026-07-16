import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { CustomFieldCategoryOrderService } from '../services/custom-field-category-order.service';

/**
 * Get effective school ID - either from campus_id or admin's school
 */
function getEffectiveSchoolId(adminSchoolId: string, campusId?: string): string {
  if (campusId && campusId.trim() !== '') {
    return campusId;
  }
  return adminSchoolId;
}

export class CustomFieldCategoryOrderController {
  /**
   * GET /api/custom-field-category-orders/:entityType
   * Get category orders for an entity type
   */
  static async getCategoryOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType } = req.params;
      const campusId = req.query.campus_id as string | undefined;

      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campusId);

      const categoryOrders = await CustomFieldCategoryOrderService.getCategoryOrders(
        effectiveSchoolId,
        entityType
      );

      res.json({
        success: true,
        data: categoryOrders
      });
    } catch (error) {
      console.error('Error getting category orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve category orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/custom-field-category-orders/:entityType
   * Save category orders for an entity type
   */
  static async saveCategoryOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType } = req.params;
      const { categories, campus_id } = req.body;

      if (!Array.isArray(categories) || categories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Categories array is required and must not be empty'
        });
      }

      const isValid = categories.every(
        (cat: any) => cat.category_id && typeof cat.category_order === 'number'
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Each category must have category_id and category_order'
        });
      }

      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campus_id);

      await CustomFieldCategoryOrderService.saveCategoryOrders(
        effectiveSchoolId,
        entityType,
        categories
      );

      res.json({
        success: true,
        message: 'Category orders saved successfully'
      });
    } catch (error) {
      console.error('Error saving category orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save category orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
