import type { PeriodType } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FileText, Users, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { FilterChips, MultiChips } from '@/components/app/filter-chips';
import { FormError } from '@/components/app/form';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { Screen } from '@/components/app/screen';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { MULTI_INSTANCE_PERIODS, PERIOD_KEY, PERIOD_TYPES } from '@/features/admin/fees-shared';
import { StudentSearchSelect, type PickedStudent } from '@/features/admin/student-search';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';

type Status = 'active' | 'inactive' | 'all';
const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Create fee records from the fee structures, for many students (grade, section, status, gender,
 * family filters) or for one student, whose challan then opens (web: /admin/fees/generate).
 */
export default function GenerateFees() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`fees.generate.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { mutate } = useSWRConfig();
  const params = useLocalSearchParams<{ grades?: string }>();
  const { scopeId } = useCampus();
  const key = scopeId ?? 'none';
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const grades = useApi(scopeId ? ['admin', 'grades', key] : null, ([, , sid]) => adminAcademics.grades(sid as string));
  const allSections = useApi(scopeId ? ['admin', 'sections', key, 'all'] : null, ([, , sid]) => adminAcademics.sections(sid as string));
  const categories = useApi(scopeId ? ['admin', 'fee-categories', scopeId] : null, ([, , sid]) => adminFees.categories(sid as string));
  // The web defaults to next month.
  const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const [tab, setTab] = useState<'bulk' | 'individual'>('bulk');
  const [year, setYear] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [month, setMonth] = useState(String(next.getMonth() + 1));
  const [calYear, setCalYear] = useState(String(next.getFullYear()));
  const [periodNumber, setPeriodNumber] = useState('');
  const [gradeIds, setGradeIds] = useState<string[]>(() => (params.grades ? params.grades.split(',').filter(Boolean) : []));
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('active');
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [family, setFamily] = useState<'all' | 'with' | 'without'>('all');
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; severity: 'success' | 'info' | 'warning' } | null>(null);

  const academicYear = year ?? years.data?.find((y) => y.is_current)?.name ?? years.data?.[0]?.name ?? null;
  const structures = useApi(scopeId && academicYear ? ['admin', 'fee-structures', scopeId, academicYear] : null, ([, , sid, y]) => adminFees.structures(sid as string, y as string));
  const allCategories = categories.data ?? [];
  const multi = MULTI_INSTANCE_PERIODS.includes(period);
  const isMonthly = period === 'monthly';
  // Periods come from the structures of this type (Term 1, Term 2...), as on the web.
  const periods = multi
    ? [...new Map((structures.data ?? []).filter((x) => x.period_type === period && x.period_number != null).map((x) => [x.period_number as number, x.period_name || `${period} ${x.period_number}`])).entries()]
        .map(([number, name]) => ({ number, name }))
        .sort((a, b) => a.number - b.number)
    : [];
  const periodValue = periods.some((p) => String(p.number) === periodNumber) ? periodNumber : '';
  const sections = (allSections.data ?? []).filter((s) => gradeIds.length === 0 || gradeIds.includes(s.grade_level_id));
  const feeMonth = `${calYear}-${month.padStart(2, '0')}`;
  const defaultDue = `${feeMonth}-10`;
  const allSelected = allCategories.length > 0 && allCategories.every((c) => categoryIds.includes(c.id));
  const refresh = () => {
    mutate((k) => Array.isArray(k) && k[0] === 'admin' && (k[1] === 'fees-dashboard' || k[1] === 'ledger' || k[1] === 'balances' || (typeof k[1] === 'string' && k[1].startsWith('fees-'))));
  };

  async function runBulk() {
    if (!scopeId || !academicYear) return toast.error(g('missingInfo'));
    if (categoryIds.length === 0) return toast.error(g('selectCategoryRequired'));
    if (multi && !periodValue) return toast.error(g('selectPeriodFirst'));
    const scope = gradeIds.length ? gradeIds.map((id) => grades.data?.find((x) => x.id === id)?.name).filter(Boolean).join(', ') : g('allGrades');
    if (!(await confirm({ title: g('generateForAll'), body: `${academicYear} · ${g(PERIOD_KEY[period])} · ${scope}`, confirmLabel: g('generateForAll') }))) return;
    setBusy(true);
    setResult(null);
    const res = await adminFees.generate(scopeId, {
      academic_year: academicYear,
      period_type: period,
      month: isMonthly ? Number(month) : undefined,
      year: isMonthly ? Number(calYear) : undefined,
      period_number: multi ? parseInt(periodValue, 10) : undefined,
      grade_level_id: gradeIds.length ? gradeIds : undefined,
      section_id: sectionIds.length ? sectionIds : undefined,
      category_ids: allSelected ? null : categoryIds,
      student_status: status === 'all' ? undefined : status,
      gender: gender === 'all' ? undefined : gender,
      has_siblings: family === 'all' ? undefined : family === 'with',
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error || g('generateFailed'));
    const d = res.data;
    const clean = d && d.feesCreated > 0 && !d.skippedNoGrade && !d.skippedNoFeeStructures && !d.skippedZeroAmount && !d.skippedError;
    const message = clean
      ? g(allSelected ? 'bulkSuccessComprehensive' : 'bulkSuccess', { count: d.feesCreated, studentCount: d.studentsProcessed })
      : res.message || g('generateFailed2');
    setResult({ message, severity: clean ? 'success' : (res.severity ?? 'warning') });
    refresh();
  }

  async function runIndividual() {
    if (!scopeId || !academicYear) return toast.error(g('missingInfo'));
    if (!student) return toast.error(t('app.fe_pick_student_first'));
    if (!student.gradeId) return toast.error(g('noGradeAssigned'));
    if (categoryIds.length === 0) return toast.error(g('selectCategoryRequired'));
    if (multi && !periodValue) return toast.error(g('selectPeriodFirst'));
    setBusy(true);
    const res = await adminFees.generateForStudent(scopeId, {
      student_id: student.id,
      grade_id: student.gradeId,
      category_ids: allSelected ? null : categoryIds,
      academic_year: academicYear,
      fee_month: isMonthly ? feeMonth : undefined,
      due_date: isMonthly ? dueDate || defaultDue : undefined,
      period_type: period,
      period_number: multi ? parseInt(periodValue, 10) : undefined,
    });
    setBusy(false);
    if (!res.success || !res.data?.id) return toast.error(res.error || g('generateFailed'));
    toast.success(g('generated'));
    refresh();
    setStudent(null);
    // The web prints the new challan; the challan screen prints or shares it.
    router.push({ pathname: '/admin/billing/fee/[id]', params: { id: res.data.id } });
  }

  if (years.isLoading) return <LoadingList rows={5} />;

  const periodFields = (
    <>
      <View className="gap-1.5">
        <Label>{g('billingPeriod')}</Label>
        <FilterChips<PeriodType> value={period} onChange={setPeriod} options={PERIOD_TYPES.map((p) => ({ value: p, label: g(PERIOD_KEY[p]) }))} />
      </View>
      {isMonthly ? (
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Label>{g('month')}</Label>
            <Picker value={month} onChange={setMonth} options={MONTH_KEYS.map((m, i) => ({ value: String(i + 1), label: t(`fees.months.${m}`) }))} />
          </View>
          <View className="w-28 gap-1.5">
            <Label>{g('yearRequired')}</Label>
            <Input value={calYear} onChangeText={(v) => setCalYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
          </View>
        </View>
      ) : null}
      {multi ? (
        <View className="gap-1.5">
          <Label>{g('period')}</Label>
          <Picker
            value={periodValue}
            onChange={setPeriodNumber}
            placeholder={periods.length === 0 ? g('noPeriodsDefined') : g('selectPeriod')}
            options={periods.map((p) => ({ value: String(p.number), label: p.name }))}
          />
          {periods.length === 0 ? <Text className="text-warning text-xs">{g('noPeriodsDefinedHint')}</Text> : null}
        </View>
      ) : null}
      {period === 'annual' || period === 'one_time' ? <Text className="text-muted-foreground text-xs">{g('annualOneTimeHint')}</Text> : null}
      <View className="gap-1.5">
        <Label>{g('academicYear')}</Label>
        <Picker value={academicYear} onChange={setYear} options={(years.data ?? []).map((y) => ({ value: y.name, label: y.name }))} />
        <Text className="text-muted-foreground text-xs">{g('academicYearHint')}</Text>
      </View>
    </>
  );

  const categoryFields = (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Label>{g('selectCategory')}</Label>
        {allCategories.length ? (
          <Pressable onPress={() => setCategoryIds(allSelected ? [] : allCategories.map((c) => c.id))} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }} className="flex-row items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={() => setCategoryIds(allSelected ? [] : allCategories.map((c) => c.id))} />
            <Text className="text-sm">{allSelected ? g('deselectAll') : g('selectAll')}</Text>
          </Pressable>
        ) : null}
      </View>
      <MultiChips<string> value={categoryIds} onChange={setCategoryIds} options={allCategories.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))} />
      {allCategories.length === 0 ? <Text className="text-warning text-xs">{g('noCategoriesHint')}</Text> : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: g('title') }} />
      <Screen scroll edges={['bottom']}>
        <Text variant="muted">{g('subtitle')}</Text>
        <FilterChips<'bulk' | 'individual'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'bulk', label: g('bulkGeneration') },
            { value: 'individual', label: g('individualStudent') },
          ]}
        />

        {tab === 'bulk' ? (
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <View className="flex-row items-center gap-2">
                <Icon as={Users} className="size-5" />
                <CardTitle>{g('bulkGenerationTitle')}</CardTitle>
              </View>
              <CardDescription>{g('bulkGenerationDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-3 px-4">
              <View className="gap-1.5">
                <Label>{g('selectGrade')}</Label>
                <MultiSelect
                  options={(grades.data ?? []).map((x) => ({ id: x.id, label: x.name }))}
                  value={gradeIds}
                  onChange={(ids) => {
                    setGradeIds(ids);
                    const visible = new Set((allSections.data ?? []).filter((s) => ids.length === 0 || ids.includes(s.grade_level_id)).map((s) => s.id));
                    setSectionIds((prev) => prev.filter((id) => visible.has(id)));
                  }}
                  placeholder={g('selectGradeAll')}
                  emptyMessage={g('selectGradeAll')}
                  title={g('selectGrade')}
                />
                <Text className="text-muted-foreground text-xs">{g('selectGradeHint')}</Text>
              </View>
              {gradeIds.length > 0 ? (
                <View className="gap-1.5">
                  <Label>{t('common.section')}</Label>
                  <MultiSelect options={sections.map((s) => ({ id: s.id, label: s.name }))} value={sectionIds} onChange={setSectionIds} placeholder={g('selectSectionAll')} emptyMessage={g('selectSectionAll')} title={t('common.section')} />
                </View>
              ) : null}
              <View className="gap-1.5">
                <Label>{g('studentStatusFilter')}</Label>
                <FilterChips<Status>
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'active', label: g('statusActive') },
                    { value: 'inactive', label: g('statusInactive') },
                    { value: 'all', label: g('statusAll') },
                  ]}
                />
              </View>
              <View className="gap-1.5">
                <Label>{g('genderFilter')}</Label>
                <FilterChips<'all' | 'male' | 'female'>
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: 'all', label: g('genderAll') },
                    { value: 'male', label: g('genderMale') },
                    { value: 'female', label: g('genderFemale') },
                  ]}
                />
              </View>
              <View className="gap-1.5">
                <Label>{g('familyFilter')}</Label>
                <FilterChips<'all' | 'with' | 'without'>
                  value={family}
                  onChange={setFamily}
                  options={[
                    { value: 'all', label: g('familyAll') },
                    { value: 'with', label: g('familyWithSiblings') },
                    { value: 'without', label: g('familyWithoutSiblings') },
                  ]}
                />
              </View>
              {periodFields}
              {categoryFields}
              {result ? (
                result.severity === 'warning' ? (
                  <FormError message={result.message} />
                ) : (
                  <View className="bg-muted rounded-md p-3">
                    <Text className="text-sm">{result.message}</Text>
                  </View>
                )
              ) : null}
              <Button onPress={runBulk} disabled={busy || !scopeId || !academicYear || categoryIds.length === 0 || (multi && !periodValue)}>
                <Text>{busy ? g('generating') : g('generateForAll')}</Text>
              </Button>
              <Text className="text-muted-foreground text-center text-xs">{t('app.fe_generate_all_note')}</Text>
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-3 py-4">
            <CardHeader className="px-4">
              <View className="flex-row items-center gap-2">
                <Icon as={User} className="size-5" />
                <CardTitle>{g('individualStudentTitle')}</CardTitle>
              </View>
              <CardDescription>{g('individualStudentDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-3 px-4">
              <View className="gap-1.5">
                <Label>{`${t('fees.payments.student')} *`}</Label>
                <StudentSearchSelect value={student} onChange={setStudent} />
                {student ? <Text className="text-muted-foreground text-xs">{`${t('fees.payments.istudentlyId')}: ${student.number}`}</Text> : null}
              </View>
              {periodFields}
              {isMonthly ? (
                <View className="gap-1.5">
                  <Label>{g('dueDate')}</Label>
                  <DateField value={dueDate || defaultDue} onChange={(v) => setDueDate(v ?? '')} />
                  <Text className="text-muted-foreground text-xs">{g('dueDateHint')}</Text>
                </View>
              ) : null}
              {categoryFields}
              <Button onPress={runIndividual} disabled={busy || !student || categoryIds.length === 0 || (multi && !periodValue)}>
                <Icon as={FileText} className="text-primary-foreground size-4" />
                <Text>{busy ? g('generating') : g('generateForStudent')}</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-info-soft bg-info-soft py-4  ">
          <CardHeader className="px-4">
            <CardTitle className="text-brand dark:text-brand-secondary ">{`💡 ${g('howItWorks')}`}</CardTitle>
          </CardHeader>
          <CardContent className="gap-1 px-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={n} className="text-sm text-brand dark:text-brand-secondary ">{`• ${g(`howItWorksDesc${n}`)}`}</Text>
            ))}
          </CardContent>
        </Card>
        <Button variant="outline" onPress={() => router.push('/admin/billing/structures')}>
          <Text>{g('manageStructures')}</Text>
        </Button>
      </Screen>
    </>
  );
}
