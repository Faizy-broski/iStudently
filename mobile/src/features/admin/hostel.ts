import type { CustomFieldDefinition, HostelScope } from '@studently/api-client';

import { useSession } from '@/features/auth/session';

/**
 * Hostel rows are keyed by the signed-in user's school (the web's profile.school_id), not the campus
 * switcher; staff also send their own campus. null until the session is ready.
 */
export function useHostelScope(): HostelScope | null {
  const { me } = useSession();
  if (me.status !== 'ready' || !me.me.profile.school_id) return null;
  return { schoolId: me.me.profile.school_id, campusId: me.me.profile.campus_id ?? undefined };
}

/** SWR key part for a scope. */
export const scopeKey = (s: HostelScope | null) => (s ? `${s.schoolId}:${s.campusId ?? ''}` : null);

/** Hostel custom values as the web stores them: flat by field_key, every value a string. */
export function hostelInitialValues(defs: CustomFieldDefinition[] | undefined, stored: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.fromEntries((defs ?? []).map((d) => [d.id, stored?.[d.field_key] == null ? '' : String(stored[d.field_key])]));
}

export function hostelCustomFields(defs: CustomFieldDefinition[] | undefined, edited: Record<string, unknown>, stored: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(stored ?? {})) out[k] = v == null ? '' : String(v);
  for (const d of defs ?? []) {
    const v = edited[d.id];
    if (v === undefined) continue;
    out[d.field_key] = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? String(v) : v == null ? '' : String(v);
  }
  return out;
}

export const ROOM_TYPES = ['standard', 'premium', 'suite', 'shared'] as const;

export const FEE_STATUS_TONE: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30',
  paid: 'bg-emerald-100 dark:bg-emerald-900/30',
  partial: 'bg-blue-100 dark:bg-blue-900/30',
  waived: 'bg-gray-100 dark:bg-gray-900/30',
};
