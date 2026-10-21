import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, Link2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Links the school shares with students (web: /student/resources). */
export function ResourceLinksScreen() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_rl_${key}`, o);
  const links = useApi(['student', 'resource-links'], () => adminResources.links());
  const list = links.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => links.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm">{links.isLoading ? t('common.loading') : k('count', { count: list.length })}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {links.isLoading ? (
              <LoadingList rows={3} />
            ) : list.length === 0 ? (
              <EmptyState title={k('empty')} />
            ) : (
              list.map((l) => (
                <Pressable key={l.id} onPress={() => WebBrowser.openBrowserAsync(l.url)} accessibilityRole="link" className="border-info-soft dark:border-border flex-row items-center gap-3 rounded-xl border p-3">
                  <Icon as={Link2} className="size-5 text-chart-7" />
                  <View className="flex-1">
                    <Text className="font-medium text-brand dark:text-brand-secondary">{l.title}</Text>
                    <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                      {l.url}
                    </Text>
                  </View>
                  <Icon as={ExternalLink} className="text-muted-foreground size-4" />
                </Pressable>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
