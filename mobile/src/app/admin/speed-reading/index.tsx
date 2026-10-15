import { readingBadge } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, ListChecks, TrendingUp, Trophy, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ListRow } from '@/components/app/list-row';
import { PersonAvatar } from '@/components/app/person-avatar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';

function Stat({ icon, label, value }: { icon: LucideIcon; label: string; value: number | null }) {
  return (
    <Card className="flex-1">
      <CardContent className="gap-1 pt-4">
        <Icon as={icon} className="text-primary size-5" />
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className="text-2xl font-bold">{value === null ? '…' : value}</Text>
      </CardContent>
    </Card>
  );
}

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
        <View className="flex-row gap-2">
          <Stat icon={BookOpen} label={s('totalTexts')} value={loading ? null : (stats.data?.total_texts ?? 0)} />
          <Stat icon={Users} label={s('totalSessions')} value={loading ? null : (stats.data?.total_sessions ?? 0)} />
          <Stat icon={TrendingUp} label={s('topWpmWeek')} value={loading ? null : (stats.data?.top_wpm_this_week ?? 0)} />
        </View>
        <Card>
          <CardContent className="py-1">
            <ListRow title={s('manageTexts')} leading={<Icon as={BookOpen} className="text-primary size-5" />} onPress={() => router.push('/admin/speed-reading/texts')} />
            <ListRow title={s('sessions.title')} leading={<Icon as={ListChecks} className="text-primary size-5" />} onPress={() => router.push('/admin/speed-reading/sessions')} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-2 pt-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Trophy} className="size-5 text-yellow-500" />
              <Text className="font-semibold">{s('leaderboard')}</Text>
            </View>
            {board.isLoading ? (
              <LoadingList rows={4} />
            ) : !rows.length ? (
              <Text className="text-muted-foreground py-4 text-center text-sm">{s('noSessions')}</Text>
            ) : (
              rows.map((e, i) => {
                const badge = readingBadge(e.best_wpm);
                return (
                  <View key={e.student_id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="flex-row items-center gap-3 py-2">
                      <Text className="text-muted-foreground w-7 text-sm font-semibold">#{i + 1}</Text>
                      <PersonAvatar name={`${e.first_name} ${e.last_name}`} url={e.profile_photo_url} size={36} />
                      <View className="flex-1">
                        <Text className="font-medium">
                          {e.first_name} {e.last_name}
                        </Text>
                        <Text className="text-muted-foreground text-xs">
                          {s('totalPoints')}: {e.total_points} · {s('bestWpm')}: {e.best_wpm} WPM · {t('app.sr_sessions_n', { count: e.sessions })}
                        </Text>
                      </View>
                      <Badge variant="outline">
                        <Text className="text-xs">
                          {badge.emoji} {badge.label}
                        </Text>
                      </Badge>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}
