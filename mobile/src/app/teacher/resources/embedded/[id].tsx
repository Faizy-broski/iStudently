import { useLocalSearchParams } from 'expo-router';

import { EmbedViewerScreen } from '@/features/portal/embedded';

/** Web: /teacher/resources/embedded/[id]. */
export default function TeacherEmbedView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmbedViewerScreen role="teacher" id={id} />;
}
