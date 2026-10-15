import { htmlToText } from '@studently/shared-utils';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChildAssignments } from '@/features/parent/assignments';
import { useChild } from '@/features/parent/child';
import { longDate, teacherOf } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';

/** One of the child's assignments with the student's submission, read-only (web: /parent/grades/student-assignments/[id]). */
export default function ParentAssignmentDetail() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ad_${key}`, o);
  const p = (key: string, o?: Record<string, unknown>) => t(`app.pa_as_${key}`, o);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { child, childId } = useChild();
  const q = useChildAssignments(childId);

  if (q.isLoading) return <LoadingList rows={6} />;
  if (q.error) return <PortalError title={t('app.st_as_error', { message: q.error.message })} />;
  const a = q.all.find((x) => x.id === id);
  if (!a) return <Text className="text-muted-foreground p-6 text-sm">{k('not_found')}</Text>;
  const sub = a.submission;
  const graded = sub?.status === 'graded';
  const rows: [string, string][] = [
    [t('app.st_as_due'), longDate(a.due_date)],
    [t('app.st_as_assigned'), longDate(a.assigned_date)],
    [t('app.st_as_course'), a.subject?.name || '—'],
    [t('app.st_as_teacher'), teacherOf(a)],
    [k('title_label'), a.title],
    [k('category'), a.assignment_type?.title || '—'],
    [k('points'), String(a.max_score)],
  ];

  return (
    <>
      <Stack.Screen options={{ title: a.title }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        {child ? <Text className="text-muted-foreground text-sm">{p('viewing_for', { name: `${child.first_name} ${child.last_name}` })}</Text> : null}
        <View className="border-border bg-card rounded border">
          {rows.map(([label, value]) => (
            <View key={label} className="border-border flex-row gap-3 border-b px-4 py-2.5">
              <Text className="text-muted-foreground w-28 text-sm">{label}</Text>
              <Text className="flex-1 text-sm font-medium">{value}</Text>
            </View>
          ))}
          <View className="flex-row gap-3 px-4 py-2.5">
            <Text className="text-muted-foreground w-28 text-sm">{k('status')}</Text>
            {graded ? (
              <Text className="flex-1 text-sm font-medium text-green-600">{k('graded', { marks: sub?.marks_obtained ?? 0, max: a.max_score })}</Text>
            ) : sub ? (
              <View className="flex-1 flex-row items-center gap-1">
                <Icon as={Check} className="size-4 text-blue-600" />
                <Text className="text-sm font-medium text-blue-600">{t('app.st_as_submitted')}</Text>
              </View>
            ) : (
              <Text className="flex-1 text-sm font-medium text-orange-600">{k('pending')}</Text>
            )}
          </View>
        </View>

        {a.description ? <Text className="text-sm">{htmlToText(a.description)}</Text> : null}
        {a.file_url ? (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(a.file_url as string)} className="flex-row items-center gap-2" accessibilityRole="link">
            <Icon as={FileText} className="size-4 text-[#4A90E2]" />
            <Text className="text-sm text-[#4A90E2]">{k('download')}</Text>
          </Pressable>
        ) : null}
        {graded && sub?.feedback ? (
          <View className="rounded-md bg-green-50 p-3 dark:bg-green-950/30">
            <Text className="text-muted-foreground mb-1 text-xs font-medium uppercase">{k('feedback')}</Text>
            <Text className="text-sm italic">{`"${sub.feedback}"`}</Text>
          </View>
        ) : null}

        {sub ? (
          <View className="bg-muted/50 gap-3 rounded-md p-4">
            <Text className="border-border border-b pb-2 text-sm font-semibold">{p('submission')}</Text>
            {sub.attachments?.length ? (
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs font-medium uppercase">{p('attached_files')}</Text>
                {sub.attachments.map((att, i) => (
                  <Pressable key={`${att.url}:${i}`} onPress={() => WebBrowser.openBrowserAsync(att.url)} className="flex-row items-center gap-2" accessibilityRole="link">
                    <Icon as={FileText} className="size-3 text-[#4A90E2]" />
                    <Text className="text-xs text-[#4A90E2]">{att.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {sub.submission_text ? (
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs font-medium uppercase">{p('answer')}</Text>
                <View className="border-border bg-card rounded border p-3">
                  <Text className="text-sm">{htmlToText(sub.submission_text)}</Text>
                </View>
              </View>
            ) : null}
            {!sub.attachments?.length && !sub.submission_text ? <Text className="text-muted-foreground text-sm italic">{p('nothing')}</Text> : null}
            <Text className="text-muted-foreground text-xs">{p('submitted_on', { date: longDate(sub.submitted_at) })}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
