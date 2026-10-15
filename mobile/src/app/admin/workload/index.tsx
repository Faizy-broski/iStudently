import type { TeacherAssignment } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminEmployees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const teacherName = (a: TeacherAssignment) => a.teacher_name || shortName(a.teacher?.profile) || '—';
const subjectName = (a: TeacherAssignment) => a.subject_name || a.subject?.name || '—';
const classLabel = (a: TeacherAssignment) => [a.grade_name || a.section?.grade_level?.name, a.section_name || a.section?.name].filter(Boolean).join(' · ');

/** Which teacher teaches which subject to which section, per academic year (web: /admin/teachers/workload). */
export default function Workload() {
  const { t } = useTranslation();
  const w = (k: string, o?: Record<string, unknown>) => t(`teachers.${k}`, o);
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const years = useApi(['admin', 'academic-years', 'all'], () => adminAcademics.academicYears(true));
  const [picked, setPicked] = useState<string | null>(null);
  const yearId = picked ?? years.data?.find((y) => y.is_current)?.id ?? years.data?.[0]?.id ?? null;
  const [search, setSearch] = useState('');
  const [teacher, setTeacher] = useState('__all__');
  const list = useApi(yearId ? ['admin', 'assignments', campusId ?? 'school', yearId] : null, ([, , , y]) => adminEmployees.assignments(campusId, { academic_year_id: y as string }));
  const remove = useAction((id: string) => adminEmployees.removeAssignment(id), { success: t('teachers.workload.assignmentRemoved'), onSuccess: () => list.mutate() });

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups = new Map<string, TeacherAssignment[]>();
    for (const a of list.data ?? []) {
      const hay = `${teacherName(a)} ${subjectName(a)} ${classLabel(a)}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      if (teacher !== '__all__' && a.teacher_id !== teacher) continue;
      const key = teacherName(a);
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([title, data]) => ({ title, data }));
  }, [list.data, search, teacher]);
  const teacherOptions = [...new Map((list.data ?? []).map((a) => [a.teacher_id, teacherName(a)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  if (years.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen
        options={{
          title: w('workloadTitle'),
          headerRight: () =>
            yearId ? (
              <Button size="sm" variant="ghost" onPress={() => router.push({ pathname: '/admin/workload/form', params: { yearId } })} accessibilityLabel={t('app.wl_assign')}>
                <Icon as={Plus} className="size-5" />
              </Button>
            ) : null,
        }}
      />
      <View className="bg-background flex-1">
        <View className="gap-3 px-4 pt-3 pb-2">
          <Picker value={yearId} onChange={setPicked} placeholder={t('withdrawal.academicYear')} options={(years.data ?? []).map((y) => ({ value: y.id, label: y.name }))} />
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.wl_search')} />
          <Picker value={teacher} onChange={setTeacher} options={[{ value: '__all__', label: t('teachers.workload.filterByTeacher') }, ...teacherOptions.map(([id, name]) => ({ value: id, label: name }))]} />
          {list.data ? (
            <Text className="text-muted-foreground text-xs">
              {`${w('totalAssignments')}: ${list.data.length} · ${w('primaryAssignments')}: ${list.data.filter((a) => a.is_primary).length}`}
            </Text>
          ) : null}
        </View>
        {list.error ? (
          <ErrorState message={list.error.message} onRetry={() => list.mutate()} />
        ) : list.isLoading ? (
          <LoadingList rows={6} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(a) => a.id}
            stickySectionHeadersEnabled={false}
            contentContainerClassName="pb-10"
            ListEmptyComponent={<EmptyState title={w('noSubjectsAssigned')} />}
            renderSectionHeader={({ section }) => <Text className="text-muted-foreground px-4 pt-5 pb-1 text-xs font-semibold uppercase">{section.title}</Text>}
            ItemSeparatorComponent={() => <Separator className="ms-4" />}
            renderItem={({ item: a }) => (
              <View className="flex-row items-center gap-3 px-4 py-3">
                <View className="flex-1">
                  <Text className="font-medium">{subjectName(a)}</Text>
                  <Text className="text-muted-foreground text-sm">{classLabel(a)}</Text>
                </View>
                <Badge variant={a.is_primary ? 'default' : 'secondary'}>
                  <Text>{a.is_primary ? w('primaryTeacher') : w('subjectTeacher')}</Text>
                </Badge>
                <Pressable
                  hitSlop={8}
                  accessibilityLabel={t('app.wl_remove')}
                  onPress={async () => {
                    if (await confirm({ title: t('app.wl_remove'), body: `${teacherName(a)} · ${subjectName(a)} · ${classLabel(a)}`, destructive: true, confirmLabel: t('app.bl_delete') })) remove.run(a.id);
                  }}>
                  <Icon as={Trash2} className="text-muted-foreground size-5" />
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}
