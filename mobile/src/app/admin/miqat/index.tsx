import { Stack } from 'expo-router';
import { AlertTriangle, CheckCircle2, Clock, LogIn, LogOut, Radio, XCircle, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { todayYmd } from '@/components/app/date-field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminMiqat } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const LIVE_POLL_MS = 15_000;

function Tile({ label, value, icon, tone }: { label: string; value: string | number; icon?: LucideIcon; tone?: string }) {
  return (
    <View className="border-border bg-card rounded-xl border p-4" style={{ width: '47.5%' }}>
      <View className="flex-row items-center gap-1.5">
        {icon ? <Icon as={icon} className={cn('size-4', tone)} /> : null}
        <Text className="text-muted-foreground text-xs">{label}</Text>
      </View>
      <Text className="mt-1 text-3xl font-bold">{value}</Text>
    </View>
  );
}

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
              <View className="flex-row flex-wrap gap-3">
                <Tile label={m('attendanceToday')} value={summary.isLoading ? '—' : `${pct}%`} />
                <Tile label={m('present')} value={present} icon={CheckCircle2} tone="text-green-600" />
                <Tile label={m('late')} value={late} icon={Clock} tone="text-amber-600" />
                <Tile label={m('absent')} value={absent} icon={XCircle} tone="text-red-600" />
              </View>
              {unclosed > 0 ? (
                <View className="flex-row items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <Icon as={AlertTriangle} className="size-4 text-amber-800" />
                  <Text className="flex-1 text-sm text-amber-800">{m('unclosedWarning', { count: unclosed })}</Text>
                </View>
              ) : null}
              {!summary.isLoading && total === 0 ? <Text variant="muted" className="text-sm">{m('noData')}</Text> : null}
              {live.data ? (
                <View className="gap-2">
                  <View className="flex-row items-center gap-2">
                    <Icon as={Radio} className="size-4 text-emerald-600" />
                    <Text className="text-sm font-medium">{m('liveSoFar')}</Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Tile label={m('livePresent')} value={live.data.present} icon={CheckCircle2} tone="text-green-600" />
                    <Tile label={m('liveLate')} value={live.data.late} icon={Clock} tone="text-amber-600" />
                  </View>
                </View>
              ) : null}
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Radio} className="size-4 text-emerald-600" />
                  <Text className="font-semibold">{m('liveActivity')}</Text>
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
              <View className="flex-row items-center gap-2 px-4 py-2.5">
                <Icon as={inn ? LogIn : LogOut} className={cn('size-4', inn ? 'text-green-600' : 'text-amber-600')} />
                <Text className="flex-1 text-sm">{`${e.profiles?.first_name ?? ''} ${e.profiles?.last_name ?? ''}`}</Text>
                <Text className="text-muted-foreground text-xs">{inn ? m('liveCheckIn') : m('liveCheckOut')}</Text>
                <Text className="text-muted-foreground text-xs">{time(e.device_time)}</Text>
              </View>
            );
          }}
        />
      </View>
    </>
  );
}
