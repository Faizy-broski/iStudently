import type { AttendanceCalendar, CalendarDay, CalendarType, EventCategory, ICalType, SchoolEvent, ScheduleViewEntry } from '@studently/api-client';
import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Copy, Download, Info, List, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { CATEGORY_ICONS, EVENT_CATEGORIES, EVENT_COLORS, EventLine, ymdOf } from '@/features/admin/events';
import { usePluginActive } from '@/features/admin/plugins';
import { useHijriOffset } from '@/features/admin/use-hijri-offset';
import { useCampus } from '@/features/campus/campus';
import { adminCalendars, events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { fromHijri, hijriMonthNames, toHijri } from '@/lib/hijri';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const SCHEDULE_PALETTE = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#059669'];
const sectionColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return SCHEDULE_PALETTE[Math.abs(h) % SCHEDULE_PALETTE.length];
};

type Cell = { date: Date; key: string; day: number; inMonth: boolean; today: boolean; other: string };

/** School events & attendance calendars, Gregorian and Hijri, with schedule view and iCalendar (web: /admin/events). */
export default function Events() {
  const { t, i18n } = useTranslation();
  const e = (k: string, o?: Record<string, unknown>) => t(`school.events.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.ev_${k}`, o);
  const locale = i18n.language;
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const scheduleActive = usePluginActive('calendar_schedule_view');
  const icalActive = usePluginActive('icalendar');
  const offset = useHijriOffset();

  const [tab, setTab] = useState<CalendarType>('gregorian');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [month, setMonth] = useState(() => new Date());
  const [picked, setPicked] = useState<Partial<Record<CalendarType, string>>>({});
  const [scheduleMode, setScheduleMode] = useState(false);
  const [dayOpen, setDayOpen] = useState<Cell | null>(null);
  const [info, setInfo] = useState(false);
  const [icalOpen, setIcalOpen] = useState(false);
  const years = useAcademicYear();

  const calendars = useApi(['admin', 'calendars', campusId ?? 'school'], () => adminCalendars.list(campusId));
  const ofType = (type: CalendarType) => (calendars.data ?? []).filter((c) => c.calendar_type === type);
  const pickDefault = (type: CalendarType) => ofType(type).find((c) => c.is_default) ?? ofType(type)[0] ?? null;
  const calFor = (type: CalendarType): AttendanceCalendar | null => ofType(type).find((c) => c.id === picked[type]) ?? pickDefault(type);
  const active = calFor(tab);
  const activeId = active?.id ?? null;
  const activeStart = active?.start_date ?? null;
  const activeEnd = active?.end_date ?? null;

  // Jump to today when it falls inside the calendar, else to its first month (web: on calendars load).
  const loadedKey = calendars.data ? `${campusId ?? ''}:${calendars.data.length}` : null;
  useEffect(() => {
    if (!loadedKey || !activeStart) return;
    const today = new Date();
    const inRange = ymd(today) >= activeStart && (!activeEnd || ymd(today) <= activeEnd);
    setMonth(inRange ? today : new Date(`${activeStart}T00:00:00`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedKey]);

  // ---- grid ----
  const hijriNames = hijriMonthNames(locale);
  const gregNames = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, i, 1)));
  const cells = useMemo<Cell[]>(() => {
    const todayKey = ymd(new Date());
    const out: Cell[] = [];
    if (tab === 'gregorian') {
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const start = addDays(first, -first.getDay());
      const end = addDays(last, 6 - last.getDay());
      for (let d = start; d <= end; d = addDays(d, 1)) {
        const h = toHijri(d, offset);
        out.push({ date: d, key: ymd(d), day: d.getDate(), inMonth: d.getMonth() === month.getMonth(), today: ymd(d) === todayKey, other: `${h.day} ${hijriMonthNames(locale)[h.month]}` });
      }
    } else {
      const cur = toHijri(month, offset);
      let first = new Date(month.getFullYear(), month.getMonth(), 1);
      for (let i = 0; i < 60; i++) {
        const h = toHijri(first, offset);
        if (h.month === cur.month && h.year === cur.year) break;
        first = addDays(first, 1);
      }
      const start = addDays(first, -first.getDay());
      for (let i = 0; i < 42; i++) {
        const d = addDays(start, i);
        const h = toHijri(d, offset);
        out.push({ date: d, key: ymd(d), day: h.day, inMonth: h.month === cur.month && h.year === cur.year, today: ymd(d) === todayKey, other: `${d.getDate()} ${new Intl.DateTimeFormat(locale, { month: 'short' }).format(d)}` });
      }
    }
    return out;
  }, [tab, month, offset, locale]);
  const gridStart = cells[0]?.key ?? '';
  const gridEnd = cells[cells.length - 1]?.key ?? '';

  const evs = useApi(gridStart ? ['admin', 'events-month', campusId ?? 'school', gridStart, gridEnd, category] : null, ([, , , s, en, cat]) =>
    eventsApi.getEventsForRange(new Date(`${s}T00:00:00`).toISOString(), new Date(`${en}T23:59:59`).toISOString(), { category: cat === 'all' ? undefined : (cat as EventCategory), campus_id: campusId }),
  );
  const counts = useApi(['admin', 'event-counts', campusId ?? 'school', activeStart ?? '', activeEnd ?? ''], ([, , , s, en]) => eventsApi.getCategoryCounts(s || undefined, en || undefined, campusId));
  const days = useApi(activeId && gridStart ? ['admin', 'calendar-days', activeId, gridStart, gridEnd] : null, ([, , id, s, en]) => adminCalendars.days(id, s, en));
  const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const yearId = years.id;
  const schedule = useApi(scheduleMode && scheduleActive && activeId && yearId ? ['admin', 'schedule-view', activeId, yearId, monthStr, campusId ?? 'school'] : null, ([, , id, y, mo]) =>
    adminCalendars.scheduleView(id, { academic_year_id: y, month: mo, campus_id: campusId ?? null }),
  );

  const byDate = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>();
    for (const ev of evs.data ?? []) {
      const k = ymdOf(ev.start_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return map;
  }, [evs.data]);
  const dayByDate = useMemo(() => new Map((days.data ?? []).map((d) => [d.school_date, d] as const)), [days.data]);
  const scheduleByDate = useMemo<Record<string, ScheduleViewEntry[]> | null>(() => {
    if (!scheduleMode) return null;
    const data = schedule.data;
    if (!data) return {};
    const map: Record<string, ScheduleViewEntry[]> = {};
    for (const [date, d] of Object.entries(data.calendar_days)) map[date] = d.entries;
    if (!Object.keys(map).length && Object.keys(data.schedule_by_dow).length) {
      const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const js = new Date(month.getFullYear(), month.getMonth(), d).getDay();
        map[ymd(new Date(month.getFullYear(), month.getMonth(), d))] = data.schedule_by_dow[js === 0 ? 6 : js - 1] || [];
      }
    }
    return map;
  }, [scheduleMode, schedule.data, month]);

  // ---- navigation ----
  const step = (dir: 1 | -1) => {
    if (tab === 'gregorian') return new Date(month.getFullYear(), month.getMonth() + dir, 1);
    const h = toHijri(month, offset);
    const m = h.month + dir;
    return fromHijri(m < 0 ? h.year - 1 : m > 11 ? h.year + 1 : h.year, (m + 12) % 12, 1);
  };
  const prev = step(-1);
  const next = step(1);
  const thisYear = new Date().getFullYear();
  const hijriNow = toHijri(new Date(), offset);
  const curH = toHijri(month, offset);
  // Stay inside the calendar's range (web: canGoPrev / canGoNext).
  const viewStart = tab === 'gregorian' ? new Date(month.getFullYear(), month.getMonth(), 1) : fromHijri(curH.year, curH.month, 1);
  const canPrev = !activeStart || ymd(addDays(viewStart, -1)) >= activeStart;
  const canNext = !activeEnd || ymd(next) <= activeEnd;

  // ---- actions ----
  async function toggleDay(cell: Cell) {
    if (!active) return;
    const day: CalendarDay | undefined = dayByDate.get(cell.key);
    if (!day) return;
    const r = await adminCalendars.toggleDay(active.id, day.id, !day.is_school_day);
    if (!r.success || !r.data) return toast.error(r.error || a('toggle_failed'));
    days.mutate();
    toast.success(r.data.is_school_day ? e('success_marked_school') : e('success_marked_no_school'));
  }

  async function deleteCalendar(cal: AttendanceCalendar) {
    if (!(await confirm({ title: t('common.confirm_delete'), body: t('common.delete_warning'), confirmLabel: t('common.delete'), destructive: true }))) return;
    const r = await adminCalendars.remove(cal.id);
    if (!r.success) return toast.error(r.error || a('cal_delete_failed'));
    toast.success(a('cal_deleted'));
    setPicked((p) => ({ ...p, [tab]: undefined }));
    calendars.mutate();
  }

  const addEvent = (date?: string) => router.push({ pathname: '/admin/events/form', params: date ? { date } : {} });
  const countsData = counts.data;
  const monthEvents = [...(evs.data ?? [])].filter((ev) => cells.some((c) => c.inMonth && c.key === ymdOf(ev.start_at))).sort((x, y) => x.start_at.localeCompare(y.start_at));
  const weekHeads = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2000, 0, 2 + i)));
  const tabCalendars = ofType(tab);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: e('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10">
        <Text className="text-muted-foreground text-sm">{e('subtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" onPress={() => router.push('/admin/events/list')}>
            <Icon as={List} className="text-foreground size-4" />
            <Text>{e('btn_all_events')}</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => router.push('/admin/events/calendar-form')}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{e('btn_new_calendar')}</Text>
          </Button>
          <Button size="sm" onPress={() => addEvent()}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{e('btn_add_event')}</Text>
          </Button>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {EVENT_CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(category === c ? 'all' : c)} className={cn('bg-card border-border w-[31.5%] flex-row items-center gap-2 rounded-xl border p-2.5', category === c && 'border-primary border-2')}>
              <View className="rounded-lg p-1.5" style={{ backgroundColor: `${EVENT_COLORS[c]}20` }}>
                <Icon as={CATEGORY_ICONS[c]} size={16} color={EVENT_COLORS[c]} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-bold">{countsData?.[c] ?? 0}</Text>
                <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
                  {e(`categories.${c}`)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <FilterChips
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: 'gregorian', label: e('tab_gregorian') },
            { value: 'hijri', label: e('tab_hijri') },
          ]}
        />

        {scheduleActive || icalActive ? (
          <View className="flex-row flex-wrap items-center gap-3">
            {scheduleActive ? (
              <Pressable onPress={() => setScheduleMode((v) => !v)} className="flex-row items-center gap-1">
                <Icon as={CalendarDays} className="size-4 text-blue-600" />
                <Text className="text-sm text-blue-600">{scheduleMode ? e('view_events_assignments') : e('view_schedule')}</Text>
              </Pressable>
            ) : null}
            {icalActive ? (
              <Pressable onPress={() => setIcalOpen(true)} className="flex-row items-center gap-1">
                <Icon as={CalendarRange} className="size-4 text-green-700" />
                <Text className="text-sm text-green-700">{e('ical_title')}</Text>
              </Pressable>
            ) : null}
            {scheduleMode && years.years.length ? (
              <View className="w-44">
                <Picker value={years.id ?? ''} onChange={years.pick} placeholder={e('filter_academic_year')} options={years.years.map((y) => ({ value: y.id, label: `${y.name}${y.is_current ? ` ${e('label_current')}` : ''}` }))} />
              </View>
            ) : null}
            {scheduleMode && schedule.isLoading ? <Text className="text-muted-foreground text-xs">{e('loading_schedule')}</Text> : null}
          </View>
        ) : null}

        {tabCalendars.length ? (
          <View className="gap-1.5">
            <Text className="text-sm font-medium">{e('label_attendance_calendar')}</Text>
            <View className="flex-row items-center gap-1">
              <View className="flex-1">
                <Picker
                  value={active?.id ?? ''}
                  onChange={(id) => setPicked((p) => ({ ...p, [tab]: id }))}
                  placeholder={e('placeholder_select_calendar')}
                  options={tabCalendars.map((c) => ({ value: c.id, label: `${c.title}${c.is_default ? ` ${e('label_default')}` : ''}` }))}
                />
              </View>
              {active ? (
                <>
                  <Button size="icon" variant="ghost" onPress={() => router.push({ pathname: '/admin/events/calendar-form', params: { id: active.id } })} accessibilityLabel={t('common.edit')}>
                    <Icon as={Pencil} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => deleteCalendar(active)} accessibilityLabel={t('common.delete')}>
                    <Icon as={Trash2} className="text-foreground size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onPress={() => setInfo((v) => !v)} accessibilityLabel={e('tip_info_title')}>
                    <Icon as={Info} className="text-foreground size-4" />
                  </Button>
                </>
              ) : null}
            </View>
            {info && active ? (
              <View className="bg-muted/50 gap-1 rounded-md p-3">
                <Text className="text-sm">
                  <Text className="text-sm font-semibold">{e('tip_info_title')}</Text> {active.title}
                </Text>
                <Text className="text-sm">
                  <Text className="text-sm font-semibold">{e('tip_info_period')}</Text> {a('period_range', { start: active.start_date, end: active.end_date })}
                </Text>
                <Text className="text-sm">
                  <Text className="text-sm font-semibold">{e('tip_info_minutes')}</Text> {active.default_minutes}
                </Text>
                <Text className="text-muted-foreground text-xs">{a('tip_toggle_mobile')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Card>
          <CardContent className="gap-3 pt-4">
            <Text className="text-base font-semibold">{tab === 'gregorian' ? e('tab_gregorian') : e('tab_hijri')}</Text>
            <View className="flex-row gap-2">
              {tab === 'gregorian' ? (
                <>
                  <View className="flex-1">
                    <Picker value={String(month.getMonth())} onChange={(v) => setMonth(new Date(month.getFullYear(), parseInt(v, 10), 1))} options={gregNames.map((n, i) => ({ value: String(i), label: n }))} />
                  </View>
                  <View className="w-28">
                    <Picker value={String(month.getFullYear())} onChange={(v) => setMonth(new Date(parseInt(v, 10), month.getMonth(), 1))} options={Array.from({ length: 21 }, (_, i) => thisYear - 10 + i).map((y) => ({ value: String(y), label: String(y) }))} />
                  </View>
                </>
              ) : (
                <>
                  <View className="flex-1">
                    <Picker value={String(curH.month)} onChange={(v) => setMonth(fromHijri(curH.year, parseInt(v, 10), 1))} options={hijriNames.map((n, i) => ({ value: String(i), label: n }))} />
                  </View>
                  <View className="w-28">
                    <Picker value={String(curH.year)} onChange={(v) => setMonth(fromHijri(parseInt(v, 10), curH.month, 1))} options={Array.from({ length: 21 }, (_, i) => hijriNow.year - 10 + i).map((y) => ({ value: String(y), label: String(y) }))} />
                  </View>
                </>
              )}
            </View>
            <View className="flex-row items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={!canPrev} onPress={() => setMonth(prev)} accessibilityLabel={t('common.previous')}>
                <Icon as={ChevronLeft} className="text-foreground size-4 rtl:rotate-180" />
              </Button>
              <Button size="sm" variant="outline" onPress={() => setMonth(new Date())}>
                <Text>{a('today')}</Text>
              </Button>
              <Button size="sm" variant="outline" disabled={!canNext} onPress={() => setMonth(next)} accessibilityLabel={t('common.next')}>
                <Icon as={ChevronRight} className="text-foreground size-4 rtl:rotate-180" />
              </Button>
              {evs.isValidating || days.isValidating ? <Text className="text-muted-foreground text-xs">{e('status_updating')}</Text> : null}
            </View>

            {calendars.isLoading ? (
              <Text className="text-muted-foreground py-10 text-center">{e('loading_calendar')}</Text>
            ) : (
              <View>
                <View className="flex-row">
                  {weekHeads.map((d, i) => (
                    <Text key={i} className="flex-1 py-1 text-center text-xs font-semibold">
                      {d}
                    </Text>
                  ))}
                </View>
                <View className="flex-row flex-wrap">
                  {cells.map((cell) => {
                    const dayEvents = byDate.get(cell.key) ?? [];
                    const calDay = dayByDate.get(cell.key);
                    const weekdayOff = active?.weekdays ? active.weekdays[cell.date.getDay()] === false : false;
                    const school = calDay ? calDay.is_school_day : !weekdayOff;
                    const holiday = calDay ? !calDay.is_school_day : weekdayOff;
                    const partial = !!calDay?.is_school_day && calDay.minutes > 0 && calDay.minutes < 360;
                    const classes = scheduleByDate?.[cell.key] ?? [];
                    return (
                      <View key={cell.key} className="w-[14.28%] p-0.5">
                        <Pressable
                          onPress={() => setDayOpen(cell)}
                          onLongPress={() => (scheduleMode || !active ? addEvent(cell.key) : toggleDay(cell))}
                          className={cn(
                            'min-h-14 rounded-md border p-1',
                            cell.inMonth
                              ? school
                                ? partial
                                  ? 'border-indigo-200 bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-900/30'
                                  : 'border-green-200 bg-green-100 dark:border-green-800/50 dark:bg-green-900/30'
                                : holiday
                                  ? 'border-red-200 bg-red-100 dark:border-red-800/50 dark:bg-red-900/30'
                                  : 'border-border bg-background'
                              : 'border-border bg-muted/30 opacity-50',
                            cell.today && 'border-primary border-2',
                          )}>
                          <View className="flex-row items-start justify-between">
                            <Text className={cn('text-xs font-semibold', cell.today && 'text-primary')}>{cell.day}</Text>
                            {dayEvents.length ? (
                              <View className="bg-secondary rounded px-1">
                                <Text className="text-[8px]">{dayEvents.length}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-muted-foreground text-[7px]" numberOfLines={1}>
                            {cell.other}
                          </Text>
                          <View className="mt-auto flex-row flex-wrap gap-0.5">
                            {scheduleByDate
                              ? classes.slice(0, 4).map((c) => <View key={c.id} className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: sectionColor(c.section_id) }} />)
                              : dayEvents.slice(0, 3).map((ev) => <View key={ev.id} className="size-1.5 rounded-full" style={{ backgroundColor: ev.color_code }} />)}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                <Text className="text-muted-foreground mt-2 text-xs">{active ? a('grid_hint_toggle') : a('grid_hint_add')}</Text>
              </View>
            )}
          </CardContent>
        </Card>

        {!scheduleMode && monthEvents.length ? (
          <Card>
            <CardContent className="gap-3 pt-4">
              <Text className="text-sm font-semibold">{a('month_events', { count: monthEvents.length })}</Text>
              {monthEvents.map((ev, i) => (
                <View key={ev.id}>
                  {i > 0 ? <Separator className="mb-3" /> : null}
                  <Pressable onPress={() => router.push({ pathname: '/admin/events/[id]', params: { id: ev.id } })} className="flex-row items-start gap-3">
                    <Text className="text-muted-foreground w-10 text-xs">{new Date(ev.start_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</Text>
                    <View className="flex-1">
                      <EventLine event={ev} locale={locale} />
                    </View>
                  </Pressable>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>

      <DayDialog
        cell={dayOpen}
        events={dayOpen ? (byDate.get(dayOpen.key) ?? []) : []}
        classes={dayOpen && scheduleByDate ? (scheduleByDate[dayOpen.key] ?? []) : null}
        calDay={dayOpen ? dayByDate.get(dayOpen.key) : undefined}
        canToggle={!!active && !scheduleMode}
        onClose={() => setDayOpen(null)}
        onToggle={async (c) => {
          setDayOpen(null);
          await toggleDay(c);
        }}
        onAdd={(c) => {
          setDayOpen(null);
          addEvent(c.key);
        }}
      />
      {icalActive ? <ICalDialog open={icalOpen} onClose={() => setIcalOpen(false)} withSchedule={scheduleActive} campusId={campusId} /> : null}
    </View>
  );
}

function DayDialog({
  cell,
  events,
  classes,
  calDay,
  canToggle,
  onClose,
  onToggle,
  onAdd,
}: {
  cell: Cell | null;
  events: SchoolEvent[];
  classes: ScheduleViewEntry[] | null;
  calDay?: CalendarDay;
  canToggle: boolean;
  onClose: () => void;
  onToggle: (c: Cell) => void;
  onAdd: (c: Cell) => void;
}) {
  const { t, i18n } = useTranslation();
  const a = (k: string, o?: Record<string, unknown>) => t(`app.ev_${k}`, o);
  return (
    <Dialog open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85%] w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{cell ? cell.date.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}</DialogTitle>
          {events.length ? <Text className="text-muted-foreground text-xs">{a('n_events', { count: events.length })}</Text> : null}
        </DialogHeader>
        <ScrollView className="max-h-96" contentContainerClassName="gap-3">
          {calDay ? <Text className={cn('text-xs font-bold uppercase', calDay.is_school_day ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>{calDay.is_school_day ? a('school_day') : a('holiday_day')}</Text> : null}
          {classes ? (
            classes.length ? (
              classes.map((c) => (
                <View key={c.id} className="bg-muted/40 rounded-md border-s-4 px-2 py-1.5" style={{ borderStartColor: sectionColor(c.section_id) }}>
                  <Text className="text-sm font-semibold">
                    {c.subject_name} <Text className="text-muted-foreground text-xs">{c.period_name || `P${c.period_number}`}</Text>
                  </Text>
                  <Text className="text-muted-foreground text-xs">
                    {c.section_name} · {c.grade_name} · {c.teacher_name}
                  </Text>
                  {c.start_time ? (
                    <Text className="text-muted-foreground text-xs">
                      {c.start_time}–{c.end_time}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text className="text-muted-foreground text-sm">{a('no_classes')}</Text>
            )
          ) : null}
          {events.length === 0 ? (
            <Text className="text-muted-foreground py-4 text-center text-sm">{a('no_events_day')}</Text>
          ) : (
            events.map((ev) => (
              <Pressable
                key={ev.id}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/admin/events/[id]', params: { id: ev.id } });
                }}
                className="border-border rounded-lg border p-3">
                <EventLine event={ev} locale={i18n.language} />
              </Pressable>
            ))
          )}
        </ScrollView>
        <View className="gap-2">
          {canToggle && calDay && cell ? (
            <Button variant="outline" onPress={() => onToggle(cell)}>
              <Text>{calDay.is_school_day ? a('mark_no_school') : a('mark_school')}</Text>
            </Button>
          ) : null}
          {cell ? (
            <Button onPress={() => onAdd(cell)}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{a('add_for_day')}</Text>
            </Button>
          ) : null}
        </View>
      </DialogContent>
    </Dialog>
  );
}

/** iCalendar links: share the .ics file or copy the subscribe link (web: the iCal popover). */
function ICalDialog({ open, onClose, withSchedule, campusId }: { open: boolean; onClose: () => void; withSchedule: boolean; campusId?: string }) {
  const { t } = useTranslation();
  const e = (k: string) => t(`school.events.${k}`);
  const toast = useToast();
  const [urls, setUrls] = useState<Partial<Record<ICalType, string>>>({});
  const [loading, setLoading] = useState<ICalType | null>(null);
  const [copied, setCopied] = useState<ICalType | null>(null);

  async function link(type: ICalType) {
    if (urls[type]) return urls[type]!;
    setLoading(type);
    try {
      const r = await adminCalendars.icalLink(type, campusId);
      const url = r.data?.url;
      if (!url) {
        toast.error(r.error || e('ical_err_link'));
        return null;
      }
      setUrls((u) => ({ ...u, [type]: url }));
      return url;
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    link('events');
    if (withSchedule) link('schedule');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function copy(type: ICalType) {
    const url = await link(type);
    if (!url) return;
    await Clipboard.setStringAsync(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function download(type: ICalType) {
    const url = await link(type);
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('download');
      await shareTextFile(type === 'schedule' ? 'class-schedule.ics' : 'school-events.ics', await res.text(), 'text/calendar', 'public.calendar-event');
    } catch {
      toast.error(e('ical_err_download'));
    }
  }

  const row = (type: ICalType, label: string) => (
    <View className="gap-1">
      <Text className="text-muted-foreground text-xs font-medium uppercase">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        <View className="border-border bg-muted/30 flex-1 rounded border px-2 py-1.5">
          <Text className="text-xs" numberOfLines={1}>
            {urls[type] || (loading === type ? e('ical_generating') : '—')}
          </Text>
        </View>
        <Button size="icon" variant="outline" disabled={loading === type} onPress={() => download(type)} accessibilityLabel={e('ical_tip_download')}>
          <Icon as={Download} className="text-foreground size-4" />
        </Button>
        <Button size="icon" variant="outline" onPress={() => copy(type)} accessibilityLabel={e('ical_tip_copy')}>
          <Icon as={copied === type ? Check : Copy} className={copied === type ? 'size-4 text-green-600' : 'text-foreground size-4'} />
        </Button>
      </View>
    </View>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[94vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{e('ical_title')}</DialogTitle>
        </DialogHeader>
        <Text className="text-muted-foreground text-xs">{e('ical_desc').replace(/\*\*/g, '')}</Text>
        {row('events', e('ical_school_events'))}
        {withSchedule ? row('schedule', e('ical_class_schedule')) : null}
      </DialogContent>
    </Dialog>
  );
}
