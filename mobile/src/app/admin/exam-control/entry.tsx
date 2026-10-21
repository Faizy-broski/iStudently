import { jcParseScore, type JcEntryGrid } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type TextInput, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { Segmented } from '@/components/app/segmented';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ScanField, useScanError } from '@/features/exam-control/scan';
import { JcError, Note, useOverview, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

const cellText = (c: { score: number | null; absent: boolean; entered: boolean } | undefined) => (!c?.entered ? '' : c.absent ? 'غ' : String(c.score ?? ''));

/**
 * Blind score entry (web: exam control › Score entry). One subject at a time, by secret number; names
 * and seat numbers never reach this screen before the session is unmasked (enforced by the server).
 */
export default function ExamControlEntry() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const firstGrade = o?.grades[0]?.grade_level_id ?? null;
  const [gradePick, setGrade] = useState<string | null>(null);
  const grade = gradePick ?? firstGrade;
  const [entry, setEntry] = useState<'1' | '2'>('1');
  const grid = useApi(id && grade ? (['jc', 'entry', id, grade, entry] as const) : null, ([, , s, g, e]) => jahbadhControl.entryGrid(s, g, Number(e) as 1 | 2));

  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_entry') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        {!o.grades.length ? (
          <Note text={t('examControl.noGradesYet')} />
        ) : (
          <>
            <Picker value={grade} onChange={setGrade} options={o.grades.map((g) => ({ value: g.grade_level_id, label: g.grade_level_name }))} />
            {o.session.settings.double_entry ? (
              <Segmented value={entry} onChange={setEntry} options={[{ value: '1', label: t('examControl.entry1') }, { value: '2', label: t('examControl.entry2') }]} />
            ) : null}
            <Note tone={o.rights.unmasked ? 'success' : 'warning'} text={o.rights.unmasked ? t('examControl.unmaskedEntryNote') : t('examControl.blindNote')} />
            {grid.error ? <Note tone="destructive" text={grid.error.message} /> : !grid.data ? <LoadingList rows={4} /> : <Grid key={`${grade}-${entry}`} id={id} data={grid.data} readOnly={o.rights.unmasked} camera={o.session.settings.camera_scanning} onSaved={() => grid.mutate()} />}
          </>
        )}
      </ScrollView>
    </>
  );
}

