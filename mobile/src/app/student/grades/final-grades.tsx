import { Stack } from 'expo-router';
import { Award, BookOpen, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={Award} className="size-5" />
            <CardTitle>{k('by_subject')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-2">
            {list.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={BookOpen} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('empty')}</Text>
              </View>
            ) : (
              list.map((s) => {
                const tone = gradeTone(s.percentage);
                const isOpen = open === s.subject_id;
                return (
                  <View key={s.subject_id} className="gap-1">
                    <Pressable onPress={() => setOpen(isOpen ? null : s.subject_id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} className="border-border bg-card flex-row items-center gap-3 rounded-lg border p-3">
                      <View className="bg-primary/10 rounded-lg p-2">
                        <Icon as={BookOpen} className="text-primary size-4" />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="font-semibold">{s.subject_name}</Text>
                          <Badge variant="outline">
                            <Text className="text-xs">{s.subject_code}</Text>
                          </Badge>
                        </View>
                        <Text className="text-muted-foreground mt-0.5 text-xs">{k('exams', { count: s.exams.length })}</Text>
                        <Bar value={s.percentage} tone={tone.bar} className="mt-2" />
                      </View>
                      <View className="items-end gap-1">
                        <Text className={cn('text-2xl font-bold', tone.text)}>{`${s.percentage}%`}</Text>
                        <Badge variant="outline">
                          <Text className={cn('text-base font-bold', tone.text)}>{s.grade}</Text>
                        </Badge>
                      </View>
                      <Icon as={isOpen ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
                    </Pressable>
                    {isOpen ? (
                      <View className="bg-muted/50 border-border ms-4 gap-2 rounded-lg border p-3">
                        <Text className="text-sm font-semibold">{k('breakdown')}</Text>
                        {s.exams.map((e, i) => (
                          <View key={i} className="border-border flex-row items-center gap-2 border-t pt-2">
                            <View className="flex-1">
                              <Text className="text-sm font-medium">{e.exam_name}</Text>
                              <View className="mt-0.5 flex-row items-center gap-2">
                                <Badge variant="outline">
                                  <Text className="text-xs">{e.exam_type}</Text>
                                </Badge>
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
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
