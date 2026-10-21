import type { SalaryRecord, SalaryStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Banknote, CircleCheck, Clock, HandCoins, Settings } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StatTile, Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { MonthYearPicker, SALARY_STATUS_VARIANT, monthLabel, staffName } from '@/features/admin/salary';
import { useCurrency } from '@/features/admin/use-currency';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi, usePagedApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Filter = SalaryStatus | 'all';

/** Payroll for one month: totals, records, approve / mark paid, pay stubs (web: /admin/salary). */
export default function SalaryRecords() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`admin.salary.page.${k}`, o);
  const confirm = useConfirm();
  const { me } = useSession();
  const isAdmin = me.status === 'ready' && me.me.profile.role === 'admin';
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [status, setStatus] = useState<Filter>('all');

  const stats = useApi(scopeId ? ['admin', 'salary-dashboard', scopeId, month, year] : null, ([, , sid, m, y]) => adminSalary.dashboard(sid as string, m as number, y as number));
  const advances = useApi(scopeId ? ['admin', 'salary-advances', scopeId] : null, ([, , sid]) => adminSalary.pendingAdvances(sid as string));
  const list = usePagedApi<SalaryRecord>(scopeId ? `admin-salary-records:${scopeId}:${month}:${year}:${status}` : null, (page) =>
    adminSalary.records(scopeId!, { month, year, page, limit: 20, status: status === 'all' ? undefined : status }),
  );
  const refresh = () => {
    list.mutate();
    stats.mutate();
  };
  const approve = useAction((r: SalaryRecord) => adminSalary.approve(scopeId!, r.id), { success: t('common.approved'), onSuccess: refresh });
  const markPaid = useAction((r: SalaryRecord) => adminSalary.markPaid(scopeId!, r.id), { success: t('common.paid'), onSuccess: refresh });
  const counts = stats.data?.counts;

  const header = (
    <View className="gap-3 p-4">
      <MonthYearPicker
        month={month}
        year={year}
        onChange={(m, y) => {
          setMonth(m);
          setYear(y);
        }}
      />
      <View className="flex-row gap-3">
        <StatTile icon={Banknote} label={s('stats.total_payroll')} value={money(stats.data?.total_payroll ?? 0)} />
        <StatTile icon={CircleCheck} label={s('stats.paid')} value={money(stats.data?.total_paid ?? 0)} note={s('stats.staff_count', { count: counts?.paid ?? 0 })} />
      </View>
      <View className="flex-row gap-3">
        <StatTile
          icon={Clock}
          label={s('stats.pending')}
          value={money(stats.data?.total_pending ?? 0)}
          note={s('stats.staff_count', { count: (counts?.pending ?? 0) + (counts?.approved ?? 0) })}
        />
        <Pressable className="flex-1" onPress={() => router.push('/admin/salary/advances')} accessibilityRole="button">
          <StatTile icon={HandCoins} label={s('stats.advance_requests')} value={String(advances.data?.length ?? 0)} note={s('stats.awaiting_approval')} tone={advances.data?.length ? 'warning' : undefined} />
        </Pressable>
      </View>
      <View className="flex-row gap-2">
        <Button className="flex-1" onPress={() => router.push('/admin/salary/generate')}>
          <Text>{s('actions.generate')}</Text>
        </Button>
        <Button variant="outline" onPress={() => router.push('/admin/salary/statements')}>
          <Text>{t('financial_statements.page_title')}</Text>
        </Button>
      </View>
      <FilterChips<Filter>
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: s('filters.all_statuses') },
          { value: 'pending', label: t('common.pending') },
          { value: 'approved', label: t('common.approved') },
          { value: 'paid', label: t('common.paid') },
        ]}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: s('title'),
          headerRight: () => (
            <Button size="sm" variant="ghost" onPress={() => router.push('/admin/salary/settings')} accessibilityLabel={s('actions.settings')}>
              <Icon as={Settings} className="size-5" />
            </Button>
          ),
        }}
      />
      <View className="bg-background flex-1">
        <DataList
          header={header}
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => {
            refresh();
            advances.mutate();
          }}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={s('table.empty', { monthYear: monthLabel(t, month, year) })}
          emptyBody={t('financial_statements.no_records_hint')}
          keyExtractor={(r) => r.id}
          renderItem={(r) => (
            <Pressable
              className="gap-1 px-4 py-3"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/admin/salary/payslip', params: { staffId: r.staff_id, month: String(r.month), year: String(r.year) } })}>
              <View className="flex-row items-center gap-3">
                <Initials name={(staffName(r)) || '?'} />
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
                  {staffName(r)}
                </Text>
                <Badge variant={SALARY_STATUS_VARIANT[r.status]}>
                  <Text>{t(`common.${r.status}`)}</Text>
                </Badge>
              </View>
              <Text className="text-muted-foreground text-xs">
                {[r.staff?.employee_number, r.staff?.designation ?? r.staff?.title, `${s('table.base_salary')}: ${money(r.base_salary)}`].filter(Boolean).join(' · ')}
              </Text>
              <Text className="text-xs">
                {`+${money(r.total_allowances + (r.attendance_bonus || 0))}  −${money(r.total_deductions + (r.advance_deduction || 0))}  `}
                <Text className="text-xs font-semibold">{`${s('table.net_salary')}: ${money(r.net_salary)}`}</Text>
              </Text>
              {isAdmin && r.status !== 'paid' ? (
                <View className="flex-row gap-4 pt-1">
                  {r.status === 'pending' ? (
                    <Pressable className="bg-info-soft rounded-full px-3 py-1.5 active:opacity-70"
                      hitSlop={8}
                      disabled={approve.running}
                      onPress={async () => {
                        if (await confirm({ title: t('app.sl_approve_title'), body: `${staffName(r)} · ${money(r.net_salary)}`, confirmLabel: t('app.sl_approve') })) approve.run(r);
                      }}>
                      <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t('app.sl_approve')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable className="bg-info-soft rounded-full px-3 py-1.5 active:opacity-70"
                    hitSlop={8}
                    disabled={markPaid.running}
                    onPress={async () => {
                      if (await confirm({ title: t('app.sl_paid_title'), body: `${staffName(r)} · ${money(r.net_salary)}`, confirmLabel: t('app.sl_mark_paid') })) markPaid.run(r);
                    }}>
                    <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t('app.sl_mark_paid')}</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </>
  );
}
