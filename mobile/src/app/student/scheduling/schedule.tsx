import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademic } from '@/features/portal/academic';
import { StudentScheduleView } from '@/features/scheduling/student-schedule';

/** The student's own schedule and course requests (web: /student/scheduling/schedule). */
export default function StudentSchedule() {
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const { campusId } = useCampus();
  const academic = usePortalAcademic();
  const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  return <StudentScheduleView studentId={profile?.student_id ?? null} name={name} yearId={academic.year?.id ?? null} yearsLoading={academic.isLoading} campusId={campusId} canManage={false} />;
}
