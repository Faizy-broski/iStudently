import type { AppealStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { MessageSquareWarning } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

const STATUS: Record<AppealStatus, ChipTone> = {
  submitted: 'warning',
  under_review: 'info',
  escalated: 'warning',
  upheld: 'success',
  denied: 'destructive',
  withdrawn: 'muted',
};

/** Appeals the teacher filed against evaluations (web: /teacher/inspections/appeals). */
export default function TeacherInspectionAppeals() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.appeals.${key}`);
  const res = useApi(['teacher', 'inspection-appeals'], () => teacherInspections.myAppeals());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('list_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('teacher_list_subtitle')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState icon={MessageSquareWarning} title={k('no_appeals')} />
        ) : (
          <Panel>
            {list.map((a, i) => (
              <RowItem
                key={a.id}
                onPress={() => router.push({ pathname: '/teacher/inspections/appeals/[id]', params: { id: a.id } })}
                leading={<IconTile icon={MessageSquareWarning} tone="warning" size={40} round />}
                title={a.reason}
                meta={formatDate(a.created_at)}
                trailing={<StatusChip label={k(`status_${a.status}`)} tone={STATUS[a.status] ?? 'muted'} />}
                last={i === list.length - 1}
              />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
