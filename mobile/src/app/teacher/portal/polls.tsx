import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PortalPollsScreen } from '@/features/portal/announcements';

/** Web: /teacher/portal/polls. */
export default function TeacherPortalPolls() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pp_title') }} />
      <PortalPollsScreen />
    </>
  );
}
