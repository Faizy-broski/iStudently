import { htmlToText } from '@studently/shared-utils';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, ClipboardList, FileText } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { DetailHeader, Section } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
  if (!a) return <EmptyState icon={ClipboardList} title={k('not_found')} />;
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
        <DetailHeader
          icon={ClipboardList}
          name={a.title}
          subtitle={child ? p('viewing_for', { name: `${child.first_name} ${child.last_name}` }) : null}
          chips={
            graded ? (
              <StatusChip label={k('graded', { marks: sub?.marks_obtained ?? 0, max: a.max_score })} tone="success" />
            ) : sub ? (
              <StatusChip label={t('app.st_as_submitted')} tone="info" />
            ) : (
              <StatusChip label={k('pending')} tone="warning" />
            )
          }
        />
        <Panel>
          {rows.map(([label, value]) => (
            <View key={label} className="border-info-soft dark:border-border flex-row gap-3 border-b px-4 py-2.5">
              <Text className="text-muted-foreground w-28 text-xs">{label}</Text>
              <Text className="flex-1 text-sm font-medium">{value}</Text>
            </View>
          ))}
          <View className="flex-row items-center gap-3 px-4 py-2.5">
            <Text className="text-muted-foreground w-28 text-xs">{k('status')}</Text>
            {graded ? (
              <Text className="flex-1 text-sm font-medium text-success">{k('graded', { marks: sub?.marks_obtained ?? 0, max: a.max_score })}</Text>
            ) : sub ? (
              <View className="flex-1 flex-row items-center gap-1">
                <Icon as={Check} className="size-4 text-brand dark:text-brand-secondary" />
                <Text className="text-sm font-medium text-brand dark:text-brand-secondary">{t('app.st_as_submitted')}</Text>
              </View>
            ) : (
              <Text className="flex-1 text-sm font-medium text-warning">{k('pending')}</Text>
            )}
          </View>
        </Panel>

        {a.description ? (
          <Panel className="p-4">
            <Text className="text-sm leading-relaxed">{htmlToText(a.description)}</Text>
          </Panel>
        ) : null}
        {a.file_url ? (
          <Panel>
            <ActionRow icon={FileText} title={k('download')} onPress={() => WebBrowser.openBrowserAsync(a.file_url as string)} last />
          </Panel>
        ) : null}
        {graded && sub?.feedback ? (
          <View className="bg-success-soft gap-1 rounded-2xl p-4">
            <Text className="text-success text-xs font-semibold">{k('feedback')}</Text>
            <Text className="text-sm italic">{`"${sub.feedback}"`}</Text>
          </View>
        ) : null}

        {sub ? (
          <Section title={p('submission')}>
            <Panel className="gap-3 p-4">
              {sub.attachments?.length ? (
                <View className="gap-2">
                  <Text className="text-muted-foreground text-xs font-semibold">{p('attached_files')}</Text>
                  {sub.attachments.map((att, i) => (
                    <Pressable key={`${att.url}:${i}`} onPress={() => WebBrowser.openBrowserAsync(att.url)} className="bg-info-soft flex-row items-center gap-2 rounded-xl px-3 py-2 active:opacity-70" accessibilityRole="link">
                      <Icon as={FileText} className="size-4 text-brand dark:text-brand-secondary" />
                      <Text className="flex-1 text-xs font-medium text-brand dark:text-brand-secondary" numberOfLines={1}>
                        {att.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {sub.submission_text ? (
                <View className="gap-1">
                  <Text className="text-muted-foreground text-xs font-semibold">{p('answer')}</Text>
                  <View className="bg-muted rounded-xl p-3">
                    <Text className="text-sm">{htmlToText(sub.submission_text)}</Text>
                  </View>
                </View>
              ) : null}
              {!sub.attachments?.length && !sub.submission_text ? <Text className="text-muted-foreground text-sm italic">{p('nothing')}</Text> : null}
              <Text className="text-muted-foreground text-xs">{p('submitted_on', { date: longDate(sub.submitted_at) })}</Text>
            </Panel>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
