import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PortalNotesScreen } from '@/features/portal/announcements';

/** Web: /student/portal/notes. */
export default function StudentPortalNotes() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pn_title') }} />
      <PortalNotesScreen />
    </>
  );
}
