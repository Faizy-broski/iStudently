import { Stack } from 'expo-router';
import { BookOpen, CircleCheck, Hash, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Initials, Section } from '@/components/app/layout';
import { InfoRow, Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
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
        <Text variant="muted" className="text-sm">{`${child.first_name} ${child.last_name}`}</Text>
        {course ? (
          <Panel>
            <View className="flex-row items-center gap-3 p-4 pb-2">
              <IconTile icon={BookOpen} size={44} />
              <Text className="text-brand dark:text-foreground flex-1 text-lg font-bold">{course.subject_name}</Text>
            </View>
            <InfoRow icon={BookOpen} label={k('subject')} value={course.subject_name} />
            <InfoRow icon={Hash} label={k('code')} value={course.subject_code || '—'} />
            <InfoRow icon={User} label={k('teacher')} value={course.teacher_name || k('unassigned')} />
            <View className="flex-row items-center gap-3 px-4 py-2.5">
              <View className="bg-info-soft size-8 items-center justify-center rounded-full">
                <Icon as={CircleCheck} className="text-brand dark:text-brand-secondary size-4" />
              </View>
              <View className="flex-1 gap-1">
                <Text variant="muted" className="text-[11px]">
                  {k('status')}
                </Text>
                <View className="flex-row">
                  <StatusChip label={k('enrolled')} tone="success" />
                </View>
              </View>
            </View>
          </Panel>
        ) : (
          <EmptyState icon={BookOpen} title={k('pick')} />
        )}
        <Section title={k('found', { count: list.length })}>
          {courses.isLoading ? (
            <LoadingList rows={4} />
          ) : !list.length ? (
            <EmptyState icon={BookOpen} title={k('none')} />
          ) : (
            <Panel>
              {list.map((c, i) => {
                const on = selected === c.subject_id;
                return (
                  <Pressable
                    key={c.subject_id}
                    onPress={() => setSelected((v) => (v === c.subject_id ? null : c.subject_id))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', i < list.length - 1 && 'border-info-soft dark:border-border border-b', on && 'bg-info-soft')}>
                    <Initials name={c.subject_name} size={36} />
                    <Text className={cn('flex-1 text-sm', on ? 'text-brand dark:text-brand-secondary font-semibold' : 'font-medium')}>{c.subject_name}</Text>
                    {on ? <Icon as={CircleCheck} className="text-brand dark:text-brand-secondary size-4" /> : null}
                  </Pressable>
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
