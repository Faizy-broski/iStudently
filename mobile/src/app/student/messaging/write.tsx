import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingComposeScreen } from '@/features/messaging/compose-screen';

/** Student compose (web: /student/messaging/write). */
export default function StudentMessagingWrite() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messagingWrite.title') }} />
      <MessagingComposeScreen inboxHref="/student/messaging" />
    </>
  );
}
