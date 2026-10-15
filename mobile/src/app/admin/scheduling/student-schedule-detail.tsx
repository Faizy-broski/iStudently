import { useLocalSearchParams } from 'expo-router';

import { useAcademicYears } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { useRoleBase } from '@/features/portal/role-base';
import { StudentScheduleView } from '@/features/scheduling/student-schedule';

/**
 * One student's schedule with drop / add a course / requests (web: StudentScheduleDetail). Teachers
 * use their selected year; enrolling and dropping are admin-only on the server, so they only view.
 */
export default function StudentScheduleDetail() {
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const portal = usePortalAcademicOptional();
  const { isAdmin } = useRoleBase();
  const { id, name, number } = useLocalSearchParams<{ id: string; name?: string; number?: string }>();
  const yearId = portal ? (portal.year?.id ?? null) : (years.current?.id ?? null);
  return <StudentScheduleView studentId={id ?? null} name={name} number={number} yearId={yearId} yearsLoading={portal ? portal.isLoading : years.isLoading} campusId={campusId} canManage={isAdmin} />;
}
