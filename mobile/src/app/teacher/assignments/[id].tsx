import type { HomeworkAttachment } from '@studently/api-client';
import { htmlToText } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Calendar, Clock, Edit, FileText, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { DateField } from '@/components/app/date-field';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { PortalError } from '@/features/portal/ui';
import { AttachmentField } from '@/features/teacher/homework';
import { homework, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import type { PickedDocument } from '@/lib/upload';

type Form = { title: string; description: string; instructions: string; due: string; time: string; max: string; graded: boolean; late: boolean; published: boolean; attachments: HomeworkAttachment[] };

/** One homework assignment: details, edit (incl. attachments and publish), delete, go to submissions (web: /teacher/assignments/[id]). */
export default function TeacherHomeworkDetail() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.assignmentDetail.${key}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const res = useApi(id ? ['teacher', 'homework-detail', id] : null, ([, , a]) => homework.get(a as string));
  const [form, setForm] = useState<Form | null>(null);
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const a = res.data;

  function startEdit() {
    if (!a) return;
    setFiles([]);
    setForm({
      title: a.title,
      description: a.description ?? '',
      instructions: a.instructions ?? '',
      due: a.due_date.slice(0, 10),
      time: a.due_time ?? '',
      max: String(a.max_score),
      graded: a.is_graded,
      late: a.allow_late_submission,
      published: a.is_published,
      attachments: a.attachments ?? [],
    });
  }

  async function save() {
    if (!form || !id) return;
    if (!form.title.trim() || !form.due) return toast.error(t('teacherPages.assignments.fillRequiredFields'));
    setBusy(true);
    try {
      const added: HomeworkAttachment[] = [];
      for (const f of files) {
        const up = await media.uploadAttachment({ uri: f.uri, name: f.name, type: f.type }, campusId ?? undefined);
        if (!up.success || !up.data) return toast.error(up.error || t('teacherPages.assignments.uploadFilesFailed'));
        added.push({ url: up.data.url, name: up.data.name || f.name, uploaded_at: new Date().toISOString() });
      }
      const r = await homework.update(id, {
        title: form.title.trim(),
        description: form.description,
        instructions: form.instructions,
        due_date: form.due,
        due_time: form.time || undefined,
        max_score: Number(form.max) || 100,
        is_graded: form.graded,
        allow_late_submission: form.late,
        is_published: form.published,
        attachments: [...form.attachments, ...added],
      });
      if (!r.success) return toast.error(r.error || k('updateFailed'));
      toast.success(k('updateSuccess'));
      setForm(null);
      res.mutate();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    if (!(await confirm({ title: k('deleteAssignmentTitle'), body: k('deleteAssignmentDescription'), confirmLabel: k('delete'), destructive: true }))) return;
    const r = await homework.remove(id);
    if (!r.success) return toast.error(r.error || k('deleteFailed'));
    toast.success(k('deleteSuccess'));
    router.back();
  }

  if (res.isLoading) return <LoadingList rows={4} />;
  if (res.error || !a) return <PortalError title={k('assignmentNotFound')} message={res.error?.message} />;
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));

  return (
    <>
      <Stack.Screen options={{ title: form ? k('editAssignmentTitle') : a.title }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
          {form ? (
            <>
              <View className="gap-1.5">
                <Label>{`${t('teacherPages.assignments.assignmentTitle')} *`}</Label>
                <Input value={form.title} onChangeText={(v) => set({ title: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{t('teacherPages.assignments.description')}</Label>
                <Textarea value={form.description} onChangeText={(v) => set({ description: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{t('teacherPages.assignments.instructionsRichText')}</Label>
                <HtmlEditorField value={form.instructions} onChange={(v) => set({ instructions: v })} />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <DateField label={`${t('teacherPages.assignments.dueDate')} *`} value={form.due} onChange={(v) => set({ due: v })} />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{t('teacherPages.assignments.dueTime')}</Label>
                  <TimeField value={form.time} onChange={(v) => set({ time: v })} />
                </View>
              </View>
              <View className="gap-1.5">
                <Label>{t('teacherPages.assignments.maxScore')}</Label>
                <Input value={form.max} onChangeText={(v) => set({ max: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
              </View>
              <View className="gap-1.5">
                <Label>{k('attachments')}</Label>
                <AttachmentField
                  existing={form.attachments}
                  onRemoveExisting={(i) => set({ attachments: form.attachments.filter((_, j) => j !== i) })}
                  picked={files}
                  onPick={(d) => setFiles((x) => [...x, ...d])}
                  onRemove={(i) => setFiles((x) => x.filter((_, j) => j !== i))}
                />
              </View>
              {(
                [
                  ['graded', t('teacherPages.assignments.gradedAssignment')],
                  ['late', t('teacherPages.assignments.allowLateSubmissions')],
                  ['published', k('published')],
                ] as const
              ).map(([key, label]) => (
                <View key={key} className="flex-row items-center gap-3">
                  <Switch checked={form[key]} onCheckedChange={(v) => set({ [key]: v })} />
                  <Text className="flex-1 text-sm">{label}</Text>
                </View>
              ))}
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setForm(null)} disabled={busy}>
                  <Text>{k('cancel')}</Text>
                </Button>
                <Button className="flex-1" onPress={save} disabled={busy}>
                  <Text>{busy ? k('saving') : k('saveChanges')}</Text>
                </Button>
              </View>
            </>
          ) : (
            <>
              <View className="flex-row flex-wrap gap-1.5">
                <Badge variant={a.is_published ? 'default' : 'secondary'}>
                  <Text className="text-xs">{a.is_published ? k('published') : k('draft')}</Text>
                </Badge>
                {a.is_graded ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{k('graded')}</Text>
                  </Badge>
                ) : null}
                {a.allow_late_submission ? (
                  <Badge variant="outline">
                    <Text className="text-xs">{k('lateSubmissionsAllowed')}</Text>
                  </Badge>
                ) : null}
              </View>
              <Text className="text-muted-foreground text-sm">{[a.subject?.name, a.section?.name, a.section?.grade_level?.name].filter(Boolean).join(' • ')}</Text>
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={startEdit}>
                  <Icon as={Edit} className="size-4" />
                  <Text>{k('edit')}</Text>
                </Button>
                <Button variant="destructive" className="flex-1" onPress={remove}>
                  <Icon as={Trash2} className="size-4 text-white" />
                  <Text>{k('delete')}</Text>
                </Button>
              </View>
              <Button onPress={() => router.push({ pathname: '/teacher/submissions', params: { assignment: a.id } })}>
                <Icon as={Users} className="text-primary-foreground size-4" />
                <Text>{k('submissions')}</Text>
              </Button>
              <Card>
                <CardContent className="gap-2 p-4">
                  <Row icon={Calendar} label={k('dueDate')} value={formatDate(a.due_date)} />
                  <Row icon={Clock} label={k('dueTime')} value={a.due_time?.slice(0, 5) || k('noSpecificTime')} />
                  <Row icon={FileText} label={k('maxScore')} value={`${a.max_score} ${k('points')}`} />
                  <Row icon={Calendar} label={t('app.te_hw_assigned')} value={formatDate(a.assigned_date)} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{k('description')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="text-muted-foreground text-sm">{a.description || k('noDescriptionProvided')}</Text>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{k('instructions')}</CardTitle>
                </CardHeader>
                <CardContent>{a.instructions ? <Text className="text-sm">{htmlToText(a.instructions)}</Text> : <Text className="text-muted-foreground text-sm">{k('noInstructionsProvided')}</Text>}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{k('attachments')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {(a.attachments ?? []).length ? (
                    <AttachmentField existing={a.attachments ?? []} picked={[]} onPick={() => {}} onRemove={() => {}} readOnly />
                  ) : (
                    <Text className="text-muted-foreground text-sm">{k('noAttachments')}</Text>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Row({ icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon as={icon} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}
