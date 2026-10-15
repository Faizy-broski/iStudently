import type { AyahWithText } from '@studently/api-client';
import { randomUUID } from 'expo-crypto';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Play, Undo2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useHz } from '@/features/admin/hifzi';
import { adminHifzi, quran } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const SESSION_TYPES = ['new', 'near_review', 'far_review', 'consolidation', 'continuous', 'tajweed', 'exam'] as const;
const ERROR_TYPES = ['major', 'minor', 'skipped_ayah', 'skipped_word', 'substituted', 'added', 'hesitation', 'repetition', 'prompt', 'similar_jump', 'bad_waqf', 'performance'] as const;
type ErrorType = (typeof ERROR_TYPES)[number];
const COLORS: Record<ErrorType, string> = {
  major: 'bg-red-500',
  minor: 'bg-orange-300',
  skipped_ayah: 'bg-red-700',
  skipped_word: 'bg-red-400',
  substituted: 'bg-purple-400',
  added: 'bg-yellow-400',
  hesitation: 'bg-blue-200',
  repetition: 'bg-blue-300',
  prompt: 'bg-red-600',
  similar_jump: 'bg-pink-400',
  bad_waqf: 'bg-teal-300',
  performance: 'bg-gray-300',
};
type Mark = { ayahId: string; wordIndex: number; errorType: ErrorType };
const keyOf = (ayahId: string, i: number) => `${ayahId}:${i}`;

/** Preview only, like the web (computeRawScore): the server grades with the school's weights on save. */
function previewScore(marks: Mark[], weights: Record<string, number>) {
  const counts: Record<string, number> = {};
  for (const m of marks) counts[m.errorType] = (counts[m.errorType] ?? 0) + 1;
  const penalty = Object.entries(counts).reduce((sum, [type, n]) => sum + n * (weights[type] ?? 0), 0);
  return Math.min(10, Math.max(0, 10 - penalty));
}

function Timer({ startedAt }: { startedAt: number }) {
  const { h } = useHz();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <Text className="text-muted-foreground text-sm">{`${h('recitation.timer')}: ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`}</Text>;
}

/**
 * Record a recitation for each student of the circle: session type, riwayah and ayah range, tap a word
 * to mark an error type, undo, score preview with optional override, save and go to the next student
 * (web: /teacher/hifzi/recite/[circleId]).
 */
