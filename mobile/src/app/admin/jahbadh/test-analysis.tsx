import { jgPdfPath, type JgStudent, type JgTest } from '@studently/api-client';
import { analyzeTest, fmtMark, fmtPct, JG_BLOOM_LEVELS, JG_ITEM_VERDICTS_AR, JG_RELIABILITY_AR, type JgBloomLevel } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { FilePlus2, Printer, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, IconTile, RowItem, StatTile, StatTiles, StickyActions } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, ShareBar, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const NONE = '__none__';
const r2 = (x: number | null) => (x === null ? '—' : (Math.round(x * 100) / 100).toFixed(2));

interface Form {
  id: string | null;
  name: string;
  date: string;
  subject: string | null;
  questions: { max: string; level: JgBloomLevel | null }[];
  scores: Record<string, string[]>;
}

const empty = (): Form => ({ id: null, name: '', date: '', subject: null, questions: Array.from({ length: 10 }, () => ({ max: '1', level: null })), scores: {} });
const fromTest = (x: JgTest): Form => ({
  id: x.id, name: x.name, date: x.test_date ?? '', subject: x.jg_subject_id,
  questions: x.questions.map((q) => ({ max: String(q.max), level: (q.level as JgBloomLevel) ?? null })),
  scores: Object.fromEntries(Object.entries(x.scores).map(([k, v]) => [k, v.map((n) => (n === null ? '' : String(n)))])),
});

