import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/app/states';
import { WebSessionView } from '@/components/app/web-session-view';
import { useCampus } from '@/features/campus/campus';

/** A web-only parent page (3D models, interactive tools) inside the app, signed in as the parent. */
export default function ParentWebPage() {
  const { t } = useTranslation();
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { campusId } = useCampus();
  // Only the website's own parent pages.
  if (!path || !path.startsWith('/parent/') || path.includes('..')) return <EmptyState title={t('app.wv_unknown')} />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: title ? t(`sidebar.${title}`, { defaultValue: title.replace(/_/g, ' ') }) : '' }} />
      <WebSessionView path={path} campusId={campusId} />
    </View>
  );
}
