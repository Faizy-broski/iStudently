import { useSession } from '@/features/auth/session';
import { exams } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The signed-in teacher's exams (shared by the list and the grading screen). */
export function useTeacherExams() {
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  return useApi(staffId ? ['teacher', 'exams', staffId] : null, ([, , s]) => exams.teacherExams(s as string));
}
