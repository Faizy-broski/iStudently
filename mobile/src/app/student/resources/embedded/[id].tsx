import { useLocalSearchParams } from 'expo-router';

import { EmbedViewerScreen } from '@/features/portal/embedded';

/** Web: /student/resources/embedded/[id]. */
export default function StudentEmbedView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmbedViewerScreen role="student" id={id} />;
}
