import type { JaHandling, JgQuizCommitPreview, JgQuizGrading, JgQuizKey, JgQuizTarget } from '@studently/api-client';
import { Stack } from 'expo-router';
import { CheckCheck, Pencil, Plus, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { JgBlocked, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhAssessment, api } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const HANDLING: JaHandling[] = ['normal', 'all', 'excluded'];

/** «التصحيح الآلي» (#61, web: /admin|teacher/jahbadh-grades/quiz-grading): a quiz key graded into one grade column. */
export default function JahbadhQuizGrading() {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  return (
    <>
      <Stack.Screen options={{ title: t('grades.qg_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">{t('grades.qg_subtitle')}</Text>
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {sectionId ? <Body key={sectionId} sectionId={sectionId} isAdmin={isAdmin} /> : null}
      </ScrollView>
    </>
  );
}

function Body({ sectionId, isAdmin }: { sectionId: string; isAdmin: boolean }) {
  const { t } = useTranslation();
  const targets = useApi(['qg', 'targets', sectionId] as const, ([, , s]) => jahbadhAssessment.quizTargets(s));
  const keys = useApi(['qg', 'keys', sectionId] as const, ([, , s]) => jahbadhAssessment.quizKeys(s));
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<JgQuizKey | 'new' | null>(null);
  const error = targets.error ?? keys.error;
  if (error) return <JgBlocked error={error} isAdmin={isAdmin} />;
  if (!targets.data || !keys.data) return <LoadingList rows={3} />;
  const list = keys.data;
  const current = list.find((k) => k.id === openId) ?? null;
  return (
    <>
      <FormSection
        title={t('grades.qg_keys')}
        action={
          targets.data.length && !editing ? (
            <Button size="sm" onPress={() => setEditing('new')}>
              <Icon as={Plus} className="size-4 text-white" />
              <Text>{t('grades.qg_newKey')}</Text>
            </Button>
          ) : undefined
        }>
        {!targets.data.length ? (
          <Text variant="muted" className="text-sm">{t('grades.qg_noTargets')}</Text>
        ) : !list.length ? (
          <Text variant="muted" className="text-sm">{t('grades.qg_noKeys')}</Text>
        ) : (
          <FilterChips<string> value={openId ?? ''} onChange={setOpenId} options={list.map((k) => ({ value: k.id, label: `${k.title || k.target?.label || ''} · ${k.target?.subject_name ?? ''}` }))} />
        )}
      </FormSection>
      {editing ? (
        <KeyForm
          sectionId={sectionId}
          targets={targets.data}
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(g) => {
            setEditing(null);
            void keys.mutate();
            setOpenId(g.key.id);
          }}
        />
      ) : null}
      {current && !editing ? (
        <KeyPanel
          key={current.id}
          sectionId={sectionId}
          quizKey={current}
          onEdit={() => setEditing(current)}
          onDeleted={() => {
            setOpenId(null);
            void keys.mutate();
          }}
        />
      ) : null}
    </>
  );
}

function KeyForm({ sectionId, targets, initial, onClose, onSaved }: { sectionId: string; targets: JgQuizTarget[]; initial: JgQuizKey | null; onClose: () => void; onSaved: (g: JgQuizGrading) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const tv = (x: { kind: string; id: string }) => `${x.kind}:${x.id}`;
  const initialTarget = initial ? targets.find((x) => x.id === (initial.subitem_id ?? initial.component_id)) : targets[0];
  const [target, setTarget] = useState<string | null>(initialTarget ? tv(initialTarget) : null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [count, setCount] = useState(String(initial?.question_count ?? 10));
  const [options, setOptions] = useState<'4' | '5'>(initial?.options === 5 ? '5' : '4');
  const n = Math.max(1, Math.min(30, Number(count) || 1));
  const [keyA, setKeyA] = useState<string[]>(() => Array.from({ length: 30 }, (_, i) => initial?.key_a[i] ?? ''));
  const [points, setPoints] = useState<string[]>(() => Array.from({ length: 30 }, (_, i) => String(initial?.points[i] ?? 1)));
  const [handling, setHandling] = useState<JaHandling[]>(() => Array.from({ length: 30 }, (_, i) => initial?.handling[i] ?? 'normal'));
  const [platform, setPlatform] = useState<string>(initial?.platform_quiz_id ?? '__none');
  const quizzes = useApi(['qg', 'my-quizzes'] as const, () => api.get<{ id: string; title: string }[]>('/quiz?mine=1'));
  const [busy, setBusy] = useState(false);
  const sel = targets.find((x) => tv(x) === target);
  const at = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));

  const save = async () => {
    if (!sel) return;
    setBusy(true);
    const res = await jahbadhAssessment.saveQuizKey(sectionId, {
      id: initial?.id,
      jg_subject_id: sel.subject_id,
      target_kind: sel.kind,
      target_id: sel.id,
      title: title.trim() || undefined,
      question_count: n,
      options: Number(options) as 4 | 5,
      key_a: keyA.slice(0, n).map((x) => x.trim()),
      points: points.slice(0, n).map((p) => Number(p) || 1),
      handling: handling.slice(0, n),
      platform_quiz_id: platform === '__none' ? null : platform,
    });
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    onSaved(res.data);
  };

  return (
    <FormSection title={initial ? t('grades.qg_editKey') : t('grades.qg_newKey')}>
      <Picker value={target} onChange={setTarget} placeholder={t('grades.qg_target')} options={targets.map((x) => ({ value: tv(x), label: `${x.subject_name} — ${x.label} (${x.max})` }))} />
      <View className="gap-1">
        <Text variant="muted" className="text-xs">{t('grades.qg_titleLabel')}</Text>
        <Input value={title} onChangeText={setTitle} />
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('grades.qg_questionCount')}</Text>
          <Input value={count} onChangeText={setCount} keyboardType="number-pad" />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="muted" className="text-xs">{t('grades.qg_options')}</Text>
          <FilterChips<'4' | '5'> value={options} onChange={setOptions} options={[{ value: '4', label: 'أ–د' }, { value: '5', label: 'أ–ه' }]} />
        </View>
      </View>
      <View className="gap-1">
        <Text variant="muted" className="text-xs">{t('grades.qg_platformQuiz')}</Text>
        <Picker value={platform} onChange={setPlatform} options={[{ value: '__none', label: t('grades.qg_typedAnswers') }, ...(quizzes.data ?? []).map((q) => ({ value: q.id, label: q.title }))]} />
        {platform !== '__none' ? <Text variant="muted" className="text-xs">{t('grades.qg_platformHint')}</Text> : null}
      </View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} className="flex-row items-center gap-2">
          <Text className="w-7 text-sm font-semibold">{String(i + 1)}</Text>
          <Input className="w-20" value={keyA[i]} onChangeText={(v) => setKeyA((a) => at(a, i, v))} placeholder={t('grades.qg_key')} accessibilityLabel={`${t('grades.qg_key')} ${i + 1}`} />
          <Input className="w-16" value={points[i]} onChangeText={(v) => setPoints((a) => at(a, i, v))} keyboardType="decimal-pad" accessibilityLabel={`${t('grades.qg_points')} ${i + 1}`} />
          <View className="flex-1">
            <Picker value={handling[i]} onChange={(v) => setHandling((a) => at(a, i, v as JaHandling))} options={HANDLING.map((h) => ({ value: h, label: t(`grades.qg_handling_${h}`) }))} />
          </View>
        </View>
      ))}
      <View className="flex-row gap-2">
        <Button variant="outline" className="flex-1" onPress={onClose}>
          <Text>{t('grades.cancel')}</Text>
        </Button>
        <Button className="flex-1" disabled={!sel || busy} onPress={save}>
          <Icon as={Save} className="size-4 text-white" />
          <Text>{t('grades.save')}</Text>
        </Button>
      </View>
    </FormSection>
  );
}

