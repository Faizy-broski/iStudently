import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceListScreen } from '@/features/grievances/list-screen';

/** My complaints (web: /librarian/grievances). */
export default function LibrarianGrievances() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.list.title') }} />
      <GrievanceListScreen detailHref={(id) => ({ pathname: '/librarian/grievances/[id]', params: { id } })} submitHref="/librarian/grievances/submit" />
    </>
  );
}
