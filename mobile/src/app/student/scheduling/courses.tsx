import type { StudentCourse } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, BookOpen, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
        <View className="border-destructive/30 bg-destructive-soft flex-row items-center gap-3 rounded-2xl border p-4">
          <Icon as={AlertCircle} className="text-destructive size-8" />
          <View className="flex-1">
            <Text className="text-destructive font-semibold">{k('error')}</Text>
            <Text className="text-destructive text-sm">{courses.error.message}</Text>
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => courses.mutate()} />}>
        {subject || course || periodId ? (
          <Panel>
            <View className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3">
              <IconTile icon={BookOpen} size={40} />
              <Text className="text-brand dark:text-foreground flex-1 text-base font-bold">{periodId ? `${course?.subject_name} - ${teacher(course)}` : course ? course.subject_name : subject?.subject_name}</Text>
            </View>
            <View className="gap-3 p-4">
              {periodId ? (
                <>
                  <Detail label={k('title_label')} value={`${course?.subject_name} - ${teacher(course)}`} />
                  <Detail label={k('teacher')} value={teacher(course)} />
                  <View className="gap-1">
                    <Text className="text-muted-foreground text-[11px]">{k('status')}</Text>
                    <StatusChip label={k('enrolled')} tone="success" className="self-start" />
                  </View>
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
          </Panel>
        ) : null}

        <Level title={k('subject')} count={k('subjects_found', { count: list.length })}>
          {list.length === 0 ? <Text className="text-muted-foreground px-4 py-4 text-sm">{k('no_subjects')}</Text> : null}
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
          <EmptyState title={k('select_subject')} />
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text className="text-muted-foreground text-[11px]">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}

function Level({ title, count, children }: { title: string; count: string; children: React.ReactNode }) {
  return (
    <Section title={title}>
      <Text className="text-muted-foreground -mt-1 text-xs">{count}</Text>
      <Panel className="overflow-hidden">{children}</Panel>
    </Section>
  );
}

function Row({ label, trailing, selected, onPress }: { label: string; trailing?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn('border-info-soft dark:border-border flex-row items-center gap-2 border-b px-4 py-3 active:opacity-70', selected && 'bg-info-soft')}>
      <Text className={cn('flex-1 text-sm', selected ? 'text-brand dark:text-brand-secondary font-semibold' : 'font-medium')}>{label}</Text>
      {trailing ? <StatusChip label={trailing} tone="warning" className="px-2 py-0.5" /> : null}
      <Icon flipRtl as={ChevronRight} className="text-muted-foreground size-4" />
    </Pressable>
  );
}
