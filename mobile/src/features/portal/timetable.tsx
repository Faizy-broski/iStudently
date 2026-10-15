import type { TodayClass } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Clock, MapPin, User, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PortalError } from '@/features/portal/ui';
import { cn } from '@/lib/utils';

/** `subtitle` replaces the teacher line (the teacher's own timetable shows the section). */
export type Entry = TodayClass & { subtitle?: string } & { period?: { period_number?: number; start_time?: string; end_time?: string } };
const COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#6366f1', '#f43f5e', '#14b8a6', '#f59e0b'];
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
        <Text variant="muted">{text?.subtitle ?? k('subtitle')}</Text>
        <View className="flex-row gap-2">
          <Stat icon={Calendar} tone="bg-blue-100 text-blue-600" label={k('total')} value={entries.length} />
          <Stat icon={Clock} tone="bg-green-100 text-green-600" label={k('today_n')} value={byDay(today).length} />
          <Stat icon={BookOpen} tone="bg-purple-100 text-purple-600" label={k('subjects')} value={new Set(entries.map((e) => e.subject?.id)).size} />
        </View>
        <FilterChips value={view} onChange={setView} options={[{ value: 'week', label: k('week') }, { value: 'day', label: k('day') }]} />

        {view === 'week' ? (
          entries.length ? (
            <ScrollView horizontal>
              <View className="gap-1">
                <View className="flex-row gap-1">
                  <Text className="text-muted-foreground w-14 p-2 text-center text-xs">{k('time')}</Text>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <View key={d} className={cn('w-24 items-center rounded-t-lg p-2', d === today ? 'bg-primary' : 'bg-muted')}>
                      <Text className={cn('text-xs font-medium', d === today ? 'text-primary-foreground' : 'text-muted-foreground')}>{dayName(d)}</Text>
                    </View>
                  ))}
                </View>
                {PERIODS.map((p) => (
                  <View key={p.n} className="flex-row gap-1">
                    <View className="bg-muted/50 w-14 items-center justify-center rounded-s-lg p-1">
                      <Text className="text-muted-foreground text-xs font-medium">{`P${p.n}`}</Text>
                      <Text className="text-muted-foreground text-[10px]">{p.time}</Text>
                    </View>
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                      const e = byDay(d).find((x) => slot(x) === p.n);
                      if (!e) return <View key={d} className={cn('min-h-16 w-24 rounded-lg border border-dashed', d === today ? 'border-primary/30 bg-primary/5' : 'border-muted')} />;
                      const now = isNow(e);
                      return (
                        <View key={e.id} className={cn('min-h-16 w-24 rounded-lg p-1.5', now && 'border-2 border-yellow-400')} style={{ backgroundColor: color(e) }}>
                          <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                            {e.subject?.name || t('app.st_unknown')}
                          </Text>
                          {e.subject?.code ? <Text className="text-[10px] text-white/80">{e.subject.code}</Text> : null}
                          {e.room_number ? <Text className="mt-0.5 text-[10px] text-white/80">{k('room', { n: e.room_number })}</Text> : null}
                          {now ? (
                            <View className="mt-0.5 self-start rounded bg-yellow-400 px-1">
                              <Text className="text-[10px] text-yellow-900">{k('now')}</Text>
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
            <Card>
              <CardContent className="items-center p-8">
                <Icon as={BookOpen} className="text-muted-foreground mb-3 size-14" />
                <Text className="mb-1 text-lg font-semibold">{k('none')}</Text>
                <Text className="text-muted-foreground text-center">{k('none_body')}</Text>
              </CardContent>
            </Card>
          )
        ) : (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Button size="icon" variant="outline" onPress={() => setDay((d) => (d === 1 ? 7 : d - 1))} accessibilityLabel={k('prev_day')}>
                <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
              </Button>
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-semibold">{dayName(day)}</Text>
                {day === today ? (
                  <Badge>
                    <Text>{k('today')}</Text>
                  </Badge>
                ) : (
                  <Button variant="ghost" size="sm" onPress={() => setDay(today)}>
                    <Text>{k('go_today')}</Text>
                  </Button>
                )}
              </View>
              <Button size="icon" variant="outline" onPress={() => setDay((d) => (d === 7 ? 1 : d + 1))} accessibilityLabel={k('next_day')}>
                <Icon as={ChevronRight} className="size-4 rtl:rotate-180" />
              </Button>
            </View>
            {byDay(day).length ? (
              byDay(day).map((e) => {
                const now = isNow(e);
                return (
                  <Card key={e.id} className={cn('gap-0 overflow-hidden py-0', now && 'border-2 border-yellow-400')}>
                    <View className="h-2" style={{ backgroundColor: color(e) }} />
                    <CardContent className="gap-2 p-4">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-lg font-bold">{e.subject?.name || k('unknown')}</Text>
                        {e.subject?.code ? (
                          <Badge variant="outline">
                            <Text>{e.subject.code}</Text>
                          </Badge>
                        ) : null}
                        {now ? (
                          <View className="rounded bg-yellow-400 px-2 py-0.5">
                            <Text className="text-xs text-yellow-900">{k('ongoing')}</Text>
                          </View>
                        ) : null}
                      </View>
                      <View className="flex-row flex-wrap gap-4">
                        <Meta icon={Clock} value={`${ampm(startOf(e))} - ${ampm(endOf(e))}`} />
                        {e.subtitle ? <Meta icon={Users} value={e.subtitle} /> : e.teacher?.profile ? <Meta icon={User} value={`${e.teacher.profile.first_name} ${e.teacher.profile.last_name}`} /> : null}
                        {e.room_number ? <Meta icon={MapPin} value={k('room', { n: e.room_number })} /> : null}
                      </View>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Card>
                <CardContent className="items-center p-8">
                  <Icon as={Calendar} className="text-muted-foreground mb-3 size-14" />
                  <Text className="mb-1 text-lg font-semibold">{k('free', { day: dayName(day) })}</Text>
                  <Text className="text-muted-foreground text-center">{k('free_body')}</Text>
                </CardContent>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Stat({ icon, tone, label, value }: { icon: LucideIcon; tone: string; label: string; value: number }) {
  return (
    <Card className="flex-1 py-3">
      <CardContent className="items-center gap-1 px-2">
        <View className={cn('rounded-lg p-2', tone)}>
          <Icon as={icon} className={cn('size-5', tone)} />
        </View>
        <Text className="text-muted-foreground text-center text-xs">{label}</Text>
        <Text className="text-2xl font-bold">{String(value)}</Text>
      </CardContent>
    </Card>
  );
}

function Meta({ icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground text-sm">{value}</Text>
    </View>
  );
}
