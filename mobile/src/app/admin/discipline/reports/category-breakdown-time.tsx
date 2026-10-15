import type { DisciplineReferral } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAttendanceScope } from '@/features/admin/attendance';
import { CHARTABLE_TYPES, chosenValues, fieldOptions } from '@/features/admin/discipline';
import { monthKey, monthLabel, monthRange, schoolYearKey, TimeSeriesBreakdown, yearLabel, yearRange } from '@/features/admin/report-views';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Referral counts per option per month or school year (web: /admin/discipline/reports/category-breakdown-time). */
export default function DisciplineBreakdownOverTime() {
  const { t, i18n } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [fieldId, setFieldId] = useState('');
  const [timeframe, setTimeframe] = useState<'month' | 'year'>('month');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(todayYmd);
  const [loading, setLoading] = useState(false);
  const [referrals, setReferrals] = useState<DisciplineReferral[] | null>(null);
  const fields = useApi(schoolId ? ['admin', 'discipline-all-fields', schoolId] : null, () => adminDiscipline.getAllFields(schoolId));
  const chartable = (fields.data ?? []).filter((f) => CHARTABLE_TYPES.includes(f.field_type));
  const field = chartable.find((f) => f.id === fieldId);

  async function go() {
    if (!schoolId || !fieldId) return;
    setLoading(true);
    try {
      const res = await adminDiscipline.getReportReferrals({ school_id: schoolId, campus_id: campusId, start_date: start || undefined, end_date: end || undefined });
      if (!res.success) return toast.error(res.error || d('errors.loadReferrals'));
      setReferrals(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const keyOf = timeframe === 'month' ? monthKey : schoolYearKey;
  const endDate = end || todayYmd();
  const keys = timeframe === 'month' ? monthRange(monthKey(start || endDate), monthKey(endDate)) : yearRange(schoolYearKey(start || endDate), schoolYearKey(endDate));
  const options = field ? fieldOptions(field, d('yes'), t('app.dc_no')) : [];
  const counts: Record<string, Record<string, number>> = Object.fromEntries(keys.map((k) => [k, Object.fromEntries(options.map((o) => [o, 0]))]));
  if (field && referrals) {
    for (const r of referrals) {
      const bucket = counts[keyOf(r.incident_date)];
      if (!bucket) continue;
      for (const v of chosenValues(field, r.field_values?.[field.id], d('yes'), t('app.dc_no'))) if (bucket[v] !== undefined) bucket[v]++;
    }
  }
  const periods = keys.map((k) => ({ key: k, label: timeframe === 'month' ? monthLabel(k, i18n.language) : yearLabel(k) }));

  return (
    <>
      <Stack.Screen options={{ title: d('categoryBreakdownOverTime') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{d('category')}</Label>
              <Picker value={fieldId} onChange={setFieldId} placeholder={fields.isLoading ? d('loading') : d('chooseCategory')} options={chartable.map((f) => ({ value: f.id, label: f.name }))} />
            </View>
            <View className="gap-1.5">
              <Label>{d('timeframe')}</Label>
              <FilterChips<'month' | 'year'>
                value={timeframe}
                onChange={setTimeframe}
                options={[
                  { value: 'month', label: d('month') },
                  { value: 'year', label: d('schoolYear') },
                ]}
              />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={d('reportTimeframeFrom')} value={start} onChange={setStart} clearable />
              <DateField className="flex-1" label={d('to')} value={end} onChange={setEnd} clearable />
            </View>
            <Button onPress={go} disabled={!fieldId || loading}>
              <Text>{d('go')}</Text>
            </Button>
          </CardContent>
        </Card>
        {referrals && field ? (
          <Card>
            <CardHeader>
              <CardTitle>{`${field.name} ${d('breakdownOverTime')}`}</CardTitle>
            </CardHeader>
            <CardContent>
              {periods.length === 0 ? (
                <Text variant="muted" className="py-8 text-center">{d('noDataForFilters')}</Text>
              ) : (
                <TimeSeriesBreakdown periods={periods} options={options} counts={counts} optionHeader={d('option')} labels={{ column: d('column'), list: d('list') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
