import { supabase } from '../config/supabase';

export interface DefaultFieldOrder {
  id: string;
  school_id: string;
  entity_type: 'student' | 'parent' | 'teacher' | 'staff';
  category_id: string;
  field_label: string;
  sort_order: number;
  required?: boolean | null;
  created_at: Date;
  updated_at: Date;
}

export interface DefaultFieldOrderInput {
  entity_type: 'student' | 'parent' | 'teacher' | 'staff';
  category_id: string;
  field_label: string;
  sort_order: number;
  required?: boolean | null;
}

export class DefaultFieldOrderService {
  /**
   * Get field orders for a specific entity type and school
   */
  static async getFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher' | 'staff',
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
    entityType: 'student' | 'parent' | 'teacher' | 'staff',
    categoryId: string,
    fields: Array<{ field_label: string; sort_order: number }>
  ): Promise<void> {
    try {
      // Read existing required overrides first — the delete-then-reinsert
      // below would otherwise silently wipe them on every reorder save.
      const { data: existingRows, error: fetchError } = await supabase
        .from('default_field_orders')
        .select('field_label, required')
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .eq('category_id', categoryId);

      if (fetchError) throw fetchError;

      const requiredByLabel = new Map<string, boolean | null>(
        (existingRows || []).map(row => [row.field_label, row.required])
      );

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
          sort_order: field.sort_order,
          required: requiredByLabel.get(field.field_label) ?? null
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
   * Upsert the required override for a single default field, without
   * touching its sort order (unless the row doesn't exist yet, in which case
   * sortOrderIfNew is used to satisfy the NOT NULL sort_order column).
   */
  static async upsertFieldRequired(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher' | 'staff',
    categoryId: string,
    fieldLabel: string,
    required: boolean,
    sortOrderIfNew: number
  ): Promise<void> {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from('default_field_orders')
        .select('id')
        .eq('school_id', schoolId)
        .eq('entity_type', entityType)
        .eq('category_id', categoryId)
        .eq('field_label', fieldLabel)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error: updateError } = await supabase
          .from('default_field_orders')
          .update({ required })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('default_field_orders')
          .insert({
            school_id: schoolId,
            entity_type: entityType,
            category_id: categoryId,
            field_label: fieldLabel,
            sort_order: sortOrderIfNew,
            required
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error upserting field required override:', error);
      throw error;
    }
  }

  /**
   * Delete all field orders for a specific school/entity/category
   */
  static async deleteFieldOrders(
    schoolId: string,
    entityType: 'student' | 'parent' | 'teacher' | 'staff',
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
    entityType: 'student' | 'parent' | 'teacher' | 'staff'
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
