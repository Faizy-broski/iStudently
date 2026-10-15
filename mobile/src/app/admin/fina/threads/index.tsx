import { ThreadListScreen } from '@/features/fina/threads';

/** Teacher–guardian threads, read-only for admins (web: /admin/fina/threads). */
export default function AdminFinaThreads() {
  return <ThreadListScreen role="admin" detail={(id) => ({ pathname: '/admin/fina/threads/[id]', params: { id } })} />;
}
