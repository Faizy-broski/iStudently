import { router, Stack } from 'expo-router';
import { BookOpen, ChevronLeft, ChevronRight, Mic, MicOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { ListCard } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

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
        contentContainerClassName="gap-2.5 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}
        ListHeaderComponent={!res.isLoading ? <Text className="text-muted-foreground mb-2 text-sm">{a('sessions_done', { count: total })}</Text> : null}
        ListEmptyComponent={
          res.isLoading ? (
            <LoadingList rows={6} />
          ) : (
            <EmptyState icon={BookOpen} title={a('no_history')} actionLabel={a('start')} onAction={() => router.push('/student/speed-reading')} />
          )
        }
        renderItem={({ item: l }) => (
          <ListCard onPress={() => router.push({ pathname: '/student/speed-reading/history/[id]', params: { id: l.id } })}>
            <IconTile icon={l.audio_url ? Mic : MicOff} tone={l.audio_url ? 'success' : 'muted'} size={40} />
            <View className="flex-1 gap-1">
              <Text className="text-sm font-semibold" numberOfLines={1} accessibilityLabel={`${l.text_title ?? '—'}, ${l.audio_url ? a('recording') : a('no_recording')}`}>
                {l.text_title ?? '—'}
              </Text>
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="text-muted-foreground text-xs">{formatDate(l.created_at)}</Text>
                <StatusChip label={a('wpm', { wpm: l.target_wpm })} tone="info" className="px-2 py-0.5" />
                <StatusChip label={`${l.accuracy_percentage.toFixed(1)}%`} tone={l.accuracy_percentage >= 80 ? 'success' : l.accuracy_percentage >= 60 ? 'warning' : 'destructive'} className="px-2 py-0.5" />
                <Text className="text-xs font-semibold">{a('pts', { count: l.points_earned })}</Text>
              </View>
            </View>
          </ListCard>
        )}
        ListFooterComponent={
          pages > 1 ? (
            <View className="mt-2 flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">{a('page', { page, total: pages })}</Text>
              <View className="flex-row gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onPress={() => setPage((p) => p - 1)} accessibilityLabel={a('prev')}>
                  <Icon flipRtl as={ChevronLeft} className="size-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onPress={() => setPage((p) => p + 1)} accessibilityLabel={a('next')}>
                  <Icon flipRtl as={ChevronRight} className="size-4" />
                </Button>
              </View>
            </View>
          ) : null
        }
      />
    </>
  );
}
