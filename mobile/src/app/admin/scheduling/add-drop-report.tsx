import type { AddDropRecord } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Initials, RoundIcon } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { DateField, todayYmd } from '@/components/app/date-field';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';

const monthStart = () => `${todayYmd().slice(0, 8)}01`;

/** Enrollments and drops in a date range (web: /admin/scheduling/add-drop-report). */
export default function AddDropReport() {
  const { t, i18n } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.add_drop_report.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(todayYmd());
  const [range, setRange] = useState({ start: monthStart(), end: todayYmd() });
  const [search, setSearch] = useState('');
  const res = useApi(yearId ? ['admin', 'add-drop-log', campusId ?? 'school', yearId, range.start, range.end] : null, ([, , , y, s, e]) =>
    adminScheduling.addDropLog({ campus_id: campusId, academic_year_id: y as string, start_date: s as string, end_date: e as string }),
  );
  const term = search.trim().toLowerCase();
  const rows = (res.data ?? []).filter((x) => !term || (x.student_name ?? '').toLowerCase().includes(term) || x.student_id.toLowerCase().includes(term) || x.course_title.toLowerCase().includes(term) || (x.course_period_title ?? '').toLowerCase().includes(term));
  const fmt = (d: string) => {
    const [y, m, day] = d.substring(0, 10).split('-');
    return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString(i18n.language === 'ar' ? 'ar-u-nu-latn' : 'en-US', { year: 'numeric', month: 'long', day: '2-digit' });
  };
  const download = () =>
    shareTextFile(
      'add-drop-report.csv',
      toCsv(
        [t('common.student'), t('common.student_id'), t('common.course'), r('th_course_period'), r('th_enrolled'), r('th_dropped')],
        rows.map((x) => [x.student_name || x.student_id, x.student_number ?? '', x.course_title, x.course_period_title ?? '', x.action === 'add' ? fmt(x.date) : '', x.action === 'drop' ? fmt(x.date) : '']),
      ),
      'text/csv',
      'public.comma-separated-values-text',
    ).catch((e) => toast.error(e instanceof Error ? e.message : ''));

  return (
    <>
      <Stack.Screen options={{ title: r('title') }} />
      <DataList
        items={res.data ? rows : undefined}
        error={res.error}
        isLoading={res.isLoading || years.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={r('no_records_found')}
        keyExtractor={(x: AddDropRecord) => `${x.student_id}-${x.course_title}-${x.date}-${x.action}`}
        header={
          <View className="gap-2 px-4 pt-3 pb-1">
            <Text className="text-sm font-medium">{r('timeframe')}</Text>
            <View className="flex-row items-end gap-2">
              <DateField className="flex-1" value={start} onChange={setStart} max={end} />
              <Text className="text-muted-foreground pb-3 text-sm">{r('to')}</Text>
              <DateField className="flex-1" value={end} onChange={setEnd} min={start} />
            </View>
            <Button size="sm" onPress={() => setRange({ start, end })}>
              <Text>{t('common.go')}</Text>
            </Button>
            <View className="flex-row items-center gap-2">
              <View className="flex-1 flex-row">
                <StatusChip label={r('found_records', { count: rows.length })} tone="info" className="px-2.5 py-1" />
              </View>
              <RoundIcon icon={Download} label={t('common.download')} onPress={download} />
            </View>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
          </View>
        }
        renderItem={(x: AddDropRecord) => (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <Initials name={x.student_name || '?'} tone={x.action === 'add' ? 'success' : 'destructive'} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold" numberOfLines={1}>
                {x.student_name || x.student_id}
              </Text>
              <Text className="text-xs" numberOfLines={1}>
                {x.course_title}
              </Text>
              <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                {[x.student_number, x.course_period_title].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View className="items-end gap-1">
              <StatusChip label={x.action === 'add' ? r('th_enrolled') : r('th_dropped')} tone={x.action === 'add' ? 'success' : 'destructive'} className="px-2 py-0.5" />
              <Text variant="muted" className="text-[11px]">
                {fmt(x.date)}
              </Text>
            </View>
          </View>
        )}
      />
    </>
  );
}
