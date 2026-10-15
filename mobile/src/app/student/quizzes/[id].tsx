import type { QuizQuestionMap } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { AlertCircle, CheckCircle2, CheckSquare, Circle, CircleDot, Clock, ExternalLink, Square, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { quiz as quizApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const pairsOf = (answer?: string | null) =>
  (answer || '')
    .split('\n')
    .map((l) => l.split('::'))
    .filter((p) => p.length === 2)
    .map(([left, right]) => ({ left: left.trim(), right: right.trim() }));

/** Web MatchingQuestionInput as one picker per left item; the value is "rightIndex||rightIndex||…" per left. */
function Matching({ pairs, value, onChange, disabled, showCorrect }: { pairs: { left: string; right: string }[]; value: string; onChange: (v: string) => void; disabled: boolean; showCorrect: boolean }) {
  const { t } = useTranslation();
  const assigned: Record<number, number> = {};
  value.split('||').forEach((v, i) => {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) assigned[i] = n;
  });
  const set = (left: number, right: number) => {
    const next: Record<number, number> = {};
    for (const [l, r] of Object.entries(assigned)) if (r !== right) next[Number(l)] = r;
    next[left] = right;
    onChange(pairs.map((_, i) => (next[i] !== undefined ? String(next[i]) : '')).join('||'));
  };
  return (
    <View className="gap-2">
      {pairs.map((p, i) => {
        const a = assigned[i];
        const verdict = disabled && showCorrect && a !== undefined ? (a === i ? 'ok' : 'bad') : null;
        return (
          <View key={i} className="gap-1">
            <Text className="bg-muted/40 border-border rounded-md border p-2 text-sm">{p.left}</Text>
            <View className={cn('flex-row items-center gap-2 rounded-md', verdict === 'ok' && 'bg-green-50', verdict === 'bad' && 'bg-red-50')}>
              <View className="flex-1">
                {disabled ? (
                  <Text className="border-border rounded-md border border-dashed p-2 text-sm">{a !== undefined ? (pairs[a]?.right ?? '') : '—'}</Text>
                ) : (
                  <Picker value={a !== undefined ? String(a) : null} onChange={(v) => set(i, Number(v))} options={pairs.map((x, j) => ({ value: String(j), label: x.right }))} placeholder={t('app.st_qz_drop_here')} />
                )}
              </View>
              {verdict === 'ok' ? <Icon as={CheckCircle2} className="size-4 text-green-600" /> : verdict === 'bad' ? <Icon as={XCircle} className="size-4 text-red-600" /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Take or review one quiz (web: QuizTaker in /student/quizzes). */
export default function StudentQuizTaker() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_qz_${key}`, o);
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useSession();
  const studentId = me.status === 'ready' ? (me.me.profile.student_id ?? '') : '';
  const list = useApi(['student', 'quizzes'], () => quizApi.getStudentQuizzes());
  const quiz = (list.data ?? []).find((q) => q.id === id);
  const form = useApi(id ? ['student', 'quiz-form', id] : null, ([, , qid]) => quizApi.getStudentQuizForm(qid as string), { revalidateOnFocus: false, shouldRetryOnError: false });
  const existing = useApi(id && studentId ? ['student', 'quiz-submission', id, studentId] : null, ([, , qid, sid]) => quizApi.getSubmission(qid as string, sid as string), { revalidateOnFocus: false });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // One random order per visit (the web reshuffles on every render).
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));

  const maps = form.data;
  const shuffle = !!quiz?.shuffle;
  const ordered = useMemo<QuizQuestionMap[]>(() => {
    if (!maps) return [];
    if (!shuffle) return maps;
    const a = [...maps];
    let x = seed || 1;
    for (let i = a.length - 1; i > 0; i--) {
      x = (x * 48271) % 2147483647;
      const j = x % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [maps, shuffle, seed]);

  if (list.isLoading || form.isLoading) return <LoadingList rows={6} />;
  if (!quiz) return <Text className="text-muted-foreground p-6 text-sm">{k('not_found')}</Text>;

  const done = !!quiz.submitted;
  const showCorrect = !!quiz.show_correct_answers;
  const answerMap = existing.data?.answerMap ?? {};
  const get = (mapId: string) => (mapId in answers ? answers[mapId] : (answerMap[mapId]?.answer ?? ''));
  const set = (mapId: string, v: string) => setAnswers((a) => ({ ...a, [mapId]: v }));
  const hasAnatomy = ordered.some((m) => m.question?.type === 'anatomy_label');
  const quizId = quiz.id;

  async function submit() {
    if (!maps) return;
    setSubmitting(true);
    const r = await quizApi.submit(
      quizId,
      maps.map((m) => ({ quiz_question_map_id: m.id, answer: get(m.id) || '' })),
    );
    setSubmitting(false);
    if (!r.success) return toast.error(r.error || k('failed'));
    toast.success(k('success'));
    list.mutate();
    router.back();
  }

  const err = form.error?.message ?? '';
  return (
    <>
      <Stack.Screen options={{ title: quiz.title }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {quiz.description ? <Text variant="muted">{quiz.description}</Text> : null}
        {form.error ? (
          <Card className={/locked/i.test(err) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}>
            <CardContent className="items-center p-6">
              {/locked/i.test(err) ? (
                <>
                  <Icon as={XCircle} className="mb-2 size-10 text-red-600" />
                  <Text className="font-semibold text-red-700">{k('missed')}</Text>
                  <Text className="mt-1 text-center text-sm text-red-600">{k('missed_body')}</Text>
                </>
              ) : /unlock/i.test(err) ? (
                <>
                  <Icon as={Clock} className="mb-2 size-10 text-amber-600" />
                  <Text className="font-semibold text-amber-700">{k('not_yet')}</Text>
                  <Text className="mt-1 text-center text-sm text-amber-600">{k('not_yet_body')}</Text>
                </>
              ) : (
                <>
                  <Icon as={AlertCircle} className="text-muted-foreground mb-2 size-10" />
                  <Text className="text-muted-foreground text-center">{err}</Text>
                </>
              )}
            </CardContent>
          </Card>
        ) : !ordered.length ? (
          <Card>
            <CardContent className="items-center p-8">
              <Icon as={AlertCircle} className="text-muted-foreground mb-2 size-10" />
              <Text className="text-muted-foreground">{k('no_questions')}</Text>
            </CardContent>
          </Card>
        ) : hasAnatomy && !done ? (
          <Card>
            <CardContent className="gap-3 p-5">
              <Text className="font-semibold">{k('anatomy')}</Text>
              <Text className="text-muted-foreground text-sm">{k('anatomy_body')}</Text>
              <Button onPress={() => router.push({ pathname: '/student/web', params: { path: '/student/quizzes', title: 'quizzes' } })}>
                <Icon as={ExternalLink} className="text-primary-foreground size-4" />
                <Text>{k('open_web')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {ordered.map((m, idx) => {
              const q = m.question;
              if (!q) return null;
              const v = get(m.id);
              const options = (q.answer || '').split('\n').filter(Boolean);
              const scored = answerMap[m.id]?.points;
              const ca = q.correct_answer as { organId?: string; hotspotId?: string } | null;
              return (
                <View key={m.id} className="border-border bg-card gap-3 rounded-lg border p-4">
                  <View className="flex-row items-start gap-2">
                    <Text className="text-primary font-semibold">{`${idx + 1}.`}</Text>
                    <View className="flex-1">
                      <Text className="font-medium">{q.title}</Text>
                      {q.description ? <Text className="text-muted-foreground mt-1 text-sm">{q.description}</Text> : null}
                      <Badge variant="outline" className="mt-1 self-start">
                        <Text className="text-xs">{k('pts', { count: m.points })}</Text>
                      </Badge>
                    </View>
                  </View>
                  <View className="gap-2 ps-5">
                    {q.type === 'select'
                      ? options.map((opt, i) => {
                          const sel = parseInt(v, 10) === i;
                          const correct = done && showCorrect && opt.startsWith('*');
                          return (
                            <Pressable
                              key={i}
                              disabled={done}
                              onPress={() => set(m.id, String(i))}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: sel, disabled: done }}
                              className={cn('flex-row items-center gap-2 rounded p-2', sel && 'bg-primary/10 border-primary/30 border', correct && 'border border-green-300 bg-green-50')}>
                              <Icon as={sel ? CircleDot : Circle} className={cn('size-4', sel ? 'text-primary' : 'text-muted-foreground')} />
                              <Text className="flex-1 text-sm">{opt.replace(/^\*/, '')}</Text>
                              {correct ? <Icon as={CheckCircle2} className="size-3.5 text-green-600" /> : null}
                            </Pressable>
                          );
                        })
                      : null}
                    {q.type === 'multiple'
                      ? options.map((opt, i) => {
                          const chosen = v ? v.split('||').filter(Boolean).map(Number) : [];
                          const on = chosen.includes(i);
                          return (
                            <Pressable
                              key={i}
                              disabled={done}
                              onPress={() => set(m.id, (on ? chosen.filter((x) => x !== i) : [...chosen, i]).join('||'))}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: on, disabled: done }}
                              className={cn('flex-row items-center gap-2 rounded p-2', on && 'bg-primary/10 border-primary/30 border')}>
                              <Icon as={on ? CheckSquare : Square} className={cn('size-4', on ? 'text-primary' : 'text-muted-foreground')} />
                              <Text className="flex-1 text-sm">{opt.replace(/^\*/, '')}</Text>
                            </Pressable>
                          );
                        })
                      : null}
                    {q.type === 'text' ? <Input value={v} onChangeText={(x) => set(m.id, x)} editable={!done} placeholder={k('type_answer')} /> : null}
                    {q.type === 'textarea' ? <Textarea value={v} onChangeText={(x) => set(m.id, x)} editable={!done} placeholder={k('write_answer')} /> : null}
                    {q.type === 'matching' ? <Matching pairs={pairsOf(q.answer)} value={v} onChange={(x) => set(m.id, x)} disabled={done} showCorrect={showCorrect} /> : null}
                    {q.type === 'gap' ? (
                      <View className="gap-1">
                        {q.answer ? <Text className="text-sm">{q.answer}</Text> : null}
                        <Text className="text-muted-foreground text-sm italic">{k('gap')}</Text>
                        {done ? <Text className="text-sm">{v || '—'}</Text> : <Input value={v} onChangeText={(x) => set(m.id, x)} placeholder={k('gap_ph')} autoCapitalize="none" />}
                      </View>
                    ) : null}
                    {q.type === 'anatomy_label' ? (
                      !ca?.organId ? (
                        <Text className="text-destructive text-sm">{k('no_answer_cfg')}</Text>
                      ) : v ? (
                        <Text className="text-muted-foreground text-xs">{`${k('picked', { value: v })}${done && showCorrect && ca.hotspotId ? k('correct_is', { value: ca.hotspotId }) : ''}`}</Text>
                      ) : null
                    ) : null}
                    {scored !== null && scored !== undefined ? (
                      <View className="self-start rounded-full bg-green-100 px-2 py-0.5">
                        <Text className="text-xs text-green-700">{k('score', { points: scored, max: m.points })}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {!done ? (
              <Button size="lg" onPress={submit} disabled={submitting}>
                <Text>{k('submit')}</Text>
              </Button>
            ) : (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CardContent className="flex-row items-center gap-2 p-3">
                  <Icon as={CheckCircle2} className="size-5 text-green-600" />
                  <Text className="flex-1 text-sm font-medium text-green-800 dark:text-green-300">{k('already')}</Text>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
