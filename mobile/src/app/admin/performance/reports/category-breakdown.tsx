import type { StaffPerformanceLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { actionName } from '@/features/admin/performance';
import { CountsBreakdown } from '@/features/admin/report-views';
import { useCampus } from '@/features/campus/campus';
import { adminPerformance } from '@/lib/api';

/** Incident counts per catalog action (web: /admin/performance/reports/category-breakdown). */
export default function PerformanceCategoryBreakdown() {
  const { t, i18n } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
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

  const counts: Record<string, number> = {};
  for (const l of logs ?? []) if (l.action) counts[actionName(l.action, i18n.language)] = (counts[actionName(l.action, i18n.language)] ?? 0) + 1;
  const data = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <Stack.Screen options={{ title: p('category_breakdown') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
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
              <CardTitle>{`${p('breakdown_title')} · ${p('logs_count', { count: total })}`}</CardTitle>
            </CardHeader>
            <CardContent>
              {!data.length ? (
                <EmptyState title={p('no_logs_filters')} />
              ) : (
                <CountsBreakdown data={data} nameHeader={p('action')} valueHeader={p('number_of_logs')} labels={{ column: p('column'), pie: p('pie'), list: p('list'), total: p('total') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
