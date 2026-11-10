import { jaPdfPath, type JaHandling, type JaVersion, type JcAnswerKey, type JcAnswerSheets, type JcGrade, type JcOverview } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Archive, FileText, Plus, Printer, RotateCcw, Save, Search, Trash2, Upload } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { JcError, MiniTile, Note, pct, useOverview, useSessionId } from '@/features/exam-control/shared';
import { jahbadhAssessment, jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const HANDLING: JaHandling[] = ['normal', 'all', 'excluded'];
type Section = 'keys' | 'fairness' | 'archive';
type KeyTab = 'key' | 'answers' | 'analysis' | 'mastery' | 'similarity' | 'prints';

/** Exam-control assessment tools (web: /admin/exam-control?session=…&tab=assessment; control workbook sheets 27, 30–37). */
export default function ExamControlAssessment() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const [section, setSection] = useState<Section>('keys');
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  const control = o.rights.manage;
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_assessment') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Note text={t('examControl.as_intro')} />
        {control ? (
          <FilterChips<Section>
            value={section}
            onChange={setSection}
            options={[
              { value: 'keys', label: t('examControl.as_keys') },
              { value: 'fairness', label: t('examControl.as_fairness') },
              { value: 'archive', label: t('examControl.as_archive') },
            ]}
          />
        ) : null}
        {section === 'keys' || !control ? <KeysSection sessionId={id} overview={o} /> : null}
        {section === 'fairness' && control ? <FairnessSection sessionId={id} grades={o.grades} /> : null}
        {section === 'archive' && control ? <ArchiveSection sessionId={id} grades={o.grades} chief={o.rights.chief} onRecalled={() => setSection('keys')} /> : null}
      </ScrollView>
    </>
  );
}

function keyTitle(o: JcOverview, k: Pick<JcAnswerKey, 'grade_level_id' | 'subject_key' | 'part_key'>) {
  const g = o.grades.find((x) => x.grade_level_id === k.grade_level_id);
  const s = g?.subjects.find((x) => x.key === k.subject_key);
  const part = k.part_key ? (s?.parts?.find((p) => String(p.index) === k.part_key)?.name ?? k.part_key) : null;
  return [g?.grade_level_name, s?.name ?? k.subject_key, part].filter(Boolean).join(' — ');
}

function KeysSection({ sessionId, overview }: { sessionId: string; overview: JcOverview }) {
  const { t } = useTranslation();
  const toast = useToast();
  const keys = useApi(['ja', 'keys', sessionId] as const, ([, , s]) => jahbadhAssessment.keys(s));
  const [keyId, setKeyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const control = overview.rights.manage;
  const list = keys.data ?? [];
  const current = list.find((k) => k.id === keyId) ?? null;

  const create = async (body: Parameters<typeof jahbadhAssessment.saveKey>[1]) => {
    const res = await jahbadhAssessment.saveKey(sessionId, body);
    if (!res.success || !res.data) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.saved'));
    setCreating(false);
    await keys.mutate();
    setKeyId(res.data.id);
  };

  return (
    <>
      <FormSection
        title={t('examControl.as_keys')}
        action={
          control && !creating ? (
            <Button size="sm" onPress={() => setCreating(true)}>
              <Icon as={Plus} className="size-4 text-white" />
              <Text>{t('examControl.as_newKey')}</Text>
            </Button>
          ) : undefined
        }>
        {keys.error ? (
          <Note tone="destructive" text={keys.error.message} />
        ) : !keys.data ? (
          <LoadingList rows={1} />
        ) : !list.length ? (
          <Text variant="muted" className="text-sm">
            {control ? t('examControl.as_noKeysControl') : t('examControl.as_noKeys')}
          </Text>
        ) : (
          <FilterChips<string> value={keyId ?? ''} onChange={setKeyId} options={list.map((k) => ({ value: k.id, label: `${keyTitle(overview, k)} · ${t('examControl.as_questionsN', { n: k.question_count })}` }))} />
        )}
      </FormSection>
      {creating ? <NewKey grades={overview.grades} onCancel={() => setCreating(false)} onCreate={create} /> : null}
      {current ? (
        <KeyWorkspace
          key={current.id}
          sessionId={sessionId}
          answerKey={current}
          overview={overview}
          onSaved={() => void keys.mutate()}
          onDeleted={() => {
            setKeyId(null);
            void keys.mutate();
          }}
        />
      ) : null}
    </>
  );
}

function NewKey({ grades, onCancel, onCreate }: { grades: JcGrade[]; onCancel: () => void; onCreate: (body: Parameters<typeof jahbadhAssessment.saveKey>[1]) => void }) {
  const { t } = useTranslation();
  const [gradeId, setGradeId] = useState<string | null>(grades[0]?.grade_level_id ?? null);
  const grade = grades.find((g) => g.grade_level_id === gradeId);
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const subject = grade?.subjects.find((s) => s.key === subjectKey);
  const [partKey, setPartKey] = useState('');
  const [count, setCount] = useState('20');
  const [options, setOptions] = useState<'4' | '5'>('4');
  const n = Number(count);
  const valid = !!gradeId && !!subjectKey && Number.isInteger(n) && n >= 1 && n <= 40;
  return (
    <FormSection title={t('examControl.as_newKey')}>
      <Picker value={gradeId} onChange={(v) => { setGradeId(v); setSubjectKey(null); setPartKey(''); }} placeholder={t('examControl.as_grade')} options={grades.map((g) => ({ value: g.grade_level_id, label: g.grade_level_name }))} />
      <Picker value={subjectKey} onChange={(v) => { setSubjectKey(v); setPartKey(''); }} placeholder={t('examControl.as_subject')} options={(grade?.subjects ?? []).map((s) => ({ value: s.key, label: `${s.name} (${s.max})` }))} />
      {subject?.parts?.length ? (
        <Picker
          value={partKey || '__whole'}
          onChange={(v) => setPartKey(v === '__whole' ? '' : v)}
          placeholder={t('examControl.as_part')}
          options={[{ value: '__whole', label: t('examControl.as_wholePaper') }, ...subject.parts.map((p) => ({ value: String(p.index), label: `${p.name} (${p.max})` }))]}
        />
      ) : null}
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('examControl.as_questionCount')}</Text>
          <Input value={count} onChangeText={setCount} keyboardType="number-pad" />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('examControl.as_options')}</Text>
          <FilterChips<'4' | '5'> value={options} onChange={setOptions} options={[{ value: '4', label: 'أ–د' }, { value: '5', label: 'أ–ه' }]} />
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onCancel}>
          <Text>{t('examControl.cancel')}</Text>
        </Button>
        <Button className="flex-1" disabled={!valid} onPress={() => gradeId && subjectKey && onCreate({ grade_level_id: gradeId, subject_key: subjectKey, part_key: partKey, question_count: n, options: Number(options) as 4 | 5 })}>
          <Text>{t('examControl.create')}</Text>
        </Button>
      </View>
    </FormSection>
  );
}

