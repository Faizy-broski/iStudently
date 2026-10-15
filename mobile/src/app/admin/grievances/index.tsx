import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceListScreen } from '@/features/grievances/list-screen';

/** All complaints (web: /admin/grievances). */
export default function AdminGrievances() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.list.title') }} />
      <GrievanceListScreen isAdmin detailHref={(id) => ({ pathname: '/admin/grievances/[id]', params: { id } })} submitHref="/admin/grievances/submit" />
    </>
  );
}
