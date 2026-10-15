import { Stack } from 'expo-router';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { CalendarGrid } from '@/components/app/calendar-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { usePortalSettings } from '@/features/portal/menu';
import { adminCalendars, events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { getHijriOffset } from '@/lib/hijri';

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Read-only school calendar: events and school days / holidays (web: /student/events). */
export default function StudentEvents() {
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const settings = usePortalSettings();
  const [month, setMonth] = useState(() => new Date());
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;

  const events = useApi(['portal', 'events', monthKey, campusId ?? 'school'], () => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    return eventsApi.getEventsForRange(start.toISOString(), end.toISOString(), { campus_id: campusId });
  });
  const calendars = useApi(campusId ? ['portal', 'attendance-calendars', campusId] : null, ([, , c]) => adminCalendars.list(c));
  const all = calendars.data ?? [];
  const cal = all.find((c) => c.calendar_type === 'gregorian' && c.is_default) ?? all.find((c) => c.calendar_type === 'gregorian') ?? null;
  const calId = cal?.id ?? null;
  const days = useApi(calId ? ['portal', 'calendar-days', calId, monthKey] : null, ([, , id]) =>
    adminCalendars.days(id as string, ymd(new Date(month.getFullYear(), month.getMonth(), 1)), ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0))),
  );
  const raw = settings.data?.hijri_offset;
  const offset = typeof raw === 'number' ? raw : getHijriOffset();
  const loading = events.isLoading || days.isLoading;

  return (
    <>
      <Stack.Screen options={{ title: t('app.st_ev_title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([events.mutate(), calendars.mutate(), days.mutate()])} />}>
        <View className="flex-row items-center gap-2">
          <Icon as={CalendarIcon} className="size-6 text-[#022172] dark:text-blue-400" />
          <Text className="text-xl font-bold text-[#022172] dark:text-white">{t('app.st_ev_title')}</Text>
        </View>
        <Text variant="muted">{t('app.st_ev_subtitle')}</Text>
        {loading ? (
          <View className="border-border bg-card h-80 items-center justify-center rounded-xl border">
            <ActivityIndicator />
            <Text className="text-muted-foreground mt-3 text-sm">{t('app.st_ev_loading')}</Text>
          </View>
        ) : (
          <CalendarGrid
            events={events.data ?? []}
            calendarDays={days.data ?? []}
            month={month}
            onMonthChange={setMonth}
            calendarStart={cal?.start_date}
            calendarEnd={cal?.end_date}
            weekdays={cal?.weekdays}
            hijriOffset={offset}
          />
        )}
      </ScrollView>
    </>
  );
}
