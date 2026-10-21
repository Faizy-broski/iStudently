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
import { JcError, MiniTile, Note, pct, useOverview, useSessionId } from '@/features/exam-control/shared';
import { jahbadhControl } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useAction } from '@/lib/use-action';

type Pane = 'gate' | 'mismatches' | 'report' | 'sample' | 'appeals' | 'graders' | 'stubs';
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
        {pane === 'gate' ? <Gate {...props} /> : pane === 'mismatches' ? <Mismatches {...props} /> : pane === 'report' ? <Report {...props} /> : pane === 'sample' ? <Sample {...props} /> : pane === 'appeals' ? <Appeals {...props} /> : pane === 'graders' ? <Graders {...props} /> : <StubCheck {...props} />}
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
              <Text variant="muted" className="text-[11px]">
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
        <Text key={i} variant="muted" className="text-[11px]">{`${new Date(e.created_at).toLocaleString(locale)} — ${t(`examControl.event_${e.kind}`)}`}</Text>
      ))}
    </FormSection>
  );
}

function useSubjectName(o: JcOverview) {
  return (k: string) => o.grades.flatMap((g) => g.subjects).find((s) => s.key === k)?.name ?? k;
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
  if (q.error) return <Note tone="destructive" text={q.error.message} />;
  if (!q.data) return <LoadingList rows={3} />;
  const g = q.data.grades.find((x) => x.grade_level_id === gradePick) ?? q.data.grades[0];
  if (!g) return <Note text={t('examControl.noGradesYet')} />;
  return (
    <View className="gap-4">
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
          <Text variant="muted" className="text-[11px]">
            {[
              `${t('examControl.entered')} ${s.entered}${s.missing ? ` (−${s.missing})` : ''}`,
              `${t('examControl.passRate')} ${pct(s.passRate)}`,
              `${t('examControl.excellenceRate')} ${pct(s.excellenceRate)}`,
              `${t('examControl.weakRate')} ${pct(s.weakRate)}`,
            ].join(' · ')}
          </Text>
          <Text variant="muted" className="text-[11px]">
            {Object.entries(s.bands).map(([b, n]) => `${b} ${n}`).join(' · ')}
          </Text>
          {s.teachers.length ? <Text className="text-[11px]">{`${t('examControl.graders')}: ${s.teachers.join('، ')}`}</Text> : null}
          {s.clustering.flagged ? <Text className="text-destructive text-[11px]">{t('examControl.clusteringHint', { threshold: s.clustering.threshold, at: s.clustering.atThreshold, below: s.clustering.justBelow })}</Text> : null}
          {s.verdict ? <Text className="text-xs">{s.verdict}</Text> : null}
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

function Sample({ id, o }: P) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const list = useApi(['jc', 'audit-sample', id] as const, ([, , s]) => jahbadhControl.auditSample(s));
  const draw = useAction(jahbadhControl.drawAuditSample, { success: t('examControl.drawn') });
  const review = useAction(jahbadhControl.reviewAuditSample);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const items = list.data ?? [];
  const done = items.filter((x) => x.reviewed).length;
  const doDraw = async () => {
    if (items.length && !(await confirm({ title: t('examControl.drawSample'), body: t('examControl.confirmRedraw') }))) return;
    const res = await draw.run(id);
    if (res.ok) list.mutate(res.data, { revalidate: false });
  };
  const doReview = async (secret: number, reviewed: boolean) => {
    if ((await review.run(id, { secret, reviewed, notes: notes[secret] })).ok) list.mutate();
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
        <FormSection title={t('examControl.reviewedOf', { done, total: items.length })}>
          <ShareBar value={done / items.length} />
          {items.map((x) =>
            x.secret === null ? null : (
              <View key={x.secret} className="gap-1.5">
                <View className="flex-row items-center gap-3">
                  <Checkbox checked={x.reviewed} onCheckedChange={(v) => doReview(x.secret as number, !!v)} />
                  <Text className="font-mono text-sm">{String(x.secret)}</Text>
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
  const subjects = useMemo(() => [...new Map(o.grades.flatMap((g) => g.subjects).map((s) => [s.key, s])).values()], [o.grades]);
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
          <Text variant="muted" className="text-[11px]">{`${new Date(a.created_at).toLocaleString(locale)} · ${a.reason}`}</Text>
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
          <Text variant="muted" className="text-[11px]">{[r.grade, r.committee].filter(Boolean).join(' · ')}</Text>
        </View>
      ))}
    </View>
  );
}
