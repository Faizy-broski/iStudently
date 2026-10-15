import type { LessonPlanSummaryItem } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Eye, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { lessonCpLabel, lessonTeacherName } from '@/features/admin/lesson-plans';
import { useCampus } from '@/features/campus/campus';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Lesson plan entries per course period, with Read and Create (web: /admin/scheduling/lesson-plans). */
export default function LessonPlans() {
  const { t } = useTranslation();
  const l = (k: string) => t(`school.scheduling.lesson_plans.${k}`);
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? '';
  const res = useApi(['admin', 'lesson-plan-summary', campusId ?? 'school', yearId], ([, , , y]) => adminScheduling.lessonPlanSummary({ campus_id: campusId, academic_year_id: (y as string) || undefined }));
  const create = () => router.push('/admin/scheduling/lesson-plan-add');
  return (
    <>
      <Stack.Screen
        options={{
          title: l('title'),
          headerRight: () => (
            <Pressable onPress={create} hitSlop={8} className="p-1" accessibilityLabel={t('school.scheduling.lesson_plan_add.new_lesson_plan')}>
              <Icon as={Plus} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />
      <DataList
        items={res.data}
        error={res.error}
        isLoading={res.isLoading || years.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={l('no_plans_title')}
        emptyBody={l('no_plans_desc')}
        keyExtractor={(x: LessonPlanSummaryItem) => x.course_period_id}
        header={
          <View className="gap-2 px-4 pt-3 pb-1">
            <Text className="text-muted-foreground text-sm">{l('description')}</Text>
            <Button onPress={create}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{t('school.scheduling.lesson_plan_add.new_lesson_plan')}</Text>
            </Button>
          </View>
        }
        renderItem={(x: LessonPlanSummaryItem) => (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">{lessonCpLabel(x.course_period, '—')}</Text>
              <Text className="text-muted-foreground text-xs">
                {l('th_teacher')}: {lessonTeacherName(x.course_period)}
              </Text>
              <Text className="text-muted-foreground text-xs">
                {l('th_entries')}: {x.count} · {l('th_last_entry')}: {x.last_date ? new Date(`${x.last_date}T00:00:00`).toLocaleDateString() : '—'}
              </Text>
            </View>
            <Button size="sm" variant="outline" onPress={() => router.push({ pathname: '/admin/scheduling/lesson-plan-read', params: { cp: x.course_period_id } })}>
              <Icon as={Eye} className="text-foreground size-4" />
              <Text>{l('btn_read')}</Text>
            </Button>
          </View>
        )}
      />
    </>
  );
}
