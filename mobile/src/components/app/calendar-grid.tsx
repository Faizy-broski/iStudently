import type { CalendarDay, SchoolEvent } from '@studently/api-client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { fromHijri, hijriMonthNames, toHijri } from '@/lib/hijri';
import { cn } from '@/lib/utils';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 21 }, (_, i) => THIS_YEAR - 10 + i);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Gregorian date of day 1 of a Hijri month, as displayed with `offset`. */
const hijriMonthStart = (year: number, month: number, offset: number) => {
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return addDays(fromHijri(y, m, 1), -offset);
};

/** First and last day of the month the grid shows (the Hijri month containing `month` in Hijri mode). */
export function gridMonthRange(month: Date, calendarType: 'gregorian' | 'hijri', offset = 0) {
  if (calendarType === 'gregorian') return { start: new Date(month.getFullYear(), month.getMonth(), 1), end: new Date(month.getFullYear(), month.getMonth() + 1, 0) };
  const h = toHijri(month, offset);
  return { start: hijriMonthStart(h.year, h.month, offset), end: addDays(hijriMonthStart(h.year, h.month + 1, offset), -1) };
}

/**
 * Read-only Gregorian month grid (web CalendarGrid without the edit callbacks): month/year
 * pickers, prev/today/next bounded by the calendar's start and end, school day / short day /
 * holiday shading from the attendance calendar, the Hijri date per cell, event dots, and a
 * day sheet listing that day's events.
 */
