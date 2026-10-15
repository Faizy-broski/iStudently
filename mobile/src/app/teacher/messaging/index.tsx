import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingInboxScreen } from '@/features/messaging/inbox-screen';

/** Teacher inbox (web: /teacher/messaging). */
export default function TeacherMessaging() {
  const { t } = useTranslation();
  const { open } = useLocalSearchParams<{ open?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messaging.title') }} />
      <MessagingInboxScreen writeHref="/teacher/messaging/write" openId={open} />
    </>
  );
}
