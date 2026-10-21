import type { AccountingEntry, Employee, SalaryRecord } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Check, CheckCircle2, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Linking, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting, adminEmployees, adminSalary, adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

type Staff = Employee & { salary?: number };

/**
 * Pick a staff member, then their salary records (approve, mark paid, totals) and manual payments
 * (receipt, amount, date, note, attachment; add, edit, delete) (web: /admin/accounting/staff-payments).
 */
export default function StaffPayments() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`admin.accounting.staff_payments.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { money } = useCurrency();
  const { campusId, scopeId, campus } = useCampus();
  // Salary uses the main school id (web: parent_school_id || campus).
  const salaryScope = campus?.parent_school_id ?? scopeId ?? null;
  const ay = useAcademicYear();
  const yearName = ay.name;
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Staff | null>(null);
  const [tab, setTab] = useState<'salaries' | 'payments'>('salaries');
  const [busyId, setBusyId] = useState<string | null>(null);
  const staffId = picked?.id ?? null;
  const staff = useApi(scopeId ? ['admin', 'acc-staff-all', scopeId] : null, ([, , sid]) => adminEmployees.allEmployees(sid as string));
  const payments = useApi(scopeId && staffId && yearName ? ['admin', 'acc-staff-payments', scopeId, staffId, yearName] : null, ([, , sid, st, y]) =>
    adminAccounting.staffPaymentsFor(sid as string, st as string, y as string),
  );
  const salaries = useApi(salaryScope && staffId ? ['admin', 'salary-records-staff', salaryScope, campusId ?? '', staffId] : null, ([, , sc, cid, st]) =>
    adminSalary.staffRecords(sc as string, (cid as string) || undefined, st as string),
  );
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));

  const list = (staff.data ?? []) as Staff[];
  const q = search.trim().toLowerCase();
  const filtered = list.filter((x) => `${x.profile?.first_name ?? ''} ${x.profile?.last_name ?? ''}`.toLowerCase().includes(q));
  const roleLabel = (role?: string) => s(`roles.${role && ['teacher', 'admin', 'librarian', 'counselor', 'staff'].includes(role) ? role : 'staff'}`);
  const nameOf = (x: Staff) => `${x.profile?.first_name ?? ''} ${x.profile?.last_name ?? ''}`.trim();

  if (!picked) {
    return (
      <>
        <Stack.Screen options={{ title: s('title') }} />
        <FlatList
          className="bg-background flex-1"
          data={staff.isLoading ? [] : filtered}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={
            <View className="gap-3 p-4">
              <Text variant="muted">{s('subtitle_select')}</Text>
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
              <Text className="text-muted-foreground text-sm">{s('found_count', { count: filtered.length })}</Text>
            </View>
          }
          ListEmptyComponent={staff.isLoading ? <LoadingList rows={6} /> : <EmptyState title={s('empty')} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: x }) => (
            <Pressable onPress={() => setPicked(x)} className="active:bg-muted border-border border-b px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Initials name={nameOf(x) || '?'} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold">{nameOf(x)}</Text>
                  <Text className="text-muted-foreground text-xs">{[roleLabel(x.role), x.title].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      </>
    );
  }

  const records = salaries.data ?? [];
  const totalPaid = records.filter((r) => r.status === 'paid').reduce((sum, r) => sum + Number(r.net_salary || 0), 0);
  const totalDue = records.filter((r) => r.status !== 'paid').reduce((sum, r) => sum + Number(r.net_salary || 0), 0);
  const manual = payments.data ?? [];
  const manualTotal = manual.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const base = picked.salary ?? 0;

  async function approve(r: SalaryRecord) {
    if (!salaryScope) return;
    setBusyId(r.id);
    const res = await adminSalary.approve(salaryScope, r.id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error || s('toast.salary_approve_failed'));
    toast.success(s('toast.salary_approved'));
    salaries.mutate();
  }
  async function markPaid(r: SalaryRecord) {
    if (!salaryScope) return;
    setBusyId(r.id);
    const method = typeof settings.data?.default_payment_method === 'string' ? settings.data.default_payment_method : 'cash';
    const res = await adminSalary.markPaid(salaryScope, r.id, { payment_method: method });
    setBusyId(null);
    if (!res.success) return toast.error(res.error || s('toast.salary_mark_paid_failed'));
    toast.success(s('toast.salary_marked_paid'));
    salaries.mutate();
  }
  async function remove(p: AccountingEntry) {
    if (!scopeId) return;
    if (!(await confirm({ title: s('delete_title'), body: s('delete_confirm'), destructive: true, confirmLabel: t('common.delete') }))) return;
    const res = await adminAccounting.deleteEntry('staff-payments', scopeId, p.id);
    if (!res.success) return toast.error(res.error || t('common.error'));
    toast.success(s('toast.deleted'));
    payments.mutate();
  }
  const statusBadge = (st: string) => (
    <Badge variant={st === 'paid' ? 'default' : st === 'approved' ? 'secondary' : 'outline'}>
      <Text>{st === 'pending' ? t('common.pending') : st === 'approved' ? t('common.approved') : st === 'paid' ? t('common.paid') : st}</Text>
    </Badge>
  );
  const openForm = (p?: AccountingEntry) =>
    yearName &&
    router.push({
      pathname: '/admin/accounting/entry-form',
      params: { kind: 'staff-payments', year: p?.academic_year ?? yearName, staff: picked.id, ...(p ? { id: p.id } : {}) },
    });

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Button variant="ghost" size="sm" className="self-start" onPress={() => setPicked(null)}>
          <Icon flipRtl as={ArrowLeft} className="size-4" />
          <Text>{t('common.back')}</Text>
        </Button>
        <Text className="text-lg font-semibold">{`${nameOf(picked)}${picked.title ? ` (${picked.title})` : ''}`}</Text>
        <FilterChips<'salaries' | 'payments'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'salaries', label: s('tab_salary_records') },
            { value: 'payments', label: s('tab_manual_payments') },
          ]}
        />

        {tab === 'salaries' ? (
          <>
            {salaries.isLoading ? <LoadingList rows={3} /> : null}
            {salaries.data && records.length === 0 ? <EmptyState title={s('no_salary_records')} /> : null}
            {records.map((r) => (
              <Card key={r.id} className="py-3">
                <CardContent className="gap-1 px-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold">{`${new Date(2000, r.month - 1).toLocaleString(undefined, { month: 'long' })} ${r.year}`}</Text>
                    {statusBadge(r.status)}
                  </View>
                  <Text className="text-muted-foreground text-xs">{`${s('salary_col_base')}: ${money(r.base_salary)} · ${s('salary_col_allowances')}: ${money(r.total_allowances)} · ${s('salary_col_deductions')}: ${money(r.total_deductions)}`}</Text>
                  <Text className="font-semibold">{`${s('salary_col_net')}: ${money(r.net_salary)}`}</Text>
                  <View className="flex-row gap-2 pt-1">
                    {r.status === 'pending' ? (
                      <Button size="sm" variant="outline" disabled={busyId === r.id} onPress={() => approve(r)}>
                        <Icon as={Check} className="size-4" />
                        <Text>{s('approve')}</Text>
                      </Button>
                    ) : null}
                    {r.status === 'approved' ? (
                      <Button size="sm" disabled={busyId === r.id} onPress={() => markPaid(r)}>
                        <Icon as={CheckCircle2} className="text-primary-foreground size-4" />
                        <Text>{s('mark_paid')}</Text>
                      </Button>
                    ) : null}
                    {r.status === 'paid' && r.payment_date ? <Text className="text-muted-foreground text-xs">{s('paid_on', { date: formatDate(r.payment_date) })}</Text> : null}
                  </View>
                </CardContent>
              </Card>
            ))}
            {records.length ? (
              <Card className="py-3">
                <CardContent className="gap-1 px-4">
                  <View className="flex-row justify-between">
                    <Text className="text-sm">{s('salary_total_paid')}</Text>
                    <Text className="text-sm text-success ">{money(totalPaid)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-sm">{s('salary_total_pending')}</Text>
                    <Text className="text-sm text-warning">{money(totalDue)}</Text>
                  </View>
                  <View className="border-border flex-row justify-between border-t pt-1">
                    <Text className="font-bold">{s('salary_grand_total')}</Text>
                    <Text className="font-bold">{money(totalPaid + totalDue)}</Text>
                  </View>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <>
            <Button onPress={() => openForm()} disabled={!yearName}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{t('app.ac_add')}</Text>
            </Button>
            {payments.isLoading ? <LoadingList rows={3} /> : null}
            {payments.data && manual.length === 0 ? <EmptyState title={s('no_manual_payments')} /> : null}
            {manual.map((p) => (
              <Pressable key={p.id} onPress={() => openForm(p)}>
                <Card className="py-3">
                  <CardContent className="flex-row items-start gap-3 px-4">
                    <View className="flex-1 gap-0.5">
                      <Text className="font-semibold">{money(p.amount)}</Text>
                      <Text className="text-muted-foreground text-xs">
                        {[`${s('col_receipt')}: ${p.receipt_number || s('auto_receipt')}`, p.payment_date ? formatDate(p.payment_date) : null, p.comments].filter(Boolean).join(' · ')}
                      </Text>
                      {p.file_attached ? (
                        <Pressable onPress={() => Linking.openURL(p.file_attached as string)} accessibilityRole="link">
                          <Text className="text-primary text-xs underline">{s('col_attachment')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable onPress={() => remove(p)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </CardContent>
                </Card>
              </Pressable>
            ))}
            <Card className="py-3">
              <CardContent className="gap-1 px-4">
                <View className="flex-row justify-between">
                  <Text className="text-sm">{s('payment_total_base')}</Text>
                  <Text className="text-sm">{money(base)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm">{s('payment_less_manual')}</Text>
                  <Text className="text-sm">{money(manualTotal)}</Text>
                </View>
                <View className="border-border flex-row justify-between border-t pt-1">
                  <Text className="font-bold">{t('common.balance')}</Text>
                  <Text className="font-bold">{money(base - manualTotal)}</Text>
                </View>
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </>
  );
}
