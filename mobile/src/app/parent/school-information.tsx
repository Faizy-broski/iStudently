import { NoChild, useChild } from '@/features/parent/child';
import { SchoolInformationView } from '@/features/portal/school-info';
import { campuses } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's campus (web: /parent/school-information). */
export default function ParentSchoolInformation() {
  const { child } = useChild();
  const campusId = child?.campus_id ?? null;
  const res = useApi(campusId ? ['parent', 'campus', campusId] : null, ([, , c]) => campuses.get(c as string));
  if (!child) return <NoChild />;
  return <SchoolInformationView campus={res.data ?? null} isLoading={res.isLoading} refresh={() => res.mutate()} who={`${child.first_name} ${child.last_name}`} />;
}
