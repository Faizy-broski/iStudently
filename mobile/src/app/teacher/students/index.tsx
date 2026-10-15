import type { Student } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { Download, GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { PersonAvatar } from '@/components/app/person-avatar';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
          <View className="gap-2 px-4 pt-3 pb-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="muted" className="flex-1">
                {k('pageSubtitle')}
              </Text>
              {sections ? (
                <Badge variant="secondary">
                  <Text className="text-xs">{k('sectionsCount', { count: sections })}</Text>
                </Badge>
              ) : null}
            </View>
            <SearchBar value={q} onChangeText={setQ} placeholder={k('searchPlaceholder')} />
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: k('allGrades') }, ...grades.map((g) => ({ value: g, label: g }))]} />
              </View>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setQ('');
                  setGrade('all');
                }}>
                <Text>{k('clearFilters')}</Text>
              </Button>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-muted-foreground text-sm">{res.isLoading ? k('loading') : k('showingRange', { from: shown.length ? 1 : 0, to: shown.length, total: shown.length })}</Text>
              <Pressable onPress={exportCsv} hitSlop={8} className="flex-row items-center gap-1" accessibilityLabel={t('common.download')}>
                <Icon as={Download} className="text-primary size-4" />
                <Text className="text-primary text-sm">CSV</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={(s: Student) => (
          <Pressable onPress={() => router.push({ pathname: '/teacher/students/[studentId]', params: { studentId: s.id } })} accessibilityRole="button" className="flex-row items-center gap-3 px-4 py-3">
            <PersonAvatar url={null} name={name(s)} size={40} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="font-medium">{name(s) || k('na')}</Text>
                <ConfidentialBadge status={s.confidential_family_status} />
              </View>
              <Text className="text-muted-foreground text-xs">{`${s.student_number} · ${s.grade_level || k('na')}`}</Text>
              <Text className="text-muted-foreground text-xs">{`${s.profile?.email || k('noEmail')} · ${s.profile?.phone || k('noPhone')}`}</Text>
            </View>
            <Badge className="bg-green-100">
              <Text className="text-xs text-green-800">{k('active')}</Text>
            </Badge>
          </Pressable>
        )}
      />
    </>
  );
}
