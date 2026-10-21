import type { DisciplineReferral } from '@studently/api-client';
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
import { useAttendanceScope } from '@/features/admin/attendance';
import { CHARTABLE_TYPES, chosenValues, fieldOptions } from '@/features/admin/discipline';
import { CountsBreakdown } from '@/features/admin/report-views';
import { adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Referral counts per option of one category (web: /admin/discipline/reports/category-breakdown). */
export default function DisciplineCategoryBreakdown() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [fieldId, setFieldId] = useState('');
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

  const counts: Record<string, number> = {};
  if (field && referrals) {
    for (const o of fieldOptions(field, d('yes'), t('app.dc_no'))) counts[o] = 0;
    for (const r of referrals) for (const v of chosenValues(field, r.field_values?.[field.id], d('yes'), t('app.dc_no'))) counts[v] = (counts[v] ?? 0) + 1;
  }
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <Stack.Screen options={{ title: d('categoryBreakdown') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{d('category')}</Label>
              <Picker value={fieldId} onChange={setFieldId} placeholder={fields.isLoading ? d('loadingCategories') : chartable.length ? d('chooseCategory') : t('app.dc_no_chartable')} options={chartable.map((f) => ({ value: f.id, label: f.name }))} />
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
              <CardTitle>{`${field.name} · ${d('referralsCount', { count: total })}`}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <EmptyState title={d('noReferralsForFilters')} />
              ) : (
                <CountsBreakdown data={data} nameHeader={d('option')} valueHeader={d('numberOfReferrals')} labels={{ column: d('column'), pie: d('pie'), list: d('list'), total: d('total') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
