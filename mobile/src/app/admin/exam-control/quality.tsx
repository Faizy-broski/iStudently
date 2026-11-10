import type { JcGate, JcOverview } from '@studently/api-client';
import { Stack } from 'expo-router';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { FilterChips } from '@/components/app/filter-chips';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { locale } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { ShareBar } from '@/features/jahbadh/shared';
import { ScanField, useScanError } from '@/features/exam-control/scan';
import { JcError, MiniTile, Note, pct, useOverview, usePrintDoc, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Pane = 'gate' | 'mismatches' | 'report' | 'comparison' | 'sample' | 'appeals' | 'graders' | 'stubs';
const NONE = '__none__';

/** Quality and unmasking (web: exam control › Quality & unmasking). */
export default function ExamControlQuality() {
  const { t } = useTranslation();
  const id = useSessionId();
  const ov = useOverview(id);
  const o = ov.data;
  const [pane, setPane] = useState<Pane>('gate');
  if (ov.error) return <JcError error={ov.error} />;
  if (!o || !id) return <LoadingList />;
  const panes: { value: Pane; label: string }[] = [
    { value: 'gate', label: t('examControl.gate') },
    { value: 'mismatches', label: t('examControl.mismatches') },
    { value: 'report', label: t('examControl.qualityReport') },
    { value: 'comparison', label: t('examControl.comparison') },
    { value: 'sample', label: t('examControl.auditSample') },
    { value: 'appeals', label: t('examControl.appeals') },
    ...(o.rights.manage ? [{ value: 'graders' as Pane, label: t('examControl.graders') }] : []),
    ...(o.rights.secret ? [{ value: 'stubs' as Pane, label: t('examControl.stubCheck') }] : []),
  ];
  const props = { id, o, refresh: () => void ov.mutate() };
  return (
    <>
      <Stack.Screen options={{ title: t('examControl.tab_quality') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <FilterChips value={pane} onChange={setPane} options={panes} />
        {pane === 'gate' ? <Gate {...props} /> : pane === 'mismatches' ? <Mismatches {...props} /> : pane === 'report' ? <Report {...props} /> : pane === 'comparison' ? <Comparison {...props} /> : pane === 'sample' ? <Sample {...props} /> : pane === 'appeals' ? <Appeals {...props} /> : pane === 'graders' ? <Graders {...props} /> : <StubCheck {...props} />}
      </ScrollView>
    </>
  );
}

type P = { id: string; o: JcOverview; refresh: () => void };

function Gate({ id, o, refresh }: P) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const gate = useApi(['jc', 'gate', id] as const, ([, , s]) => jahbadhControl.gate(s));
  const after = (res: { ok: boolean; data?: unknown }) => {
    if (res.ok) {
      gate.mutate();
      refresh();
    }
  };
  const update = useAction(jahbadhControl.updateSession);
  const approve = useAction(jahbadhControl.approveUnmask);
  const unmask = useAction(jahbadhControl.unmask);
  const revoke = useAction(jahbadhControl.revokeUnmask);
  const g: JcGate | undefined = gate.data;
  if (!g) return <LoadingList rows={3} />;
  const conds = [
    { key: 'all_entered' as const, detail: t('examControl.enteredOf', { entered: g.input.entered, expected: g.input.expected }) },
    { key: 'double_entry_match' as const, detail: g.input.doubleEntry ? t('examControl.mismatchPending', { mismatches: g.input.mismatches, pending: g.input.pendingSecond }) : t('examControl.doubleEntryOff') },
    { key: 'chief_approved' as const, detail: g.input.chiefApproved ? t('examControl.approved') : t('examControl.notApproved') },
    { key: 'show_names' as const, detail: g.input.showNames ? t('examControl.on') : t('examControl.off') },
  ];
  return (
    <FormSection title={t('examControl.gateTitle')} description={t('examControl.gateHint')}>
      {conds.map((c) => {
        const ok = !g.missing.includes(c.key);
        return (
          <View key={c.key} className="flex-row items-start gap-2">
            <Icon as={ok ? CheckCircle2 : Circle} className={ok ? 'text-success size-5' : 'text-warning size-5'} />
            <View className="flex-1">
              <Text className="text-sm font-medium">{t(`examControl.gate_${c.key}`)}</Text>
              <Text variant="muted" className="text-xs">
                {c.detail}
              </Text>
            </View>
          </View>
        );
      })}
      {o.rights.chief ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-sm">{t('examControl.set_show_names')}</Text>
            <Switch checked={o.session.settings.show_names} disabled={g.unmasked} onCheckedChange={async (v) => after(await update.run(id, { settings: { show_names: v } }))} />
          </View>
          {!g.input.chiefApproved ? (
            <Button variant="outline" onPress={async () => after(await approve.run(id))} disabled={approve.running}>
              <Text>{t('examControl.approveUnmask')}</Text>
            </Button>
          ) : null}
          {!g.unmasked ? (
            <Button disabled={!g.open || unmask.running} onPress={async () => (await confirm({ title: t('examControl.unmask'), body: t('examControl.confirmUnmask') })) && after(await unmask.run(id))}>
              <Text>{t('examControl.unmask')}</Text>
            </Button>
          ) : (
            <Button variant="destructive" disabled={revoke.running} onPress={async () => (await confirm({ title: t('examControl.revokeUnmask'), body: t('examControl.confirmRevoke'), destructive: true })) && after(await revoke.run(id))}>
              <Text>{t('examControl.revokeUnmask')}</Text>
            </Button>
          )}
        </View>
      ) : (
        <Note text={t('examControl.chiefOnlyGate')} />
      )}
      {g.events.map((e, i) => (
        <Text key={i} variant="muted" className="text-xs">{`${new Date(e.created_at).toLocaleString(locale)} — ${t(`examControl.event_${e.kind}`)}`}</Text>
      ))}
    </FormSection>
  );
}

/** Name of an entry column key: a subject (`math`) or one exam part (`math~2` → «الرياضيات — الجزء»). */
function useSubjectName(o: JcOverview) {
  return (k: string) => {
    const [key, part] = k.split('~');
    const s = o.grades.flatMap((g) => g.subjects).find((x) => x.key === key);
    if (!s) return k;
    if (!part) return s.name;
    return `${s.name} — ${s.parts?.find((p) => p.index === Number(part))?.name ?? part}`;
  };
}

/** Entry columns of the session's subjects, parts expanded (appeals on a subject with parts are per part). */
function columnsOf(o: JcOverview) {
  const seen = new Map<string, { key: string; name: string; max: number }>();
  for (const s of o.grades.flatMap((g) => g.subjects)) {
    if (s.parts?.length) for (const p of s.parts) seen.set(`${s.key}~${p.index}`, { key: `${s.key}~${p.index}`, name: `${s.name} — ${p.name}`, max: p.max });
    else seen.set(s.key, { key: s.key, name: s.name, max: s.max });
  }
  return [...seen.values()];
}

function Mismatches({ id, o }: P) {
  const { t } = useTranslation();
  const m = useApi(['jc', 'mismatches', id] as const, ([, , s]) => jahbadhControl.mismatches(s));
  const name = useSubjectName(o);
  if (!m.data) return <LoadingList rows={3} />;
  if (!m.data.double_entry) return <Note text={t('examControl.doubleEntryOff')} />;
  const d = m.data;
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <MiniTile label={t('examControl.agreed')} value={d.agreed} tone="success" />
        <MiniTile label={t('examControl.mismatches')} value={d.mismatches.length} tone={d.mismatches.length ? 'destructive' : 'muted'} />
        <MiniTile label={t('examControl.onlyFirst')} value={d.only_first.length} tone={d.only_first.length ? 'warning' : 'muted'} />
        <MiniTile label={t('examControl.onlySecond')} value={d.only_second.length} tone={d.only_second.length ? 'warning' : 'muted'} />
      </View>
      {d.mismatches.length ? (
        <FormSection title={t('examControl.mismatches')}>
          {d.mismatches.map((x, i) => (
            <Text key={i} className="text-sm">{`${x.secret} · ${name(x.subject_key)} · ${t('examControl.entry1')} ${x.first} / ${t('examControl.entry2')} ${x.second}`}</Text>
          ))}
        </FormSection>
      ) : (
        <Note tone="success" text={t('examControl.noMismatches')} />
      )}
      {d.only_first.length + d.only_second.length ? (
        <FormSection title={t('examControl.singleEntries')}>
          {d.only_first.map((x, i) => (
            <Text key={`a${i}`} className="text-xs">{`${x.secret} · ${name(x.subject_key)} · ${t('examControl.missingEntry2')}`}</Text>
          ))}
          {d.only_second.map((x, i) => (
            <Text key={`b${i}`} className="text-xs">{`${x.secret} · ${name(x.subject_key)} · ${t('examControl.missingEntry1')}`}</Text>
          ))}
        </FormSection>
      ) : null}
    </View>
  );
}

