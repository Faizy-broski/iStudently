import { htmlToText } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, Calendar, ChevronDown, ChevronRight, Clock, FileText } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { StudentLessonPlansData } from '@studently/api-client';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

function Rich({ html }: { html?: string }) {
  if (!html) return <Text className="text-muted-foreground text-sm italic">—</Text>;
  return <Text className="text-sm">{htmlToText(html)}</Text>;
}

type Load = (coursePeriodId?: string) => Promise<{ success: boolean; data?: StudentLessonPlansData; error?: string }>;

/**
 * Published lesson plans of a student's course periods, filterable by course period (web: /student and
 * /parent scheduling/lesson-plan-read). `scope` keys the cache per student.
 */
export function LessonPlanRead({ scope, load, subtitle }: { scope: string; load: Load; subtitle: string }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_lp_${key}`, o);
  const [cp, setCp] = useState('all');
  const data = useApi(['portal', 'lesson-plans', scope, cp], ([, , , c]) => load(c === 'all' ? undefined : (c as string)));
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggle = (id: string) => setExpanded((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));

  if (data.isLoading && !data.data) return <LoadingList rows={5} />;
  if (data.error) {
    return (
      <View className="bg-background flex-1">
        <ErrorState message={`${k('error')}: ${data.error.message}`} onRetry={() => data.mutate()} />
      </View>
    );
  }
  const cps = data.data?.course_periods ?? [];
  const lessons = data.data?.lessons ?? [];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {subtitle}
        </Text>
        <FilterChips value={cp} onChange={setCp} options={[{ value: 'all', label: k('all') }, ...cps.map((c) => ({ value: c.id, label: c.title || c.course_title || '' }))]} />
        <Text className="text-muted-foreground text-xs">{k('count', { count: lessons.length })}</Text>
        {lessons.length === 0 ? (
          <EmptyState icon={BookOpen} title={k('empty')} body={cps.length === 0 ? k('not_enrolled') : k('none_published')} />
        ) : (
          lessons.map((l) => {
            const open = expanded.includes(l.id);
            const c = l.course_period;
            return (
              <Panel key={l.id} className="overflow-hidden">
                <Pressable onPress={() => toggle(l.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="flex-row items-center gap-3 p-4 active:opacity-70">
                  <Icon flipRtl as={open ? ChevronDown : ChevronRight} className="text-muted-foreground size-4" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{l.title}</Text>
                    <View className="mt-1 flex-row flex-wrap items-center gap-2">
                      {c ? <StatusChip label={c.title || c.course_title || ''} tone="muted" /> : null}
                      {l.on_date ? (
                        <View className="flex-row items-center gap-1">
                          <Icon as={Calendar} className="text-muted-foreground size-3" />
                          <Text className="text-muted-foreground text-xs">{formatDate(l.on_date)}</Text>
                        </View>
                      ) : null}
                      {l.length_minutes ? (
                        <View className="flex-row items-center gap-1">
                          <Icon as={Clock} className="text-muted-foreground size-3" />
                          <Text className="text-muted-foreground text-xs">{k('min', { count: l.length_minutes })}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <StatusChip label={k('lesson', { n: l.lesson_number })} tone="info" />
                </Pressable>
                {open ? (
                  <View className="border-info-soft dark:border-border bg-muted/20 gap-4 border-t px-4 py-4">
                    {l.learning_objectives ? (
                      <View>
                        <Heading label={k('objectives')} />
                        <Rich html={l.learning_objectives} />
                      </View>
                    ) : null}
                    {l.items.length ? (
                      <View className="gap-2">
                        <Heading label={k('activities')} />
                        {l.items.map((it, i) => (
                          <View key={it.id} className="border-info-soft dark:border-border bg-card gap-2 rounded-xl border p-3">
                            <View className="flex-row items-center gap-2">
                              <StatusChip label={k('step', { n: i + 1 })} tone="info" />
                              {it.time_minutes ? (
                                <View className="flex-row items-center gap-1">
                                  <Icon as={Clock} className="text-muted-foreground size-3" />
                                  <Text className="text-muted-foreground text-xs">{k('min', { count: it.time_minutes })}</Text>
                                </View>
                              ) : null}
                            </View>
                            {it.learner_activity ? (
                              <View>
                                <Text className="text-muted-foreground text-xs font-medium">{k('learner')}</Text>
                                <Rich html={it.learner_activity} />
                              </View>
                            ) : null}
                            {it.learning_materials ? (
                              <View>
                                <Text className="text-muted-foreground text-xs font-medium">{k('materials')}</Text>
                                <Rich html={it.learning_materials} />
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {l.files.length ? (
                      <View className="gap-2">
                        <Heading label={k('attachments')} />
                        <View className="flex-row flex-wrap gap-2">
                          {l.files.map((f) => (
                            <Pressable key={f.id} onPress={() => WebBrowser.openBrowserAsync(f.file_url)} accessibilityRole="link" className="bg-info-soft flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70">
                              <Icon as={FileText} className="text-brand dark:text-brand-secondary size-3.5" />
                              <Text className="text-brand dark:text-brand-secondary text-sm font-medium">{f.file_name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {l.evaluation ? (
                      <View>
                        <Heading label={k('evaluation')} />
                        <Rich html={l.evaluation} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

function Heading({ label }: { label: string }) {
  return <Text className="text-muted-foreground mb-1 text-sm font-semibold">{label}</Text>;
}
