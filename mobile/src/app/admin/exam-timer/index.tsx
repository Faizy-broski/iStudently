import {
  JT_TEXT, JT_UNLOCK_MS, jtAddTime, jtAlertSpeech, jtClock, jtDisplayFor, jtDueAlerts, jtEndsAt, jtExitAllowed, jtFinish, jtLangFor, jtLocked, jtPause, jtProgress,
  jtRemaining, jtReset, jtResume, jtRules, jtStart, jtStatus, jtTick, jtTimeOfDay, type JtEvent, type JtTrack,
} from '@studently/shared-utils';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { DoorOpen, Lock, LockOpen, Megaphone, Minus, Pause, Play, Plus, RotateCcw, Settings2, Square, Users, Volume2 } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useConfirm } from '@/components/app/confirm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { playAlert, setKeepAwake } from '@/features/exam-timer/media';
import { getTimer, readSchool, saveSchool, setTimer, updateTimer, useTimer } from '@/features/exam-timer/store';
import { useJg } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

/**
 * Exam room timer («مؤقت امتحانات جهبذ», brief Part D; web: /admin/exam-timer). A full-screen board for
 * a tablet or phone in the exam room; works offline and resumes after a restart.
 */
export default function ExamTimer() {
  const { t, i18n } = useTranslation();
  const uiLang = i18n.language;
  const uiLangRef = useRef(uiLang);
  useEffect(() => {
    uiLangRef.current = uiLang;
  }, [uiLang]);
  const confirm = useConfirm();
  const { base, campusId } = useJg();
  const state = useTimer();
  const [now, setNow] = useState(() => Date.now());
  const [pinOpen, setPinOpen] = useState(false);
  const [noiseOn, setNoiseOn] = useState(false);
  const [school, setSchool] = useState(readSchool);
  const { width } = useWindowDimensions();

  // School name and logo from the Jahbadh header, cached for offline use.
  useEffect(() => {
    let alive = true;
    jahbadhGrades
      .settings(campusId)
      .then((res) => {
        if (!alive || !res.success || !res.data) return;
        const h = res.data.header ?? {};
        const next = { name: h.school_name ?? '', logo: h.logo_url ?? '' };
        saveSchool(next);
        setSchool(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [campusId]);

  // Clock: auto-start, auto-finish and voice alerts come from the time, never from tick counts.
  useEffect(() => {
    const id = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const cur = getTimer();
      let next = jtTick(cur, ts) ?? cur;
      const { due, stale } = jtDueAlerts(next.tracks, ts, next.fired, next.exitRule);
      if (due.length || stale.length) {
        const lang = jtLangFor(next, uiLangRef.current);
        for (const a of due) playAlert(next.voice, a.key, jtAlertSpeech(a.key, lang, next.tracks[a.track]?.subject), lang);
        const exits: JtEvent[] = due.filter((a) => a.key === 'exit').map((a) => ({ at: ts, kind: 'exit_allowed', track: a.track }));
        next = { ...next, fired: [...next.fired, ...due.map((a) => a.id), ...stale], events: [...next.events, ...exits] };
      }
      if (next !== cur) setTimer(next);
    }, 250);
    return () => clearInterval(id);
  }, []);

  const lang = jtLangFor(state, uiLang);
  const T = JT_TEXT[lang];
  const locked = jtLocked(state, now);
  const display = jtDisplayFor(state.display, state.tracks);
  const running = state.tracks.some((x) => jtStatus(x, now) === 'running');
  useEffect(() => {
    setKeepAwake(running);
    return () => setKeepAwake(false);
  }, [running]);

  const setTrack = (i: number, fn: (x: JtTrack) => JtTrack, kind?: JtEvent['kind'], minutes?: number) =>
    updateTimer((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? fn(x) : x)) }), kind ? { kind, track: i, minutes } : undefined);
  const extrasOf = useMemo(() => (i: number) => state.extras.filter((x) => x.track === i), [state.extras]);
  const wide = width >= 700;
  const big = state.tracks.length === 1 ? Math.min(width * 0.2, 180) : wide ? Math.min(width / state.tracks.length / 4, 110) : 72;
  const rtl = lang === 'ar';

  return (
    <>
      <Stack.Screen
        options={{
          title: T.title[state.assessment],
          headerRight: () => (
            <View className="flex-row">
              {state.pin ? (
                <Pressable onPress={() => (locked ? setPinOpen(true) : updateTimer((s) => ({ ...s, unlockedUntil: 0 })))} accessibilityRole="button" accessibilityLabel={t('examTimer.unlock')} className="p-2">
                  <Icon as={locked ? Lock : LockOpen} className={cn('size-5', locked ? 'text-foreground' : 'text-success')} />
                </Pressable>
              ) : null}
              <Pressable disabled={locked} onPress={() => router.push(`${base}/exam-timer/settings` as never)} accessibilityRole="button" accessibilityLabel={t('examTimer.settings')} className="p-2">
                <Icon as={Settings2} className={cn('size-5', locked ? 'text-muted-foreground' : 'text-brand dark:text-brand-secondary')} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <View className="flex-row items-center gap-3">
          {school.logo ? <Image source={{ uri: school.logo }} style={{ width: 48, height: 48 }} contentFit="contain" /> : null}
          <View className="flex-1">
            {school.name ? (
              <Text variant="muted" className="text-xs">
                {school.name}
              </Text>
            ) : null}
            <Text className="text-xl font-black">{`${T.title[state.assessment]}${state.period ? ` — ${state.period}` : ''}`}</Text>
            {state.room ? (
              <Text variant="muted" className="text-xs">{`${rtl ? 'القاعة' : 'Room'} ${state.room}`}</Text>
            ) : null}
          </View>
          <Text className="font-mono text-2xl font-bold">{jtTimeOfDay(now)}</Text>
        </View>

        {state.announcement ? (
          <View className="bg-warning/15 flex-row items-center gap-3 rounded-xl px-4 py-3">
            <Icon as={Megaphone} className="text-warning size-6" />
            <Text className="text-warning flex-1 text-lg font-bold">{state.announcement}</Text>
          </View>
        ) : null}

        <View className={cn('gap-4', wide && 'flex-row')}>
          {state.tracks.map((tr, i) => {
            const st = jtStatus(tr, now);
            const rem = jtRemaining(tr, now);
            const ends = jtEndsAt(tr, now);
            const exit = state.exitRule !== 'off' && tr.startedAt !== null ? jtExitAllowed(tr, now, state.exitRule) : null;
            const warn = st === 'running' && rem <= 5 * 60_000;
            const idle = st === 'idle' || st === 'scheduled';
            const label = jtClock(idle ? (tr.durationMin + tr.addedMin) * 60_000 : rem);
            return (
              <View key={tr.id} className="bg-card border-border flex-1 items-center gap-3 rounded-2xl border p-4">
                <Text className="text-center text-base font-bold">{[tr.grade, tr.subject].filter(Boolean).join(' — ') || `${rtl ? 'المسار' : 'Track'} ${i + 1}`}</Text>
                {display === 'ring' ? (
                  <Ring size={Math.min(width - 64, 320)} progress={idle ? 1 : jtProgress(tr, now)} warn={warn} label={label} />
                ) : (
                  <Text className={cn('font-mono font-black', warn ? 'text-destructive' : 'text-foreground')} style={{ fontSize: big, lineHeight: big * 1.1 }}>
                    {label}
                  </Text>
                )}
                <Text variant="muted" className="text-center text-sm">
                  {`${st === 'running' && ends ? `${T.endsAt} ${jtTimeOfDay(ends)}` : st === 'paused' ? T.paused : st === 'finished' ? T.finished : st === 'scheduled' && tr.scheduledAt ? `${T.startsAt} ${jtTimeOfDay(tr.scheduledAt)}` : T.notStarted}${tr.addedMin ? ` · ${T.extraTime} ${tr.addedMin > 0 ? '+' : ''}${tr.addedMin}` : ''}`}
                </Text>
                {exit !== null ? (
                  <View className={cn('flex-row items-center gap-2 rounded-full px-4 py-1.5', exit ? 'bg-success/15' : 'bg-destructive/10')}>
                    <Icon as={DoorOpen} className={cn('size-5', exit ? 'text-success' : 'text-destructive')} />
                    <Text className={cn('text-base font-bold', exit ? 'text-success' : 'text-destructive')}>{exit ? T.exitAllowed : T.exitNotYet}</Text>
                  </View>
                ) : null}
                {tr.startedAt !== null && extrasOf(i).length ? (
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {extrasOf(i).map((x) => {
                      const e = jtEndsAt(tr, now, x.minutes);
                      return (
                        <View key={x.seat} className="bg-muted rounded-md px-2 py-1">
                          <Text className="text-xs">{`${T.seat} ${x.seat} +${x.minutes} · ${jtClock(jtRemaining(tr, now, x.minutes))}${e ? ` (${jtTimeOfDay(e)})` : ''}`}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                {!locked ? (
                  <View className="flex-row flex-wrap justify-center gap-2">
                    {idle ? (
                      <Button size="sm" onPress={() => setTrack(i, (x) => jtStart(x, Date.now()), 'start')}>
                        <Icon as={Play} className="text-primary-foreground size-4" />
                        <Text>{t('examTimer.start')}</Text>
                      </Button>
                    ) : st === 'running' ? (
                      <Button size="sm" variant="outline" onPress={() => setTrack(i, (x) => jtPause(x, Date.now()), 'pause')}>
                        <Icon as={Pause} className="text-foreground size-4" />
                        <Text>{t('examTimer.pause')}</Text>
                      </Button>
                    ) : st === 'paused' ? (
                      <Button size="sm" onPress={() => setTrack(i, (x) => jtResume(x, Date.now()), 'resume')}>
                        <Icon as={Play} className="text-primary-foreground size-4" />
                        <Text>{t('examTimer.resume')}</Text>
                      </Button>
                    ) : null}
                    {tr.startedAt !== null ? (
                      <>
                        <Button size="sm" variant="outline" accessibilityLabel={t('examTimer.minus5')} onPress={() => setTrack(i, (x) => jtAddTime(x, -5), 'add_time', -5)}>
                          <Icon as={Minus} className="text-foreground size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => setTrack(i, (x) => jtAddTime(x, 5), 'add_time', 5)}>
                          <Text>+5</Text>
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => setTrack(i, (x) => jtAddTime(x, 10), 'add_time', 10)}>
                          <Text>+10</Text>
                        </Button>
                        {st !== 'finished' ? (
                          <Button size="sm" variant="outline" onPress={async () => (await confirm({ title: t('examTimer.finish'), body: t('examTimer.confirmFinish') })) && setTrack(i, (x) => jtFinish(x, Date.now()), 'finish')}>
                            <Icon as={Square} className="text-foreground size-4" />
                            <Text>{t('examTimer.finish')}</Text>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="outline"
                          accessibilityLabel={t('examTimer.reset')}
                          onPress={async () =>
                            (await confirm({ title: t('examTimer.reset'), body: t('examTimer.confirmReset') })) &&
                            updateTimer((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? jtReset(x) : x)), fired: s.fired.filter((f) => !f.startsWith(`${i}:`)) }), { kind: 'reset', track: i })
                          }>
                          <Icon as={RotateCcw} className="text-foreground size-4" />
                        </Button>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {!locked && !running && state.tracks.some((x) => x.startedAt === null) ? (
          <Button onPress={() => updateTimer((s) => ({ ...s, tracks: s.tracks.map((x) => (x.startedAt === null ? jtStart(x, Date.now()) : x)) }), { kind: 'start' })}>
            <Icon as={Play} className="text-primary-foreground size-4" />
            <Text>{t('examTimer.startAll')}</Text>
          </Button>
        ) : null}

        <View className="bg-card border-border gap-1 rounded-2xl border p-4">
          {jtRules(state.assessment, lang).map((r) => (
            <Text key={r} className="text-base">{`• ${r}`}</Text>
          ))}
        </View>

        <View className="bg-card border-border gap-3 rounded-2xl border p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={Users} className="text-muted-foreground size-5" />
            <Text className="flex-1">{T.attendance}</Text>
            {!locked ? (
              <Pressable accessibilityRole="button" accessibilityLabel="-1" onPress={() => updateTimer((s) => ({ ...s, attendance: { ...s.attendance, present: Math.max(0, s.attendance.present - 1) } }))} className="p-2">
                <Icon as={Minus} className="text-foreground size-4" />
              </Pressable>
            ) : null}
            <Text className="font-mono text-2xl font-bold">{`${state.attendance.present}/${state.attendance.total || '—'}`}</Text>
            {!locked ? (
              <Pressable accessibilityRole="button" accessibilityLabel="+1" onPress={() => updateTimer((s) => ({ ...s, attendance: { ...s.attendance, present: s.attendance.present + 1 } }))} className="p-2">
                <Icon as={Plus} className="text-foreground size-4" />
              </Pressable>
            ) : null}
          </View>
          <View className="flex-row items-center gap-2">
            <Icon as={Volume2} className="text-muted-foreground size-5" />
            <Text className="flex-1">{T.noise}</Text>
            {!locked ? (
              <Button size="sm" variant="outline" onPress={() => setNoiseOn((v) => !v)}>
                <Text>{noiseOn ? t('examTimer.off') : t('examTimer.on')}</Text>
              </Button>
            ) : null}
          </View>
          {noiseOn ? <NoiseMeter /> : null}
        </View>
      </ScrollView>
      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        onSubmit={(pin) => {
          if (pin !== getTimer().pin) return false;
          updateTimer((s) => ({ ...s, unlockedUntil: Date.now() + JT_UNLOCK_MS }), { kind: 'unlock' });
          return true;
        }}
      />
    </>
  );
}

function Ring({ size, progress, warn, label }: { size: number; progress: number; warn: boolean; label: string }) {
  const c = useColors();
  const r = 90;
  const len = 2 * Math.PI * r;
  const stroke = warn ? c.destructive : progress > 0.5 ? c.success : c.warning;
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={100} cy={100} r={r} stroke={c.muted} strokeWidth={16} fill="none" />
        <Circle cx={100} cy={100} r={r} stroke={stroke} strokeWidth={16} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, progress)))} />
      </Svg>
      <Text className="font-mono text-5xl font-black">{label}</Text>
    </View>
  );
}

/** Microphone level (optional noise meter); records with metering only, nothing is kept. */
function NoiseMeter() {
  const { t } = useTranslation();
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, isMeteringEnabled: true });
  const st = useAudioRecorderState(recorder, 250);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return active && setDenied(true);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (active) recorder.record();
    })().catch(() => undefined);
    return () => {
      active = false;
      void recorder.stop().catch(() => undefined);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, [recorder]);
  if (denied) return <Text className="text-destructive text-xs">{t('app.in_mic_permission')}</Text>;
  // Metering is in dBFS (about −60 quiet … 0 loud).
  const level = st.metering === undefined ? 0 : Math.max(0, Math.min(100, Math.round(((st.metering + 60) / 60) * 100)));
  return (
    <View className="bg-muted h-3 w-full overflow-hidden rounded-full">
      <View className={cn('h-3 rounded-full', level > 70 ? 'bg-destructive' : level > 40 ? 'bg-warning' : 'bg-success')} style={{ width: `${level}%` }} />
    </View>
  );
}

function PinDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (pin: string) => boolean }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const submit = () => {
    if (onSubmit(pin)) {
      setPin('');
      setBad(false);
      onOpenChange(false);
    } else setBad(true);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[85vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('examTimer.enterPin')}</DialogTitle>
        </DialogHeader>
        <Input value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry autoFocus onSubmitEditing={submit} />
        <Text className={cn('text-xs', bad ? 'text-destructive' : 'text-muted-foreground')}>{bad ? t('examTimer.wrongPin') : t('examTimer.pinHint')}</Text>
        <Button onPress={submit}>
          <Text>{t('examTimer.unlock')}</Text>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
