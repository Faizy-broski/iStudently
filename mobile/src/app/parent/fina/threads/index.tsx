import { ThreadListScreen } from '@/features/fina/threads';

/** Conversations with the children's teachers (web: /parent/fina/threads). */
export default function ParentFinaThreads() {
  return <ThreadListScreen role="parent" detail={(id) => ({ pathname: '/parent/fina/threads/[id]', params: { id } })} />;
}
