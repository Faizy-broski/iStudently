import type { Student } from '@studently/api-client';

import { usePortalAcademicOptional } from '@/features/portal/academic';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * Students of the teacher's own course periods for the selected year, merged without duplicates
 * (web: useTeacherStudents, the "teacher" scope of the scheduling pages). Shaped like the admin
 * student list so admin screens can use it unchanged.
 */
export function useTeacherStudents(enabled: boolean) {
  const academic = usePortalAcademicOptional();
  const cps = academic?.coursePeriods ?? [];
  const ids = cps.map((c) => c.id).join(',');
  const res = useApi(enabled && ids ? ['teacher', 'all-cp-students', ids] : null, async ([, , list]) => {
    const cpIds = (list as string).split(',');
    const results = await Promise.all(cpIds.map((id) => teacher.myCoursePeriodStudents(id).catch(() => null)));
    const seen = new Set<string>();
    const out: Student[] = [];
    results.forEach((r, i) => {
      const cp = cps.find((c) => c.id === cpIds[i]);
      for (const s of r?.success ? (r.data ?? []) : []) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        out.push({
          id: s.id,
          profile_id: null,
          school_id: '',
          student_number: s.student_number,
          grade_level: cp?.section?.grade_level?.name ?? null,
          section_id: s.section_id,
          profile: { first_name: s.profile?.first_name ?? '', last_name: s.profile?.last_name ?? '', email: s.profile?.email ?? null, phone: s.profile?.phone ?? null } as Student['profile'],
          section: cp?.section ? { id: cp.section.id, name: cp.section.name } : null,
          confidential_family_status: (s.confidential_family_status ?? null) as Student['confidential_family_status'],
        });
      }
    });
    return { success: true, data: out };
  });
  return { ...res, isLoading: res.isLoading || (enabled && (academic?.coursePeriodsLoading ?? false)) };
}
