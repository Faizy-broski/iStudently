import { Stack } from 'expo-router';
import { AlertTriangle, Calendar, CircleCheck, DollarSign, Receipt, ReceiptText, Wallet } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Segmented } from '@/components/app/segmented';
import { HeroCard, IconTile, Initials, RowItem, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
          <Text variant="muted" className="text-sm">{t('app.pa_fees_subtitle')}</Text>
          <Segmented<Tab>
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
      <HeroCard>
        <View className="flex-row items-center gap-3">
          <View className="size-12 items-center justify-center rounded-full bg-white/15">
            <Icon as={Wallet} className="size-6 text-white" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-white/85">{p('outstanding')}</Text>
            <Text className="text-3xl font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
              {money(due)}
            </Text>
          </View>
        </View>
        {overdue > 0 ? (
          <View className="flex-row">
            <View className="rounded-full bg-white/15 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{k('overdue_count', { count: overdue })}</Text>
            </View>
          </View>
        ) : null}
      </HeroCard>
      <StatTiles>
        <StatTile icon={CircleCheck} tone="success" label={k('total_paid')} value={money(paid)} />
        <StatTile icon={Receipt} label={k('total_invoices')} value={String(list.length)} />
      </StatTiles>
      {fs ? (
        <Section title={p('summary')}>
          <StatTiles>
            <StatTile tone="destructive" label={p('total_due')} value={money(fs.total_due)} />
            <StatTile tone="warning" label={p('overdue_amount')} value={money(fs.overdue_amount)} />
            <StatTile icon={Calendar} label={p('next_due_date')} value={fs.next_due_date ? formatDate(fs.next_due_date) : '—'} />
            <StatTile label={p('next_due_amount')} value={fs.next_due_amount !== undefined && fs.next_due_amount !== null ? money(fs.next_due_amount) : '—'} />
          </StatTiles>
        </Section>
      ) : null}
      <Section title={k('fee_invoices')}>
        {list.length === 0 ? (
          <EmptyState icon={DollarSign} title={k('no_records')} />
        ) : (
          <Panel>
            {list.map((f, i) => (
              <RowItem
                key={f.id}
                leading={<IconTile icon={Receipt} size={40} />}
                title={f.fee_name}
                meta={[f.academic_year, `${k('col_due_date')}: ${f.due_date ? formatDate(f.due_date) : '—'}`].filter(Boolean).join(' · ')}
                trailing={<FeeStatus status={f.status} />}
                last={i === list.length - 1}>
                <Amounts>
                  <Amount label={k('col_amount')} value={money(f.final_amount)} />
                  <Amount label={k('col_paid')} value={money(f.amount_paid)} tone="text-success" />
                  <Amount label={k('col_balance')} value={money(f.balance)} tone="font-semibold text-destructive" />
                </Amounts>
              </RowItem>
            ))}
          </Panel>
        )}
      </Section>
      {extra.length ? (
        <Section title={k('additional_charges')}>
          <Panel>
            {extra.map((el, i) => (
              <RowItem
                key={el.id}
                leading={<IconTile icon={ReceiptText} tone="warning" size={40} />}
                title={el.element_title}
                meta={el.category_title || null}
                trailing={<FeeStatus status={el.status} />}
                last={i === extra.length - 1}>
                <Amounts>
                  <Amount label={k('col_amount')} value={money(el.amount)} />
                  <Amount label={k('col_paid')} value={money(el.amount_paid)} tone="text-success" />
                </Amounts>
              </RowItem>
            ))}
          </Panel>
        </Section>
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
        <EmptyState icon={DollarSign} title={p('no_children')} />
      ) : (
        <>
          <StatTiles>
            <StatTile icon={Wallet} tone="destructive" label={p('all_due')} value={money(data.totalDue)} />
            <StatTile icon={AlertTriangle} tone="warning" label={p('all_overdue')} value={money(data.totalOverdue)} />
          </StatTiles>
          {data.children.map((c) => {
            const childDue = c.fees.filter((f) => f.status !== 'paid').reduce((s, f) => s + (f.balance || 0), 0);
            const title = `${c.name || p('student')}${c.grade_level ? ` — ${c.grade_level}` : ''}`;
            return (
              <Panel key={c.id}>
                <View className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3">
                  <Initials name={c.name || p('student')} size={40} />
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>
                    {title}
                  </Text>
                  <StatusChip label={p('due', { amount: money(childDue) })} tone={childDue > 0 ? 'destructive' : 'success'} />
                </View>
                {c.fees.length === 0 ? (
                  <Text className="text-muted-foreground px-4 py-4 text-sm">{k('no_records')}</Text>
                ) : (
                  c.fees.map((f, i) => (
                    <RowItem
                      key={f.id}
                      leading={<IconTile icon={Calendar} size={36} />}
                      title={f.due_date ? formatDate(f.due_date) : '—'}
                      trailing={<FeeStatus status={f.status} />}
                      last={i === c.fees.length - 1}>
                      <Amounts>
                        <Amount label={k('col_amount')} value={money(f.final_amount || 0)} />
                        <Amount label={k('col_paid')} value={money(f.amount_paid || 0)} tone="text-success" />
                        <Amount label={k('col_balance')} value={money(f.balance || 0)} tone="font-semibold text-destructive" />
                      </Amounts>
                    </RowItem>
                  ))
                )}
              </Panel>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function Amounts({ children }: { children: ReactNode }) {
  return <View className="bg-muted/60 flex-row justify-between gap-2 rounded-xl px-3 py-2">{children}</View>;
}

function Amount({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View>
      <Text className="text-muted-foreground text-[11px]">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
