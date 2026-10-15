import { useState } from 'react';

import { usePortalAcademicOptional } from '@/features/portal/academic';
import { adminAcademics } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Academic years with a picked one (default: the year chosen in the header like the web sidebar,
 * else the current one, else the first). `name` is what fees/accounting use.
 */
export function useAcademicYear() {
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const globalId = usePortalAcademicOptional()?.year?.id ?? null;
  const list = years.data ?? [];
  const year = list.find((y) => y.id === pickedId) ?? list.find((y) => y.id === globalId) ?? list.find((y) => y.is_current) ?? list[0] ?? null;
  return {
    years: list,
    year,
    name: year?.name ?? null,
    id: year?.id ?? null,
    pick: setPickedId,
    options: list.map((y) => ({ value: y.id, label: y.name })),
    isLoading: years.isLoading,
  };
}
