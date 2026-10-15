import { htmlToText } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, FileText, Upload, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { HtmlEditorField } from '@/components/app/html-editor-field';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { longDate, teacherOf, useStudentAssignmentList } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';
import { media, student } from '@/lib/api';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
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
            ) : submitted ? (
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

        {a.enable_submission && !graded ? (
          <View className="gap-4">
            <View className="gap-2">
              <Text className="text-muted-foreground text-xs font-medium uppercase">{k('files')}</Text>
              <Button variant="outline" className="self-start" onPress={choose} disabled={busy}>
                <Icon as={Upload} className="size-4" />
                <Text>{files.length ? k('selected', { count: files.length }) : k('choose')}</Text>
              </Button>
              {files.map((f, i) => (
                <View key={`${f.uri}:${i}`} className="flex-row items-center gap-2">
                  <Icon as={FileText} className="text-muted-foreground size-3" />
                  <Text className="flex-1 text-xs">{f.name}</Text>
                  <Pressable onPress={() => setFiles((x) => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityRole="button" accessibilityLabel={k('remove', { name: f.name })}>
                    <Icon as={X} className="size-3 text-red-500" />
                  </Pressable>
                </View>
              ))}
              {submitted && sub?.attachments?.length ? (
                <View className="mt-1 gap-1">
                  <Text className="text-muted-foreground text-xs">{k('previous')}</Text>
                  {sub.attachments.map((att, i) => (
                    <Pressable key={`${att.url}:${i}`} onPress={() => WebBrowser.openBrowserAsync(att.url)} className="flex-row items-center gap-2" accessibilityRole="link">
                      <Icon as={FileText} className="size-3 text-[#4A90E2]" />
                      <Text className="text-xs text-[#4A90E2]">{att.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <View className="gap-2">
              <Text className="text-muted-foreground text-xs font-medium uppercase">{k('message')}</Text>
              <HtmlEditorField key={a.id} value={message} onChange={setText} placeholder={k('placeholder')} />
            </View>
            <Button className="bg-[#4A90E2]" onPress={submit} disabled={busy}>
              <Text className="text-white uppercase">{submitted ? k('resubmit') : k('submit')}</Text>
            </Button>
          </View>
        ) : !a.enable_submission ? (
          <Text className="text-muted-foreground text-sm italic">{k('no_submission')}</Text>
        ) : null}
      </ScrollView>
    </>
  );
}
