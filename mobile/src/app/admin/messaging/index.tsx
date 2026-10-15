import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingInboxScreen } from '@/features/messaging/inbox-screen';

/** Admin inbox (web: /admin/messaging). */
export default function AdminMessaging() {
  const { t } = useTranslation();
  const { open } = useLocalSearchParams<{ open?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messaging.title') }} />
      <MessagingInboxScreen writeHref="/admin/messaging/write" openId={open} />
    </>
  );
}
