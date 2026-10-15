import { NoChild, useChild } from '@/features/parent/child';
import { HifziProgressView } from '@/features/portal/hifzi-progress';

/** The selected child's memorization heatmap, achievements, recitations and report card (web: /parent/hifzi). */
export default function ParentHifzi() {
  const { childId } = useChild();
  if (!childId) return <NoChild />;
  return <HifziProgressView key={childId} studentId={childId} milestones />;
}
