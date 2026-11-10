import { router, Stack } from 'expo-router';
import { BookOpen, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, Coffee, GraduationCap, MapPin, Users, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { usePortalAcademic } from '@/features/portal/academic';
import i18n from '@/i18n';
import { adminAcademics, adminTimetable } from '@/lib/api';
import { colors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

// Web day_of_week: 0 = Monday … 6 = Sunday; the week grid shows Monday–Saturday.
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const WEEK_DAYS = [0, 1, 2, 3, 4, 5];
const SUBJECT_COLORS = [colors.brandSecondary, colors.success, colors.chart6, colors.warning, colors.chart8, colors.chart7, colors.brand, colors.brandAccent];
const todayIndex = () => (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '');

type View3 = 'week' | 'day' | 'list';

/** The teacher's timetable: stats, week grid, day list with attendance, and subjects (web: /teacher/timetable). */
export default function TeacherTimetable() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.timetable.${key}`, o);
  const dayLabel = (d: number) => k(`day_${DAYS[d]}`);
  const dayShort = (d: number) => k(`dayShort_${DAYS[d]}`);
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const academic = usePortalAcademic();
  const yearId = academic.year?.id ?? null;
  const res = useApi(staffId && yearId ? ['teacher', 'timetable', staffId, yearId] : null, ([, , s, y]) => adminTimetable.teacherTimetable(s as string, y as string));
  const periods = useApi(staffId ? ['teacher', 'periods'] : null, () => adminAcademics.periods());
  const [view, setView] = useState<View3>('week');
  const [today] = useState(todayIndex);
  const [day, setDay] = useState(() => Math.min(todayIndex(), WEEK_DAYS.length - 1));

  const entries = res.data ?? [];
  const subjectIds = [...new Set(entries.map((e) => e.subject_id))];
  const color = (subjectId: string) => SUBJECT_COLORS[Math.max(0, subjectIds.indexOf(subjectId)) % SUBJECT_COLORS.length];
  const slots = (periods.data ?? []).filter((p) => p.is_active).sort((a, b) => a.period_number - b.period_number);
  const cell = (d: number, n: number) => entries.find((e) => e.day_of_week === d && e.period?.period_number === n);
  const daySchedule = entries.filter((e) => e.day_of_week === day).sort((a, b) => (a.period?.period_number ?? 0) - (b.period?.period_number ?? 0));
  const teaching = entries.filter((e) => !e.period?.is_break);
  const stats = {
    total: teaching.length,
    today: teaching.filter((e) => e.day_of_week === today).length,
    sections: new Set(entries.map((e) => e.section_id)).size,
    subjects: new Set(entries.map((e) => e.subject_id)).size,
  };
  const isCurrent = (e: (typeof entries)[number]) => {
    if (!e.period || e.day_of_week !== todayIndex()) return false;
    const now = new Date().toTimeString().slice(0, 5);
    return e.period.start_time <= now && now < e.period.end_time;
  };
  const goToAttendance = (id: string) => router.push({ pathname: '/teacher/attendance', params: { class: id } });

  const bySubject = Object.entries(
    entries.reduce<Record<string, { name: string; code?: string | null; sections: Set<string>; total: number; list: typeof entries }>>((acc, e) => {
      const g = (acc[e.subject_id] ??= { name: e.subject?.name || e.subject_name || k('unknown'), code: e.subject?.code, sections: new Set(), total: 0, list: [] });
      g.sections.add(e.section?.name || e.section_name || k('unknownSection'));
      g.total++;
      g.list.push(e);
      return acc;
    }, {})
  );

  const loading = res.isLoading || academic.isLoading;
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([res.mutate(), periods.mutate()])} />}>
        <Text variant="muted">{academic.year ? k('subtitleWithYear', { year: academic.year.name }) : k('subtitle')}</Text>
        <View className="border-border bg-card flex-row items-center gap-2 self-start rounded-full border px-3 py-1.5">
          <Icon as={Calendar} className="text-muted-foreground size-4" />
          <Text className="text-sm font-medium">{new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
        </View>

        {loading ? (
          <LoadingList rows={6} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : (
          <>
            {entries.length ? (
              <StatTiles>
                <StatTile icon={Calendar} label={k('classesPerWeek')} value={String(stats.total)} />
                <StatTile icon={Clock} tone="success" label={k('todaysClasses')} value={String(stats.today)} />
                <StatTile icon={Users} tone="brand" label={k('sections')} value={String(stats.sections)} />
                <StatTile icon={BookOpen} tone="warning" label={k('subjects')} value={String(stats.subjects)} />
              </StatTiles>
            ) : null}
            <Segmented<View3>
              value={view}
              onChange={setView}
              options={[
                { value: 'week', label: k('weekView') },
                { value: 'day', label: k('dayView') },
                { value: 'list', label: k('subjectList') },
              ]}
            />

            {view === 'week' ? (
              !entries.length ? (
                <EmptyState icon={Calendar} title={k('noClassesScheduled')} body={k('emptyTimetableHint')} />
              ) : (
                <ScrollView horizontal>
                  <View className="gap-1">
                    <View className="flex-row gap-1">
                      <View className="bg-brand dark:bg-brand-secondary w-20 justify-center rounded-xl p-2">
                        <Text className="text-xs font-semibold text-white">{k('time')}</Text>
                      </View>
                      {WEEK_DAYS.map((d) => (
                        <View key={d} className={cn('w-28 items-center gap-1 rounded-xl p-2', d === today ? 'bg-brand-accent' : 'bg-brand dark:bg-brand-secondary')}>
                          <Text className="text-xs font-semibold text-white">{dayLabel(d)}</Text>
                          {d === today ? (
                            <View className="rounded-full bg-white px-1.5">
                              <Text className="text-brand text-2xs font-semibold">{k('today')}</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                    {slots.map((slot) => (
                      <View key={slot.id} className="flex-row gap-1">
                        <View className={cn('w-20 justify-center rounded-xl p-2', slot.is_break ? 'bg-warning-soft' : 'bg-muted/60')}>
                          <Text className="text-xs font-medium" numberOfLines={1}>
                            {slot.is_break ? k('break') : slot.period_name || k('periodLabel', { number: slot.period_number })}
                          </Text>
                          <Text variant="muted" className="text-2xs">{`${hhmm(slot.start_time)} - ${hhmm(slot.end_time)}`}</Text>
                        </View>
                        {WEEK_DAYS.map((d) => {
                          if (slot.is_break) {
                            return (
                              <View key={d} className="bg-warning-soft min-h-16 w-28 flex-row items-center justify-center gap-1 rounded-xl">
                                <Icon as={Coffee} className="text-warning size-3.5" />
                                <Text className="text-warning text-2xs">{k('break')}</Text>
                              </View>
                            );
                          }
                          const e = cell(d, slot.period_number);
                          if (!e) {
                            return (
                              <View key={d} className={cn('min-h-16 w-28 items-center justify-center rounded-xl border border-dashed', d === today ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border')}>
                                <Text className="text-muted-foreground text-xs">—</Text>
                              </View>
                            );
                          }
                          const now = isCurrent(e);
                          return (
                            <Pressable key={d} onPress={() => goToAttendance(e.id)} accessibilityRole="button" className={cn('min-h-16 w-28 gap-0.5 rounded-xl p-2 active:opacity-80', now && 'border-success border-2')} style={{ backgroundColor: color(e.subject_id) }}>
                              <Text className="text-xs font-semibold text-white" numberOfLines={1}>
                                {e.subject?.name || e.subject_name}
                              </Text>
                              <View className="flex-row items-center gap-1">
                                <Icon as={Users} className="size-3 text-white" />
                                <Text className="text-2xs text-white" numberOfLines={1}>
                                  {e.section?.name || e.section_name}
                                </Text>
                              </View>
                              {e.room_number ? (
                                <View className="flex-row items-center gap-1">
                                  <Icon as={MapPin} className="size-3 text-white" />
                                  <Text className="text-2xs text-white/80" numberOfLines={1}>
                                    {e.room_number}
                                  </Text>
                                </View>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )
            ) : view === 'day' ? (
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <RoundArrow icon={ChevronLeft} label={dayLabel(Math.max(0, day - 1))} disabled={day === 0} onPress={() => setDay(day - 1)} />
                  <ScrollView horizontal contentContainerClassName="gap-1.5" className="flex-1">
                    {WEEK_DAYS.map((d) => (
                      <Pressable key={d} onPress={() => setDay(d)} accessibilityRole="button" accessibilityState={{ selected: d === day }} className={cn('min-w-16 items-center rounded-full border px-3 py-1.5', d === day ? 'border-brand bg-brand dark:border-brand-secondary dark:bg-brand-secondary' : 'border-info-soft dark:border-border bg-card', d === today && d !== day && 'border-success')}>
                        <Text className={cn('text-xs font-semibold', d === day ? 'text-white' : 'text-foreground')}>{d === today ? `${dayShort(d)} ●` : dayShort(d)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <RoundArrow icon={ChevronRight} label={dayLabel(Math.min(WEEK_DAYS.length - 1, day + 1))} disabled={day === WEEK_DAYS.length - 1} onPress={() => setDay(day + 1)} />
                </View>
                <Panel className="flex-row items-center gap-3 p-4">
                  <Icon as={Calendar} className="text-brand dark:text-brand-secondary size-6" />
                  <View className="flex-1">
                    <Text className="text-lg font-bold">{k('daySchedule', { day: dayLabel(day) })}</Text>
                    <Text variant="muted" className="text-xs">
                      {k('classesScheduledCount', { count: daySchedule.filter((e) => !e.period?.is_break).length })}
                    </Text>
                  </View>
                  {day === today ? <StatusChip label={k('today')} tone="success" /> : null}
                </Panel>
                {!daySchedule.length ? (
                  <EmptyState icon={Clock} title={k('noClassesOnDay', { day: dayLabel(day) })} body={k('enjoyFreeDay')} />
                ) : (
                  daySchedule.map((e) =>
                    e.period?.is_break ? (
                      <View key={e.id} className="border-warning bg-warning-soft flex-row items-center gap-4 rounded-2xl border border-dashed p-4">
                        <View className="min-w-14 items-center">
                          <Text className="text-warning text-sm">{hhmm(e.period.start_time)}</Text>
                          <Text className="text-warning text-xs">{hhmm(e.period.end_time)}</Text>
                        </View>
                        <Text className="text-warning flex-1 text-center font-medium">{k('breakTime')}</Text>
                      </View>
                    ) : (
                      <Pressable key={e.id} onPress={() => goToAttendance(e.id)} accessibilityRole="button" className={cn('bg-card border-info-soft dark:border-border overflow-hidden rounded-2xl border active:opacity-80', isCurrent(e) && 'border-success border-2')}>
                        <View className="h-1" style={{ backgroundColor: color(e.subject_id) }} />
                        <View className="flex-row items-start gap-3 p-4">
                          <View className="min-w-16 items-center gap-1">
                            <Text className="text-brand dark:text-brand-secondary text-lg font-bold">{hhmm(e.period?.start_time)}</Text>
                            <Text variant="muted" className="text-xs">
                              {hhmm(e.period?.end_time)}
                            </Text>
                            <StatusChip label={`P${e.period?.period_number ?? ''}`} tone="muted" />
                          </View>
                          <View className="flex-1 gap-2">
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Text className="text-lg font-bold">{e.subject?.name || e.subject_name}</Text>
                              {isCurrent(e) ? <StatusChip label={k('now')} tone="success" /> : null}
                            </View>
                            <View className="flex-row flex-wrap gap-3">
                              <Meta icon={Users} value={e.section?.name || e.section_name || ''} />
                              <Meta icon={GraduationCap} value={e.section?.grade_level?.name || e.grade_name || ''} />
                              {e.room_number ? <Meta icon={MapPin} value={k('roomLabel', { room: e.room_number })} /> : null}
                            </View>
                            <Button size="sm" className="bg-success self-start" onPress={() => goToAttendance(e.id)}>
                              <Icon as={CheckCircle} className="size-4 text-white" />
                              <Text>{k('attendance')}</Text>
                            </Button>
                          </View>
                        </View>
                      </Pressable>
                    )
                  )
                )}
              </View>
            ) : bySubject.length ? (
              bySubject.map(([subjectId, g]) => (
                <Panel key={subjectId} className="overflow-hidden">
                  <View className="h-2" style={{ backgroundColor: color(subjectId) }} />
                  <View className="gap-3 p-4">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1 gap-1">
                        <Text className="text-lg font-bold">{g.name}</Text>
                        {g.code ? <StatusChip label={g.code} tone="muted" className="self-start" /> : null}
                      </View>
                      <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: color(subjectId) }}>
                        <Text className="text-xs font-semibold text-white">{k('periodsPerWeek', { count: g.total })}</Text>
                      </View>
                    </View>
                    <Meta icon={Users} value={k('sectionsLabel', { sections: [...g.sections].join(', ') })} />
                    <View className="border-info-soft dark:border-border gap-2 border-t pt-2">
                      <Text variant="muted" className="text-xs">
                        {k('scheduleLabel')}
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {g.list.slice(0, 5).map((e) => (
                          <StatusChip key={e.id} label={`${dayShort(e.day_of_week)} P${e.period?.period_number ?? ''}`} tone="muted" />
                        ))}
                        {g.list.length > 5 ? <StatusChip label={k('moreCount', { count: g.list.length - 5 })} tone="muted" /> : null}
                      </View>
                    </View>
                  </View>
                </Panel>
              ))
            ) : (
              <EmptyState icon={BookOpen} title={k('noSubjectsAssigned')} body={k('noSubjectsAssignedHint')} />
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function Meta({ icon, value }: { icon: LucideIcon; value: string }) {
  if (!value) return null;
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground text-sm">{value}</Text>
    </View>
  );
}

function RoundArrow({ icon, label, disabled, onPress }: { icon: LucideIcon; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} className={cn('bg-info-soft size-10 items-center justify-center rounded-full active:opacity-70', disabled && 'opacity-40')}>
      <Icon flipRtl as={icon} className="text-brand dark:text-brand-secondary size-5" />
    </Pressable>
  );
}
