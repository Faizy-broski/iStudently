import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { DefaultFieldOrderService } from '../services/default-field-order.service';

/**
 * Get effective school ID - either from campus_id or admin's school
 */
function getEffectiveSchoolId(adminSchoolId: string, campusId?: string): string {
  if (campusId && campusId.trim() !== '') {
    return campusId;
  }
  return adminSchoolId;
}

export class DefaultFieldOrderController {
  /**
   * GET /api/default-field-orders/:entityType
   * Get field orders for an entity type
   */
  static async getFieldOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType } = req.params;
      const categoryId = req.query.category_id as string | undefined;
      const campusId = req.query.campus_id as string | undefined;

      // Validate entity type
      if (!['student', 'parent', 'teacher'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type. Must be student, parent, or teacher'
        });
      }

      // Get admin info from request
      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campusId);

      const fieldOrders = await DefaultFieldOrderService.getFieldOrders(
        effectiveSchoolId,
        entityType as 'student' | 'parent' | 'teacher',
        categoryId
      );

      res.json({
        success: true,
        data: fieldOrders
      });
    } catch (error) {
      console.error('Error getting field orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve field orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/default-field-orders/:entityType/:categoryId
   * Save field orders for a specific category
   */
  static async saveFieldOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType, categoryId } = req.params;
      const { fields, campus_id } = req.body;

      // Validate entity type
      if (!['student', 'parent', 'teacher'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
      }

      // Validate fields array
      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Fields array is required and must not be empty'
        });
      }

      // Validate each field has required properties
      const isValid = fields.every(
        field => field.field_label && typeof field.sort_order === 'number'
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Each field must have field_label and sort_order'
        });
      }

      // Get admin info from request
      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campus_id);

      await DefaultFieldOrderService.saveFieldOrders(
        effectiveSchoolId,
        entityType as 'student' | 'parent' | 'teacher',
        categoryId,
        fields
      );

      res.json({
        success: true,
        message: 'Field orders saved successfully'
      });
    } catch (error) {
      console.error('Error saving field orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save field orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/default-field-orders/:entityType/:categoryId
   * Delete field orders for a specific category (reset to defaults)
   */
  static async deleteFieldOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType, categoryId } = req.params;
      const campusId = req.query.campus_id as string | undefined;

      if (!['student', 'parent', 'teacher'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
      }

      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campusId);

      await DefaultFieldOrderService.deleteFieldOrders(
        effectiveSchoolId,
        entityType as 'student' | 'parent' | 'teacher',
        categoryId
      );

      res.json({
        success: true,
        message: 'Field orders reset to defaults'
      });
    } catch (error) {
      console.error('Error deleting field orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete field orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * DELETE /api/default-field-orders/:entityType
   * Reset all field orders for an entity type
   */
  static async resetAllFieldOrders(req: AuthRequest, res: Response) {
    try {
      const { entityType } = req.params;
      const campusId = req.query.campus_id as string | undefined;

      if (!['student', 'parent', 'teacher'].includes(entityType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid entity type'
        });
      }

      const adminSchoolId = req.profile?.school_id;
      if (!adminSchoolId) {
        return res.status(401).json({
          success: false,
          message: 'School ID not found in profile'
        });
      }

      const effectiveSchoolId = getEffectiveSchoolId(adminSchoolId, campusId);

      await DefaultFieldOrderService.resetAllFieldOrders(
        effectiveSchoolId,
        entityType as 'student' | 'parent' | 'teacher'
      );

      res.json({
        success: true,
        message: 'All field orders reset to defaults'
      });
    } catch (error) {
      console.error('Error resetting all field orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset field orders',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
