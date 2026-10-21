import { Stack } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, RowItem, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** Every payment on the selected child's invoices, newest first, with the fee it paid (web: /parent/billing/payments). */
export default function ParentPayments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.payments.${key}`, o);
  const { money } = usePortalCurrency();
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));

  if (!childId) return <NoChild />;
  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error_loading')} message={data.error.message} />;
  const list = (data.data ?? [])
    .flatMap((f) => (f.payments ?? []).map((p) => ({ ...p, fee_name: f.fee_name })))
    .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
  const total = list.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-full bg-white/15">
              <Icon as={CreditCard} className="size-6 text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white/85">{k('total_payments_made')}</Text>
              <Text className="text-3xl font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
                {money(total)}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-full bg-white/15 px-3 py-1">
              <Text className="text-xs font-semibold text-white">{k('transactions_count', { count: list.length })}</Text>
            </View>
          </View>
          <Text className="text-xs text-white/80">{t('app.pa_pay_subtitle')}</Text>
        </HeroCard>
        <Section title={k('payment_history')}>
          {list.length === 0 ? (
            <EmptyState icon={CreditCard} title={k('no_payments')} />
          ) : (
            <Panel>
              {list.map((p, i) => (
                <RowItem
                  key={p.id}
                  leading={<IconTile icon={CreditCard} tone="success" size={40} />}
                  title={p.fee_name || '—'}
                  meta={[p.payment_date ? formatDate(p.payment_date) : '—', `${k('col_reference')}: ${p.payment_reference || '—'}`].join(' · ')}
                  trailing={
                    <View className="items-end gap-1">
                      <Text className="text-sm font-bold text-success">{money(p.amount)}</Text>
                      <StatusChip label={p.payment_method || '—'} tone="muted" />
                    </View>
                  }
                  last={i === list.length - 1}
                />
              ))}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
