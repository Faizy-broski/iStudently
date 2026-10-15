import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { PortalNotesScreen } from '@/features/portal/announcements';

/** Web: /teacher/portal/notes. */
export default function TeacherPortalNotes() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pn_title') }} />
      <PortalNotesScreen />
    </>
  );
}
