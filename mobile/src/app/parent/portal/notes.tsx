import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { PortalNotesScreen } from '@/features/portal/announcements';

/** The selected child's campus (web: /parent/portal/notes). */
export default function ParentPortalNotes() {
  const { t } = useTranslation();
  const { child } = useChild();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pn_title') }} />
      {child ? <PortalNotesScreen key={child.id} campusId={child.campus_id} /> : <NoChild />}
    </>
  );
}
