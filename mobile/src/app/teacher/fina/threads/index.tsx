import { ThreadListScreen } from '@/features/fina/threads';

/** Conversations with the children's teachers (web: /teacher/fina/threads). */
export default function TeacherFinaThreads() {
  return <ThreadListScreen role="teacher" detail={(id) => ({ pathname: '/teacher/fina/threads/[id]', params: { id } })} />;
}
