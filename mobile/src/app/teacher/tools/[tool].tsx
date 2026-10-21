import { Stack, useLocalSearchParams } from 'expo-router';
import { Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/app/states';
import { PublicWebView, WebSessionView } from '@/components/app/web-session-view';
import { roleWebTools } from '@/features/admin/web-tools';
import { useCampus } from '@/features/campus/campus';

const TOOLS = roleWebTools('teacher');

/** An interactive resource tool from the website, inside the app (web: /teacher/resources/<tool>). */
export default function TeacherToolScreen() {
  const { t } = useTranslation();
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const { campusId } = useCampus();
  const def = tool ? TOOLS[tool] : undefined;
  if (!def) return <EmptyState icon={Wrench} title={t('app.wv_unknown')} />;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t(`sidebar.${def.title}`, { defaultValue: def.title.replace(/_/g, ' ') }) }} />
      {def.kind === 'public' ? <PublicWebView url={def.url} allowOrigins={def.origins} /> : <WebSessionView path={def.path} campusId={campusId} />}
    </View>
  );
}
