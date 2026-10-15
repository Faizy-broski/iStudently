import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingInboxScreen } from '@/features/messaging/inbox-screen';

/** Student inbox (web: /student/messaging). */
export default function StudentMessaging() {
  const { t } = useTranslation();
  const { open } = useLocalSearchParams<{ open?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messaging.title') }} />
      <MessagingInboxScreen writeHref="/student/messaging/write" openId={open} />
    </>
  );
}
