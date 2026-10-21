import { Stack } from 'expo-router';
import { DollarSign, FileText, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { FormSection, StatTile, StatTiles } from '@/components/app/layout';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { PortalPayment } from '@/features/portal/daily-transactions';
import { usePortalCurrency } from '@/features/portal/currency';
import { PortalError } from '@/features/portal/ui';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';

const STATUS: Record<string, [string, string, string]> = {
  paid: ['bg-success-soft', 'text-success', 'status_paid'],
  partial: ['bg-warning-soft', 'text-warning', 'status_partial'],
  overdue: ['bg-destructive-soft', 'text-destructive', 'status_overdue'],
};

type Res<T> = { data?: T[]; isLoading: boolean; error?: Error | null; mutate: () => unknown };
export type StatementFee = { id: string; fee_name: string; academic_year: string; due_date?: string | null; final_amount: number; amount_paid: number; balance: number; status: string };

/**
 * Billing statement: totals, invoices and payments, printable (web: /student and /parent billing/print-statements).
 * `showFee` adds the fee column to payments (parent).
 */
export function PrintStatementsView({ fees, payments, school, showFee }: { fees: Res<StatementFee>; payments: Res<PortalPayment>; school: string; showFee?: boolean }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.print_statements.${key}`, o);
  const toast = useToast();
  const { money } = usePortalCurrency();

  if (fees.isLoading || payments.isLoading) return <LoadingList rows={6} />;
  const error = fees.error ?? payments.error;
  if (error) return <PortalError title={k('error_loading')} message={error.message} />;
  const f = fees.data ?? [];
  const p = payments.data ?? [];
  const charged = f.reduce((s, x) => s + x.final_amount, 0);
  const paid = f.reduce((s, x) => s + x.amount_paid, 0);
  const balance = f.reduce((s, x) => s + x.balance, 0);
  const status = (s: string) => STATUS[s] ?? ['bg-warning-soft', 'text-warning', 'status_pending'];

  async function print() {
    const cell = `style="padding:6px 8px;border-bottom:1px solid ${colors.printBorder}"`;
    const head = (cols: string[]) => `<tr>${cols.map((c) => `<th style="text-align:start;padding:6px 8px;border-bottom:2px solid ${colors.printBorder};font-size:11px;text-transform:uppercase;color:${colors.printMuted}">${escapeHtml(c)}</th>`).join('')}</tr>`;
    const feeRows = f
      .map((x) => `<tr><td ${cell}><b>${escapeHtml(x.fee_name)}</b><br/><small>${escapeHtml(x.academic_year)}</small></td><td ${cell}>${escapeHtml(x.due_date ? formatDate(x.due_date) : '—')}</td><td ${cell}>${escapeHtml(money(x.final_amount))}</td><td ${cell}>${escapeHtml(money(x.amount_paid))}</td><td ${cell}>${escapeHtml(money(x.balance))}</td><td ${cell}>${escapeHtml(k(status(x.status)[2]))}</td></tr>`)
      .join('');
    const payRows = p
      .map((x) => `<tr><td ${cell}>${escapeHtml(x.payment_date ? formatDate(x.payment_date) : '—')}</td>${showFee ? `<td ${cell}>${escapeHtml(x.fee_name || '—')}</td>` : ''}<td ${cell}>${escapeHtml(x.payment_method || '—')}</td><td ${cell}>${escapeHtml(x.payment_reference || '—')}</td><td ${cell}>${escapeHtml(money(x.amount))}</td></tr>`)
      .join('');
    const body = `<h1>${escapeHtml(k('billing_statement'))}</h1><p style="color:${colors.printMuted}">${escapeHtml(formatDate(new Date().toISOString()))}</p>
      <p>${escapeHtml(k('total_charged'))}: <b>${escapeHtml(money(charged))}</b> · ${escapeHtml(k('total_paid'))}: <b>${escapeHtml(money(paid))}</b> · ${escapeHtml(k('outstanding_balance'))}: <b>${escapeHtml(money(balance))}</b></p>
      <h3>${escapeHtml(k('fee_invoices'))}</h3>${f.length ? `<table style="width:100%;border-collapse:collapse">${head([k('col_fee'), k('col_due_date'), k('col_amount'), k('col_paid'), k('col_balance'), k('col_status')])}${feeRows}</table>` : `<p>${escapeHtml(k('no_fees'))}</p>`}
      <h3>${escapeHtml(k('payment_history'))}</h3>${p.length ? `<table style="width:100%;border-collapse:collapse">${head([k('col_date'), ...(showFee ? [k('col_fee')] : []), k('col_method'), k('col_reference'), k('col_amount')])}${payRows}</table>` : `<p>${escapeHtml(k('no_payments'))}</p>`}`;
    try {
      await printHtml(buildPrintHtml({ title: k('billing_statement'), school: { name: school }, pages: [body] }));
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

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
              payments.mutate();
            }}
          />
        }>
        <View className="flex-row items-center justify-between gap-2">
          <Text variant="muted" className="flex-1 text-sm">
            {k('subtitle')}
          </Text>
          <Button size="sm" variant="outline" onPress={print}>
            <Icon as={Printer} className="size-4" />
            <Text>{k('print_button')}</Text>
          </Button>
        </View>
        <StatTiles>
          <StatTile label={k('total_charged')} value={money(charged)} />
          <StatTile label={k('total_paid')} value={money(paid)} tone="success" />
          <StatTile label={k('outstanding_balance')} value={money(balance)} tone={balance > 0 ? 'destructive' : 'success'} />
        </StatTiles>
        <FormSection title={k('fee_invoices')} icon={FileText} className="gap-0">
          {f.length === 0 ? (
            <EmptyState icon={DollarSign} title={k('no_fees')} />
          ) : (
            f.map((x) => {
              const [box, text, key] = status(x.status);
              return (
                <View key={x.id} className="border-info-soft dark:border-border gap-1 border-t py-3 first:border-t-0">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold">{x.fee_name}</Text>
                      <Text className="text-muted-foreground text-xs">{`${x.academic_year} · ${x.due_date ? formatDate(x.due_date) : '—'}`}</Text>
                    </View>
                    <View className={cn('rounded-full px-2.5 py-1', box)}>
                      <Text className={cn('text-[11px] font-semibold', text)}>{k(key)}</Text>
                    </View>
                  </View>
                  <Text className="text-sm">
                    {`${k('col_amount')}: ${money(x.final_amount)} · `}
                    <Text className="text-sm text-success">{`${k('col_paid')}: ${money(x.amount_paid)}`}</Text>
                    {' · '}
                    <Text className="text-sm font-semibold text-destructive">{`${k('col_balance')}: ${money(x.balance)}`}</Text>
                  </Text>
                </View>
              );
            })
          )}
        </FormSection>
        <FormSection title={k('payment_history')} icon={DollarSign} className="gap-0">
          {p.length === 0 ? (
            <EmptyState icon={DollarSign} title={k('no_payments')} />
          ) : (
            p.map((x) => (
              <View key={x.id} className="border-info-soft dark:border-border flex-row items-center gap-2 border-t py-3 first:border-t-0">
                <View className="flex-1 gap-1">
                  <Text className="text-muted-foreground text-sm">{x.payment_date ? formatDate(x.payment_date) : '—'}</Text>
                  {showFee ? <Text className="text-sm font-medium">{x.fee_name || '—'}</Text> : null}
                  <View className="flex-row items-center gap-2">
                    <StatusChip label={x.payment_method || '—'} tone="muted" />
                    <Text className="text-muted-foreground text-xs">{x.payment_reference || '—'}</Text>
                  </View>
                </View>
                <Text className="font-semibold text-success">{money(x.amount)}</Text>
              </View>
            ))
          )}
        </FormSection>
      </ScrollView>
    </>
  );
}
