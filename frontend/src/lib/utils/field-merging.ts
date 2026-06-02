/**
 * Utility functions for merging and sorting standard fields with custom fields inline
 * 
 * Logic:
 * 1. Standard fields have predefined sort_order values (multiples of 10: 10, 20, 30...)
 * 2. Custom fields can insert at any sort_order value
 * 3. When a custom field uses a sort_order that matches a standard field, the standard field is pushed (+1)
 * 4. All fields are sorted by sort_order for final display
 * 
 * Example:
 * Standard: First Name (10), Last Name (20)
 * Custom: Middle Name (sort_order: 20)
 * Result: First Name (10), Middle Name (20), Last Name (21)
 */

export interface BaseStandardField {
  id: string;
  label: string;
  type: string;
  category: string;
  sort_order: number;
  required?: boolean;
  width?: 'full' | 'half' | 'third';
  placeholder?: string;
  help?: string;
  defaultValue?: any;
  options?: string[];
}

export interface BaseCustomField {
  id: string;
  field_key: string;
  label: string;
  type: string;
  category_id: string;
  sort_order: number;
  required?: boolean;
  options?: string[];
}

export interface MergedField extends BaseStandardField {
  isCustom?: boolean;
  field_key?: string;
}

/**
 * Merges standard fields with custom fields and sorts them by sort_order
 * When custom fields have the same sort_order as standard fields, standard fields are pushed down
 */
export function mergeAndSortFields(
  standardFields: BaseStandardField[],
  customFields: BaseCustomField[],
  categories: string[]
): MergedField[] {
  // 1. Filter standard fields by category
  const relevantStandard = standardFields.filter(f => categories.includes(f.category));

  // 2. Filter and map custom fields by category
  const relevantCustom = customFields
    .filter(f => categories.includes(f.category_id))
    .map(f => ({
      ...f,
      isCustom: true,
      id: f.field_key,
      category: f.category_id,
      width: (f.type === 'long-text' || f.type === 'textarea') ? 'full' : 'half' as 'full' | 'half' | 'third',
    })) as MergedField[];

  // 3. Merge all fields
  let merged: MergedField[] = [...relevantStandard, ...relevantCustom];

  // 4. Handle sort_order conflicts: if custom field has same sort_order as standard field(s),
  //    push the standard field(s) down
  const sortOrders = new Map<number, MergedField[]>();
  
  // Group fields by sort_order
  merged.forEach(field => {
    const order = field.sort_order;
    if (!sortOrders.has(order)) {
      sortOrders.set(order, []);
    }
    sortOrders.get(order)!.push(field);
  });

  // Process conflicts: custom fields take priority, standard fields get incremented
  const finalFields: MergedField[] = [];
  const processedOrders = Array.from(sortOrders.keys()).sort((a, b) => a - b);

  processedOrders.forEach(order => {
    const fields = sortOrders.get(order)!;
    
    if (fields.length === 1) {
      // No conflict
      finalFields.push(fields[0]);
    } else {
      // Conflict: separate custom and standard
      const customFieldsAtOrder = fields.filter(f => f.isCustom);
      const standardFieldsAtOrder = fields.filter(f => !f.isCustom);

      // Add custom fields first (they keep their sort_order)
      customFieldsAtOrder.forEach(f => finalFields.push(f));

      // Push standard fields down by incrementing their sort_order
      standardFieldsAtOrder.forEach((f, index) => {
        finalFields.push({
          ...f,
          sort_order: order + index + 1
        });
      });
    }
  });

  // 5. Final sort by sort_order
  return finalFields.sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Gets merged fields for specific categories
 */
export function getMergedFieldsForCategories(
  standardFields: BaseStandardField[],
  customFields: BaseCustomField[],
  categories: string[]
): MergedField[] {
  return mergeAndSortFields(standardFields, customFields, categories);
}
