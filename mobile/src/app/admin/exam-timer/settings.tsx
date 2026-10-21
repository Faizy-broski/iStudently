import type { JcTimerFeed } from '@studently/api-client';
import {
  JG_DISTRIBUTION, JT_ASSESSMENTS, JT_MAX_TRACKS, jtExtrasText, jtInitialState, jtLangFor, jtLocalTime, jtMinutes, jtNewTrack, jtParseExtras, jtParseSchedule,
  type JtAlertKey, type JtDisplay, type JtExitRule, type JtState, type JtVoice,
} from '@studently/shared-utils';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { Stack } from 'expo-router';
import { Copy, Plus, Printer, Trash2, Upload } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { JT_CLIP_KEYS, clipFile, saveClip } from '@/features/exam-timer/media';
import { readSchool, setTimer, updateTimer, useTimer } from '@/features/exam-timer/store';
import { useJg } from '@/features/jahbadh/shared';
import { jahbadhControl } from '@/lib/api';
import { escapeHtml, printHtml } from '@/lib/print';

type Tab = 'exam' | 'extra' | 'import' | 'display' | 'log';
const NONE = '__none__';
const PERIODS = ['الفترة الأولى', 'الفترة الثانية', 'الفترة الثالثة', 'الفصل الأول', 'الفصل الثاني', 'نهاية العام'];
const p2 = (n: number) => String(n).padStart(2, '0');
const ymdOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const hmOf = (ms: number) => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

