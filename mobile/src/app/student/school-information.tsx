import { useCampus } from '@/features/campus/campus';
import { SchoolInformationView } from '@/features/portal/school-info';

/** The student's campus details (web: /student/school-information). */
export default function StudentSchoolInformation() {
  const { campus, isLoading, refresh } = useCampus();
  return <SchoolInformationView campus={campus} isLoading={isLoading} refresh={refresh} />;
}
