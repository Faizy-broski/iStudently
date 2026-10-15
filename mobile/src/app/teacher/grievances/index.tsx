import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceListScreen } from '@/features/grievances/list-screen';

/** My complaints (web: /teacher/grievances). */
export default function TeacherGrievances() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.list.title') }} />
      <GrievanceListScreen detailHref={(id) => ({ pathname: '/teacher/grievances/[id]', params: { id } })} submitHref="/teacher/grievances/submit" />
    </>
  );
}
