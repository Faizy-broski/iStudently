import type { TeacherSubjectAssignment } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, Layers, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PortalError } from '@/features/portal/ui';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/**
 * Subjects the teacher teaches, with their sections (web: /teacher/subjects). The web buttons are
 * placeholders ("coming soon"); here they open the lesson plans, learning resources and students pages.
 */
export default function TeacherSubjects() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.subjects.${key}`, o);
  const res = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  if (res.isLoading) return <LoadingList rows={4} />;
  if (res.error) return <PortalError title={k('loadError')} message={res.error.message} />;
  const list = res.data ?? [];
  const groups = new Map<string, TeacherSubjectAssignment[]>();
  for (const a of list) groups.set(a.subject_id, [...(groups.get(a.subject_id) ?? []), a]);

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <View className="flex-row gap-2">
          <Stat icon={BookOpen} tone="bg-blue-100 text-blue-600" label={k('totalSubjects')} value={groups.size} />
          <Stat icon={Layers} tone="bg-green-100 text-green-600" label={k('totalSections')} value={list.length} />
          <Stat icon={Star} tone="bg-purple-100 text-purple-600" label={k('activeAssignments')} value={list.filter((a) => a.is_primary).length} />
        </View>
        {!groups.size ? (
          <Card>
            <CardContent className="items-center py-12">
              <Text className="mb-2 text-xl font-semibold">{k('noSubjectsTitle')}</Text>
              <Text className="text-muted-foreground text-center">{k('noSubjectsDescription')}</Text>
            </CardContent>
          </Card>
        ) : (
          [...groups.entries()].map(([id, sections]) => {
            const subject = sections[0]?.subject;
            return (
              <Card key={id} className="overflow-hidden py-0">
                <View className="border-border gap-2 border-b bg-blue-50 p-4 dark:bg-blue-950/20">
                  <Text className="text-lg font-bold text-[#022172] dark:text-white">{subject?.name || k('unknownSubject')}</Text>
                  {subject?.code ? <Text className="text-muted-foreground text-sm">{k('codeLabel', { code: subject.code })}</Text> : null}
                  <View className="flex-row gap-2">
                    <Button variant="outline" size="sm" onPress={() => router.push('/teacher/lesson-plan-read')}>
                      <Text>{k('syllabus')}</Text>
                    </Button>
                    <Button variant="outline" size="sm" onPress={() => router.push('/teacher/resources')}>
                      <Text>{k('resources')}</Text>
                    </Button>
                  </View>
                </View>
                <CardContent className="gap-3 p-4">
                  <Text className="font-semibold">{k('teachingSections', { count: sections.length })}</Text>
                  {sections.map((a) => (
                    <View key={a.id} className={cn('gap-2 rounded-lg border-2 p-3', a.is_primary ? 'border-blue-500' : 'border-border')}>
                      <View className="flex-row items-center justify-between">
                        <Text className="font-semibold">{a.section?.name || k('unknownSection')}</Text>
                        {a.is_primary ? (
                          <View className="rounded-full bg-blue-100 px-2 py-0.5">
                            <Text className="text-xs font-medium text-blue-700">{k('primary')}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text className="text-muted-foreground text-sm">{a.section?.grade_level?.name || k('unknownGrade')}</Text>
                      <View className="flex-row gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push('/teacher/lesson-plans')}>
                          <Text>{k('lessonPlan')}</Text>
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push('/teacher/students')}>
                          <Text>{k('students')}</Text>
                        </Button>
                      </View>
                    </View>
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

function Stat({ icon, tone, label, value }: { icon: typeof BookOpen; tone: string; label: string; value: number }) {
  const [bg, fg] = tone.split(' ');
  return (
    <Card className="flex-1">
      <CardContent className="items-center gap-1 p-3">
        <View className={cn('rounded-lg p-2', bg)}>
          <Icon as={icon} className={cn('size-5', fg)} />
        </View>
        <Text className="text-xl font-bold">{String(value)}</Text>
        <Text className="text-muted-foreground text-center text-[10px]">{label}</Text>
      </CardContent>
    </Card>
  );
}
