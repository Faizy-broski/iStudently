import { Stack } from 'expo-router';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting, adminEmployees, adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type SortKey = 'staff_name' | 'designation' | 'total_salary_due' | 'total_salary_paid' | 'manual_payments' | 'balance';
type Row = { staff_id: string; staff_name: string; designation: string; total_salary_due: number; total_salary_paid: number; salary_count: number; manual_payments: number; balance: number };

/**
 * Per staff member: salaries generated, salaries paid, manual payments and what is still owed, with
 * totals, status and sorting (web: /admin/accounting/staff-balances).
 */
export default function StaffBalances() {
  const { t } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`admin.accounting.staff_balances.${k}`, o);
  const { campusId, scopeId, campus } = useCampus();
  const salaryScope = campus?.parent_school_id ?? scopeId ?? null;
  const { money } = useCurrency();
  const ay = useAcademicYear();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const range = { start_date: start || undefined, end_date: end || undefined };
  const payments = useApi(scopeId && ay.name ? ['admin', 'acc-entries', 'staff-payments', scopeId, ay.name, start, end] : null, ([, , , sid, y]) =>
    adminAccounting.entries('staff-payments', sid as string, y as string, range),
  );
  const salaries = useApi(salaryScope ? ['admin', 'salary-records-all', salaryScope, campusId ?? ''] : null, ([, , sc, cid]) =>
    adminSalary.records(sc as string, { limit: 1000, campus_id: (cid as string) || undefined }),
  );
  const staff = useApi(scopeId ? ['admin', 'acc-staff-all', scopeId] : null, ([, , sid]) => adminEmployees.allEmployees(sid as string));

  const map = new Map<string, Row>();
  for (const s of staff.data ?? []) {
    map.set(s.id, { staff_id: s.id, staff_name: `${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`.trim(), designation: s.title ?? '', total_salary_due: 0, total_salary_paid: 0, salary_count: 0, manual_payments: 0, balance: 0 });
  }
  for (const r of salaries.data ?? []) {
    const row = map.get(r.staff_id);
    if (!row) continue;
    row.total_salary_due += Number(r.net_salary || 0);
    row.salary_count += 1;
    if (r.status === 'paid') row.total_salary_paid += Number(r.net_salary || 0);
  }
  for (const p of payments.data ?? []) {
    const row = p.staff_id ? map.get(p.staff_id) : undefined;
    if (row) row.manual_payments += Number(p.amount || 0);
  }
  const rows = [...map.values()].map((r) => ({ ...r, balance: r.total_salary_due - r.total_salary_paid - r.manual_payments }));
  const sorted = [...rows].sort((x, y) => {
    const a = x[sortKey];
    const c = y[sortKey];
    const d = typeof a === 'number' && typeof c === 'number' ? a - c : String(a).toLowerCase().localeCompare(String(c).toLowerCase());
    return dir === 'asc' ? d : -d;
  });
  const total = (k: 'total_salary_due' | 'total_salary_paid' | 'manual_payments' | 'balance') => rows.reduce((s, r) => s + r[k], 0);
  const loading = payments.isLoading || salaries.isLoading || staff.isLoading;
  const error = payments.error || salaries.error || staff.error;

  const status = (r: Row) =>
    r.balance <= 0 ? (
      <Badge className="bg-green-600">
        <Text>{b('status_paid')}</Text>
      </Badge>
    ) : r.total_salary_paid > 0 || r.manual_payments > 0 ? (
      <Badge variant="secondary">
        <Text>{b('status_partial')}</Text>
      </Badge>
    ) : r.salary_count > 0 ? (
      <Badge variant="destructive">
        <Text>{b('status_pending')}</Text>
      </Badge>
    ) : (
      <Badge variant="outline">
        <Text>{b('status_no_salary')}</Text>
      </Badge>
    );

  const cards: [string, string, string?][] = [
    [b('card_total_staff'), String(rows.length)],
    [b('card_with_salaries'), String(rows.filter((r) => r.salary_count > 0).length)],
    [b('card_total_paid'), money(total('total_salary_paid')), 'text-green-600 dark:text-green-400'],
    [b('card_total_balance'), money(total('balance')), total('balance') > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'],
  ];
  const sortLabels: Record<SortKey, string> = {
    staff_name: b('col_name'),
    designation: b('col_title'),
    total_salary_due: b('col_salary_due'),
    total_salary_paid: b('col_salary_paid'),
    manual_payments: b('col_manual'),
    balance: b('col_balance'),
  };

  const header = (
    <View className="gap-3 p-4">
      <Text variant="muted">{b('subtitle', { campus: campus?.name ?? '' })}</Text>
      <Picker value={ay.id} onChange={ay.pick} options={ay.options} />
      <Text className="text-sm font-medium">{b('period')}</Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <DateField value={start || null} onChange={(v) => setStart(v ?? '')} clearable />
        </View>
        <Text>{t('common.to')}</Text>
        <View className="flex-1">
          <DateField value={end || null} onChange={(v) => setEnd(v ?? '')} clearable />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {cards.map(([label, value, tone]) => (
          <Card key={label} className="min-w-[46%] flex-1 py-3">
            <CardContent className="px-3">
              <Text className="text-muted-foreground text-xs">{label}</Text>
              <Text className={cn('text-xl font-bold', tone)}>{value}</Text>
            </CardContent>
          </Card>
        ))}
      </View>
      <Text className="font-semibold">{b('table_title')}</Text>
      <Text className="text-muted-foreground text-xs">{b('table_desc')}</Text>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Picker value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={(Object.keys(sortLabels) as SortKey[]).map((k) => ({ value: k, label: sortLabels[k] }))} />
        </View>
        <Button variant="outline" size="icon" onPress={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} accessibilityLabel={dir === 'asc' ? t('app.ar_sort_asc') : t('app.ar_sort_desc')}>
          <Icon as={dir === 'asc' ? ArrowUp : ArrowDown} className="size-4" />
        </Button>
      </View>
    </View>
  );

  const footer = rows.length ? (
    <Card className="mx-4 mt-3 py-3">
      <CardContent className="gap-1 px-4">
        {(
          [
            [b('footer_total_generated'), total('total_salary_due'), ''],
            [b('footer_total_paid'), total('total_salary_paid'), 'text-green-600 dark:text-green-400'],
            [b('footer_total_manual'), total('manual_payments'), 'text-blue-600 dark:text-blue-400'],
          ] as [string, number, string][]
        ).map(([label, v, tone]) => (
          <View key={label} className="flex-row justify-between">
            <Text className="text-sm">{label}</Text>
            <Text className={cn('text-sm font-medium', tone)}>{money(v)}</Text>
          </View>
        ))}
        <View className="border-border flex-row justify-between border-t pt-1">
          <Text className="font-semibold">{b('footer_total_balance')}</Text>
          <Text className="font-semibold">{money(total('balance'))}</Text>
        </View>
      </CardContent>
    </Card>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: b('title') }} />
      {error ? (
        <ErrorState message={error.message} onRetry={() => [payments, salaries, staff].forEach((x) => x.mutate())} />
      ) : (
        <FlatList
          className="bg-background flex-1"
          data={loading ? [] : sorted}
          keyExtractor={(r) => r.staff_id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={loading ? <LoadingList rows={6} /> : <EmptyState title={b('empty')} />}
          contentContainerClassName="pb-10"
          renderItem={({ item: r }) => (
            <View className="border-border gap-1 border-b px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-medium">{r.staff_name}</Text>
                  <Text className="text-muted-foreground text-xs">{r.designation || '-'}</Text>
                </View>
                {status(r)}
              </View>
              <Text className="text-muted-foreground text-xs">
                {`${b('col_salary_due')}: ${money(r.total_salary_due)} · ${b('col_salary_paid')}: ${money(r.total_salary_paid)} · ${b('col_manual')}: ${money(r.manual_payments)}`}
              </Text>
              <Text className={cn('font-semibold', r.balance > 0 ? 'text-red-600 dark:text-red-400' : r.balance < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                {`${b('col_balance')}: ${money(r.balance)}`}
              </Text>
            </View>
          )}
        />
      )}
    </>
  );
}
