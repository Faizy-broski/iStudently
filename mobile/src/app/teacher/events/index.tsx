import type { SchoolEvent } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Calendar, ChevronRight, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { events as eventsApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const TONES: Record<string, ChipTone> = {
  academic: 'info',
  holiday: 'warning',
  exam: 'destructive',
  meeting: 'info',
  activity: 'success',
  reminder: 'warning',
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
        <Text className="text-muted-foreground text-sm">{k('pageSubtitle')}</Text>
        <FilterChips
          value={cat || 'all'}
          onChange={(v) => setCat(v === 'all' ? '' : v)}
          options={[{ value: 'all', label: k('allCategories') }, ...CATS.map((c) => ({ value: c, label: k(`category${c[0].toUpperCase()}${c.slice(1)}`) }))]}
        />
        {upcoming.isLoading ? (
          <LoadingList rows={4} />
        ) : !up.length ? (
          <EmptyState icon={Calendar} title={k('noUpcomingEvents')} />
        ) : (
          <Section title={k('upcomingEventsCount', { count: up.length })}>
            <Panel>
              {up.map((e, i) => (
                <EventRow key={e.id} event={e} today={sameDay(new Date(e.start_at), now)} last={i === up.length - 1} />
              ))}
            </Panel>
          </Section>
        )}
        <Button variant="outline" size="sm" className="self-start" onPress={() => setShowPast((v) => !v)}>
          <Text>{showPast ? k('hidePastEvents') : k('showPastEvents')}</Text>
          <Icon flipRtl as={ChevronRight} className={cn('size-4', showPast ? 'rotate-90' : '')} />
        </Button>
        {showPast ? (
          <Section title={k('pastEvents')} className="opacity-70">
            {all.isLoading ? (
              <LoadingList rows={2} />
            ) : !past.length ? (
              <EmptyState icon={Calendar} title={k('noPastEvents')} />
            ) : (
              <Panel>
                {past.map((e, i) => (
                  <EventRow key={e.id} event={e} past last={i === past.length - 1} />
                ))}
              </Panel>
            )}
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function EventRow({ event, today, past, last }: { event: SchoolEvent; today?: boolean; past?: boolean; last?: boolean }) {
  const { t } = useTranslation();
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const start = new Date(event.start_at);
  const time = (d: Date) => d.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  const isToday = today && !past;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/teacher/events/[id]', params: { id: event.id } })}
      accessibilityRole="button"
      className={cn('flex-row items-start gap-3 px-4 py-3 active:opacity-70', !last && 'border-info-soft dark:border-border border-b', isToday && 'bg-info-soft')}>
      <View className={cn('min-w-12 items-center rounded-xl px-2 py-1.5', isToday ? 'bg-brand dark:bg-brand-secondary' : 'bg-info-soft')}>
        <Text className={cn('text-[10px] font-semibold uppercase', isToday ? 'text-white/85' : 'text-brand dark:text-brand-secondary')}>{start.toLocaleDateString(loc, { month: 'short' })}</Text>
        <Text className={cn('text-lg font-bold', isToday ? 'text-white' : 'text-brand dark:text-brand-secondary')}>{String(start.getDate())}</Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold">{event.title}</Text>
        <View className="flex-row flex-wrap items-center gap-1.5">
          <StatusChip label={t(`teacherPages.events.category${event.category[0]?.toUpperCase()}${event.category.slice(1)}`, { defaultValue: event.category })} tone={TONES[event.category] ?? 'muted'} />
          {isToday ? <StatusChip label={t('teacherPages.events.today')} tone="success" /> : null}
        </View>
        {event.description ? (
          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-1">
          <Icon as={Clock} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-xs">{event.is_all_day ? t('teacherPages.events.allDay') : `${time(start)} – ${time(new Date(event.end_at))}`}</Text>
        </View>
      </View>
      <Icon as={ChevronRight} flipRtl className="text-muted-foreground mt-1 size-4" />
    </Pressable>
  );
}
