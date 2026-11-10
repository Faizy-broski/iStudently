import { jgInsightPdfPath, type JgInsightSettings } from '@studently/api-client';
import { fmtPct } from '@studently/shared-utils';
import { router } from 'expo-router';
import { BarChart3, Save } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FormSection, Section, StatTile, StatTiles } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
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
import { CampusScreen, InsightScreen, jahbadhInsight, Loading, own, pascal, useGradeLevels, useShare } from '@/features/jahbadh/insight-shared';
import { useJg } from '@/features/jahbadh/shared';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const rowCls = (i: number, n: number) => cn('gap-1 px-4 py-3', i < n - 1 && 'border-info-soft dark:border-border border-b');

/** Workflow item → screen under /jahbadh (the class home hosts the subject lists). */
const ITEM_PATH: Record<string, string> = { grid: '', edge: 'edge-students', 'excellence-points': 'excellence' };
const itemPath = (key: string) => ITEM_PATH[key] ?? key;
const CAMPUS_ITEMS = new Set(['section-allocation', 'marking-fairness', 'principal-dashboard']);

/** «مسار العمل» (web: /admin/jahbadh-grades/workflow). */
export function WorkflowScreen() {
  const { t } = useTranslation();
  return (
    <InsightScreen title={t('grades.insWorkflow')}>
      {(sectionId, _c, cid) => <WorkflowBody sectionId={sectionId} cid={cid} />}
    </InsightScreen>
  );
}

function WorkflowBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t, i18n } = useTranslation();
  const { href } = useJg();
  const res = useApi(['jg', 'workflow', sectionId, cid] as const, ([, , s, c]) => jahbadhInsight.workflow(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const badge = (key: string): ReactNode => {
    if (key === 'entry-progress' && d.badges.entry_pct !== null) {
      return <StatusChip label={`${d.badges.entry_pct}%${d.badges.late ? ` · ${t('grades.insLate', { n: d.badges.late })}` : ''}`} tone={d.badges.late ? 'destructive' : 'muted'} />;
    }
    if (key === 'entry-audit' && d.badges.audit_errors !== null) {
      return <StatusChip label={`${d.badges.audit_errors} ✖ · ${d.badges.audit_warnings ?? 0} ⚠`} tone={d.badges.audit_errors ? 'destructive' : 'success'} />;
    }
    if (key === 'approval') {
      return <StatusChip label={d.badges.approved_at ? new Date(d.badges.approved_at).toLocaleDateString(i18n.language) : t('grades.insNotApprovedYet')} tone={d.badges.approved_at ? 'success' : 'muted'} />;
    }
    return null;
  };
  return (
    <>
      <View className="flex-row flex-wrap items-center gap-2">
        <StatusChip label={t(`grades.insMode_${d.mode}`)} tone={d.mode === 'reader' ? 'muted' : 'success'} />
        <Text variant="muted" className="text-xs">{`${d.section.grade_level_name} — ${d.section.name}`}</Text>
      </View>
      {d.steps.map((s) => (
        <Section key={s.key} title={`${s.step}. ${t(`grades.insStep_${s.key}`)}`}>
          <Panel>
            {s.items.map((item, i) => (
              <ActionRow
                key={item}
                icon={BarChart3}
                title={t(`grades.insItem${pascal(item)}`)}
                trailing={badge(item)}
                onPress={() => router.push(href(`/jahbadh${itemPath(item) ? `/${itemPath(item)}` : ''}`, CAMPUS_ITEMS.has(item) ? undefined : { section: sectionId }))}
                last={i === s.items.length - 1}
              />
            ))}
          </Panel>
        </Section>
      ))}
    </>
  );
}

const HUB: { group: string; items: [string, string][] }[] = [
  { group: 'insGroupPlanning', items: [['prediction', 'insPrediction'], ['edge-students', 'insEdge'], ['inflation', 'insInflation'], ['weak-items', 'insWeakItems'], ['auto-comments', 'insAutoComments'], ['support-plans', 'insSupportPlans'], ['absence-impact', 'insAbsenceImpact'], ['what-if', 'insWhatIf']] },
  { group: 'insGroupQuality', items: [['entry-progress', 'insEntryProgress'], ['entry-audit', 'insEntryAudit'], ['approval', 'insApproval'], ['verification', 'insVerification'], ['certificates', 'insCertificates'], ['excellence', 'insExcellence'], ['end-of-year', 'insEndOfYear']] },
  { group: 'insGroupAdmin', items: [['principal-dashboard', 'insPrincipalDashboard'], ['section-allocation', 'insSectionAllocation'], ['marking-fairness', 'insMarkingFairness'], ['insight-settings', 'insSettings'], ['workflow', 'insWorkflow'], ['infographics', 'insInfographics']] },
];
const ADMIN_ONLY = new Set(['what-if', 'principal-dashboard', 'section-allocation', 'marking-fairness', 'insight-settings']);

/** «التحليل والإدارة» (web: /admin/jahbadh-grades/insight). */
export function InsightHubScreen() {
  const { t } = useTranslation();
  const { href, isAdmin } = useJg();
  return (
    <InsightScreen title={t('grades.insHub')}>
      {(sectionId) => (
        <>
          {HUB.map((g) => {
            const items = g.items.filter(([path]) => isAdmin || !ADMIN_ONLY.has(path));
            return (
              <Section key={g.group} title={t(`grades.${g.group}`)}>
                <Panel>
                  {items.map(([path, key], i) => (
                    <ActionRow
                      key={path}
                      icon={BarChart3}
                      title={t(`grades.${key}`)}
                      onPress={() => router.push(href(`/jahbadh/${path}`, CAMPUS_ITEMS.has(path) || path === 'insight-settings' ? undefined : { section: sectionId }))}
                      last={i === items.length - 1}
                    />
                  ))}
                </Panel>
              </Section>
            );
          })}
        </>
      )}
    </InsightScreen>
  );
}

/** «لوحة المدير» (web: /admin/jahbadh-grades/principal-dashboard). */
export function PrincipalDashboardScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <CampusScreen title={t('grades.insPrincipalDashboard')} onPrint={(c) => share(jgInsightPdfPath.principalDashboard(c), 'principal-dashboard.pdf')}>
      {(_c, cid) => <PrincipalBody cid={cid} />}
    </CampusScreen>
  );
}

