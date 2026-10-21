import { htmlToText } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BookOpen, CalendarDays, Check, Clock, FileText, Image as ImageIcon, Tag, Upload, UserRound, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { HtmlEditorField } from '@/components/app/html-editor-field';
import { InfoRow, Panel } from '@/components/app/panel';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { longDate, teacherOf, useStudentAssignmentList } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';
import { media, student } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { pickDocuments, type PickedDocument } from '@/lib/upload';

const MAX = 10 * 1024 * 1024;

/**
 * One assignment: details, teacher file and feedback, and the submission (files + message),
 * resubmittable until graded (web: /student/assignments/[id]). Files go through the API upload.
 */
export default function StudentAssignmentDetail() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_ad_${key}`, o);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { campusId } = useCampus();
  const q = useStudentAssignmentList();
  const [text, setText] = useState<string | null>(null);
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  // How many of the picked files are uploaded (rows show a spinner, then a check).
  const [uploaded, setUploaded] = useState(0);
  const c = useColors();

  if (q.isLoading) return <LoadingList rows={6} />;
  if (q.error) return <PortalError title={t('app.st_as_error', { message: q.error.message })} />;
  const a = q.all.find((x) => x.id === id);
  if (!a) return <Text className="text-muted-foreground p-6 text-sm">{k('not_found')}</Text>;
  const sub = a.submission;
  const graded = sub?.status === 'graded';
  const submitted = !!sub;
  const message = text ?? sub?.submission_text ?? '';
  const assignmentId = a.id;

  async function choose() {
    const picked = await pickDocuments({ multiple: true });
    const ok = picked.filter((f) => {
      if ((f.size ?? 0) > MAX) {
        toast.error(k('too_big', { name: f.name }));
        return false;
      }
      return true;
    });
    setFiles((x) => [...x, ...ok]);
  }

  async function submit() {
    setBusy(true);
    setUploaded(0);
    try {
      const attachments: { url: string; name: string; uploaded_at: string }[] = [];
      if (files.length) {
        toast.info(k('uploading'));
        for (const f of files) {
          const r = await media.uploadAttachment(f, campusId);
          if (!r.success || !r.data) {
            toast.error(r.error || k('upload_failed'));
            return;
          }
          attachments.push({ url: r.data.url, name: r.data.name || f.name, uploaded_at: new Date().toISOString() });
          setUploaded((n) => n + 1);
        }
      }
      const r = await student.submitAssignment({ assignment_id: assignmentId, submission_text: message, attachments });
      if (!r.success) return toast.error(r.error || k('failed'));
      toast.success(k('success'));
      q.mutate();
      router.back();
    } finally {
      setBusy(false);
    }
  }

  const status = graded ? (
    <StatusChip label={k('graded', { marks: sub?.marks_obtained ?? 0, max: a.max_score })} tone="success" />
  ) : submitted ? (
    <StatusChip label={t('app.st_as_submitted')} tone="info" />
  ) : (
    <StatusChip label={k('pending')} tone="warning" />
  );

  return (
    <>
      <Stack.Screen options={{ title: a.title }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {/* Assignment card: due, points, status, description, teacher file */}
        <Panel className="gap-3 p-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="bg-warning-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
              <Icon as={Clock} className="text-warning size-3" />
              <Text className="text-warning text-[11px] font-semibold">{k('due', { date: longDate(a.due_date) })}</Text>
            </View>
            <StatusChip label={k('pts', { count: a.max_score })} tone="info" />
            {status}
          </View>
          <Text variant="muted" className="text-xs">
            {[teacherOf(a), a.subject?.name].filter(Boolean).join(' · ')}
          </Text>
          {a.description ? <Text className="text-sm leading-5">{htmlToText(a.description)}</Text> : null}
          {a.file_url ? (
            <Pressable onPress={() => WebBrowser.openBrowserAsync(a.file_url as string)} className="bg-info-soft flex-row items-center gap-2 self-start rounded-full px-3 py-1.5" accessibilityRole="link">
              <Icon as={FileText} className="text-brand dark:text-brand-secondary size-4" />
              <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{k('download')}</Text>
            </Pressable>
          ) : null}
        </Panel>

        <Panel>
          <InfoRow icon={CalendarDays} label={t('app.st_as_assigned')} value={longDate(a.assigned_date)} />
          <InfoRow icon={BookOpen} label={t('app.st_as_course')} value={a.subject?.name || '—'} />
          <InfoRow icon={UserRound} label={t('app.st_as_teacher')} value={teacherOf(a)} />
          <InfoRow icon={Tag} label={k('category')} value={a.assignment_type?.title || '—'} last />
        </Panel>

        {graded && sub?.feedback ? (
          <View className="bg-success-soft gap-1 rounded-2xl p-4">
            <Text className="text-success text-xs font-semibold uppercase">{k('feedback')}</Text>
            <Text className="text-sm italic">{`"${sub.feedback}"`}</Text>
          </View>
        ) : null}

        {a.enable_submission && !graded ? (
          <View className="gap-4">
            {/* Upload zone */}
            <Pressable
              onPress={choose}
              disabled={busy}
              className="border-brand-secondary/50 bg-info-soft/60 items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={k('choose')}>
              <View style={raised(c.brand)} className="bg-card size-12 items-center justify-center rounded-full">
                <Icon as={Upload} strokeWidth={2.4} className="text-brand dark:text-brand-secondary size-5" />
              </View>
              <Text className="font-semibold">{k('tap_to_add')}</Text>
              <Text variant="muted" className="text-xs">
                {k('file_hint')}
              </Text>
            </Pressable>

            {files.length || (submitted && sub?.attachments?.length) ? (
              <Panel>
                {files.map((f, i) => {
                  const done = i < uploaded;
                  const active = busy && i === uploaded;
                  return (
                    <View key={`${f.uri}:${i}`} className="border-info-soft dark:border-border flex-row items-center gap-3 border-b px-4 py-3">
                      <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
                        <Icon as={f.type?.startsWith('image') ? ImageIcon : FileText} className="text-brand dark:text-brand-secondary size-4" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-medium" numberOfLines={1}>
                          {f.name}
                        </Text>
                        {f.size ? (
                          <Text variant="muted" className="text-[11px]">
                            {fileSize(f.size)}
                          </Text>
                        ) : null}
                      </View>
                      {active ? (
                        <ActivityIndicator size="small" />
                      ) : done ? (
                        <Icon as={Check} className="text-success size-4" />
                      ) : (
                        <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('remove', { name: f.name })}>
                          <Icon as={X} className="text-muted-foreground size-4" />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {submitted && sub?.attachments?.length ? (
                  <View className="gap-2 px-4 py-3">
                    <Text variant="muted" className="text-xs">
                      {k('previous')}
                    </Text>
                    {sub.attachments.map((att, i) => (
                      <Pressable key={`${att.url}:${i}`} onPress={() => WebBrowser.openBrowserAsync(att.url)} className="flex-row items-center gap-2" accessibilityRole="link">
                        <Icon as={FileText} className="text-brand-secondary size-3.5" />
                        <Text className="text-brand-secondary text-xs" numberOfLines={1}>
                          {att.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Panel>
            ) : null}

            <View className="gap-2">
              <Text className="text-sm font-medium">{k('note_label')}</Text>
              <HtmlEditorField key={a.id} value={message} onChange={setText} placeholder={k('placeholder')} />
            </View>
            <Button size="lg" onPress={submit} disabled={busy}>
              <Text>{submitted ? k('resubmit') : k('submit')}</Text>
            </Button>
          </View>
        ) : !a.enable_submission ? (
          <Text className="text-muted-foreground text-sm italic">{k('no_submission')}</Text>
        ) : null}
      </ScrollView>
    </>
  );
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
