import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/app/states';
import { WebSessionView } from '@/components/app/web-session-view';
import { useCampus } from '@/features/campus/campus';

/** A web-only teacher page (3D models, interactive tools) inside the app, signed in as the teacher. */
export default function TeacherWebPage() {
  const { t } = useTranslation();
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { campusId } = useCampus();
  // Only the website's own teacher pages.
  if (!path || !path.startsWith('/teacher/') || path.includes('..')) return <EmptyState title={t('app.wv_unknown')} />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: title ? t(`sidebar.${title}`, { defaultValue: title.replace(/_/g, ' ') }) : '' }} />
      <WebSessionView path={path} campusId={campusId} />
    </View>
  );
}
