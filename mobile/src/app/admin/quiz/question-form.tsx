import type { AdminQuestionType, AdminQuizQuestion, DifficultyLevel } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { WebSessionView } from '@/components/app/web-session-view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { DIFFICULTIES, GradeSubjectPickers, NONE, QUESTION_TYPES, useQuizCategories, useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';

function Form({ question, defaultCategoryId }: { question: AdminQuizQuestion | null; defaultCategoryId: string }) {
  const q = useQz();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const categories = useQuizCategories();
  const [title, setTitle] = useState(question?.title ?? '');
  const [type, setType] = useState<AdminQuestionType>(question?.type ?? 'select');
  const [description, setDescription] = useState(question?.description ?? '');
  const [answer, setAnswer] = useState(question?.answer ?? '');
  const [categoryId, setCategoryId] = useState(question?.category_id ?? defaultCategoryId);
  const [gradeId, setGradeId] = useState(question?.grade_level_id ?? '');
  const [subjectId, setSubjectId] = useState(question?.subject_id ?? '');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(question?.difficulty_level ?? 'medium');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const answerLabel = type === 'select' || type === 'multiple' ? q('answerInput.options') : type === 'gap' ? q('answerInput.gapText') : type === 'matching' ? q('answerInput.pairs') : q('answerInput.correctAnswer');
  const placeholder: Partial<Record<AdminQuestionType, string>> = {
    select: q('placeholders.selectAnswer'),
    multiple: q('placeholders.multipleAnswer'),
    gap: q('placeholders.gapAnswer'),
    text: q('placeholders.textAnswer'),
    matching: q('placeholders.matchingAnswer'),
  };

  async function save() {
    if (!title.trim()) return setError(q('errors.titleRequired'));
    setSaving(true);
    setError('');
    try {
      const input = {
        campus_id: campusId ?? null,
        category_id: categoryId || null,
        title: title.trim(),
        type,
        description: description.trim() || null,
        answer: answer.trim() || null,
        // The 3D anatomy answer is set on the website; keep what is there.
        correct_answer: question?.correct_answer ?? null,
        sort_order: question?.sort_order ?? 0,
        grade_level_id: gradeId || null,
        subject_id: subjectId || null,
        difficulty_level: difficulty,
      };
      const r = question ? await adminQuiz.updateQuestion(question.id, input) : await adminQuiz.createQuestion(input);
      if (!r.success) return setError(r.error || q('errors.failedToSave'));
      mutate((key) => Array.isArray(key) && key[0] === 'admin' && (key[1] === 'quiz-questions' || key[1] === 'quiz-question'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Label>{q('question')} *</Label>
        <Input
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            if (error) setError('');
          }}
          placeholder={q('placeholders.questionText')}
          className={error ? 'border-destructive' : undefined}
        />
        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      </View>
      <View className="gap-1">
        <Label>{q('type')}</Label>
        <Picker
          value={type}
          onChange={(v) => {
            setType(v as AdminQuestionType);
            setAnswer('');
          }}
          options={QUESTION_TYPES.map((x) => ({ value: x, label: q(`questionTypes.${x}`) }))}
        />
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Label>{q('category')}</Label>
          <Picker value={categoryId || NONE} onChange={(v) => setCategoryId(v === NONE ? '' : v)} options={[{ value: NONE, label: q('none') }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
        </View>
        <View className="flex-1 gap-1">
          <Label>{q('difficultyLabel')}</Label>
          <Picker value={difficulty} onChange={(v) => setDifficulty(v as DifficultyLevel)} options={DIFFICULTIES.map((d) => ({ value: d, label: q(`difficulty.${d}`) }))} />
        </View>
      </View>
      <GradeSubjectPickers
        gradeId={gradeId}
        subjectId={subjectId}
        onChange={(v) => {
          setGradeId(v.gradeId);
          setSubjectId(v.subjectId);
        }}
      />
      <View className="gap-1">
        <Label>{q('descriptionOptional')}</Label>
        <Input value={description} onChangeText={setDescription} placeholder={q('placeholders.questionDescription')} multiline className="min-h-16" textAlignVertical="top" />
      </View>
      {type === 'anatomy_label' ? (
        <View className="gap-1">
          <Label>{q('answerInput.correctAnswer')}</Label>
          <Text className="text-muted-foreground text-xs">{q('anatomyOnWeb', { defaultValue: 'Pick the correct marker on the 3D model below (website view), then save there.' })}</Text>
          {question ? (
            <View className="border-border h-[480px] overflow-hidden rounded-md border">
              <WebSessionView path="/admin/quiz/questions" campusId={campusId} />
            </View>
          ) : null}
        </View>
      ) : type !== 'textarea' ? (
        <View className="gap-1">
          <Label>{answerLabel}</Label>
          <Input value={answer} onChangeText={setAnswer} placeholder={placeholder[type]} multiline autoCapitalize="none" className="min-h-28 font-mono text-sm" textAlignVertical="top" />
          {type === 'select' || type === 'multiple' ? <Text className="text-muted-foreground text-xs">{q('answerInput.correctPrefix')} *True</Text> : null}
          {type === 'gap' ? <Text className="text-muted-foreground text-xs">{q('answerInput.gapHint')} The sky is __blue__.</Text> : null}
          {type === 'matching' ? <Text className="text-muted-foreground text-xs">{q('answerInput.matchingHint')} Paris::France</Text> : null}
        </View>
      ) : null}
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={() => router.back()} disabled={saving}>
          <Text>{q('cancel')}</Text>
        </Button>
        <Button className="flex-1" onPress={save} disabled={saving}>
          <Text>{saving ? q('saving') : question ? q('saveChanges') : q('addQuestionAction')}</Text>
        </Button>
      </View>
    </View>
  );
}

/** Add or edit a bank question (web: /admin/quiz/questions, QuestionDialog). */
export default function QuestionForm() {
  const q = useQz();
  const { id, categoryId } = useLocalSearchParams<{ id?: string; categoryId?: string }>();
  const qid = id ?? null;
  const res = useApi(qid ? ['admin', 'quiz-question', qid] : null, ([, , x]) => adminQuiz.question(x as string));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: qid ? q('editQuestion') : q('newQuestion') }} />
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="p-4 pb-10" keyboardShouldPersistTaps="handled">
          {qid && res.isLoading ? (
            <LoadingList rows={4} />
          ) : qid && (res.error || !res.data) ? (
            <ErrorState message={res.error?.message} onRetry={() => res.mutate()} />
          ) : (
            <Form key={res.data?.id ?? 'new'} question={res.data ?? null} defaultCategoryId={categoryId ?? ''} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
