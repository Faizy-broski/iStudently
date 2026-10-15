import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GrievanceThreadScreen } from '@/features/grievances/thread-screen';

/** One complaint (web: /admin/grievances/[id]). */
export default function AdminGrievanceDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('grievances.thread.conversation_title') }} />
      <GrievanceThreadScreen grievanceId={id} />
    </>
  );
}
