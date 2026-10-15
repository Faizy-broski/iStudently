import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { BarChart } from '@/components/app/charts';
import { DateField, parseYmd, todayYmd } from '@/components/app/date-field';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { adminStaffAbsences } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Days absent per staff member per month, stacked chart + totals (web: /admin/staff-absences/breakdown). */
export default function AbsenceBreakdown() {
  const { t, i18n } = useTranslation();
  const s = (k: string) => t(`staffAbsences.${k}`);
  const { schoolId, campusId } = useAttendanceScope();
  const [start, setStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [end, setEnd] = useState(todayYmd);
  const res = useApi(schoolId ? ['admin', 'absence-breakdown', schoolId, campusId ?? 'school', start, end] : null, () =>
    adminStaffAbsences.breakdown({ school_id: schoolId, campus_id: campusId, start_date: start, end_date: end }),
  );
  const rows = res.data ?? [];
  const names = [...new Set(rows.map((r) => r.staff_name))];
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const value = (m: string, n: string) => rows.filter((r) => r.month === m && r.staff_name === n).reduce((x, r) => x + r.days_absent, 0);
  const monthLabel = (m: string) => {
    const d = parseYmd(`${m}-01`);
    return d ? new Intl.DateTimeFormat(i18n.language, { month: 'short', year: '2-digit' }).format(d) : m;
  };
  const totals = names.map((n) => ({ n, total: rows.filter((r) => r.staff_name === n).reduce((x, r) => x + r.days_absent, 0) })).sort((a, b) => b.total - a.total);

  return (
    <>
      <Stack.Screen options={{ title: s('breakdown.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="flex-row gap-2">
          <DateField className="flex-1" label={s('filters.from')} value={start} onChange={setStart} clearable />
          <DateField className="flex-1" label={s('filters.to')} value={end} onChange={setEnd} clearable />
        </View>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState title={s('empty.breakdown')} />
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{s('breakdown.staffAbsenceByMonth')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart stacked yLabel={s('table.days')} categories={months.map(monthLabel)} series={names.map((n) => ({ name: n, values: months.map((m) => value(m, n)) }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{s('breakdown.totalDaysAbsentByStaff')}</CardTitle>
              </CardHeader>
              <CardContent className="gap-0">
                <View className="border-border flex-row border-b py-2">
                  <Text className="flex-1 font-medium">{s('table.staffMember')}</Text>
                  <Text className="font-medium">{s('breakdown.totalDays')}</Text>
                </View>
                {totals.map((r) => (
                  <View key={r.n} className="border-border flex-row border-b py-2">
                    <Text className="flex-1">{r.n}</Text>
                    <Text className="font-mono">{Math.round(r.total * 10) / 10}</Text>
                  </View>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </>
  );
}
