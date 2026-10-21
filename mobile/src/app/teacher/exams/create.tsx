import { router, Stack } from 'expo-router';
import { ClipboardList, Target } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { FormSection, StickyActions } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { usePortalAcademic } from '@/features/portal/academic';
import { useTeacherExams } from '@/features/teacher/exams';
import { exams, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

/** New exam: type, grade → section → subject the teacher teaches, name, date, max / passing marks (web: /teacher/exams, Create Exam). */
export default function TeacherCreateExam() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.exams.${key}`, o);
  const toast = useToast();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const schoolId = profile?.school_id ?? null;
  const academic = usePortalAcademic();
  const list = useTeacherExams();
  const types = useApi(schoolId ? ['teacher', 'exam-types', schoolId] : null, ([, , s]) => exams.types(s as string));
  const subjects = useApi(['teacher', 'my-subjects'], () => teacher.mySubjects());
  const [f, setF] = useState({ type: '', grade: '', section: '', subject: '', name: '', date: '', max: '100', pass: '40' });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const assigned = subjects.data ?? [];
  const gradeOf = (a: (typeof assigned)[number]) => a.section?.grade_level?.id ?? a.section?.grade_level?.name ?? '';
  const grades = [...new Map(assigned.filter((a) => gradeOf(a)).map((a) => [gradeOf(a), a.section?.grade_level?.name || k('unknown')])).entries()];
  const sections = f.grade ? [...new Map(assigned.filter((a) => gradeOf(a) === f.grade).map((a) => [a.section_id, a.section?.name ?? ''])).entries()] : [];
  const subjectsFor = f.section ? [...new Map(assigned.filter((a) => a.section_id === f.section).map((a) => [a.subject_id, a.subject?.name ?? k('unknown')])).entries()] : [];

  async function create() {
    if (!profile?.staff_id || !profile.school_id) return;
    if (!f.type || !f.section || !f.subject || !f.name.trim()) return toast.error(k('fillRequiredFields'));
    if (!academic.year) return toast.error(t('teacherPages.assignments.noAcademicYear'));
    setBusy(true);
    const r = await exams.create({
      school_id: profile.school_id,
      teacher_id: profile.staff_id,
      academic_year_id: academic.year.id,
      exam_type_id: f.type,
      section_id: f.section,
      subject_id: f.subject,
      exam_name: f.name.trim(),
      exam_date: f.date || undefined,
      max_marks: parseFloat(f.max),
      passing_marks: parseFloat(f.pass),
      is_published: true,
    });
    setBusy(false);
    if (!r.success) return toast.error(r.error || k('createExamFailed'));
    toast.success(k('examCreated'));
    list.mutate();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('createNewExam') }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
          <FormSection title={k('createNewExam')} icon={ClipboardList}>
            <View className="gap-1.5">
              <Label>{`${k('examType')} *`}</Label>
              <Picker value={f.type || null} onChange={(v) => set({ type: v })} placeholder={k('selectType')} options={(types.data ?? []).map((x) => ({ value: x.id, label: x.name }))} />
            </View>
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
              <Label>{`${k('examName')} *`}</Label>
              <Input value={f.name} onChangeText={(v) => set({ name: v })} placeholder={k('examNamePlaceholder')} />
            </View>
            <DateField label={k('examDate')} value={f.date || null} onChange={(v) => set({ date: v })} clearable />
          </FormSection>
          <FormSection title={k('maxMarks')} icon={Target}>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{`${k('maxMarks')} *`}</Label>
                <Input value={f.max} onChangeText={(v) => set({ max: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{`${k('passingMarks')} *`}</Label>
                <Input value={f.pass} onChangeText={(v) => set({ pass: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
              </View>
            </View>
          </FormSection>
        </ScrollView>
        <StickyActions>
          <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={busy}>
            <Text>{k('cancel')}</Text>
          </Button>
          <Button className="flex-1" onPress={create} disabled={busy}>
            <Text>{k('createExam')}</Text>
          </Button>
        </StickyActions>
      </KeyboardAvoidingView>
    </>
  );
}
