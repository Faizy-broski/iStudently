import { router, Stack } from 'expo-router';
import { Eye, Mic, MicOff, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminSpeedReading } from '@/lib/api';
import { usePagedApi } from '@/lib/data';

/** Student reading sessions, 20 per page: review or delete (web: /admin/speed-reading/sessions). */
export default function SpeedReadingSessions() {
  const { t, i18n } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.sessions.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const logs = usePagedApi('sr-logs', (page) => adminSpeedReading.logs({ page, limit: 20 }));

  async function remove(id: string) {
    if (!(await confirm({ title: s('deleteSession'), body: s('deleteSessionConfirm'), destructive: true, confirmLabel: s('delete') }))) return;
    const r = await adminSpeedReading.deleteLog(id);
    if (!r.success) return toast.error(r.error || '');
    logs.mutate();
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <FlatList
        data={logs.items}
        keyExtractor={(l) => l.id}
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => logs.mutate()} />}
        onEndReached={logs.loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={logs.total != null ? <Text className="text-muted-foreground text-sm">{s('sessionsTotal', { total: logs.total })}</Text> : null}
        ListEmptyComponent={logs.isLoading ? <LoadingList rows={6} /> : <EmptyState title={t('speedReading.noSessions')} />}
        renderItem={({ item: l }) => (
          <Card>
            <CardContent className="gap-2 pt-4">
              <View className="flex-row items-start gap-2">
                <View className="flex-1">
                  <Text className="font-semibold">{l.student_name ?? '—'}</Text>
                  <Text className="text-muted-foreground text-xs">
                    {l.text_title ?? '—'} · {new Date(l.created_at).toLocaleDateString(i18n.language)}
                  </Text>
                </View>
                <Icon as={l.audio_url ? Mic : MicOff} className={l.audio_url ? 'size-4 text-green-600' : 'text-muted-foreground size-4'} />
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <Text className="text-xs">{l.target_wpm} WPM</Text>
                </Badge>
                <Text className="text-xs">
                  {s('colAccuracy')}: {l.accuracy_percentage.toFixed(1)}% · {s('colPoints')}: {l.points_earned}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button size="sm" variant="outline" className="flex-1" onPress={() => router.push({ pathname: '/admin/speed-reading/sessions/[id]', params: { id: l.id } })}>
                  <Icon as={Eye} className="text-foreground size-4" />
                  <Text>{s('review')}</Text>
                </Button>
                <Pressable onPress={() => remove(l.id)} hitSlop={6} className="items-center justify-center px-3" accessibilityLabel={s('delete')}>
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Pressable>
              </View>
            </CardContent>
          </Card>
        )}
      />
    </View>
  );
}
