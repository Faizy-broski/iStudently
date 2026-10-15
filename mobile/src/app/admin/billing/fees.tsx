import type { StudentFee, StudentFeeStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertCircle, Banknote, CheckCircle2, ChevronLeft, ChevronRight, FileText, Pencil, Receipt, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DueDateBadge, FeeStatusBadge } from '@/features/admin/fee-records';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUSES: StudentFeeStatus[] = ['pending', 'partial', 'paid', 'overdue', 'waived'];
const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * Every student fee record with stats, grade/section/month/status filters and per-fee actions:
 * override, adjust, challan (web: /admin/fees).
 */
export default function StudentFees() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`admin.fees.page.${k}`, o);
  const c = (k: string, o?: Record<string, unknown>) => t(`common.${k}`, o);
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const key = scopeId ?? 'none';
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [month, setMonth] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const stats = useApi(scopeId ? ['admin', 'fees-dashboard', scopeId] : null, ([, , sid]) => adminFees.dashboard(sid as string));
  const grades = useApi(scopeId ? ['admin', 'grades', key] : null, ([, , sid]) => adminAcademics.grades(sid as string));
  const allSections = useApi(scopeId ? ['admin', 'sections', key, 'all'] : null, ([, , sid]) => adminAcademics.sections(sid as string));
  // One call returns the page and its totals.
  const fees = useApi(
    scopeId ? ['admin', 'fees-by-grade', key, gradeIds.join(','), sectionIds.join(','), month, status, String(page), String(pageSize)] : null,
    async ([, , sid, g, sec, m, st, pg, size]) => {
      const res = await adminFees.feesByGrade(sid as string, {
        grade_level_id: g ? (g as string).split(',') : undefined,
        section_id: sec ? (sec as string).split(',') : undefined,
        fee_month: m === 'all' ? undefined : (m as string),
        status: st === 'all' ? undefined : (st as StudentFeeStatus),
        page: Number(pg),
        limit: Number(size),
      });
      return res.success ? { success: true as const, data: { rows: res.data ?? [], pagination: res.pagination ?? null } } : { success: false as const, error: res.error };
    },
  );
  const rows = fees.data?.rows ?? [];
  const pagination = fees.data?.pagination ?? null;
  const totalPages = pagination?.totalPages || 1;

  const gradeList = [...(grades.data ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const sectionList = (allSections.data ?? []).filter((s) => gradeIds.length === 0 || gradeIds.includes(s.grade_level_id));
  const s = stats.data;
  const filtersChanged = () => setPage(1);
  const refresh = () => {
    fees.mutate();
    stats.mutate();
  };

  function feeRow(fee: StudentFee) {
    const balance = (fee.final_amount ?? 0) - (fee.amount_paid ?? 0);
    const p = fee.students?.profiles;
    return (
      <Card key={fee.id} className="gap-2 py-3">
        <CardContent className="gap-2 px-4">
          <View className="flex-row items-start gap-2">
            <Pressable className="flex-1" onPress={() => router.push({ pathname: '/admin/billing/fee/[id]', params: { id: fee.id } })}>
              <Text className="font-semibold">{`${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || '—'}</Text>
              <Text className="text-muted-foreground text-xs">{[fee.students?.student_number, fee.fee_structures?.fee_categories?.name].filter(Boolean).join(' · ')}</Text>
            </Pressable>
            <FeeStatusBadge status={fee.status} />
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            <Text className="text-sm">{`${c('amount')}: ${money(fee.final_amount)}`}</Text>
            <Text className="text-sm text-green-600 dark:text-green-400">{`${c('paid')}: ${money(fee.amount_paid)}`}</Text>
            <Text className={cn('text-sm font-medium', balance > 0 ? 'text-red-600 dark:text-red-400' : balance < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
              {`${c('balance')}: ${money(balance)}`}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-muted-foreground text-xs">{`${f('table.due_date')}: ${fee.due_date ? formatDate(fee.due_date) : '—'}`}</Text>
            <DueDateBadge dueDate={fee.due_date} status={fee.status} />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: '/admin/billing/student-overrides/[id]',
                  params: { id: fee.student_id, name: `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim(), number: fee.students?.student_number ?? '', grade: fee.students?.grade_levels?.name ?? '' },
                })
              }>
              <Icon as={Pencil} className="size-3.5" />
              <Text>{f('actions.override')}</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/billing/fee/adjust', params: { id: fee.id } })}>
              <Icon as={SlidersHorizontal} className="size-3.5" />
              <Text>{f('actions.adjust')}</Text>
            </Button>
            <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/billing/fee/[id]', params: { id: fee.id } })}>
              <Icon as={FileText} className="size-3.5" />
              <Text>{f('actions.view_challan')}</Text>
            </Button>
          </View>
        </CardContent>
      </Card>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, pagination?.total ?? 0);

  return (
    <>
      <Stack.Screen options={{ title: f('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{f('subtitle')}</Text>
        <View className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => router.push('/admin/billing/settings')}>
            <Icon as={Settings} className="size-4" />
            <Text>{f('actions.settings')}</Text>
          </Button>
          <Button className="flex-1" onPress={() => router.push('/admin/billing/generate')}>
            <Text>{f('actions.generate')}</Text>
          </Button>
        </View>

        <View className="flex-row gap-2">
          <StatCard icon={Receipt} label={f('stats.total_fees')} value={s ? money(s.total_fees) : '…'} />
          <StatCard icon={CheckCircle2} label={f('stats.collected')} value={s ? money(s.total_collected) : '…'} />
        </View>
        <View className="flex-row gap-2">
          <StatCard icon={Banknote} label={f('stats.pending')} value={s ? money(s.total_pending) : '…'} tone="warning" />
          <StatCard icon={AlertCircle} label={f('stats.overdue')} value={s ? money(s.total_overdue) : '…'} tone="destructive" />
        </View>

        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{f('table.title')}</CardTitle>
            <CardDescription>{f('table.description')}</CardDescription>
          </CardHeader>
          <CardContent className="gap-2 px-4">
            <Text className="text-muted-foreground text-xs">{c('grade_level')}</Text>
            <MultiSelect
              options={gradeList.map((g) => ({ id: g.id, label: g.name }))}
              value={gradeIds}
              onChange={(ids) => {
                setGradeIds(ids);
                setSectionIds([]);
                filtersChanged();
              }}
              placeholder={c('all_grades')}
              title={c('grade_level')}
            />
            {gradeIds.length > 0 ? (
              <>
                <Text className="text-muted-foreground text-xs">{c('section')}</Text>
                <MultiSelect
                  options={sectionList.map((x) => ({ id: x.id, label: x.name }))}
                  value={sectionIds}
                  onChange={(ids) => {
                    setSectionIds(ids);
                    filtersChanged();
                  }}
                  placeholder={c('all_sections')}
                  title={c('section')}
                />
              </>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Text className="text-muted-foreground text-xs">{f('filters.fee_month')}</Text>
                <Picker
                  value={month}
                  onChange={(v) => {
                    setMonth(v);
                    filtersChanged();
                  }}
                  options={[{ value: 'all', label: f('filters.all_months') }, ...MONTHS.map((m, i) => ({ value: m, label: c(`months.${i}`) }))]}
                />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-muted-foreground text-xs">{c('status')}</Text>
                <Picker
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    filtersChanged();
                  }}
                  options={[
                    { value: 'all', label: f('filters.all_statuses') },
                    ...STATUSES.map((x) => ({ value: x, label: x === 'pending' || x === 'paid' ? c(x) : f(`status.${x}`) })),
                  ]}
                />
              </View>
            </View>
            <Button variant="outline" size="sm" onPress={refresh} disabled={fees.isValidating} accessibilityLabel={f('actions.refresh')}>
              <Icon as={RefreshCw} className="size-4" />
              <Text>{f('actions.refresh')}</Text>
            </Button>
          </CardContent>
        </Card>

        {fees.isLoading ? (
          <ActivityIndicator className="py-8" />
        ) : fees.error ? (
          <ErrorState message={fees.error.message || f('failedToLoadFees')} onRetry={refresh} />
        ) : rows.length === 0 ? (
          <EmptyState title={f('table.empty')} />
        ) : (
          rows.map(feeRow)
        )}

        <View className="border-border gap-2 border-t pt-3">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-muted-foreground flex-1 text-sm">
              {pagination && pagination.total > 0 ? f('pagination.showing', { start, end, total: pagination.total }) : f('pagination.no_records')}
            </Text>
            <Text className="text-muted-foreground text-sm">{`${c('perPage')}:`}</Text>
            <View className="w-20">
              <Picker
                value={String(pageSize)}
                onChange={(v) => {
                  setPageSize(Number(v));
                  filtersChanged();
                }}
                options={['10', '20', '50', '100'].map((n) => ({ value: n, label: n }))}
              />
            </View>
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onPress={() => setPage((x) => Math.max(1, x - 1))}>
              <Icon as={ChevronLeft} className="size-4 rtl:rotate-180" />
              <Text>{c('previous')}</Text>
            </Button>
            <Text className="text-sm">{c('page_x_of_y', { current: page, total: totalPages })}</Text>
            <Button variant="outline" size="sm" disabled={!pagination || page >= totalPages} onPress={() => setPage((x) => x + 1)}>
              <Text>{c('next')}</Text>
              <Icon as={ChevronRight} className="size-4 rtl:rotate-180" />
            </Button>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
