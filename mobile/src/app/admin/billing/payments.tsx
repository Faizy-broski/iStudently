import type { PaymentStudent } from '@studently/api-client';
import { toCsv, toExcelXml } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { FileSpreadsheet, FileText, Share2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { FilterChips } from '@/components/app/filter-chips';
import { MultiSelect } from '@/components/app/multi-select';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, escapeHtml, sharePdf } from '@/lib/print';
import { shareTextFile } from '@/lib/share-file';

type ViewMode = 'original' | 'expanded' | 'family';
type Family = { id: string; name: string; students: PaymentStudent[] };

const nameOf = (s: PaymentStudent) => `${s.profiles?.first_name ?? ''} ${s.profiles?.last_name ?? ''}`.trim().toUpperCase();

/** Address from the student's own fields, else the first parent's (web: getStudentAddress). */
function addressOf(s: PaymentStudent) {
  if (s.custom_fields?.address) return { address: s.custom_fields.address, city: s.custom_fields.city ?? '', state: s.custom_fields.state ?? '', zip: s.custom_fields.zip_code ?? '' };
  const parent = s.parent_student_links?.[0]?.parents;
  if (parent?.address) return { address: parent.address, city: parent.city ?? '', state: parent.state ?? '', zip: parent.zip_code ?? '' };
  return { address: '', city: '', state: '', zip: '' };
}

