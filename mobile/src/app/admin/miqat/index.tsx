import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, LogIn, LogOut, Radio, XCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { todayYmd } from '@/components/app/date-field';
import { HeroCard, IconTile, StatTile, StatTiles } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';

const LIVE_POLL_MS = 15_000;

/** Miqat dashboard: today's rollup, live counts and live scans every 15s (web: /admin/miqat/dashboard). */
export default function MiqatDashboard() {
  const { t, i18n } = useTranslation();
  const m = (k: string, o?: Record<string, unknown>) => t(`miqat.dashboard.${k}`, o);
  const { campusId } = useCampus();
  const today = todayYmd();
  const summary = useApi(['admin', 'miqat-summary', campusId ?? 'school', today], () => adminMiqat.summary(today, today, campusId));
  const live = useApi(['admin', 'miqat-live', campusId ?? 'school', today], () => adminMiqat.liveSummary(today, campusId), { refreshInterval: LIVE_POLL_MS });
  const events = useApi(['admin', 'miqat-day', campusId ?? 'school', today], () => adminMiqat.day(today, undefined, campusId), { refreshInterval: LIVE_POLL_MS });
  const rows = summary.data ?? [];
  const total = rows.length;
  const present = rows.filter((r) => r.status === 'present').length;
  const late = rows.filter((r) => r.status === 'late').length;
  const absent = rows.filter((r) => r.status === 'absent').length;
  const unclosed = rows.filter((r) => r.status === 'unclosed').length;
  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
  const sorted = [...(events.data ?? [])].sort((a, b) => new Date(b.device_time).getTime() - new Date(a.device_time).getTime());
  const time = (iso: string) => new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso));

  return (
    <>
      <Stack.Screen options={{ title: m('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-4 p-4">
              <HeroCard>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-white/85">{m('attendanceToday')}</Text>
                  <Text className="text-2xl font-bold text-white">{summary.isLoading ? '—' : `${pct}%`}</Text>
                </View>
                <View className="h-2.5 overflow-hidden rounded-full bg-white/20">
                  <View className="h-2.5 rounded-full bg-white" style={{ width: `${Math.min(pct, 100)}%` }} />
                </View>
              </HeroCard>
              <StatTiles>
                <StatTile label={m('present')} value={String(present)} icon={CheckCircle2} tone="success" />
                <StatTile label={m('late')} value={String(late)} icon={Clock} tone="warning" />
                <StatTile label={m('absent')} value={String(absent)} icon={XCircle} tone="destructive" />
              </StatTiles>
              {unclosed > 0 ? (
                <View className="flex-row items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3">
                  <Icon as={AlertTriangle} className="size-4 text-warning" />
                  <Text className="flex-1 text-sm text-warning">{m('unclosedWarning', { count: unclosed })}</Text>
                </View>
              ) : null}
              {!summary.isLoading && total === 0 ? <Text variant="muted" className="text-sm">{m('noData')}</Text> : null}
              {live.data ? (
                <View className="gap-2">
                  <View className="flex-row items-center gap-2">
                    <Icon as={Radio} className="size-4 text-success" />
                    <Text className="text-base font-semibold">{m('liveSoFar')}</Text>
                  </View>
                  <StatTiles>
                    <StatTile label={m('livePresent')} value={String(live.data.present)} icon={CheckCircle2} tone="success" />
                    <StatTile label={m('liveLate')} value={String(live.data.late)} icon={Clock} tone="warning" />
                  </StatTiles>
                </View>
              ) : null}
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Radio} className="size-4 text-success" />
                  <Text className="text-base font-semibold">{m('liveActivity')}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">{m('liveActivityHint')}</Text>
              </View>
            </View>
          }
          items={events.data ? sorted : undefined}
          error={events.error}
          isLoading={events.isLoading}
          isRefreshing={summary.isValidating && !summary.isLoading}
          onRefresh={() => {
            summary.mutate();
            live.mutate();
            events.mutate();
          }}
          emptyTitle={m('liveNoData')}
          keyExtractor={(e) => e.id}
          renderItem={(e) => {
            const inn = e.event_type === 'check_in';
            return (
              <View className="flex-row items-center gap-3 px-4 py-3">
                <IconTile icon={inn ? LogIn : LogOut} tone={inn ? 'success' : 'warning'} round />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{`${e.profiles?.first_name ?? ''} ${e.profiles?.last_name ?? ''}`}</Text>
                  <Text className="text-muted-foreground text-xs">{time(e.device_time)}</Text>
                </View>
                <StatusChip label={inn ? m('liveCheckIn') : m('liveCheckOut')} tone={inn ? 'success' : 'warning'} />
              </View>
            );
          }}
        />
      </View>
    </>
  );
}
