import { Stack } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { OwnTotals, useOwnAccounting } from '@/features/teacher/accounting';
import { formatDate } from '@/lib/format';

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
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={CreditCard} className="text-muted-foreground/50 mb-2 size-8" />
              <Text className="font-medium">{k('no_payments')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((p) => (
            <Card key={p.id}>
              <CardContent className="gap-1.5 p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 font-medium">{p.title || k('col_payment')}</Text>
                  <Text className="font-semibold text-emerald-600">{money(Number(p.amount))}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">{`${k('col_date')}: ${p.payment_date || p.date ? formatDate((p.payment_date || p.date) as string) : '-'}`}</Text>
                {p.comments ? <Text className="text-muted-foreground text-sm">{p.comments}</Text> : null}
                {p.file_attached ? (
                  <Badge variant="outline" className="self-start border-blue-200 bg-blue-50">
                    <Text className="text-xs text-blue-700">{`${k('col_file_attached')}: ${t('common.yes')}`}</Text>
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
