import type { ReadingQuizQuestion, ReadingText } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminSpeedReading } from '@/lib/api';
import { useApi } from '@/lib/data';

type QuizRow = { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_ans: 'a' | 'b' | 'c' | 'd' };
const emptyQuiz = (): QuizRow => ({ question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_ans: 'a' });
const toRow = (q: ReadingQuizQuestion): QuizRow => ({ question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c ?? '', option_d: q.option_d ?? '', correct_ans: q.correct_ans });

function Form({ initial }: { initial: ReadingText | null }) {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.${k}`, o);
  const { campusId } = useCampus();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [language, setLanguage] = useState<'en' | 'ar'>(initial?.language ?? 'en');
  const [grade, setGrade] = useState(initial?.grade_level_id ?? 'all');
  const [content, setContent] = useState(initial?.content ?? '');
  const [quiz, setQuiz] = useState<QuizRow[]>((initial?.quiz_questions ?? []).map(toRow));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textId = initial?.id ?? null;

  const patch = (i: number, p: Partial<QuizRow>) => setQuiz((rows) => rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const words = content.trim().split(/\s+/).filter(Boolean).length;

  async function save() {
    if (!title.trim() || !content.trim()) return setError(s('errRequired'));
    setSaving(true);
    setError('');
    try {
      const quiz_questions = quiz
        .filter((q) => q.question.trim() && q.option_a.trim() && q.option_b.trim())
        .map((q) => ({ question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c || undefined, option_d: q.option_d || undefined, correct_ans: q.correct_ans }));
      const input = { title, language, content, grade_level_id: grade !== 'all' ? grade : null, quiz_questions };
      const r = textId ? await adminSpeedReading.updateText(textId, input) : await adminSpeedReading.createText(input, campusId);
      if (!r.success) return setError(r.error || s('errSave'));
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const rtl = language === 'ar';
  return (
    <KeyboardAvoidingView className="flex-1">
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-1.5">
          <Label>{s('titleLabel')}</Label>
          <Input value={title} onChangeText={setTitle} placeholder={s('titlePlaceholder')} />
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1.5">
            <Label>{s('language')}</Label>
            <Picker
              value={language}
              onChange={(v) => setLanguage(v as 'en' | 'ar')}
              options={[
                { value: 'en', label: s('languageEn') },
                { value: 'ar', label: s('languageAr') },
              ]}
            />
          </View>
          <View className="flex-1 gap-1.5">
            <Label>{s('gradeLevelLabel')}</Label>
            <Picker value={grade} onChange={setGrade} options={[{ value: 'all', label: s('allLevels') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
          </View>
        </View>
        <View className="gap-1.5">
          <Label>{s('content')}</Label>
          <Input
            value={content}
            onChangeText={setContent}
            placeholder={s('contentPlaceholder')}
            multiline
            textAlignVertical="top"
            className="min-h-48"
            style={{ writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}
          />
          {content ? <Text className="text-muted-foreground text-xs">{s('wordCountEstimate', { count: words })}</Text> : null}
        </View>
        <Card>
          <CardContent className="gap-4 pt-4">
            <Text className="font-semibold">{s('quizQuestions')}</Text>
            {quiz.map((q, i) => (
              <View key={i} className="border-border gap-2 rounded-md border p-3">
                <View className="flex-row items-center">
                  <Label className="flex-1">
                    {s('questionLabel')} {i + 1}
                  </Label>
                  <Pressable onPress={() => setQuiz((rows) => rows.filter((_, j) => j !== i))} hitSlop={6} className="p-1">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                </View>
                <Input value={q.question} onChangeText={(v) => patch(i, { question: v })} />
                {(['a', 'b', 'c', 'd'] as const).map((o) => (
                  <View key={o} className="gap-1">
                    <Label className="text-xs">{s(`option${o.toUpperCase()}`)}</Label>
                    <Input value={q[`option_${o}`]} onChangeText={(v) => patch(i, { [`option_${o}`]: v } as Partial<QuizRow>)} />
                  </View>
                ))}
                <Label className="text-xs">{s('correctAnswer')}</Label>
                <Picker value={q.correct_ans} onChange={(v) => patch(i, { correct_ans: v as QuizRow['correct_ans'] })} options={['a', 'b', 'c', 'd'].map((o) => ({ value: o, label: o.toUpperCase() }))} />
              </View>
            ))}
            {quiz.length < 3 ? (
              <Button variant="outline" size="sm" onPress={() => setQuiz((rows) => [...rows, emptyQuiz()])}>
                <Icon as={Plus} className="text-foreground size-4" />
                <Text>{s('addQuestion')}</Text>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
        <View className="flex-row gap-2">
          <Button className="flex-1" onPress={save} disabled={saving}>
            <Text>{saving ? s('saving') : s('saveText')}</Text>
          </Button>
          <Button variant="outline" className="flex-1" onPress={() => router.back()}>
            <Text>{s('cancel')}</Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Add or edit a reading text with up to 3 quiz questions (web: /admin/speed-reading/texts/new and /[id]/edit). */
export default function SpeedReadingTextForm() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const textId = id ?? null;
  const res = useApi(textId ? ['admin', 'sr-text', textId] : null, ([, , x]) => adminSpeedReading.text(x as string));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: textId ? t('app.sr_edit_text') : t('speedReading.addText') }} />
      {textId && res.isLoading ? (
        <View className="p-4">
          <LoadingList rows={4} />
        </View>
      ) : (
        <Form key={res.data?.id ?? 'new'} initial={res.data ?? null} />
      )}
    </View>
  );
}
