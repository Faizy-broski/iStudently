import { supabase } from '../config/supabase';

export interface CustomFieldCategoryOrder {
  category_id: string;
  category_order: number;
}

export class CustomFieldCategoryOrderService {
  /**
   * Get category orders for a specific entity type and school
   */
  static async getCategoryOrders(
    schoolId: string,
    entityType: string
  ): Promise<CustomFieldCategoryOrder[]> {
    try {
      const { data, error } = await supabase
        .from('custom_field_category_orders')
        .select('category_id, category_order')
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .order('category_order', { ascending: true });

      if (error) throw error;
      return (data as CustomFieldCategoryOrder[]) || [];
    } catch (error) {
      console.error('Error fetching category orders:', error);
      throw error;
    }
  }

  /**
   * Save category orders for an entity type.
   * Replaces all existing category orders for the given school/entity_type.
   */
  static async saveCategoryOrders(
    schoolId: string,
    entityType: string,
    categories: CustomFieldCategoryOrder[]
  ): Promise<void> {
    try {
      const { error: deleteError } = await supabase
        .from('custom_field_category_orders')
        .delete()
        .eq('school_id', schoolId)
        .eq('entity_type', entityType);

      if (deleteError) throw deleteError;

      if (categories.length > 0) {
        const records = categories.map(cat => ({
          school_id: schoolId,
          entity_type: entityType,
          category_id: cat.category_id,
          category_order: cat.category_order,
        }));

        const { error: insertError } = await supabase
          .from('custom_field_category_orders')
          .insert(records);

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error saving category orders:', error);
      throw error;
    }
  }
}
