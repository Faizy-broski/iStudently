import type { CustomFieldDefinition, CustomFieldEntity } from '@studently/api-client';

/** Built-in tabs per record type, same ids and order as the web's custom fields pages. */
export const ENTITY_TABS: Record<CustomFieldEntity, string[]> = {
  student: ['personal', 'academic', 'medical', 'family', 'system'],
  teacher: ['personal', 'professional', 'qualifications', 'employment', 'system'],
  staff: ['personal', 'employment', 'system'],
  parent: ['personal', 'professional', 'contact', 'emergency', 'system'],
  // School/campus details (web: SchoolCustomFieldsButton's default tab).
  school: ['school_details'],
  // Hostel fields live in one fixed 'general' category (web: /admin/hostel/fields).
  hostel_building: ['general'],
  hostel_room: ['general'],
};

export type PersonEntity = keyof typeof ENTITY_TABS;

export function isPersonEntity(v: unknown): v is PersonEntity {
  return typeof v === 'string' && v in ENTITY_TABS;
}

/** Built-in tabs first, then custom tabs found on the fields (in category order). */
export function tabsFor(entity: PersonEntity, fields: CustomFieldDefinition[] = []) {
  const builtIn = ENTITY_TABS[entity].map((id) => ({ id, name: '', builtIn: true }));
  const custom = new Map<string, { id: string; name: string; order: number }>();
  for (const f of fields) {
    if (ENTITY_TABS[entity].includes(f.category_id) || custom.has(f.category_id)) continue;
    custom.set(f.category_id, { id: f.category_id, name: f.category_name, order: f.category_order ?? 99 });
  }
  return [...builtIn, ...[...custom.values()].sort((a, b) => a.order - b.order).map((c) => ({ id: c.id, name: c.name, builtIn: false }))];
}
