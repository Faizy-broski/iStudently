import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceListScreen } from '@/features/grievances/list-screen';

/** My complaints (web: /parent/grievances). */
export default function ParentGrievances() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.list.title') }} />
      <GrievanceListScreen detailHref={(id) => ({ pathname: '/parent/grievances/[id]', params: { id } })} submitHref="/parent/grievances/submit" />
    </>
  );
}
