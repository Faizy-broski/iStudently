import { supabase } from '../config/supabase';

export interface DefaultFieldOrder {
  id: string;
  school_id: string;
  entity_type: 'student' | 'parent' | 'teacher';
  category_id: string;
  field_label: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface DefaultFieldOrderInput {
  entity_type: 'student' | 'parent' | 'teacher';
  category_id: string;
  field_label: string;
  sort_order: number;
}

export class DefaultFieldOrderService {
  /**
   * Get field orders for a specific entity type and school
   */
  static async getFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher',
    categoryId?: string
  ): Promise<DefaultFieldOrder[]> {
    try {
      let query = supabase
        .from('default_field_orders')
        .select('*')
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .order('sort_order', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as DefaultFieldOrder[]) || [];
    } catch (error) {
      console.error('Error fetching field orders:', error);
      throw error;
    }
  }

  /**
   * Save or update field orders for a category
   * Replaces all existing field orders for the given school/entity/category
   */
  static async saveFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher',
    categoryId: string,
    fields: Array<{ field_label: string; sort_order: number }>
  ): Promise<void> {
    try {
      // Delete existing orders for this category
      const { error: deleteError } = await supabase
        .from('default_field_orders')
        .delete()
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .eq('category_id', categoryId);

      if (deleteError) throw deleteError;

      // Insert new orders if any fields provided
      if (fields.length > 0) {
        const records = fields.map(field => ({
          school_id: schoolId,
          entity_type: entityType,
          category_id: categoryId,
          field_label: field.field_label,
          sort_order: field.sort_order
        }));

        const { error: insertError } = await supabase
          .from('default_field_orders')
          .insert(records);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error saving field orders:', error);
      throw error;
    }
  }

  /**
   * Delete all field orders for a specific school/entity/category
   */
  static async deleteFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher',
    categoryId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('default_field_orders')
        .delete()
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .eq('category_id', categoryId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting field orders:', error);
      throw error;
    }
  }

  /**
   * Reset all field orders for an entity type (delete all custom ordering)
   */
  static async resetAllFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('default_field_orders')
        .delete()
        .eq('school_id', schoolId)
        .eq('entity_type', entityType);

      if (error) throw error;
    } catch (error) {
      console.error('Error resetting field orders:', error);
      throw error;
    }
  }
}
