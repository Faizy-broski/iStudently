import type { ADAGradeRow } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { GraduationCap, Sigma } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { DataList } from '@/components/app/data-list';
import { IconTile } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminAttendance } from '@/lib/api';
import { cn } from '@/lib/utils';

const firstOfMonth = () => `${todayYmd().slice(0, 8)}01`;

/** Average daily attendance by grade for a date range (web: /admin/attendance/average-daily). */
export default function AverageDailyAttendance() {
  const { t } = useTranslation();
  const a = (k: string) => t(`attendance.${k}`);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(firstOfMonth);
  const [end, setEnd] = useState(todayYmd);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ADAGradeRow[] | null>(null);

  async function go() {
    if (!schoolId) return;
    if (start > end) return toast.error(t('app.at_range_order'));
    setLoading(true);
    try {
      const res = await adminAttendance.getADAByGrade({ school_id: schoolId, start_date: start, end_date: end, campus_id: campusId });
      if (res.success && res.data) setData(res.data);
      else toast.error(res.error || t('app.error_title'));
    } finally {
      setLoading(false);
    }
  }

  const metric = (label: string, value: string | number) => (
    <View className="w-1/3 py-1">
      <Text variant="muted" className="text-[11px]">
        {label}
      </Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: a('averageDaily') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <View className="flex-row gap-2">
                <DateField className="flex-1" label={t('app.at_from')} value={start} onChange={(d) => d && setStart(d)} />
                <DateField className="flex-1" label={t('app.at_to')} value={end} onChange={(d) => d && setEnd(d)} />
              </View>
              <Button onPress={go} disabled={loading || !schoolId}>
                <Text>{t('app.at_go')}</Text>
              </Button>
            </View>
          }
          items={data ?? (loading ? undefined : [])}
          isLoading={loading}
          emptyTitle={data === null ? a('ada_selectRange') : a('ada_noData')}
          keyExtractor={(r) => r.grade_id}
          renderItem={(r) => {
            const total = r.grade_id === '__total__';
            return (
              <View className={cn('gap-2 px-4 py-3', total && 'bg-info-soft/60')}>
                <View className="flex-row items-center gap-3">
                  <IconTile icon={total ? Sigma : GraduationCap} tone={total ? 'brand' : 'success'} />
                  <Text className={cn('flex-1 text-sm', total ? 'font-bold' : 'font-semibold')}>{r.grade_name}</Text>
                  <StatusChip label={`${r.ada}%`} tone={Number(r.ada) >= 90 ? 'success' : Number(r.ada) >= 75 ? 'warning' : 'destructive'} className="px-2 py-0.5" />
                </View>
                <View className="flex-row flex-wrap">
                  {metric(a('ada_th_students'), r.students)}
                  {metric(a('ada_th_daysPossible'), r.days_possible)}
                  {metric(a('statusPresent'), r.days_present)}
                  {metric(a('statusAbsent'), r.days_absent)}
                  {metric(a('ada_th_ada'), `${r.ada}%`)}
                  {metric(a('ada_th_averageAttendance'), r.avg_attendance)}
                  {metric(a('ada_th_averageAbsent'), r.avg_absent)}
                </View>
              </View>
            );
          }}
        />
      </View>
    </>
  );
}
