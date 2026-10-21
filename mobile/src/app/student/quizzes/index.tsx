import type { StudentQuizListItem } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, HelpCircle, ListTodo, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
    <View className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', box)}>
      {icon ? <Icon as={icon} className={cn('size-3', text)} /> : null}
      <Text className={cn('text-[11px] font-semibold', text)}>{label}</Text>
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
    <Pressable onPress={() => clickable && router.push({ pathname: '/student/quizzes/[id]', params: { id: q.id } })} disabled={!clickable} accessibilityRole="button" className="active:opacity-80">
      <Panel className={cn('flex-row items-start gap-3 p-4', !clickable && 'opacity-90')}>
        <IconTile icon={q.submitted ? CheckCircle2 : lockedOut ? XCircle : HelpCircle} tone={q.submitted ? 'success' : lockedOut ? 'destructive' : 'brand'} size={40} />
        <View className="flex-1 gap-0.5">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {q.title}
          </Text>
          {q.description ? (
            <Text className="text-muted-foreground text-xs" numberOfLines={2}>
              {q.description}
            </Text>
          ) : null}
          <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
            {q.submitted ? (
              <StatusChip label={k('submitted')} tone="success" />
            ) : lockedOut ? (
              <StatusChip label={k('locked')} tone="destructive" />
            ) : beforeStart ? (
              <Pill label={k('starts_in', { time: countdown(startMs - now) })} box="bg-warning-soft" text="text-warning" icon={Clock} />
            ) : (
              <StatusChip label={k('not_started')} tone="info" />
            )}
            {due ? <Pill label={overdue ? k('overdue', { date: formatDate(due) }) : k('due', { date: formatDate(due) })} box={overdue ? 'bg-destructive-soft' : 'bg-muted'} text={overdue ? 'text-destructive' : 'text-muted-foreground'} icon={Clock} /> : null}
            {q.assignment?.points ? <StatusChip label={k('pts', { count: q.assignment.points })} tone="muted" /> : null}
          </View>
          {beforeStart && q.start_time ? <Text className="text-muted-foreground mt-1.5 text-xs">{k('unlocks', { date: formatDateTime(q.start_time) })}</Text> : null}
        </View>
        {clickable ? <Icon flipRtl as={ChevronRight} className="text-muted-foreground mt-1 size-4" /> : null}
      </Panel>
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {list.error ? (
          <View className="border-destructive/30 bg-destructive-soft flex-row items-center gap-2 rounded-2xl border p-3">
            <Icon as={AlertCircle} className="text-destructive size-5" />
            <Text className="text-destructive flex-1 text-sm">{list.error.message}</Text>
          </View>
        ) : null}
        {all.length ? (
          <StatTiles>
            <StatTile icon={HelpCircle} label={k('total')} value={String(all.length)} />
            <StatTile icon={CheckCircle2} tone="success" label={k('submitted')} value={String(done.length)} />
            <StatTile icon={ListTodo} tone="warning" label={k('pending')} value={String(pending.length)} />
          </StatTiles>
        ) : null}
        {pending.length ? (
          <Section title={k('pending')}>
            {pending.map((q) => (
              <QuizCard key={q.id} q={q} />
            ))}
          </Section>
        ) : null}
        {done.length ? (
          <Section title={k('submitted')}>
            {done.map((q) => (
              <QuizCard key={q.id} q={q} />
            ))}
          </Section>
        ) : null}
        {!all.length && !list.error ? <EmptyState icon={HelpCircle} title={k('empty')} body={k('empty_body')} /> : null}
      </ScrollView>
    </>
  );
}