function PrincipalBody({ cid }: { cid: string }) {
  const { t } = useTranslation();
  const { href } = useJg();
  const res = useApi(['jg', 'principal', cid] as const, ([, , c]) => jahbadhInsight.principalDashboard(own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.enrolled')} value={String(d.totals.enrolled)} />
        <StatTile label={t('grades.passed')} value={String(d.totals.passed)} tone="success" />
        <StatTile label={t('grades.round2')} value={String(d.totals.round2)} tone="warning" />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.failed')} value={String(d.totals.failed)} tone="destructive" />
        <StatTile label={t('grades.passRate')} value={d.totals.pass_rate === null ? '—' : fmtPct(d.totals.pass_rate, 1)} tone="success" />
        <StatTile label={t('grades.insExcellent')} value={String(d.totals.excellent)} />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.insNeedsSupport')} value={String(d.totals.needs_support)} tone="warning" />
        <StatTile label={t('grades.insEntryErrors')} value={String(d.totals.entry_errors)} tone={d.totals.entry_errors ? 'destructive' : 'muted'} />
      </StatTiles>
      {d.reading.length ? (
        <Panel className="gap-1 p-4">
          {d.reading.map((r, i) => <Text key={i} className="text-sm">{`• ${r}`}</Text>)}
        </Panel>
      ) : null}
      <Panel>
        {d.rows.map((r, i) => (
          <Pressable key={r.section_id} onPress={() => router.push(href('/jahbadh', { section: r.section_id }))} className={cn(rowCls(i, d.rows.length), 'active:opacity-70')} accessibilityRole="button">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`#${r.rank} ${r.grade} — ${r.section}`}</Text>
              <StatusChip label={r.pass_rate === null ? '—' : fmtPct(r.pass_rate, 0)} tone="info" />
            </View>
            <Text variant="muted" className="text-xs">
              {`${t('grades.enrolled')} ${r.enrolled} · ${t('grades.insAverage')} ${r.average === null ? '—' : fmtPct(r.average, 1)} · ${t('grades.passed')} ${r.passed} · ${t('grades.round2')} ${r.round2} · ${t('grades.failed')} ${r.failed}`}
            </Text>
            <Text variant="muted" className="text-xs">
              {`${t('grades.insExcellent')} ${r.excellent} · ${t('grades.insNeedsSupport')} ${r.needs_support} · ${t('grades.insEntry')} ${r.entry_completion === null ? '—' : fmtPct(r.entry_completion, 0)}${r.entry_errors ? ` · ${r.entry_errors} ✖` : ''}`}
            </Text>
            {r.weakest_subject || r.strongest_subject ? <Text variant="muted" className="text-xs">{`${t('grades.insWeakest')}: ${r.weakest_subject ?? '—'} · ${t('grades.strongest')}: ${r.strongest_subject ?? '—'}`}</Text> : null}
          </Pressable>
        ))}
      </Panel>
    </>
  );
}

