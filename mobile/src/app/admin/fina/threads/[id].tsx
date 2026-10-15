import { useLocalSearchParams } from 'expo-router';

import { ThreadScreen } from '@/features/fina/threads';

/** One thread, read-only for admins (web: ThreadView with canSend=false). */
export default function AdminFinaThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ThreadScreen id={id} canSend={false} />;
}
