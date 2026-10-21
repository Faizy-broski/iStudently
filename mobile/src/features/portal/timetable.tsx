import type { TodayClass } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { RowPill, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PortalError } from '@/features/portal/ui';
import { cn } from '@/lib/utils';

/** `subtitle` replaces the teacher line (the teacher's own timetable shows the section). */
export type Entry = TodayClass & { subtitle?: string } & { period?: { period_number?: number; start_time?: string; end_time?: string } };
const COLORS = [colors.brandSecondary, colors.chart6, colors.success, colors.warning, colors.chart8, colors.chart7, colors.chart6, colors.destructive, colors.chart7, colors.brandAccent];
const PERIODS = Array.from({ length: 8 }, (_, i) => ({ n: i + 1, time: `${8 + i}:00` }));
const todayDow = () => (new Date().getDay() === 0 ? 7 : new Date().getDay());
const startOf = (e: Entry) => e.start_time || e.period?.start_time || '';
const endOf = (e: Entry) => e.end_time || e.period?.end_time || '';
const slot = (e: Entry) => e.period?.period_number ?? (startOf(e) ? Math.max(1, Math.min(8, parseInt(startOf(e).split(':')[0], 10) - 7)) : 1);
const ampm = (v: string) => {
  if (!v) return '--:--';
  const [h, m] = v.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const isNow = (e: Entry) => {
  if (e.day_of_week !== todayDow() || !startOf(e) || !endOf(e)) return false;
  const now = new Date().toTimeString().slice(0, 8);
  return now >= startOf(e) && now <= endOf(e);
};

type Res = { data?: Entry[]; isLoading: boolean; error?: Error | null; mutate: () => unknown };

/** Week grid and day list of a timetable (web: /student and /parent timetable); `text` overrides the copy for parents. */
export function TimetableView({ week, text }: { week: Res; text?: { title: string; subtitle: string } }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_tt_${key}`, o);
  const dayName = (d: number) => t(`common.days.${d % 7}`);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(todayDow);

  if (week.isLoading) return <LoadingList rows={6} />;
  if (week.error) {
    return (
      <View className="bg-background flex-1">
        <PortalError title={k('error')} message={week.error.message} />
        <Button variant="outline" size="sm" className="mx-4 self-start" onPress={() => week.mutate()}>
          <Text>{k('retry')}</Text>
        </Button>
      </View>
    );
  }
  const entries = (week.data ?? []) as Entry[];
  const subjects = [...new Set(entries.map((e) => e.subject?.id).filter(Boolean))];
  const color = (e: Entry) => COLORS[Math.max(0, subjects.indexOf(e.subject?.id)) % COLORS.length];
  const byDay = (d: number) => entries.filter((e) => e.day_of_week === d).sort((a, b) => startOf(a).localeCompare(startOf(b)));
  const today = todayDow();

  return (
    <>
      <Stack.Screen options={{ title: text?.title ?? k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => week.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {text?.subtitle ?? k('subtitle')}
        </Text>
        <StatTiles>
          <StatTile icon={Calendar} label={k('total')} value={String(entries.length)} />
          <StatTile icon={Clock} tone="success" label={k('today_n')} value={String(byDay(today).length)} />
          <StatTile icon={BookOpen} tone="warning" label={k('subjects')} value={String(new Set(entries.map((e) => e.subject?.id)).size)} />
        </StatTiles>
        <Segmented value={view} onChange={setView} options={[{ value: 'week', label: k('week') }, { value: 'day', label: k('day') }]} />

        {view === 'week' ? (
          entries.length ? (
            <ScrollView horizontal>
              <View className="gap-1">
                <View className="flex-row gap-1">
                  <Text className="text-muted-foreground w-14 p-2 text-center text-xs">{k('time')}</Text>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <View key={d} className={cn('w-24 items-center rounded-xl p-2', d === today ? 'bg-brand dark:bg-brand-secondary' : 'bg-info-soft')}>
                      <Text className={cn('text-xs font-semibold', d === today ? 'text-white' : 'text-brand dark:text-brand-secondary')}>{dayName(d)}</Text>
                    </View>
                  ))}
                </View>
                {PERIODS.map((p) => (
                  <View key={p.n} className="flex-row gap-1">
                    <View className="bg-muted/50 w-14 items-center justify-center rounded-xl p-1">
                      <Text className="text-muted-foreground text-xs font-medium">{`P${p.n}`}</Text>
                      <Text className="text-muted-foreground text-[10px]">{p.time}</Text>
                    </View>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const e = byDay(d).find((x) => slot(x) === p.n);
                      if (!e) return <View key={d} className={cn('min-h-16 w-24 rounded-xl border border-dashed', d === today ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border')} />;
                      const now = isNow(e);
                      return (
                        <View key={e.id} className={cn('min-h-16 w-24 rounded-xl p-1.5', now && 'border-2 border-warning')} style={{ backgroundColor: color(e) }}>
                          <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                            {e.subject?.name || t('app.st_unknown')}
                          </Text>
                          {e.subject?.code ? <Text className="text-[10px] text-white/80">{e.subject.code}</Text> : null}
                          {e.room_number ? <Text className="mt-0.5 text-[10px] text-white/80">{k('room', { n: e.room_number })}</Text> : null}
                          {now ? (
                            <View className="bg-warning mt-0.5 self-start rounded-full px-1.5">
                              <Text className="text-[10px] font-semibold text-white">{k('now')}</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <EmptyState icon={BookOpen} title={k('none')} body={k('none_body')} />
          )
        ) : (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setDay((d) => (d === 1 ? 7 : d - 1))} accessibilityRole="button" accessibilityLabel={k('prev_day')} className="bg-info-soft size-10 items-center justify-center rounded-full active:opacity-70">
                <Icon flipRtl as={ChevronLeft} className="text-brand dark:text-brand-secondary size-5" />
              </Pressable>
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-semibold">{dayName(day)}</Text>
                {day === today ? <StatusChip label={k('today')} tone="info" /> : <RowPill label={k('go_today')} onPress={() => setDay(today)} />}
              </View>
              <Pressable onPress={() => setDay((d) => (d === 7 ? 1 : d + 1))} accessibilityRole="button" accessibilityLabel={k('next_day')} className="bg-info-soft size-10 items-center justify-center rounded-full active:opacity-70">
                <Icon flipRtl as={ChevronRight} className="text-brand dark:text-brand-secondary size-5" />
              </Pressable>
            </View>
            {byDay(day).length ? (
              byDay(day).map((e) => {
                const now = isNow(e);
                return (
                  <Panel key={e.id} className={cn('flex-row overflow-hidden', now && 'border-warning border-2')}>
                    <View className="w-1.5" style={{ backgroundColor: color(e) }} />
                    <View className="flex-1 gap-2 p-4">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-base font-bold">{e.subject?.name || k('unknown')}</Text>
                        {e.subject?.code ? <StatusChip label={e.subject.code} tone="muted" /> : null}
                        {now ? <StatusChip label={k('ongoing')} tone="warning" /> : null}
                      </View>
                      <View className="flex-row flex-wrap gap-4">
                        <Meta icon={Clock} value={`${ampm(startOf(e))} - ${ampm(endOf(e))}`} />
                        {e.subtitle ? <Meta icon={Users} value={e.subtitle} /> : e.teacher?.profile ? <Meta icon={User} value={`${e.teacher.profile.first_name} ${e.teacher.profile.last_name}`} /> : null}
                        {e.room_number ? <Meta icon={MapPin} value={k('room', { n: e.room_number })} /> : null}
                      </View>
                    </View>
                  </Panel>
                );
              })
            ) : (
              <EmptyState icon={Calendar} title={k('free', { day: dayName(day) })} body={k('free_body')} />
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Meta({ icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={icon} className="text-muted-foreground size-3.5" />
      <Text className="text-muted-foreground text-xs">{value}</Text>
    </View>
  );
}
