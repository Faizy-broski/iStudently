import type { LessonPlanSummaryItem } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Eye, NotebookPen, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { IconTile } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
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
          </View>
        }
        renderItem={(x: LessonPlanSummaryItem) => (
          <Pressable className="flex-row items-center gap-3 px-4 py-3 active:opacity-70" onPress={() => router.push({ pathname: '/admin/scheduling/lesson-plan-read', params: { cp: x.course_period_id } })}>
            <IconTile icon={NotebookPen} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold" numberOfLines={2}>
                {lessonCpLabel(x.course_period, '—')}
              </Text>
              <Text variant="muted" className="text-[11px]">
                {lessonTeacherName(x.course_period)}
              </Text>
              <Text variant="muted" className="text-[11px]">
                {l('th_last_entry')}: {x.last_date ? new Date(`${x.last_date}T00:00:00`).toLocaleDateString(locale) : '—'}
              </Text>
            </View>
            <View className="items-end gap-1.5">
              <StatusChip label={`${x.count} ${l('th_entries')}`} tone="info" className="px-2 py-0.5" />
              <View className="flex-row items-center gap-1">
                <Icon as={Eye} className="text-brand dark:text-brand-secondary size-3.5" />
                <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{l('btn_read')}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}
