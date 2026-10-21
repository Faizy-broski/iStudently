import type { StaffPerformanceLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { actionName } from '@/features/admin/performance';
import { monthKey, monthLabel, monthRange, schoolYearKey, TimeSeriesBreakdown, yearLabel, yearRange } from '@/features/admin/report-views';
import { useCampus } from '@/features/campus/campus';
import { adminPerformance } from '@/lib/api';

/** Incidents per action per month or school year (web: /admin/performance/reports/category-breakdown-time). */
export default function PerformanceBreakdownOverTime() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [timeframe, setTimeframe] = useState<'month' | 'year'>('month');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(todayYmd);
  const [logs, setLogs] = useState<StaffPerformanceLog[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const res = await adminPerformance.allLogs({ campusId, startDate: start || undefined, endDate: end || undefined });
      if (!res.success) return toast.error(res.error || p('load_failed'));
      setLogs(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const endDate = end || todayYmd();
  const keyOf = timeframe === 'month' ? monthKey : schoolYearKey;
  const keys = timeframe === 'month' ? monthRange(monthKey(start || endDate), monthKey(endDate)) : yearRange(schoolYearKey(start || endDate), schoolYearKey(endDate));
  const actions = [...new Set((logs ?? []).filter((l) => l.action).map((l) => actionName(l.action, i18n.language)))];
  const counts: Record<string, Record<string, number>> = Object.fromEntries(keys.map((k) => [k, Object.fromEntries(actions.map((a) => [a, 0]))]));
  for (const l of logs ?? []) {
    const bucket = l.action ? counts[keyOf(l.created_at)] : undefined;
    if (bucket && l.action) bucket[actionName(l.action, i18n.language)] += 1;
  }
  const periods = keys.map((k) => ({ key: k, label: timeframe === 'month' ? monthLabel(k, i18n.language) : yearLabel(k) }));

  return (
    <>
      <Stack.Screen options={{ title: p('breakdown_over_time') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{p('timeframe')}</Label>
              <FilterChips<'month' | 'year'>
                value={timeframe}
                onChange={setTimeframe}
                options={[
                  { value: 'month', label: p('month') },
                  { value: 'year', label: p('school_year') },
                ]}
              />
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={p('from')} value={start} onChange={setStart} clearable />
              <DateField className="flex-1" label={p('to')} value={end} onChange={setEnd} clearable />
            </View>
            <Button onPress={go} disabled={loading}>
              <Text>{p('go')}</Text>
            </Button>
          </CardContent>
        </Card>
        {logs ? (
          <Card>
            <CardHeader>
              <CardTitle>{p('breakdown_over_time')}</CardTitle>
            </CardHeader>
            <CardContent>
              {!actions.length ? (
                <EmptyState title={p('no_logs_filters')} />
              ) : (
                <TimeSeriesBreakdown periods={periods} options={actions} counts={counts} optionHeader={p('action')} labels={{ column: p('column'), list: p('list') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
