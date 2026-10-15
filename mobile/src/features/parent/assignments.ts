import type { ParentAssignment } from '@studently/api-client';

import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's assignments: to do, submitted, then graded (web: useParentStudentAssignments). */
export function useChildAssignments(childId: string | null) {
  const q = useApi(childId ? ['parent', 'assignments', childId] : null, ([, , id]) => parent.getStudentAssignments(id as string));
  const d = q.data;
  const all: ParentAssignment[] = d ? [...(d.todo ?? []), ...(d.submitted ?? []), ...(d.graded ?? [])] : [];
  return { ...q, all, todo: d?.todo ?? [], done: (d?.submitted?.length ?? 0) + (d?.graded?.length ?? 0) };
}
