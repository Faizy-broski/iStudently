import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminCourses } from '@/lib/api';
import { useApi } from '@/lib/data';

/**
 * The campus's course periods; for a teacher only those they teach (web: the teacher grade pages
 * filter getCoursePeriods by teacher_id === profile.staff_id).
 */
export function useScopedCoursePeriods() {
  const { campusId } = useCampus();
  const { me } = useSession();
  const staffId = me.status === 'ready' && me.me.profile.role === 'teacher' ? (me.me.profile.staff_id ?? null) : null;
  const res = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  return { ...res, data: staffId && res.data ? res.data.filter((cp) => cp.teacher_id === staffId) : res.data };
}
