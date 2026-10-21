import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronLeft, ChevronRight, Info, Pencil, RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees, adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';

const PAGE = 20;

/**
 * Students with their active fee overrides for a year, filtered by grade/section/search, with a
 * summary; "Manage" opens the student's overrides (web: /admin/fees/overrides).
 */
export default function FeeOverrides() {
  const { t } = useTranslation();
  const o = (k: string, v?: Record<string, unknown>) => t(`fees.overrides.${k}`, v);
  const { campusId, scopeId } = useCampus();
  const { money } = useCurrency();
  const key = scopeId ?? 'none';
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const grades = useApi(scopeId ? ['admin', 'grades', key] : null, ([, , sid]) => adminAcademics.grades(sid as string));
  const [gradeId, setGradeId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [pickedYear, setPickedYear] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const yearName = pickedYear ?? years.data?.find((y) => y.is_current)?.name ?? 'all';
  const gradeName = (grades.data ?? []).find((g) => g.id === gradeId)?.name;
  const sections = useApi(scopeId && gradeId !== 'all' ? ['admin', 'sections', key, gradeId] : null, ([, , sid, gid]) => adminAcademics.sections(sid as string, gid as string));
  // Same as the web: up to 500 students of the campus (or one grade), section and search on the device.
  const students = useApi(scopeId ? ['admin', 'override-students', key, gradeName ?? ''] : null, ([, , , g]) =>
    adminStudents.list(campusId, { limit: 500, grade_level: g ? [g as string] : undefined }),
  );
  const overrides = useApi(scopeId ? ['admin', 'all-overrides', key, yearName] : null, ([, , sid, y]) =>
    adminFees.overrides(sid as string, { academic_year: y === 'all' ? undefined : (y as string), limit: 1000 }),
  );
  const categories = useApi(scopeId ? ['admin', 'fee-categories', scopeId] : null, ([, , sid]) => adminFees.categories(sid as string));

  const active = (overrides.data ?? []).filter((x) => x.is_active);
  const byStudent = new Map<string, typeof active>();
  for (const x of active) byStudent.set(x.student_id, [...(byStudent.get(x.student_id) ?? []), x]);
  const nameOf = (s: Student) => (s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : o('unknown'));
  const q = search.trim().toLowerCase();
  const filtered = (students.data ?? [])
    .filter((s) => sectionId === 'all' || s.section_id === sectionId)
    .filter((s) => !q || nameOf(s).toLowerCase().includes(q) || (s.student_number ?? '').toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE, current * PAGE);
  const sectionName = (s: Student) => s.section?.name ?? (sections.data ?? []).find((x) => x.id === s.section_id)?.name ?? '-';
  const refresh = () => {
    students.mutate();
    overrides.mutate();
  };

  const open = (s: Student) =>
    router.push({
      pathname: '/admin/billing/student-overrides/[id]',
      params: { id: s.id, name: nameOf(s), number: s.student_number ?? '', grade: s.grade?.name ?? s.grade_level ?? '' },
    });

  const summary: [string, number][] = [
    [o('totalOverrides'), active.length],
    [o('studentsWithOverrides'), byStudent.size],
    [o('affectedCategories'), new Set(active.map((x) => x.fee_category_id)).size],
    [o('totalFeeCategories'), categories.data?.length ?? 0],
  ];

  const header = (
    <View className="gap-3 p-4">
      <Text variant="muted">{o('subtitle')}</Text>
      <View className="flex-row gap-3 rounded-xl border border-info-soft bg-info-soft p-3">
        <Icon as={Info} className="mt-0.5 size-4 text-brand dark:text-brand-secondary " />
        <View className="flex-1">
          <Text className="text-sm font-medium text-brand dark:text-brand-secondary ">{o('howItWorks')}</Text>
          <Text className="text-xs text-brand dark:text-brand-secondary ">{o('howItWorksDesc')}</Text>
        </View>
      </View>
      <Button variant="outline" size="sm" onPress={refresh}>
        <Icon as={RefreshCw} className="size-4" />
        <Text>{o('refresh')}</Text>
      </Button>
      <SearchBar
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder={o('searchStudents')}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Picker
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setSectionId('all');
              setPage(1);
            }}
            options={[{ value: 'all', label: o('allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]}
          />
        </View>
        <View className="flex-1">
          <Picker
            value={sectionId}
            onChange={(v) => {
              setSectionId(v);
              setPage(1);
            }}
            options={[{ value: 'all', label: o('allSections') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </View>
      </View>
      <Picker
        value={yearName}
        onChange={setPickedYear}
        placeholder={o('academicYear')}
        options={[{ value: 'all', label: o('allYears') }, ...(years.data ?? []).map((y) => ({ value: y.name, label: `${y.name}${y.is_current ? ` ${o('currentYearSuffix')}` : ''}` }))]}
      />
    </View>
  );

  const footer = (
    <View className="gap-3 px-4 pt-2">
      <Text className="text-muted-foreground text-sm">
        {o('viewingCount', { from: filtered.length ? (current - 1) * PAGE + 1 : 0, to: Math.min(current * PAGE, filtered.length), total: filtered.length })}
      </Text>
      <View className="flex-row items-center justify-between">
        <Button variant="outline" size="sm" disabled={current === 1} onPress={() => setPage(current - 1)}>
          <Icon flipRtl as={ChevronLeft} className="size-4" />
          <Text>{o('previous')}</Text>
        </Button>
        <Text className="text-sm">{o('pageOf', { current, total: pages })}</Text>
        <Button variant="outline" size="sm" disabled={current >= pages} onPress={() => setPage(current + 1)}>
          <Text>{o('next')}</Text>
          <Icon flipRtl as={ChevronRight} className="size-4" />
        </Button>
      </View>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-lg">{o('overrideSummary')}</CardTitle>
          <CardDescription>{yearName !== 'all' ? o('summaryForYear', { year: yearName }) : o('summaryAllYears')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-row flex-wrap gap-y-3 px-4">
          {summary.map(([label, value]) => (
            <View key={label} className="w-1/2">
              <Text className="text-muted-foreground text-sm">{label}</Text>
              <Text className="text-2xl font-bold">{value}</Text>
            </View>
          ))}
        </CardContent>
      </Card>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: o('title') }} />
      {students.error ? (
        <ErrorState message={students.error.message || o('loadStudentsFailed')} onRetry={refresh} />
      ) : (
        <FlatList
          className="bg-background flex-1"
          data={students.isLoading ? [] : shown}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={students.isLoading ? <LoadingList rows={6} /> : <EmptyState title={t('fees.balances.noStudents')} />}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: s }) => {
            const list = byStudent.get(s.id) ?? [];
            return (
              <Pressable onPress={() => open(s)} className="active:bg-muted border-border gap-1.5 border-b px-4 py-3">
                <View className="flex-row items-start gap-2">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{nameOf(s)}</Text>
                    <Text className="text-muted-foreground text-xs">{[s.student_number, s.grade?.name ?? s.grade_level ?? '-', sectionName(s)].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Badge variant={list.length ? 'default' : 'outline'}>
                    <Text>{list.length ? o('activeOverridesCount', { count: list.length }) : o('noOverridesBadge')}</Text>
                  </Badge>
                </View>
                {list.length ? (
                  <View className="flex-row flex-wrap gap-1">
                    {list.slice(0, 3).map((x) => (
                      <View key={x.id} className="bg-muted rounded px-2 py-0.5">
                        <Text className="text-xs">{`${x.fee_categories?.name ?? '—'}: ${money(x.override_amount)}`}</Text>
                      </View>
                    ))}
                    {list.length > 3 ? <Text className="text-muted-foreground text-xs">{`+${list.length - 3} ${o('more')}`}</Text> : null}
                  </View>
                ) : (
                  <Text className="text-muted-foreground text-xs">{o('defaultFeesBadge')}</Text>
                )}
                <Button variant="outline" size="sm" className="self-start" onPress={() => open(s)}>
                  <Icon as={Pencil} className="size-3.5" />
                  <Text>{o('manage')}</Text>
                </Button>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}
