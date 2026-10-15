import { coursePeriodTeacherName, type AdminQuiz, type DifficultyLevel } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { MultiSelect } from '@/components/app/multi-select';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { TimeField } from '@/components/app/time-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { DIFFICULTIES, NONE, useQz } from '@/features/admin/quiz';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminCourses, adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO → local "YYYY-MM-DD" and "HH:MM" (web: isoToLocalInput). */
function splitIso(iso?: string | null) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
function joinLocal(date: string, time: string) {
  if (!date) return null;
  const d = new Date(`${date}T${time || '00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Form({ quiz }: { quiz: AdminQuiz | null }) {
  const q = useQz();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [cpId, setCpId] = useState(quiz?.course_period_id ?? '');
  const [assignmentId, setAssignmentId] = useState(quiz?.assignment_id ?? '');
  const [studentIds, setStudentIds] = useState<string[]>(quiz?.assigned_student_ids ?? []);
  const [mode, setMode] = useState<'manual' | 'blueprint'>(quiz?.generation_mode === 'blueprint' ? 'blueprint' : 'manual');
  const [forms, setForms] = useState(String(quiz?.variant_count ?? 3));
  const [bp, setBp] = useState<Record<DifficultyLevel, string>>({ easy: String(quiz?.blueprint_easy ?? 0), medium: String(quiz?.blueprint_medium ?? 0), hard: String(quiz?.blueprint_hard ?? 0) });
  const start = splitIso(quiz?.start_time);
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time || '08:00');
  const [lockout, setLockout] = useState(quiz?.lockout_minutes != null ? String(quiz.lockout_minutes) : '');
  const [showCorrect, setShowCorrect] = useState(quiz?.show_correct_answers ?? true);
  const [shuffle, setShuffle] = useState(quiz?.shuffle ?? false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const cps = useApi(['admin', 'all-course-periods', campusId ?? 'school'], () => adminCourses.allCoursePeriods(campusId));
  const assignments = useApi(['admin', 'quiz-assignments', campusId ?? 'school', cpId || 'all'], ([, , , c]) => adminQuiz.quizAssignments(campusId, c === 'all' ? undefined : (c as string)));
  const context = useApi(cpId ? ['admin', 'quiz-cp-context', cpId] : null, ([, , c]) => adminQuiz.coursePeriodContext(c as string));
  const subjectId = cpId ? (context.data?.subject_id ?? null) : null;
  const gradeId = cpId ? (context.data?.grade_level_id ?? null) : null;
  const students = useCampusStudents();
  const pool = useApi(mode === 'blueprint' && subjectId ? ['admin', 'quiz-bp-pool', campusId ?? 'school', subjectId, gradeId ?? ''] : null, ([, , , s, g]) =>
    adminQuiz.questions({ campus_id: campusId, subject_id: s as string, grade_level_id: (g as string) || undefined }),
  );
  const poolCounts: Record<DifficultyLevel, number> = { easy: 0, medium: 0, hard: 0 };
  for (const x of pool.data ?? []) if (x.difficulty_level) poolCounts[x.difficulty_level]++;
  const nForms = Math.max(1, Number(forms) || 1);
  const counts = { easy: Math.max(0, Number(bp.easy) || 0), medium: Math.max(0, Number(bp.medium) || 0), hard: Math.max(0, Number(bp.hard) || 0) };
  const total = counts.easy + counts.medium + counts.hard;

  async function save() {
    if (!title.trim()) return setError(q('errors.titleRequired'));
    if (mode === 'blueprint') {
      if (total <= 0) return setError(q('errors.blueprintEmpty', { defaultValue: 'Blueprint must include at least one question.' }));
      if (!subjectId) return setError(q('errors.coursePeriodRequired', { defaultValue: 'Select a course period so the blueprint knows which subject to pull from.' }));
    }
    setSaving(true);
    setError('');
    try {
      const input = {
        campus_id: campusId ?? null,
        title: title.trim(),
        description: description.trim() || null,
        assignment_id: assignmentId || null,
        course_period_id: cpId || null,
        show_correct_answers: showCorrect,
        shuffle,
        subject_id: subjectId,
        grade_level_id: gradeId,
        assigned_student_ids: studentIds,
        generation_mode: mode,
        variant_count: mode === 'blueprint' ? nForms : 1,
        blueprint_easy: mode === 'blueprint' ? counts.easy : 0,
        blueprint_medium: mode === 'blueprint' ? counts.medium : 0,
        blueprint_hard: mode === 'blueprint' ? counts.hard : 0,
        start_time: joinLocal(startDate, startTime),
        lockout_minutes: startDate && lockout.trim() ? Number(lockout) : null,
      };
      const r = quiz ? await adminQuiz.updateQuiz(quiz.id, input) : await adminQuiz.createQuiz(input);
      if (!r.success) return setError(r.error || q('errors.failedToSaveQuiz'));
      mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'quizzes' || key[1] === 'quiz'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const sw = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View className="flex-row items-center gap-3">
      <Switch checked={value} onCheckedChange={onChange} />
      <Text className="flex-1 text-sm">{label}</Text>
    </View>
  );
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Label>{q('table.title')} *</Label>
        <Input value={title} onChangeText={setTitle} placeholder={q('placeholders.quizTitle')} />
      </View>
      <View className="gap-1">
        <Label>{q('description')}</Label>
        <Input value={description} onChangeText={setDescription} placeholder={q('placeholders.optionalDescription')} multiline className="min-h-16" textAlignVertical="top" />
      </View>
      <View className="gap-1">
        <Label>{q('coursePeriod')}</Label>
        <Picker
          value={cpId || NONE}
          onChange={(v) => {
            setCpId(v === NONE ? '' : v);
            setAssignmentId('');
            setStudentIds([]);
          }}
          options={[{ value: NONE, label: q('none') }, ...(cps.data ?? []).map((cp) => ({ value: cp.id, label: [cp.course?.title ?? cp.title, cp.period?.period_name, coursePeriodTeacherName(cp)].filter(Boolean).join(' - ') || cp.id.slice(0, 8) }))]}
        />
      </View>
      <View className="gap-1">
        <Label>{q('assignmentOptional')}</Label>
        <Picker value={assignmentId || NONE} onChange={(v) => setAssignmentId(v === NONE ? '' : v)} options={[{ value: NONE, label: q('none') }, ...(assignments.data ?? []).map((a) => ({ value: a.id, label: a.title }))]} />
      </View>
      <View className="gap-1">
        <Label>{q('assignStudentsLabel')}</Label>
        <MultiSelect
          value={studentIds}
          onChange={setStudentIds}
          placeholder={q('searchStudents')}
          title={q('assignStudentsLabel')}
          options={(students.data ?? []).map((s) => ({ id: s.id, label: studentFullName(s.profile) || s.student_number, hint: [s.grade_level, s.student_number].filter(Boolean).join(' · ') }))}
        />
        <Text className="text-muted-foreground text-xs">{q('deployWholeSection')}</Text>
      </View>
      <Card>
        <CardContent className="gap-3 pt-4">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-semibold">{q('questionSelection')}</Text>
            <Text className={mode === 'manual' ? 'text-sm font-medium' : 'text-muted-foreground text-sm'}>{q('manual')}</Text>
            <Switch checked={mode === 'blueprint'} onCheckedChange={(v) => setMode(v ? 'blueprint' : 'manual')} />
          </View>
          <Text className={mode === 'blueprint' ? 'text-sm font-medium' : 'text-muted-foreground text-xs'}>{mode === 'manual' ? q('manualHelp') : q('blueprint')}</Text>
          {mode === 'blueprint' ? (
            <View className="gap-2">
              <Text className="text-muted-foreground text-xs">{q('blueprintHelp', { forms: nForms })}</Text>
              <View className="flex-row gap-2">
                {DIFFICULTIES.map((d) => (
                  <View key={d} className="flex-1 gap-1">
                    <Text className="text-xs">
                      {q(`difficulty.${d}`)} <Text className="text-muted-foreground text-xs">({poolCounts[d]} {q('avail')})</Text>
                    </Text>
                    <Input value={bp[d]} onChangeText={(v) => setBp({ ...bp, [d]: v })} keyboardType="number-pad" className={counts[d] > poolCounts[d] * nForms ? 'border-amber-400' : undefined} />
                  </View>
                ))}
              </View>
              <View className="gap-1">
                <Text className="text-xs">{q('numberOfForms')}</Text>
                <Input value={forms} onChangeText={setForms} keyboardType="number-pad" />
              </View>
              <Text className="text-muted-foreground text-xs">{q('totalBlueprint', { questions: total, forms: nForms })}</Text>
              <Text className="text-muted-foreground text-xs">{q('blueprintTip')}</Text>
            </View>
          ) : null}
        </CardContent>
      </Card>
      <View className="flex-row gap-2">
        <DateField className="flex-1" label={q('unlockAt')} value={startDate} onChange={setStartDate} clearable min={quiz ? undefined : todayYmd()} />
        {startDate ? <TimeField className="flex-1" label=" " value={startTime} onChange={setStartTime} /> : null}
      </View>
      <View className="gap-1">
        <Label>{q('lockoutWindow')}</Label>
        <Input value={lockout} onChangeText={setLockout} keyboardType="number-pad" placeholder={q('lockoutPlaceholder')} editable={!!startDate} className={!startDate ? 'opacity-50' : undefined} />
      </View>
      {sw(q('showCorrectAnswers'), showCorrect, setShowCorrect)}
      {sw(q('randomQuestionOrder'), shuffle, setShuffle)}
      {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={saving}>
          <Text>{q('cancel')}</Text>
        </Button>
        <Button className="flex-1" onPress={save} disabled={saving}>
          <Text>{saving ? q('saving') : quiz ? q('saveChanges') : q('createQuiz')}</Text>
        </Button>
      </View>
    </View>
  );
}

/** Create or edit a quiz: course period, assignment, target students, blueprint, schedule (web: AddEditQuizDialog). */
export default function QuizForm() {
  const q = useQz();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qid = id ?? null;
  const res = useApi(qid ? ['admin', 'quiz', qid] : null, ([, , x]) => adminQuiz.quiz(x as string));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: qid ? q('actions.editQuiz') : q('newQuiz') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="p-4 pb-10" keyboardShouldPersistTaps="handled">
          {qid && res.isLoading ? (
            <LoadingList rows={5} />
          ) : qid && (res.error || !res.data) ? (
            <ErrorState message={res.error?.message} onRetry={() => res.mutate()} />
          ) : (
            <Form key={res.data?.id ?? 'new'} quiz={res.data ?? null} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