function Report({ id, o }: P) {
  const { t } = useTranslation();
  const q = useApi(['jc', 'quality', id] as const, ([, , s]) => jahbadhControl.quality(s));
  const [gradePick, setGrade] = useState<string | null>(null);
  const name = useSubjectName(o);
  const print = usePrintDoc(id);
  if (q.error) return <Note tone="destructive" text={q.error.message} />;
  if (!q.data) return <LoadingList rows={3} />;
  const g = q.data.grades.find((x) => x.grade_level_id === gradePick) ?? q.data.grades[0];
  if (!g) return <Note text={t('examControl.noGradesYet')} />;
  const school = q.data.school;
  return (
    <View className="gap-4">
      <Button variant="outline" onPress={() => print('quality_report')}>
        <Text>{t('examControl.doc_quality_report')}</Text>
      </Button>
      {school?.rows?.length ? (
        <FormSection title={t('examControl.schoolQualityTable')}>
          {[...school.rows, school.total].map((r, i) => (
            <View key={`${r.name}-${i}`} className={`gap-0.5 ${i === school.rows.length ? 'border-border border-t pt-2' : ''}`}>
              <Text className={`text-sm ${i === school.rows.length ? 'font-bold' : 'font-semibold'}`}>{r.name}</Text>
              <Text variant="muted" className="text-xs">
                {[
                  `${t('examControl.count_students')} ${r.students}`,
                  `${t('examControl.subjectsCount')} ${r.subjects}`,
                  `${t('examControl.completion')} ${pct(r.completion)}`,
                  `${t('examControl.average')} ${pct(r.average)}`,
                  `${t('examControl.passRate')} ${pct(r.pass_rate)}`,
                  `${t('examControl.topCount')} ${r.top}`,
                  `${t('examControl.supportCount')} ${r.support}`,
                ].join(' · ')}
              </Text>
            </View>
          ))}
        </FormSection>
      ) : null}
      <Picker value={g.grade_level_id} onChange={setGrade} options={q.data.grades.map((x) => ({ value: x.grade_level_id, label: x.name }))} />
      <View className="flex-row flex-wrap gap-2">
        <MiniTile label={t('examControl.count_students')} value={g.tiles.students} />
        <MiniTile label={t('examControl.completion')} value={pct(g.tiles.completion)} tone={g.tiles.completion === 1 ? 'success' : 'warning'} />
        <MiniTile label={t('examControl.average')} value={pct(g.tiles.average)} />
        <MiniTile label={t('examControl.topCount')} value={g.tiles.top} tone="success" />
        <MiniTile label={t('examControl.supportCount')} value={g.tiles.support} tone={g.tiles.support ? 'warning' : 'muted'} />
        <MiniTile label={t('examControl.entryErrors')} value={g.tiles.errors} tone={g.tiles.errors ? 'destructive' : 'muted'} />
      </View>
      {g.subjects.map((s) => (
        <View key={s.key} className="bg-card border-border gap-1.5 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-semibold">{s.name}</Text>
            {s.clustering.flagged ? <StatusChip label={t('examControl.clustering')} tone="destructive" /> : null}
            <Text className="text-sm font-semibold">{pct(s.meanPct)}</Text>
          </View>
          <ShareBar value={s.meanPct} />
          <Text variant="muted" className="text-xs">
            {[
              `${t('examControl.entered')} ${s.entered}${s.missing ? ` (−${s.missing})` : ''}`,
              `${t('examControl.passRate')} ${pct(s.passRate)}`,
              `${t('examControl.excellenceRate')} ${pct(s.excellenceRate)}`,
              `${t('examControl.weakRate')} ${pct(s.weakRate)}`,
            ].join(' · ')}
          </Text>
          <Text variant="muted" className="text-xs">
            {Object.entries(s.bands).map(([b, n]) => `${b} ${n}`).join(' · ')}
          </Text>
          {s.teachers.length ? <Text className="text-xs">{`${t('examControl.graders')}: ${s.teachers.join('، ')}`}</Text> : null}
          {s.clustering.flagged ? <Text className="text-destructive text-xs">{t('examControl.clusteringHint', { threshold: s.clustering.threshold, at: s.clustering.atThreshold, below: s.clustering.justBelow })}</Text> : null}
          {s.verdict ? <Text className="text-xs">{s.verdict}</Text> : null}
          {(s.parts ?? []).map((p) => (
            <View key={p.index} className="ms-3 gap-1">
              <Text className="text-xs">{`${p.name} /${p.max} · ${t('examControl.entered')} ${p.entered} · ${pct(p.meanPct)}`}</Text>
              <ShareBar value={p.meanPct} />
            </View>
          ))}
        </View>
      ))}
      <FormSection title={t('examControl.topTen')}>
        {g.top.length ? g.top.map((x, i) => <Text key={i} className="text-sm">{`${x.label} · ${pct(x.pct)}`}</Text>) : <Text variant="muted">—</Text>}
      </FormSection>
      <FormSection title={t('examControl.needsSupport')}>
        {g.support.length ? g.support.map((x, i) => <Text key={i} className="text-warning text-sm">{`${x.label} · ${pct(x.pct)}`}</Text>) : <Text variant="muted">—</Text>}
      </FormSection>
      {q.data.bias.length ? (
        <FormSection title={t('examControl.markerBias')} description={t('examControl.markerBiasHint')}>
          {q.data.bias.map((b, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <Text className="flex-1 text-sm">{`${b.grader} · ${name(b.subjectKey)} · ${b.deviation > 0 ? '+' : ''}${b.deviation}%`}</Text>
              <StatusChip label={t(`examControl.bias_${b.verdict}`)} tone={b.verdict === 'normal' ? 'muted' : 'warning'} />
            </View>
          ))}
        </FormSection>
      ) : null}
      {q.data.teacher_performance.length ? (
        <FormSection title={t('examControl.teacherPerformance')}>
          {q.data.teacher_performance.map((x) => (
            <View key={x.staff_id} className="gap-1">
              <Text className="text-sm">{`${x.name} · ${x.students} · ${pct(x.meanPct)}`}</Text>
              <ShareBar value={x.meanPct} />
            </View>
          ))}
        </FormSection>
      ) : null}
    </View>
  );
}

