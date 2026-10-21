import { Stack } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { IconTile, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminPeriods } from '@/lib/api';
import { useApi } from '@/lib/data';
import i18n from '@/i18n';

const time12 = (v?: string | null) => {
  if (!v) return '—';
  const [h, m] = v.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(i18n.language === 'ar' ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' });
};

/** The campus's bell periods, read-only (web: /teacher/periods). */
export default function TeacherPeriods() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.periods.${key}`, o);
  const { campus, campusId } = useCampus();
  const res = useApi(['teacher', 'periods', campusId ?? 'school'], () => adminPeriods.list(campusId ?? undefined));
  const list = [...(res.data ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {campus ? k('schoolPeriodsWithCampus', { campus: campus.name }) : k('schoolPeriods')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={5} />
        ) : !list.length ? (
          <EmptyState icon={Clock} title={k('noPeriodsDefined')} />
        ) : (
          <Panel>
            {list.map((p, i) => (
              <RowItem
                key={p.id}
                leading={<IconTile icon={Clock} size={40} />}
                title={p.title || p.period_name || '—'}
                meta={`${k('shortName')}: ${p.short_name || '—'} · ${k('block')}: ${p.block || '—'} · ${k('lengthMin')}: ${p.length_minutes ?? '—'}`}
                trailing={<StatusChip label={`${k('order')}: ${p.sort_order ?? '—'}`} tone="muted" />}
                last={i === list.length - 1}>
                <Text className="text-brand dark:text-brand-secondary ps-[52px] text-sm font-semibold">{`${time12(p.start_time)} – ${time12(p.end_time)}`}</Text>
              </RowItem>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
