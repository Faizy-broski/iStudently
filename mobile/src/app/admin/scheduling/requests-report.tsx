import { Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { studentFullName } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCourses, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<string, string> = {
  fulfilled: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  unfilled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
};

/** Course requests per subject and course, all or only unfilled (web: /admin/scheduling/requests-report). */
export default function RequestsReport() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.requests_report.${k}`, o);
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const [mode, setMode] = useState<'requests' | 'unfilled'>('requests');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const subjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const courses = useApi(['admin', 'courses', campusId ?? 'school'], () => adminCourses.courses(campusId));
  const requests = useApi(yearId ? ['admin', 'schedule-requests-year', yearId, campusId ?? 'school', mode] : null, ([, , y, , m]) =>
    adminScheduling.requestsForYear(y as string, { campus_id: campusId, status: m === 'unfilled' ? 'unfilled' : undefined }),
  );
  const all = requests.data ?? [];
  const courseList = courses.data ?? [];
  const subjectOf = (r: (typeof all)[number]) => r.subject_id || courseList.find((c) => c.id === r.course_id)?.subject_id || 'unknown';
  const filteredCourses = courseList.filter((c) => c.subject_id === subjectId);
  // One row per student (latest request wins), like the web.
  const byStudent = new Map<string, { name: string; status: string }>();
  for (const r of all.filter((x) => x.course_id === courseId)) byStudent.set(r.student_id, { name: studentFullName(r.student?.profile) || r.student?.student_number || r.student_id, status: r.status });
  const studentRows = [...byStudent.values()];

  const row = (key: string, label: string, count: number, on: boolean, onPress: () => void) => (
    <View key={key}>
      <Separator />
      <Pressable onPress={onPress} className={cn('flex-row items-center gap-2 py-2', on && 'bg-primary/10 rounded')}>
        <Text className={cn('flex-1 text-sm', on && 'font-semibold')}>{label}</Text>
        <Text className="w-10 text-center text-xs">{count}</Text>
        <Icon as={ChevronRight} className="text-muted-foreground size-3.5 rtl:rotate-180" />
      </Pressable>
    </View>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => requests.mutate()} />}>
        <FilterChips
          value={mode}
          onChange={setMode}
          options={[
            { value: 'requests', label: s('mode_requests') },
            { value: 'unfilled', label: s('mode_unfilled') },
          ]}
        />
        {subjects.isLoading || requests.isLoading ? (
          <LoadingList rows={4} />
        ) : !all.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{t('common.no_items_found', { label: t('common.subjects') })}</Text>
        ) : (
          <>
            <Card>
              <CardContent className="py-2">
                <View className="flex-row pb-1">
                  <Text className="text-muted-foreground flex-1 text-xs">{s('found_subjects', { count: (subjects.data ?? []).length })}</Text>
                  <Text className="text-muted-foreground text-xs">{s('th_requests')}</Text>
                </View>
                {(subjects.data ?? []).map((x) =>
                  row(x.id, x.name, all.filter((r) => subjectOf(r) === x.id).length, subjectId === x.id, () => {
                    setSubjectId(x.id);
                    setCourseId(null);
                  }),
                )}
              </CardContent>
            </Card>
            {subjectId ? (
              <Card>
                <CardContent className="py-2">
                  <Text className="text-muted-foreground pb-1 text-xs">{s('found_courses', { count: filteredCourses.length })}</Text>
                  {!filteredCourses.length ? <Text className="text-muted-foreground text-sm">{s('no_courses_found')}</Text> : null}
                  {filteredCourses.map((c) => row(c.id, c.title, all.filter((r) => r.course_id === c.id).length, courseId === c.id, () => setCourseId(c.id)))}
                </CardContent>
              </Card>
            ) : null}
            {courseId ? (
              <Card>
                <CardContent className="py-2">
                  <Text className="text-muted-foreground pb-1 text-xs">{s('found_requests', { count: studentRows.length })}</Text>
                  {!studentRows.length ? <Text className="text-muted-foreground text-sm">{s('no_requests_found')}</Text> : null}
                  {studentRows.map((r, i) => (
                    <View key={i}>
                      <Separator />
                      <View className="flex-row items-center gap-2 py-2.5">
                        <Text className="flex-1 text-sm">{r.name}</Text>
                        <Text className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_CLASS[r.status] ?? STATUS_CLASS.pending)}>{t(`common.status.${r.status}`)}</Text>
                      </View>
                    </View>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
