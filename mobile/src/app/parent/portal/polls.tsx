import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { PortalPollsScreen } from '@/features/portal/announcements';

/** The selected child's campus (web: /parent/portal/polls). */
export default function ParentPortalPolls() {
  const { t } = useTranslation();
  const { child } = useChild();
  return (
    <>
      <Stack.Screen options={{ title: t('app.pp_title') }} />
      {child ? <PortalPollsScreen key={child.id} campusId={child.campus_id} /> : <NoChild />}
    </>
  );
}
