import { NoChild, useChild } from '@/features/parent/child';
import { usePortalAcademic } from '@/features/portal/academic';
import { StudentScheduleView } from '@/features/scheduling/student-schedule';

/**
 * The selected child's schedule with course requests (web: /parent/scheduling/student-requests,
 * StudentScheduleDetail). The web first lists students from the admin-only /students call, which
 * fails for parents; the app opens the selected child directly.
 */
export default function ParentStudentRequests() {
  const { child } = useChild();
  const academic = usePortalAcademic();
  if (!child) return <NoChild />;
  return (
    <StudentScheduleView
      studentId={child.id}
      name={`${child.first_name} ${child.last_name}`}
      number={child.student_number}
      yearId={academic.year?.id ?? null}
      yearsLoading={academic.isLoading}
      campusId={child.campus_id}
      canManage={false}
    />
  );
}
