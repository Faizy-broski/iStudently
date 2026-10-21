import { Stack } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { OwnTotals, useOwnAccounting } from '@/features/teacher/accounting';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Payments made to the teacher, with totals (web: /teacher/accounting/staff-payments). */
export default function TeacherStaffPayments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPortal.accounting.staff_payments.${key}`, o);
  const { money } = usePortalCurrency();
  const acc = useOwnAccounting();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = (acc.payments.data ?? []).filter((p) => !term || p.title?.toLowerCase().includes(term) || p.comments?.toLowerCase().includes(term));
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([acc.salaries.mutate(), acc.payments.mutate()])} />}>
        <OwnTotals totalSalaries={acc.totalSalaries} totalPayments={acc.totalPayments} balance={acc.balance} />
        <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
        <Text className="text-muted-foreground text-sm">{k('found_count', { count: list.length })}</Text>
        {acc.payments.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={CreditCard} title={k('no_payments')} />
        ) : (
          <Panel>
            {list.map((p, i) => (
              <View key={p.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <IconTile icon={CreditCard} tone="success" size={40} />
                <View className="flex-1 gap-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold">{p.title || k('col_payment')}</Text>
                    <Text className="text-success text-sm font-bold">{money(Number(p.amount))}</Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">{`${k('col_date')}: ${p.payment_date || p.date ? formatDate((p.payment_date || p.date) as string) : '-'}`}</Text>
                  {p.comments ? <Text className="text-muted-foreground text-xs">{p.comments}</Text> : null}
                  {p.file_attached ? <StatusChip label={`${k('col_file_attached')}: ${t('common.yes')}`} tone="info" className="self-start" /> : null}
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
