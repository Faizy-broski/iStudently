import type { VisitStatus } from '@studently/api-client';
import { router } from 'expo-router';
import { Building2, CalendarPlus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

const TABS: Record<'upcoming' | 'completed' | 'cancelled', VisitStatus[]> = {
  upcoming: ['scheduled', 'confirmed', 'in_progress'],
  completed: ['completed'],
  cancelled: ['cancelled', 'rescheduled'],
};

const CHIP: Record<VisitStatus, ChipTone> = { scheduled: 'warning', confirmed: 'info', in_progress: 'info', completed: 'success', cancelled: 'destructive', rescheduled: 'muted' };

/** The inspector's visits: upcoming / completed / cancelled, schedule a new one (web: /inspector/visits). */
export default function InspectorVisits() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const res = useApi(['inspector', 'visits'], () => inspector.myVisits());
  const [tab, setTab] = useState<keyof typeof TABS>('upcoming');
  const list = (res.data ?? []).filter((v) => TABS[tab].includes(v.status));
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
      <Text variant="muted" className="text-sm">
        {k('page_subtitle')}
      </Text>
      <Button size="sm" className="self-start" onPress={() => router.push('/inspector/visits/new')}>
        <Icon as={Plus} className="text-primary-foreground size-4" />
        <Text>{k('btn_new_visit')}</Text>
      </Button>
      <FilterChips value={tab} onChange={setTab} options={(Object.keys(TABS) as (keyof typeof TABS)[]).map((x) => ({ value: x, label: k(`tab_${x}`) }))} />
      {res.isLoading ? (
        <LoadingList rows={4} />
      ) : !list.length ? (
        <EmptyState icon={CalendarPlus} title={k('no_visits')} />
      ) : (
        <Panel>
          {list.map((v, i) => (
            <RowItem
              key={v.id}
              leading={<IconTile icon={Building2} size={40} />}
              title={v.school?.name || v.school_id}
              meta={`${v.scheduled_date}${v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}`}
              trailing={<StatusChip label={k(`status_${v.status}`)} tone={CHIP[v.status]} />}
              onPress={() => router.push({ pathname: '/inspector/visits/[id]', params: { id: v.id } })}
              last={i === list.length - 1}
            />
          ))}
        </Panel>
      )}
    </ScrollView>
  );
}
