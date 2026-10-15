import { PortalModuleList } from '@/features/portal/portal-module-list';
import { STUDENT_TAB_GROUPS } from '@/features/portal/student-tabs';

export default function StudentAcademics() {
  return <PortalModuleList role="student" only={STUDENT_TAB_GROUPS.academics} />;
}
