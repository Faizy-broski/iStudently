import type { ProfileBaseRole, ProfileModuleGroup, ProfilePermission } from '@studently/shared-types';
import { PROFILE_MODULES } from '@studently/shared-types';

/** User types a new permission profile can apply to (web: ROLE_TYPES_FOR_NEW_ROLE). */
export const PROFILE_ROLE_TYPES: ProfileBaseRole[] = ['admin', 'staff', 'teacher', 'librarian', 'student', 'parent'];

export type PermMap = Record<string, { can_use: boolean; can_edit: boolean }>;

/** The modules a profile of this type can be given, minus the school's denied modules (web: getModuleGroups). */
export function profileModuleGroups(role: ProfileBaseRole, denied: readonly string[] | null | undefined): ProfileModuleGroup[] {
  const deny = new Set(denied ?? []);
  return (PROFILE_MODULES[role] ?? []).map((g) => ({ ...g, items: g.items.filter((i) => !deny.has(i.href)) })).filter((g) => g.items.length > 0);
}

export function buildPermMap(perms: readonly ProfilePermission[]): PermMap {
  const map: PermMap = {};
  for (const p of perms) map[p.module_key] = { can_use: p.can_use, can_edit: p.can_edit };
  return map;
}

/** Only granted rows are stored. */
export function permMapToArray(map: PermMap): ProfilePermission[] {
  return Object.entries(map)
    .filter(([, v]) => v.can_use || v.can_edit)
    .map(([module_key, v]) => ({ module_key, can_use: v.can_use, can_edit: v.can_edit }));
}

/** Edit implies use; dropping use drops edit. */
export function setPerm(cur: { can_use: boolean; can_edit: boolean } | undefined, field: 'can_use' | 'can_edit', value: boolean) {
  const next = { can_use: false, can_edit: false, ...cur, [field]: value };
  if (field === 'can_edit' && value) next.can_use = true;
  if (field === 'can_use' && !value) next.can_edit = false;
  return next;
}
