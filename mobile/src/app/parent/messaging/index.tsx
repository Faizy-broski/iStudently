import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingInboxScreen } from '@/features/messaging/inbox-screen';

/** Parent inbox (web: /parent/messaging). */
export default function ParentMessaging() {
  const { t } = useTranslation();
  const { open } = useLocalSearchParams<{ open?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messaging.title') }} />
      <MessagingInboxScreen writeHref="/parent/messaging/write" openId={open} />
    </>
  );
}