/** «توزيع الشعب» (web: /admin/jahbadh-grades/section-allocation). */
export function SectionAllocationScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [applied, setApplied] = useState<{ from: string; repeat: string | null; names: string[] } | null>(null);
  return (
    <CampusScreen title={t('grades.insSectionAllocation')} onPrint={(c) => applied && share(jgInsightPdfPath.allocation(applied, c), 'section-allocation.pdf')}>
      {(campusId, cid) => <AllocationBody campusId={campusId} cid={cid} applied={applied} setApplied={setApplied} />}
    </CampusScreen>
  );
}

function AllocationBody({ campusId, cid, applied, setApplied }: { campusId: string | null; cid: string; applied: { from: string; repeat: string | null; names: string[] } | null; setApplied: (a: { from: string; repeat: string | null; names: string[] }) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { grades } = useGradeLevels(campusId);
  const [from, setFrom] = useState<string | null>(null);
  const [repeat, setRepeat] = useState('none');
  const [names, setNames] = useState('أ، ب، ج');
  const res = useApi(applied ? (['jg', 'allocation', cid, applied.from, applied.repeat ?? '', applied.names.join(',')] as const) : null, ([, , c, f, r, n]) =>
    jahbadhInsight.sectionAllocation({ from: f, repeat: r || null, names: n.split(',') }, own(c)),
  );
  const d = res.data;
  const run = () => {
    const list = names.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
    if (!from || !list.length) return toast.error(t('grades.insAllocationInvalid'));
    setApplied({ from, repeat: repeat === 'none' ? null : repeat, names: list });
  };
  return (
    <>
      <FormSection title={t('grades.insSectionAllocation')}>
        <Label>{t('grades.insAllocFrom')}</Label>
        <Picker value={from} onChange={setFrom} placeholder={t('grades.insChooseGrade')} options={grades.map((g) => ({ value: g.id, label: g.name }))} />
        <Label>{t('grades.insAllocRepeat')}</Label>
        <Picker value={repeat} onChange={setRepeat} options={[{ value: 'none', label: t('grades.insNone') }, ...grades.map((g) => ({ value: g.id, label: g.name }))]} />
        <Label>{t('grades.insAllocNames')}</Label>
        <Input value={names} onChangeText={setNames} />
        <Button onPress={run}><Text>{t('grades.insGenerate')}</Text></Button>
        <Text variant="muted" className="text-xs">{t('grades.insAllocHint')}</Text>
      </FormSection>
      {applied && !d ? <Loading error={res.error} /> : null}
      {d ? (
        <>
          <StatTiles>
            <StatTile label={t('grades.insPool')} value={String(d.pool)} />
            <StatTile label={t('grades.insAverage')} value={d.overall === null || d.overall === undefined ? '—' : fmtPct(d.overall, 1)} />
          </StatTiles>
          <Panel>
            {d.sections.map((s, i) => (
              <View key={s.name} className={rowCls(i, d.sections.length)}>
                <Text className="text-sm font-semibold">{`${s.name} · ${s.count}`}</Text>
                <Text variant="muted" className="text-xs">
                  {`${t('grades.boys')} ${s.boys} · ${t('grades.girls')} ${s.girls} · ${t('grades.insRepeaters')} ${s.repeaters} · ${t('grades.insAverage')} ${s.average === null ? '—' : fmtPct(s.average, 1)} · ${t('grades.insGapFromMean')} ${s.gap === null ? '—' : `${s.gap > 0 ? '+' : ''}${(s.gap * 100).toFixed(1)}`} · ${t('grades.insExcellent')} ${s.excellent} · ${t('grades.insWeak')} ${s.weak}`}
                </Text>
              </View>
            ))}
          </Panel>
          <FormSection title={t('grades.insStudentsList')}>
            {d.list.map((s) => (
              <View key={s.id} className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-medium" numberOfLines={1}>{s.name}</Text>
                  <Text variant="muted" className="text-xs">{`${s.status}${s.pct === null ? '' : ` · ${fmtPct(s.pct, 0)}`}${s.previous_section ? ` · ${s.previous_section}` : ''}`}</Text>
                </View>
                <StatusChip label={s.section} tone="info" />
              </View>
            ))}
          </FormSection>
        </>
      ) : null}
    </>
  );
}

/** «عدالة التصحيح بين الشعب» (web: /admin/jahbadh-grades/marking-fairness). */
export function MarkingFairnessScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [grade, setGrade] = useState<string | null>(null);
  const [th, setTh] = useState(0);
  return (
    <CampusScreen title={t('grades.insMarkingFairness')} onPrint={(c) => grade && share(jgInsightPdfPath.fairness(grade, th || undefined, c), 'marking-fairness.pdf')}>
      {(campusId, cid) => <FairnessBody campusId={campusId} cid={cid} grade={grade} setGrade={setGrade} th={th} setTh={setTh} />}
    </CampusScreen>
  );
}

