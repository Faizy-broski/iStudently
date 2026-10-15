import { useLocalSearchParams } from 'expo-router';

import { ThreadScreen } from '@/features/fina/threads';

/** Web: /teacher/fina/threads/[id]. */
export default function TeacherFinaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThreadScreen id={id} canSend />;
}
