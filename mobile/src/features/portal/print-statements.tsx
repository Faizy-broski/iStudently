import { Stack } from 'expo-router';
import { DollarSign, FileText, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { PortalPayment } from '@/features/portal/daily-transactions';
import { usePortalCurrency } from '@/features/portal/currency';
import { PortalError } from '@/features/portal/ui';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';

const STATUS: Record<string, [string, string, string]> = {
  paid: ['bg-green-100', 'text-green-700', 'status_paid'],
  partial: ['bg-yellow-100', 'text-yellow-700', 'status_partial'],
  overdue: ['bg-red-100', 'text-red-700', 'status_overdue'],
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
  const status = (s: string) => STATUS[s] ?? ['bg-orange-100', 'text-orange-700', 'status_pending'];

  async function print() {
    const cell = 'style="padding:6px 8px;border-bottom:1px solid #eee"';
    const head = (cols: string[]) => `<tr>${cols.map((c) => `<th style="text-align:start;padding:6px 8px;border-bottom:2px solid #ccc;font-size:11px;text-transform:uppercase;color:#666">${escapeHtml(c)}</th>`).join('')}</tr>`;
    const feeRows = f
      .map((x) => `<tr><td ${cell}><b>${escapeHtml(x.fee_name)}</b><br/><small>${escapeHtml(x.academic_year)}</small></td><td ${cell}>${escapeHtml(x.due_date ? formatDate(x.due_date) : '—')}</td><td ${cell}>${escapeHtml(money(x.final_amount))}</td><td ${cell}>${escapeHtml(money(x.amount_paid))}</td><td ${cell}>${escapeHtml(money(x.balance))}</td><td ${cell}>${escapeHtml(k(status(x.status)[2]))}</td></tr>`)
      .join('');
    const payRows = p
      .map((x) => `<tr><td ${cell}>${escapeHtml(x.payment_date ? formatDate(x.payment_date) : '—')}</td>${showFee ? `<td ${cell}>${escapeHtml(x.fee_name || '—')}</td>` : ''}<td ${cell}>${escapeHtml(x.payment_method || '—')}</td><td ${cell}>${escapeHtml(x.payment_reference || '—')}</td><td ${cell}>${escapeHtml(money(x.amount))}</td></tr>`)
      .join('');
    const body = `<h1>${escapeHtml(k('billing_statement'))}</h1><p style="color:#666">${escapeHtml(formatDate(new Date().toISOString()))}</p>
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
          <Text variant="muted" className="flex-1">
            {k('subtitle')}
          </Text>
          <Button variant="outline" onPress={print}>
            <Icon as={Printer} className="size-4" />
            <Text>{k('print_button')}</Text>
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Total label={k('total_charged')} value={money(charged)} />
          <Total label={k('total_paid')} value={money(paid)} tone="text-green-600" />
          <Total label={k('outstanding_balance')} value={money(balance)} tone={balance > 0 ? 'text-red-600' : 'text-green-600'} />
        </View>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={FileText} className="size-5" />
            <CardTitle>{k('fee_invoices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {f.length === 0 ? (
              <View className="items-center py-8">
                <Icon as={DollarSign} className="text-muted-foreground mb-2 size-10" />
                <Text className="text-muted-foreground">{k('no_fees')}</Text>
              </View>
            ) : (
              f.map((x) => {
                const [box, text, key] = status(x.status);
                return (
                  <View key={x.id} className="border-border gap-1 border-t py-3 first:border-t-0">
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <Text className="font-medium">{x.fee_name}</Text>
                        <Text className="text-muted-foreground text-xs">{`${x.academic_year} · ${x.due_date ? formatDate(x.due_date) : '—'}`}</Text>
                      </View>
                      <View className={cn('rounded-full px-2 py-0.5', box)}>
                        <Text className={cn('text-xs', text)}>{k(key)}</Text>
                      </View>
                    </View>
                    <Text className="text-sm">
                      {`${k('col_amount')}: ${money(x.final_amount)} · `}
                      <Text className="text-sm text-green-600">{`${k('col_paid')}: ${money(x.amount_paid)}`}</Text>
                      {' · '}
                      <Text className="text-sm font-semibold text-red-600">{`${k('col_balance')}: ${money(x.balance)}`}</Text>
                    </Text>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={DollarSign} className="size-5" />
            <CardTitle>{k('payment_history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {p.length === 0 ? (
              <View className="items-center py-8">
                <Icon as={DollarSign} className="text-muted-foreground mb-2 size-10" />
                <Text className="text-muted-foreground">{k('no_payments')}</Text>
              </View>
            ) : (
              p.map((x) => (
                <View key={x.id} className="border-border flex-row items-center gap-2 border-t py-3 first:border-t-0">
                  <View className="flex-1 gap-1">
                    <Text className="text-muted-foreground text-sm">{x.payment_date ? formatDate(x.payment_date) : '—'}</Text>
                    {showFee ? <Text className="text-sm font-medium">{x.fee_name || '—'}</Text> : null}
                    <View className="flex-row items-center gap-2">
                      <Badge variant="outline">
                        <Text className="text-xs">{x.payment_method || '—'}</Text>
                      </Badge>
                      <Text className="text-muted-foreground text-xs">{x.payment_reference || '—'}</Text>
                    </View>
                  </View>
                  <Text className="font-semibold text-green-600">{money(x.amount)}</Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="min-w-[45%] flex-1 py-3">
      <CardContent className="px-3">
        <Text className="text-muted-foreground mb-1 text-sm">{label}</Text>
        <Text className={cn('text-2xl font-bold', tone)}>{value}</Text>
      </CardContent>
    </Card>
  );
}