function Grid({ id, data, readOnly, camera, onSaved }: { id: string; data: JcEntryGrid; readOnly: boolean; camera: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const subjects = data.grade.subjects;
  const [subject, setSubject] = useState(subjects[0]?.key ?? '');
  const sub = subjects.find((s) => s.key === subject) ?? subjects[0];
  const max = sub?.max ?? 0;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const save = useAction(jahbadhControl.saveEntry);
  const k = (secret: number, subj: string) => `${secret}|${subj}`;
  const invalid = useMemo(
    () => new Set(Object.entries(edits).filter(([key, v]) => !jcParseScore(v, subjects.find((s) => s.key === key.split('|')[1])?.max ?? 0).ok).map(([key]) => key)),
    [edits, subjects],
  );
  const dirty = Object.keys(edits).length;

  const submit = async () => {
    if (invalid.size || !dirty) return;
    const cells = Object.entries(edits).map(([key, v]) => {
      const [secret, subj] = key.split('|');
      const p = jcParseScore(v, subjects.find((s) => s.key === subj)?.max ?? 0) as { score: number | null; absent: boolean };
      return { secret: Number(secret), subject_key: subj, score: p.score, absent: p.absent };
    });
    const res = await save.run(id, data.entry, cells);
    if (res.ok) {
      toast.success(t('examControl.savedCells', { n: cells.length }));
      setEdits({});
      onSaved();
    }
  };
  // Autosave 1.5 s after the last change when every edited cell is valid.
  useEffect(() => {
    if (!dirty || invalid.size || readOnly) return;
    const h = setTimeout(submit, 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits]);

  const inputs = useRef(new Map<number, TextInput>());
  const scanRef = useRef<TextInput>(null);
  const scanError = useScanError();
  /** Shows one secret number's row and puts the cursor in its score. */
  const focusSecret = (secret: number) => {
    if (!data.rows.some((r) => r.secret === secret)) return { ok: false, message: t('examControl.secretNotInGrade') };
    setFilter(String(secret));
    setTimeout(() => inputs.current.get(secret)?.focus(), 150);
    return { ok: true, message: t('examControl.scanJumped', { secret }) };
  };
  const onScan = async (digits: string) => {
    // A booklet QR: the server checks the session and the signature, and returns the secret number only.
    const res = await jahbadhControl.scan(id, digits, 'booklet');
    if (!res.success || !res.data?.secret) return { ok: false, message: scanError(res.code, res.error) };
    return focusSecret(res.data.secret);
  };

  const rows = data.rows.filter((r) => !filter || String(r.secret) === filter);
  const counts = data.rows.reduce(
    (a, r) => {
      const c = sub ? r.cells[sub.key] : undefined;
      return { entered: a.entered + (c?.entered ? 1 : 0), mismatch: a.mismatch + (c?.mismatch ? 1 : 0), single: a.single + (c?.single ? 1 : 0) };
    },
    { entered: 0, mismatch: 0, single: 0 },
  );

  if (!sub) return <Note text={t('examControl.noNumbersYet')} />;
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>{t('examControl.subject')}</Label>
        <Picker value={sub.key} onChange={setSubject} options={subjects.map((s) => ({ value: s.key, label: `${s.name} (/${s.max})` }))} />
      </View>
      <ScanField expect="booklet" inputRef={scanRef} camera={camera} placeholder={t('examControl.jumpHint')} onScan={onScan} onPlain={(d) => focusSecret(Number(d))} />
      {filter ? (
        <Pressable onPress={() => setFilter('')} accessibilityRole="button" className="self-start">
          <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t('examControl.showAll')}</Text>
        </Pressable>
      ) : null}
      <Text variant="muted" className="text-[11px]">
        {[
          t('examControl.entryCounts', { entered: counts.entered, total: data.rows.length }),
          counts.mismatch ? t('examControl.mismatchCount', { n: counts.mismatch }) : null,
          counts.single ? t('examControl.singleCount', { n: counts.single }) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <Text variant="muted" className="text-[11px]">
        {t('examControl.entryKeysHint')}
      </Text>
      {!readOnly ? (
        <Button onPress={submit} disabled={!dirty || save.running || invalid.size > 0}>
          <Text>{save.running ? t('examControl.saving') : dirty ? t('examControl.saveN', { n: dirty }) : t('examControl.saved')}</Text>
        </Button>
      ) : null}
      {!data.rows.length ? <Note text={t('examControl.noNumbersYet')} /> : null}
      {rows.map((r) => {
        const key = k(r.secret, sub.key);
        const c = r.cells[sub.key];
        const bad = invalid.has(key);
        return (
          <View key={r.secret} className="border-border flex-row items-center gap-3 border-b pb-2">
            <View className="flex-1 gap-0.5">
              <Text className="font-mono text-sm font-semibold">{String(r.secret)}</Text>
              <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                {[r.name, r.seat_number ? String(r.seat_number) : null, r.committee].filter(Boolean).join(' · ') || '—'}
              </Text>
            </View>
            {c?.mismatch ? <StatusChip label={t('examControl.mismatchCell')} tone="destructive" /> : c?.single ? <StatusChip label={t('examControl.singleCell')} tone="warning" /> : null}
            {!readOnly ? (
              <Pressable
                onPress={() => setEdits((x) => ({ ...x, [key]: (edits[key] ?? cellText(c)) === 'غ' ? '' : 'غ' }))}
                accessibilityRole="button"
                accessibilityLabel={t('examControl.absent')}
                className="border-border rounded-lg border px-2.5 py-2">
                <Text className="text-sm font-semibold">غ</Text>
              </Pressable>
            ) : null}
            <Input
              ref={(el) => {
                if (el) inputs.current.set(r.secret, el);
                else inputs.current.delete(r.secret);
              }}
              className={`w-20 text-center ${bad ? 'border-destructive' : ''}`}
              keyboardType="decimal-pad"
              editable={!readOnly}
              accessibilityLabel={`${r.secret} ${sub.name}`}
              value={edits[key] ?? cellText(c)}
              onChangeText={(v) => setEdits((x) => ({ ...x, [key]: v }))}
              returnKeyType="next"
              onSubmitEditing={() => scanRef.current?.focus()}
            />
          </View>
        );
      })}
      {invalid.size ? <Text className="text-destructive text-xs">{t('examControl.errMax', { max })}</Text> : null}
    </View>
  );
}
