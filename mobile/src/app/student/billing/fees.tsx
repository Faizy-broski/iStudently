import { Stack } from 'expo-router';
import { DollarSign, Receipt, ReceiptText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { FeeDueDateBadge, FeeStatus } from '@/features/portal/fees';
import { PortalError } from '@/features/portal/ui';
import { portal, student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Fee invoices with totals, plus additional billing-element charges (web: /student/billing/fees). */
export default function StudentFees() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.fees.${key}`, o);
  const { money } = usePortalCurrency();
  const fees = useApi(['student', 'fees'], () => student.getStudentFees());
  const elements = useApi(['student', 'billing-elements'], () => portal.myBillingElements());

  if (fees.isLoading) return <LoadingList rows={6} />;
  if (fees.error) return <PortalError title={k('error_loading')} message={fees.error.message} />;
  const list = fees.data ?? [];
  const due = list.filter((f) => f.status !== 'paid').reduce((s, f) => s + f.balance, 0);
  const paid = list.reduce((s, f) => s + f.amount_paid, 0);
  const overdue = list.filter((f) => f.status === 'overdue').length;
  const extra = elements.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              fees.mutate();
              elements.mutate();
            }}
          />
        }>
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardContent className="p-4">
            <Text className="text-muted-foreground mb-1 text-sm">{k('total_outstanding')}</Text>
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
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-muted-foreground text-xs">{`${k('col_due_date')}: ${f.due_date ? formatDate(f.due_date) : '—'}`}</Text>
                    <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                  </View>
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
    </>
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
