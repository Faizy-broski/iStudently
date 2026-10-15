import { useEffect } from 'react';

import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { getHijriOffset, setHijriOffset } from '@/lib/hijri';

/** Days added to every Hijri date: school_settings.hijri_offset (web: Settings > Hijri), cached on the device. */
export function useHijriOffset() {
  const { campusId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const raw = settings.data?.hijri_offset;
  const server = typeof raw === 'number' ? raw : null;
  useEffect(() => {
    if (server !== null) setHijriOffset(server);
  }, [server]);
  return server ?? getHijriOffset();
}
