import { readingBadge } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, ListChecks, TrendingUp, Trophy, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { PersonAvatar } from '@/components/app/person-avatar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Speed Reading overview: totals and the reading leaderboard (web: /admin/speed-reading). */
export default function SpeedReadingOverview() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.${k}`, o);
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const stats = useApi(schoolId ? ['admin', 'sr-stats', schoolId] : null, ([, , sc]) => adminSpeedReading.dashboard(sc as string));
  const board = useApi(schoolId ? ['admin', 'sr-leaderboard', schoolId] : null, ([, , sc]) => adminSpeedReading.leaderboard(sc as string));
  const loading = stats.isLoading;
  const rows = board.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (stats.mutate(), board.mutate())} />}>
        <StatTiles>
          <StatTile icon={BookOpen} label={s('totalTexts')} value={loading ? '…' : String(stats.data?.total_texts ?? 0)} />
          <StatTile icon={Users} tone="success" label={s('totalSessions')} value={loading ? '…' : String(stats.data?.total_sessions ?? 0)} />
          <StatTile icon={TrendingUp} tone="warning" label={s('topWpmWeek')} value={loading ? '…' : String(stats.data?.top_wpm_this_week ?? 0)} />
        </StatTiles>
        <Panel>
          <RowItem title={s('manageTexts')} leading={<IconTile icon={BookOpen} size={40} />} onPress={() => router.push('/admin/speed-reading/texts')} />
          <RowItem title={s('sessions.title')} leading={<IconTile icon={ListChecks} tone="success" size={40} />} onPress={() => router.push('/admin/speed-reading/sessions')} last />
        </Panel>
        <Section title={s('leaderboard')}>
          {board.isLoading ? (
            <LoadingList rows={4} />
          ) : !rows.length ? (
            <EmptyState icon={Trophy} title={s('noSessions')} />
          ) : (
            <Panel>
              {rows.map((e, i) => {
                const badge = readingBadge(e.best_wpm);
                return (
                  <RowItem
                    key={e.student_id}
                    leading={
                      <View className="flex-row items-center gap-2">
                        <View className={cn('size-7 items-center justify-center rounded-full', i < 3 ? 'bg-warning-soft' : 'bg-muted')}>
                          <Text className={cn('text-xs font-bold', i < 3 ? 'text-warning' : 'text-muted-foreground')}>{i + 1}</Text>
                        </View>
                        <PersonAvatar name={`${e.first_name} ${e.last_name}`} url={e.profile_photo_url} size={36} />
                      </View>
                    }
                    title={`${e.first_name} ${e.last_name}`}
                    meta={`${s('totalPoints')}: ${e.total_points} · ${s('bestWpm')}: ${e.best_wpm} WPM · ${t('app.sr_sessions_n', { count: e.sessions })}`}
                    trailing={<StatusChip label={`${badge.emoji} ${badge.label}`} tone="info" />}
                    last={i === rows.length - 1}
                  />
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}
