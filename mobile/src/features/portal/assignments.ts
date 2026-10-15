import type { DueAssignment } from '@studently/api-client';

import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

/** All of the student's assignments: to do, submitted, then graded (web: useStudentAssignments). */
export function useStudentAssignmentList() {
  const q = useApi(['student', 'assignments'], () => student.getStudentAssignments());
  const d = q.data;
  const all: DueAssignment[] = d ? [...(d.todo ?? []), ...(d.submitted ?? []), ...(d.graded ?? [])] : [];
  return { ...q, all };
}

export const teacherOf = (a: DueAssignment) => `${a.teacher?.profile?.first_name || ''} ${a.teacher?.profile?.last_name || ''}`.trim() || '—';

/** "MMMM d yyyy" like the web, localised. */
export const longDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', day: 'numeric', year: 'numeric' });
};
