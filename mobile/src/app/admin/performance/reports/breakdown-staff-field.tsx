import type { StaffPerformanceLog } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { CountsBreakdown } from '@/features/admin/report-views';
import { useCampus } from '@/features/campus/campus';
import { adminPerformance } from '@/lib/api';

const FIELDS = ['role', 'employment_type', 'department'] as const;
type Field = (typeof FIELDS)[number];

/** Incident counts by a staff field: role, employment type or department (web: /admin/performance/reports/breakdown-staff-field). */
export default function PerformanceByStaffField() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`app.pe_${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const [field, setField] = useState<Field>('role');
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
  for (const l of logs ?? []) {
    const key = (l.staff?.[field] as string | null | undefined)?.trim() || p('not_specified');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const data = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, x) => s + x.value, 0);
  const label = p(`field_${field}`);

  return (
    <>
      <Stack.Screen options={{ title: p('breakdown_staff_field') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{p('staff_field')}</Label>
              <Picker value={field} onChange={(v) => setField(v as Field)} placeholder={p('choose_staff_field')} options={FIELDS.map((f) => ({ value: f, label: p(`field_${f}`) }))} />
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
              <CardTitle>{`${label} · ${p('logs_count', { count: total })}`}</CardTitle>
            </CardHeader>
            <CardContent>
              {!data.length ? (
                <EmptyState title={p('no_logs_filters')} />
              ) : (
                <CountsBreakdown data={data} nameHeader={label} valueHeader={p('number_of_logs')} labels={{ column: p('column'), pie: p('pie'), list: p('list'), total: p('total') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
