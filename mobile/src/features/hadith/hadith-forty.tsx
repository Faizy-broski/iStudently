import type { HadithCategory, HadithContent, HadithModuleState, HadithProgress, HadithQuizGrade, HadithQuizQuestion } from '@studently/api-client';
import { Stack } from 'expo-router';
import { BookOpen, CalendarClock, Check, ChevronLeft, Flame, GraduationCap, Repeat, Settings2, Star, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { hadithForty } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'due' | 'learning' | 'mastered' | 'favorites';

const empty = (n: number): HadithProgress => ({ hadithNumber: n, repetitions: 0, state: 'new', box: 0, dueOn: null, lastReviewedOn: null, isFavorite: false, note: '' });
const isDue = (p: HadithProgress, today: string) => p.dueOn !== null && p.dueOn <= today;
/** Arabic-aware search: strips diacritics/tatweel, normalises alif/ya/ta marbuta. */
const normalise = (v: string) =>
  v
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();

function useHf() {
  const { t } = useTranslation();
  return (k: string, o?: Record<string, unknown>) => t(`hadithForty.${k}`, o);
}

function Tile({ icon, value, label, highlight }: { icon: LucideIcon; value: number; label: string; highlight?: boolean }) {
  return (
    <Card className={cn('w-[48.5%]', highlight && 'border-primary')}>
      <CardContent className="gap-1 pt-4">
        <Icon as={icon} className="text-primary size-4" />
        <Text className="text-2xl font-bold">{value}</Text>
        <Text className="text-muted-foreground text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}

/** This week's repetitions as bars; the gear edits the daily goal and session size (web: ActivityBars). */
function Activity({ state, onSaved }: { state: HadithModuleState; onSaved: () => void }) {
  const h = useHf();
  const toast = useToast();
  const { campusId } = useCampus();
  const [editing, setEditing] = useState(false);
  const [goal, setGoal] = useState(String(state.settings.dailyGoal));
  const [cap, setCap] = useState(String(state.settings.sessionCap));
  const [saving, setSaving] = useState(false);
  const max = Math.max(1, ...state.activity.map((a) => a.repetitions), state.settings.dailyGoal);

  async function save() {
    setSaving(true);
    try {
      const r = await hadithForty.saveSettings({ dailyGoal: Number(goal), sessionCap: Number(cap) }, campusId);
      if (!r.success) return toast.error(r.error || h('settings.saveError'));
      toast.success(h('settings.saved'));
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="gap-3 pt-4">
        <View className="flex-row items-center">
          <Text className="flex-1 font-semibold">{h('activity.title')}</Text>
          <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8} className="p-1" accessibilityLabel={h('settings.save')}>
            <Icon as={Settings2} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
        {editing ? (
          <View className="gap-3">
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{h('settings.dailyGoal')}</Label>
                <Input value={goal} onChangeText={(v) => setGoal(v.replace(/\D/g, ''))} keyboardType="number-pad" />
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{h('settings.sessionCap')}</Label>
                <Input value={cap} onChangeText={(v) => setCap(v.replace(/\D/g, ''))} keyboardType="number-pad" />
              </View>
            </View>
            <Button size="sm" onPress={save} disabled={saving}>
              <Text>{h('settings.save')}</Text>
            </Button>
          </View>
        ) : (
          <View className="h-24 flex-row items-end gap-1.5">
            {state.activity.map((p) => (
              <View key={p.date} className="flex-1 items-center gap-1">
                <View className={cn('w-full rounded-t', p.goalMet ? 'bg-primary' : 'bg-primary/40')} style={{ height: Math.max(4, (p.repetitions / max) * 72) }} accessibilityLabel={`${p.date}: ${p.repetitions}`} />
                <Text className="text-muted-foreground text-[10px]">{p.date.slice(8, 10)}</Text>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

/** One hadith: text, narrator, source, note, repetitions, quiz, review (web: HadithSheet). */
function Sheet({
  number,
  content,
  progress,
  inSession,
  onClose,
  onNext,
  onChanged,
}: {
  number: number;
  content: HadithContent;
  progress: HadithProgress;
  inSession: boolean;
  onClose: () => void;
  onNext: () => void;
  onChanged: () => void;
}) {
  const h = useHf();
  const toast = useToast();
  const { campusId } = useCampus();
  const hadith = content.hadiths.find((x) => x.number === number);
  const narrator = hadith ? content.narrators[hadith.narratorId] : undefined;
  const [note, setNote] = useState(progress.note);
  const [phase, setPhase] = useState<'idle' | 'active' | 'graded'>('idle');
  const [attempt, setAttempt] = useState<string | null>(null);
  const [questions, setQuestions] = useState<HadithQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [grade, setGrade] = useState<HadithQuizGrade | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<{ success: boolean; error?: string; data?: T }>, ok?: (d: T | undefined) => void) {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.success) return toast.error(r.error || h('errors.generic'));
      ok?.(r.data);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const review = (outcome: 'pass' | 'fail') => run(() => hadithForty.review(number, outcome, campusId), () => toast.success(outcome === 'pass' ? h('review.passedToast') : h('review.failedToast')));
  const startQuiz = () =>
    run(
      () => hadithForty.startQuiz(number, campusId),
      (d) => {
        if (!d) return;
        setAttempt(d.attemptId);
        setQuestions(d.questions);
        setAnswers(d.questions.map(() => -1));
        setPhase('active');
      },
    );
  const submitQuiz = () => {
    const id = attempt;
    if (!id) return;
    return run(
      () => hadithForty.submitQuiz(id, answers, campusId),
      (d) => {
        if (!d) return;
        setGrade(d.grade);
        setPhase('graded');
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92%] w-[96vw] max-w-lg">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
            <DialogHeader>
              <View className="flex-row items-center gap-2">
                <DialogTitle className="flex-1">{hadith ? `${hadith.number}. ${hadith.title}` : '…'}</DialogTitle>
                <Pressable onPress={() => run(() => hadithForty.flags({ hadithNumber: number, isFavorite: !progress.isFavorite }, campusId))} hitSlop={8} className="p-1" accessibilityLabel={h('filters.favorites')}>
                  <Icon as={Star} className={cn('size-5', progress.isFavorite ? 'text-yellow-500' : 'text-muted-foreground')} fill={progress.isFavorite ? '#eab308' : 'none'} />
                </Pressable>
              </View>
            </DialogHeader>
            {!hadith ? (
              <LoadingList rows={3} />
            ) : phase === 'active' ? (
              questions.map((q, i) => (
                <View key={i} className="gap-2">
                  <Text className="font-medium">{q.body}</Text>
                  {q.options.map((opt, oi) => (
                    <Pressable key={oi} onPress={() => setAnswers((p) => p.map((x, j) => (j === i ? oi : x)))} className={cn('rounded-lg border p-2', answers[i] === oi ? 'border-primary bg-primary/10' : 'border-border')}>
                      <Text className="text-sm">{opt}</Text>
                    </Pressable>
                  ))}
                </View>
              ))
            ) : phase === 'graded' && grade ? (
              <View className="items-center gap-2 py-4">
                <Text className="text-3xl font-bold">
                  {grade.score} / {grade.total}
                </Text>
                <Text className={grade.passed ? 'text-green-600' : 'text-destructive'}>{grade.passed ? h('quiz.passed') : h('quiz.failed')}</Text>
              </View>
            ) : (
              <>
                <Badge variant="outline" className="self-start">
                  <Text className="text-xs">{h(`categories.${hadith.category}`)}</Text>
                </Badge>
                <Text className="text-xl leading-10" style={{ writingDirection: 'rtl', textAlign: 'right' }}>
                  {hadith.text}
                </Text>
                <View className="bg-muted/50 gap-1 rounded-md p-3">
                  {narrator?.name ? <Text className="font-medium">{narrator.name}</Text> : null}
                  {narrator?.bio ? <Text className="text-muted-foreground text-xs">{narrator.bio}</Text> : null}
                  <Text className="text-muted-foreground text-xs">{hadith.source}</Text>
                </View>
                <Input
                  value={note}
                  onChangeText={setNote}
                  onBlur={() => note !== progress.note && run(() => hadithForty.flags({ hadithNumber: number, note }, campusId))}
                  placeholder={h('sheet.notePlaceholder')}
                  multiline
                  className="min-h-16"
                  textAlignVertical="top"
                />
              </>
            )}
            {phase === 'idle' && hadith ? (
              <View className="gap-2">
                <View className="flex-row gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onPress={() => run(() => hadithForty.repetition(number, campusId))} disabled={busy}>
                    <Icon as={Repeat} className="text-foreground size-4" />
                    <Text>{h('card.repetitionCount', { count: progress.repetitions })}</Text>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onPress={startQuiz} disabled={busy}>
                    <Icon as={GraduationCap} className="text-foreground size-4" />
                    <Text>{h('sheet.startQuiz')}</Text>
                  </Button>
                </View>
                <View className="flex-row gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onPress={() => review('fail')} disabled={busy}>
                    <Icon as={X} className="text-foreground size-4" />
                    <Text>{h('review.fail')}</Text>
                  </Button>
                  <Button size="sm" className="flex-1" onPress={() => review('pass')} disabled={busy}>
                    <Icon as={Check} className="text-primary-foreground size-4" />
                    <Text>{h('review.pass')}</Text>
                  </Button>
                </View>
                {inSession ? (
                  <Button variant="secondary" size="sm" onPress={onNext}>
                    <Icon as={ChevronLeft} className="text-foreground size-4 ltr:rotate-180" />
                    <Text>{h('sheet.next')}</Text>
                  </Button>
                ) : null}
              </View>
            ) : phase === 'active' ? (
              <Button onPress={submitQuiz} disabled={busy || answers.includes(-1)}>
                <Text>{h('quiz.submit')}</Text>
              </Button>
            ) : phase === 'graded' ? (
              <Button onPress={() => setPhase('idle')}>
                <Text>{h('quiz.done')}</Text>
              </Button>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </DialogContent>
    </Dialog>
  );
}

/** Hadith Forty: progress, today's session, filters, the 42 hadith (web: HadithFortyApp, same for every role). */
export function HadithFortyScreen() {
  const h = useHf();
  const { t } = useTranslation();
  const { campusId } = useCampus();
  const stateRes = useApi(['admin', 'hadith-state', campusId ?? 'school'], () => hadithForty.state(campusId));
  const contentRes = useApi(['admin', 'hadith-content', campusId ?? 'school'], () => hadithForty.content(campusId));
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<HadithCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [session, setSession] = useState<number[] | null>(null);

  const state = stateRes.data;
  const content = contentRes.data;
  if (stateRes.isLoading || contentRes.isLoading) return <LoadingList rows={6} />;
  if (!state || !content) return <ErrorState message={h('error.load')} onRetry={() => (stateRes.mutate(), contentRes.mutate())} />;

  const byNumber = new Map(state.progress.map((p) => [p.hadithNumber, p]));
  const progressOf = (n: number) => byNumber.get(n) ?? empty(n);
  const needle = query.trim() ? normalise(query.trim()) : '';
  const visible = content.hadiths.filter((x) => {
    const p = progressOf(x.number);
    if (filter === 'due' && !isDue(p, state.today)) return false;
    if (filter === 'learning' && p.state !== 'learning') return false;
    if (filter === 'mastered' && p.state !== 'mastered') return false;
    if (filter === 'favorites' && !p.isFavorite) return false;
    if (category !== 'all' && x.category !== category) return false;
    if (needle && !normalise(`${x.title} ${x.text} ${x.source}`).includes(needle)) return false;
    return true;
  });
  const headline =
    state.stats.mastered === state.stats.total
      ? h('stats.completed')
      : state.streak > 1
        ? h('stats.streak', { days: state.streak })
        : state.stats.mastered === 0 && state.stats.totalRepetitions === 0
          ? h('stats.notStarted')
          : h('stats.keepGoing');

  const next = () => {
    if (!session || open === null) return;
    const following = session[session.indexOf(open) + 1];
    if (following === undefined) {
      setSession(null);
      setOpen(null);
    } else setOpen(following);
  };

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: t('app.hf_title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => stateRes.mutate()} />}>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row items-end justify-between">
              <Text className="flex-1 font-semibold">{headline}</Text>
              <View className="items-end">
                <Text className="text-primary text-3xl font-extrabold">{state.stats.masteryPercent}%</Text>
                <Text className="text-muted-foreground text-xs">{h('stats.mastery')}</Text>
              </View>
            </View>
            <View className="bg-muted h-2 overflow-hidden rounded-full">
              <View className="bg-primary h-full rounded-full" style={{ width: `${state.stats.masteryPercent}%` }} />
            </View>
            <Text className="text-muted-foreground text-xs">{h('stats.masteredOf', { mastered: state.stats.mastered, total: state.stats.total })}</Text>
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                disabled={!state.session.length}
                onPress={() => {
                  setSession(state.session);
                  setOpen(state.session[0] ?? null);
                }}>
                <Icon as={CalendarClock} className="text-primary-foreground size-4" />
                <Text>{h('actions.startSession')}</Text>
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  const target = content.hadiths.find((x) => isDue(progressOf(x.number), state.today)) ?? content.hadiths.find((x) => progressOf(x.number).state !== 'mastered') ?? content.hadiths[0];
                  if (target) setOpen(target.number);
                }}>
                <Icon as={BookOpen} className="text-foreground size-4" />
                <Text>{h('actions.resume')}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
        <Activity key={`${state.settings.dailyGoal}-${state.settings.sessionCap}`} state={state} onSaved={() => stateRes.mutate()} />
        <View className="flex-row flex-wrap justify-between gap-y-2">
          <Tile icon={BookOpen} value={state.stats.mastered} label={h('stats.mastered')} />
          <Tile icon={Flame} value={state.stats.learning} label={h('stats.learning')} />
          <Tile icon={Repeat} value={state.stats.totalRepetitions} label={h('stats.repetitions')} />
          <Tile icon={CalendarClock} value={state.stats.dueToday} label={h('stats.dueToday')} highlight />
        </View>
        <SearchBar value={query} onChangeText={setQuery} placeholder={h('filters.search')} />
        <Picker value={category} onChange={(v) => setCategory(v as HadithCategory | 'all')} options={[{ value: 'all', label: h('filters.allCategories') }, ...content.categories.map((c) => ({ value: c, label: h(`categories.${c}`) }))]} />
        <FilterChips value={filter} onChange={setFilter} options={(['all', 'due', 'learning', 'mastered', 'favorites'] as const).map((k) => ({ value: k, label: h(`filters.${k}`) }))} />
        {!visible.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{h('filters.empty')}</Text>
        ) : (
          visible.map((x) => {
            const p = progressOf(x.number);
            return (
              <Pressable key={x.number} onPress={() => setOpen(x.number)} className="border-border flex-row items-center gap-3 rounded-xl border p-3">
                <View className={cn('size-11 items-center justify-center rounded-lg', p.state === 'mastered' ? 'bg-primary' : p.state === 'learning' ? 'bg-primary/15' : 'bg-muted')}>
                  <Text className={cn('font-extrabold', p.state === 'mastered' ? 'text-primary-foreground' : p.state === 'learning' ? 'text-primary' : 'text-muted-foreground')}>{x.number}</Text>
                </View>
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="flex-1 font-medium" numberOfLines={1}>
                      {x.title}
                    </Text>
                    {p.isFavorite ? <Icon as={Star} className="size-3.5 text-yellow-500" fill="#eab308" /> : null}
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-muted-foreground text-xs">{h('card.repetitionCount', { count: p.repetitions })}</Text>
                    {isDue(p, state.today) ? <Text className="text-xs font-semibold text-amber-600">{h('card.dueBadge')}</Text> : null}
                    <Text className="text-muted-foreground text-xs">{h(`card.state.${p.state}`)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      {open !== null ? (
        <Sheet
          key={open}
          number={open}
          content={content}
          progress={progressOf(open)}
          inSession={!!session}
          onClose={() => {
            setOpen(null);
            setSession(null);
          }}
          onNext={next}
          onChanged={() => stateRes.mutate()}
        />
      ) : null}
    </View>
  );
}