const delta = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1).replace(/\.0$/, '')}%`);
const deltaTone = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? 'text-muted-foreground' : v > 0 ? 'text-success' : 'text-destructive');

/** Comparison with a previous session or year (C6.7). Aggregates only, so it works before unmasking. */
function Comparison({ id }: P) {
  const { t } = useTranslation();
  const print = usePrintDoc(id);
  const sessions = useApi(['jc', 'sessions-all'] as const, () => jahbadhControl.sessions());
  const [withId, setWithId] = useState<string>(NONE);
  const cmp = useApi(['jc', 'comparison', id, withId] as const, ([, , s, w]) => jahbadhControl.comparison(s, w === NONE ? null : w));
  const others = (sessions.data ?? []).filter((x) => x.id !== id);
  const c = cmp.data;
  return (
    <View className="gap-3">
      <Picker
        value={withId}
        onChange={setWithId}
        options={[{ value: NONE, label: t('examControl.comparisonAuto') }, ...others.map((x) => ({ value: x.id, label: `${x.name} · ${x.issue_date}` }))]}
      />
      <Button variant="outline" onPress={() => print('comparison', { withSessionId: withId === NONE ? null : withId })}>
        <Text>{t('examControl.doc_comparison')}</Text>
      </Button>
      {cmp.error ? (
        <Note tone="destructive" text={cmp.error.message} />
      ) : !c ? (
        <LoadingList rows={3} />
      ) : !c.previous ? (
        <Note text={t('examControl.comparisonNone')} />
      ) : (
        <>
          <Note text={t('examControl.comparisonWith', { current: c.current.name, previous: c.previous.name })} />
          {c.school ? (
            <View className="flex-row flex-wrap gap-2">
              <MiniTile label={t('examControl.average')} value={pct(c.school.current.average)} />
              <MiniTile label={t('examControl.previousAverage')} value={pct(c.school.previous.average)} />
              <MiniTile label={t('examControl.passRate')} value={pct(c.school.current.pass_rate)} />
              <MiniTile label={t('examControl.change')} value={delta(c.school.delta.pass_rate)} tone={(c.school.delta.pass_rate ?? 0) >= 0 ? 'success' : 'destructive'} />
            </View>
          ) : null}
          {c.grades.map((g) => (
            <FormSection key={g.grade_level_id} title={g.name} description={`${t('examControl.average')} ${delta(g.delta?.average)} · ${t('examControl.passRate')} ${delta(g.delta?.pass_rate)}`}>
              {g.subjects.map((x) => (
                <View key={x.key} className="gap-0.5">
                  <Text className="text-sm font-medium">{x.name}</Text>
                  <View className="flex-row flex-wrap gap-x-3">
                    <Text variant="muted" className="text-xs">{`${t('examControl.average')} ${pct(x.current.mean_pct)} (${pct(x.previous?.mean_pct)})`}</Text>
                    <Text className={`text-xs ${deltaTone(x.delta?.mean_pct)}`}>{delta(x.delta?.mean_pct)}</Text>
                    <Text variant="muted" className="text-xs">{`${t('examControl.passRate')} ${pct(x.current.pass_rate)} (${pct(x.previous?.pass_rate)})`}</Text>
                    <Text className={`text-xs ${deltaTone(x.delta?.pass_rate)}`}>{delta(x.delta?.pass_rate)}</Text>
                  </View>
                </View>
              ))}
            </FormSection>
          ))}
        </>
      )}
    </View>
  );
}

function Sample({ id, o }: P) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const list = useApi(['jc', 'audit-sample', id] as const, ([, , s]) => jahbadhControl.auditSample(s));
  const draw = useAction(jahbadhControl.drawAuditSample, { success: t('examControl.drawn') });
  const review = useAction(jahbadhControl.reviewAuditSample);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const items = list.data ?? [];
  const done = items.filter((x) => x.reviewed).length;
  const errors = items.filter((x) => x.error_found).length;
  const doDraw = async () => {
    if (items.length && !(await confirm({ title: t('examControl.drawSample'), body: t('examControl.confirmRedraw') }))) return;
    const res = await draw.run(id);
    if (res.ok) list.mutate(res.data, { revalidate: false });
  };
  const doReview = async (secret: number, reviewed: boolean, errorFound?: boolean) => {
    const row = items.find((x) => x.secret === secret);
    if ((await review.run(id, { secret, reviewed, error_found: errorFound ?? row?.error_found ?? false, notes: notes[secret] })).ok) list.mutate();
  };
  return (
    <View className="gap-3">
      <Note text={t('examControl.sampleHint', { percent: o.session.settings.audit_percent, seed: o.session.settings.audit_seed })} />
      {o.rights.manage ? (
        <Button onPress={doDraw} disabled={draw.running}>
          <Text>{t('examControl.drawSample')}</Text>
        </Button>
      ) : null}
      {list.isLoading ? <LoadingList rows={2} /> : null}
      {list.data && !items.length ? <Note text={t('examControl.noSample')} /> : null}
      {items.length ? (
        <FormSection title={t('examControl.reviewedOf', { done, total: items.length })} description={errors ? t('examControl.errorsFoundN', { n: errors }) : undefined}>
          <ShareBar value={done / items.length} />
          {items.map((x) =>
            x.secret === null ? null : (
              <View key={x.secret} className="gap-1.5">
                <View className="flex-row items-center gap-3">
                  <Checkbox checked={x.reviewed} onCheckedChange={(v) => doReview(x.secret as number, !!v)} />
                  <Text className="flex-1 font-mono text-sm">{String(x.secret)}</Text>
                  <Checkbox checked={!!x.error_found} onCheckedChange={(v) => doReview(x.secret as number, x.reviewed, !!v)} />
                  <Text className={`text-xs ${x.error_found ? 'text-destructive' : ''}`}>{t('examControl.errorFound')}</Text>
                </View>
                <Input
                  placeholder={t('examControl.notes')}
                  defaultValue={x.notes ?? ''}
                  onChangeText={(v) => setNotes((n) => ({ ...n, [x.secret as number]: v }))}
                  onBlur={() => notes[x.secret as number] !== undefined && doReview(x.secret as number, x.reviewed)}
                />
              </View>
            ),
          )}
        </FormSection>
      ) : null}
    </View>
  );
}

function Appeals({ id, o }: P) {
  const { t } = useTranslation();
  const list = useApi(['jc', 'appeals', id] as const, ([, , s]) => jahbadhControl.appeals(s));
  const subjects = useMemo(() => columnsOf(o), [o]);
  const name = useSubjectName(o);
  const [secret, setSecret] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [after, setAfter] = useState('');
  const [reason, setReason] = useState('');
  const add = useAction(jahbadhControl.addAppeal, { success: t('examControl.appealSaved') });
  const submit = async () => {
    if (!subject) return;
    const res = await add.run(id, { secret: Number(secret), subject_key: subject, after: Number(after.replace(',', '.')), reason });
    if (res.ok) {
      list.mutate(res.data, { revalidate: false });
      setSecret('');
      setAfter('');
      setReason('');
    }
  };
  return (
    <View className="gap-4">
      {o.rights.chief ? (
        <FormSection title={t('examControl.addAppeal')} description={t('examControl.appealsHint')}>
          <View className="gap-1.5">
            <Label>{t('examControl.secretNumber')}</Label>
            <Input value={secret} onChangeText={(v) => setSecret(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
          <View className="gap-1.5">
            <Label>{t('examControl.subject')}</Label>
            <Picker value={subject} placeholder={t('examControl.pickSubject')} onChange={setSubject} options={subjects.map((s) => ({ value: s.key, label: `${s.name} (/${s.max})` }))} />
          </View>
          <View className="gap-1.5">
            <Label>{t('examControl.newScore')}</Label>
            <Input value={after} onChangeText={setAfter} keyboardType="decimal-pad" />
          </View>
          <View className="gap-1.5">
            <Label>{t('examControl.reason')}</Label>
            <Textarea value={reason} onChangeText={setReason} />
          </View>
          <Button onPress={submit} disabled={!secret || !subject || after === '' || !reason.trim() || add.running}>
            <Text>{t('examControl.record')}</Text>
          </Button>
        </FormSection>
      ) : null}
      {list.isLoading ? <LoadingList rows={2} /> : null}
      {list.data && !list.data.length ? <Note text={t('examControl.noAppeals')} /> : null}
      {list.data?.map((a) => (
        <View key={a.id} className="bg-card border-border gap-1 rounded-2xl border p-3">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-sm font-semibold">{[String(a.secret ?? ''), a.name].filter(Boolean).join(' · ')}</Text>
            <StatusChip label={a.applied ? t('examControl.applied') : t('examControl.superseded')} tone={a.applied ? 'success' : 'muted'} />
          </View>
          <Text className="text-xs">{`${name(a.subject_key)}: ${a.before ?? '—'} → ${a.after}`}</Text>
          <Text variant="muted" className="text-xs">{`${new Date(a.created_at).toLocaleString(locale)} · ${a.reason}`}</Text>
        </View>
      ))}
    </View>
  );
}

function Graders({ id, o }: P) {
  const { t } = useTranslation();
  const graders = useApi(['jc', 'graders', id] as const, ([, , s]) => jahbadhControl.graders(s));
  const committees = useApi(['jc', 'committee-status', id] as const, ([, , s]) => jahbadhControl.committeeStatus(s));
  const staff = useApi(['jc', 'staff', id] as const, ([, , s]) => jahbadhControl.staff(s));
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const save = useAction(jahbadhControl.saveGraders, { success: t('examControl.saved') });
  const subjects = useMemo(() => [...new Map(o.grades.flatMap((g) => g.subjects).map((s) => [s.key, s])).values()], [o.grades]);
  const used = (committees.data ?? []).filter((c) => c.count > 0);
  const people = [{ value: NONE, label: '—' }, ...(staff.data ?? []).map((p) => ({ value: p.id, label: p.name }))];
  const valueOf = (subj: string, cid: string) => {
    const k = `${subj}|${cid}`;
    if (k in draft) return draft[k] ?? NONE;
    return graders.data?.find((g) => g.subject_key === subj && g.committee_id === cid)?.staff_id ?? NONE;
  };
  const submit = async () => {
    const list = Object.entries(draft).map(([k, staff_id]) => {
      const [subject_key, committee_id] = k.split('|');
      return { subject_key, committee_id, staff_id };
    });
    if ((await save.run(id, list)).ok) {
      setDraft({});
      graders.mutate();
    }
  };
  if (!graders.data || !committees.data) return <LoadingList rows={3} />;
  if (!used.length) return <Note text={t('examControl.noCommittees')} />;
  return (
    <View className="gap-4">
      <Note text={t('examControl.gradersHint')} />
      <Button onPress={submit} disabled={!Object.keys(draft).length || save.running}>
        <Text>{t('examControl.save')}</Text>
      </Button>
      {subjects.map((s) => (
        <FormSection key={s.key} title={s.name}>
          {used.map((c) => (
            <View key={c.id} className="gap-1.5">
              <Label>{c.name}</Label>
              <Picker value={valueOf(s.key, c.id)} onChange={(v) => setDraft((d) => ({ ...d, [`${s.key}|${c.id}`]: v === NONE ? null : v }))} options={people} />
            </View>
          ))}
        </FormSection>
      ))}
    </View>
  );
}

/** Unmasking reconciliation (C7.4 #5): a scanned control stub shows its student (secret-numbers right). */
function StubCheck({ id, o }: P) {
  const { t } = useTranslation();
  const scanError = useScanError();
  const [rows, setRows] = useState<{ secret: number; seat: number | null; name: string; grade: string; committee: string | null }[]>([]);
  const onScan = async (digits: string) => {
    const res = await jahbadhControl.scan(id, digits, 'stub');
    const st = res.success ? res.data?.student : null;
    const secret = res.success ? (res.data?.secret ?? null) : null;
    if (!st || secret === null) return { ok: false, message: scanError(res.code, res.error) };
    setRows((x) => [{ secret, seat: st.seat_number, name: st.name, grade: st.grade_level_name, committee: st.committee_name }, ...x]);
    return { ok: true, message: `${secret} → ${st.seat_number} · ${st.name}` };
  };
  return (
    <View className="gap-3">
      <Note text={t('examControl.stubCheckHint')} />
      <ScanField expect="stub" camera={o.session.settings.camera_scanning} onScan={onScan} />
      {rows.map((r, i) => (
        <View key={i} className="bg-card border-border gap-0.5 rounded-2xl border p-3">
          <Text className="font-mono text-sm font-semibold">{`${r.secret} → ${r.seat ?? ''}`}</Text>
          <Text className="text-sm">{r.name}</Text>
          <Text variant="muted" className="text-xs">{[r.grade, r.committee].filter(Boolean).join(' · ')}</Text>
        </View>
      ))}
    </View>
  );
}
