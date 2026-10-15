import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceListScreen } from '@/features/grievances/list-screen';

/** My complaints (web: /student/grievances). */
export default function StudentGrievances() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.list.title') }} />
      <GrievanceListScreen detailHref={(id) => ({ pathname: '/student/grievances/[id]', params: { id } })} submitHref="/student/grievances/submit" />
    </>
  );
}