function KeyPanel({ sectionId, quizKey, onEdit, onDeleted }: { sectionId: string; quizKey: JgQuizKey; onEdit: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const keyId = quizKey.id;
  const g = useApi(['qg', 'key', sectionId, keyId] as const, ([, , s, k]) => jahbadhAssessment.quizKey(s, k));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<JgQuizCommitPreview | null>(null);
  const data = g.data;
  const typed = !quizKey.platform_quiz_id;
  const dirty = Object.keys(draft).length;
  const text = (answers: JgQuizGrading['rows'][number]['answers']) => (answers ? answers.map((a) => (a === '' ? '-' : a)).join('') : '');

  const saveAnswers = async () => {
    setBusy(true);
    const res = await jahbadhAssessment.saveQuizAnswers(sectionId, keyId, Object.entries(draft).map(([student_id, v]) => ({ student_id, answers: v.trim() ? v : null })));
    setBusy(false);
    if (!res.success || !res.data) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    setDraft({});
    g.mutate(res.data, { revalidate: false });
  };
  const openPreview = async () => {
    const res = await jahbadhAssessment.quizCommitPreview(sectionId, keyId);
    if (!res.success || !res.data) return toast.error(res.error ?? t('app.error_title'));
    setPreview(res.data);
  };
  const commit = async () => {
    const res = await jahbadhAssessment.quizCommit(sectionId, keyId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.qg_written', { count: res.data?.written ?? 0 }));
    setPreview(null);
    void g.mutate();
  };
  const remove = async () => {
    if (!(await confirm({ title: t('grades.qg_deleteKey'), body: t('grades.qg_confirmDelete'), destructive: true }))) return;
    const res = await jahbadhAssessment.deleteQuizKey(sectionId, keyId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.qg_deleted'));
    onDeleted();
  };

  if (g.error) return <EmptyState title={t('grades.loadError')} body={g.error.message} />;
  if (!data) return <LoadingList rows={3} />;
  return (
    <FormSection
      title={quizKey.title || data.target.label}
      description={`${data.target.subject_name} — ${data.target.label} (${data.target.max}) · ${t('grades.qg_gradedOf', { graded: data.counts.graded, students: data.counts.students })}`}
      action={
        <View className="flex-row">
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={t('grades.qg_editKey')} className="p-2">
            <Icon as={Pencil} className="text-brand dark:text-brand-secondary size-5" />
          </Pressable>
          <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel={t('grades.qg_deleteKey')} className="p-2">
            <Icon as={Trash2} className="text-destructive size-5" />
          </Pressable>
        </View>
      }>
      <Text variant="muted" className="text-xs">{typed ? t('grades.qg_answersHint') : t('grades.qg_platformHint')}</Text>
      {data.rows.map((row) => (
        <View key={row.student_id} className={cn('border-border gap-1.5 rounded-xl border p-3', draft[row.student_id] !== undefined && 'bg-warning-soft')}>
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{row.name}</Text>
            <Text className="text-sm font-bold">{row.score === null ? '—' : String(row.score)}</Text>
            <Text variant="muted" className="text-xs">{`${t('grades.qg_current')}: ${row.current ?? '—'}`}</Text>
          </View>
          {typed ? (
            <Input value={draft[row.student_id] ?? text(row.answers)} onChangeText={(v) => setDraft((d) => ({ ...d, [row.student_id]: v }))} placeholder={t('grades.qg_answers')} accessibilityLabel={`${t('grades.qg_answers')} ${row.name}`} />
          ) : (
            <Text variant="muted" className="text-xs">{`${t('grades.qg_platformScore')}: ${row.platform ? `${row.platform.earned} / ${row.platform.possible}` : '—'}`}</Text>
          )}
          {row.result ? <Text variant="muted" className="text-xs">{`${row.result.correct}✓ ${row.result.wrong}✗ ${row.result.blank}○`}</Text> : null}
        </View>
      ))}
      {data.questions.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {data.questions.map((q) => (
            <StatusChip
              key={q.question}
              label={`${q.question}: ${q.pctCorrect === null ? '—' : `${Math.round(q.pctCorrect * 100)}%`}${q.commonWrong ? ` (${q.commonWrong})` : ''}`}
              tone={q.pctCorrect === null ? 'muted' : q.pctCorrect >= 0.7 ? 'success' : q.pctCorrect >= 0.4 ? 'warning' : 'destructive'}
            />
          ))}
        </View>
      ) : null}
      {typed ? (
        <Button variant="outline" disabled={!dirty || busy} onPress={saveAnswers}>
          <Icon as={Save} className="text-foreground size-4" />
          <Text>{t('grades.qg_saveAnswers', { count: dirty })}</Text>
        </Button>
      ) : null}
      {preview ? (
        <View className="border-border gap-2 rounded-xl border p-3">
          <Text className="text-sm">{t('grades.qg_previewHint', { label: `${preview.target.subject_name} — ${preview.target.label}`, changes: preview.changes.length, unchanged: preview.unchanged })}</Text>
          {preview.changes.map((c) => (
            <Text key={c.student_id} className="text-xs">{`${c.name}: ${c.from ?? '—'} → ${c.to ?? '—'}`}</Text>
          ))}
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={() => setPreview(null)}>
              <Text>{t('grades.cancel')}</Text>
            </Button>
            <Button className="flex-1" disabled={!preview.changes.length} onPress={commit}>
              <Text>{t('grades.qg_confirmWrite')}</Text>
            </Button>
          </View>
        </View>
      ) : (
        <Button disabled={dirty > 0 || !data.counts.graded} onPress={openPreview}>
          <Icon as={CheckCheck} className="size-4 text-white" />
          <Text>{t('grades.qg_writeToColumn')}</Text>
        </Button>
      )}
    </FormSection>
  );
}
