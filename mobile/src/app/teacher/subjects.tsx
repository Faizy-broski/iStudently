import type { TeacherSubjectAssignment } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { BookOpen, FileText, Layers, NotebookPen, Star, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, RowPill, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
        <Text variant="muted" className="text-sm">
          {k('pageSubtitle')}
        </Text>
        <StatTiles>
          <StatTile icon={BookOpen} label={k('totalSubjects')} value={String(groups.size)} />
          <StatTile icon={Layers} tone="success" label={k('totalSections')} value={String(list.length)} />
          <StatTile icon={Star} tone="warning" label={k('activeAssignments')} value={String(list.filter((a) => a.is_primary).length)} />
        </StatTiles>
        {!groups.size ? (
          <EmptyState icon={BookOpen} title={k('noSubjectsTitle')} body={k('noSubjectsDescription')} />
        ) : (
          [...groups.entries()].map(([id, sections]) => {
            const subject = sections[0]?.subject;
            return (
              <Panel key={id} className="overflow-hidden">
                <View className="border-info-soft dark:border-border gap-3 border-b p-4">
                  <View className="flex-row items-center gap-3">
                    <IconTile icon={BookOpen} size={44} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-brand dark:text-foreground text-base font-bold">{subject?.name || k('unknownSubject')}</Text>
                      {subject?.code ? (
                        <Text variant="muted" className="text-xs">
                          {k('codeLabel', { code: subject.code })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <RowPill icon={NotebookPen} label={k('syllabus')} onPress={() => router.push('/teacher/lesson-plan-read')} />
                    <RowPill icon={FileText} label={k('resources')} onPress={() => router.push('/teacher/resources')} />
                  </View>
                </View>
                <View className="gap-2 p-4">
                  <Text className="text-sm font-semibold">{k('teachingSections', { count: sections.length })}</Text>
                  {sections.map((a) => (
                    <View key={a.id} className={cn('gap-2 rounded-xl border p-3', a.is_primary ? 'border-brand-secondary bg-info-soft' : 'border-info-soft dark:border-border')}>
                      <View className="flex-row items-center gap-2">
                        <View className="flex-1">
                          <Text className="text-sm font-semibold">{a.section?.name || k('unknownSection')}</Text>
                          <Text variant="muted" className="text-[11px]">
                            {a.section?.grade_level?.name || k('unknownGrade')}
                          </Text>
                        </View>
                        {a.is_primary ? <StatusChip label={k('primary')} tone="info" className="bg-card" /> : null}
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        <RowPill icon={NotebookPen} label={k('lessonPlan')} onPress={() => router.push('/teacher/lesson-plans')} />
                        <RowPill icon={Users} label={k('students')} onPress={() => router.push('/teacher/students')} />
                      </View>
                    </View>
                  ))}
                </View>
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
