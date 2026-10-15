import type { ReadingQuizQuestion, ReadingWordResult } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Headphones, Maximize2, Mic, MicOff, Minimize2, Minus, Pause, Play, Plus, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { readingBadge } from '@/features/speed-reading/badge';
import { audioPlayerFactory, speechModule } from '@/features/speed-reading/native';
import { adminSpeedReading, media } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

type Phase = 'setup' | 'reading' | 'manual-grade' | 'quiz' | 'result';
type Mark = ReadingWordResult['status'];
type Sub = { remove: () => void };

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Speed Reading session (web: /student/speed-reading/[textId]/read): choose the pace and mode,
 * read the scrolling text (voice mode checks each word with speech recognition and records the
 * reading; manual mode asks for the error count), answer the comprehension quiz, see the result.
 */
export default function SpeedReadingSession() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`speedReading.${k}`, o);
  const a = (k: string, o?: Record<string, unknown>) => t(`app.srs_${k}`, o);
  const { textId } = useLocalSearchParams<{ textId: string }>();
  const res = useApi(textId ? ['student', 'sr-text', textId] : null, ([, , id]) => adminSpeedReading.text(id as string));
  const text = res.data;

  const speech = speechModule();
  const [voiceOk, setVoiceOk] = useState(() => !!speech && speech.isRecognitionAvailable());
  const [voiceNote, setVoiceNote] = useState<string | null>(() => (speech ? null : 'voice_unavailable'));
  const [phase, setPhase] = useState<Phase>('setup');
  const [wpm, setWpm] = useState(80);
  const [mode, setMode] = useState<'voice' | 'manual'>(() => (speech && speech.isRecognitionAvailable() ? 'voice' : 'manual'));
  const [full, setFull] = useState(false);
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState<string[]>([]);
  const [manualErrors, setManualErrors] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [marks, setMarks] = useState<Mark[]>([]);
  const [result, setResult] = useState<{ correct: number; accuracy: number; points: number; bonus: boolean } | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const finalText = useRef('');
  const audioRef = useRef<string | null>(null);
  const subs = useRef<Sub[]>([]);
  const [progress] = useState(() => new Animated.Value(0));
  const at = useRef(0);
  const [boxH, setBoxH] = useState(0);
  const [textH, setTextH] = useState(0);
  const player = useRef<{ play: () => void; pause: () => void; remove: () => void } | null>(null);

  const words = text ? text.content.trim().split(/\s+/).filter(Boolean) : [];
  const durationMs = text ? Math.round((text.word_count / wpm) * 60 * 1000) : 0;
  const rtl = text?.language === 'ar';

  useEffect(
    () => () => {
      subs.current.forEach((x) => x.remove());
      player.current?.remove();
    },
    [],
  );

  function listen() {
    if (!speech || !text) return;
    subs.current.forEach((x) => x.remove());
    const m = speech as unknown as { addListener: (e: string, cb: (ev: never) => void) => Sub };
    subs.current = [
      m.addListener('result', (ev: { isFinal: boolean; results: { transcript: string }[] }) => {
        const tr = ev.results[0]?.transcript ?? '';
        if (ev.isFinal) finalText.current = `${finalText.current} ${tr}`.trim();
        const all = ev.isFinal ? finalText.current : `${finalText.current} ${tr}`.trim();
        setSpoken(all.split(/\s+/).filter(Boolean));
      }),
      m.addListener('audioend', (ev: { uri: string | null }) => {
        if (ev.uri) {
          audioRef.current = ev.uri;
          setAudioUri(ev.uri);
        }
      }),
      m.addListener('error', (ev: { error: string }) => {
        if (ev.error === 'aborted' || ev.error === 'no-speech') return;
        setVoiceOk(false);
        setMode('manual');
      }),
      m.addListener('end', () => setListening(false)),
    ];
    speech.start({ lang: text.language === 'ar' ? 'ar-SA' : 'en-US', interimResults: true, continuous: true, recordingOptions: { persist: true } });
    setListening(true);
  }

  function stopListening() {
    speech?.stop();
    setListening(false);
  }

  function end() {
    stopListening();
    if (!text) return;
    if (mode === 'manual') setPhase('manual-grade');
    else if (text.quiz_questions?.length) setPhase('quiz');
    else finalise(false);
  }

  function stopEarly() {
    progress.stopAnimation();
    setPaused(false);
    end();
  }

  async function finalise(bonus: boolean) {
    if (!text) return;
    const total = text.word_count;
    let computed: Mark[] = [];
    let correct: number;
    if (mode === 'voice') {
      computed = words.map((w, i) => (i >= spoken.length ? 'unread' : norm(spoken[i]) === norm(w) ? 'correct' : 'incorrect'));
      correct = computed.filter((m) => m === 'correct').length;
    } else {
      correct = Math.max(0, total - manualErrors);
    }
    setMarks(computed);
    const incorrect = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100 * 100) / 100 : 0;
    const base = Math.round(correct * (wpm < 80 ? 1 : wpm < 120 ? 1.5 : 2));
    setResult({ correct, accuracy, points: bonus ? base * 2 : base, bonus });
    setPhase('result');
    try {
      let uploaded: string | undefined;
      // The recording file is announced (audioend) a moment after recognition stops.
      for (let i = 0; mode === 'voice' && !audioRef.current && i < 20; i++) await new Promise((r) => setTimeout(r, 100));
      const uri = audioRef.current;
      if (mode === 'voice' && uri) {
        const up = await media.uploadRecording({ uri, name: 'reading.wav', type: 'audio/wav' });
        if (up.success && up.data?.url) uploaded = up.data.url;
      }
      const r = await adminSpeedReading.submitLog({
        text_id: text.id,
        target_wpm: wpm,
        correct_words: correct,
        incorrect_words: incorrect,
        accuracy_percentage: accuracy,
        comprehension_bonus: bonus,
        grading_mode: mode,
        audio_url: uploaded,
        word_results: mode === 'voice' && computed.length ? words.map((word, i) => ({ word, status: computed[i] ?? 'unread' })) : undefined,
      });
      if (!r.success) setSaveFailed(true);
    } catch {
      setSaveFailed(true);
    }
  }

  function animate(fromAt: number) {
    const total = durationMs * 2;
    progress.setValue(fromAt);
    Animated.timing(progress, { toValue: 1, duration: Math.max(0, (1 - fromAt) * total), easing: Easing.linear, useNativeDriver: true }).start(({ finished }) => {
      if (finished) end();
    });
  }

  async function start() {
    if (!text) return;
    if (mode === 'voice' && speech) {
      const p = await speech.requestPermissionsAsync();
      if (!p.granted) {
        setVoiceOk(false);
        setMode('manual');
        setVoiceNote('mic_denied');
        return;
      }
      finalText.current = '';
      audioRef.current = null;
      setSpoken([]);
      listen();
    }
    at.current = 0;
    setPaused(false);
    setPhase('reading');
  }

  // Start scrolling once the text is laid out.
  const ready = phase === 'reading' && boxH > 0 && textH > 0;
  useEffect(() => {
    if (ready) animate(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function togglePause() {
    if (paused) {
      animate(at.current);
      if (mode === 'voice') listen();
      setPaused(false);
    } else {
      progress.stopAnimation((v) => {
        at.current = v;
      });
      if (mode === 'voice') stopListening();
      setPaused(true);
    }
  }

  function submitQuiz(qs: ReadingQuizQuestion[]) {
    finalise(qs.every((q, i) => answers[i] === q.correct_ans));
  }

  function togglePlay() {
    if (!audioUri) return;
    if (playing) {
      player.current?.pause();
      setPlaying(false);
      return;
    }
    const make = audioPlayerFactory();
    if (!make) return;
    if (!player.current) player.current = make(audioUri);
    player.current.play();
    setPlaying(true);
  }

  function again() {
    setPhase('setup');
    setSpoken([]);
    setAnswers({});
    setManualErrors(0);
    setMarks([]);
    setResult(null);
    setAudioUri(null);
    audioRef.current = null;
    setSaveFailed(false);
    player.current?.remove();
    player.current = null;
    setPlaying(false);
  }

  if (res.isLoading) return <LoadingList rows={4} />;
  if (!text) return <Text className="text-muted-foreground p-6 text-center">{a('text_not_found')}</Text>;

  if (phase === 'setup') {
    return (
      <>
        <Stack.Screen options={{ title: text.title }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-5 p-4 pb-10">
          <Text className="text-muted-foreground text-sm">{`${a('words', { count: text.word_count })} · ${text.language === 'ar' ? s('languageAr') : s('languageEn')}`}</Text>
          <View className="gap-2">
            <Label>
              {`${s('wpmLabel')}: `}
              <Text className="text-primary font-semibold">{String(wpm)}</Text>
            </Label>
            <View className="flex-row items-center gap-3">
              <Button size="icon" variant="outline" onPress={() => setWpm((w) => Math.max(40, w - 5))} accessibilityLabel={a('decrease')}>
                <Icon as={Minus} className="size-4" />
              </Button>
              <View className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <View className="bg-primary h-full" style={{ width: `${((wpm - 40) / 160) * 100}%` }} />
              </View>
              <Button size="icon" variant="outline" onPress={() => setWpm((w) => Math.min(200, w + 5))} accessibilityLabel={a('increase')}>
                <Icon as={Plus} className="size-4" />
              </Button>
            </View>
            <Text className="text-muted-foreground text-xs">{s('wpmHint')}</Text>
            <Text className="text-muted-foreground text-xs">{a('duration', { seconds: Math.round(durationMs / 1000) })}</Text>
          </View>
          <View className="gap-2">
            <Label>{s('readingMode')}</Label>
            <View className="flex-row flex-wrap gap-2">
              <Button size="sm" variant={mode === 'voice' ? 'default' : 'outline'} disabled={!voiceOk} onPress={() => setMode('voice')}>
                <Icon as={Mic} className={cn('size-4', mode === 'voice' && 'text-primary-foreground')} />
                <Text>{s('voiceMode')}</Text>
              </Button>
              <Button size="sm" variant={mode === 'manual' ? 'default' : 'outline'} onPress={() => setMode('manual')}>
                <Icon as={MicOff} className={cn('size-4', mode === 'manual' && 'text-primary-foreground')} />
                <Text>{s('manualMode')}</Text>
              </Button>
            </View>
            {!voiceOk ? <Text className="text-xs text-amber-600">{voiceNote ? a(voiceNote) : s('voiceNotSupported')}</Text> : null}
            {mode === 'voice' ? <Text className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-600 dark:bg-blue-950/30">{a('record_note')}</Text> : null}
            {mode === 'manual' ? <Text className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-600 dark:bg-amber-950/30">{a('manual_note')}</Text> : null}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button onPress={start}>
              <Icon as={Play} className="text-primary-foreground size-4" />
              <Text>{s('startSession')}</Text>
            </Button>
            <Button variant="outline" onPress={() => setFull((f) => !f)}>
              <Icon as={full ? Minimize2 : Maximize2} className="size-4" />
              <Text>{s('smartboardMode')}</Text>
            </Button>
            <Button variant="ghost" onPress={() => router.back()}>
              <Text>{a('cancel')}</Text>
            </Button>
          </View>
        </ScrollView>
      </>
    );
  }

  if (phase === 'reading') {
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [boxH, -textH] });
    return (
      <View className="flex-1 bg-neutral-950">
        <Stack.Screen options={{ headerShown: !full, title: text.title }} />
        <View className="flex-row flex-wrap items-center justify-between gap-2 bg-neutral-950/80 px-4 py-3" style={full ? { paddingTop: 48 } : undefined}>
          <Badge variant="outline" className="border-white/30">
            <Text className="text-white">{a('wpm', { wpm })}</Text>
          </Badge>
          {listening && !paused ? (
            <View className="flex-row items-center gap-1">
              <Icon as={Mic} className="size-3 text-green-400" />
              <Text className="text-xs text-green-400">{s('listeningActive')}</Text>
            </View>
          ) : null}
          {paused ? (
            <View className="flex-row items-center gap-1">
              <Icon as={Pause} className="size-3 text-yellow-400" />
              <Text className="text-xs text-yellow-400">{a('paused')}</Text>
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable onPress={togglePause} className="flex-row items-center gap-1 rounded-md border border-yellow-400 px-3 py-1.5" accessibilityRole="button">
              <Icon as={paused ? Play : Pause} className="size-4 text-yellow-400" />
              <Text className="text-sm text-yellow-400">{paused ? a('resume') : a('pause')}</Text>
            </Pressable>
            <Pressable onPress={stopEarly} className="flex-row items-center gap-1 rounded-md border border-red-400 px-3 py-1.5" accessibilityRole="button">
              <Icon as={Square} className="size-4 text-red-400" />
              <Text className="text-sm text-red-400">{s('stopSession')}</Text>
            </Pressable>
            <Pressable onPress={() => setFull((f) => !f)} className="p-1.5" accessibilityRole="button" accessibilityLabel={full ? a('exit_smartboard') : s('smartboardMode')}>
              <Icon as={full ? Minimize2 : Maximize2} className="size-4 text-white" />
            </Pressable>
          </View>
        </View>
        <View className="flex-1 overflow-hidden px-6" onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}>
          <Animated.View style={{ transform: [{ translateY }] }} onLayout={(e) => setTextH(e.nativeEvent.layout.height)}>
            <Text className={cn('text-2xl leading-relaxed', rtl && 'text-right')} style={{ writingDirection: rtl ? 'rtl' : 'ltr' }}>
              {words.map((w, i) => {
                let tone = 'text-white/70';
                if (mode === 'voice' && i < spoken.length) tone = norm(spoken[i]) === norm(w) ? 'font-semibold text-green-400' : 'text-red-400';
                else if (mode === 'voice' && i === spoken.length) tone = 'text-yellow-300 underline';
                return (
                  <Text key={i} className={cn('text-2xl', tone)}>
                    {`${w} `}
                  </Text>
                );
              })}
            </Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  if (phase === 'manual-grade') {
    return (
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-6 p-6">
        <Stack.Screen options={{ headerShown: true, title: text.title }} />
        <View className="items-center gap-2">
          <Text className="text-4xl">✅</Text>
          <Text className="text-xl font-bold">{a('complete')}</Text>
          <Text className="text-muted-foreground text-center text-sm">{a('how_many')}</Text>
        </View>
        <View className="gap-3">
          <Label>{s('incorrectWords')}</Label>
          <View className="flex-row items-center gap-3">
            <Button size="icon" variant="outline" className="rounded-full" onPress={() => setManualErrors((e) => Math.max(0, e - 1))} accessibilityLabel={a('decrease')}>
              <Icon as={Minus} className="size-4" />
            </Button>
            <Input
              className="h-12 w-24 text-center text-2xl font-bold"
              keyboardType="number-pad"
              value={String(manualErrors)}
              onChangeText={(v) => setManualErrors(Math.max(0, Math.min(text.word_count, Number(v.replace(/\D/g, '')) || 0)))}
            />
            <Button size="icon" variant="outline" className="rounded-full" onPress={() => setManualErrors((e) => Math.min(text.word_count, e + 1))} accessibilityLabel={a('increase')}>
              <Icon as={Plus} className="size-4" />
            </Button>
          </View>
          <Text className="text-muted-foreground text-xs">{a('totals', { total: text.word_count, correct: Math.max(0, text.word_count - manualErrors) })}</Text>
        </View>
        <Button onPress={() => (text.quiz_questions?.length ? setPhase('quiz') : finalise(false))}>
          <Text>{a('submit_score')}</Text>
        </Button>
      </ScrollView>
    );
  }

  if (phase === 'quiz' && text.quiz_questions) {
    const qs = text.quiz_questions;
    return (
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Stack.Screen options={{ headerShown: true, title: s('comprehensionQuiz') }} />
        <Text className="text-muted-foreground text-sm">{s('comprehensionInstructions')}</Text>
        {qs.map((q, i) => {
          const opts = [
            { key: 'a', text: q.option_a },
            { key: 'b', text: q.option_b },
            ...(q.option_c ? [{ key: 'c', text: q.option_c }] : []),
            ...(q.option_d ? [{ key: 'd', text: q.option_d }] : []),
          ];
          return (
            <View key={i} className="border-border gap-2 rounded-lg border p-3">
              <Text className="font-medium">{`${i + 1}. ${q.question}`}</Text>
              {opts.map((o) => {
                const on = answers[i] === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setAnswers((p) => ({ ...p, [i]: o.key }))}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    className={cn('rounded-md border px-3 py-2', on ? 'bg-primary border-primary' : 'border-border')}>
                    <Text className={cn('text-sm', on && 'text-primary-foreground')}>
                      <Text className={cn('text-sm font-semibold uppercase', on && 'text-primary-foreground')}>{`${o.key}. `}</Text>
                      {o.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
        <Button onPress={() => submitQuiz(qs)} disabled={Object.keys(answers).length < qs.length}>
          <Text>{s('submitQuiz')}</Text>
        </Button>
      </ScrollView>
    );
  }

  const badge = readingBadge(wpm);
  const counts = { correct: marks.filter((m) => m === 'correct').length, incorrect: marks.filter((m) => m === 'incorrect').length, unread: marks.filter((m) => m === 'unread').length };
  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="items-center gap-5 p-4 pb-10">
      <Stack.Screen options={{ headerShown: true, title: text.title }} />
      <Text className="text-5xl">{result?.bonus ? '🎉' : '✅'}</Text>
      <Text className="text-2xl font-bold">{s('sessionComplete')}</Text>
      <View className="w-full flex-row flex-wrap gap-3">
        <ResultTile label={s('pointsEarned')} value={a('pts', { count: result?.points ?? 0 })} highlight />
        <ResultTile label={s('accuracy')} value={`${result?.accuracy ?? 0}%`} />
        <ResultTile label={s('wordsReadCorrectly')} value={String(result?.correct ?? 0)} />
        <ResultTile label="WPM" value={String(wpm)} />
      </View>
      {result?.bonus ? (
        <View className="w-full flex-row items-center justify-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
          <Icon as={CheckCircle2} className="size-5 text-green-600" />
          <Text className="font-medium text-green-600">{`${s('comprehensionBonus')} ×2!`}</Text>
        </View>
      ) : null}
      <View className="items-center">
        <Text className="mb-1 text-4xl">{badge.emoji}</Text>
        <Badge variant="outline">
          <Text>{a(`badge_${badge.key}`)}</Text>
        </Badge>
      </View>
      {saveFailed ? <Text className="text-sm text-red-600">{a('save_failed')}</Text> : null}
      {audioUri && audioPlayerFactory() ? (
        <View className="bg-muted/40 border-border w-full gap-2 rounded-lg border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Headphones} className="text-primary size-4" />
            <Text className="text-sm font-semibold">{a('listen')}</Text>
          </View>
          <Button variant="outline" size="sm" className="self-start" onPress={togglePlay}>
            <Icon as={playing ? Pause : Play} className="size-4" />
            <Text>{playing ? a('stop') : a('play')}</Text>
          </Button>
        </View>
      ) : null}
      {mode === 'voice' && marks.length ? (
        <View className="bg-muted/40 border-border w-full gap-3 rounded-lg border p-4">
          <Text className="text-sm font-semibold">{a('word_review')}</Text>
          <Text className={cn('text-sm leading-loose', rtl && 'text-right')} style={{ writingDirection: rtl ? 'rtl' : 'ltr' }}>
            {words.map((w, i) => {
              const m = marks[i] ?? 'unread';
              return (
                <Text key={i} className={cn('text-sm', m === 'correct' ? 'font-medium text-green-600' : m === 'incorrect' ? 'font-medium text-red-500' : 'text-muted-foreground')}>
                  {`${w} `}
                </Text>
              );
            })}
          </Text>
          <View className="flex-row flex-wrap gap-4">
            <Legend tone="bg-green-500" label={a('correct_n', { count: counts.correct })} />
            <Legend tone="bg-red-500" label={a('incorrect_n', { count: counts.incorrect })} />
            <Legend tone="bg-gray-400" label={a('unread_n', { count: counts.unread })} />
          </View>
        </View>
      ) : null}
      <View className="flex-row flex-wrap justify-center gap-3">
        <Button onPress={() => router.replace('/student/speed-reading')}>
          <Text>{s('viewLeaderboard')}</Text>
        </Button>
        <Button variant="outline" onPress={again}>
          <Text>{s('readAnother')}</Text>
        </Button>
      </View>
    </ScrollView>
  );
}

function ResultTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className={cn('min-w-[45%] flex-1 items-center rounded-lg p-4', highlight ? 'bg-primary/10 border-primary/20 border' : 'bg-muted/50')}>
      <Text className={cn('text-2xl font-bold', highlight && 'text-primary')}>{value}</Text>
      <Text className="text-muted-foreground mt-1 text-center text-xs">{label}</Text>
    </View>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-2.5 rounded-full', tone)} />
      <Text className="text-xs">{label}</Text>
    </View>
  );
}
