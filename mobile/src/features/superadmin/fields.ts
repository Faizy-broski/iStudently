import type { SchoolFieldDefinition } from '@studently/api-client';
import type { CampusScope, CustomFieldType } from '@studently/shared-types';

// School custom fields: same tabs, types and scopes as the web's SchoolCustomFieldsButton.

export const DEFAULT_TAB = { id: 'school_details', name: 'School Details' };

export const FIELD_TYPES: CustomFieldType[] = ['text', 'long-text', 'number', 'date', 'checkbox', 'select', 'multi-select', 'file'];
export const OPTION_TYPES: CustomFieldType[] = ['select', 'multi-select'];

/** Scopes a super admin may pick (school admins only get this_campus / all_campuses on the web). */
export const FIELD_SCOPES: CampusScope[] = ['all_campuses', 'this_campus', 'selected_campuses', 'all_schools'];

/** Tabs = distinct categories among the fields, default tab first. */
export function fieldTabs(fields: SchoolFieldDefinition[] = []) {
  const map = new Map<string, string>([[DEFAULT_TAB.id, DEFAULT_TAB.name]]);
  [...fields].sort((a, b) => (a.category_order ?? 0) - (b.category_order ?? 0)).forEach((f) => map.set(f.category_id, f.category_name));
  return Array.from(map, ([id, name]) => ({ id, name }));
}

/** Tab id from its name, as the web does ("Bank Info" -> "bank_info"). */
export function tabIdFor(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `tab_${Date.now()}`;
}