export default function TeacherRecite() {
  const { h, a, isAr } = useHz();
  const toast = useToast();
  const { circleId } = useLocalSearchParams<{ circleId: string }>();
  const roster = useApi(circleId ? ['teacher', 'hifzi-enrollments', circleId] : null, ([, , c]) => adminHifzi.enrollments(c as string));
  const settings = useApi(['teacher', 'hifzi-settings'], () => adminHifzi.settings());
  const riwayat = useApi(['teacher', 'quran-riwayat'], () => quran.riwayat());
  const students = (roster.data ?? []).filter((e) => e.status !== 'withdrawn');
  const [pick, setPick] = useState<string | null>(null);
  const studentId = pick ?? students[0]?.student_id ?? null;
  const [riwayah, setRiwayah] = useState('hafs');
  const [surah, setSurah] = useState('1');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('7');
  const [type, setType] = useState<(typeof SESSION_TYPES)[number]>('near_review');
  const [ayahs, setAyahs] = useState<AyahWithText[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
  const [order, setOrder] = useState<string[]>([]);
  const [picker, setPicker] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [uuid, setUuid] = useState(() => randomUUID());
  const [override, setOverride] = useState(false);
  const [score, setScore] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const resetMarks = () => {
    setMarks(new Map());
    setOrder([]);
    setPicker(null);
    setOverride(false);
    setScore('');
    setReason('');
    setUuid(() => randomUUID());
    setStartedAt(() => Date.now());
  };
  const selectStudent = (id: string | null) => {
    setPick(id);
    setAyahs([]);
    setRange(null);
    resetMarks();
  };

  async function loadText() {
    setLoadingText(true);
    setAyahs([]);
    setRange(null);
    resetMarks();
    try {
      const r = await quran.resolveRange({ riwayah, unitType: 'custom', startSurah: Number(surah), startAyah: Number(from), endSurah: Number(surah), endAyah: Number(to) });
      if (!r.success || !r.data) return toast.error(r.error || 'Failed to resolve range');
      const text = await quran.ayahsInRange(riwayah, r.data.startAyahId, r.data.endAyahId);
      if (!text.success || !text.data) return toast.error(text.error || 'Failed to load ayah text');
      setAyahs(text.data);
      setRange({ start: r.data.startAyahId, end: r.data.endAyahId });
    } finally {
      setLoadingText(false);
    }
  }

  const mark = (ayahId: string, i: number, errorType: ErrorType) => {
    const key = keyOf(ayahId, i);
    setMarks((prev) => new Map(prev).set(key, { ayahId, wordIndex: i, errorType }));
    setOrder((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setPicker(null);
  };
  const undo = () => {
    const last = order[order.length - 1];
    if (!last) return;
    setMarks((prev) => {
      const next = new Map(prev);
      next.delete(last);
      return next;
    });
    setOrder((prev) => prev.slice(0, -1));
  };
  const list = [...marks.values()];
  const preview = settings.data ? previewScore(list, settings.data.gradingWeights) : null;

  const next = () => {
    const i = students.findIndex((e) => e.student_id === studentId);
    selectStudent(students[i + 1]?.student_id ?? students[0]?.student_id ?? null);
  };

  async function save() {
    if (!studentId || !range || !circleId) return;
    if (override && !reason.trim()) return toast.error(h('recitation.overrideReason'));
    setSaving(true);
    try {
      const r = await adminHifzi.createSession({
        student_id: studentId,
        circle_id: circleId,
        session_type: type,
        start_ayah_id: range.start,
        end_ayah_id: range.end,
        errors: list.map((m) => ({ ayah_id: m.ayahId, word_index: m.wordIndex, error_type: m.errorType })),
        final_score: override ? Number(score) : null,
        override_reason: override ? reason.trim() : null,
        client_uuid: uuid,
      });
      if (!r.success) return toast.error(r.error || 'Failed to save');
      toast.success(h('recitation.saved'));
      next();
    } finally {
      setSaving(false);
    }
  }

  if (roster.isLoading) return <LoadingList rows={5} />;
  const name = (e: (typeof students)[number]) => (e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : (e.students?.student_number ?? ''));

  return (
    <>
      <Stack.Screen options={{ title: h('recitation.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-1.5">
          <Label>{h('recitation.selectStudent')}</Label>
          <Picker value={studentId} onChange={selectStudent} options={students.map((e) => ({ value: e.student_id, label: name(e) }))} />
        </View>
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1">
                <Label>{h('recitation.sessionType')}</Label>
                <Picker value={type} onChange={(v) => setType(v as (typeof SESSION_TYPES)[number])} options={SESSION_TYPES.map((s) => ({ value: s, label: h(`recitation.${s}`) }))} />
              </View>
              <View className="flex-1 gap-1">
                <Label>{a('hz_riwayah')}</Label>
                <Picker value={riwayah} onChange={setRiwayah} options={(riwayat.data ?? []).map((r) => ({ value: r.code, label: isAr ? r.name_ar : r.name_en }))} />
              </View>
            </View>
            <View className="flex-row items-end gap-2">
              {[
                ['surah', surah, setSurah],
                ['from', from, setFrom],
                ['to', to, setTo],
              ].map(([key, value, setter]) => (
                <View key={key as string} className="flex-1 gap-1">
                  <Label>{a(`hz_${key}`)}</Label>
                  <Input value={value as string} onChangeText={(v) => (setter as (s: string) => void)(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
                </View>
              ))}
              <Button onPress={loadText} disabled={loadingText || !studentId}>
                <Icon as={Play} className="text-primary-foreground size-4" />
              </Button>
            </View>
            {ayahs.length ? <Timer key={`${studentId}-${startedAt}`} startedAt={startedAt} /> : null}
          </CardContent>
        </Card>

        {ayahs.length ? (
          <>
            <Text className="text-muted-foreground text-xs">{h('recitation.tapWordHint')}</Text>
            <Card>
              <CardContent className="gap-3 pt-4" style={{ direction: 'rtl' }}>
                {ayahs.map((a) => {
                  const words = a.textUthmani.split(/\s+/).filter(Boolean);
                  return (
                    <View key={a.id} className="flex-row flex-wrap gap-1.5">
                      {words.map((w, i) => {
                        const key = keyOf(a.id, i);
                        const m = marks.get(key);
                        return (
                          <View key={key}>
                            <Pressable onPress={() => setPicker(picker === key ? null : key)} accessibilityRole="button" className={cn('rounded px-1.5 py-1', m ? COLORS[m.errorType] : 'bg-transparent')}>
                              <Text className="text-xl leading-9">{w}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                      <Text className="text-muted-foreground self-center text-sm">{`﴿${a.ayahNumber}﴾`}</Text>
                      {picker && picker.startsWith(`${a.id}:`) ? (
                        <View className="border-border bg-card w-full flex-row flex-wrap gap-1.5 rounded-lg border p-2">
                          {ERROR_TYPES.map((et) => (
                            <Pressable key={et} onPress={() => mark(a.id, Number(picker.split(':')[1]), et)} accessibilityRole="button" className={cn('rounded-full px-2.5 py-1', COLORS[et])}>
                              <Text className="text-xs font-medium">{h(`errorTypes.${et}`)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-3 pt-4">
                <View className="flex-row items-center justify-between">
                  <Button variant="outline" size="sm" onPress={undo} disabled={!order.length}>
                    <Icon as={Undo2} className="size-4" />
                    <Text>{h('recitation.undo')}</Text>
                  </Button>
                  <Text className="text-lg font-bold">{`${h('recitation.score')}: ${preview !== null ? preview.toFixed(2) : '—'}`}</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Switch checked={override} onCheckedChange={setOverride} />
                  <Text className="flex-1 text-sm">{h('recitation.overrideScore')}</Text>
                </View>
                {override ? (
                  <View className="gap-2">
                    <Input value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="0–10" />
                    <Input value={reason} onChangeText={setReason} placeholder={h('recitation.overrideReason')} />
                  </View>
                ) : null}
                <View className="flex-row gap-2">
                  <Button variant="ghost" className="flex-1" onPress={next}>
                    <Text>{h('recitation.nextStudent')}</Text>
                  </Button>
                  <Button className="flex-1" onPress={save} disabled={saving}>
                    <Text>{saving ? h('recitation.saving') : h('recitation.save')}</Text>
                  </Button>
                </View>
              </CardContent>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
