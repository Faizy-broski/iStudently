import type { Student } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { ChevronRight, Download, GraduationCap, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Initials, RowPill } from '@/components/app/layout';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ConfidentialBadge } from '@/features/admin/people-extras';
import { usePortalAcademic } from '@/features/portal/academic';
import { useTeacherStudents } from '@/features/teacher/students';
import { useDebounced } from '@/lib/use-debounced';
import { shareTextFile } from '@/lib/share-file';

/** Students of the teacher's sections: search, grade filter, CSV export, details (web: /teacher/students). */
export default function TeacherStudents() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.students.${key}`, o);
  const toast = useToast();
  const academic = usePortalAcademic();
  const res = useTeacherStudents(true);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim().toLowerCase(), 300);
  const [grade, setGrade] = useState('all');
  const all = res.data ?? [];
  const grades = [...new Set(all.map((s) => s.grade_level).filter((g): g is string => !!g))].sort();
  const name = (s: Student) => `${s.profile?.first_name ?? ''} ${s.profile?.last_name ?? ''}`.trim();
  const shown = all.filter((s) => (grade === 'all' || s.grade_level === grade) && (!term || name(s).toLowerCase().includes(term) || s.student_number.toLowerCase().includes(term) || (s.profile?.email ?? '').toLowerCase().includes(term)));
  const sections = new Set(academic.coursePeriods.map((c) => c.section_id).filter(Boolean)).size;

  async function exportCsv() {
    try {
      const rows = shown.map((s, i) => [String(i + 1), s.student_number, name(s), s.grade_level ?? '', k('active'), s.profile?.phone ?? '']);
      await shareTextFile('my_students.csv', toCsv(['#', k('studentId'), k('name'), k('grade'), k('status'), k('contact')], rows), 'text/csv', 'public.comma-separated-values-text');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : k('errorOccurred'));
    }
  }

  if (!academic.coursePeriodsLoading && !academic.coursePeriods.length) {
    return (
      <>
        <Stack.Screen options={{ title: k('pageTitle') }} />
        <EmptyState icon={GraduationCap} title={k('noCoursePeriodsAssigned')} body={k('noCoursePeriodsAssignedHint')} />
      </>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <DataList
        items={res.data ? shown : undefined}
        isLoading={res.isLoading}
        error={res.error}
        onRefresh={() => res.mutate()}
        emptyTitle={k('noStudentsFound')}
        keyExtractor={(s: Student) => s.id}
        header={
          <View className="gap-3 px-4 pb-2 pt-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="muted" className="flex-1 text-sm">
                {k('pageSubtitle')}
              </Text>
              {sections ? <StatusChip label={k('sectionsCount', { count: sections })} tone="info" /> : null}
            </View>
            <SearchBar value={q} onChangeText={setQ} placeholder={k('searchPlaceholder')} />
            <FilterChips value={grade} onChange={setGrade} options={[{ value: 'all', label: k('allGrades') }, ...grades.map((g) => ({ value: g, label: g }))]} />
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="muted" className="flex-1 text-xs">
                {res.isLoading ? k('loading') : k('showingRange', { from: shown.length ? 1 : 0, to: shown.length, total: shown.length })}
              </Text>
              <RowPill
                icon={X}
                tone="muted"
                label={k('clearFilters')}
                onPress={() => {
                  setQ('');
                  setGrade('all');
                }}
              />
              <RowPill icon={Download} label="CSV" onPress={exportCsv} />
            </View>
          </View>
        }
        renderItem={(s: Student) => (
          <Pressable onPress={() => router.push({ pathname: '/teacher/students/[studentId]', params: { studentId: s.id } })} accessibilityRole="button" className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
            <Initials name={name(s) || '?'} size={40} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="text-sm font-semibold">{name(s) || k('na')}</Text>
                <ConfidentialBadge status={s.confidential_family_status} />
              </View>
              <Text variant="muted" className="text-[11px]">{`${s.student_number} · ${s.grade_level || k('na')}`}</Text>
              <Text variant="muted" className="text-[11px]" numberOfLines={1}>{`${s.profile?.email || k('noEmail')} · ${s.profile?.phone || k('noPhone')}`}</Text>
            </View>
            <StatusChip label={k('active')} tone="success" />
            <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" />
          </Pressable>
        )}
      />
    </>
  );
}
