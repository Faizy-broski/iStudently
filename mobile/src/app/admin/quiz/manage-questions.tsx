import type { AdminQuizQuestion, QuizQuestionMapRow } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { NONE, useQuizCategories, useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

/** Questions in a quiz (points, remove) and the bank filtered to the quiz's subject/grade (web: ManageQuizQuestionsDialog). */
export default function ManageQuizQuestions() {
  const q = useQz();
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const quizId = id ?? null;
  const quiz = useApi(quizId ? ['admin', 'quiz', quizId] : null, ([, , x]) => adminQuiz.quiz(x as string));
  const subjectId = quiz.data?.subject_id ?? null;
  const gradeId = quiz.data?.grade_level_id ?? null;
  const mapped = useApi(quizId ? ['admin', 'quiz-map', quizId] : null, ([, , x]) => adminQuiz.quizQuestions(x as string));
  const categories = useQuizCategories();
  const [tab, setTab] = useState<'quiz' | 'bank'>('quiz');
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const [category, setCategory] = useState('');
  const bank = useApi(quiz.data ? ['admin', 'quiz-bank', campusId ?? 'school', category, term, subjectId ?? '', gradeId ?? ''] : null, ([, , , c, s, sub, g]) =>
    adminQuiz.questions({ campus_id: campusId, category_id: (c as string) || undefined, search: (s as string) || undefined, subject_id: (sub as string) || undefined, grade_level_id: (g as string) || undefined }),
  );
  const [points, setPoints] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    await mapped.mutate();
    mutate((key) => Array.isArray(key) && key[0] === 'admin' && key[1] === 'quizzes');
  };
  async function add(x: AdminQuizQuestion) {
    if (!quizId) return;
    setBusy(x.id);
    try {
      const r = await adminQuiz.addQuestionToQuiz(quizId, x.id, 10, mapped.data?.length ?? 0);
      if (!r.success) return toast.error(r.error || '');
      await refresh();
    } finally {
      setBusy(null);
    }
  }
  async function remove(m: QuizQuestionMapRow) {
    if (!quizId) return;
    setBusy(m.id);
    try {
      const r = await adminQuiz.removeQuestionFromQuiz(quizId, m.id);
      if (!r.success) return toast.error(r.error || '');
      await refresh();
    } finally {
      setBusy(null);
    }
  }
  async function savePoints(m: QuizQuestionMapRow) {
    const raw = points[m.id];
    if (raw === undefined || !quizId) return;
    const pts = parseFloat(raw);
    if (!Number.isNaN(pts) && pts !== m.points) {
      const r = await adminQuiz.updateQuizQuestion(quizId, m.id, { points: pts });
      if (!r.success) toast.error(r.error || '');
      await mapped.mutate();
    }
    setPoints((p) => {
      const n = { ...p };
      delete n[m.id];
      return n;
    });
  }

  const inQuiz = new Set((mapped.data ?? []).map((m) => m.question_id));
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: q('manageQuestionsForQuiz', { title: title ?? quiz.data?.title ?? '' }) }} />
      <View className="px-4 pt-3">
        <FilterChips
          value={tab}
          onChange={setTab}
          options={[
            { value: 'quiz', label: `${q('inThisQuiz')} (${mapped.data?.length ?? 0})` },
            { value: 'bank', label: q('questionBank') },
          ]}
        />
      </View>
      <KeyboardAvoidingView className="flex-1">
        <ScrollView contentContainerClassName="gap-2 p-4 pb-10" keyboardShouldPersistTaps="handled">
          {tab === 'quiz' ? (
            mapped.isLoading ? (
              <LoadingList rows={3} />
            ) : !(mapped.data ?? []).length ? (
              <Text className="text-muted-foreground py-8 text-center text-sm">{q('noQuestionsYetAddFromBank')}</Text>
            ) : (
              (mapped.data ?? []).map((m, i) => (
                <Card key={m.id}>
                  <CardContent className="flex-row items-center gap-2 py-3">
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-medium" numberOfLines={2}>
                        {i + 1}. {m.question?.title ?? '—'}
                      </Text>
                      <Text className="text-muted-foreground text-xs">
                        {q(`questionTypes.${m.question?.type ?? 'select'}`)}
                        {m.question?.category?.title ? ` · ${m.question.category.title}` : ''}
                      </Text>
                    </View>
                    <Input
                      className="h-9 w-16 text-end"
                      value={points[m.id] ?? String(m.points)}
                      onChangeText={(v) => setPoints((p) => ({ ...p, [m.id]: v }))}
                      onBlur={() => savePoints(m)}
                      keyboardType="decimal-pad"
                      accessibilityLabel={q('pointsForQuestion')}
                    />
                    <Text className="text-muted-foreground text-xs">{q('pointsSuffix')}</Text>
                    <Pressable onPress={() => remove(m)} disabled={busy === m.id} hitSlop={8} className="p-1" accessibilityLabel={q('removeFromQuiz')}>
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  </CardContent>
                </Card>
              ))
            )
          ) : (
            <>
              <SearchBar value={search} onChangeText={setSearch} placeholder={q('searchQuestions')} />
              <Picker value={category || NONE} onChange={(v) => setCategory(v === NONE ? '' : v)} options={[{ value: NONE, label: q('allCategories') }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
              {bank.isLoading || quiz.isLoading ? (
                <LoadingList rows={4} />
              ) : !(bank.data ?? []).length ? (
                <Text className="text-muted-foreground py-8 text-center text-sm">{q('noQuestions')}</Text>
              ) : (
                (bank.data ?? []).map((x) => {
                  const added = inQuiz.has(x.id);
                  return (
                    <Card key={x.id} className={cn(added && 'opacity-60')}>
                      <CardContent className="flex-row items-center gap-2 py-3">
                        <View className="flex-1 gap-1">
                          <Text className="text-sm font-medium" numberOfLines={2}>
                            {x.title}
                          </Text>
                          <View className="flex-row flex-wrap gap-1">
                            <Badge variant="secondary">
                              <Text className="text-xs">{q(`questionTypes.${x.type}`)}</Text>
                            </Badge>
                            {x.category?.title ? <Text className="text-muted-foreground text-xs">{x.category.title}</Text> : null}
                          </View>
                        </View>
                        <Button size="sm" variant={added ? 'secondary' : 'default'} disabled={added || busy === x.id} onPress={() => add(x)}>
                          {added ? null : <Icon as={Plus} className="text-primary-foreground size-3.5" />}
                          <Text>{added ? q('added') : q('add')}</Text>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