/** Test item analysis (web: /admin/jahbadh-grades/test-analysis): questions, scores, p / D / alpha / SEM, Bloom mastery. */
export default function JahbadhTestAnalysis() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId: sel, setSection } = useJgSection(campusId);
  const sectionId = sel ?? '';
  const cid = campusId ?? 'own';
  const list = useApi(sel ? (['jg', 'tests', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.tests(s, c === 'own' ? null : c));
  const results = useApi(sel ? (['jg', 'results', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.results(s, c === 'own' ? null : c));
  const overview = useApi(sel ? (['jg', 'overview', sel, cid] as const) : null, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, c === 'own' ? null : c));
  const students: JgStudent[] = useMemo(() => results.data?.students.map((s) => s.student) ?? [], [results.data]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const live = useMemo(() => {
    if (!form) return null;
    const qs = form.questions.map((q) => ({ max: Number(q.max) || 0, level: q.level }));
    const rows = students.map((s) => (form.scores[s.id] ?? []).map((v) => (v === '' || v === undefined ? null : Number(v))));
    return { qs, rows, analysis: analyzeTest(qs, rows) };
  }, [form, students]);

  const open = async (id: string) => {
    const res = await jahbadhGrades.test(sectionId, id, campusId);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    if (res.data) setForm(fromTest(res.data));
  };
  const save = async () => {
    if (!form || !live) return;
    setSaving(true);
    const body = {
      name: form.name, test_date: form.date || null, jg_subject_id: form.subject, questions: live.qs,
      scores: Object.fromEntries(students.map((s, i) => [s.id, live.rows[i]] as const).filter(([, r]) => r.some((v) => v !== null))),
    };
    const res = form.id ? await jahbadhGrades.updateTest(sectionId, form.id, body, campusId) : await jahbadhGrades.createTest(sectionId, body, campusId);
    setSaving(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    if (res.data) setForm(fromTest(res.data));
    list.mutate();
  };
  const remove = () => {
    const id = form?.id;
    if (!id) return;
    Alert.alert(t('grades.confirmDelete'), undefined, [
      { text: t('grades.cancel'), style: 'cancel' },
      {
        text: t('grades.remove'),
        style: 'destructive',
        onPress: async () => {
          const res = await jahbadhGrades.deleteTest(sectionId, id, campusId);
          if (!res.success) return toast.error(res.error ?? t('app.error_title'));
          setForm(null);
          list.mutate(res.data, { revalidate: false });
        },
      },
    ]);
  };

  if (list.error) return <View className="bg-background flex-1 p-4"><JgBlocked error={list.error} isAdmin={isAdmin} /></View>;

  if (!form) {
    return (
      <>
        <Stack.Screen options={{ title: t('grades.testAnalysis') }} />
        <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
          <SectionHeader sections={sections} sectionId={sel} onChange={setSection} isAdmin={isAdmin} />
          <Text variant="muted" className="text-sm">{t('grades.testAnalysisSubtitle')}</Text>
          <Button onPress={() => setForm(empty())}>
            <Icon as={FilePlus2} className="text-primary-foreground size-4" />
            <Text>{t('grades.newTest')}</Text>
          </Button>
          {!list.data ? (
            <Skeleton className="h-32 rounded-2xl" />
          ) : list.data.length ? (
            <Panel>
              {list.data.map((x, i, all) => (
                <RowItem key={x.id} title={x.name} meta={x.test_date} leading={<IconTile icon={FilePlus2} />} onPress={() => open(x.id)} last={i === all.length - 1} />
              ))}
            </Panel>
          ) : (
            <Text variant="muted" className="text-sm">{t('grades.noTests')}</Text>
          )}
        </ScrollView>
      </>
    );
  }

  if (!live) return null;
  const a = live.analysis;
  const n = form.questions.length;
  const counted = students.filter((s) => (form.scores[s.id] ?? []).some((v) => v !== '' && v !== undefined));
  const setQ = (i: number, p: Partial<Form['questions'][number]>) => setForm({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  const setScore = (sid: string, i: number, v: string) => {
    const row = [...(form.scores[sid] ?? Array(n).fill(''))];
    row[i] = v;
    setForm({ ...form, scores: { ...form.scores, [sid]: row } });
  };
  const levelOptions = [{ value: NONE, label: '—' }, ...JG_BLOOM_LEVELS.map((l) => ({ value: l, label: l }))];
  const formId = form.id;

  return (
    <>
      <Stack.Screen options={{ title: form.name || t('grades.newTest') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-8">
        <FormSection title={t('grades.testName')}>
          <Input value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Text variant="muted" className="text-xs">{t('grades.date')}</Text>
          <Input placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={form.date} onChangeText={(v) => setForm({ ...form, date: v })} />
          <Text variant="muted" className="text-xs">{t('grades.subject')}</Text>
          <Picker
            value={form.subject ?? NONE}
            onChange={(v) => setForm({ ...form, subject: v === NONE ? null : v })}
            options={[{ value: NONE, label: '—' }, ...(overview.data?.subjects ?? []).map((s) => ({ value: s.id, label: s.short_name }))]}
          />
        </FormSection>

        <FormSection title={t('grades.questionMax')} description={t('grades.bloomLevel')}>
          {form.questions.map((q, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <Text className="w-10 text-sm font-semibold">{t('grades.questionN', { n: i + 1 })}</Text>
              <Input className="w-20 text-center" keyboardType="decimal-pad" value={q.max} onChangeText={(v) => setQ(i, { max: v })} />
              <View className="flex-1">
                <Picker value={q.level ?? NONE} onChange={(v) => setQ(i, { level: v === NONE ? null : (v as JgBloomLevel) })} options={levelOptions} />
              </View>
            </View>
          ))}
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" disabled={n >= 20} onPress={() => setForm({ ...form, questions: [...form.questions, { max: '1', level: null }] })}>
              <Text>{t('grades.addQuestion')}</Text>
            </Button>
            <Button variant="outline" className="flex-1" disabled={n <= 1} onPress={() => setForm({ ...form, questions: form.questions.slice(0, -1) })}>
              <Text>{t('grades.removeQuestion')}</Text>
            </Button>
          </View>
        </FormSection>

        {students.map((s, i) => {
          const k = counted.findIndex((c) => c.id === s.id);
          const res = k >= 0 ? a.students[k] : null;
          return (
            <FormSection key={s.id} title={`${i + 1}. ${s.name}`} description={res ? `${fmtMark(res.total)}/${fmtMark(a.maxTotal)} · ${fmtPct(res.pct)} · ${t('grades.rank')} ${res.rank}` : undefined}>
              <View className="flex-row flex-wrap gap-2">
                {form.questions.map((q, j) => {
                  const v = form.scores[s.id]?.[j] ?? '';
                  const bad = v !== '' && (!(Number(v) >= 0) || Number(v) > (Number(q.max) || 0));
                  return (
                    <View key={j} className="w-14 items-center gap-0.5">
                      <Text variant="muted" className="text-[10px]">{t('grades.questionN', { n: j + 1 })}</Text>
                      <Input className={cn('h-10 w-14 px-1 text-center', bad && 'border-destructive')} keyboardType="decimal-pad" value={v} onChangeText={(x) => setScore(s.id, j, x)} />
                    </View>
                  );
                })}
              </View>
            </FormSection>
          );
        })}

        <StatTiles>
          <StatTile label={t('grades.alpha')} value={r2(a.alpha)} note={a.reliability ? JG_RELIABILITY_AR[a.reliability] : undefined} tone={a.reliability === 'weak' ? 'destructive' : 'brand'} />
          <StatTile label={t('grades.sem')} value={r2(a.sem)} note={`${t('grades.stdev')} ${r2(a.sd)}`} />
        </StatTiles>
        <StatTiles>
          <StatTile label={t('grades.meanTotal')} value={a.meanTotal === null ? '—' : String(Math.round(a.meanTotal * 10) / 10)} note={`${t('grades.studentsCount')} ${a.count}`} />
          <StatTile label={t('grades.toReview')} value={String(a.toReview)} tone={a.toReview ? 'warning' : 'success'} />
        </StatTiles>
        <Panel>
          {a.items.map((it, i) => (
            <View key={i} className={i < a.items.length - 1 ? 'border-info-soft dark:border-border flex-row items-center gap-2 border-b px-4 py-2.5' : 'flex-row items-center gap-2 px-4 py-2.5'}>
              <Text className="w-10 text-sm font-semibold">{t('grades.questionN', { n: i + 1 })}</Text>
              <Text variant="muted" className="flex-1 text-[11px]">{`p ${r2(it.p)} · D ${r2(it.d)}`}</Text>
              {it.verdict ? (
                <StatusChip
                  label={JG_ITEM_VERDICTS_AR[it.verdict]}
                  tone={it.verdict === 'reversed' || it.verdict === 'weak' ? 'destructive' : it.verdict === 'too_easy' || it.verdict === 'too_hard' ? 'warning' : 'success'}
                />
              ) : null}
            </View>
          ))}
        </Panel>
        <FormSection title={t('grades.bloomMastery')}>
          {a.bloom.map((b) => (
            <View key={b.level} className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-sm">{`${b.level} (${b.questions})`}</Text>
                <Text className="text-sm">{b.mastery === null ? '—' : fmtPct(b.mastery)}</Text>
              </View>
              <ShareBar value={b.mastery} />
            </View>
          ))}
        </FormSection>
        <Text variant="muted" className="text-xs">{t('grades.itemHelp')}</Text>
      </ScrollView>
      <StickyActions>
        <Button variant="outline" size="icon" onPress={() => setForm(null)} accessibilityLabel={t('grades.back')}>
          <Text>×</Text>
        </Button>
        {formId ? (
          <Button variant="outline" size="icon" accessibilityLabel={t('grades.printPdf')}
            onPress={() => shareApiFile(jgPdfPath.test(sectionId, formId ?? '', campusId), 'test-analysis.pdf', 'application/pdf').catch((e) => toast.error(e instanceof Error ? e.message : ''))}>
            <Icon as={Printer} className="text-foreground size-4" />
          </Button>
        ) : null}
        {formId ? (
          <Button variant="outline" size="icon" onPress={remove} accessibilityLabel={t('grades.remove')}>
            <Icon as={Trash2} className="text-destructive size-4" />
          </Button>
        ) : null}
        <Button className="flex-1" disabled={saving || !form.name.trim()} onPress={save}>
          <Text>{saving ? t('grades.saving') : t('grades.save')}</Text>
        </Button>
      </StickyActions>
    </>
  );
}
