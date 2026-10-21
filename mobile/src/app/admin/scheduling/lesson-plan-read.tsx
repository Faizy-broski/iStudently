import { htmlToText } from '@studently/shared-utils';
import type { LessonPlan } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Clock, Download, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { lessonCpLabel, lessonDate, lessonTeacherName, monthRange, weekRange } from '@/features/admin/lesson-plans';
import { ymd } from '@/components/app/date-field';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

type Mode = 'all' | 'day' | 'week' | 'month';

function Section({ title, html }: { title: string; html?: string | null }) {
  if (!html) return null;
  return (
    <View className="gap-1">
      <Text className="text-sm font-semibold">{title}</Text>
      <Text className="text-sm">{htmlToText(html)}</Text>
    </View>
  );
}

function LessonCard({ lesson, open, onToggle }: { lesson: LessonPlan; open: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.lesson_plan_read.${k}`, o);
  const items = lesson.items ?? [];
  const files = lesson.files ?? [];
  return (
    <Card>
      <CardContent className="gap-3 py-3">
        <Pressable onPress={onToggle} className="gap-1">
          <Text className="text-lg font-semibold">{lesson.title}</Text>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <View className="flex-row items-center gap-1">
              <Icon as={Calendar} className="text-muted-foreground size-3.5" />
              <Text className="text-muted-foreground text-xs">{lessonDate(lesson.on_date, i18n.language)}</Text>
            </View>
            {lesson.length_minutes ? (
              <View className="flex-row items-center gap-1">
                <Icon as={Clock} className="text-muted-foreground size-3.5" />
                <Text className="text-muted-foreground text-xs">{r('label_min', { count: lesson.length_minutes })}</Text>
              </View>
            ) : null}
            <Text className="text-muted-foreground text-xs">{r('label_teacher', { name: lessonTeacherName(lesson.course_period, lesson) })}</Text>
            <Text className="text-muted-foreground text-xs">{r('label_lesson_num', { num: lesson.lesson_number })}</Text>
          </View>
          <View className="flex-row gap-1">
            {files.length ? (
              <Badge variant="secondary">
                <Icon as={FileText} className="size-3" />
                <Text className="text-xs">{r('label_files', { count: files.length })}</Text>
              </Badge>
            ) : null}
            <Badge variant="outline">
              <Text className="text-xs">{r('label_parts', { count: items.length })}</Text>
            </Badge>
          </View>
        </Pressable>
        {open ? (
          <View className="gap-3">
            <Separator />
            <Section title={r('h_objectives')} html={lesson.learning_objectives} />
            {items.length ? (
              <View className="gap-2">
                <Text className="text-sm font-semibold">{r('h_parts')}</Text>
                {items.map((it) => (
                  <View key={it.id} className="border-info-soft dark:border-border gap-2 rounded-xl border p-2.5">
                    <Text className="text-muted-foreground text-xs">
                      {r('th_time')}: {it.time_minutes ? r('label_min', { count: it.time_minutes }) : '—'}
                    </Text>
                    <Section title={r('th_content')} html={it.teacher_activity} />
                    <Section title={r('th_learner')} html={it.learner_activity} />
                    <Section title={r('th_assessment')} html={it.formative_assessment} />
                    <Section title={r('th_materials')} html={it.learning_materials} />
                  </View>
                ))}
              </View>
            ) : null}
            <Section title={r('h_evaluation')} html={lesson.evaluation} />
            <Section title={r('h_inclusiveness')} html={lesson.inclusiveness} />
            {files.length ? (
              <View className="gap-1.5">
                <Text className="text-sm font-semibold">{r('h_attachments')}</Text>
                {files.map((f) => (
                  <Pressable key={f.id} onPress={() => openBrowserAsync(f.file_url)} className="border-info-soft dark:border-border flex-row items-center gap-2 rounded-xl border p-2.5">
                    <Icon as={Download} className="text-muted-foreground size-4" />
                    <Text className="text-primary flex-1 text-sm">{f.file_name}</Text>
                    {f.file_size ? <Text className="text-muted-foreground text-xs">{(f.file_size / 1024).toFixed(1)} KB</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** One course period's lesson plans by day, week, month or all (web: /admin/scheduling/lesson-plan-read). */
export default function LessonPlanRead() {
  const { t, i18n } = useTranslation();
  const r = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.lesson_plan_read.${k}`, o);
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const portal = usePortalAcademicOptional();
  const yearId = (portal ? portal.year?.id : years.current?.id) ?? '';
  const params = useLocalSearchParams<{ cp?: string }>();
  const [cpId, setCpId] = useState(params.cp ?? '');
  const [mode, setMode] = useState<Mode>('all');
  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState<string | null>(null);
  const summary = useApi(params.cp ? null : ['admin', 'lesson-plan-summary', campusId ?? 'school', yearId], ([, , , y]) => adminScheduling.lessonPlanSummary({ campus_id: campusId, academic_year_id: (y as string) || undefined }));

  const filters = mode === 'all' ? {} : mode === 'day' ? { on_date: ymd(date) } : mode === 'week' ? weekRange(date) : monthRange(date);
  const res = useApi(cpId ? ['admin', 'lesson-plan-read', cpId, yearId, campusId ?? 'school', mode, JSON.stringify(filters)] : null, ([, , cp, y, , , f]) =>
    adminScheduling.lessonPlans({ course_period_id: cp as string, academic_year_id: (y as string) || undefined, campus_id: campusId, limit: 100, ...JSON.parse(f as string) }),
  );
  const lessons = res.data ?? [];

  const move = (dir: -1 | 1) => {
    const d = new Date(date);
    if (mode === 'day') d.setDate(d.getDate() + dir);
    else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setDate(d);
  };
  const label =
    mode === 'day'
      ? lessonDate(ymd(date), i18n.language)
      : mode === 'week'
        ? `${lessonDate(weekRange(date).date_from, i18n.language)} — ${lessonDate(weekRange(date).date_to, i18n.language)}`
        : date.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: lessons[0] ? lessonCpLabel(lessons[0].course_period, '—') : t('school.scheduling.lesson_plans.title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {!params.cp ? (
          <Picker
            value={cpId}
            onChange={setCpId}
            placeholder={t('common.course_period')}
            options={(summary.data ?? []).map((x) => ({ value: x.course_period_id, label: lessonCpLabel(x.course_period, '—') }))}
          />
        ) : null}
        {!cpId ? (
          <View className="items-center gap-2 py-10">
            <Icon as={BookOpen} className="text-muted-foreground size-10 opacity-40" />
            <EmptyState title={r('msg_no_course')} />
          </View>
        ) : (
          <>
            <FilterChips
              value={mode}
              onChange={setMode}
              options={(['all', 'day', 'week', 'month'] as const).map((m) => ({ value: m, label: r(`timeframe_${m}`) }))}
            />
            {mode !== 'all' ? (
              <View className="flex-row items-center gap-2">
                <Button size="icon" variant="outline" onPress={() => move(-1)} accessibilityLabel={t('common.previous')}>
                  <Icon flipRtl as={ChevronLeft} className="text-foreground size-4" />
                </Button>
                <Text className="flex-1 text-center text-sm font-medium">{label}</Text>
                <Button size="icon" variant="outline" onPress={() => move(1)} accessibilityLabel={t('common.next')}>
                  <Icon flipRtl as={ChevronRight} className="text-foreground size-4" />
                </Button>
              </View>
            ) : (
              <Text className="text-muted-foreground text-sm">{r('all_entries')}</Text>
            )}
            <Text className="text-muted-foreground text-sm">{r('lessons_found', { count: lessons.length })}</Text>
            {res.isLoading ? (
              <LoadingList rows={3} />
            ) : res.error ? (
              <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
            ) : !lessons.length ? (
              <View className="items-center gap-2 py-10">
                <Icon as={Calendar} className="text-muted-foreground size-10 opacity-40" />
                <Text className="text-lg font-medium">{r('no_lessons_found')}</Text>
                <Text className="text-muted-foreground text-center text-sm">{mode !== 'all' ? r('no_lessons_tip_timeframe') : r('no_lessons_tip_none')}</Text>
              </View>
            ) : (
              lessons.map((x) => <LessonCard key={x.id} lesson={x} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} />)
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
