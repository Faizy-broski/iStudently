import { Stack } from 'expo-router';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Bar, gradeTone, PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Exam-based result per subject; tap for the exam breakdown (web: /student/grades/final-grades). */
export default function StudentFinalGrades() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_fg_${key}`, o);
  const data = useApi(['student', 'final-grades'], () => student.getStudentFinalGrades());
  const [open, setOpen] = useState<string | null>(null);

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const list = data.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <Section title={k('by_subject')}>
          {list.length === 0 ? (
            <EmptyState icon={BookOpen} title={k('empty')} />
          ) : (
            <Panel>
              {list.map((s, idx) => {
                const tone = gradeTone(s.percentage);
                const isOpen = open === s.subject_id;
                return (
                  <View key={s.subject_id} className={cn(idx < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <Pressable onPress={() => setOpen(isOpen ? null : s.subject_id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} className="flex-row items-center gap-3 px-4 py-3 active:opacity-70">
                      <IconTile icon={BookOpen} size={40} />
                      <View className="flex-1 gap-0.5">
                        <View className="flex-row flex-wrap items-center gap-1.5">
                          <Text className="text-sm font-semibold">{s.subject_name}</Text>
                          <StatusChip label={s.subject_code} tone="muted" className="px-2 py-0.5" />
                        </View>
                        <Text className="text-muted-foreground text-xs">{k('exams', { count: s.exams.length })}</Text>
                        <Bar value={s.percentage} tone={tone.bar} className="mt-1.5" />
                      </View>
                      <View className="items-end gap-1">
                        <Text className={cn('text-xl font-bold', tone.text)}>{`${s.percentage}%`}</Text>
                        <View className="bg-muted rounded-full px-2.5 py-0.5">
                          <Text className={cn('text-sm font-bold', tone.text)}>{s.grade}</Text>
                        </View>
                      </View>
                      <Icon as={isOpen ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
                    </Pressable>
                    {isOpen ? (
                      <View className="bg-muted/50 mx-4 mb-3 gap-2 rounded-xl p-3">
                        <Text className="text-sm font-semibold">{k('breakdown')}</Text>
                        {s.exams.map((e, i) => (
                          <View key={i} className="border-info-soft dark:border-border flex-row items-center gap-2 border-t pt-2">
                            <View className="flex-1">
                              <Text className="text-sm font-medium">{e.exam_name}</Text>
                              <View className="mt-0.5 flex-row items-center gap-2">
                                <StatusChip label={e.exam_type} tone="info" className="px-2 py-0.5" />
                                <Text className="text-muted-foreground text-xs">{e.exam_date ? formatDate(e.exam_date) : '—'}</Text>
                              </View>
                            </View>
                            <Text className="text-sm font-semibold">{`${e.marks_obtained} / ${e.max_marks}`}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
