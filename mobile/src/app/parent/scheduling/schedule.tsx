import { NoChild, useChild } from '@/features/parent/child';
import { usePortalAcademic } from '@/features/portal/academic';
import { StudentScheduleView } from '@/features/scheduling/student-schedule';

/** The selected child's schedule on a chosen date, printable (web: /parent/scheduling/schedule). */
export default function ParentSchedule() {
  const { child } = useChild();
  const academic = usePortalAcademic();
  if (!child) return <NoChild />;
  return (
    <StudentScheduleView
      studentId={child.id}
      name={`${child.first_name} ${child.last_name}`}
      yearId={academic.year?.id ?? null}
      yearsLoading={academic.isLoading}
      campusId={child.campus_id}
      canManage={false}
      showRequests={false}
      printable
    />
  );
}
