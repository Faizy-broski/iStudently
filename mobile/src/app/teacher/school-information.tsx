import { useCampus } from '@/features/campus/campus';
import { SchoolInformationView } from '@/features/portal/school-info';

/** The teacher's campus details (web: /teacher/school-information). */
export default function TeacherSchoolInformation() {
  const { campus, isLoading, refresh } = useCampus();
  return <SchoolInformationView campus={campus} isLoading={isLoading} refresh={refresh} />;
}
