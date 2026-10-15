import type { VisitStatus } from '@studently/api-client';
import { router } from 'expo-router';
import { Building2, Calendar, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VISIT_STATUS_TONE } from '@/features/inspector/ui';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const TABS: Record<'upcoming' | 'completed' | 'cancelled', VisitStatus[]> = {
  upcoming: ['scheduled', 'confirmed', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rescheduled'],
};

/** The inspector's visits: upcoming / completed / cancelled, schedule a new one (web: /inspector/visits). */
export default function InspectorVisits() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const res = useApi(['inspector', 'visits'], () => inspector.myVisits());
  const [tab, setTab] = useState<keyof typeof TABS>('upcoming');
  const list = (res.data ?? []).filter((v) => TABS[tab].includes(v.status));
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
      <Text variant="muted">{k('page_subtitle')}</Text>
      <Button className="self-start" onPress={() => router.push('/inspector/visits/new')}>
        <Icon as={Plus} className="text-primary-foreground size-4" />
        <Text>{k('btn_new_visit')}</Text>
      </Button>
      <FilterChips value={tab} onChange={setTab} options={(Object.keys(TABS) as (keyof typeof TABS)[]).map((x) => ({ value: x, label: k(`tab_${x}`) }))} />
      {res.isLoading ? (
        <LoadingList rows={4} />
      ) : !list.length ? (
        <Text className="text-muted-foreground py-12 text-center text-sm">{k('no_visits')}</Text>
      ) : (
        <Card>
          <CardContent className="p-0">
            {list.map((v, i) => {
              const tone = VISIT_STATUS_TONE[v.status];
              return (
                <Pressable
                  key={v.id}
                  onPress={() => router.push({ pathname: '/inspector/visits/[id]', params: { id: v.id } })}
                  accessibilityRole="button"
                  className={cn('flex-row items-center gap-3 p-4', i > 0 && 'border-border border-t')}>
                  <View className="size-9 items-center justify-center rounded-full bg-[#022172]/10">
                    <Icon as={Building2} className="size-4 text-[#022172] dark:text-blue-300" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium" numberOfLines={1}>
                      {v.school?.name || v.school_id}
                    </Text>
                    <View className="flex-row items-center gap-1">
                      <Icon as={Calendar} className="text-muted-foreground size-3" />
                      <Text className="text-muted-foreground text-xs">{`${v.scheduled_date}${v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}`}</Text>
                    </View>
                  </View>
                  <View className={cn('rounded-full px-2 py-0.5', tone.split(' ')[0])}>
                    <Text className={cn('text-xs', tone.split(' ')[1])}>{k(`status_${v.status}`)}</Text>
                  </View>
                  <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
                </Pressable>
              );
            })}
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}
