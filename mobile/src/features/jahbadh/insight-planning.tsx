import { jgInsightPdfPath, jgWhatIfPdfPath, type JgWhatIfResult, type JgWhatIfSaved } from '@studently/api-client';
import { fmtPct, type JgExpected, type JgWhatIfScenario } from '@studently/shared-utils';
import { ChevronDown, ChevronUp, Play, Save, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FormSection, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { InsightScreen, jahbadhInsight, Loading, needTone, own, shareClass, useNeedText, useOverview, useShare } from '@/features/jahbadh/insight-shared';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const EXPECTED_TONE: Record<JgExpected, ChipTone> = {
  expected_pass: 'success', promoted: 'success', risk_round2: 'warning', needs_support: 'warning', risk_fail: 'destructive', no_data: 'muted',
};
const rowCls = (i: number, n: number) => cn('gap-1 px-4 py-3', i < n - 1 && 'border-info-soft dark:border-border border-b');

/** «التوقع المبكر / كم أحتاج؟» (web: /admin/jahbadh-grades/prediction). */
export function PredictionScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insPrediction')} onPrint={(s, c) => share(jgInsightPdfPath.prediction(s, undefined, c), 'prediction.pdf')}>
      {(sectionId, _c, cid) => <PredictionBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function PredictionBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const { share } = useShare();
  const needText = useNeedText();
  const res = useApi(['jg', 'prediction', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.prediction(s, null, own(c)));
  const [open, setOpen] = useState<string | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  return (
    <>
      <FormSection title={t('grades.insHowMuchNeed')}>
        <Picker value={student} onChange={setStudent} placeholder={t('grades.insChooseStudent')} options={d.rows.map((r) => ({ value: r.student_id, label: r.name }))} />
        <Button variant="outline" disabled={!student} onPress={() => student && share(jgInsightPdfPath.prediction(sectionId, student, own(cid)), 'calculator.pdf')}>
          <Text>{t('grades.insCalculatorPdf')}</Text>
        </Button>
      </FormSection>
      <Text variant="muted" className="text-xs">{t('grades.insPredictionNote')}</Text>
      <Panel>
        {d.rows.map((r, i) => {
          const isOpen = open === r.student_id;
          return (
            <View key={r.student_id}>
              <Pressable onPress={() => setOpen(isOpen ? null : r.student_id)} className={cn(rowCls(i, d.rows.length), 'active:opacity-70')} accessibilityRole="button">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{r.name}</Text>
                  <StatusChip label={r.expected_label} tone={EXPECTED_TONE[r.expected]} />
                  <Icon as={isOpen ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
                </View>
                <Text variant="muted" className="text-xs">{`${t('grades.insCurrent')} ${fmtPct(r.current, 1) || '—'} · ${t('grades.insProjected')} ${fmtPct(r.projected, 1) || '—'}${r.band ? ` · ${r.band}` : ''}`}</Text>
                {r.at_risk.length ? <Text className="text-warning text-xs">{`${t('grades.insAtRisk')}: ${r.at_risk.join('، ')}`}</Text> : null}
              </Pressable>
              {isOpen ? (
                <View className="bg-muted/30 gap-2 px-4 pb-3">
                  {r.next_target ? <Text className="text-sm font-semibold">{r.next_target}</Text> : null}
                  {r.subjects.map((s) => (
                    <View key={s.subject_id} className="gap-1">
                      <Text className="text-sm font-medium">{`${s.name}${s.at_risk ? ' ⚠' : ''} — ${s.recorded}/${s.of}${s.pct !== null ? ` (${fmtPct(s.pct, 0)})` : ''}`}</Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        <StatusChip label={`${t('grades.insToPass')}: ${needText(s.to_pass)}`} tone={needTone(s.to_pass)} />
                        <StatusChip label={`${t('grades.insToVeryGood')}: ${needText(s.to_very_good)}`} tone={needTone(s.to_very_good)} />
                        <StatusChip label={`${t('grades.insToExcellent')}: ${needText(s.to_excellent)}`} tone={needTone(s.to_excellent)} />
                        {s.exam_to_pass ? <StatusChip label={`${t('grades.insExamToPass')}: ${needText(s.exam_to_pass)}`} tone={needTone(s.exam_to_pass)} /> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Panel>
    </>
  );
}

/** «الطلاب على الحافة» (web: /admin/jahbadh-grades/edge-students). */
export function EdgeStudentsScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insEdge')} onPrint={(s, c) => share(jgInsightPdfPath.edge(s, c), 'edge-students.pdf')}>
      {(sectionId, _c, cid) => <EdgeBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function EdgeBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const [margin, setMargin] = useState('');
  const [need, setNeed] = useState('');
  const [applied, setApplied] = useState<{ margin: number; need: number } | null>(null);
  const res = useApi(['jg', 'edge', sectionId, cid, applied?.margin ?? 0, applied?.need ?? 0] as const, ([, , s, c, m, n]) =>
    jahbadhInsight.edgeStudents(s, { margin: m || undefined, need: n || undefined }, own(c)),
  );
  const d = res.data;
  return (
    <>
      <FormSection title={t('grades.insEdge')}>
        <Label>{t('grades.insEdgeMargin')}</Label>
        <Input value={margin} onChangeText={setMargin} keyboardType="decimal-pad" placeholder={String(d?.margin ?? 10)} />
        <Label>{t('grades.insEdgeNeedMax')}</Label>
        <Input value={need} onChangeText={setNeed} keyboardType="decimal-pad" placeholder={String(d?.need_max ?? 5)} />
        <Button variant="outline" onPress={() => setApplied({ margin: Number(margin) || 0, need: Number(need) || 0 })}><Text>{t('grades.insApply')}</Text></Button>
      </FormSection>
      {!d ? <Loading error={res.error} /> : !d.rows.length ? <EmptyState title={t('grades.insNothingToShow')} /> : (
        <Panel>
          {d.rows.map((r, i) => (
            <View key={`${r.student_id}-${r.subject_id}`} className={rowCls(i, d.rows.length)}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`${r.name} — ${r.subject}`}</Text>
                <StatusChip label={`${r.gap > 0 ? '+' : ''}${r.gap}`} tone={r.status === 'below' ? 'destructive' : 'success'} />
              </View>
              <Text variant="muted" className="text-xs">{`${t('grades.insPct')} ${fmtPct(r.pct, 1)}${r.needed > 0 ? ` · ${t('grades.insNeeded')} ${r.needed}/${r.remaining}` : ''}`}</Text>
              <Text className="text-xs">{r.intervention}</Text>
            </View>
          ))}
        </Panel>
      )}
    </>
  );
}

/** «مؤشر تضخم الأعمال» (web: /admin/jahbadh-grades/inflation). */
export function InflationScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insInflation')} onPrint={(s, c) => share(jgInsightPdfPath.inflation(s, c), 'inflation.pdf')}>
      {(sectionId, _c, cid) => <InflationBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

const verdictTone = (label: string): ChipTone => (label.startsWith('⚠') ? 'destructive' : label.startsWith('✔') ? 'success' : 'warning');
const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}`;

function InflationBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const [gapInput, setGapInput] = useState('');
  const [gap, setGap] = useState(0);
  const res = useApi(['jg', 'inflation', sectionId, cid, gap] as const, ([, , s, c, g]) => jahbadhInsight.inflation(s, g || undefined, own(c)));
  const d = res.data;
  return (
    <>
      <FormSection title={t('grades.insInflationGap')}>
        <Input value={gapInput} onChangeText={setGapInput} keyboardType="decimal-pad" placeholder={d ? String(Math.round(d.threshold * 100)) : '30'} />
        <Button variant="outline" onPress={() => setGap(gapInput ? Number(gapInput) / 100 : 0)}><Text>{t('grades.insApply')}</Text></Button>
      </FormSection>
      {!d ? <Loading error={res.error} /> : (
        <>
          <Panel>
            {d.subjects.map((s, i) => (
              <View key={s.subject_id} className={rowCls(i, d.subjects.length)}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{s.name}</Text>
                  <StatusChip label={s.verdict_label} tone={verdictTone(s.verdict_label)} />
                </View>
                <Text variant="muted" className="text-xs">
                  {`${t('grades.insWorks')} ${fmtPct(s.works, 0) || '—'} · ${t('grades.insExam')} ${fmtPct(s.exam, 0) || '—'} · ${t('grades.insGap')} ${s.gap === null ? '—' : signed(s.gap)} · ${t('grades.insOverThreshold')} ${s.over_threshold}${s.teacher ? ` · ${s.teacher}` : ''}`}
                </Text>
              </View>
            ))}
          </Panel>
          {d.by_teacher.length ? (
            <FormSection title={t('grades.insByTeacher')}>
              {d.by_teacher.map((x) => (
                <View key={x.teacher} className="gap-0.5">
                  <Text className="text-sm font-semibold">{`${x.teacher} · ${t('grades.insMeanGap')} ${signed(x.mean_gap)}`}</Text>
                  <Text variant="muted" className="text-xs">{x.subjects.join('، ')}</Text>
                </View>
              ))}
            </FormSection>
          ) : null}
          {d.top_gaps.length ? (
            <FormSection title={t('grades.insTopGaps')}>
              {d.top_gaps.map((x) => (
                <Text key={`${x.student_id}-${x.subject}`} className="text-sm">{`${x.name} — ${x.subject}: ${fmtPct(x.works, 0)} / ${fmtPct(x.exam, 0)} (+${Math.round(x.gap * 100)})`}</Text>
              ))}
            </FormSection>
          ) : null}
          <Text variant="muted" className="text-xs">{d.note}</Text>
        </>
      )}
    </>
  );
}

/** «الملاحظات التلقائية» (web: /admin/jahbadh-grades/auto-comments). */
export function AutoCommentsScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<string | null>(null);
  return (
    <InsightScreen title={t('grades.insAutoComments')}>
      {(sectionId, _c, cid) => <AutoCommentsBody sectionId={sectionId} cid={cid} stage={stage} setStage={setStage} />}
    </InsightScreen>
  );
}

function AutoCommentsBody({ sectionId, cid, stage, setStage }: { sectionId: string; cid: string; stage: string | null; setStage: (s: string) => void }) {
  const { t } = useTranslation();
  const { share } = useShare();
  const { stages } = useOverview(sectionId, cid);
  const chosen = stage ?? stages[0]?.value ?? null;
  const res = useApi(chosen ? (['jg', 'auto-comments', sectionId, cid, chosen] as const) : null, ([, , s, c, st]) => jahbadhInsight.autoComments(s, Number(st), own(c)));
  const d = res.data;
  return (
    <>
      <Picker value={chosen} onChange={setStage} placeholder={t('grades.stageView')} options={stages} />
      <Button variant="outline" disabled={!chosen} onPress={() => chosen && share(jgInsightPdfPath.autoComments(sectionId, Number(chosen), own(cid)), 'auto-comments.pdf')}>
        <Text>{t('grades.printPdf')}</Text>
      </Button>
      {!chosen ? null : !d ? <Loading error={res.error} /> : (
        <Panel>
          {d.rows.map((r, i) => (
            <View key={r.student_id} className={rowCls(i, d.rows.length)}>
              <Text className="text-sm font-semibold">{`${r.name}${r.pct !== null ? ` · ${fmtPct(r.pct, 0)}` : ''}`}</Text>
              <Text className="text-sm">{r.text}</Text>
              <Text variant="muted" className="text-xs">{r.short}</Text>
            </View>
          ))}
        </Panel>
      )}
    </>
  );
}

/** «خريطة البنود» (web: /admin/jahbadh-grades/weak-items). */
export function WeakItemsScreen() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  return (
    <InsightScreen title={t('grades.insWeakItems')}>
      {(sectionId, _c, cid) => <WeakItemsBody sectionId={sectionId} cid={cid} subject={subject} setSubject={setSubject} stage={stage} setStage={setStage} />}
    </InsightScreen>
  );
}

function WeakItemsBody({ sectionId, cid, subject, setSubject, stage, setStage }: { sectionId: string; cid: string; subject: string | null; setSubject: (s: string) => void; stage: string | null; setStage: (s: string) => void }) {
  const { t } = useTranslation();
  const { share } = useShare();
  const { stages, subjects } = useOverview(sectionId, cid);
  const sub = subject ?? subjects[0]?.id ?? null;
  const st = stage ?? stages[0]?.value ?? null;
  const res = useApi(sub && st ? (['jg', 'weak-items', sectionId, cid, sub, st] as const) : null, ([, , s, c, su, sg]) => jahbadhInsight.weakItems(s, su, Number(sg), own(c)));
  const d = res.data;
  return (
    <>
      <Picker value={sub} onChange={setSubject} placeholder={t('grades.subject')} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
      <Picker value={st} onChange={setStage} placeholder={t('grades.stageView')} options={stages} />
      <Button variant="outline" disabled={!sub || !st} onPress={() => sub && st && share(jgInsightPdfPath.weakItems(sectionId, sub, Number(st), own(cid)), 'weak-items.pdf')}>
        <Text>{t('grades.printPdf')}</Text>
      </Button>
      {!sub || !st ? null : !d ? <Loading error={res.error} /> : !d.has_subitems ? <EmptyState title={t('grades.insNoSubitems')} /> : (
        <>
          {d.weakest.map((w) => (
            <Panel key={w.id} className="gap-1 p-4">
              <Text className="text-sm font-semibold">{w.name}</Text>
              <Text variant="muted" className="text-xs">{`${t('grades.insAverage')} ${fmtPct(w.avg, 0) || '—'} · ${t('grades.insBelowHalf')} ${fmtPct(w.below_share, 0) || '—'}`}</Text>
              <StatusChip label={w.plan_label} tone={w.plan === 'whole_class' ? 'destructive' : w.plan === 'small_group' ? 'warning' : 'muted'} className="self-start" />
              {w.below_names.length ? <Text variant="muted" className="text-xs">{w.below_names.slice(0, 8).join('، ')}</Text> : null}
            </Panel>
          ))}
          <Panel className="gap-1 p-4">
            {d.grid.map((g) => (
              <View key={g.student_id} className="gap-1 py-1">
                <Text className="text-sm font-medium" numberOfLines={1}>{g.name}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {g.cells.map((v, k) => (
                    <View key={d.items[k].id} className={cn('min-w-12 items-center rounded-md px-1.5 py-0.5', shareClass(v))}>
                      <Text className="text-2xs" numberOfLines={1}>{d.items[k].name}</Text>
                      <Text className="text-xs font-semibold">{v === null ? '—' : fmtPct(v, 0)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}

/** «محاكي ماذا لو» (web: /admin/jahbadh-grades/what-if): admin only, never writes grades. */
export function WhatIfScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [scenario, setScenario] = useState<JgWhatIfScenario>({});
  return (
    <InsightScreen title={t('grades.insWhatIf')} adminOnly onPrint={(s, c) => share(jgWhatIfPdfPath(s, c), 'what-if.pdf', { method: 'POST', body: scenario })}>
      {(sectionId, _c, cid) => <WhatIfBody sectionId={sectionId} cid={cid} onScenario={setScenario} />}
    </InsightScreen>
  );
}

function WhatIfBody({ sectionId, cid, onScenario }: { sectionId: string; cid: string; onScenario: (s: JgWhatIfScenario) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { subjects } = useOverview(sectionId, cid);
  const saved = useApi(['jg', 'whatif-saved', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.whatIfScenarios(s, own(c)));
  const [totalMin, setTotalMin] = useState('');
  const [examMin, setExamMin] = useState('');
  const [addMarks, setAddMarks] = useState('');
  const [addSubject, setAddSubject] = useState('all');
  const [jabr, setJabr] = useState<'default' | 'on' | 'off'>('default');
  const [name, setName] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [result, setResult] = useState<JgWhatIfResult | null>(null);
  const [busy, setBusy] = useState(false);

  const build = (): JgWhatIfScenario => ({
    totalMin: totalMin ? Number(totalMin) / 100 : undefined,
    examMin: examMin ? Number(examMin) / 100 : undefined,
    addMarks: addMarks ? Number(addMarks) : undefined,
    addSubject: addMarks ? addSubject : undefined,
    jabrPlusOne: jabr === 'default' ? undefined : jabr === 'on',
  });
  const run = async () => {
    const sc = build();
    onScenario(sc);
    setBusy(true);
    const res = await jahbadhInsight.whatIf(sectionId, sc, own(cid));
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    setResult(res.data ?? null);
  };
  const load = (s: JgWhatIfSaved) => {
    setLoadedId(s.id);
    setName(s.name);
    setTotalMin(s.params.totalMin !== undefined ? String(Math.round(s.params.totalMin * 100)) : '');
    setExamMin(s.params.examMin !== undefined ? String(Math.round(s.params.examMin * 100)) : '');
    setAddMarks(s.params.addMarks ? String(s.params.addMarks) : '');
    setAddSubject(s.params.addSubject ?? 'all');
    setJabr(s.params.jabrPlusOne === undefined ? 'default' : s.params.jabrPlusOne ? 'on' : 'off');
  };
  const save = async (asNew: boolean) => {
    if (!name.trim()) return toast.error(t('grades.insScenarioName'));
    const body = { name: name.trim(), params: build() };
    const res = !asNew && loadedId ? await jahbadhInsight.updateWhatIfScenario(sectionId, loadedId, body, own(cid)) : await jahbadhInsight.createWhatIfScenario(sectionId, body, own(cid));
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    saved.mutate(res.data, { revalidate: false });
  };
  const remove = async (id: string) => {
    const res = await jahbadhInsight.deleteWhatIfScenario(sectionId, id, own(cid));
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    saved.mutate(res.data, { revalidate: false });
    if (loadedId === id) setLoadedId(null);
  };

  return (
    <>
      <View className="bg-warning-soft rounded-2xl p-3">
        <Text className="text-warning text-sm">{t('grades.insWhatIfNeverWrites')}</Text>
      </View>
      <FormSection title={t('grades.insScenario')}>
        <Label>{t('grades.insTotalMin')}</Label>
        <Input value={totalMin} onChangeText={setTotalMin} keyboardType="decimal-pad" placeholder={result ? String(Math.round(result.current.totalMin * 100)) : ''} />
        <Label>{t('grades.insExamMin')}</Label>
        <Input value={examMin} onChangeText={setExamMin} keyboardType="decimal-pad" placeholder={result ? String(Math.round(result.current.examMin * 100)) : ''} />
        <Label>{t('grades.insAddMarks')}</Label>
        <Input value={addMarks} onChangeText={setAddMarks} keyboardType="decimal-pad" />
        <Label>{t('grades.insAddSubject')}</Label>
        <Picker value={addSubject} onChange={setAddSubject} options={[{ value: 'all', label: t('grades.insAllSubjects') }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]} />
        <Label>{t('grades.insJabrPlusOne')}</Label>
        <Picker
          value={jabr}
          onChange={(v) => setJabr(v as 'default' | 'on' | 'off')}
          options={[{ value: 'default', label: t('grades.insAsSettings') }, { value: 'on', label: t('grades.insOn') }, { value: 'off', label: t('grades.insOff') }]}
        />
        <Button onPress={run} disabled={busy}>
          <Icon as={Play} className="text-primary-foreground size-4" />
          <Text>{t('grades.insRun')}</Text>
        </Button>
      </FormSection>
      <FormSection title={t('grades.insSavedScenarios')}>
        <Input value={name} onChangeText={setName} placeholder={t('grades.insScenarioName')} />
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" onPress={() => save(true)}>
            <Icon as={Save} className="text-foreground size-4" />
            <Text>{t('grades.insSaveNew')}</Text>
          </Button>
          {loadedId ? <Button variant="outline" size="sm" onPress={() => save(false)}><Text>{t('grades.insUpdate')}</Text></Button> : null}
        </View>
        {(saved.data ?? []).map((s) => (
          <View key={s.id} className={cn('flex-row items-center justify-between gap-2 rounded-xl border p-2', loadedId === s.id ? 'border-brand' : 'border-border')}>
            <Pressable className="flex-1" onPress={() => load(s)} accessibilityRole="button"><Text className="text-sm font-medium">{s.name}</Text></Pressable>
            <Pressable onPress={() => remove(s.id)} accessibilityRole="button" accessibilityLabel={t('grades.insDelete')} hitSlop={8}>
              <Icon as={Trash2} className="text-destructive size-4" />
            </Pressable>
          </View>
        ))}
      </FormSection>
      {result ? (
        <>
          <StatTiles>
            <StatTile label={t('grades.insConsidered')} value={String(result.considered)} />
            <StatTile label={t('grades.passed')} value={`${result.now.pass} → ${result.after.pass}`} tone="success" />
          </StatTiles>
          <StatTiles>
            <StatTile label={t('grades.round2')} value={`${result.now.round2} → ${result.after.round2}`} tone="warning" />
            <StatTile label={t('grades.failed')} value={`${result.now.fail} → ${result.after.fail}`} tone="destructive" />
          </StatTiles>
          <FormSection title={`${t('grades.insChangedStudents')} (${result.changed.length})`}>
            {result.changed.length ? result.changed.map((c) => (
              <View key={c.student_id} className="gap-0.5">
                <Text className="text-sm font-semibold">{c.name}</Text>
                <Text variant="muted" className="text-xs">{`${c.before} → ${c.after} · ${c.failing_before} → ${c.failing_after}`}</Text>
              </View>
            )) : <Text variant="muted" className="text-sm">{t('grades.insNoChange')}</Text>}
          </FormSection>
        </>
      ) : null}
    </>
  );
}

/** «خطة الدعم الفردية» (web: /admin/jahbadh-grades/support-plans). */
export function SupportPlansScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insSupportPlans')} onPrint={(s, c) => share(jgInsightPdfPath.supportPlans(s, undefined, c), 'support-plans.pdf')}>
      {(sectionId, _c, cid) => <SupportPlansBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function SupportPlansBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { share } = useShare();
  const needText = useNeedText();
  const [weeksInput, setWeeksInput] = useState('');
  const [weeks, setWeeks] = useState(0);
  const res = useApi(['jg', 'support-plans', sectionId, cid, weeks] as const, ([, , s, c, w]) => jahbadhInsight.supportPlans(s, { weeks: w || undefined }, own(c)));
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { school: string; home: string }>>({});
  const d = res.data;
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const save = async (id: string, school: string, home: string) => {
    const r = await jahbadhInsight.saveSupportPlan(sectionId, id, { weeks: d?.weeks, school_actions: lines(school), home_actions: lines(home) }, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    res.mutate(r.data, { revalidate: false });
    setDrafts((x) => {
      const n = { ...x };
      delete n[id];
      return n;
    });
  };
  return (
    <>
      <FormSection title={t('grades.insPlanWeeks')}>
        <Input value={weeksInput} onChangeText={setWeeksInput} keyboardType="number-pad" placeholder={String(d?.weeks ?? 8)} />
        <Button variant="outline" onPress={() => setWeeks(Number(weeksInput) || 0)}><Text>{t('grades.insApply')}</Text></Button>
      </FormSection>
      {!d ? <Loading error={res.error} /> : !d.plans.length ? <EmptyState title={t('grades.insNothingToShow')} /> : d.plans.map((p) => {
        const isOpen = open === p.student_id;
        const dr = drafts[p.student_id] ?? { school: p.school_actions.join('\n'), home: p.home_actions.join('\n') };
        return (
          <Panel key={p.student_id}>
            <Pressable onPress={() => setOpen(isOpen ? null : p.student_id)} className="flex-row items-center justify-between gap-2 p-4 active:opacity-70" accessibilityRole="button">
              <View className="flex-1">
                <Text className="text-sm font-semibold">{p.name}</Text>
                <Text variant="muted" className="text-xs">{`${fmtPct(p.current, 0) || '—'} → ${fmtPct(p.projected, 0) || '—'}${p.projected_band ? ` · ${p.projected_band}` : ''}`}</Text>
              </View>
              <Icon as={isOpen ? ChevronUp : ChevronDown} className="text-muted-foreground size-4" />
            </Pressable>
            {isOpen ? (
              <View className="gap-3 px-4 pb-4">
                {p.subjects.map((s) => (
                  <View key={s.subject_id} className="gap-1">
                    <Text className="text-sm font-medium">{`${s.name} · ${fmtPct(s.pct, 0) || '—'}`}</Text>
                    <StatusChip label={`${t('grades.insToPass')}: ${needText(s.to_pass)}`} tone={needTone(s.to_pass)} className="self-start" />
                    {s.weakest ? <Text variant="muted" className="text-xs">{`${t('grades.insWeakest')}: ${s.weakest.name} (${fmtPct(s.weakest.pct, 0)})`}</Text> : null}
                    <Text className="text-xs">{s.weekly_goal}</Text>
                  </View>
                ))}
                <Label>{t('grades.insSchoolActions')}</Label>
                <Textarea value={dr.school} onChangeText={(v) => setDrafts((x) => ({ ...x, [p.student_id]: { ...dr, school: v } }))} />
                <Label>{t('grades.insHomeActions')}</Label>
                <Textarea value={dr.home} onChangeText={(v) => setDrafts((x) => ({ ...x, [p.student_id]: { ...dr, home: v } }))} />
                <Button onPress={() => save(p.student_id, dr.school, dr.home)}>
                  <Icon as={Save} className="text-primary-foreground size-4" />
                  <Text>{t('grades.save')}</Text>
                </Button>
                <Button variant="outline" onPress={() => share(jgInsightPdfPath.supportPlans(sectionId, p.student_id, own(cid)), 'support-plan.pdf')}>
                  <Text>{t('grades.insStudentPlanPdf')}</Text>
                </Button>
              </View>
            ) : null}
          </Panel>
        );
      })}
    </>
  );
}

/** «أثر الغياب» (web: /admin/jahbadh-grades/absence-impact). */
export function AbsenceImpactScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insAbsenceImpact')} onPrint={(s, c) => share(jgInsightPdfPath.absenceImpact(s, c), 'absence-impact.pdf')}>
      {(sectionId, _c, cid) => <AbsenceBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function AbsenceBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'absence', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.absenceImpact(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.insCorrelation')} value={d.r === null ? '—' : d.r.toFixed(2)} />
        <StatTile label={t('grades.insSlope')} value={d.slope_points_per_day === null ? '—' : d.slope_points_per_day.toFixed(2)} tone="warning" />
        <StatTile label={t('grades.insStudentsCount')} value={String(d.rows.length)} />
      </StatTiles>
      <FormSection title={t('grades.insAbsenceBands')}>
        {d.bands.map((b) => (
          <View key={b.label} className="flex-row items-center justify-between">
            <Text className="text-sm">{`${b.label} · ${b.count}`}</Text>
            <Text className="text-sm font-semibold">{b.avg === null ? '—' : fmtPct(b.avg, 0)}</Text>
          </View>
        ))}
      </FormSection>
      <Panel className="gap-2 p-4">
        <Text className="text-sm">{d.parent_message}</Text>
        <Text variant="muted" className="text-xs">{d.note}</Text>
      </Panel>
      <Panel>
        {d.rows.map((r, i) => (
          <View key={r.student_id} className={cn('flex-row items-center justify-between gap-2 px-4 py-2.5', i < d.rows.length - 1 && 'border-info-soft dark:border-border border-b')}>
            <Text className="flex-1 text-sm" numberOfLines={1}>{r.name}</Text>
            <Text variant="muted" className="text-xs">{`${t('grades.insAbsenceDays')} ${r.days} · ${t('grades.insUnexcused')} ${r.unexcused} · ${fmtPct(r.pct, 0)}`}</Text>
          </View>
        ))}
      </Panel>
    </>
  );
}
