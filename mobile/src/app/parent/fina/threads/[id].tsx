import { useLocalSearchParams } from 'expo-router';

import { ThreadScreen } from '@/features/fina/threads';

/** Web: /parent/fina/threads/[id]. */
export default function ParentFinaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThreadScreen id={id} canSend />;
}
