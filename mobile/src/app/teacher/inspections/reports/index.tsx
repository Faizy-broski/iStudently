import { router, Stack } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** Inspection reports about the teacher, to read and sign (web: /teacher/inspections/reports). */
export default function TeacherInspectionReports() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.reports.${key}`);
  const res = useApi(['teacher', 'inspection-reports'], () => teacherInspections.myReports());
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
          <EmptyState icon={FileText} title={k('no_reports')} />
        ) : (
          <Panel>
            {list.map((r, i) => (
              <RowItem
                key={r.id}
                onPress={() => router.push({ pathname: '/teacher/inspections/reports/[id]', params: { id: r.id } })}
                leading={<IconTile icon={FileText} size={40} round />}
                title={r.school?.name ?? ''}
                meta={formatDate(r.created_at)}
                trailing={<StatusChip label={k(`status_${r.status}`)} tone={r.status === 'fully_signed' ? 'success' : 'warning'} />}
                last={i === list.length - 1}
              />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
