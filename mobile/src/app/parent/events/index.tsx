import type { EventCategory } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { CalendarGrid, gridMonthRange } from '@/components/app/calendar-grid';
import { FilterChips } from '@/components/app/filter-chips';
import { HeroCard } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { CATEGORY_ICONS, EVENT_CATEGORIES, EVENT_COLORS } from '@/features/admin/events';
import { useHijriOffset } from '@/features/admin/use-hijri-offset';
import { NoChild, useChild } from '@/features/parent/child';
import { adminCalendars, events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

type CalType = 'gregorian' | 'hijri';
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * School calendar of the selected child's campus (web: /parent/events): category cards that filter,
 * Gregorian / Hijri tabs each with its own attendance calendar, and read-only event details.
 */
export default function ParentEvents() {
  const { t } = useTranslation();
  const e = (key: string) => t(`school.events.${key}`);
  const { child } = useChild();
  const campusId = child?.campus_id ?? null;
  const offset = useHijriOffset();
  const colors = useColors();
  const [tab, setTab] = useState<CalType>('gregorian');
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [month, setMonth] = useState(() => new Date());
  const [jumped, setJumped] = useState<string | null>(null);

  const calendars = useApi(campusId ? ['parent', 'attendance-calendars', campusId] : null, ([, , c]) => adminCalendars.list(c as string));
  const all = calendars.data ?? [];
  const pick = (type: CalType) => all.find((c) => c.calendar_type === type && c.is_default) ?? all.find((c) => c.calendar_type === type) ?? null;
  const cal = pick(tab);
  const calId = cal?.id ?? null;

  // Web: once the calendars load, open today's month, or the calendar's first month when today is outside it.
  if (calendars.data && campusId && jumped !== campusId) {
    setJumped(campusId);
    const first = pick('gregorian');
    if (first?.start_date) {
      const today = new Date();
      const start = new Date(first.start_date);
      const end = first.end_date ? new Date(first.end_date) : null;
      setMonth(today >= start && (!end || today <= end) ? today : start);
    }
  }

  const range = gridMonthRange(month, tab, offset);
  const startKey = ymd(range.start);
  const endKey = ymd(range.end);
  const cat = category === 'all' ? undefined : category;
  const events = useApi(campusId ? ['parent', 'events', campusId, startKey, endKey, cat ?? 'all'] : null, ([, , c, s, en, k]) => {
    const [sy, sm, sd] = (s as string).split('-').map(Number);
    const [ey, em, ed] = (en as string).split('-').map(Number);
    return eventsApi.getEventsForRange(new Date(sy, sm - 1, sd).toISOString(), new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString(), {
      category: k === 'all' ? undefined : (k as EventCategory),
      user_role: 'parent',
      campus_id: c as string,
    });
  });
  const counts = useApi(campusId ? ['parent', 'event-counts', campusId, cal?.start_date ?? '', cal?.end_date ?? ''] : null, ([, , c, s, en]) =>
    eventsApi.getCategoryCounts((s as string) || undefined, (en as string) || undefined, c as string),
  );
  const days = useApi(calId ? ['parent', 'calendar-days', calId, startKey, endKey] : null, ([, , id, s, en]) => adminCalendars.days(id as string, s as string, en as string));

  if (!child) return <NoChild />;
  const loading = events.isLoading && !events.data;
  const updating = events.isValidating || days.isValidating;

  return (
    <>
      <Stack.Screen options={{ title: e('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([events.mutate(), calendars.mutate(), days.mutate(), counts.mutate()])} />}>
        <HeroCard>
          <Text className="text-xl font-bold text-white">{e('title')}</Text>
          <Text className="text-sm text-white/80">
            {t('app.pa_ev_subtitle')}
            <Text className="text-sm font-semibold text-white">{child.campus_name}</Text>
          </Text>
        </HeroCard>

        <View className="flex-row flex-wrap gap-2">
          {EVENT_CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(category === c ? 'all' : c)}
              accessibilityRole="button"
              accessibilityState={{ selected: category === c }}
              style={raised(colors.brand)}
              className={cn('w-[31.5%] flex-row items-center gap-2 rounded-2xl border p-2.5 active:opacity-80', category === c ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border bg-card')}>
              <View className="rounded-xl p-1.5" style={{ backgroundColor: `${EVENT_COLORS[c]}20` }}>
                <Icon as={CATEGORY_ICONS[c]} size={16} color={EVENT_COLORS[c]} />
              </View>
              <View className="flex-1">
                <Text className="text-brand dark:text-foreground text-lg font-bold">{counts.data?.[c] ?? 0}</Text>
                <Text className="text-muted-foreground text-[10px]" numberOfLines={1}>
                  {e(`categories.${c}`)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {category !== 'all' ? (
          <View className="flex-row items-center gap-2">
            <Text className="text-muted-foreground text-sm">{t('app.pa_ev_filtering')}</Text>
            <Pressable
              onPress={() => setCategory('all')}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-full px-2.5 py-0.5"
              style={{ backgroundColor: EVENT_COLORS[category] }}>
              <Text className="text-xs font-medium text-white">{e(`categories.${category}`)}</Text>
              <Icon as={X} className="size-3 text-white" />
            </Pressable>
          </View>
        ) : null}

        <FilterChips
          value={tab}
          onChange={(v) => setTab(v as CalType)}
          options={[
            { value: 'gregorian', label: e('tab_gregorian') },
            { value: 'hijri', label: e('tab_hijri') },
          ]}
        />

        {loading ? (
          <Panel className="h-80 items-center justify-center">
            <ActivityIndicator />
            <Text className="text-muted-foreground mt-3 text-sm">{e('loading_calendar')}</Text>
          </Panel>
        ) : (
          <View>
            {updating ? (
              <View className="bg-card/95 border-info-soft dark:border-border absolute end-2 top-2 z-10 flex-row items-center gap-2 rounded-full border px-3 py-1">
                <View className="size-2 rounded-full bg-brand" />
                <Text className="text-muted-foreground text-xs">{e('status_updating')}</Text>
              </View>
            ) : null}
            <CalendarGrid
              events={events.data ?? []}
              calendarDays={days.data ?? []}
              month={month}
              onMonthChange={setMonth}
              calendarType={tab}
              calendarStart={cal?.start_date}
              calendarEnd={cal?.end_date}
              weekdays={cal?.weekdays}
              hijriOffset={offset}
              onEventPress={(ev) => router.push({ pathname: '/parent/events/[id]', params: { id: ev.id } })}
            />
          </View>
        )}
      </ScrollView>
    </>
  );
}
