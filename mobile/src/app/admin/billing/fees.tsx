import type { StudentFee, StudentFeeStatus } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, FileText, Filter, Pencil, RefreshCw, Settings, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { BottomSheet } from '@/components/app/bottom-sheet';
import { BrandGradient } from '@/components/app/brand-gradient';
import { FilterChips } from '@/components/app/filter-chips';
import { FilterTag, HeroCard, Initials, RoundIcon } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState } from '@/components/app/states';
import { Button } from '@/components/ui/button';
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
  const [sheet, setSheet] = useState(false);

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

  function feeRow(fee: StudentFee, i: number) {
    const balance = (fee.final_amount ?? 0) - (fee.amount_paid ?? 0);
    const p = fee.students?.profiles;
    const name = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || '—';
    return (
      <View key={fee.id} className={cn('gap-2 px-4 py-3', i < rows.length - 1 && 'border-info-soft dark:border-border border-b')}>
        <Pressable onPress={() => router.push({ pathname: '/admin/billing/fee/[id]', params: { id: fee.id } })} className="flex-row items-center gap-3 active:opacity-70" accessibilityRole="button">
          <Initials name={name} />
          <View className="flex-1">
            <Text className="text-sm font-semibold" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="muted" className="text-[11px]" numberOfLines={1}>
              {[fee.students?.student_number, fee.fee_structures?.fee_categories?.name, fee.due_date ? `${f('table.due_date')}: ${formatDate(fee.due_date)}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Text className="text-sm font-bold">{money(fee.final_amount)}</Text>
            <FeeStatusBadge status={fee.status} />
          </View>
        </Pressable>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <Text className="text-success text-[11px] font-semibold">{`${c('paid')}: ${money(fee.amount_paid)}`}</Text>
          <Text className={cn('text-[11px] font-semibold', balance > 0 ? 'text-destructive' : balance < 0 ? 'text-success' : 'text-muted-foreground')}>{`${c('balance')}: ${money(balance)}`}</Text>
          <DueDateBadge dueDate={fee.due_date} status={fee.status} />
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          <PillAction
            icon={Pencil}
            label={f('actions.override')}
            onPress={() =>
              router.push({
                pathname: '/admin/billing/student-overrides/[id]',
                params: { id: fee.student_id, name, number: fee.students?.student_number ?? '', grade: fee.students?.grade_levels?.name ?? '' },
              })
            }
          />
          <PillAction icon={SlidersHorizontal} label={f('actions.adjust')} onPress={() => router.push({ pathname: '/admin/billing/fee/adjust', params: { id: fee.id } })} />
          <PillAction icon={FileText} label={f('actions.view_challan')} onPress={() => router.push({ pathname: '/admin/billing/fee/[id]', params: { id: fee.id } })} />
        </View>
      </View>
    );
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, pagination?.total ?? 0);

  return (
    <>
      <Stack.Screen options={{ title: f('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <HeroCard>
          <Text className="text-white text-xs opacity-80">{f('stats.total_fees')}</Text>
          <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit>
            {s ? money(s.total_fees) : '…'}
          </Text>
          <View className="h-2 overflow-hidden rounded-full bg-white/20">
            <View className="h-full rounded-full bg-white" style={{ width: `${s && s.total_fees > 0 ? Math.min(100, (s.total_collected / s.total_fees) * 100) : 0}%` }} />
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-1">
            <Text className="text-white text-xs">{`${f('stats.collected')}: ${s ? money(s.total_collected) : '…'}`}</Text>
            <Text className="text-white text-xs opacity-80">{`${f('stats.pending')}: ${s ? money(s.total_pending) : '…'}`}</Text>
            <Text className="text-brand-accent text-xs font-semibold">{`${f('stats.overdue')}: ${s ? money(s.total_overdue) : '…'}`}</Text>
          </View>
          <View className="flex-row gap-2 pt-1">
            <Pressable onPress={() => router.push('/admin/billing/settings')} className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-white/15 py-2.5" accessibilityRole="button">
              <Icon as={Settings} className="text-white size-4" />
              <Text className="text-white text-sm font-semibold">{f('actions.settings')}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/admin/billing/generate')} className="flex-1 overflow-hidden rounded-full" accessibilityRole="button">
              <BrandGradient variant="gold" style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Text className="text-white text-sm font-semibold">{f('actions.generate')}</Text>
              </BrandGradient>
            </Pressable>
          </View>
        </HeroCard>

        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-base font-semibold">{f('table.title')}</Text>
          <RoundIcon icon={RefreshCw} label={f('actions.refresh')} onPress={refresh} />
          <RoundIcon icon={Filter} label={t('app.st_filters')} count={gradeIds.length + sectionIds.length + (month !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0)} onPress={() => setSheet(true)} />
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {gradeIds.map((g) => (
            <FilterTag key={g} label={gradeList.find((x) => x.id === g)?.name ?? g} onClear={() => (setGradeIds((x) => x.filter((y) => y !== g)), setSectionIds([]), filtersChanged())} />
          ))}
          {sectionIds.map((sid) => (
            <FilterTag key={sid} label={sectionList.find((x) => x.id === sid)?.name ?? sid} onClear={() => (setSectionIds((x) => x.filter((y) => y !== sid)), filtersChanged())} />
          ))}
          {month !== 'all' ? <FilterTag label={c(`months.${MONTHS.indexOf(month)}`)} onClear={() => (setMonth('all'), filtersChanged())} /> : null}
          {status !== 'all' ? <FilterTag label={status === 'pending' || status === 'paid' ? c(status) : f(`status.${status}`)} onClear={() => (setStatus('all'), filtersChanged())} /> : null}
        </View>

        {fees.isLoading ? (
          <ActivityIndicator className="py-8" />
        ) : fees.error ? (
          <ErrorState message={fees.error.message || f('failedToLoadFees')} onRetry={refresh} />
        ) : rows.length === 0 ? (
          <EmptyState title={f('table.empty')} />
        ) : (
          <Panel>{rows.map(feeRow)}</Panel>
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
              <Icon flipRtl as={ChevronLeft} className="size-4" />
              <Text>{c('previous')}</Text>
            </Button>
            <Text className="text-sm">{c('page_x_of_y', { current: page, total: totalPages })}</Text>
            <Button variant="outline" size="sm" disabled={!pagination || page >= totalPages} onPress={() => setPage((x) => x + 1)}>
              <Text>{c('next')}</Text>
              <Icon flipRtl as={ChevronRight} className="size-4" />
            </Button>
          </View>
        </View>
      </ScrollView>
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title={t('app.st_filters')}>
        <ScrollView contentContainerClassName="gap-3 pb-2" keyboardShouldPersistTaps="handled">
          <Text variant="muted" className="text-xs">
            {f('table.description')}
          </Text>
          <Text className="text-sm font-semibold">{c('grade_level')}</Text>
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
              <Text className="text-sm font-semibold">{c('section')}</Text>
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
          <Text className="text-sm font-semibold">{f('filters.fee_month')}</Text>
          <Picker
            value={month}
            onChange={(v) => {
              setMonth(v);
              filtersChanged();
            }}
            options={[{ value: 'all', label: f('filters.all_months') }, ...MONTHS.map((m, i) => ({ value: m, label: c(`months.${i}`) }))]}
          />
          <Text className="text-sm font-semibold">{c('status')}</Text>
          <FilterChips
            value={status}
            onChange={(v) => {
              setStatus(v);
              filtersChanged();
            }}
            options={[{ value: 'all', label: f('filters.all_statuses') }, ...STATUSES.map((x) => ({ value: x, label: x === 'pending' || x === 'paid' ? c(x) : f(`status.${x}`) }))]}
          />
          <Button onPress={() => setSheet(false)}>
            <Text>{t('app.st_show_results')}</Text>
          </Button>
        </ScrollView>
      </BottomSheet>
    </>
  );
}

/** Small outline pill action under a row. */
function PillAction({ icon, label, onPress }: { icon: typeof Pencil; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-70" accessibilityRole="button">
      <Icon as={icon} className="text-brand dark:text-brand-secondary size-3" />
      <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{label}</Text>
    </Pressable>
  );
}
