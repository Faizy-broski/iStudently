import { useLocalSearchParams } from 'expo-router';

import { EmbedViewerScreen } from '@/features/portal/embedded';

/** Web: /parent/resources/embedded/[id]. */
export default function ParentEmbedView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmbedViewerScreen role="parent" id={id} />;
}
