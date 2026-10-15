import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** The selected child's enrolled subjects; tap one for its code, teacher and status (web: /parent/scheduling/courses). */
export default function ParentCourses() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_co_${key}`, o);
  const { child, childId } = useChild();
  const courses = useApi(childId ? ['parent', 'student-courses', childId] : null, ([, , id]) => parent.getStudentCourses(id as string));
  const [selected, setSelected] = useState<string | null>(null);

  if (!child) return <NoChild />;
  const list = courses.data ?? [];
  const course = list.find((c) => c.subject_id === selected) ?? null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => courses.mutate()} />}>
        <Text variant="muted">{`${child.first_name} ${child.last_name}`}</Text>
        {course ? (
          <Card>
            <CardContent className="gap-3 p-4">
              <Text className="text-primary text-lg font-semibold">{course.subject_name}</Text>
              <View className="flex-row flex-wrap gap-y-3">
                <Field label={k('subject')} value={course.subject_name} />
                <Field label={k('code')} value={course.subject_code || '—'} />
                <Field label={k('teacher')} value={course.teacher_name || k('unassigned')} />
                <View className="w-1/2">
                  <Text className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">{k('status')}</Text>
                  <View className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 dark:bg-emerald-950/30">
                    <Text className="text-xs font-medium text-emerald-600">{k('enrolled')}</Text>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Text className="text-muted-foreground text-center text-sm">{k('pick')}</Text>
        )}
        <Card>
          <CardContent className="px-0 py-0">
            <Text className="text-muted-foreground border-border border-b px-4 py-2 text-xs">{k('found', { count: list.length })}</Text>
            {courses.isLoading ? (
              <LoadingList rows={4} />
            ) : !list.length ? (
              <Text className="text-muted-foreground py-6 text-center text-xs">{k('none')}</Text>
            ) : (
              list.map((c) => (
                <Pressable
                  key={c.subject_id}
                  onPress={() => setSelected((v) => (v === c.subject_id ? null : c.subject_id))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected === c.subject_id }}
                  className={cn('border-border border-b px-4 py-3 last:border-b-0', selected === c.subject_id && 'bg-primary/10')}>
                  <Text className={cn('text-primary text-sm', selected === c.subject_id && 'font-semibold')}>{c.subject_name}</Text>
                </Pressable>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View className="w-1/2 pe-2">
      <Text className="text-muted-foreground mb-1 text-xs font-semibold tracking-wider uppercase">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}
