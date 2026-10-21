import { Stack } from 'expo-router';
import { Calendar, DollarSign } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { PortalError } from '@/features/portal/ui';
import i18n from '@/i18n';

export type PortalPayment = { id: string; payment_date: string; amount: number; payment_method?: string | null; payment_reference?: string | null; received_by?: string | null; fee_name?: string };

/** Payments of one month grouped by day (web: /student and /parent billing/daily-transactions); the parent's rows fall back to the fee name. */
export function DailyTransactionsView({ data }: { data: { data?: PortalPayment[]; isLoading: boolean; error?: Error | null; mutate: () => unknown } }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.daily_transactions.${key}`, o);
  const { money } = usePortalCurrency();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const months = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(loc, { month: 'long' }));

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error_loading')} message={data.error.message} />;
  const inMonth = (data.data ?? []).filter((p) => {
    if (!p.payment_date) return false;
    const d = new Date(p.payment_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const byDay = new Map<string, typeof inMonth>();
  for (const p of inMonth) byDay.set(p.payment_date.slice(0, 10), [...(byDay.get(p.payment_date.slice(0, 10)) ?? []), p]);
  const days = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
  const total = inMonth.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Picker value={String(month)} onChange={(v) => setMonth(Number(v))} options={months.map((m, i) => ({ value: String(i), label: m }))} />
          </View>
          <View className="w-28">
            <Picker value={String(year)} onChange={(v) => setYear(Number(v))} options={[now.getFullYear() - 1, now.getFullYear()].map((y) => ({ value: String(y), label: String(y) }))} />
          </View>
        </View>
        <Card>
          <CardContent className="flex-row items-center gap-4 p-4">
            <Icon as={DollarSign} className="size-10 text-success" />
            <View>
              <Text className="text-muted-foreground text-sm">{k('monthly_total', { month: months[month], year })}</Text>
              <Text className="text-3xl font-bold text-success">{money(total)}</Text>
              <Text className="text-muted-foreground text-xs">{k('transactions_count', { count: inMonth.length })}</Text>
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={Calendar} className="size-5" />
            <CardTitle>{k('transactions_card_title')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-4">
            {days.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={DollarSign} className="text-muted-foreground mb-3 size-12" />
                <EmptyState title={k('no_transactions', { month: months[month], year })} />
              </View>
            ) : (
              days.map(([day, items]) => (
                <View key={day} className="gap-1">
                  <Text className="text-muted-foreground mb-1 text-sm font-semibold">
                    {new Date(`${day}T00:00:00`).toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </Text>
                  {items.map((p) => (
                    <View key={p.id} className="border-info-soft dark:border-border bg-card flex-row items-center justify-between gap-2 rounded-xl border p-3">
                      <View className="flex-1 flex-row items-center gap-2">
                        <Badge variant="outline">
                          <Text className="text-xs">{p.payment_method || '—'}</Text>
                        </Badge>
                        <Text className="text-muted-foreground flex-1 text-sm">{p.payment_reference || p.fee_name || k('no_reference')}</Text>
                      </View>
                      <Text className="font-semibold text-success">{money(p.amount)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
