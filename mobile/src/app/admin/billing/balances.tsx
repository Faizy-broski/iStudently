import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { ArrowDown, ArrowUp, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type ViewMode = 'original' | 'expanded' | 'family';
type SortKey = 'student_name' | 'student_number' | 'grade_level' | 'ethnicity' | 'gender' | 'address' | 'city' | 'state' | 'zip_code' | 'balance';
type Row = {
  student_id: string;
  student_name: string;
  student_number: string;
  grade_level: string;
  total_fees: number;
  amount_paid: number;
  balance: number;
  ethnicity: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  relationship: string;
  parent_id: string | null;
  parent_name: string;
};
type Family = { id: string; name: string; students: Row[]; total: number };

/**
 * Balance per student summed from their fee records, this year or cumulative, in original, expanded
 * (address) or family view, with sort, search, totals and CSV (web: /admin/fees/student-balances).
 */
export default function Balances() {
  const { t } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`fees.balances.${k}`, o);
  const tp = (k: string, o?: Record<string, unknown>) => t(`fees.payments.${k}`, o);
  const toast = useToast();
  const { scopeId, campus } = useCampus();
  const { money } = useCurrency();
  const year = useAcademicYear();
  const [cumulative, setCumulative] = useState(false);
  const [view, setView] = useState<ViewMode>('original');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('student_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const yearName = cumulative ? '' : (year.name ?? '');
  const fees = useApi(scopeId && (cumulative || !year.isLoading) ? ['admin', 'balances', scopeId, yearName] : null, ([, , sid, y]) =>
    adminFees.studentFees(sid as string, { limit: 5000, academic_year: (y as string) || undefined }),
  );
  const students = useApi(scopeId ? ['admin', 'pay-students', scopeId, '', ''] : null, ([, , sid]) => adminFees.paymentStudents(sid as string, { limit: 500 }));

  const byId = new Map((students.data ?? []).map((s) => [s.id, s]));
  const map = new Map<string, Row>();
  for (const fee of fees.data ?? []) {
    const existing = map.get(fee.student_id);
    if (existing) {
      existing.total_fees += Number(fee.final_amount || 0);
      existing.amount_paid += Number(fee.amount_paid || 0);
      existing.balance = existing.total_fees - existing.amount_paid;
      continue;
    }
    const info = fee.students;
    const ex = byId.get(fee.student_id);
    const cf = ex?.custom_fields ?? {};
    const link = ex?.parent_student_links?.[0];
    const parent = link?.parents;
    const useParent = !cf.address && !!parent;
    map.set(fee.student_id, {
      student_id: fee.student_id,
      student_name: `${info?.profiles?.first_name ?? ''} ${info?.profiles?.last_name ?? ''}`.trim() || b('familyUnknown'),
      student_number: info?.student_number || '-',
      grade_level: info?.grade_levels?.name || ex?.grade_levels?.name || ex?.grade_level || '-',
      total_fees: Number(fee.final_amount || 0),
      amount_paid: Number(fee.amount_paid || 0),
      balance: Number(fee.final_amount || 0) - Number(fee.amount_paid || 0),
      ethnicity: cf.ethnicity ?? '',
      gender: cf.gender ?? '',
      address: (useParent ? parent?.address : cf.address) ?? '',
      city: (useParent ? parent?.city : cf.city) ?? '',
      state: (useParent ? parent?.state : cf.state) ?? '',
      zip_code: (useParent ? parent?.zip_code : cf.zip_code) ?? '',
      relationship: link?.relationship ?? '',
      parent_id: parent ? (link?.parent_id ?? null) : null,
      parent_name: parent ? `${parent.profiles?.first_name ?? ''} ${parent.profiles?.last_name ?? ''}`.trim() || b('familyUnknown') : '',
    });
  }
  const q = search.trim().toLowerCase();
  const rows = [...map.values()].filter((r) => !q || r.student_name.toLowerCase().includes(q) || r.student_number.toLowerCase().includes(q));
  const value = (r: Row) => (sortKey === 'balance' ? r.balance : String(r[sortKey] ?? '').toLowerCase());
  const sortRows = (list: Row[]) =>
    [...list].sort((x, y) => {
      const a = value(x);
      const c = value(y);
      const d = typeof a === 'number' && typeof c === 'number' ? a - c : String(a).localeCompare(String(c));
      return sortDir === 'asc' ? d : -d;
    });
  const sorted = sortRows(rows);
  const total = rows.reduce((sum, r) => sum + r.balance, 0);
  const families: Family[] = (() => {
    const fam = new Map<string, Family>();
    for (const r of rows) {
      const id = r.parent_id ?? `no-family-${r.student_id}`;
      const f = fam.get(id);
      if (f) {
        f.students.push(r);
        f.total += r.balance;
      } else fam.set(id, { id, name: r.parent_id ? r.parent_name : r.student_name, students: [r], total: r.balance });
    }
    return [...fam.values()].sort((a, c) => a.name.localeCompare(c.name)).map((f) => ({ ...f, students: sortRows(f.students) }));
  })();
  // Web colours: nothing paid in red, fully paid in green.
  const tone = (r: Row) => (r.amount_paid === 0 && r.total_fees > 0 ? 'text-red-600 dark:text-red-400' : r.amount_paid === r.total_fees && r.total_fees > 0 ? 'text-green-600 dark:text-green-400' : '');

  async function exportCsv() {
    if (!rows.length) return;
    const headers =
      view === 'expanded'
        ? [b('th_student'), b('th_studentId'), b('gradeLevel'), b('th_ethnicity'), b('th_gender'), b('th_address'), b('th_city'), b('th_state'), b('th_zip'), b('th_balance')]
        : [b('th_student'), b('th_studentId'), b('gradeLevel'), b('th_balance')];
    const data = sorted.map((r) => (view === 'expanded' ? [r.student_name, r.student_number, r.grade_level, r.ethnicity, r.gender, r.address, r.city, r.state, r.zip_code, money(r.balance)] : [r.student_name, r.student_number, r.grade_level, money(r.balance)]));
    try {
      await shareTextFile('student_balances.csv', toCsv(headers, data), 'text/csv', 'public.comma-separated-values-text');
    } catch {
      toast.error(t('app.error_title'));
    }
  }

  const SORTS: SortKey[] = view === 'expanded' ? ['student_name', 'student_number', 'grade_level', 'ethnicity', 'gender', 'address', 'city', 'state', 'zip_code', 'balance'] : ['student_name', 'student_number', 'grade_level', 'balance'];
  const sortLabel: Record<SortKey, string> = {
    student_name: b('th_student'),
    student_number: b('th_studentId'),
    grade_level: tp('gradeLevel'),
    ethnicity: b('th_ethnicity'),
    gender: b('th_gender'),
    address: b('th_address'),
    city: b('th_city'),
    state: b('th_state'),
    zip_code: b('th_zip'),
    balance: b('th_balance'),
  };

  function studentRow(r: Row, inFamily?: boolean) {
    return (
      <Pressable
        key={r.student_id}
        onPress={() => router.push({ pathname: '/admin/billing/student/[id]', params: { id: r.student_id } })}
        className="active:bg-muted border-border flex-row items-start gap-3 border-b px-4 py-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-medium">{r.student_name}</Text>
          <Text className="text-muted-foreground text-xs">{`${r.student_number} · ${r.grade_level}`}</Text>
          {inFamily && r.relationship ? <Text className="text-muted-foreground text-xs capitalize">{`${b('th_relationship')}: ${r.relationship}`}</Text> : null}
          {view === 'expanded' ? (
            <>
              {r.ethnicity ? <Text className="text-muted-foreground text-xs">{`${b('th_ethnicity')}: ${r.ethnicity}`}</Text> : null}
              {r.gender ? <Text className="text-muted-foreground text-xs">{`${b('th_gender')}: ${r.gender}`}</Text> : null}
              {r.address || r.city ? <Text className="text-muted-foreground text-xs">{[r.address, r.city, r.state, r.zip_code].filter(Boolean).join(', ')}</Text> : null}
            </>
          ) : null}
        </View>
        <Text className={cn('font-semibold', tone(r))}>{money(r.balance)}</Text>
      </Pressable>
    );
  }

  const header = (
    <View className="gap-3 p-4">
      <Text variant="muted">{b('subtitle', { campusName: campus?.name ?? '' })}</Text>
      <Pressable onPress={() => setCumulative((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: cumulative }} className="flex-row items-center gap-2">
        <Checkbox checked={cumulative} onCheckedChange={setCumulative} />
        <Text className="text-sm">{b('cumulativeBalance')}</Text>
      </Pressable>
      <FilterChips<ViewMode>
        value={view}
        onChange={setView}
        options={[
          { value: 'original', label: b('viewOriginal') },
          { value: 'expanded', label: b('viewExpanded') },
          { value: 'family', label: b('groupByFamily') },
        ]}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder={tp('searchStudent')} />
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Picker value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={SORTS.map((k) => ({ value: k, label: sortLabel[k] }))} />
        </View>
        <Button variant="outline" size="icon" onPress={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))} accessibilityLabel={sortDir === 'asc' ? t('app.ar_sort_asc') : t('app.ar_sort_desc')}>
          <Icon as={sortDir === 'asc' ? ArrowUp : ArrowDown} className="size-4" />
        </Button>
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-muted-foreground flex-1 text-sm">
          {view === 'family' ? b('foundFamilies', { count: families.length, studentCount: rows.length }) : b('foundStudentsCount', { count: rows.length })}
        </Text>
        <Button variant="outline" size="sm" onPress={exportCsv} disabled={!rows.length} accessibilityLabel={b('exportCSV')}>
          <Icon as={Share2} className="size-4" />
          <Text>CSV</Text>
        </Button>
      </View>
    </View>
  );

  const footer =
    rows.length > 0 ? (
      <View className="bg-muted/50 mx-4 mt-2 flex-row items-center justify-between rounded-lg px-4 py-3">
        <Text className="font-semibold">{view === 'family' ? b('grandTotal', { count: rows.length }) : tp('totalFees')}</Text>
        <Text className="font-semibold">{money(total)}</Text>
      </View>
    ) : null;

  const loading = fees.isLoading || (!cumulative && year.isLoading);

  return (
    <>
      <Stack.Screen options={{ title: b('title') }} />
      {fees.error ? (
        <ErrorState message={fees.error.message} onRetry={() => fees.mutate()} />
      ) : view === 'family' ? (
        <FlatList
          className="bg-background flex-1"
          data={loading ? [] : families}
          keyExtractor={(f) => f.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={loading ? <LoadingList rows={6} /> : <EmptyState title={b('noStudents')} />}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Card className="mx-4 my-1.5 gap-0 overflow-hidden py-0">
              <View className="bg-primary flex-row items-center gap-2 px-4 py-2">
                <Icon as={Users} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground flex-1 font-semibold" numberOfLines={1}>
                  {`${b('familyPrefix', { name: item.name })} (${item.students.length} ${tp('student')})`}
                </Text>
                <Text className="text-primary-foreground font-semibold">{`${tp('balance')}: ${money(item.total)}`}</Text>
              </View>
              <CardContent className="px-0">{item.students.map((r) => studentRow(r, true))}</CardContent>
            </Card>
          )}
        />
      ) : (
        <FlatList
          className="bg-background flex-1"
          data={loading ? [] : sorted}
          keyExtractor={(r) => r.student_id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={loading ? <LoadingList rows={6} /> : <EmptyState title={b('noStudents')} />}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={25}
          renderItem={({ item }) => studentRow(item)}
        />
      )}
    </>
  );
}

