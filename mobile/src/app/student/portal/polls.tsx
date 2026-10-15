import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PortalPollsScreen } from '@/features/portal/announcements';

/** Web: /student/portal/polls. */
export default function StudentPortalPolls() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pp_title') }} />
      <PortalPollsScreen />
    </>
  );
}
