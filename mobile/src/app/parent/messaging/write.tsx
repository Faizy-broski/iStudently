import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingComposeScreen } from '@/features/messaging/compose-screen';

/** Parent compose (web: /parent/messaging/write). */
export default function ParentMessagingWrite() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messagingWrite.title') }} />
      <MessagingComposeScreen inboxHref="/parent/messaging" />
    </>
  );
}
