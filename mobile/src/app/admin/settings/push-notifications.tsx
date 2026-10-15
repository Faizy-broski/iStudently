import { Stack } from 'expo-router';
import { BellRing, CheckCircle2, FlaskConical, Info, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminPush } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Web push status, subscribers by role, and a test send (web: /admin/settings/push-notifications). */
export default function PushNotificationsSettings() {
  const { t } = useTranslation();
  const n = (k: string, o?: Record<string, unknown>) => t(`school.push_notifications.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'push-stats', campusId ?? 'school'], () => adminPush.stats(campusId));
  const [testing, setTesting] = useState(false);

  async function test() {
    setTesting(true);
    try {
      const r = await adminPush.sendTest();
      if (!r.success || !r.data) return toast.error(r.error || n('msg_test_error'));
      toast.success(n('msg_test_success', { count: r.data.sent }));
    } finally {
      setTesting(false);
    }
  }

  if (res.isLoading) return <LoadingList />;
  if (res.error || !res.data) return <ErrorState message={n('err_load_failed')} onRetry={() => res.mutate()} />;
  const stats = res.data;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: n('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-2">
          <Icon as={BellRing} className="text-foreground mt-0.5 size-5" />
          <Text className="text-muted-foreground flex-1 text-sm">{n('subtitle')}</Text>
        </View>

        <Card>
          <CardContent className="gap-2 pt-4">
            <Text className="font-semibold">{n('card_status_title')}</Text>
            {stats.isConfigured ? (
              <View className="flex-row items-center gap-1.5 self-start rounded-full border border-green-300 px-2 py-0.5 dark:border-green-800">
                <Icon as={CheckCircle2} className="size-3.5 text-green-700 dark:text-green-400" />
                <Text className="text-xs text-green-700 dark:text-green-400">{n('status_configured')}</Text>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-1.5 self-start rounded-full border border-red-300 px-2 py-0.5 dark:border-red-800">
                  <Icon as={XCircle} className="size-3.5 text-red-700 dark:text-red-400" />
                  <Text className="text-xs text-red-700 dark:text-red-400">{n('status_not_configured')}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">{n('status_not_configured_hint')}</Text>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="gap-3 pt-4">
            <View>
              <Text className="font-semibold">{n('card_subscribers_title')}</Text>
              <Text className="text-muted-foreground text-sm">{n('card_subscribers_subtitle')}</Text>
            </View>
            <View>
              <Text className="text-3xl font-bold">{stats.total}</Text>
              <Text className="text-muted-foreground text-xs">{n('label_total')}</Text>
            </View>
            {stats.total > 0 ? (
              <View className="gap-1.5">
                <Text className="text-muted-foreground text-xs font-medium">{n('label_by_role')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {Object.entries(stats.byRole).map(([role, count]) => (
                    <View key={role} className="bg-secondary rounded-full px-2 py-0.5">
                      <Text className="text-xs capitalize">
                        {role}: {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text className="text-muted-foreground text-sm">{n('no_subscribers')}</Text>
            )}
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={FlaskConical} className="text-foreground size-4" />
              <Text className="font-semibold">{n('card_test_title')}</Text>
            </View>
            <Text className="text-muted-foreground text-sm">{n('card_test_subtitle')}</Text>
            <View className="flex-row gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <Icon as={Info} className="size-4 text-blue-600" />
              <Text className="flex-1 text-xs text-blue-800 dark:text-blue-200">{t('app.push_test_browser_note')}</Text>
            </View>
            <Button variant="outline" className="self-start" onPress={test} disabled={testing || !stats.isConfigured}>
              <Text>{testing ? n('btn_testing') : n('btn_send_test')}</Text>
            </Button>
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
