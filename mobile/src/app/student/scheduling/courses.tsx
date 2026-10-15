import type { StudentCourse } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/**
 * The student's subjects → course → course period, read-only, with the details of the selected
 * level on top (web: /student/scheduling/courses).
 */
export default function StudentCourses() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_co_${key}`, o);
  const courses = useApi(['student', 'courses'], () => student.getStudentCourses());
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);

  if (courses.isLoading) return <LoadingList rows={6} />;
  if (courses.error) {
    return (
      <View className="bg-background flex-1 p-4">
        <View className="flex-row items-center gap-3 rounded-md border border-red-200 bg-red-50 p-4 dark:bg-red-950/20">
          <Icon as={AlertCircle} className="size-8 text-red-600" />
          <View className="flex-1">
            <Text className="font-semibold text-red-900 dark:text-red-200">{k('error')}</Text>
            <Text className="text-sm text-red-700 dark:text-red-300">{courses.error.message}</Text>
          </View>
        </View>
      </View>
    );
  }
  const list = courses.data ?? [];
  const subject = list.find((c) => c.subject_id === subjectId);
  const course = list.find((c) => c.subject_id === courseId);
  const teacher = (c?: StudentCourse) => c?.teacher_name || k('unassigned');

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => courses.mutate()} />}>
        {subject || course || periodId ? (
          <View className="border-border bg-background overflow-hidden rounded-md border">
            <View className="bg-muted/20 border-border border-b px-4 py-3">
              <Text className="text-primary text-lg font-semibold">{periodId ? `${course?.subject_name} - ${teacher(course)}` : course ? course.subject_name : subject?.subject_name}</Text>
            </View>
            <View className="gap-3 p-4">
              {periodId ? (
                <>
                  <Detail label={k('title_label')} value={`${course?.subject_name} - ${teacher(course)}`} />
                  <Detail label={k('teacher')} value={teacher(course)} />
                  <Detail label={k('status')} value={k('enrolled')} valueClass="text-emerald-600" />
                </>
              ) : (
                <>
                  <Detail label={k('title_label')} value={(course ?? subject)?.subject_name ?? ''} />
                  <Detail label={k('short')} value={(course ?? subject)?.subject_code || '—'} />
                  <Detail label={k('teacher')} value={course ? teacher(course) : '—'} />
                  {course?.description ? <Detail label={k('description')} value={course.description} /> : null}
                </>
              )}
            </View>
          </View>
        ) : null}

        <Level title={k('subject')} count={k('subjects_found', { count: list.length })}>
          {list.length === 0 ? <Text className="text-muted-foreground px-3 py-4 text-sm">{k('no_subjects')}</Text> : null}
          {list.map((c) => (
            <Row
              key={c.subject_id}
              label={c.subject_name}
              selected={subjectId === c.subject_id}
              onPress={() => {
                setSubjectId(c.subject_id);
                setCourseId(null);
                setPeriodId(null);
              }}
            />
          ))}
        </Level>

        {subject ? (
          <Level title={k('course')} count={k('one_course')}>
            <Row
              label={subject.subject_name}
              selected={courseId === subject.subject_id}
              onPress={() => {
                setCourseId(subject.subject_id);
                setPeriodId(null);
              }}
            />
          </Level>
        ) : (
          <Text className="text-muted-foreground py-6 text-center text-sm">{k('select_subject')}</Text>
        )}

        {course ? (
          <Level title={k('period')} count={k('one_period')}>
            <Row label={`${course.subject_name} - ${teacher(course)}`} trailing={`${k('seats')}: —`} selected={periodId === course.subject_id} onPress={() => setPeriodId(course.subject_id)} />
          </Level>
        ) : null}
      </ScrollView>
    </>
  );
}

function Detail({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <View>
      <Text className="text-muted-foreground mb-1 text-xs font-semibold uppercase">{label}</Text>
      <Text className={cn('font-medium', valueClass)}>{value}</Text>
    </View>
  );
}

function Level({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <View className="border-border bg-background overflow-hidden rounded-md border">
      <Text className="text-muted-foreground border-border border-b px-3 py-2 text-xs">{count}</Text>
      <Text className="border-border border-b px-3 py-2 text-xs font-semibold text-teal-700 uppercase">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, trailing, selected, onPress }: { label: string; trailing?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} className={cn('border-border flex-row items-center gap-2 border-b px-3 py-3', selected && 'bg-primary/10')}>
      <Text className={cn('text-primary flex-1', selected && 'font-medium')}>{label}</Text>
      {trailing ? <Text className="text-xs font-medium text-amber-600">{trailing}</Text> : null}
      <Icon as={ChevronRight} className="text-muted-foreground size-4 rtl:rotate-180" />
    </Pressable>
  );
}