export function CalendarGrid({
  events,
  calendarDays,
  month,
  onMonthChange,
  calendarStart,
  calendarEnd,
  weekdays,
  hijriOffset = 0,
  calendarType = 'gregorian',
  onEventPress,
}: {
  events: SchoolEvent[];
  calendarDays: CalendarDay[];
  month: Date;
  onMonthChange: (d: Date) => void;
  calendarStart?: string | null;
  calendarEnd?: string | null;
  weekdays?: boolean[];
  hijriOffset?: number;
  /** Hijri: the grid shows the Hijri month containing `month`, numbered in Hijri days. */
  calendarType?: 'gregorian' | 'hijri';
  onEventPress?: (e: SchoolEvent) => void;
}) {
  const { t, i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  const [open, setOpen] = useState<{ date: Date; events: SchoolEvent[] } | null>(null);

  const start = calendarStart ? new Date(calendarStart) : null;
  const end = calendarEnd ? new Date(calendarEnd) : null;
  const hijri = calendarType === 'hijri';
  const hm = toHijri(month, hijriOffset);
  const prev = hijri ? hijriMonthStart(hm.year, hm.month - 1, hijriOffset) : new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const next = hijri ? hijriMonthStart(hm.year, hm.month + 1, hijriOffset) : new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const monthIdx = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const canPrev = !start || monthIdx(prev) >= monthIdx(start);
  const canNext = !end || monthIdx(next) <= monthIdx(end);
  const goToday = () => {
    const now = new Date();
    if (start && now < start) return onMonthChange(start);
    if (end && now > end) return onMonthChange(end);
    onMonthChange(now);
  };

  const days: Date[] = [];
  if (hijri) {
    const first = hijriMonthStart(hm.year, hm.month, hijriOffset);
    const gridStart = addDays(first, -first.getDay());
    for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  } else {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    const gridEnd = new Date(last.getFullYear(), last.getMonth(), last.getDate() + (6 - last.getDay()));
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  }
  const hMonths = hijriMonthNames(i18n.language);
  const hijriYears = Array.from({ length: 21 }, (_, i) => hm.year - 10 + i);
  const todayKey = ymd(new Date());
  const byDay = new Map<string, SchoolEvent[]>();
  for (const e of events) {
    const k = ymd(new Date(e.start_at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const calByDay = new Map(calendarDays.map((c) => [c.school_date, c]));
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold">{t(hijri ? 'school.events.tab_hijri' : 'school.events.tab_gregorian')}</Text>
      <View className="flex-row gap-2">
        {hijri ? (
          <>
            <View className="flex-1">
              <Picker value={String(hm.month)} onChange={(v) => onMonthChange(hijriMonthStart(hm.year, Number(v), hijriOffset))} options={hMonths.map((n, i) => ({ value: String(i), label: n }))} />
            </View>
            <View className="w-28">
              <Picker value={String(hm.year)} onChange={(v) => onMonthChange(hijriMonthStart(Number(v), hm.month, hijriOffset))} options={hijriYears.map((y) => ({ value: String(y), label: String(y) }))} />
            </View>
          </>
        ) : (
          <>
            <View className="flex-1">
              <Picker
                value={String(month.getMonth())}
                onChange={(v) => onMonthChange(new Date(month.getFullYear(), Number(v), 1))}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: t(`common.months.${i}`) }))}
              />
            </View>
            <View className="w-28">
              <Picker value={String(month.getFullYear())} onChange={(v) => onMonthChange(new Date(Number(v), month.getMonth(), 1))} options={YEARS.map((y) => ({ value: String(y), label: String(y) }))} />
            </View>
          </>
        )}
      </View>
      <View className="flex-row items-center justify-end gap-2">
        <Button variant="outline" size="sm" onPress={() => canPrev && onMonthChange(prev)} disabled={!canPrev} accessibilityLabel={t('app.cal_prev')}>
          <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="sm" onPress={goToday}>
          <Text>{t('app.cal_today')}</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={() => canNext && onMonthChange(next)} disabled={!canNext} accessibilityLabel={t('app.cal_next')}>
          <Icon as={ChevronRight} className="size-4 rtl:rotate-180" />
        </Button>
      </View>

      <View className="border-border bg-card gap-1 rounded-xl border p-2">
        <View className="flex-row">
          {(ar ? SHORT_AR : SHORT_EN).map((d) => (
            <Text key={d} className="flex-1 py-1 text-center text-[10px] font-semibold">
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={ymd(week[0])} className="flex-row gap-1">
            {week.map((day) => {
              const key = ymd(day);
              const h = toHijri(day, hijriOffset);
              const inMonth = hijri ? h.month === hm.month && h.year === hm.year : day.getMonth() === month.getMonth();
              const dayEvents = byDay.get(key) ?? [];
              const cal = calByDay.get(key);
              const off = weekdays ? weekdays[day.getDay()] === false : false;
              const school = cal ? cal.is_school_day : !off;
              const holiday = cal ? !cal.is_school_day : off;
              const partial = !!cal?.is_school_day && cal.minutes > 0 && cal.minutes < 360;
              const today = key === todayKey;
              return (
                <Pressable
                  key={key}
                  onPress={() => setOpen({ date: day, events: dayEvents })}
                  accessibilityRole="button"
                  accessibilityLabel={day.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' })}
                  className={cn(
                    'min-h-[64px] flex-1 rounded-lg border p-1',
                    inMonth
                      ? school
                        ? partial
                          ? 'border-[#B8B8FF] bg-[#D4D4FF] dark:border-indigo-800/50 dark:bg-indigo-900/30'
                          : 'border-[#B8FFB8] bg-[#D4FFD4] dark:border-green-800/50 dark:bg-green-900/30'
                        : holiday
                          ? 'border-[#FFB8B8] bg-[#FFD4D4] dark:border-red-800/50 dark:bg-red-900/30'
                          : 'border-border bg-background'
                      : 'border-border bg-muted/30 opacity-50',
                    today && 'border-2 border-[#022172] dark:border-[#57A3CC]',
                  )}>
                  <View className="flex-row items-start justify-between">
                    <View className={cn(today && 'size-5 items-center justify-center rounded-full bg-[#022172] dark:bg-[#57A3CC]')}>
                      <Text className={cn('text-xs font-semibold', today ? 'text-white' : inMonth && (school || holiday) ? 'text-gray-900 dark:text-gray-200' : 'text-foreground')}>
                        {String(hijri ? h.day : day.getDate())}
                      </Text>
                    </View>
                    {dayEvents.length ? (
                      <View className="bg-secondary rounded px-1">
                        <Text className="text-[9px]">{String(dayEvents.length)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-muted-foreground text-[8px]" numberOfLines={1}>
                    {hijri ? day.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) : `${h.day} ${hMonths[h.month]}`}
                  </Text>
                  <View className="mt-auto flex-row flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <View key={ev.id} className="size-1.5 rounded-full" style={{ backgroundColor: ev.color_code || '#3B82F6' }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{open ? open.date.toLocaleDateString(i18n.language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}</DialogTitle>
            {open?.events.length ? <Text className="text-muted-foreground text-xs">{t('app.cal_events_count', { count: open.events.length })}</Text> : null}
          </DialogHeader>
          <ScrollView style={{ maxHeight: 360 }} contentContainerClassName="gap-2">
            {!open?.events.length ? (
              <View className="items-center gap-2 py-8">
                <View className="bg-muted size-10 items-center justify-center rounded-full">
                  <Icon as={X} className="text-muted-foreground size-5" />
                </View>
                <Text className="text-muted-foreground text-sm">{t('app.cal_no_events_day')}</Text>
              </View>
            ) : (
              open.events.map((ev) => (
                <Pressable
                  key={ev.id}
                  disabled={!onEventPress}
                  onPress={() => {
                    setOpen(null);
                    onEventPress?.(ev);
                  }}
                  accessibilityRole={onEventPress ? 'button' : undefined}
                  className="border-border flex-row gap-3 rounded-lg border p-3">
                  <View className="w-1 self-stretch rounded-full" style={{ backgroundColor: ev.color_code || '#3B82F6' }} />
                  <View className="flex-1">
                    <Text className="text-sm font-medium">{ev.title}</Text>
                    {ev.description ? (
                      <Text className="text-muted-foreground mt-0.5 text-xs" numberOfLines={2}>
                        {ev.description}
                      </Text>
                    ) : null}
                    <Text className="text-muted-foreground mt-1 text-xs">
                      {ev.is_all_day ? t('app.cal_all_day') : new Date(ev.start_at).toLocaleTimeString(i18n.language, { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </View>
  );
}
