import type { VisitStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Building2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

const STATUS: Record<VisitStatus, ChipTone> = {
  scheduled: 'warning',
  confirmed: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'destructive',
  rescheduled: 'muted',
};

/** Inspection visits that include the teacher; completed / in-progress ones open the evaluation (web: /teacher/inspections). */
export default function TeacherInspectionVisits() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.visits.${key}`);
  const res = useApi(['teacher', 'inspection-visits'], () => teacherInspections.myVisits());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('teacher_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('teacher_page_subtitle')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={Building2} title={k('no_visits')} />
        ) : (
          <Panel>
            {list.map((v, i) => {
              const canOpen = v.status === 'completed' || v.status === 'in_progress';
              return (
                <RowItem
                  key={v.id}
                  onPress={canOpen ? () => router.push({ pathname: '/teacher/inspections/[visitId]', params: { visitId: v.id } }) : undefined}
                  leading={<IconTile icon={Building2} size={40} round />}
                  title={v.school?.name || v.school_id}
                  meta={`${v.scheduled_date}${v.scheduled_start_time ? ` · ${v.scheduled_start_time}` : ''}`}
                  trailing={<StatusChip label={k(`status_${v.status}`)} tone={STATUS[v.status] ?? 'muted'} />}
                  last={i === list.length - 1}
                />
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