/** Timer settings (web: the timer's settings panel): exam, extra time, schedule import, display & sound, minutes. */
export default function ExamTimerSettings() {
  const { t } = useTranslation();
  const state = useTimer();
  const [tab, setTab] = useState<Tab>('exam');
  return (
    <>
      <Stack.Screen options={{ title: t('examTimer.settings') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <FilterChips
          value={tab}
          onChange={setTab}
          options={(['exam', 'extra', 'import', 'display', 'log'] as const).map((k) => ({ value: k, label: t(`examTimer.tab_${k}`) }))}
        />
        {tab === 'exam' ? <ExamTab state={state} /> : tab === 'extra' ? <ExtraTab state={state} /> : tab === 'import' ? <ImportTab state={state} /> : tab === 'display' ? <DisplayTab state={state} /> : <LogTab state={state} />}
      </ScrollView>
    </>
  );
}

function ExamTab({ state }: { state: JtState }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [announce, setAnnounce] = useState(state.announcement);
  const grades = JG_DISTRIBUTION.filter((g) => g.level === state.stage);
  const setTrack = (i: number, patch: Partial<JtState['tracks'][number]>) => updateTimer((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  return (
    <View className="gap-4">
      <FormSection title={t('examTimer.tab_exam')}>
        <Label>{t('examTimer.stage')}</Label>
        <Picker value={state.stage} onChange={(v) => updateTimer((s) => ({ ...s, stage: v as JtState['stage'] }))} options={[{ value: 'basic', label: t('examTimer.stage_basic') }, { value: 'secondary', label: t('examTimer.stage_secondary') }]} />
        <Label>{t('examTimer.assessment')}</Label>
        <Picker value={state.assessment} onChange={(v) => updateTimer((s) => ({ ...s, assessment: v as JtState['assessment'] }))} options={JT_ASSESSMENTS.map((a) => ({ value: a.key, label: t(`examTimer.assessment_${a.key}`) }))} />
        <Label>{t('examTimer.period')}</Label>
        <Picker value={state.period || NONE} onChange={(v) => updateTimer((s) => ({ ...s, period: v === NONE ? '' : v }))} options={[{ value: NONE, label: '—' }, ...PERIODS.map((p) => ({ value: p, label: p }))]} />
        <Label>{t('examTimer.room')}</Label>
        <Input value={state.room} onChangeText={(v) => updateTimer((s) => ({ ...s, room: v }))} />
      </FormSection>

      {state.tracks.map((tr, i) => {
        const g = JG_DISTRIBUTION.find((x) => x.code === tr.gradeCode);
        return (
          <FormSection
            key={tr.id}
            title={t('examTimer.trackN', { n: i + 1 })}
            action={
              state.tracks.length > 1 ? (
                <Pressable
                  onPress={() => updateTimer((s) => ({ ...s, tracks: s.tracks.filter((_, j) => j !== i), extras: s.extras.filter((x) => x.track !== i).map((x) => (x.track > i ? { ...x, track: x.track - 1 } : x)) }))}
                  accessibilityRole="button"
                  accessibilityLabel={t('examTimer.remove')}
                  className="p-1">
                  <Icon as={Trash2} className="text-destructive size-4" />
                </Pressable>
              ) : undefined
            }>
            <Picker
              value={tr.gradeCode ? String(tr.gradeCode) : NONE}
              placeholder={t('examTimer.grade')}
              onChange={(v) => {
                const code = v === NONE ? null : Number(v);
                setTrack(i, { gradeCode: code, grade: JG_DISTRIBUTION.find((x) => x.code === code)?.name ?? tr.grade });
              }}
              options={[{ value: NONE, label: t('examTimer.grade') }, ...grades.map((x) => ({ value: String(x.code), label: x.name }))]}
            />
            {g ? (
              <Picker
                value={g.subjects.some((x) => x.name === tr.subject) ? tr.subject : NONE}
                placeholder={t('examTimer.subject')}
                onChange={(v) => v !== NONE && setTrack(i, { subject: v })}
                options={[{ value: NONE, label: t('examTimer.subject') }, ...g.subjects.map((x) => ({ value: x.name, label: x.name }))]}
              />
            ) : null}
            <Input placeholder={t('examTimer.gradeFree')} value={tr.grade} onChangeText={(v) => setTrack(i, { grade: v })} />
            <Input placeholder={t('examTimer.subjectFree')} value={tr.subject} onChangeText={(v) => setTrack(i, { subject: v })} />
            <Label>{t('examTimer.duration')}</Label>
            <Input keyboardType="number-pad" value={String(tr.durationMin)} onChangeText={(v) => setTrack(i, { durationMin: Math.max(1, Number(v.replace(/\D/g, '')) || 1) })} />
            <Label>{t('examTimer.scheduledAt')}</Label>
            <DateField clearable value={tr.scheduledAt ? ymdOf(tr.scheduledAt) : null} onChange={(d) => setTrack(i, { scheduledAt: d ? jtLocalTime(d, tr.scheduledAt ? hmOf(tr.scheduledAt) : '08:00') : null })} />
            {tr.scheduledAt ? <TimeField value={hmOf(tr.scheduledAt)} onChange={(h) => setTrack(i, { scheduledAt: jtLocalTime(ymdOf(tr.scheduledAt!), h) })} /> : null}
          </FormSection>
        );
      })}
      {state.tracks.length < JT_MAX_TRACKS ? (
        <Button variant="outline" onPress={() => updateTimer((s) => ({ ...s, tracks: [...s.tracks, jtNewTrack({ durationMin: s.tracks[0]?.durationMin ?? 120 })] }))}>
          <Icon as={Plus} className="text-foreground size-4" />
          <Text>{t('examTimer.addTrack')}</Text>
        </Button>
      ) : null}
      <Text variant="muted" className="text-xs">
        {t('examTimer.tracksHint')}
      </Text>

      <FormSection title={t('examTimer.announcement')}>
        <Input value={announce} onChangeText={setAnnounce} />
        <Button onPress={() => updateTimer((s) => ({ ...s, announcement: announce }), announce ? { kind: 'announce', text: announce } : undefined)}>
          <Text>{t('examTimer.show')}</Text>
        </Button>
        {state.announcement ? (
          <Button variant="outline" onPress={() => { setAnnounce(''); updateTimer((s) => ({ ...s, announcement: '' })); }}>
            <Text>{t('examTimer.hide')}</Text>
          </Button>
        ) : null}
      </FormSection>

      <FormSection title={t('examTimer.attendanceTotal')}>
        <View className="flex-row gap-2">
          <Input className="flex-1" keyboardType="number-pad" placeholder={t('examTimer.present')} value={String(state.attendance.present)} onChangeText={(v) => updateTimer((s) => ({ ...s, attendance: { ...s.attendance, present: Number(v.replace(/\D/g, '')) || 0 } }))} />
          <Input className="flex-1" keyboardType="number-pad" placeholder={t('examTimer.total')} value={String(state.attendance.total)} onChangeText={(v) => updateTimer((s) => ({ ...s, attendance: { ...s.attendance, total: Number(v.replace(/\D/g, '')) || 0 } }))} />
        </View>
      </FormSection>

      <Button
        variant="destructive"
        onPress={async () => {
          if (await confirm({ title: t('examTimer.newExam'), body: t('examTimer.confirmNew'), destructive: true })) setTimer({ ...jtInitialState(), pin: state.pin, voice: state.voice, display: state.display, exitRule: state.exitRule });
        }}>
        <Text>{t('examTimer.newExam')}</Text>
      </Button>
    </View>
  );
}

function ExtraTab({ state }: { state: JtState }) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => jtExtrasText(state.extras));
  const parsed = useMemo(() => jtParseExtras(text, state.tracks.length), [text, state.tracks.length]);
  return (
    <FormSection title={t('examTimer.tab_extra')} description={t('examTimer.extraHint')}>
      <Textarea className="font-mono" placeholder={'6012 15\n6013 10'} value={text} onChangeText={setText} />
      {parsed.errors.length ? <Text className="text-destructive text-xs">{t('examTimer.extraErrors', { lines: parsed.errors.join(', ') })}</Text> : null}
      <Button
        disabled={parsed.errors.length > 0}
        onPress={() => updateTimer((s) => ({ ...s, extras: parsed.extras }), { kind: 'seat_extra', text: parsed.extras.map((x) => `${x.seat} +${x.minutes}`).join('، ') })}>
        <Text>{t('examTimer.apply')}</Text>
      </Button>
    </FormSection>
  );
}

function ImportTab({ state }: { state: JtState }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useJg();
  const [paste, setPaste] = useState('');
  const [sessions, setSessions] = useState<{ id: string; name: string }[] | null>(null);
  const [sessionId, setSessionId] = useState<string>(state.link?.sessionId ?? NONE);
  const [feed, setFeed] = useState<JcTimerFeed | null>(null);
  const [date, setDate] = useState<string>(NONE);
  const [slot, setSlot] = useState<string>(NONE);
  const [committee, setCommittee] = useState<string>(NONE);

  const loadSessions = async () => {
    const res = await jahbadhControl.sessions(campusId);
    if (!res.success) return toast.error(res.error ?? t('examTimer.offline'));
    setSessions((res.data ?? []).map((s) => ({ id: s.id, name: s.name })));
  };
  const loadFeed = async (sid: string, d?: string, c?: string) => {
    const res = await jahbadhControl.timerFeed(sid, d && d !== NONE ? d : null, c && c !== NONE ? c : null);
    if (!res.success || !res.data) return toast.error(res.error ?? t('examTimer.offline'));
    setFeed(res.data);
  };
  const dates = [...new Set((feed?.days ?? []).map((d) => d.exam_date))].sort();
  const slots = [...new Set((feed?.days ?? []).filter((d) => d.exam_date === date).map((d) => d.start_time?.slice(0, 5) ?? ''))].sort();
  const slotDays = (feed?.days ?? []).filter((d) => d.exam_date === date && (d.start_time?.slice(0, 5) ?? '') === slot).slice(0, JT_MAX_TRACKS);

  const applyControl = () => {
    if (!feed || !slotDays.length) return;
    const tracks = slotDays.map((d) =>
      jtNewTrack({
        grade: d.grade_names.join('، '),
        gradeCode: Math.max(...d.grade_codes),
        subject: d.subject_name,
        durationMin: d.duration_minutes ?? 120,
        scheduledAt: d.start_time ? jtLocalTime(d.exam_date, d.start_time.slice(0, 5)) : null,
      }),
    );
    const extras = feed.extras.filter((x) => slotDays.some((d) => d.id === x.day_id)).map((x) => ({ seat: String(x.seat), minutes: x.minutes, track: slotDays.findIndex((d) => d.id === x.day_id) }));
    updateTimer((s) => ({ ...s, tracks, extras, fired: [], link: { sessionId: feed.session.id, dayId: slotDays[0].id, committeeId: committee === NONE ? null : committee } }));
    toast.success(t('examTimer.imported', { n: tracks.length }));
  };
  const applyPaste = () => {
    const r = jtParseSchedule(paste, todayYmd());
    if (r.errors.length) return toast.error(t('examTimer.pasteErrors', { lines: r.errors.join(', ') }));
    const tracks = r.rows.slice(0, JT_MAX_TRACKS).map((x) => jtNewTrack({ grade: x.grade, subject: x.subject, durationMin: x.durationMin, scheduledAt: jtLocalTime(x.date, x.time) }));
    if (!tracks.length) return;
    updateTimer((s) => ({ ...s, tracks, extras: s.extras.filter((x) => x.track < tracks.length), fired: [] }));
    toast.success(t('examTimer.imported', { n: tracks.length }));
  };
  const pullAttendance = async () => {
    const link = state.link;
    if (!link) return;
    const res = await jahbadhControl.dayDashboard(link.sessionId, link.dayId);
    if (!res.success || !res.data) return toast.error(res.error ?? t('examTimer.offline'));
    const c = link.committeeId ? res.data.committees.find((x) => x.committee_id === link.committeeId) : null;
    updateTimer((s) => ({ ...s, attendance: { present: c ? c.present : res.data!.tiles.present, total: c ? c.students : res.data!.tiles.students } }));
  };

  return (
    <View className="gap-4">
      <FormSection title={t('examTimer.fromControl')}>
        {!sessions ? (
          <Button variant="outline" onPress={loadSessions}>
            <Text>{t('examTimer.loadSessions')}</Text>
          </Button>
        ) : (
          <>
            <Picker
              value={sessionId}
              onChange={(v) => {
                setSessionId(v);
                setDate(NONE);
                setSlot(NONE);
                if (v !== NONE) void loadFeed(v);
              }}
              options={[{ value: NONE, label: t('examTimer.session') }, ...sessions.map((s) => ({ value: s.id, label: s.name }))]}
            />
            {feed ? (
              <>
                <Picker
                  value={date}
                  onChange={(v) => {
                    setDate(v);
                    setSlot(NONE);
                    void loadFeed(sessionId, v, committee);
                  }}
                  options={[{ value: NONE, label: t('examTimer.date') }, ...dates.map((d) => ({ value: d, label: d }))]}
                />
                <Picker value={slot} onChange={setSlot} options={[{ value: NONE, label: t('examTimer.slot') }, ...slots.map((x) => ({ value: x, label: x || t('examTimer.noTime') }))]} />
                <Picker
                  value={committee}
                  onChange={(v) => {
                    setCommittee(v);
                    if (date !== NONE) void loadFeed(sessionId, date, v);
                  }}
                  options={[{ value: NONE, label: t('examTimer.allCommittees') }, ...feed.committees.map((c) => ({ value: c.id, label: c.name }))]}
                />
                {slotDays.length ? (
                  <Text variant="muted" className="text-xs">
                    {slotDays.map((d) => `${d.subject_name} (${d.grade_names.join('، ')}) ${d.duration_minutes ?? '?'}′`).join(' · ')}
                  </Text>
                ) : null}
                <Button onPress={applyControl} disabled={!slotDays.length}>
                  <Icon as={Upload} className="text-primary-foreground size-4" />
                  <Text>{t('examTimer.useSchedule')}</Text>
                </Button>
              </>
            ) : null}
          </>
        )}
        {state.link ? (
          <Button variant="outline" onPress={pullAttendance}>
            <Text>{t('examTimer.pullAttendance')}</Text>
          </Button>
        ) : null}
      </FormSection>
      <FormSection title={t('examTimer.pasteSchedule')} description={t('examTimer.pasteHint')}>
        <Textarea className="font-mono" placeholder={'08:00 الرياضيات 120 / الصف السابع'} value={paste} onChangeText={setPaste} />
        <Button variant="outline" onPress={applyPaste} disabled={!paste.trim()}>
          <Text>{t('examTimer.useSchedule')}</Text>
        </Button>
      </FormSection>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm">{t('examTimer.autoStart')}</Text>
        <Switch checked={state.autoStart} onCheckedChange={(v) => updateTimer((s) => ({ ...s, autoStart: v }))} />
      </View>
    </View>
  );
}

function DisplayTab({ state }: { state: JtState }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pin, setPin] = useState(state.pin);
  const [, force] = useState(0);
  const pickClip = async (k: JtAlertKey) => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      saveClip(k, { uri: res.assets[0].uri, name: res.assets[0].name });
      force((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };
  return (
    <View className="gap-4">
      <FormSection title={t('examTimer.tab_display')}>
        <Label>{t('examTimer.display')}</Label>
        <Picker value={state.display} onChange={(v) => updateTimer((s) => ({ ...s, display: v as JtDisplay }))} options={(['auto', 'digits', 'ring'] as const).map((x) => ({ value: x, label: t(`examTimer.display_${x}`) }))} />
        <Label>{t('examTimer.exitRule')}</Label>
        <Picker value={state.exitRule} onChange={(v) => updateTimer((s) => ({ ...s, exitRule: v as JtExitRule }))} options={(['off', 'half', 'third', 'quarter'] as const).map((x) => ({ value: x, label: t(`examTimer.exit_${x}`) }))} />
        <Label>{t('examTimer.voice')}</Label>
        <Picker value={state.voice} onChange={(v) => updateTimer((s) => ({ ...s, voice: v as JtVoice }))} options={(['speech', 'beep', 'clips', 'off'] as const).map((x) => ({ value: x, label: t(`examTimer.voice_${x}`) }))} />
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm">{t('examTimer.englishAuto')}</Text>
          <Switch checked={state.englishAuto} onCheckedChange={(v) => updateTimer((s) => ({ ...s, englishAuto: v }))} />
        </View>
        {jtLangFor(state) === 'en' ? (
          <Text variant="muted" className="text-xs">
            {t('examTimer.englishNow')}
          </Text>
        ) : null}
      </FormSection>
      {state.voice === 'clips' ? (
        <FormSection title={t('examTimer.clips')} description={t('examTimer.clipsHint')}>
          {JT_CLIP_KEYS.map((k) => {
            const has = !!clipFile(k);
            return (
              <View key={k} className="flex-row items-center gap-2">
                <Text className="flex-1 text-sm">{t(`examTimer.alert_${k}`)}</Text>
                <Button size="sm" variant="outline" onPress={() => pickClip(k)} accessibilityLabel={t('common.upload')}>
                  <Icon as={Upload} className="text-foreground size-4" />
                </Button>
                {has ? (
                  <Pressable onPress={() => { saveClip(k, null); force((n) => n + 1); }} accessibilityRole="button" accessibilityLabel={t('examTimer.remove')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                    <Icon as={Trash2} className="text-destructive size-4" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </FormSection>
      ) : null}
      <FormSection title={t('examTimer.pin')} description={t('examTimer.pinHint')}>
        <Input value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" secureTextEntry />
        <Button
          onPress={() => {
            updateTimer((s) => ({ ...s, pin, unlockedUntil: 0 }));
            toast.success(pin ? t('examTimer.pinSet') : t('examTimer.pinCleared'));
          }}>
          <Text>{t('examTimer.apply')}</Text>
        </Button>
      </FormSection>
    </View>
  );
}

function LogTab({ state }: { state: JtState }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const lang = jtLangFor(state, i18n.language);
  const text = jtMinutes(state, lang, { school: readSchool().name, date: todayYmd() });
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    toast.success(t('examTimer.copied'));
  };
  const print = () =>
    printHtml(
      `<!DOCTYPE html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;padding:24px"><pre style="white-space:pre-wrap;font:14px/1.7 system-ui,sans-serif">${escapeHtml(text)}</pre><p style="margin-top:32px">${lang === 'ar' ? 'توقيع الملاحظ الأول: ............   توقيع الملاحظ الثاني: ............' : 'Invigilator 1: ............   Invigilator 2: ............'}</p></body></html>`,
    ).catch((e: Error) => toast.error(e.message));
  const attach = async () => {
    const link = state.link;
    if (!link) return;
    const res = await jahbadhControl.saveTimerMinutes(link.sessionId, link.dayId, { committee_id: link.committeeId, text, events: state.events });
    if (!res.success) return toast.error(res.error ?? t('examTimer.offline'));
    toast.success(t('examTimer.attached'));
  };
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <Button variant="outline" size="sm" onPress={copy}>
          <Icon as={Copy} className="text-foreground size-4" />
          <Text>{t('examTimer.copy')}</Text>
        </Button>
        <Button variant="outline" size="sm" onPress={print}>
          <Icon as={Printer} className="text-foreground size-4" />
          <Text>{t('examTimer.print')}</Text>
        </Button>
        <Button size="sm" onPress={attach} disabled={!state.link}>
          <Icon as={Upload} className="text-primary-foreground size-4" />
          <Text>{t('examTimer.attach')}</Text>
        </Button>
      </View>
      {!state.link ? (
        <Text variant="muted" className="text-xs">
          {t('examTimer.attachHint')}
        </Text>
      ) : null}
      <View className="bg-card border-border rounded-2xl border p-3">
        <Text className="font-mono text-xs leading-5">{text}</Text>
      </View>
      <Button variant="ghost" onPress={async () => (await confirm({ title: t('examTimer.clearLog'), body: t('examTimer.confirmClearLog') })) && updateTimer((s) => ({ ...s, events: [] }))}>
        <Text>{t('examTimer.clearLog')}</Text>
      </Button>
    </View>
  );
}