function KeyWorkspace({ sessionId, answerKey, overview, onSaved, onDeleted }: { sessionId: string; answerKey: JcAnswerKey; overview: JcOverview; onSaved: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const r = overview.rights;
  const title = keyTitle(overview, answerKey);
  const [tab, setTab] = useState<KeyTab>('answers');
  const [archiveName, setArchiveName] = useState(title);
  const keyId = answerKey.id;

  const remove = async () => {
    if (!(await confirm({ title: t('examControl.as_deleteKey'), body: t('examControl.as_confirmDeleteKey'), destructive: true }))) return;
    const res = await jahbadhAssessment.deleteKey(sessionId, keyId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.deleted'));
    onDeleted();
  };
  const archive = async () => {
    const res = await jahbadhAssessment.archiveKey(sessionId, keyId, { name: archiveName.trim() || title });
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.as_archived'));
  };

  const tabs: { value: KeyTab; label: string }[] = [
    { value: 'key', label: t('examControl.as_tab_key') },
    { value: 'answers', label: t('examControl.as_tab_answers') },
    { value: 'analysis', label: t('examControl.as_tab_analysis') },
    { value: 'mastery', label: t('examControl.as_tab_mastery') },
    ...(r.manage ? [{ value: 'similarity' as const, label: t('examControl.as_tab_similarity') }] : []),
    { value: 'prints', label: t('examControl.as_tab_prints') },
  ];

  return (
    <FormSection
      title={title}
      action={
        r.manage ? (
          <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel={t('examControl.as_deleteKey')} className="p-2">
            <Icon as={Trash2} className="text-destructive size-5" />
          </Pressable>
        ) : undefined
      }>
      <FilterChips<KeyTab> value={tab} onChange={setTab} options={tabs} />
      {tab === 'key' ? <KeyEditor sessionId={sessionId} answerKey={answerKey} editable={r.manage} onSaved={onSaved} /> : null}
      {tab === 'answers' ? <AnswersPanel sessionId={sessionId} answerKey={answerKey} /> : null}
      {tab === 'analysis' ? <AnalysisPanel sessionId={sessionId} keyId={keyId} /> : null}
      {tab === 'mastery' ? <MasteryPanel sessionId={sessionId} keyId={keyId} /> : null}
      {tab === 'similarity' && r.manage ? <SimilarityPanel sessionId={sessionId} keyId={keyId} /> : null}
      {tab === 'prints' ? <PrintsPanel sessionId={sessionId} keyId={keyId} canBubble={r.secret || r.chief} /> : null}
      {r.manage ? (
        <View className="border-border gap-2 border-t pt-3">
          <Text variant="muted" className="text-xs">{t('examControl.as_archiveName')}</Text>
          <Input value={archiveName} onChangeText={setArchiveName} />
          <Button variant="outline" onPress={archive}>
            <Icon as={Archive} className="text-foreground size-4" />
            <Text>{t('examControl.as_saveToArchive')}</Text>
          </Button>
        </View>
      ) : null}
    </FormSection>
  );
}

function KeyEditor({ sessionId, answerKey, editable, onSaved }: { sessionId: string; answerKey: JcAnswerKey; editable: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const n = answerKey.question_count;
  const pad = <T,>(arr: T[] | undefined, fill: T) => Array.from({ length: n }, (_, i) => arr?.[i] ?? fill);
  const [keyA, setKeyA] = useState(() => pad(answerKey.key_a, ''));
  const [keyB, setKeyB] = useState(() => pad(answerKey.key_b, ''));
  const [points, setPoints] = useState(() => pad(answerKey.points, 1).map(String));
  const [handling, setHandling] = useState<JaHandling[]>(() => pad(answerKey.handling, 'normal' as JaHandling));
  const [objectives, setObjectives] = useState(() => pad(answerKey.objectives, null as number | null));
  const [bToA, setBToA] = useState(() => pad(answerKey.b_to_a, null as number | null).map((v) => (v === null ? '' : String(v))));
  const [objNames, setObjNames] = useState(answerKey.objective_names.join('، '));
  const [maxScore, setMaxScore] = useState(String(answerKey.max_score));
  const [simMin, setSimMin] = useState(String(answerKey.similarity_min));
  const [simRatio, setSimRatio] = useState(String(answerKey.similarity_ratio));
  const [busy, setBusy] = useState(false);
  const objList = objNames.split(/[،,]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
  const opts = answerKey.options === 5 ? 'أ ب ج د ه' : 'أ ب ج د';
  const at = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));

  const save = async () => {
    setBusy(true);
    const res = await jahbadhAssessment.saveKey(sessionId, {
      grade_level_id: answerKey.grade_level_id,
      subject_key: answerKey.subject_key,
      part_key: answerKey.part_key,
      question_count: n,
      options: answerKey.options,
      key_a: keyA.map((x) => x.trim()),
      key_b: keyB.map((x) => x.trim()),
      points: points.map((p) => Number(p) || 1),
      handling,
      max_score: Number(maxScore) || undefined,
      objective_names: objList,
      objectives,
      b_to_a: bToA.map((v) => (v.trim() ? Number(v) : null)),
      similarity_min: Number(simMin) || undefined,
      similarity_ratio: Number(simRatio) || undefined,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.saved'));
    onSaved();
  };

  return (
    <View className="gap-3">
      <Text variant="muted" className="text-xs">{t('examControl.as_keyHint', { options: opts })}</Text>
      <View className="gap-1">
        <Text variant="muted" className="text-xs">{t('examControl.as_maxScore')}</Text>
        <Input value={maxScore} editable={editable} onChangeText={setMaxScore} keyboardType="decimal-pad" />
      </View>
      <View className="gap-1">
        <Text variant="muted" className="text-xs">{t('examControl.as_objectiveNames')}</Text>
        <Input value={objNames} editable={editable} onChangeText={setObjNames} placeholder={t('examControl.as_objectiveNamesHint')} />
      </View>
      {keyA.map((_, i) => (
        <View key={i} className="border-border gap-2 rounded-xl border p-2">
          <View className="flex-row items-center gap-2">
            <Text className="w-7 text-sm font-semibold">{String(i + 1)}</Text>
            <Input className="flex-1" value={keyA[i]} editable={editable} onChangeText={(v) => setKeyA((a) => at(a, i, v))} placeholder={t('examControl.as_keyA')} accessibilityLabel={`${t('examControl.as_keyA')} ${i + 1}`} />
            <Input className="flex-1" value={keyB[i]} editable={editable} onChangeText={(v) => setKeyB((a) => at(a, i, v))} placeholder={t('examControl.as_keyB')} accessibilityLabel={`${t('examControl.as_keyB')} ${i + 1}`} />
            <Input className="w-16" value={bToA[i]} editable={editable} onChangeText={(v) => setBToA((a) => at(a, i, v))} keyboardType="number-pad" placeholder={t('examControl.as_bToA')} accessibilityLabel={`${t('examControl.as_bToA')} ${i + 1}`} />
            <Input className="w-14" value={points[i]} editable={editable} onChangeText={(v) => setPoints((a) => at(a, i, v))} keyboardType="decimal-pad" accessibilityLabel={`${t('examControl.as_points')} ${i + 1}`} />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Picker value={handling[i]} onChange={(v) => editable && setHandling((a) => at(a, i, v as JaHandling))} options={HANDLING.map((h) => ({ value: h, label: t(`examControl.as_handling_${h}`) }))} />
            </View>
            {objList.length ? (
              <View className="flex-1">
                <Picker
                  value={objectives[i] === null ? '__none' : String(objectives[i])}
                  onChange={(v) => editable && setObjectives((a) => at(a, i, v === '__none' ? null : Number(v)))}
                  options={[{ value: '__none', label: '—' }, ...objList.map((o, j) => ({ value: String(j), label: o }))]}
                />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('examControl.as_similarityMin')}</Text>
          <Input value={simMin} editable={editable} onChangeText={setSimMin} keyboardType="number-pad" />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('examControl.as_similarityRatio')}</Text>
          <Input value={simRatio} editable={editable} onChangeText={setSimRatio} keyboardType="decimal-pad" />
        </View>
      </View>
      {editable ? (
        <Button disabled={busy} onPress={save}>
          <Icon as={Save} className="size-4 text-white" />
          <Text>{t('examControl.save')}</Text>
        </Button>
      ) : (
        <Note text={t('examControl.as_keyReadOnly')} />
      )}
    </View>
  );
}

function AnswersPanel({ sessionId, answerKey }: { sessionId: string; answerKey: JcAnswerKey }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const keyId = answerKey.id;
  const sheets = useApi(['ja', 'sheets', sessionId, keyId] as const, ([, , s, k]) => jahbadhAssessment.sheets(s, k));
  const [draft, setDraft] = useState<Record<number, { answers?: string; version?: JaVersion }>>({});
  const [entry, setEntry] = useState<'1' | '2'>('1');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [partsNote, setPartsNote] = useState<null | 'parts_not_available' | 'enter_by_part'>(null);
  const data = sheets.data;
  const dirty = Object.keys(draft).length;
  const answerText = (row: JcAnswerSheets['rows'][number]) => (row.answers ? row.answers.map((a) => (a === '' ? '-' : a)).join('') : '');

  const save = async () => {
    const rows = data?.rows ?? [];
    setBusy(true);
    const entries = Object.entries(draft).map(([secret, d]) => {
      const row = rows.find((r) => r.secret === Number(secret));
      const text = d.answers !== undefined ? d.answers : row ? answerText(row) : '';
      return { secret: Number(secret), answers: text.trim() ? text : null, version: d.version };
    });
    const res = await jahbadhAssessment.saveSheets(sessionId, keyId, entries);
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.saved'));
    setDraft({});
    sheets.mutate(res.data, { revalidate: false });
  };

  const fail = (res: { error?: string; code?: string }) => {
    if (res.code === 'parts_not_available' || res.code === 'enter_by_part') return setPartsNote(res.code);
    toast.error(res.error ?? t('app.error_title'));
  };
  const transfer = async () => {
    setPartsNote(null);
    const e = Number(entry) as 1 | 2;
    const preview = await jahbadhAssessment.transferPreview(sessionId, keyId, e);
    if (!preview.success) return fail(preview);
    if (!(await confirm({ title: t('examControl.as_transfer'), body: t('examControl.as_confirmTransfer', { count: preview.data?.count ?? 0, entry: e }) }))) return;
    const res = await jahbadhAssessment.transfer(sessionId, keyId, e);
    if (!res.success) return fail(res);
    toast.success(t('examControl.as_transferred', { transferred: res.data?.transferred ?? 0, saved: res.data?.saved ?? 0, cleared: res.data?.cleared ?? 0 }));
    void sheets.mutate();
  };

  if (sheets.error) return <Note tone="destructive" text={sheets.error.message} />;
  if (!data) return <LoadingList rows={3} />;
  const term = search.trim();
  const rows = data.rows.filter((r) => !term || String(r.secret).includes(term) || (r.name ?? '').includes(term) || (r.committee ?? '').includes(term));
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <MiniTile label={t('examControl.as_students')} value={data.counts.students} />
        <MiniTile label={t('examControl.as_entered')} value={data.counts.entered} tone={data.counts.entered === data.counts.students ? 'success' : 'warning'} />
        <MiniTile label={t('examControl.as_notTransferred')} value={data.counts.not_transferred} tone={data.counts.not_transferred ? 'warning' : 'success'} />
      </View>
      <Note tone={data.unmasked ? 'warning' : 'muted'} text={data.unmasked ? t('examControl.as_unmaskedLocked') : t('examControl.as_answersHint')} />
      {partsNote ? <Note tone="warning" text={t(partsNote === 'enter_by_part' ? 'examControl.as_enterByPart' : 'examControl.as_partsNotAvailable')} /> : null}
      <Input value={search} onChangeText={setSearch} placeholder={t('examControl.as_searchSecret')} />
      {rows.map((row) => {
        const d = draft[row.secret];
        const version = d?.version ?? row.version;
        return (
          <View key={row.secret} className={cn('border-border gap-2 rounded-xl border p-3', d && 'bg-warning-soft')}>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-sm font-semibold">{`${t('examControl.as_secret')} ${row.secret}`}</Text>
              {row.committee ? <Text variant="muted" className="text-xs">{row.committee}</Text> : null}
              {row.name ? <Text className="text-xs">{row.name}</Text> : null}
              <View className="flex-1" />
              {row.transferred ? (
                <StatusChip label={row.needs_transfer ? t('examControl.as_changedSinceTransfer') : t('examControl.as_transferredEntry', { n: row.transferred.entry ?? 1 })} tone={row.needs_transfer ? 'warning' : 'success'} />
              ) : row.result ? (
                <StatusChip label={t('examControl.as_notYet')} tone="muted" />
              ) : null}
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-24">
                <FilterChips<JaVersion> value={version} onChange={(v) => !data.unmasked && setDraft((x) => ({ ...x, [row.secret]: { ...x[row.secret], version: v } }))} options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]} />
              </View>
              <Input
                className="flex-1"
                editable={!data.unmasked}
                value={d?.answers ?? answerText(row)}
                onChangeText={(v) => setDraft((x) => ({ ...x, [row.secret]: { ...x[row.secret], answers: v } }))}
                placeholder={t('examControl.as_answersPlaceholder', { n: answerKey.question_count })}
                accessibilityLabel={`${t('examControl.as_answers')} ${row.secret}`}
              />
            </View>
            {row.result ? (
              <Text variant="muted" className="text-xs">
                {`${t('examControl.as_score')}: ${row.result.score ?? '—'} / ${answerKey.max_score} · ${row.result.correct}✓ ${row.result.wrong}✗ ${row.result.blank}○`}
              </Text>
            ) : null}
          </View>
        );
      })}
      <View className="gap-2">
        <Button disabled={!dirty || busy || data.unmasked} onPress={save}>
          <Icon as={Save} className="size-4 text-white" />
          <Text>{t('examControl.as_saveAnswers', { count: dirty })}</Text>
        </Button>
        <FilterChips<'1' | '2'> value={entry} onChange={setEntry} options={[{ value: '1', label: t('examControl.as_entryN', { n: 1 }) }, { value: '2', label: t('examControl.as_entryN', { n: 2 }) }]} />
        <Button variant="outline" disabled={dirty > 0 || data.unmasked} onPress={transfer}>
          <Icon as={Upload} className="text-foreground size-4" />
          <Text>{t('examControl.as_transfer')}</Text>
        </Button>
      </View>
      {data.questions.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {data.questions.map((q) => (
            <StatusChip
              key={q.question}
              label={`${q.question}: ${pct(q.pctCorrect, 0)}${q.commonWrong ? ` (${q.commonWrong})` : ''}`}
              tone={q.pctCorrect === null ? 'muted' : q.pctCorrect >= 0.7 ? 'success' : q.pctCorrect >= 0.4 ? 'warning' : 'destructive'}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const VERDICT_TONE: Record<string, ChipTone> = { check_key: 'destructive', too_hard: 'warning', too_easy: 'warning', weak: 'warning', good: 'success', excluded: 'muted' };

function AnalysisPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<'A' | 'B' | 'all'>('all');
  const res = useApi(['ja', 'analysis', sessionId, keyId, version] as const, ([, , s, k, v]) => jahbadhAssessment.analysis(s, k, v));
  const a = res.data;
  return (
    <View className="gap-3">
      <FilterChips<'A' | 'B' | 'all'>
        value={version}
        onChange={setVersion}
        options={[
          { value: 'all', label: t('examControl.as_versionAll') },
          { value: 'A', label: t('examControl.as_versionN', { v: 'A' }) },
          { value: 'B', label: t('examControl.as_versionN', { v: 'B' }) },
        ]}
      />
      {res.error ? (
        <Note tone="destructive" text={res.error.message} />
      ) : !a ? (
        <LoadingList rows={3} />
      ) : !a.n ? (
        <EmptyState title={t('examControl.as_noAnswersYet')} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            <MiniTile label={t('examControl.as_kr20')} value={a.kr20 === null ? '—' : a.kr20.toFixed(2)} tone={a.kr20 !== null && a.kr20 >= 0.7 ? 'success' : 'warning'} />
            <MiniTile label={t('examControl.as_n')} value={a.n} />
            <MiniTile label={t('examControl.as_groupSize')} value={a.groupSize} />
          </View>
          <Text variant="muted" className="text-xs">{t('examControl.as_analysisHint')}</Text>
          {a.items.map((it) => (
            <View key={it.question} className="border-border gap-1 rounded-xl border p-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-sm font-semibold">{`${it.question} · ${t('examControl.as_key')}: ${it.key.join('/') || '—'}`}</Text>
                <Text variant="muted" className="text-xs">{`p ${it.p.toFixed(2)} · D ${it.d.toFixed(2)}`}</Text>
                <View className="flex-1" />
                <StatusChip label={t(`examControl.as_verdict_${it.verdict}`)} tone={VERDICT_TONE[it.verdict] ?? 'muted'} />
              </View>
              <Text className="text-xs">
                {Object.entries(it.shares).map(([opt, share]) => `${opt || t('examControl.as_blank')}${it.key.includes(opt) ? '✓' : ''} ${pct(share, 0)}`).join('   ')}
              </Text>
              {it.notes.length ? (
                <Text variant="muted" className="text-xs">
                  {it.notes.map((n) => `${t(`examControl.as_note_${n}`)}${it.noteOptions[n]?.length ? ` (${it.noteOptions[n].join('، ')})` : ''}`).join(' · ')}
                </Text>
              ) : null}
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const LEVEL_TONE: Record<string, ChipTone> = { mastered: 'success', close: 'warning', support: 'destructive' };

function MasteryPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const { t } = useTranslation();
  const res = useApi(['ja', 'mastery', sessionId, keyId] as const, ([, , s, k]) => jahbadhAssessment.mastery(s, k));
  const m = res.data;
  if (res.error) return <Note tone="destructive" text={res.error.message} />;
  if (!m) return <LoadingList rows={3} />;
  if (!m.objectives.length) return <EmptyState title={t('examControl.as_noObjectives')} />;
  return (
    <View className="gap-3">
      {m.classSummary.map((c) => (
        <View key={c.objective} className="border-border flex-row items-center gap-3 rounded-xl border p-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold">{c.name}</Text>
            <Text variant="muted" className="text-xs">{t('examControl.as_questionsList', { list: c.questions.join('، ') })}</Text>
          </View>
          <Text className="text-lg font-bold">{pct(c.pct, 0)}</Text>
          {c.level ? <StatusChip label={t(`examControl.as_level_${c.level}`)} tone={LEVEL_TONE[c.level]} /> : null}
        </View>
      ))}
      {m.students.map((s) => (
        <View key={s.secret} className="border-border gap-1 rounded-xl border p-3">
          <Text className="text-sm font-semibold">{`${t('examControl.as_secret')} ${s.secret}${s.name ? ` · ${s.name}` : ''}`}</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {s.pct.map((p, i) => (
              <StatusChip key={i} label={`${m.objectives[i]}: ${pct(p, 0)}`} tone={s.levels[i] ? LEVEL_TONE[s.levels[i]!] : 'muted'} />
            ))}
          </View>
          {s.weakest !== null ? <Text variant="muted" className="text-xs">{`${t('examControl.as_weakest')}: ${m.objectives[s.weakest]}`}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function SimilarityPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [scan, setScan] = useState(false);
  const res = useApi(scan ? (['ja', 'similarity', sessionId, keyId] as const) : null, ([, , s, k]) => jahbadhAssessment.similarity(s, k));
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [manual, setManual] = useState<null | { identicalWrong: number; wrongA: number; wrongB: number; ratio: number; flagged: boolean; questions: number[] }>(null);
  const compare = async () => {
    const out = await jahbadhAssessment.similarity(sessionId, keyId, { a: Number(a), b: Number(b) });
    if (!out.success) return toast.error(out.error ?? t('app.error_title'));
    setManual(out.data?.manual ?? null);
  };
  const d = res.data;
  return (
    <View className="gap-3">
      <Note tone="warning" text={t('examControl.as_similarityWarning')} />
      <Button variant="outline" onPress={() => (scan ? void res.mutate() : setScan(true))}>
        <Icon as={Search} className="text-foreground size-4" />
        <Text>{t('examControl.as_scanNeighbours')}</Text>
      </Button>
      {scan ? (
        res.error ? (
          <Note tone="destructive" text={res.error.message} />
        ) : !d ? (
          <LoadingList rows={2} />
        ) : (
          <View className="gap-2">
            <Text variant="muted" className="text-xs">
              {t('examControl.as_scanSummary', { compared: d.compared ?? 0, flagged: d.flagged?.length ?? 0, min: d.thresholds?.min ?? 0, ratio: pct(d.thresholds?.ratio ?? 0, 0) })}
            </Text>
            {d.flagged?.length ? (
              d.flagged.map((f, i) => (
                <View key={i} className="border-border gap-1 rounded-xl border p-3">
                  <Text className="text-sm font-semibold">{`${f.a}${f.a_name ? ` (${f.a_name})` : ''} ↔ ${f.b}${f.b_name ? ` (${f.b_name})` : ''}`}</Text>
                  <Text variant="muted" className="text-xs">
                    {`${f.committee} · ${t(`examControl.as_rel_${f.relation}`)} · ${t('examControl.as_identicalWrong')} ${f.identicalWrong} · ${pct(f.ratio, 0)}`}
                  </Text>
                  <Text className="text-xs">{t('examControl.as_questionsList', { list: f.questions.join('، ') })}</Text>
                </View>
              ))
            ) : (
              <EmptyState title={t('examControl.as_noFlagged')} />
            )}
          </View>
        )
      ) : null}
      <Text className="text-sm font-semibold">{t('examControl.as_manualCompare')}</Text>
      <View className="flex-row gap-2">
        <Input className="flex-1" value={a} onChangeText={setA} keyboardType="number-pad" placeholder={t('examControl.as_secretA')} />
        <Input className="flex-1" value={b} onChangeText={setB} keyboardType="number-pad" placeholder={t('examControl.as_secretB')} />
      </View>
      <Button disabled={!a || !b} onPress={compare}>
        <Text>{t('examControl.as_compare')}</Text>
      </Button>
      {manual ? (
        <Note
          tone={manual.flagged ? 'warning' : 'muted'}
          text={`${t('examControl.as_manualResult', { identical: manual.identicalWrong, wrongA: manual.wrongA, wrongB: manual.wrongB, ratio: pct(manual.ratio, 0) })}${manual.questions.length ? ` · ${t('examControl.as_questionsList', { list: manual.questions.join('، ') })}` : ''}`}
        />
      ) : null}
    </View>
  );
}

function PrintsPanel({ sessionId, keyId, canBubble }: { sessionId: string; keyId: string; canBubble: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const committees = useApi(canBubble ? (['jc', 'committees', sessionId] as const) : null, ([, , s]) => jahbadhControl.committees(s));
  const [committeeId, setCommitteeId] = useState('__all');
  const [batch, setBatch] = useState('1');
  const share = async (path: string, name: string) => {
    try {
      await shareApiFile(path, name, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-sm font-semibold">{t('examControl.as_errorSlips')}</Text>
        <Text variant="muted" className="text-xs">{t('examControl.as_errorSlipsHint')}</Text>
        <Button variant="outline" onPress={() => share(jaPdfPath.errorSlips(sessionId, keyId), 'error-slips.pdf')}>
          <Icon as={FileText} className="text-foreground size-4" />
          <Text>{t('examControl.as_print')}</Text>
        </Button>
      </View>
      <View className="gap-1">
        <Text className="text-sm font-semibold">{t('examControl.as_bubbleSheets')}</Text>
        <Text variant="muted" className="text-xs">{t('examControl.as_bubbleSheetsHint')}</Text>
        {canBubble ? (
          <>
            <Picker
              value={committeeId}
              onChange={setCommitteeId}
              options={[{ value: '__all', label: t('examControl.as_allCommittees') }, ...(committees.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
            <View className="flex-row items-center gap-2">
              <Text variant="muted" className="text-xs">{t('examControl.as_batch')}</Text>
              <Input className="w-20" value={batch} onChangeText={setBatch} keyboardType="number-pad" />
            </View>
            <Button
              variant="outline"
              onPress={() =>
                share(jaPdfPath.bubbleSheets(sessionId, keyId, { committeeId: committeeId === '__all' ? null : committeeId, offset: (Math.max(1, Number(batch) || 1) - 1) * 40 }), 'bubble-sheets.pdf')
              }>
              <Icon as={Printer} className="text-foreground size-4" />
              <Text>{t('examControl.as_print')}</Text>
            </Button>
          </>
        ) : (
          <Note text={t('examControl.as_bubbleSecretOnly')} />
        )}
      </View>
    </View>
  );
}

function FairnessSection({ sessionId, grades }: { sessionId: string; grades: JcGrade[] }) {
  const { t } = useTranslation();
  const [gradeId, setGradeId] = useState<string | null>(grades[0]?.grade_level_id ?? null);
  const [threshold, setThreshold] = useState('0.05');
  const res = useApi(gradeId ? (['ja', 'fairness', sessionId, gradeId, threshold] as const) : null, ([, , s, g, th]) => jahbadhAssessment.fairness(s, g, Number(th) || undefined));
  const f = res.data;
  return (
    <FormSection title={t('examControl.as_fairness')} description={t('examControl.as_fairnessHint')}>
      <Picker value={gradeId} onChange={setGradeId} placeholder={t('examControl.as_grade')} options={grades.map((g) => ({ value: g.grade_level_id, label: g.grade_level_name }))} />
      <View className="flex-row items-center gap-2">
        <Text variant="muted" className="text-xs">{t('examControl.as_threshold')}</Text>
        <Input className="w-24" value={threshold} onChangeText={setThreshold} keyboardType="decimal-pad" />
      </View>
      {res.error ? (
        <Note tone="destructive" text={res.error.message} />
      ) : !f ? (
        gradeId ? <LoadingList rows={2} /> : null
      ) : !f.sections.length ? (
        <EmptyState title={t('examControl.as_noAgreedScores')} />
      ) : (
        <>
          <View className="flex-row flex-wrap gap-1.5">
            {f.subjects.map((s) => (
              <StatusChip key={s.key} label={`${s.name}: ${pct(f.grade_mean[s.key])}`} tone="muted" />
            ))}
          </View>
          {f.sections.map((sec) => (
            <View key={sec} className="border-border gap-1 rounded-xl border p-3">
              <Text className="text-sm font-semibold">{`${t('examControl.as_section')} ${sec}`}</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {f.subjects.map((s) => {
                  const c = f.cells.find((x) => x.section === sec && x.subject === s.key);
                  if (!c) return null;
                  const gap = c.gap === null ? '—' : `${c.gap > 0 ? '+' : ''}${(c.gap * 100).toFixed(1)}`;
                  return <StatusChip key={s.key} label={`${s.name}: ${pct(c.mean)} (${gap})`} tone={c.flagged ? ((c.gap ?? 0) > 0 ? 'warning' : 'destructive') : 'muted'} />;
                })}
              </View>
            </View>
          ))}
        </>
      )}
    </FormSection>
  );
}

function ArchiveSection({ sessionId, grades, chief, onRecalled }: { sessionId: string; grades: JcGrade[]; chief: boolean; onRecalled: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useApi(['ja', 'archive', sessionId] as const, ([, , s]) => jahbadhAssessment.archive(s));
  const [recall, setRecall] = useState<string | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(grades[0]?.grade_level_id ?? null);
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const grade = grades.find((g) => g.grade_level_id === gradeId);

  const remove = async (archiveId: string) => {
    if (!(await confirm({ title: t('examControl.as_deleteArchive'), body: t('examControl.as_confirmDeleteArchive'), destructive: true }))) return;
    const res = await jahbadhAssessment.deleteArchive(sessionId, archiveId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.deleted'));
    void list.mutate();
  };
  const doRecall = async () => {
    if (!recall || !gradeId || !subjectKey) return;
    const res = await jahbadhAssessment.recallArchive(sessionId, recall, { grade_level_id: gradeId, subject_key: subjectKey });
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('examControl.as_recalled'));
    setRecall(null);
    onRecalled();
  };

  return (
    <FormSection title={t('examControl.as_archive')} description={t('examControl.as_archiveHint')}>
      {list.error ? (
        <Note tone="destructive" text={list.error.message} />
      ) : !list.data ? (
        <LoadingList rows={2} />
      ) : !list.data.length ? (
        <Text variant="muted" className="text-sm">{t('examControl.as_archiveEmpty')}</Text>
      ) : (
        list.data.map((a) => (
          <View key={a.id} className="border-border gap-2 rounded-xl border p-3">
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold">{a.name}</Text>
                <Text variant="muted" className="text-xs">{`${t('examControl.as_questionsN', { n: a.question_count })} · ${a.test_date ?? a.created_at.slice(0, 10)}`}</Text>
              </View>
              {chief ? (
                <Pressable onPress={() => remove(a.id)} accessibilityRole="button" accessibilityLabel={t('examControl.as_deleteArchive')} className="p-2">
                  <Icon as={Trash2} className="text-destructive size-5" />
                </Pressable>
              ) : null}
            </View>
            {recall === a.id ? (
              <View className="gap-2">
                <Text variant="muted" className="text-xs">{t('examControl.as_recallHint')}</Text>
                <Picker value={gradeId} onChange={(v) => { setGradeId(v); setSubjectKey(null); }} placeholder={t('examControl.as_grade')} options={grades.map((g) => ({ value: g.grade_level_id, label: g.grade_level_name }))} />
                <Picker value={subjectKey} onChange={setSubjectKey} placeholder={t('examControl.as_subject')} options={(grade?.subjects ?? []).map((s) => ({ value: s.key, label: s.name }))} />
                <View className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onPress={() => setRecall(null)}>
                    <Text>{t('examControl.cancel')}</Text>
                  </Button>
                  <Button className="flex-1" disabled={!gradeId || !subjectKey} onPress={doRecall}>
                    <Text>{t('examControl.as_recall')}</Text>
                  </Button>
                </View>
              </View>
            ) : (
              <Button variant="outline" size="sm" onPress={() => setRecall(a.id)}>
                <Icon as={RotateCcw} className="text-foreground size-4" />
                <Text>{t('examControl.as_recall')}</Text>
              </Button>
            )}
          </View>
        ))
      )}
    </FormSection>
  );
}
