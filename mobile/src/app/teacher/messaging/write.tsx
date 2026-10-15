import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { MessagingComposeScreen } from '@/features/messaging/compose-screen';

/** Teacher compose (web: /teacher/messaging/write). */
export default function TeacherMessagingWrite() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('teacherPages.messagingWrite.title') }} />
      <MessagingComposeScreen inboxHref="/teacher/messaging" />
    </>
  );
}
