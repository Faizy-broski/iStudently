import type { MarkingPeriod } from '@studently/api-client';

import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { adminAcademics, adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const MP_ORDER: Record<string, number> = { FY: 0, SEM: 1, QTR: 2, PRO: 3 };

/** The campus's marking periods, year → semesters → quarters → progress periods (like the web pickers). */
/** `campus` overrides the selected campus (parent pages use the child's campus). */
export function useMarkingPeriods(campus?: string | null) {
  const selected = useCampus().campusId;
  const campusId = campus === undefined ? selected : (campus ?? undefined);
  const res = useApi(['admin', 'marking-periods', campusId ?? 'school'], ([, , c]) => adminGrades.markingPeriods(c === 'school' ? undefined : (c as string)));
  const list: MarkingPeriod[] = [...(res.data ?? [])].sort((a, b) => (MP_ORDER[a.mp_type] ?? 9) - (MP_ORDER[b.mp_type] ?? 9) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  // The quarter chosen in the header (web sidebar), when it is one of these.
  const globalQuarter = usePortalAcademicOptional()?.quarter?.id ?? null;
  const selectedQuarterId = list.some((m) => m.id === globalQuarter) ? globalQuarter : null;
  return { ...res, list, selectedQuarterId, options: list.map((m) => ({ value: m.id, label: `${m.title} (${m.short_name || m.mp_type})` })) };
}

/** Academic years with the current one first picked by callers via `current`. */
export function useAcademicYears() {
  const res = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const list = res.data ?? [];
  return { ...res, list, current: list.find((y) => y.is_current) ?? list[0] ?? null };
}

export const fmtPercent = (v?: number | null) => (v == null ? '—' : `${Number(v).toFixed(1)}%`);
export const fmtGpa = (v?: number | null) => (v == null ? '—' : Number(v).toFixed(2));
