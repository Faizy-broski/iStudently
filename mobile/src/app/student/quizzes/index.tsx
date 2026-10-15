import type { StudentQuizListItem } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, HelpCircle, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { quiz as quizApi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

function countdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Pill({ label, box, text, icon }: { label: string; box: string; text: string; icon?: typeof Clock }) {
  return (
    <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', box)}>
      {icon ? <Icon as={icon} className={cn('size-3', text)} /> : null}
      <Text className={cn('text-xs font-medium', text)}>{label}</Text>
    </View>
  );
}

/** Web QuizCard: status, due date, points; scheduled quizzes poll their lock state and count down. */
function QuizCard({ q }: { q: StudentQuizListItem }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_qz_${key}`, o);
  const scheduled = !!q.start_time;
  const watch = scheduled && !q.submitted;
  const status = useApi(watch ? ['student', 'quiz-status', q.id] : null, ([, , id]) => quizApi.getStudentQuizStatus(id as string), { refreshInterval: 5000 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!watch) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [watch]);

  const startMs = q.start_time ? new Date(q.start_time).getTime() : 0;
  const s = status.data;
  const unlocked = s ? s.unlocked : !scheduled || now >= startMs;
  const lockedOut = s?.locked_out ?? false;
  const beforeStart = scheduled && !unlocked && !lockedOut;
  const clickable = !lockedOut && unlocked;
  const due = q.assignment?.due_date;
  const overdue = !!due && new Date(due) < new Date();

  return (
    <Pressable onPress={() => clickable && router.push({ pathname: '/student/quizzes/[id]', params: { id: q.id } })} disabled={!clickable} accessibilityRole="button">
      <Card className={cn('py-4', !clickable && 'opacity-90')}>
        <CardContent className="flex-row items-start gap-3 px-4">
          <View className={cn('rounded-lg p-2', q.submitted ? 'bg-green-100' : lockedOut ? 'bg-red-100' : 'bg-primary/10')}>
            <Icon as={q.submitted ? CheckCircle2 : lockedOut ? XCircle : HelpCircle} className={cn('size-5', q.submitted ? 'text-green-600' : lockedOut ? 'text-red-600' : 'text-primary')} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold" numberOfLines={1}>
              {q.title}
            </Text>
            {q.description ? (
              <Text className="text-muted-foreground mt-0.5 text-sm" numberOfLines={2}>
                {q.description}
              </Text>
            ) : null}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {q.submitted ? (
                <Pill label={k('submitted')} box="bg-green-100" text="text-green-700" />
              ) : lockedOut ? (
                <Pill label={k('locked')} box="bg-red-100" text="text-red-700" />
              ) : beforeStart ? (
                <Pill label={k('starts_in', { time: countdown(startMs - now) })} box="bg-amber-100" text="text-amber-700" icon={Clock} />
              ) : (
                <Pill label={k('not_started')} box="bg-blue-100" text="text-blue-700" />
              )}
              {due ? <Pill label={overdue ? k('overdue', { date: formatDate(due) }) : k('due', { date: formatDate(due) })} box="border border-border" text={overdue ? 'text-red-600' : 'text-foreground'} icon={Clock} /> : null}
              {q.assignment?.points ? <Pill label={k('pts', { count: q.assignment.points })} box="border border-border" text="text-foreground" /> : null}
            </View>
            {beforeStart && q.start_time ? <Text className="text-muted-foreground mt-2 text-xs">{k('unlocks', { date: formatDateTime(q.start_time) })}</Text> : null}
          </View>
          {clickable ? <Icon as={ChevronRight} className="text-muted-foreground mt-1 size-5 rtl:rotate-180" /> : null}
        </CardContent>
      </Card>
    </Pressable>
  );
}

/** The student's quizzes: totals, pending and submitted (web: /student/quizzes). */
export default function StudentQuizzes() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_qz_${key}`, o);
  const list = useApi(['student', 'quizzes'], () => quizApi.getStudentQuizzes());

  if (list.isLoading) return <LoadingList rows={6} />;
  const all = list.data ?? [];
  const pending = all.filter((q) => !q.submitted);
  const done = all.filter((q) => q.submitted);

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {list.error ? (
          <View className="flex-row items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/30">
            <Icon as={AlertCircle} className="size-5 text-red-600" />
            <Text className="flex-1 text-sm text-red-700">{list.error.message}</Text>
          </View>
        ) : null}
        {all.length ? (
          <View className="flex-row gap-2">
            <Stat value={all.length} label={k('total')} />
            <Stat value={done.length} label={k('submitted')} tone="text-green-600" />
            <Stat value={pending.length} label={k('pending')} tone="text-blue-600" />
          </View>
        ) : null}
        {pending.length ? (
          <View className="gap-2">
            <Text className="text-lg font-semibold">{k('pending')}</Text>
            {pending.map((q) => (
              <QuizCard key={q.id} q={q} />
            ))}
          </View>
        ) : null}
        {done.length ? (
          <View className="gap-2">
            <Text className="text-lg font-semibold">{k('submitted')}</Text>
            {done.map((q) => (
              <QuizCard key={q.id} q={q} />
            ))}
          </View>
        ) : null}
        {!all.length && !list.error ? (
          <Card>
            <CardContent className="items-center p-10">
              <Icon as={HelpCircle} className="text-muted-foreground mb-3 size-12" />
              <Text className="mb-1 text-lg font-semibold">{k('empty')}</Text>
              <Text className="text-muted-foreground text-center text-sm">{k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <Card className="flex-1 py-3">
      <CardContent className="items-center px-2">
        <Text className={cn('text-2xl font-bold', tone)}>{String(value)}</Text>
        <Text className="text-muted-foreground mt-1 text-center text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
