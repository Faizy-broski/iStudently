import type { AdminAnswerBreakdownRow } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { TrendingDown } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { colors } from '@/lib/colors';
import { BarChart } from '@/components/app/charts';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useQz } from '@/features/admin/quiz';
import { useCampus } from '@/features/campus/campus';
import { adminQuiz } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const NONE = '__none__';
/** ≥75% correct reads as easy, ≥50% medium, below that hard (web: getDifficultyColor / DifficultyBadge). */
const tier = (pct: number) => (pct >= 75 ? 'easy' : pct >= 50 ? 'medium' : 'hard');
const TIER_COLOR = { easy: colors.success, medium: colors.brandAccent, hard: colors.destructive } as const;
const TIER_CLASS = { easy: 'bg-success-soft ', medium: 'bg-warning-soft ', hard: 'bg-destructive-soft ' } as const;
const TIER_TEXT = { easy: 'text-success ', medium: 'text-warning ', hard: 'text-destructive ' } as const;

function Stat({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="py-3">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className={cn('text-2xl font-bold', className)}>{value}</Text>
      </CardContent>
    </Card>
  );
}

/** Per-question correct rates for a quiz (web: /admin/quiz/answer-breakdown). */
export default function AnswerBreakdown() {
  const q = useQz();
  const { campusId } = useCampus();
  const params = useLocalSearchParams<{ id?: string }>();
  const [quizId, setQuizId] = useState(params.id ?? '');
  const quizzes = useApi(['admin', 'quizzes', campusId ?? 'school', ''], () => adminQuiz.quizzes({ campus_id: campusId }));
  const res = useApi(quizId ? ['admin', 'quiz-breakdown', quizId] : null, ([, , id]) => adminQuiz.answerBreakdown(id as string));
  const rows: AdminAnswerBreakdownRow[] = res.data ?? [];
  const hard = rows.filter((r) => r.correct_pct < 50);
  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.correct_pct, 0) / rows.length) : 0;

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: q('answerBreakdown') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="gap-1">
          <Text className="text-sm font-medium">
            {q('selectQuiz')} <Text className="text-muted-foreground text-xs">({q('premiumBadge')})</Text>
          </Text>
          <Picker value={quizId || NONE} onChange={(v) => setQuizId(v === NONE ? '' : v)} placeholder={q('chooseQuiz')} options={[{ value: NONE, label: q('selectQuizPlaceholder') }, ...(quizzes.data ?? []).map((x) => ({ value: x.id, label: x.title }))]} />
        </View>
        {!quizId ? (
          <EmptyState title={q('selectQuizToViewBreakdown')} />
        ) : res.isLoading ? (
          <LoadingList rows={5} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
        ) : !rows.length ? (
          <EmptyState title={q('noStudentAnswersYet')} />
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              <Stat label={q('questions')} value={rows.length} />
              <Stat label={q('avgCorrect')} value={`${avg}%`} />
              <Stat label={q('difficulty.hardQuestions')} value={hard.length} className="text-destructive" />
              <Stat label={q('totalResponses')} value={rows[0]?.total_answers ?? 0} />
            </View>
            <Card>
              <CardContent className="gap-2 pt-4">
                <Text className="font-semibold">{q('correctAnswerPct')}</Text>
                <BarChart
                  stacked
                  yLabel="%"
                  categories={rows.map((_, i) => `Q${i + 1}`)}
                  series={(['easy', 'medium', 'hard'] as const).map((k) => ({ name: q(`difficulty.${k}`), color: TIER_COLOR[k], values: rows.map((r) => (tier(r.correct_pct) === k ? r.correct_pct : 0)) }))}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Text className="pb-2 font-semibold">{q('questionDetails')}</Text>
                {rows.map((r, i) => {
                  const k = tier(r.correct_pct);
                  return (
                    <View key={r.map_id}>
                      <Separator />
                      <View className="gap-1 py-2.5">
                        <View className="flex-row items-start gap-2">
                          <Text className="flex-1 text-sm font-medium">
                            Q{i + 1}. {r.question_title}
                          </Text>
                          <View className={cn('rounded-full px-2 py-0.5', TIER_CLASS[k])}>
                            <Text className={cn('text-xs', TIER_TEXT[k])}>{q(`difficulty.${k}`)}</Text>
                          </View>
                        </View>
                        <Text className="text-muted-foreground text-xs">
                          {q(`questionTypes.${r.question_type}`)} · {q('responses')}: {r.total_answers} · {q('correct')}: {r.correct_pct}% · {q('avgPoints')}: {r.avg_points} / {r.total_points}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </CardContent>
            </Card>
            {hard.length ? (
              <Card className="border-destructive/30 bg-destructive-soft  ">
                <CardContent className="gap-2 pt-4">
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={TrendingDown} className="size-4 text-destructive" />
                    <Text className="font-semibold text-destructive ">{q('questionsStudentsStruggledWith')}</Text>
                  </View>
                  {hard.map((r) => (
                    <View key={r.map_id} className="flex-row gap-2">
                      <Text className="flex-1 text-sm font-medium text-destructive ">{r.question_title}</Text>
                      <Text className="text-sm text-destructive">
                        {r.correct_pct}% {q('correct').toLowerCase()}
                      </Text>
                    </View>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
