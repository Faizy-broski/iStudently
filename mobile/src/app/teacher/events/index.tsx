import type { SchoolEvent } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Calendar, ChevronRight, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const COLORS: Record<string, string> = {
  academic: 'bg-purple-100 text-purple-700',
  holiday: 'bg-orange-100 text-orange-700',
  exam: 'bg-red-100 text-red-700',
  meeting: 'bg-blue-100 text-blue-700',
  activity: 'bg-green-100 text-green-700',
  reminder: 'bg-yellow-100 text-yellow-700',
};
const CATS = ['academic', 'holiday', 'exam', 'meeting', 'activity', 'reminder'];
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Upcoming school events (30), filter by category, optional past events (web: /teacher/events). */
export default function TeacherEvents() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.events.${key}`, o);
  const { campusId } = useCampus();
  const [cat, setCat] = useState('');
  const [showPast, setShowPast] = useState(false);
  const upcoming = useApi(['teacher', 'upcoming-events'], () => eventsApi.getUpcomingEvents(30, 'teacher'));
  const all = useApi(showPast ? ['teacher', 'all-events', campusId ?? 'school'] : null, () => eventsApi.getEvents({ user_role: 'teacher', limit: 100, campus_id: campusId ?? undefined }));
  const [now] = useState(() => new Date());
  const keep = (e: SchoolEvent) => !cat || e.category === cat;
  const up = (upcoming.data ?? []).filter(keep);
  const past = (all.data ?? []).filter(keep).filter((e) => new Date(e.start_at) < now && !sameDay(new Date(e.start_at), now));

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([upcoming.mutate(), all.mutate()])} />}>
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Picker
          value={cat || 'all'}
          onChange={(v) => setCat(v === 'all' ? '' : v)}
          options={[{ value: 'all', label: k('allCategories') }, ...CATS.map((c) => ({ value: c, label: k(`category${c[0].toUpperCase()}${c.slice(1)}`) }))]}
        />
        {upcoming.isLoading ? (
          <LoadingList rows={4} />
        ) : !up.length ? (
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Calendar} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground">{k('noUpcomingEvents')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Text className="text-lg font-semibold">{k('upcomingEventsCount', { count: up.length })}</Text>
            {up.map((e) => (
              <EventCard key={e.id} event={e} today={sameDay(new Date(e.start_at), now)} />
            ))}
          </>
        )}
        <Button variant="outline" size="sm" className="self-start" onPress={() => setShowPast((v) => !v)}>
          <Text>{showPast ? k('hidePastEvents') : k('showPastEvents')}</Text>
          <Icon as={ChevronRight} className={cn('size-4', showPast ? 'rotate-90' : 'rtl:rotate-180')} />
        </Button>
        {showPast ? (
          <View className="gap-3 opacity-70">
            <Text className="text-lg font-semibold">{k('pastEvents')}</Text>
            {all.isLoading ? <LoadingList rows={2} /> : !past.length ? <Text className="text-muted-foreground text-sm">{k('noPastEvents')}</Text> : past.map((e) => <EventCard key={e.id} event={e} past />)}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function EventCard({ event, today, past }: { event: SchoolEvent; today?: boolean; past?: boolean }) {
  const { t } = useTranslation();
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const start = new Date(event.start_at);
  const time = (d: Date) => d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  return (
    <Pressable onPress={() => router.push({ pathname: '/teacher/events/[id]', params: { id: event.id } })} accessibilityRole="button">
      <Card className={cn(today && !past && 'border-primary border-2')}>
        <CardContent className="flex-row items-start gap-3 p-4">
          <View className="bg-muted min-w-14 items-center rounded-lg p-2">
            <Text className="text-muted-foreground text-xs font-medium uppercase">{start.toLocaleDateString(loc, { month: 'short' })}</Text>
            <Text className="text-xl font-bold">{String(start.getDate())}</Text>
          </View>
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-semibold">{event.title}</Text>
              <View className={cn('rounded-full px-2 py-0.5', COLORS[event.category] ?? 'bg-gray-100 text-gray-700')}>
                <Text className={cn('text-xs', (COLORS[event.category] ?? 'text-gray-700').split(' ')[1])}>{t(`teacherPages.events.category${event.category[0]?.toUpperCase()}${event.category.slice(1)}`, { defaultValue: event.category })}</Text>
              </View>
              {today && !past ? (
                <Badge>
                  <Text>{t('teacherPages.events.today')}</Text>
                </Badge>
              ) : null}
            </View>
            {event.description ? (
              <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                {event.description}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-1">
              <Icon as={Clock} className="text-muted-foreground size-3" />
              <Text className="text-muted-foreground text-xs">{event.is_all_day ? t('teacherPages.events.allDay') : `${time(start)} – ${time(new Date(event.end_at))}`}</Text>
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}
