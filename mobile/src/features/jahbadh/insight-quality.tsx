import { jgInsightPdfPath, type JgEndOfYear } from '@studently/api-client';
import { certificateText, fmtPct, type JgCertificateKind, type JgProgressStatus } from '@studently/shared-utils';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { AlertTriangle, BadgeCheck, Plus, Save, Send, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DateField } from '@/components/app/date-field';
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
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { InsightScreen, jahbadhInsight, Loading, own, today, useOverview, useShare } from '@/features/jahbadh/insight-shared';
import { useJg } from '@/features/jahbadh/shared';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const rowCls = (i: number, n: number) => cn('gap-1 px-4 py-3', i < n - 1 && 'border-info-soft dark:border-border border-b');
const levelTone: Record<string, ChipTone> = { error: 'destructive', warning: 'warning', roster: 'muted' };

/** «مدقق الإدخال» (web: /admin/jahbadh-grades/entry-audit): errors block publishing report cards. */
export function EntryAuditScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insEntryAudit')} onPrint={(s, c) => share(jgInsightPdfPath.audit(s, c), 'entry-audit.pdf')}>
      {(sectionId, _c, cid) => <EntryAuditBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function EntryAuditBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const { href } = useJg();
  const [level, setLevel] = useState('all');
  const res = useApi(['jg', 'entry-audit', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.entryAudit(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const issues = d.issues.filter((i) => level === 'all' || i.level === level);
  return (
    <>
      <View className={cn('flex-row items-start gap-2 rounded-2xl p-3', d.errors > 0 ? 'bg-destructive-soft' : 'bg-success-soft')}>
        <Icon as={d.errors > 0 ? AlertTriangle : BadgeCheck} className={cn('mt-0.5 size-4', d.errors > 0 ? 'text-destructive' : 'text-success')} />
        <Text className="flex-1 text-sm">{d.errors > 0 ? t('grades.insAuditBlocked', { n: d.errors }) : t('grades.insAuditClean')}</Text>
      </View>
      <StatTiles>
        <StatTile label={t('grades.insErrors')} value={String(d.errors)} tone="destructive" />
        <StatTile label={t('grades.insWarnings')} value={String(d.warnings)} tone="warning" />
        <StatTile label={t('grades.insRosterNotes')} value={String(d.roster)} />
      </StatTiles>
      <Picker
        value={level}
        onChange={setLevel}
        options={(['all', 'error', 'warning', 'roster'] as const).map((l) => ({ value: l, label: t(`grades.insLevel_${l}`) }))}
      />
      {!issues.length ? <EmptyState title={t('grades.insNothingToShow')} /> : (
        <Panel>
          {issues.map((i, k) => {
            const stageName = i.stage ? (d.stage_names[i.stage - 1] ?? String(i.stage)) : null;
            const subjectId = i.subject_id ?? null;
            return (
              <View key={`${i.kind}-${i.student_id}-${subjectId ?? ''}-${i.stage ?? ''}-${k}`} className={rowCls(k, issues.length)}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{i.name}</Text>
                  <StatusChip label={t(`grades.insLevel_${i.level}`)} tone={levelTone[i.level] ?? 'muted'} />
                </View>
                <Text className="text-sm">{i.label}</Text>
                <Text variant="muted" className="text-xs">{[i.subject, stageName, i.detail].filter(Boolean).join(' · ')}</Text>
                {subjectId ? (
                  <Button size="sm" variant="outline" className="self-start" onPress={() => router.push(href('/jahbadh/grid', { section: sectionId, subject: subjectId, ...(i.stage ? { stage: String(i.stage) } : {}) }))}>
                    <Text>{t('grades.insOpenCell')}</Text>
                  </Button>
                ) : null}
              </View>
            );
          })}
        </Panel>
      )}
    </>
  );
}

const short = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** «سجل الاعتماد» (web: /admin/jahbadh-grades/approval). */
export function ApprovalScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insApproval')} onPrint={(s, c) => share(jgInsightPdfPath.approval(s, c), 'approval.pdf')}>
      {(sectionId, _c, cid) => <ApprovalBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function ApprovalBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const { stages } = useOverview(sectionId, cid);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const res = useApi(['jg', 'approval', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.approval(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const approve = async () => {
    setBusy(true);
    const r = await jahbadhInsight.approve(sectionId, note || null, own(cid));
    setBusy(false);
    if (!r.success) return toast.error(r.code === 'audit_errors' ? t('grades.insApproveBlocked') : (r.error ?? t('app.error_title')));
    toast.success(t('grades.insApproved'));
    setNote('');
    res.mutate(r.data, { revalidate: false });
  };
  const stageLabel = (s: number | 'round2' | 'cells') => (s === 'round2' ? t('grades.insRound2') : s === 'cells' ? t('grades.insCells') : (stages.find((x) => x.value === String(s))?.label ?? String(s)));
  const status = d.status;
  return (
    <>
      <Panel className="gap-2 p-4">
        <StatusChip label={d.status_label ?? t(`grades.insApprovalStatus_${status}`)} tone={status === 'matches' ? 'success' : status === 'changed' ? 'warning' : 'muted'} className="self-start" />
        {d.approved ? <Text variant="muted" className="text-xs">{`${t('grades.insApprovedOn', { date: new Date(d.approved.at).toLocaleString(i18n.language) })}${d.approved.note ? ` — ${d.approved.note}` : ''}`}</Text> : null}
      </Panel>
      {isAdmin ? (
        <FormSection title={t('grades.insApproveNow')}>
          <Label>{t('grades.insApprovalNote')}</Label>
          <Input value={note} onChangeText={setNote} />
          <Button onPress={approve} disabled={busy}>
            <Icon as={ShieldCheck} className="text-primary-foreground size-4" />
            <Text>{t('grades.insApprove')}</Text>
          </Button>
          <Text variant="muted" className="text-xs">{t('grades.insApproveHint')}</Text>
        </FormSection>
      ) : null}
      {d.changes.length ? (
        <FormSection title={`${t('grades.insChangesSince')} (${d.changes.length})`}>
          {d.changes.map((c, k) => (
            <View key={`${c.student_id}-${c.subject_id}-${c.stage}-${k}`} className="gap-0.5">
              <Text className="text-sm font-semibold">{`${c.name} — ${c.subject}`}</Text>
              <Text variant="muted" className="text-xs">{`${stageLabel(c.stage)}: ${short(c.approved)} → ${short(c.current)}`}</Text>
            </View>
          ))}
        </FormSection>
      ) : d.approved ? <Text variant="muted" className="text-xs">{t('grades.insNoChangesSince')}</Text> : null}
      {d.log.length ? (
        <FormSection title={t('grades.insChangeLog')}>
          {d.log.map((l, k) => (
            <View key={`${l.created_at}-${k}`} className="gap-0.5">
              <Text className="text-sm">{`${l.action}${l.actor_role ? ` · ${l.actor_role}` : ''}`}</Text>
              <Text variant="muted" className="text-xs">{`${new Date(l.created_at).toLocaleString(i18n.language)} · ${short(l.before)} → ${short(l.after)}`}</Text>
            </View>
          ))}
        </FormSection>
      ) : null}
    </>
  );
}

/** «التحقق من صحيفة» (web: /admin/jahbadh-grades/verification). */
export function VerificationScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insVerification')} onPrint={(s, c) => share(jgInsightPdfPath.verification(s, c), 'verification.pdf')}>
      {(sectionId, _c, cid) => <VerificationBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function VerificationBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { stages } = useOverview(sectionId, cid);
  const [scope, setScope] = useState('final');
  const [code, setCode] = useState('');
  const [number, setNumber] = useState('');
  const [checked, setChecked] = useState<{ status: string; summary?: Record<string, unknown> } | null>(null);
  const res = useApi(['jg', 'verification', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.verificationArchive(s, own(c)));
  const d = res.data;
  const issue = async () => {
    const r = await jahbadhInsight.issueVerificationCodes(sectionId, scope, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.insCodesIssued', { n: Object.keys(r.data?.codes ?? {}).length }));
    res.mutate();
  };
  const check = async () => {
    const r = await jahbadhInsight.checkVerificationCode(sectionId, code.trim(), number.trim() || null, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    setChecked(r.data ?? null);
  };
  const tone = (s: string): ChipTone => (s === 'matches' ? 'success' : s === 'outdated' ? 'warning' : 'destructive');
  return (
    <>
      <FormSection title={t('grades.insIssueCodes')}>
        <Picker value={scope} onChange={setScope} options={[...stages.map((s) => ({ value: `stage${s.value}`, label: s.label })), { value: 'final', label: t('grades.finalResult') }]} />
        <Button onPress={issue}>
          <Icon as={Send} className="text-primary-foreground size-4" />
          <Text>{t('grades.insIssue')}</Text>
        </Button>
        <Text variant="muted" className="text-xs">{t('grades.insVerificationHint')}</Text>
      </FormSection>
      <FormSection title={t('grades.insCheckCode')}>
        <Label>{t('grades.insCode')}</Label>
        <Input value={code} onChangeText={setCode} keyboardType="number-pad" />
        <Label>{t('grades.insStudentNumber')}</Label>
        <Input value={number} onChangeText={setNumber} />
        <Button variant="outline" onPress={check} disabled={!code.trim()}><Text>{t('grades.insCheck')}</Text></Button>
        {checked ? (
          <View className="flex-row flex-wrap items-center gap-2">
            <StatusChip label={t(`grades.insVerifyStatus_${checked.status}`)} tone={tone(checked.status)} />
            {checked.summary?.name ? <Text className="text-sm">{String(checked.summary.name)}</Text> : null}
          </View>
        ) : null}
      </FormSection>
      {!d ? <Loading error={res.error} /> : !d.codes.length ? <EmptyState title={t('grades.insNoCodes')} /> : (
        <Panel>
          {d.codes.map((c, i) => (
            <View key={c.code} className={rowCls(i, d.codes.length)}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{String(c.summary?.name ?? c.student_id)}</Text>
                <Text className="text-sm font-semibold" selectable>{c.code}</Text>
              </View>
              <Text variant="muted" className="text-xs">{`${c.scope} · ${String(c.summary?.decision ?? '—')} · ${new Date(c.issued_at).toLocaleDateString(i18n.language)}`}</Text>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(c.url);
                  toast.success(t('grades.insCopied'));
                }}
                accessibilityRole="button">
                <Text className="text-brand-secondary text-xs font-medium">{t('grades.insCopyLink')}</Text>
              </Pressable>
            </View>
          ))}
        </Panel>
      )}
    </>
  );
}

const KINDS: JgCertificateKind[] = ['excellence', 'top3', 'improved', 'attendance', 'stars'];

/** «شهادات التقدير» (web: /admin/jahbadh-grades/certificates). */
export function CertificatesScreen() {
  const { t } = useTranslation();
  return (
    <InsightScreen title={t('grades.insCertificates')}>
      {(sectionId, _c, cid) => <CertificatesBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function CertificatesBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const { share } = useShare();
  const { stages } = useOverview(sectionId, cid);
  const [scope, setScope] = useState('final');
  const [kind, setKind] = useState<JgCertificateKind>('excellence');
  const scopeValue: number | 'final' = scope === 'final' ? 'final' : Number(scope);
  const res = useApi(['jg', 'certificates', sectionId, cid, scope] as const, ([, , s, c, sc]) => jahbadhInsight.certificates(s, sc === 'final' ? 'final' : Number(sc), own(c)));
  const d = res.data;
  const rows = d?.certificates[kind] ?? [];
  return (
    <>
      <Picker value={scope} onChange={setScope} options={[...stages, { value: 'final', label: t('grades.finalResult') }]} />
      <Picker value={kind} onChange={(v) => setKind(v as JgCertificateKind)} options={KINDS.map((k) => ({ value: k, label: `${t(`grades.insCert_${k}`)}${d ? ` (${d.certificates[k].length})` : ''}` }))} />
      <Button variant="outline" disabled={!rows.length} onPress={() => share(jgInsightPdfPath.certificates(sectionId, kind, scopeValue, own(cid)), 'certificates.pdf')}>
        <Text>{t('grades.printPdf')}</Text>
      </Button>
      {!d ? <Loading error={res.error} /> : !rows.length ? <EmptyState title={t('grades.insNoCertificates')} /> : (
        <Panel>
          {rows.map((r, i) => (
            <View key={`${r.kind}-${r.student_id}`} className={rowCls(i, rows.length)}>
              <Text className="text-sm font-semibold">{`${r.name}${r.pct !== null ? ` · ${fmtPct(r.pct, 1)}` : ''}${r.rank ? ` · #${r.rank}` : ''}`}</Text>
              <Text variant="muted" className="text-xs">{r.detail}</Text>
              <Text className="text-xs">{certificateText(kind, r.gender, d.basic, d.scope_name)}</Text>
            </View>
          ))}
        </Panel>
      )}
    </>
  );
}

const PROGRESS_TONE: Record<JgProgressStatus, ChipTone> = { complete: 'success', in_progress: 'warning', not_started: 'muted', late: 'destructive' };

/** «متابعة الرصد» (web: /admin/jahbadh-grades/entry-progress). */
export function EntryProgressScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insEntryProgress')} onPrint={(s, c) => share(jgInsightPdfPath.entryProgress(s, c), 'entry-progress.pdf')}>
      {(sectionId, _c, cid) => <EntryProgressBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function EntryProgressBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const { stages } = useOverview(sectionId, cid);
  const [dl, setDl] = useState<Record<string, string>>({});
  const [all, setAll] = useState(false);
  const res = useApi(['jg', 'entry-progress', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.entryProgress(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const deadline = (stage: string) => dl[stage] ?? d.deadlines[Number(stage)] ?? '';
  const saveDeadlines = async () => {
    const body: Record<number, string | null> = {};
    for (const s of stages) body[Number(s.value)] = deadline(s.value) || null;
    const r = await jahbadhInsight.saveStageDeadlines(sectionId, body, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    setDl({});
    res.mutate();
  };
  const remind = async () => {
    const r = await jahbadhInsight.sendEntryReminders(sectionId, all, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.insRemindersSent', { n: r.data?.sent ?? 0 }));
    res.mutate();
  };
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.insCurrentStageProgress')} value={d.current_pct === null ? '—' : `${d.current_pct}%`} tone={d.current_pct !== null && d.current_pct >= 100 ? 'success' : 'warning'} />
        <StatTile label={t('grades.insLateRows')} value={String(d.rows.filter((r) => r.status === 'late').length)} tone="destructive" />
        <StatTile label={t('grades.insCompleteRows')} value={String(d.rows.filter((r) => r.status === 'complete').length)} tone="success" />
      </StatTiles>
      {isAdmin ? (
        <>
          <FormSection title={t('grades.insDeadlines')}>
            {stages.map((s) => (
              <View key={s.value} className="gap-1">
                <Label>{s.label}</Label>
                <DateField value={deadline(s.value) || null} onChange={(v) => setDl((x) => ({ ...x, [s.value]: v }))} clearable />
              </View>
            ))}
            <Button variant="outline" onPress={saveDeadlines}>
              <Icon as={Save} className="text-foreground size-4" />
              <Text>{t('grades.save')}</Text>
            </Button>
          </FormSection>
          <FormSection title={t('grades.insReminders')}>
            <View className="flex-row items-center gap-3">
              <Switch checked={all} onCheckedChange={setAll} />
              <Text className="flex-1 text-sm">{t('grades.insRemindAll')}</Text>
            </View>
            <Button onPress={remind}>
              <Icon as={Send} className="text-primary-foreground size-4" />
              <Text>{t('grades.insSendReminders')}</Text>
            </Button>
            <Text variant="muted" className="text-xs">{t('grades.insRemindHint')}</Text>
          </FormSection>
        </>
      ) : null}
      <Panel>
        {d.rows.map((r, i) => (
          <View key={`${r.subject_id}-${r.stage}`} className={rowCls(i, d.rows.length)}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`${r.subject} — ${r.stage_name}`}</Text>
              <StatusChip label={r.status_label} tone={PROGRESS_TONE[r.status]} />
            </View>
            <Text variant="muted" className="text-xs">{`${r.done}/${r.required} (${r.pct}%)${r.deadline ? ` · ${t('grades.insDeadline')} ${r.deadline}` : ''}${r.teacher ? ` · ${r.teacher}` : ''}`}</Text>
            {r.reminder ? <Text variant="muted" className="text-xs">{r.reminder}</Text> : null}
          </View>
        ))}
      </Panel>
    </>
  );
}

const MEDAL: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };

/** «نقاط التميز» (web: /admin/jahbadh-grades/excellence). */
export function ExcellenceScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insExcellence')} onPrint={(s, c) => share(jgInsightPdfPath.excellence(s, {}, c), 'excellence.pdf')}>
      {(sectionId, _c, cid) => <ExcellenceBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function ExcellenceBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);
  const [student, setStudent] = useState<string | null>(null);
  const [category, setCategory] = useState('0');
  const [points, setPoints] = useState('1');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(today());
  const res = useApi(['jg', 'excellence', sectionId, cid, period?.from ?? '', period?.to ?? ''] as const, ([, , s, c, f, tt]) =>
    jahbadhInsight.excellence(s, { from: f || undefined, to: tt || undefined }, own(c)),
  );
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const add = async () => {
    const n = Number(points);
    if (!student || !Number.isFinite(n) || n === 0) return toast.error(t('grades.insPointsInvalid'));
    const r = await jahbadhInsight.addExcellencePoints(sectionId, { student_id: student, category: Number(category), points: n, note: note || undefined, awarded_on: date ?? undefined }, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    setNote('');
    res.mutate();
  };
  const remove = async (id: string) => {
    const r = await jahbadhInsight.deleteExcellencePoints(sectionId, id, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    res.mutate();
  };
  return (
    <>
      <FormSection title={t('grades.insAddPoints')}>
        <Picker value={student} onChange={setStudent} placeholder={t('grades.insChooseStudent')} options={d.rows.map((r) => ({ value: r.student_id, label: r.name }))} />
        <Picker value={category} onChange={setCategory} options={d.categories.map((c, i) => ({ value: String(i), label: c }))} />
        <Label>{t('grades.insPoints')}</Label>
        <Input value={points} onChangeText={setPoints} keyboardType="numbers-and-punctuation" />
        <DateField value={date} onChange={setDate} label={t('grades.insDate')} />
        <Input value={note} onChangeText={setNote} placeholder={t('grades.insNote')} />
        <Button onPress={add}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{t('grades.insAdd')}</Text>
        </Button>
        <Text variant="muted" className="text-xs">{t('grades.insPointsHint')}</Text>
      </FormSection>
      <FormSection title={t('grades.insPeriod')}>
        <DateField value={from} onChange={setFrom} label={t('grades.insFrom')} clearable />
        <DateField value={to} onChange={setTo} label={t('grades.insTo')} clearable />
        <Button variant="outline" onPress={() => setPeriod(from || to ? { from: from ?? '', to: to ?? '' } : null)}><Text>{t('grades.insApply')}</Text></Button>
      </FormSection>
      {d.stars.length ? (
        <FormSection title={t('grades.insStars')}>
          {d.stars.map((s) => (
            <View key={s.category} className="gap-0.5">
              <Text variant="muted" className="text-xs">{`${s.category} · ${s.points}`}</Text>
              <Text className="text-sm font-semibold">{`⭐ ${s.students.join('، ')}`}</Text>
            </View>
          ))}
        </FormSection>
      ) : null}
      <Panel>
        {d.rows.map((r, i) => (
          <View key={r.student_id} className={rowCls(i, d.rows.length)}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`${r.medal ? MEDAL[r.medal] : `#${r.rank}`} ${r.name}`}</Text>
              <Text className="text-sm font-bold">{String(r.total)}</Text>
            </View>
            <Text variant="muted" className="text-xs">{d.categories.map((c, k) => `${c}: ${r.per_category[k] ?? 0}`).join(' · ')}</Text>
          </View>
        ))}
      </Panel>
      <FormSection title={t('grades.insPointsLog')}>
        {!d.log.length ? <Text variant="muted" className="text-sm">{t('grades.insNoPoints')}</Text> : d.log.map((l) => (
          <View key={l.id} className="flex-row items-center justify-between gap-2">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-medium">{`${l.name} · ${l.category_name} · ${l.points > 0 ? '+' : ''}${l.points}`}</Text>
              <Text variant="muted" className="text-xs">{`${l.awarded_on}${l.note ? ` · ${l.note}` : ''}`}</Text>
            </View>
            <Pressable onPress={() => remove(l.id)} accessibilityRole="button" accessibilityLabel={t('grades.insDelete')} hitSlop={8}>
              <Icon as={Trash2} className="text-destructive size-4" />
            </Pressable>
          </View>
        ))}
      </FormSection>
    </>
  );
}

/** «التقرير الختامي» (web: /admin/jahbadh-grades/end-of-year). */
export function EndOfYearScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <InsightScreen title={t('grades.insEndOfYear')} onPrint={(s, c) => share(jgInsightPdfPath.endOfYear(s, c), 'end-of-year.pdf')}>
      {(sectionId, _c, cid) => <EndOfYearBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function EndOfYearBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const res = useApi(['jg', 'eoy', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.endOfYear(s, own(c)));
  const d: JgEndOfYear | undefined = res.data;
  const [rows, setRows] = useState<{ k: string; v: string }[] | null>(null);
  const [free, setFree] = useState<string | null>(null);
  if (!d) return <Loading error={res.error} />;
  const manualRows = rows ?? Object.entries(d.manual).filter(([k]) => k !== 'free_line').map(([k, v]) => ({ k, v: String(v) }));
  const freeLine = free ?? String(d.manual.free_line ?? '');
  const save = async () => {
    const manual: Record<string, number | string> = {};
    for (const r of manualRows) {
      const key = r.k.trim();
      if (!key || key === 'free_line') continue;
      manual[key] = r.v.trim() !== '' && Number.isFinite(Number(r.v)) ? Number(r.v) : r.v;
    }
    if (freeLine.trim()) manual.free_line = freeLine.trim();
    const r = await jahbadhInsight.saveEndOfYear(sectionId, manual, own(cid));
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.saved'));
    setRows(null);
    setFree(null);
    res.mutate(r.data, { revalidate: false });
  };
  const split = (s: { m: number; f: number; total: number }) => `${s.total} (${s.m}/${s.f})`;
  const pct = (v: number | null) => (v === null ? '—' : fmtPct(v, 1));
  return (
    <>
      <StatusChip
        label={d.approval ? t('grades.insApprovedOn', { date: new Date(d.approval.at).toLocaleDateString(i18n.language) }) : t('grades.insNotApprovedYet')}
        tone={d.approval ? 'success' : 'muted'}
        className="self-start"
      />
      <StatTiles>
        <StatTile label={t('grades.insAverageAll')} value={pct(d.averages.all)} />
        <StatTile label={t('grades.boys')} value={pct(d.averages.boys)} />
        <StatTile label={t('grades.girls')} value={pct(d.averages.girls)} />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.insAttendanceRate')} value={pct(d.attendance_rate)} tone="success" />
        <StatTile label={t('grades.insPassRate')} value={pct(d.rates.passed)} tone="success" />
        <StatTile label={t('grades.insRound2Rate')} value={pct(d.rates.round2)} tone="warning" />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.insFailRate')} value={pct(d.rates.failed)} tone="destructive" />
        <StatTile label={t('grades.insUndecidedRate')} value={pct(d.rates.undecided)} />
      </StatTiles>
      <FormSection title={t('grades.insTotalsByGender')}>
        <Text variant="muted" className="text-xs">{t('grades.splitLegend')}</Text>
        {([[t('grades.enrolled'), d.totals.enrolled], [t('grades.insExamined'), d.totals.examined], [t('grades.passed'), d.totals.passed], [t('grades.round2'), d.totals.round2], [t('grades.failed'), d.totals.failed], [t('grades.insUndecided'), d.totals.undecided]] as const).map(([label, s]) => (
          <View key={label} className="flex-row items-center justify-between">
            <Text className="text-sm">{label}</Text>
            <Text className="text-sm font-semibold">{split(s)}</Text>
          </View>
        ))}
      </FormSection>
      <Panel>
        {d.subjects.map((s, i) => (
          <View key={s.subject_id} className={rowCls(i, d.subjects.length)}>
            <Text className="text-sm font-semibold">{s.name}</Text>
            <Text variant="muted" className="text-xs">{`${t('grades.insAverage')} ${s.average === null ? '—' : fmtPct(s.average, 1)} · ${t('grades.highest')} ${s.highest === null ? '—' : fmtPct(s.highest, 0)} · ${t('grades.lowest')} ${s.lowest === null ? '—' : fmtPct(s.lowest, 0)} · ${t('grades.passRate')} ${s.pass_rate === null ? '—' : fmtPct(s.pass_rate, 0)} · ${t('grades.insExcellent')} ${s.excellent}${s.band ? ` · ${s.band}` : ''}`}</Text>
          </View>
        ))}
      </Panel>
      <FormSection title={t('grades.insTop5')}>
        {d.top5.map((s, i) => <Text key={i} className="text-sm">{`${s.rank ?? i + 1}. ${s.name} — ${fmtPct(s.pct, 1) || '—'}`}</Text>)}
      </FormSection>
      <FormSection title={t('grades.insMostImproved')}>
        {d.most_improved.length ? d.most_improved.map((s, i) => <Text key={i} className="text-sm">{`${s.name} — ${s.gain}`}</Text>) : <Text variant="muted" className="text-sm">{t('grades.insNothingToShow')}</Text>}
      </FormSection>
      <FormSection title={t('grades.insRecommendations')}>
        {d.recommendations.map((r, i) => <Text key={i} className="text-sm">{`• ${r}`}</Text>)}
      </FormSection>
      {isAdmin ? (
        <FormSection title={t('grades.insLastYear')}>
          <Text variant="muted" className="text-xs">{t('grades.insLastYearHint')}</Text>
          {manualRows.map((r, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <Input className="flex-1" value={r.k} placeholder={t('grades.insLabel')} onChangeText={(v) => setRows(manualRows.map((x, j) => (j === i ? { ...x, k: v } : x)))} />
              <Input className="w-24" value={r.v} placeholder={t('grades.insValue')} onChangeText={(v) => setRows(manualRows.map((x, j) => (j === i ? { ...x, v } : x)))} />
              <Pressable onPress={() => setRows(manualRows.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('grades.insDelete')} hitSlop={8}>
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
          ))}
          <Button variant="outline" size="sm" onPress={() => setRows([...manualRows, { k: '', v: '' }])}>
            <Icon as={Plus} className="text-foreground size-4" />
            <Text>{t('grades.insAddRow')}</Text>
          </Button>
          <Label>{t('grades.insFreeLine')}</Label>
          <Textarea value={freeLine} onChangeText={setFree} numberOfLines={3} />
          <Button onPress={save}>
            <Icon as={Save} className="text-primary-foreground size-4" />
            <Text>{t('grades.save')}</Text>
          </Button>
        </FormSection>
      ) : null}
    </>
  );
}
