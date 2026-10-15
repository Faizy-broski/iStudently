import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingComposeScreen } from '@/features/messaging/compose-screen';

/** Admin compose (web: /admin/messaging/write). */
export default function AdminMessagingWrite() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messagingWrite.title') }} />
      <MessagingComposeScreen inboxHref="/admin/messaging" />
    </>
  );
}
