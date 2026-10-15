import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { HtmlEditorField } from '@/components/app/html-editor-field';
import { Picker } from '@/components/app/picker';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademic } from '@/features/portal/academic';
import { AttachmentField } from '@/features/teacher/homework';
import { homework, media, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import type { PickedDocument } from '@/lib/upload';

/** New homework assignment: grade → section → subject from what the teacher teaches, rich instructions, files, due date and options (web: /teacher/assignments, Create Assignment). */
export default function TeacherCreateHomework() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.assignments.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const academic = usePortalAcademic();
  const { campusId } = useCampus();
  const subjects = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  const [f, setF] = useState({ grade: '', section: '', subject: '', title: '', description: '', instructions: '', due: '', time: '', max: '100', graded: true, late: false });
  const [files, setFiles] = useState<PickedDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const list = subjects.data ?? [];
  const grades = [...new Map(list.filter((a) => a.section?.grade_level).map((a) => [a.section?.grade_level?.id ?? a.section?.grade_level?.name ?? '', a.section?.grade_level?.name ?? ''])).entries()];
  const gradeOf = (a: (typeof list)[number]) => a.section?.grade_level?.id ?? a.section?.grade_level?.name ?? '';
  const sections = [...new Map(list.filter((a) => !f.grade || gradeOf(a) === f.grade).map((a) => [a.section_id, a.section?.name ?? ''])).entries()];
  const subjectsFor = [...new Map(list.filter((a) => a.section_id === f.section).map((a) => [a.subject_id, a.subject?.name ?? k('unknown')])).entries()];

  async function create() {
    if (!profile?.staff_id || !profile.school_id) return;
    if (!f.section || !f.subject || !f.title.trim() || !f.due) return toast.error(k('fillRequiredFields'));
    if (!academic.year) return toast.error(k('noAcademicYear'));
    setBusy(true);
    try {
      const attachments: { url: string; name: string; uploaded_at: string }[] = [];
      for (const file of files) {
        const up = await media.uploadAttachment({ uri: file.uri, name: file.name, type: file.type }, campusId ?? undefined);
        if (!up.success || !up.data) return toast.error(up.error || k('uploadFilesFailed'));
        attachments.push({ url: up.data.url, name: up.data.name || file.name, uploaded_at: new Date().toISOString() });
      }
      if (files.length) toast.success(k('filesUploaded', { count: files.length }));
      const r = await homework.create({
        school_id: profile.school_id,
        campus_id: campusId ?? profile.school_id,
        teacher_id: profile.staff_id,
        section_id: f.section,
        subject_id: f.subject,
        academic_year_id: academic.year.id,
        title: f.title.trim(),
        description: f.description.trim() || undefined,
        instructions: f.instructions || undefined,
        assigned_date: todayYmd(),
        due_date: f.due,
        due_time: f.time || undefined,
        max_score: Number(f.max) || 100,
        is_graded: f.graded,
        allow_late_submission: f.late,
        attachments,
        is_published: true,
        created_by: profile.id,
      });
      if (!r.success) return toast.error(r.error || k('createAssignmentFailed'));
      toast.success(k('assignmentCreated'));
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('createNewAssignment') }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <View className="gap-1.5">
            <Label>{`${k('gradeLevel')} *`}</Label>
            <Picker value={f.grade || null} onChange={(v) => set({ grade: v, section: '', subject: '' })} placeholder={k('selectGrade')} options={grades.map(([id, name]) => ({ value: id, label: name }))} />
          </View>
          <View className="gap-1.5">
            <Label>{`${k('section')} *`}</Label>
            <Picker value={f.section || null} onChange={(v) => set({ section: v, subject: '' })} placeholder={k('selectSection')} options={sections.map(([id, name]) => ({ value: id, label: name }))} />
          </View>
          <View className="gap-1.5">
            <Label>{`${k('subject')} *`}</Label>
            <Picker value={f.subject || null} onChange={(v) => set({ subject: v })} placeholder={k('selectSubject')} options={subjectsFor.map(([id, name]) => ({ value: id, label: name }))} />
          </View>
          <View className="gap-1.5">
            <Label>{`${k('assignmentTitle')} *`}</Label>
            <Input value={f.title} onChangeText={(v) => set({ title: v })} placeholder={k('titlePlaceholder')} />
          </View>
          <View className="gap-1.5">
            <Label>{k('description')}</Label>
            <Textarea value={f.description} onChangeText={(v) => set({ description: v })} placeholder={k('descriptionPlaceholder')} />
          </View>
          <View className="gap-1.5">
            <Label>{k('instructionsRichText')}</Label>
            <HtmlEditorField value={f.instructions} onChange={(v) => set({ instructions: v })} />
          </View>
          <View className="gap-1.5">
            <Label>{k('attachments')}</Label>
            <AttachmentField picked={files} onPick={(d) => setFiles((x) => [...x, ...d])} onRemove={(i) => setFiles((x) => x.filter((_, j) => j !== i))} />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <DateField label={`${k('dueDate')} *`} value={f.due || null} onChange={(v) => set({ due: v })} min={todayYmd()} />
            </View>
            <View className="flex-1 gap-1.5">
              <Label>{k('dueTime')}</Label>
              <TimeField value={f.time} onChange={(v) => set({ time: v })} />
            </View>
          </View>
          <View className="gap-1.5">
            <Label>{k('maxScore')}</Label>
            <Input value={f.max} onChangeText={(v) => set({ max: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" />
          </View>
          <View className="flex-row items-center gap-3">
            <Switch checked={f.graded} onCheckedChange={(v) => set({ graded: v })} />
            <Text className="flex-1 text-sm">{k('gradedAssignment')}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Switch checked={f.late} onCheckedChange={(v) => set({ late: v })} />
            <Text className="flex-1 text-sm">{k('allowLateSubmissions')}</Text>
          </View>
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={busy}>
              <Text>{k('cancel')}</Text>
            </Button>
            <Button className="flex-1" onPress={create} disabled={busy}>
              <Text>{busy ? k('creating') : k('createAssignment')}</Text>
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
