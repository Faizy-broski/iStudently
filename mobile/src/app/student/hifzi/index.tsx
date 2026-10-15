import { useSession } from '@/features/auth/session';
import { HifziProgressView } from '@/features/portal/hifzi-progress';

/** The student's memorization heatmap, recent recitations and report card PDF (web: /student/hifzi). */
export default function StudentHifzi() {
  const { me } = useSession();
  return <HifziProgressView studentId={me.status === 'ready' ? (me.me.profile.student_id ?? null) : null} />;
}
