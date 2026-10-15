import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { adminBillingElements } from '@/lib/api';
import { useApi } from '@/lib/data';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Charges per category (or per grade) in a period (web: /admin/billing-elements/category-breakdown). */
export default function ElementBreakdown() {
  const { t } = useTranslation();
  const { money } = useCurrency();
  const c = (k: string) => t(`admin.billing_elements.category_breakdown.${k}`);
  // Web default: eight months back to today.
  const start = new Date();
  start.setMonth(start.getMonth() - 8);
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [by, setBy] = useState<'category' | 'grade'>('category');
  const [metric, setMetric] = useState<'number' | 'amount'>('number');
  const [categoryId, setCategoryId] = useState('');
  const categories = useApi(['admin', 'be-categories'], () => adminBillingElements.categories());
  const valid = DATE.test(from) && DATE.test(to);
  const data = useApi(valid ? ['admin', 'be-breakdown', from, to, by, metric, categoryId] : null, ([, , f, tt, b, mt, cat]) =>
    adminBillingElements.categoryBreakdown({ from_date: f as string, to_date: tt as string, by_grade: b === 'grade', metric: mt as 'number' | 'amount', category_id: (cat as string) || undefined }),
  );
  const rows = data.data?.breakdown ?? [];
  const valueOf = (r: { count: number; total_amount: number }) => (metric === 'number' ? Number(r.count) || 0 : Number(r.total_amount) || 0);
  const max = Math.max(1, ...rows.map(valueOf));

  return (
    <>
      <Stack.Screen options={{ title: t('app.be_breakdown_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateField value={from} onChange={(v) => setFrom(v ?? from)} />
          </View>
          <View className="flex-1">
            <DateField value={to} onChange={(v) => setTo(v ?? to)} />
          </View>
        </View>
        <Picker value={categoryId} onChange={setCategoryId} options={[{ value: '', label: c('choose_category') }, ...(categories.data ?? []).map((x) => ({ value: x.id, label: x.title }))]} />
        <FilterChips<'number' | 'amount'>
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'number', label: c('number') },
            { value: 'amount', label: t('common.amount') },
          ]}
        />
        <FilterChips<'category' | 'grade'>
          value={by}
          onChange={setBy}
          options={[
            { value: 'category', label: t('app.be_category') },
            { value: 'grade', label: c('breakdown_by_grade') },
          ]}
        />
        {data.isLoading ? <LoadingList rows={4} /> : null}
        {data.data && rows.length === 0 ? <EmptyState title={t('app.be_tx_none')} /> : null}
        {data.data ? <Text className="font-semibold">{t('app.be_tx_total', { count: data.data.total_count, total: money(data.data.total_amount) })}</Text> : null}
        {rows.length ? (
          <Card className="py-4">
            <CardContent className="gap-3 px-4">
              {rows.map((r, i) => (
                <View key={i} className="gap-1">
                  <View className="flex-row justify-between gap-3">
                    <Text className="flex-1">{by === 'grade' ? r.grade_name || c('unknown') : r.category_title || c('uncategorized')}</Text>
                    <Text className="text-muted-foreground text-sm">{metric === 'number' ? String(r.count) : money(r.total_amount)}</Text>
                  </View>
                  <View className="bg-muted h-2 overflow-hidden rounded-full">
                    <View className="bg-primary h-2 rounded-full" style={{ width: `${(valueOf(r) / max) * 100}%` }} />
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
