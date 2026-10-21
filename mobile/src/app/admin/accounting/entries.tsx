import type { AccountingEntry, EntryKind } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { HeroCard, IconTile, RowItem, StatTile } from '@/components/app/layout';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

const KINDS: EntryKind[] = ['incomes', 'expenses', 'staff-payments'];

/** Incomes, expenses or staff payments for the academic year (web: /admin/accounting/incomes, expenses, staff-payments). */
export default function AccountingEntries() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: EntryKind = KINDS.includes(params.kind as EntryKind) ? (params.kind as EntryKind) : 'incomes';
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const ay = useAcademicYear();
  const yearName = ay.name;
  // Web: period from (optional) to today.
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const range = { start_date: start || undefined, end_date: end || undefined };
  const list = useApi(scopeId && yearName ? ['admin', 'acc-entries', kind, scopeId, yearName, start, end] : null, ([, , k, sid, y]) =>
    adminAccounting.entries(k as EntryKind, sid as string, y as string, range),
  );
  const totals = useApi(scopeId && yearName ? ['admin', 'acc-totals', scopeId, yearName, start, end] : null, ([, , sid, y]) => adminAccounting.totals(sid as string, y as string, range));
  const a = (k: string, o?: Record<string, unknown>) => t(`admin.accounting.${kind === 'expenses' ? 'expenses' : 'incomes'}.${k}`, o);
  const sum = (list.data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
  const tt = totals.data;
  const date = (e: AccountingEntry) => e.income_date ?? e.payment_date;

  return (
    <>
      <Stack.Screen
        options={{
          title: t(`app.ac_${kind}`),
          headerRight: () =>
            yearName ? (
              <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/accounting/entry-form', params: { kind, year: yearName } })} accessibilityLabel={t('app.ac_add')}>
                <Icon as={Plus} className="size-5" />
              </Button>
            ) : null,
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          items={list.data}
          error={list.error}
          isLoading={list.isLoading || ay.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => {
            list.mutate();
            totals.mutate();
          }}
          emptyTitle={t('app.ac_none')}
          keyExtractor={(e) => e.id}
          header={
            <View className="gap-3 p-4">
              <Picker value={ay.id} onChange={ay.pick} options={ay.options} />
              {tt ? (
                <HeroCard>
                  <Text className="text-white text-xs opacity-80">{a('totals.general_balance')}</Text>
                  <Text className={cn('text-3xl font-bold', tt.general_balance < 0 ? 'text-brand-accent' : 'text-white')} numberOfLines={1} adjustsFontSizeToFit>
                    {money(tt.general_balance)}
                  </Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1 gap-0.5 rounded-2xl bg-white/10 p-2.5">
                      <View className="flex-row items-center gap-1">
                        <Icon as={ArrowDownLeft} className="text-white size-3.5" />
                        <Text className="text-white text-[11px] opacity-80">{t('app.ac_in')}</Text>
                      </View>
                      <Text className="text-white text-sm font-bold" numberOfLines={1} adjustsFontSizeToFit>
                        {money(tt.total_incomes + tt.total_student_payments)}
                      </Text>
                      <Text className="text-white text-[10px] opacity-70" numberOfLines={1}>
                        {t('app.ac_incl_fees', { amount: money(tt.total_student_payments) })}
                      </Text>
                    </View>
                    <View className="flex-1 gap-0.5 rounded-2xl bg-white/10 p-2.5">
                      <View className="flex-row items-center gap-1">
                        <Icon as={ArrowUpRight} className="text-white size-3.5" />
                        <Text className="text-white text-[11px] opacity-80">{t('app.ac_out')}</Text>
                      </View>
                      <Text className="text-white text-sm font-bold" numberOfLines={1} adjustsFontSizeToFit>
                        {money(tt.total_expenses + tt.total_staff_payments)}
                      </Text>
                      <Text className="text-white text-[10px] opacity-70" numberOfLines={1}>
                        {t('app.ac_balance', { amount: money(tt.balance) })}
                      </Text>
                    </View>
                  </View>
                </HeroCard>
              ) : null}
              <View className="gap-1">
                <Text className="text-sm font-medium">{a('period')}</Text>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <DateField value={start || null} onChange={(v) => setStart(v ?? '')} clearable />
                  </View>
                  <Text>{t('common.to')}</Text>
                  <View className="flex-1">
                    <DateField value={end || null} onChange={(v) => setEnd(v ?? '')} clearable />
                  </View>
                </View>
              </View>
              {tt && kind !== 'staff-payments' ? (
                <Card className="py-3">
                  <CardContent className="gap-1 px-4">
                    {(
                      [
                        [a('totals.total_incomes'), tt.total_incomes],
                        [a('totals.less_total_expenses'), tt.total_expenses],
                        [t('common.balance'), tt.balance, true],
                        [a('totals.total_incomes'), tt.total_incomes],
                        [a('totals.plus_student_payments'), tt.total_student_payments],
                        [a('totals.less_total_expenses'), tt.total_expenses],
                        [a('totals.plus_staff_payments'), tt.total_staff_payments],
                        [a('totals.general_balance'), tt.general_balance, true],
                      ] as [string, number, boolean?][]
                    ).map(([label, value, bold], i) => (
                      <View key={i} className={bold ? 'border-border mb-2 flex-row justify-between border-t pt-1' : 'flex-row justify-between'}>
                        <Text className={bold ? 'font-bold' : 'text-sm'}>{`${label}:`}</Text>
                        <Text className={bold ? 'font-bold' : 'text-sm'}>{money(value)}</Text>
                      </View>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
              {list.data ? <StatTile icon={kind === 'staff-payments' ? Users : kind === 'incomes' ? ArrowDownLeft : ArrowUpRight} label={t(`app.ac_${kind}`)} value={money(sum)} note={t('app.fe_count', { count: list.data.length })} /> : null}
            </View>
          }
          renderItem={(e) => (
            <RowItem
              last
              title={e.title}
              meta={[date(e) ? formatDate(date(e)!) : null, e.category?.name, e.staff ? `${e.staff.profiles.first_name} ${e.staff.profiles.last_name}` : null, e.payment_method, e.comments, e.file_attached ? '📎' : null].filter(Boolean).join(' · ')}
              leading={<IconTile icon={kind === 'staff-payments' ? Users : kind === 'incomes' ? ArrowDownLeft : ArrowUpRight} tone={kind === 'incomes' ? 'success' : 'warning'} />}
              trailing={<Text className={cn('text-sm font-bold', kind === 'incomes' ? 'text-success' : 'text-foreground')}>{money(e.amount)}</Text>}
              onPress={() => router.push({ pathname: '/admin/accounting/entry-form', params: { kind, year: e.academic_year, id: e.id } })}
            />
          )}
        />
      </View>
    </>
  );
}
