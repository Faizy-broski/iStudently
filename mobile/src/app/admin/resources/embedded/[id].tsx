import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { PublicWebView } from '@/components/app/web-session-view';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

/** One embedded resource inside the app (web: /admin/resources/embedded/[id]). */
export default function AdminEmbedView() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.resourcesEmbeddedDetail.${key}`);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campusId } = useCampus();
  // Same list (and cache) as the embedded resources manager.
  const list = useApi(['admin', 'embedded', campusId ?? 'school'], () => adminResources.embedded(campusId), { revalidateOnFocus: false });
  if (list.isLoading) return <LoadingList rows={3} />;
  const r = (list.data ?? []).find((x) => x.id === id);
  if (!r) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Icon as={AlertTriangle} className="text-warning size-10" />
        <Text className="text-lg font-medium">{k('resourceNotFound')}</Text>
      </View>
    );
  }
  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          title: r.title,
          headerRight: () => (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(r.url)} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('openInNewTab')}>
              <Icon as={ExternalLink} className="size-5" />
            </Pressable>
          ),
        }}
      />
      <PublicWebView url={r.url} />
    </View>
  );
}
