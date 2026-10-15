import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Incomes and expenses per category for the year (web: /admin/accounting/reports). */
export default function CategoryRollup() {
  const { t } = useTranslation();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const ay = useAcademicYear();
  // Web default: the first of this month to today.
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(`${today.slice(0, 8)}01`);
  const [end, setEnd] = useState(today);
  const data = useApi(scopeId && ay.name ? ['admin', 'acc-rollup', scopeId, ay.name, start, end] : null, ([, , sid, y, s1, e1]) =>
    adminAccounting.categoryRollup(sid as string, y as string, { start_date: (s1 as string) || undefined, end_date: (e1 as string) || undefined }),
  );

  const block = (title: string, rows: { category_id: string | null; category_name: string; total: number }[] = []) => {
    const max = Math.max(1, ...rows.map((r) => Number(r.total) || 0));
    const total = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    return (
      <Card className="gap-3 py-4">
        <CardHeader className="flex-row justify-between px-4">
          <CardTitle>{title}</CardTitle>
          <Text className="font-semibold">{money(total)}</Text>
        </CardHeader>
        <CardContent className="gap-3 px-4">
          {rows.length === 0 ? <Text variant="muted">—</Text> : null}
          {rows.map((r) => (
            <View key={r.category_id ?? r.category_name} className="gap-1">
              <View className="flex-row justify-between gap-3">
                <Text className="flex-1">{r.category_name || t('app.ac_uncategorised')}</Text>
                <Text className="text-muted-foreground text-sm">{money(r.total)}</Text>
              </View>
              <View className="bg-muted h-2 overflow-hidden rounded-full">
                <View className="bg-primary h-2 rounded-full" style={{ width: `${((Number(r.total) || 0) / max) * 100}%` }} />
              </View>
            </View>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t('app.ac_rollup') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Picker value={ay.id} onChange={ay.pick} options={ay.options} />
        <Text className="text-sm font-medium">{t('admin.accounting.reports.period')}</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <DateField value={start || null} onChange={(v) => setStart(v ?? '')} clearable />
          </View>
          <Text>{t('common.to')}</Text>
          <View className="flex-1">
            <DateField value={end || null} onChange={(v) => setEnd(v ?? '')} clearable />
          </View>
        </View>
        {data.isLoading ? <LoadingList rows={4} /> : null}
        {data.data ? (
          <>
            {block(t('app.ac_incomes'), data.data.incomes)}
            {block(t('app.ac_expenses'), data.data.expenses)}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
