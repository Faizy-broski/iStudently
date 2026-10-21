import { Stack } from 'expo-router';
import { CheckCircle2, DollarSign, Receipt, ReceiptText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
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
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              fees.mutate();
              elements.mutate();
            }}
          />
        }>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <HeroCard>
          <Text className="text-sm font-semibold text-white/85">{k('total_outstanding')}</Text>
          <Text className="text-3xl font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
            {money(due)}
          </Text>
          {overdue > 0 ? (
            <View className="self-start rounded-full bg-white/15 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{k('overdue_count', { count: overdue })}</Text>
            </View>
          ) : null}
        </HeroCard>
        <StatTiles>
          <StatTile icon={CheckCircle2} tone="success" label={k('total_paid')} value={money(paid)} />
          <StatTile icon={Receipt} label={k('total_invoices')} value={String(list.length)} />
        </StatTiles>
        <Section title={k('fee_invoices')}>
          {list.length === 0 ? (
            <EmptyState icon={DollarSign} title={k('no_records')} />
          ) : (
            <Panel>
              {list.map((f, i) => (
                <View key={f.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <IconTile icon={Receipt} tone={f.status === 'paid' ? 'success' : f.status === 'overdue' ? 'destructive' : 'brand'} size={40} />
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold">{f.fee_name}</Text>
                        <Text className="text-muted-foreground text-xs">{f.academic_year}</Text>
                      </View>
                      <FeeStatus status={f.status} />
                    </View>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-muted-foreground text-xs">{`${k('col_due_date')}: ${f.due_date ? formatDate(f.due_date) : '—'}`}</Text>
                      <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                    </View>
                    <View className="bg-muted/50 flex-row justify-between rounded-xl px-3 py-2">
                      <Amount label={k('col_amount')} value={money(f.final_amount)} />
                      <Amount label={k('col_paid')} value={money(f.amount_paid)} tone="text-success" />
                      <Amount label={k('col_balance')} value={money(f.balance)} tone="font-semibold text-destructive" />
                    </View>
                  </View>
                </View>
              ))}
            </Panel>
          )}
        </Section>
        {extra.length ? (
          <Section title={k('additional_charges')}>
            <Panel>
              {extra.map((el, i) => (
                <View key={el.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < extra.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <IconTile icon={ReceiptText} tone="warning" size={40} />
                  <View className="flex-1 gap-1.5">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold">{el.element_title}</Text>
                        {el.category_title ? <Text className="text-muted-foreground text-xs">{el.category_title}</Text> : null}
                      </View>
                      <FeeStatus status={el.status} />
                    </View>
                    <View className="flex-row gap-6">
                      <Amount label={k('col_amount')} value={money(el.amount)} />
                      <Amount label={k('col_paid')} value={money(el.amount_paid)} tone="text-success" />
                    </View>
                  </View>
                </View>
              ))}
            </Panel>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}

function Amount({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View>
      <Text className="text-muted-foreground text-[11px]">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
