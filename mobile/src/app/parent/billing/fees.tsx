import { Stack } from 'expo-router';
import { DollarSign, Receipt, ReceiptText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { FeeStatus } from '@/features/portal/fees';
import { PortalError } from '@/features/portal/ui';
import { adminParents, parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'selected' | 'all';

/** Fee invoices and payment status: the selected child, or all linked children at once (web: /parent/billing/fees). */
export default function ParentFees() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.fees.${key}`, o);
  const [tab, setTab] = useState<Tab>('selected');
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-4">
          <Text variant="muted">{t('app.pa_fees_subtitle')}</Text>
          <FilterChips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'selected', label: t('app.pa_fees_tab_selected') },
              { value: 'all', label: t('app.pa_fees_tab_all') },
            ]}
          />
        </View>
        {tab === 'selected' ? <SelectedChild /> : <AllChildren />}
      </View>
    </>
  );
}

function SelectedChild() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.fees.${key}`, o);
  const p = (key: string) => t(`app.pa_fees_${key}`);
  const { money } = usePortalCurrency();
  const { childId } = useChild();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  const elements = useApi(childId ? ['parent', 'billing-elements', childId] : null, ([, , id]) => parent.getChildBillingElements(id as string));
  const status = useApi(childId ? ['parent', 'fee-status', childId] : null, ([, , id]) => parent.getFeeStatus(id as string));

  if (!childId) return <NoChild />;
  if (fees.isLoading) return <LoadingList rows={6} />;
  if (fees.error) return <PortalError title={k('error_loading')} message={fees.error.message} />;
  const list = fees.data ?? [];
  const due = list.filter((f) => f.status !== 'paid').reduce((s, f) => s + f.balance, 0);
  const paid = list.reduce((s, f) => s + f.amount_paid, 0);
  const overdue = list.filter((f) => f.status === 'overdue').length;
  const extra = elements.data ?? [];
  const fs = status.data;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-3 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([fees.mutate(), elements.mutate(), status.mutate()])} />}>
      {fs ? (
        <Card>
          <CardHeader>
            <CardTitle>{p('summary')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-row flex-wrap gap-y-4">
            <Stat label={p('total_due')} value={money(fs.total_due)} tone="text-red-600" />
            <Stat label={p('overdue_amount')} value={money(fs.overdue_amount)} tone="text-orange-600" />
            <Stat label={p('next_due_date')} value={fs.next_due_date ? formatDate(fs.next_due_date) : '—'} />
            <Stat label={p('next_due_amount')} value={fs.next_due_amount !== undefined && fs.next_due_amount !== null ? money(fs.next_due_amount) : '—'} />
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="p-4">
          <Text className="text-muted-foreground mb-1 text-sm">{p('outstanding')}</Text>
          <Text className={cn('text-3xl font-bold', due > 0 && 'text-red-600')}>{money(due)}</Text>
          {overdue > 0 ? <Text className="mt-1 text-xs text-red-500">{k('overdue_count', { count: overdue })}</Text> : null}
        </CardContent>
      </Card>
      <View className="flex-row gap-3">
        <Card className="flex-1">
          <CardContent className="p-4">
            <Text className="text-muted-foreground mb-1 text-sm">{k('total_paid')}</Text>
            <Text className="text-2xl font-bold text-green-600">{money(paid)}</Text>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4">
            <Text className="text-muted-foreground mb-1 text-sm">{k('total_invoices')}</Text>
            <Text className="text-2xl font-bold">{String(list.length)}</Text>
          </CardContent>
        </Card>
      </View>
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Icon as={Receipt} className="size-5" />
          <CardTitle>{k('fee_invoices')}</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <View className="items-center py-10">
              <Icon as={DollarSign} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground">{k('no_records')}</Text>
            </View>
          ) : (
            list.map((f) => (
              <View key={f.id} className="border-border gap-1.5 border-t py-3 first:border-t-0">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-medium">{f.fee_name}</Text>
                    <Text className="text-muted-foreground text-xs">{f.academic_year}</Text>
                  </View>
                  <FeeStatus status={f.status} />
                </View>
                <Text className="text-muted-foreground text-xs">{`${k('col_due_date')}: ${f.due_date ? formatDate(f.due_date) : '—'}`}</Text>
                <View className="flex-row justify-between">
                  <Amount label={k('col_amount')} value={money(f.final_amount)} />
                  <Amount label={k('col_paid')} value={money(f.amount_paid)} tone="text-green-600" />
                  <Amount label={k('col_balance')} value={money(f.balance)} tone="font-semibold text-red-600" />
                </View>
              </View>
            ))
          )}
        </CardContent>
      </Card>
      {extra.length ? (
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={ReceiptText} className="size-5" />
            <CardTitle>{k('additional_charges')}</CardTitle>
          </CardHeader>
          <CardContent>
            {extra.map((el) => (
              <View key={el.id} className="border-border gap-1.5 border-t py-3 first:border-t-0">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-medium">{el.element_title}</Text>
                    {el.category_title ? <Text className="text-muted-foreground text-xs">{el.category_title}</Text> : null}
                  </View>
                  <FeeStatus status={el.status} />
                </View>
                <View className="flex-row gap-6">
                  <Amount label={k('col_amount')} value={money(el.amount)} />
                  <Amount label={k('col_paid')} value={money(el.amount_paid)} tone="text-green-600" />
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function AllChildren() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.fees.${key}`, o);
  const p = (key: string, o?: Record<string, unknown>) => t(`app.pa_fees_${key}`, o);
  const { money } = usePortalCurrency();
  const res = useApi(['parent', 'all-children-fees'], () => adminParents.myChildrenFees());

  if (res.isLoading) return <LoadingList rows={6} />;
  if (res.error) return <PortalError title={p('all_error')} message={res.error.message} />;
  const data = res.data ?? { fees: [], children: [], totalDue: 0, totalOverdue: 0 };

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
      {data.children.length === 0 ? (
        <Card>
          <CardContent className="items-center py-12">
            <Icon as={DollarSign} className="text-muted-foreground mb-3 size-12" />
            <Text className="text-muted-foreground">{p('no_children')}</Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <View className="flex-row gap-3">
            <Card className="flex-1">
              <CardContent className="p-4">
                <Text className="text-muted-foreground mb-1 text-sm">{p('all_due')}</Text>
                <Text className="text-2xl font-bold text-red-600">{money(data.totalDue)}</Text>
              </CardContent>
            </Card>
            <Card className="flex-1">
              <CardContent className="p-4">
                <Text className="text-muted-foreground mb-1 text-sm">{p('all_overdue')}</Text>
                <Text className="text-2xl font-bold text-orange-600">{money(data.totalOverdue)}</Text>
              </CardContent>
            </Card>
          </View>
          {data.children.map((c) => {
            const childDue = c.fees.filter((f) => f.status !== 'paid').reduce((s, f) => s + (f.balance || 0), 0);
            return (
              <Card key={c.id}>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <CardTitle className="flex-1">{`${c.name || p('student')}${c.grade_level ? ` — ${c.grade_level}` : ''}`}</CardTitle>
                  <Text className="font-semibold text-red-600">{p('due', { amount: money(childDue) })}</Text>
                </CardHeader>
                <CardContent>
                  {c.fees.length === 0 ? (
                    <Text className="text-muted-foreground py-4 text-sm">{k('no_records')}</Text>
                  ) : (
                    c.fees.map((f) => (
                      <View key={f.id} className="border-border gap-1.5 border-t py-3 first:border-t-0">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="text-muted-foreground text-sm">{f.due_date ? formatDate(f.due_date) : '—'}</Text>
                          <FeeStatus status={f.status} />
                        </View>
                        <View className="flex-row justify-between">
                          <Amount label={k('col_amount')} value={money(f.final_amount || 0)} />
                          <Amount label={k('col_paid')} value={money(f.amount_paid || 0)} tone="text-green-600" />
                          <Amount label={k('col_balance')} value={money(f.balance || 0)} tone="font-semibold text-red-600" />
                        </View>
                      </View>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="w-1/2 pe-2">
      <Text className="text-muted-foreground mb-1 text-sm">{label}</Text>
      <Text className={cn('text-xl font-bold', tone)}>{value}</Text>
    </View>
  );
}

function Amount({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View>
      <Text className="text-muted-foreground text-[11px] uppercase">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
