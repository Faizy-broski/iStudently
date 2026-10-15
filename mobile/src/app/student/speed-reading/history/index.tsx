import { router, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, Mic, MicOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** The student's finished reading sessions, 20 per page (web: /student/speed-reading/history). */
export default function StudentReadingHistory() {
  const { t } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.srs_${k}`, o);
  const [page, setPage] = useState(1);
  const res = useApi(['student', 'sr-logs', page], async ([, , p]) => {
    const r = await adminSpeedReading.myLogs(p as number, 20);
    return { ...r, data: { rows: r.data ?? [], total: r.pagination?.total ?? r.data?.length ?? 0, pages: r.pagination?.totalPages ?? 1 } };
  });
  const logs = res.data?.rows ?? [];
  const total = res.data?.total ?? 0;
  const pages = res.data?.pages ?? 1;

  return (
    <>
      <Stack.Screen options={{ title: a('history') }} />
      <FlatList
        className="bg-background flex-1"
        data={logs}
        keyExtractor={(l) => l.id}
        contentContainerClassName="gap-2 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}
        ListHeaderComponent={!res.isLoading ? <Text className="text-muted-foreground mb-2 text-sm">{a('sessions_done', { count: total })}</Text> : null}
        ListEmptyComponent={
          res.isLoading ? (
            <LoadingList rows={6} />
          ) : (
            <View className="items-center py-12">
              <Text className="mb-2 text-4xl">📖</Text>
              <Text className="text-muted-foreground text-center">{a('no_history')}</Text>
              <Button className="mt-4" onPress={() => router.push('/student/speed-reading')}>
                <Text>{a('start')}</Text>
              </Button>
            </View>
          )
        }
        renderItem={({ item: l }) => (
          <Pressable onPress={() => router.push({ pathname: '/student/speed-reading/history/[id]', params: { id: l.id } })} accessibilityRole="button" className="border-border bg-card gap-1.5 rounded-lg border p-3">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-medium" numberOfLines={1}>
                {l.text_title ?? '—'}
              </Text>
              <Icon as={l.audio_url ? Mic : MicOff} className={l.audio_url ? 'size-4 text-green-500' : 'text-muted-foreground size-4'} accessibilityLabel={l.audio_url ? a('recording') : a('no_recording')} />
            </View>
            <View className="flex-row flex-wrap items-center gap-3">
              <Text className="text-muted-foreground text-xs">{formatDate(l.created_at)}</Text>
              <Badge variant="secondary">
                <Text className="text-xs">{a('wpm', { wpm: l.target_wpm })}</Text>
              </Badge>
              <Text className={cn('text-xs font-medium', l.accuracy_percentage >= 80 ? 'text-green-600' : l.accuracy_percentage >= 60 ? 'text-amber-600' : 'text-red-600')}>{`${l.accuracy_percentage.toFixed(1)}%`}</Text>
              <Text className="text-xs font-medium">{a('pts', { count: l.points_earned })}</Text>
            </View>
          </Pressable>
        )}
        ListFooterComponent={
          pages > 1 ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">{a('page', { page, total: pages })}</Text>
              <View className="flex-row gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} accessibilityLabel={a('prev')}>
                  <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage((p) => p + 1)} accessibilityLabel={a('next')}>
                  <Icon as={ChevronRight} className="size-4 rtl:rotate-180" />
                </Button>
              </View>
            </View>
          ) : null
        }
      />
    </>
  );
}
