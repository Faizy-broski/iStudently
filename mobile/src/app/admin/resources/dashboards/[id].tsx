import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, LayoutDashboard, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { EmptyState, LoadingList } from '@/components/app/states';
import { PublicWebView, WebSessionView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminResources } from '@/lib/api';
import { useApi } from '@/lib/data';

/** A dashboard: each element is a Studently page (signed in) or an external page, stacked full width (web: /admin/resources/dashboards/[id]). */
export default function DashboardView() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campusId } = useCampus();
  const res = useApi(id ? ['admin', 'resource-dashboard', id] : null, ([, , did]) => adminResources.dashboard(did as string));
  if (res.isLoading) return <LoadingList />;
  const dash = res.data;
  if (!dash) return <EmptyState icon={AlertCircle} title={t('app.rd_not_found')} body={t('app.rd_not_found_body')} />;
  const elements = [...(dash.elements ?? dash.dashboard_elements ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const configure = () => router.push({ pathname: '/admin/resources/dashboards/configure', params: { id: dash.id } });

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: dash.title }} />
      <ScrollView contentContainerClassName="gap-3 p-3 pb-10">
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground flex-1 text-sm">{dash.description ?? ''}</Text>
          <Button size="sm" variant="outline" onPress={configure}>
            <Icon as={Settings} className="text-foreground size-3.5" />
            <Text>{t('app.rd_configure')}</Text>
          </Button>
        </View>
        {!elements.length ? (
          <View className="items-center gap-3 py-12">
            <Icon as={LayoutDashboard} className="text-muted-foreground size-10" />
            <Text className="text-sm font-semibold">{t('app.rd_no_elements')}</Text>
            <EmptyState title={t('app.rd_no_elements_body')} />
            <Button variant="outline" onPress={configure}>
              <Text>{t('app.rd_configure_dashboard')}</Text>
            </Button>
          </View>
        ) : (
          elements.map((el) => (
            <View key={el.id} className="border-info-soft dark:border-border overflow-hidden rounded-xl border" style={{ height: el.height_px || 400 }}>
              {el.url.startsWith('http') ? (
                <PublicWebView url={el.url} css={el.custom_css} refreshMinutes={el.refresh_minutes} />
              ) : (
                <WebSessionView path={el.url.startsWith('/') ? el.url : `/${el.url}`} css={el.custom_css} refreshMinutes={el.refresh_minutes} campusId={campusId} />
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