function FairnessBody({ campusId, cid, grade, setGrade, th, setTh }: { campusId: string | null; cid: string; grade: string | null; setGrade: (g: string) => void; th: number; setTh: (n: number) => void }) {
  const { t } = useTranslation();
  const { grades } = useGradeLevels(campusId);
  const [thInput, setThInput] = useState('');
  const gradeId = grade ?? grades[0]?.id ?? null;
  const res = useApi(gradeId ? (['jg', 'fairness', cid, gradeId, th] as const) : null, ([, , c, g, h]) => jahbadhInsight.markingFairness(g, h || undefined, own(c)));
  const d = res.data;
  const signed = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}`);
  return (
    <>
      <FormSection title={t('grades.insMarkingFairness')}>
        <Label>{t('grades.insGrade')}</Label>
        <Picker value={gradeId} onChange={setGrade} placeholder={t('grades.insChooseGrade')} options={grades.map((g) => ({ value: g.id, label: g.name }))} />
        <Label>{t('grades.insFairnessThreshold')}</Label>
        <Input value={thInput} onChangeText={setThInput} keyboardType="decimal-pad" placeholder={d ? String(Math.round(d.threshold * 100)) : '5'} />
        <Button variant="outline" onPress={() => setTh(Number(thInput) || 0)}><Text>{t('grades.insApply')}</Text></Button>
      </FormSection>
      {!gradeId ? null : !d ? <Loading error={res.error} /> : (
        <>
          <Text variant="muted" className="text-xs">{t('grades.insFairnessNote')}</Text>
          {d.sections.map((sec) => (
            <Panel key={sec} className="gap-1 p-4">
              <Text className="text-sm font-semibold">{sec}</Text>
              {d.subjects.map((s) => {
                const c = d.cells.find((x) => x.section === sec && x.subject === s.id);
                const tone: ChipTone = c?.flagged ? ((c.gap ?? 0) > 0 ? 'warning' : 'destructive') : 'muted';
                return (
                  <View key={s.id} className="flex-row items-center justify-between gap-2">
                    <View className="flex-1">
                      <Text className="text-sm" numberOfLines={1}>{s.name}</Text>
                      {d.teachers[sec]?.[s.id] ? <Text variant="muted" className="text-xs">{d.teachers[sec][s.id]}</Text> : null}
                    </View>
                    <Text variant="muted" className="text-xs">{c?.mean !== null && c?.mean !== undefined ? fmtPct(c.mean, 0) : ''}</Text>
                    <StatusChip label={signed(c?.gap ?? null)} tone={tone} />
                  </View>
                );
              })}
            </Panel>
          ))}
          <FormSection title={t('grades.insGradeMean')}>
            {d.subjects.map((s) => (
              <View key={s.id} className="flex-row items-center justify-between">
                <Text className="text-sm">{s.name}</Text>
                <Text className="text-sm font-semibold">{d.grade_mean[s.id] === null || d.grade_mean[s.id] === undefined ? '—' : fmtPct(d.grade_mean[s.id], 0)}</Text>
              </View>
            ))}
          </FormSection>
          {d.top_gaps.length ? (
            <FormSection title={t('grades.insTopGaps')}>
              {d.top_gaps.map((g) => (
                <View key={`${g.section}-${g.subject}`} className="gap-0.5">
                  <Text className="text-sm font-semibold">{`${g.section} — ${g.subject_name} (${signed(g.gap)})`}</Text>
                  {g.teacher ? <Text variant="muted" className="text-xs">{g.teacher}</Text> : null}
                  <Text className="text-xs">{g.recommendation}</Text>
                </View>
              ))}
            </FormSection>
          ) : <EmptyState title={t('grades.insNoFlagged')} />}
        </>
      )}
    </>
  );
}

const NUM_FIELDS: { key: keyof Omit<JgInsightSettings, 'support_actions'>; label: string; scale?: number }[] = [
  { key: 'edge_margin', label: 'insSetEdgeMargin' },
  { key: 'edge_need_max', label: 'insSetEdgeNeed' },
  { key: 'inflation_gap', label: 'insSetInflationGap', scale: 100 },
  { key: 'audit_far', label: 'insSetAuditFar' },
  { key: 'audit_jump', label: 'insSetAuditJump' },
  { key: 'plan_weeks', label: 'insSetPlanWeeks' },
  { key: 'fairness_threshold', label: 'insSetFairness' },
];

/** Insight settings (web: /admin/jahbadh-grades/insight-settings): thresholds, phrase bank, excellence categories. */
export function InsightSettingsScreen() {
  const { t } = useTranslation();
  return (
    <CampusScreen title={t('grades.insSettings')}>
      {() => (
        <>
          <ThresholdsCard />
          <PhraseBankCard />
          <CategoriesCard />
        </>
      )}
    </CampusScreen>
  );
}

function ThresholdsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const res = useApi(['jg', 'insight-settings'] as const, () => jahbadhInsight.insightSettings());
  const [form, setForm] = useState<Record<string, string>>({});
  const [school, setSchool] = useState<string | null>(null);
  const [home, setHome] = useState<string | null>(null);
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const val = (f: (typeof NUM_FIELDS)[number]) => form[f.key] ?? String(Math.round(d[f.key] * (f.scale ?? 1) * 100) / 100);
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const save = async () => {
    const body: Partial<JgInsightSettings> = { support_actions: { school: lines(school ?? d.support_actions.school.join('\n')), home: lines(home ?? d.support_actions.home.join('\n')) } };
    for (const f of NUM_FIELDS) {
      const n = Number(val(f));
      if (!Number.isFinite(n) || n < 0) return toast.error(t('grades.insInvalidNumber'));
      (body as Record<string, unknown>)[f.key] = n / (f.scale ?? 1);
    }
    const r = await jahbadhInsight.saveInsightSettings(body);
    if (!r.success) return toast.error(r.code === 'not_migrated' ? t('grades.notMigratedBody') : (r.error ?? t('app.error_title')));
    toast.success(t('grades.saved'));
    setForm({});
    setSchool(null);
    setHome(null);
    res.mutate(r.data, { revalidate: false });
  };
  return (
    <FormSection title={t('grades.insThresholds')}>
      {NUM_FIELDS.map((f) => (
        <View key={f.key} className="gap-1">
          <Label>{t(`grades.${f.label}`)}</Label>
          <Input value={val(f)} keyboardType="decimal-pad" onChangeText={(v) => setForm((x) => ({ ...x, [f.key]: v }))} />
        </View>
      ))}
      <Label>{t('grades.insSchoolActions')}</Label>
      <Textarea value={school ?? d.support_actions.school.join('\n')} onChangeText={setSchool} />
      <Label>{t('grades.insHomeActions')}</Label>
      <Textarea value={home ?? d.support_actions.home.join('\n')} onChangeText={setHome} />
      <Button onPress={save}>
        <Icon as={Save} className="text-primary-foreground size-4" />
        <Text>{t('grades.save')}</Text>
      </Button>
    </FormSection>
  );
}

function PhraseBankCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const res = useApi(['jg', 'phrase-bank'] as const, () => jahbadhInsight.phraseBank());
  const [draft, setDraft] = useState<Record<string, { m?: string; f?: string }>>({});
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const save = async () => {
    const phrases = d.map((p) => ({ key: p.key, m: draft[p.key]?.m ?? p.m, f: draft[p.key]?.f ?? p.f }));
    const r = await jahbadhInsight.savePhraseBank(phrases);
    if (!r.success) return toast.error(r.code === 'not_migrated' ? t('grades.notMigratedBody') : (r.error ?? t('app.error_title')));
    toast.success(t('grades.saved'));
    setDraft({});
    res.mutate(r.data, { revalidate: false });
  };
  return (
    <FormSection title={t('grades.insPhraseBank')}>
      <Text variant="muted" className="text-xs">{t('grades.insPhraseBankHint')}</Text>
      {d.map((p) => (
        <View key={p.key} className="gap-1">
          <Label>{p.label}</Label>
          <Input value={draft[p.key]?.m ?? p.m} placeholder={t('grades.insMasculine')} onChangeText={(v) => setDraft((x) => ({ ...x, [p.key]: { ...x[p.key], m: v } }))} />
          <Input value={draft[p.key]?.f ?? p.f} placeholder={t('grades.insFeminine')} onChangeText={(v) => setDraft((x) => ({ ...x, [p.key]: { ...x[p.key], f: v } }))} />
        </View>
      ))}
      <Button onPress={save}>
        <Icon as={Save} className="text-primary-foreground size-4" />
        <Text>{t('grades.save')}</Text>
      </Button>
    </FormSection>
  );
}

function CategoriesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const res = useApi(['jg', 'excellence-categories'] as const, () => jahbadhInsight.excellenceCategories());
  const [draft, setDraft] = useState<string[] | null>(null);
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const names = draft ?? d;
  const save = async () => {
    const r = await jahbadhInsight.saveExcellenceCategories(names.map((n) => n.trim()));
    if (!r.success) return toast.error(r.code === 'not_migrated' ? t('grades.notMigratedBody') : (r.error ?? t('app.error_title')));
    toast.success(t('grades.saved'));
    setDraft(null);
    res.mutate(r.data, { revalidate: false });
  };
  return (
    <FormSection title={t('grades.insExcellenceCategories')}>
      {names.map((n, i) => (
        <Input key={i} value={n} onChangeText={(v) => setDraft(names.map((x, j) => (j === i ? v : x)))} />
      ))}
      <Button onPress={save}>
        <Icon as={Save} className="text-primary-foreground size-4" />
        <Text>{t('grades.save')}</Text>
      </Button>
    </FormSection>
  );
}
