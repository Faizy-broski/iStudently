import { router, Stack } from 'expo-router';
import { Building2, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** Reports the inspector wrote; each opens the visit's report page (web: /inspector/reports). */
export default function InspectorReports() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.reports.${key}`);
  const res = useApi(['inspector', 'reports'], () => inspector.myReports());
  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: k('list_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {k('inspector_list_subtitle')}
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
                leading={<IconTile icon={Building2} size={40} />}
                title={r.school?.name ?? ''}
                meta={`${r.teacher ? `${r.teacher.first_name} ${r.teacher.last_name} · ` : ''}${formatDate(r.created_at)}`}
                trailing={<StatusChip label={k(`status_${r.status}`)} tone={r.status === 'fully_signed' ? 'success' : 'muted'} />}
                onPress={() => router.push({ pathname: '/inspector/visits/[id]/report', params: { id: r.visit_id } })}
                last={i === list.length - 1}
              />
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