/** Pick a student to see and record payments, with expanded and family views and exports (web: /admin/fees/payments). */
export default function PaymentStudents() {
  const { t } = useTranslation();
  const p = (k: string, o?: Record<string, unknown>) => t(`fees.payments.${k}`, o);
  const toast = useToast();
  const print = usePrintContext();
  const { scopeId } = useCampus();
  const key = scopeId ?? 'none';
  const [view, setView] = useState<ViewMode>('original');
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const grades = useApi(scopeId ? ['admin', 'grades', key] : null, ([, , sid]) => adminAcademics.grades(sid as string));
  const allSections = useApi(scopeId ? ['admin', 'sections', key, 'all'] : null, ([, , sid]) => adminAcademics.sections(sid as string));
  // Same as the web: up to 500 students for the chosen grades/sections, searched on the device.
  const students = useApi(scopeId ? ['admin', 'pay-students', key, gradeIds.join(','), sectionIds.join(',')] : null, ([, , sid, g, s]) =>
    adminFees.paymentStudents(sid as string, { grade_level_ids: g ? (g as string).split(',') : undefined, section_ids: s ? (s as string).split(',') : undefined, limit: 500 }),
  );
  const sections = (allSections.data ?? []).filter((s) => gradeIds.length === 0 || gradeIds.includes(s.grade_level_id));

  const q = search.trim().toLowerCase();
  const filtered = (students.data ?? []).filter((s) => !q || nameOf(s).toLowerCase().includes(q) || (s.student_number ?? '').toLowerCase().includes(q));
  const families: Family[] = (() => {
    const map = new Map<string, Family>();
    for (const s of filtered) {
      const link = s.parent_student_links?.[0];
      const parent = link?.parents;
      if (!link || !parent) {
        map.set(`no-family-${s.id}`, { id: `no-family-${s.id}`, name: nameOf(s), students: [s] });
        continue;
      }
      const name = `${parent.profiles?.first_name ?? ''} ${parent.profiles?.last_name ?? ''}`.trim() || '—';
      const fam = map.get(link.parent_id);
      if (fam) fam.students.push(s);
      else map.set(link.parent_id, { id: link.parent_id, name, students: [s] });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  const columns = [t('common.sn'), p('student'), p('istudentlyId'), p('gradeLevel'), t('common.section'), p('ethnicity'), p('gender'), p('mailingAddress'), p('city'), p('state'), p('zipCode')];
  const rowsFor = (list: PaymentStudent[]) =>
    list.map((s, i) => {
      const a = addressOf(s);
      return [i + 1, nameOf(s), s.student_number ?? '', s.grade_levels?.name ?? '', s.sections?.name ?? '', s.custom_fields?.ethnicity ?? '', s.custom_fields?.gender ?? '', a.address, a.city, a.state, a.zip];
    });

  async function exportAs(kind: 'csv' | 'excel' | 'pdf') {
    if (!filtered.length) return;
    try {
      if (kind === 'csv') {
        // Web "Export CSV": three columns, or nine in the expanded view.
        const headers = view === 'expanded' ? [p('student'), p('istudentlyId'), p('gradeLevel'), p('ethnicity'), p('gender'), p('mailingAddress'), p('city'), p('state'), p('zipCode')] : [p('student'), p('istudentlyId'), p('gradeLevel')];
        const rows = filtered.map((s) => {
          const a = addressOf(s);
          const base = [nameOf(s), s.student_number ?? '', s.grade_levels?.name ?? ''];
          return view === 'expanded' ? [...base, s.custom_fields?.ethnicity ?? '', s.custom_fields?.gender ?? '', a.address, a.city, a.state, a.zip] : base;
        });
        return await shareTextFile('students_payments.csv', toCsv(headers, rows), 'text/csv', 'public.comma-separated-values-text');
      }
      if (kind === 'excel') return await shareTextFile('fee_payments.xls', toExcelXml(p('title'), columns, rowsFor(filtered)), 'application/vnd.ms-excel', 'com.microsoft.excel.xls');
      const th = columns.map((c) => `<th style="text-align:start;padding:4px;border-bottom:2px solid ${colors.printText};font-size:9px">${escapeHtml(c)}</th>`).join('');
      const tr = rowsFor(filtered)
        .map((r) => `<tr>${r.map((c) => `<td style="padding:4px;border-bottom:1px solid ${colors.printBorder};font-size:9px">${escapeHtml(String(c))}</td>`).join('')}</tr>`)
        .join('');
      const body = `<h2 style="margin:0 0 10px">${escapeHtml(p('title'))}</h2><table style="width:100%;border-collapse:collapse"><tr>${th}</tr>${tr}</table>`;
      await sharePdf(buildPrintHtml({ title: p('title'), pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: p('title') }), 'fee_payments.pdf', { width: 842, height: 595 });
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  const open = (s: PaymentStudent) => router.push({ pathname: '/admin/billing/student/[id]', params: { id: s.id } });
  const cell = (label: string, value?: string | null) => (value ? <Text className="text-muted-foreground text-xs">{`${label}: ${value}`}</Text> : null);

  function studentCard(s: PaymentStudent, index: number, withRelationship?: boolean) {
    const a = addressOf(s);
    return (
      <Pressable key={s.id} onPress={() => open(s)} className="active:bg-muted border-border gap-0.5 border-b px-4 py-3">
        <View className="flex-row items-center gap-2">
          {!withRelationship ? <Text className="text-muted-foreground w-7 text-xs">{index + 1}</Text> : null}
          <Text className="text-primary flex-1 font-medium">{nameOf(s)}</Text>
        </View>
        <Text className="text-muted-foreground text-xs">{[s.student_number || '-', s.grade_levels?.name || '-', s.sections?.name || '-'].join(' · ')}</Text>
        {withRelationship ? cell(p('relationship'), s.parent_student_links?.[0]?.relationship) : null}
        {view === 'expanded' ? (
          <>
            {cell(p('ethnicity'), s.custom_fields?.ethnicity)}
            {cell(p('gender'), s.custom_fields?.gender)}
            {cell(p('mailingAddress'), [a.address, a.city, a.state, a.zip].filter(Boolean).join(', '))}
          </>
        ) : null}
      </Pressable>
    );
  }

  const count =
    view === 'family'
      ? p('foundFamilies', { count: families.length, studentCount: filtered.length })
      : view === 'expanded'
        ? p('foundStudentAddresses', { count: filtered.length })
        : p('foundStudents', { count: filtered.length });

  const header = (
    <View className="gap-3 p-4">
      <FilterChips<ViewMode>
        value={view}
        onChange={setView}
        options={[
          { value: 'original', label: p('originalView') },
          { value: 'expanded', label: p('expandedView') },
          { value: 'family', label: p('groupByFamily') },
        ]}
      />
      <View className="gap-1.5">
        <Label>{p('gradeLevel')}</Label>
        <MultiSelect
          options={(grades.data ?? []).map((g) => ({ id: g.id, label: g.name }))}
          value={gradeIds}
          onChange={(ids) => {
            setGradeIds(ids);
            const visible = new Set((allSections.data ?? []).filter((s) => ids.length === 0 || ids.includes(s.grade_level_id)).map((s) => s.id));
            setSectionIds((prev) => prev.filter((id) => visible.has(id)));
          }}
          placeholder={p('allGrades')}
          title={p('gradeLevel')}
        />
      </View>
      <View className="gap-1.5">
        <Label>{t('common.section')}</Label>
        <MultiSelect
          options={sections.map((s) => ({ id: s.id, label: s.name }))}
          value={sectionIds}
          onChange={setSectionIds}
          placeholder={p('allSections')}
          emptyMessage={gradeIds.length === 0 ? p('selectGradeFirst') : p('allSections')}
          title={t('common.section')}
        />
      </View>
      <SearchBar value={search} onChangeText={setSearch} placeholder={p('toolbar_search')} />
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="flex-1 text-sm">{count}</Text>
        <Button variant="outline" size="sm" onPress={() => exportAs('csv')} accessibilityLabel={p('exportCSV')} disabled={!filtered.length}>
          <Icon as={Share2} className="size-4" />
          <Text>CSV</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={() => exportAs('excel')} disabled={!filtered.length}>
          <Icon as={FileSpreadsheet} className="size-4" />
          <Text>Excel</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={() => exportAs('pdf')} disabled={!filtered.length || !print.ready}>
          <Icon as={FileText} className="size-4" />
          <Text>PDF</Text>
        </Button>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: p('title') }} />
      {students.error ? (
        <ErrorState message={students.error.message} onRetry={() => students.mutate()} />
      ) : view === 'family' ? (
        <FlatList
          className="bg-background flex-1"
          data={students.isLoading ? [] : families}
          keyExtractor={(f) => f.id}
          ListHeaderComponent={header}
          ListEmptyComponent={students.isLoading ? <LoadingList rows={6} /> : <EmptyState title={p('noStudentsFound')} />}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Card className="mx-4 my-1.5 gap-0 overflow-hidden py-0">
              <View className="bg-primary flex-row items-center gap-2 px-4 py-2">
                <Icon as={Users} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground flex-1 font-semibold">{p('familyOf', { name: item.name })}</Text>
                <Text className="text-primary-foreground/80 text-sm">{`(${item.students.length} ${p('student')})`}</Text>
              </View>
              <CardContent className="px-0">{item.students.map((s, i) => studentCard(s, i, true))}</CardContent>
            </Card>
          )}
        />
      ) : (
        <FlatList
          className="bg-background flex-1"
          data={students.isLoading ? [] : filtered}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          ListEmptyComponent={students.isLoading ? <LoadingList rows={6} /> : <EmptyState title={p('noStudentsFound')} />}
          contentContainerClassName="pb-10"
          keyboardShouldPersistTaps="handled"
          initialNumToRender={25}
          renderItem={({ item, index }) => studentCard(item, index)}
        />
      )}
    </>
  );
}
