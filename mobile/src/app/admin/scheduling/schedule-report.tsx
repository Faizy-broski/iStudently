import { coursePeriodTeacherName } from '@studently/api-client';
import { toCsv } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { ChevronRight, Download } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Breadcrumbs } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { studentFullName } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminCourses, adminGrades, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareTextFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

type Seats = Record<string, { filled: number; total: number | null }>;

/** Requests, open/filled seats per course and course period, and each period's class list (web: /admin/scheduling/schedule-report). */
export default function ScheduleReport() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.schedule_report.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [cpId, setCpId] = useState<string | null>(null);
  const [mode, setMode] = useState<'students' | 'unscheduled'>('students');
  const [q, setQ] = useState('');

  const subjects = useApi(['admin', 'subjects', campusId ?? 'school', 'all'], () => adminAcademics.subjects(campusId));
  const courses = useApi(['admin', 'courses', campusId ?? 'school'], () => adminCourses.courses(campusId));
  const allCps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const requests = useApi(yearId ? ['admin', 'schedule-requests-year', yearId, campusId ?? 'school'] : null, ([, , y]) => adminScheduling.requestsForYear(y as string, { campus_id: campusId }));
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const classList = useApi(cpId ? ['admin', 'class-list', cpId] : null, ([, , c]) => adminScheduling.classListForPeriod(c as string));

  const courseList = (courses.data ?? []).filter((c) => c.subject_id === subjectId);
  const cps = (allCps.data ?? []).filter((c) => c.course_id === courseId);
  // Seats of every course period of the chosen subject's courses (for course totals) — fetched per period like the web.
  const seatIds = (allCps.data ?? []).filter((c) => courseList.some((x) => x.id === c.course_id)).map((c) => c.id);
  const seats = useApi(seatIds.length ? ['admin', 'cp-seats', ...seatIds] : null, async ([, , ...ids]) => {
    const res = await Promise.allSettled((ids as string[]).map((i) => adminScheduling.classListForPeriod(i)));
    const map: Seats = {};
    res.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.success && r.value.data) map[(ids as string[])[i]] = { filled: r.value.data.filled_seats, total: r.value.data.total_seats ?? null };
    });
    return { success: true, data: map };
  });
  const seatMap = seats.data ?? {};
  const reqCount = (cid: string) => (requests.data ?? []).filter((r) => r.course_id === cid).length;
  const courseSeats = (cid: string) =>
    (allCps.data ?? [])
      .filter((c) => c.course_id === cid)
      .reduce((a, c) => ({ filled: a.filled + (seatMap[c.id]?.filled ?? 0), total: a.total + (seatMap[c.id]?.total ?? 0) }), { filled: 0, total: 0 });
  const mpLabel = (id?: string | null) => (id ? ((mps.data ?? []).find((m) => m.id === id)?.short_name || (mps.data ?? []).find((m) => m.id === id)?.title || '—') : 'FY');

  const subject = (subjects.data ?? []).find((x) => x.id === subjectId);
  const course = courseList.find((x) => x.id === courseId);
  const term = q.trim().toLowerCase();
  const enrolled = (classList.data?.students ?? []).filter((x) => !term || x.student_name.toLowerCase().includes(term) || (x.grade_level ?? '').toLowerCase().includes(term));
  // "Unscheduled": students who requested this course but aren't scheduled into it yet.
  const unscheduled = (requests.data ?? [])
    .filter((r) => r.course_id === courseId && r.status !== 'fulfilled' && r.status !== 'cancelled')
    .map((r) => ({ id: r.student_id, name: studentFullName(r.student?.profile) || r.student?.student_number || r.student_id }))
    .filter((x) => !term || x.name.toLowerCase().includes(term));

  const head = (cols: string[]) => (
    <View className="flex-row gap-2 pb-1">
      <Text className="text-muted-foreground flex-1 text-xs">{cols[0]}</Text>
      {cols.slice(1).map((c) => (
        <Text key={c} className="text-muted-foreground w-11 text-center text-[11px]">
          {c}
        </Text>
      ))}
    </View>
  );
  const row = (key: string, label: string, nums: (string | number)[], on: boolean, onPress: () => void) => (
    <View key={key}>
      <Separator />
      <Pressable onPress={onPress} className={cn('flex-row items-center gap-2 rounded-xl px-2 py-2.5 active:opacity-70', on && 'bg-info-soft')}>
        <Text className={cn('flex-1 text-sm', on ? 'text-brand dark:text-brand-secondary font-semibold' : 'font-medium')}>{label}</Text>
        {nums.map((n, i) => (
          <Text key={i} className="w-11 text-center text-xs">
            {n}
          </Text>
        ))}
        <Icon flipRtl as={ChevronRight} className="text-muted-foreground size-3.5" />
      </Pressable>
    </View>
  );

  const download = () =>
    shareTextFile(
      'class-list.csv',
      toCsv(
        mode === 'students' ? [s('th_student'), s('th_grade_level')] : [s('th_student')],
        mode === 'students' ? enrolled.map((x) => [x.student_name, x.grade_level ?? '']) : unscheduled.map((x) => [x.name]),
      ),
      'text/csv',
      'public.comma-separated-values-text',
    ).catch((e) => toast.error(e instanceof Error ? e.message : ''));

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => (requests.mutate(), seats.mutate(), classList.mutate())} />}>
        <Breadcrumbs
          items={[
            {
              label: s('top'),
              onPress: () => {
                setSubjectId(null);
                setCourseId(null);
                setCpId(null);
              },
            },
            ...(subject
              ? [
                  {
                    label: subject.name,
                    onPress: () => {
                      setCourseId(null);
                      setCpId(null);
                    },
                  },
                ]
              : []),
            ...(course ? [{ label: course.title, onPress: () => setCpId(null) }] : []),
          ]}
        />

        <Card>
          <CardContent className="py-2">
            <Text className="text-muted-foreground pb-1 text-xs">{s('found_subjects', { count: (subjects.data ?? []).length })}</Text>
            {subjects.isLoading ? <LoadingList rows={2} /> : !(subjects.data ?? []).length ? <Text className="text-muted-foreground text-sm">{s('no_subjects_found')}</Text> : null}
            {(subjects.data ?? []).map((x) =>
              row(x.id, x.name, [], subjectId === x.id, () => {
                setSubjectId(x.id);
                setCourseId(null);
                setCpId(null);
              }),
            )}
          </CardContent>
        </Card>

        {subjectId ? (
          <Card>
            <CardContent className="py-2">
              <Text className="text-muted-foreground pb-1 text-xs">{s('found_courses', { count: courseList.length })}</Text>
              {head([s('th_course'), s('th_requests'), s('th_open'), s('th_filled'), s('th_total')])}
              {!courseList.length ? <Text className="text-muted-foreground text-sm">{s('no_courses_found')}</Text> : null}
              {courseList.map((x) => {
                const cs = courseSeats(x.id);
                return row(x.id, x.title, [reqCount(x.id), Math.max(0, cs.total - cs.filled), cs.filled, cs.total], courseId === x.id, () => {
                  setCourseId(x.id);
                  setCpId(null);
                });
              })}
            </CardContent>
          </Card>
        ) : null}

        {courseId ? (
          <Card>
            <CardContent className="py-2">
              <Text className="text-muted-foreground pb-1 text-xs">{s('found_cps', { count: cps.length })}</Text>
              {head([s('th_cp_label'), s('th_mp'), s('th_open'), s('th_filled'), s('th_total')])}
              {!cps.length ? <Text className="text-muted-foreground text-sm">{s('no_cps_found')}</Text> : null}
              {cps.map((x) => {
                const st = seatMap[x.id];
                const filled = st?.filled ?? 0;
                const total = st?.total ?? 0;
                const label = [x.room, coursePeriodTeacherName(x)].filter(Boolean).join(' - ') || t('common.period');
                return row(x.id, label, [mpLabel(x.marking_period_id), Math.max(0, total - filled), filled, total], cpId === x.id, () => setCpId(x.id));
              })}
            </CardContent>
          </Card>
        ) : null}

        {cpId ? (
          <View className="gap-2">
            <FilterChips
              value={mode}
              onChange={setMode}
              options={[
                { value: 'students', label: s('list_students') },
                { value: 'unscheduled', label: s('list_unscheduled') },
              ]}
            />
            <View className="flex-row items-center gap-2">
              <Text className="text-muted-foreground flex-1 text-sm">{s('found_students', { count: mode === 'students' ? enrolled.length : unscheduled.length })}</Text>
              <Pressable onPress={download} hitSlop={8} className="p-1" accessibilityLabel={t('common.download')}>
                <Icon as={Download} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
            <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
            {classList.isLoading ? (
              <LoadingList rows={3} />
            ) : (
              <Card>
                <CardContent className="py-1">
                  {(mode === 'students' ? enrolled : unscheduled).length === 0 ? <EmptyState title={s('no_students_found')} /> : null}
                  {mode === 'students'
                    ? enrolled.map((x, i) => (
                        <View key={x.schedule_id}>
                          {i > 0 ? <Separator /> : null}
                          <View className="flex-row items-center py-2.5">
                            <Text className="flex-1 text-sm">{x.student_name}</Text>
                            <Text className="text-muted-foreground text-xs">{x.grade_level || '—'}</Text>
                          </View>
                        </View>
                      ))
                    : unscheduled.map((x, i) => (
                        <View key={x.id}>
                          {i > 0 ? <Separator /> : null}
                          <Text className="py-2.5 text-sm">{x.name}</Text>
                        </View>
                      ))}
                </CardContent>
              </Card>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
