import { jgOfficialPdfPath, type JgReviewFlag, type JgRound2TimetableRow, type JgSplit } from '@studently/api-client';
import { decisionTone, fmtMark, fmtPct } from '@studently/shared-utils';
import { router, Stack } from 'expo-router';
import { Award, BarChart3, CalendarDays, ClipboardCheck, FileSpreadsheet, LineChart as LineIcon, MessageCircle, PieChart, Printer, ScrollText, Send, TableProperties } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';

import { LineChart } from '@/components/app/charts';
import { DateField } from '@/components/app/date-field';
import { ScrollView } from '@/components/app/keyboard';
import { FormSection, StatTile, StatTiles } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { EmptyState } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { TimeField } from '@/components/app/time-field';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { chipTone, JgBlocked, SectionHeader, useJg, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades, jahbadhOfficial } from '@/lib/api';
import type { ApiError } from '@/lib/data';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';
import { cn } from '@/lib/utils';

const own = (c: string) => (c === 'own' ? null : c);
const split = (s: JgSplit) => `${s.total} (${s.m}/${s.f})`;

function useShare() {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const share = async (path: string, name: string) => {
    setBusy(true);
    try {
      await shareApiFile(path, name, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, share };
}

/** Stack title + print button, section picker, then the body once a section is chosen. */
function OfficialScreen({ title, onPrint, children }: { title: string; onPrint?: (sectionId: string, campusId: string | null) => void; children: (sectionId: string, campusId: string | null, cid: string) => ReactNode }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const sid = sectionId;
  return (
    <>
      <Stack.Screen
        options={{
          title,
          headerRight: onPrint
            ? () => (
                <Pressable onPress={() => sid && onPrint(sid, campusId)} accessibilityRole="button" accessibilityLabel={t('grades.printPdf')} className="p-2">
                  <Icon as={Printer} className="text-brand dark:text-brand-secondary size-5" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {sid ? children(sid, campusId, campusId ?? 'own') : null}
      </ScrollView>
    </>
  );
}

function Loading({ error }: { error?: ApiError }) {
  const { isAdmin } = useJg();
  if (error) return <JgBlocked error={error} isAdmin={isAdmin} />;
  return <Skeleton className="h-48 rounded-2xl" />;
}

/** Stage names of the section's rule (same cache as the class home). */
function useStages(sectionId: string, cid: string) {
  const ov = useApi(['jg', 'overview', sectionId, cid] as const, ([, , s, c]) => jahbadhGrades.sectionSubjects(s, own(c)));
  const stages = (ov.data?.rule.stage_names ?? []).map((n, i) => (n ? { value: String(i + 1), label: n } : null)).filter((x): x is { value: string; label: string } => !!x);
  return { overview: ov, stages };
}

/** «المخرجات الرسمية» (web: /admin/jahbadh-grades/official): every official print of the class. */
export function OfficialHubScreen() {
  const { t } = useTranslation();
  const { href } = useJg();
  const items = [
    ['/jahbadh/statistics', 'statistics', BarChart3],
    ['/jahbadh/top-students', 'topStudentsList', Award],
    ['/jahbadh/final-sheet', 'finalSheet', TableProperties],
    ['/jahbadh/review-sheet', 'reviewSheet', ClipboardCheck],
    ['/jahbadh/guardian-notices', 'guardianNotices', MessageCircle],
    ['/jahbadh/monthly-cards', 'monthlyCards', CalendarDays],
    ['/jahbadh/monthly-curve', 'monthlyCurve', LineIcon],
    ['/jahbadh/marking-sheets', 'markingSheets', FileSpreadsheet],
    ['/jahbadh/second-round', 'secondRound', ScrollText],
    ['/jahbadh/infographics', 'infographics', PieChart],
  ] as const;
  return (
    <OfficialScreen title={t('grades.officialOutputs')}>
      {(sectionId) => (
        <Panel>
          {items.map(([path, key, icon], i) => (
            <ActionRow key={path} icon={icon} title={t(`grades.${key}`)} onPress={() => router.push(href(path, { section: sectionId }))} last={i === items.length - 1} />
          ))}
        </Panel>
      )}
    </OfficialScreen>
  );
}

/** «الإحصائية» (web: /admin/jahbadh-grades/statistics). */
export function StatisticsScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <OfficialScreen title={t('grades.statistics')} onPrint={(s, c) => share(jgOfficialPdfPath.statistics(s, c), 'statistics.pdf')}>
      {(sectionId, _c, cid) => <StatisticsBody sectionId={sectionId} cid={cid} />}
    </OfficialScreen>
  );
}

function StatisticsBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'statistics', sectionId, cid] as const, ([, , s, c]) => jahbadhOfficial.statistics(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const ind = d.indicators;
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.overallAverage')} value={fmtPct(ind.average_pct, 1) || '—'} />
        <StatTile label={t('grades.passRate')} value={fmtPct(d.overall.pass_rate, 1) || '—'} tone="success" />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.highest')} value={fmtPct(ind.highest_pct, 1) || '—'} tone="success" />
        <StatTile label={t('grades.lowest')} value={fmtPct(ind.lowest_pct, 1) || '—'} tone="destructive" />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.boys')} value={fmtPct(ind.average_pct_boys, 1) || '—'} />
        <StatTile label={t('grades.girls')} value={fmtPct(ind.average_pct_girls, 1) || '—'} />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.strongest')} value={ind.best_subject ?? '—'} tone="success" />
        <StatTile label={t('grades.weakest')} value={ind.weakest_subject ?? '—'} tone="warning" />
      </StatTiles>
      <Text variant="muted" className="text-xs">{t('grades.splitLegend')}</Text>
      <Panel>
        {[...d.subjects.map((s) => ({ ...s, key: s.subject_id })), { key: 'total', name: t('grades.total'), ...d.overall }].map((s, i, all) => (
          <View key={s.key} className={cn('gap-1 px-4 py-3', i < all.length - 1 && 'border-info-soft dark:border-border border-b')}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold">{s.name}</Text>
              <StatusChip label={fmtPct(s.pass_rate, 1) || '—'} tone="info" />
            </View>
            <Text variant="muted" className="text-xs">
              {`${t('grades.enrolled')} ${split(s.enrolled)} · ${t('grades.passed')} ${split(s.passed)} · ${t('grades.round2')} ${split(s.round2)} · ${t('grades.failed')} ${split(s.failed)}`}
            </Text>
          </View>
        ))}
      </Panel>
      <FormSection title={t('grades.overallLevels')}>
        {d.estimates.map((e) => (
          <View key={e.label} className="flex-row items-center justify-between">
            <Text className="text-sm">{e.label}</Text>
            <Text className="text-sm font-semibold">{split(e.counts)}</Text>
          </View>
        ))}
      </FormSection>
    </>
  );
}

/** «كشف الأوائل» (web: /admin/jahbadh-grades/top-students). */
export function TopStudentsScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [n, setN] = useState('10');
  return (
    <OfficialScreen title={t('grades.topStudentsList')} onPrint={(s, c) => share(jgOfficialPdfPath.topStudents(s, Number(n), c), 'top-students.pdf')}>
      {(sectionId, _c, cid) => (
        <>
          <Picker value={n} onChange={setN} options={['3', '5', '10', '20'].map((x) => ({ value: x, label: t('grades.showTop', { n: x }) }))} />
          <TopBody sectionId={sectionId} cid={cid} n={Number(n)} />
        </>
      )}
    </OfficialScreen>
  );
}

function TopBody({ sectionId, cid, n }: { sectionId: string; cid: string; n: number }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'top', sectionId, cid, n] as const, ([, , s, c, count]) => jahbadhOfficial.topStudents(s, count, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  if (!d.students.length) return <EmptyState icon={Award} title={t('grades.noStudents')} />;
  return (
    <Panel>
      {d.students.map((s, i) => (
        <View key={s.student.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < d.students.length - 1 && 'border-info-soft dark:border-border border-b')}>
          <View className="bg-info-soft size-9 items-center justify-center rounded-full">
            <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{String(s.rank)}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-semibold" numberOfLines={1}>{s.student.name}</Text>
            <Text variant="muted" className="text-xs">{`${fmtMark(s.total)} / ${fmtMark(s.max)} · ${fmtPct(s.pct, 1)}${s.estimate ? ` · ${s.estimate}` : ''}`}</Text>
          </View>
          <StatusChip label={s.decision} tone={chipTone(decisionTone(s.decision))} />
        </View>
      ))}
    </Panel>
  );
}

/** «كشف النتيجة النهائية» (web: /admin/jahbadh-grades/final-sheet). */
export function FinalSheetScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <OfficialScreen title={t('grades.finalSheet')} onPrint={(s, c) => share(jgOfficialPdfPath.finalSheet(s, c), 'final-sheet.pdf')}>
      {(sectionId, _c, cid) => <FinalBody sectionId={sectionId} cid={cid} />}
    </OfficialScreen>
  );
}

function FinalBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'final-sheet', sectionId, cid] as const, ([, , s, c]) => jahbadhOfficial.finalSheet(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const s = d.summary;
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.enrolled')} value={String(s.enrolled)} />
        <StatTile label={t('grades.passed')} value={String(s.passed)} tone="success" />
        <StatTile label={t('grades.round2')} value={String(s.round2)} tone="warning" />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.failed')} value={String(s.failed)} tone="destructive" />
        <StatTile label={t('grades.incomplete')} value={String(s.incomplete)} />
        <StatTile label={t('grades.passRate')} value={fmtPct(s.pass_rate, 1) || '—'} />
      </StatTiles>
      <Panel>
        {d.results.students.map((r, i, all) => (
          <View key={r.student.id} className={cn('gap-1 px-4 py-3', i < all.length - 1 && 'border-info-soft dark:border-border border-b')}>
            <Text className="text-sm font-semibold" numberOfLines={1}>{`${i + 1}. ${r.student.name}`}</Text>
            <Text variant="muted" className="text-xs">
              {`${r.total === null ? '—' : `${fmtMark(r.total)} / ${fmtMark(r.max)}`} · ${fmtPct(r.pct, 1) || '—'}${r.estimate ? ` · ${r.estimate}` : ''} · ${t('grades.rank')} ${r.rank ?? '—'}`}
            </Text>
            <StatusChip label={r.decision_detail || r.decision || '—'} tone={chipTone(decisionTone(r.decision))} className="self-start" />
          </View>
        ))}
      </Panel>
    </>
  );
}

const FLAG_CLASS: Record<JgReviewFlag, string> = {
  missing: 'bg-warning-soft text-warning',
  over_max: 'bg-destructive-soft text-destructive',
  jump: 'border-destructive border-2',
  low: 'text-destructive',
};

/** «كشف المراجعة» (web: /admin/jahbadh-grades/review-sheet). */
export function ReviewSheetScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  return (
    <OfficialScreen title={t('grades.reviewSheet')} onPrint={(s, c) => share(jgOfficialPdfPath.reviewSheet(s, c), 'review-sheet.pdf')}>
      {(sectionId, _c, cid) => <ReviewBody sectionId={sectionId} cid={cid} />}
    </OfficialScreen>
  );
}

function ReviewBody({ sectionId, cid }: { sectionId: string; cid: string }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'review', sectionId, cid] as const, ([, , s, c]) => jahbadhOfficial.reviewSheet(s, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  return (
    <>
      <View className="flex-row flex-wrap gap-1.5">
        {(['missing', 'over_max', 'jump', 'low'] as const).map((f) => (
          <View key={f} className={cn('rounded-md px-2 py-0.5', FLAG_CLASS[f])}>
            <Text className="text-2xs">{t(`grades.flag_${f}`)}</Text>
          </View>
        ))}
      </View>
      <Text variant="muted" className="text-xs">{t('grades.missingCells', { n: d.missing_cells })}</Text>
      {d.students.map((s) => (
        <Panel key={s.student.id} className="gap-2 p-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{s.student.name}</Text>
            <StatusChip label={s.decision || '—'} tone={chipTone(decisionTone(s.decision))} />
          </View>
          <Text variant="muted" className="text-xs">{`${s.total === null ? '—' : `${fmtMark(s.total)} / ${fmtMark(s.max)} · ${fmtPct(s.pct, 1)}`}${s.rank ? ` · ${t('grades.rank')} ${s.rank}` : ''}`}</Text>
          {d.subjects.map((sub) => (
            <View key={sub.id} className="flex-row flex-wrap items-center gap-1.5">
              <Text className="w-28 text-xs" numberOfLines={1}>{sub.name}</Text>
              {d.stages.map((st) => {
                const c = s.stages[st]?.[sub.id];
                return (
                  <View key={st} className={cn('min-w-10 items-center rounded-md px-1.5 py-0.5', ...(c?.flags ?? []).map((f) => FLAG_CLASS[f]))}>
                    <Text className="text-xs">{c ? (c.value === null ? '؟' : fmtMark(c.value)) : '—'}</Text>
                  </View>
                );
              })}
              <Text variant="muted" className="text-xs">{[s.results[sub.id]?.label, s.results[sub.id]?.trend].filter(Boolean).join(' ')}</Text>
            </View>
          ))}
        </Panel>
      ))}
    </>
  );
}

/** «إشعار ولي الأمر» (web: /admin/jahbadh-grades/guardian-notices). */
export function GuardianNoticesScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<string | null>(null);
  return (
    <OfficialScreen title={t('grades.guardianNotices')}>
      {(sectionId, campusId, cid) => <GuardianBody sectionId={sectionId} campusId={campusId} cid={cid} stage={stage} setStage={setStage} />}
    </OfficialScreen>
  );
}

function GuardianBody({ sectionId, campusId, cid, stage, setStage }: { sectionId: string; campusId: string | null; cid: string; stage: string | null; setStage: (s: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const { stages } = useStages(sectionId, cid);
  const current = stage ?? stages[0]?.value ?? null;
  const res = useApi(current ? (['jg', 'guardian', sectionId, cid, current] as const) : null, ([, , s, c, st]) => jahbadhOfficial.guardianNotices(s, Number(st), own(c)));
  const [sending, setSending] = useState(false);
  const { share, busy } = useShare();
  const d = res.data;
  const send = async () => {
    const st = current;
    if (!st) return;
    setSending(true);
    const r = await jahbadhOfficial.sendGuardianNotices(sectionId, Number(st), campusId);
    setSending(false);
    if (!r.success) return toast.error(r.error ?? t('app.error_title'));
    toast.success(t('grades.noticesSent', { sent: r.data?.sent ?? 0, recipients: r.data?.recipients ?? 0 }));
  };
  return (
    <>
      <Picker value={current} onChange={setStage} options={stages} placeholder={t('grades.stageView')} />
      {current ? (
        <Button variant="outline" disabled={busy} onPress={() => share(jgOfficialPdfPath.guardianNotices(sectionId, Number(current), campusId), 'guardian-notices.pdf')}>
          <Icon as={Printer} className="text-foreground size-4" />
          <Text>{t('grades.printPdf')}</Text>
        </Button>
      ) : null}
      {!d ? (
        <Loading error={res.error} />
      ) : !d.notices.length ? (
        <EmptyState icon={MessageCircle} title={t('grades.noNotices')} />
      ) : (
        <>
          {isAdmin ? (
            <Button disabled={sending} onPress={send}>
              <Icon as={Send} className="text-primary-foreground size-4" />
              <Text>{t('grades.sendNotices')}</Text>
            </Button>
          ) : null}
          {d.notices.map((n) => {
            const url = n.whatsapp_url;
            return (
              <Panel key={n.student.id} className="gap-2 p-4">
                <Text className="text-sm font-semibold">{n.student.name}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {n.subjects.map((s) => <StatusChip key={s.subject_id} label={`${s.name} ${fmtMark(s.score)}/${fmtMark(s.max)}`} tone="destructive" />)}
                </View>
                {url ? (
                  <Button variant="outline" size="sm" onPress={() => Linking.openURL(url)}>
                    <Icon as={MessageCircle} className="text-foreground size-4" />
                    <Text>{t('grades.sendWhatsapp')}</Text>
                  </Button>
                ) : (
                  <Text variant="muted" className="text-xs">{t('grades.noPhone')}</Text>
                )}
              </Panel>
            );
          })}
        </>
      )}
    </>
  );
}

/** «الصحيفة الشهرية» (web: /admin/jahbadh-grades/monthly-cards). */
export function MonthlyCardsScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [stage, setStage] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const q = { stage: stage ? Number(stage) : undefined, month: month ? Number(month) : undefined };
  return (
    <OfficialScreen title={t('grades.monthlyCards')} onPrint={(s, c) => share(jgOfficialPdfPath.monthlyCards(s, q, c), 'monthly-cards.pdf')}>
      {(sectionId, campusId, cid) => (
        <MonthlyCardsBody sectionId={sectionId} campusId={campusId} cid={cid} stage={stage} month={month} setStage={(s) => { setStage(s); setMonth(null); }} setMonth={setMonth} />
      )}
    </OfficialScreen>
  );
}

function MonthlyCardsBody(p: { sectionId: string; campusId: string | null; cid: string; stage: string | null; month: string | null; setStage: (s: string) => void; setMonth: (m: string) => void }) {
  const { t } = useTranslation();
  const { share, busy } = useShare();
  const { stages } = useStages(p.sectionId, p.cid);
  const res = useApi(['jg', 'monthly-cards', p.sectionId, p.cid, p.stage ?? '', p.month ?? ''] as const, ([, , s, c, st, m]) =>
    jahbadhOfficial.monthlyCards(s, { stage: st ? Number(st) : undefined, month: m ? Number(m) : undefined }, own(c)),
  );
  const d = res.data;
  return (
    <>
      <Picker value={d ? String(d.stage) : p.stage} onChange={p.setStage} options={stages} placeholder={t('grades.stageView')} />
      {d ? <Picker value={String(d.month_idx)} onChange={p.setMonth} options={d.months.map((m) => ({ value: String(m.idx), label: m.name }))} placeholder={t('grades.month')} /> : null}
      {!d ? (
        <Loading error={res.error} />
      ) : (
        d.cards.map((c) => (
          <Panel key={c.student.id} className="gap-2 p-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{`${c.list_number}. ${c.student.name}`}</Text>
              <Pressable
                disabled={busy}
                onPress={() => share(jgOfficialPdfPath.monthlyCards(p.sectionId, { stage: d.stage, month: d.month_idx, studentId: c.student.id }, p.campusId), 'monthly-card.pdf')}
                accessibilityRole="button"
                accessibilityLabel={t('grades.printPdf')}
                className="p-1">
                <Icon as={Printer} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
            <Text variant="muted" className="text-xs">{`${d.month_name} · ${c.total === null ? '—' : `${fmtMark(c.total)} / ${fmtMark(c.max)}`}${c.level ? ` · ${c.level}` : ''}`}</Text>
            {c.subjects.map((s) => (
              <View key={s.subject_id} className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-xs" numberOfLines={1}>{s.name}</Text>
                <Text className="text-xs font-semibold">{`${s.absent ? 'غ' : s.mark === null ? '—' : `${fmtMark(s.mark)}/${fmtMark(s.max)}`} ${s.trend ?? ''}`}</Text>
                <Text variant="muted" className="w-16 text-end text-xs">{s.previous === null ? '—' : fmtMark(s.previous)}</Text>
              </View>
            ))}
            {c.absence_days !== null ? <Text variant="muted" className="text-xs">{t('grades.absenceDays', { n: c.absence_days })}</Text> : null}
          </Panel>
        ))
      )}
    </>
  );
}

/** «المنحنى الشهري» (web: /admin/jahbadh-grades/monthly-curve). */
export function MonthlyCurveScreen() {
  const { t } = useTranslation();
  const { share } = useShare();
  const [studentId, setStudentId] = useState<string | null>(null);
  return (
    <OfficialScreen title={t('grades.monthlyCurve')} onPrint={(s, c) => share(jgOfficialPdfPath.monthlyCurve(s, studentId ?? undefined, c), 'monthly-curve.pdf')}>
      {(sectionId, _c, cid) => <CurveBody sectionId={sectionId} cid={cid} studentId={studentId} setStudentId={setStudentId} />}
    </OfficialScreen>
  );
}

function CurveBody({ sectionId, cid, studentId, setStudentId }: { sectionId: string; cid: string; studentId: string | null; setStudentId: (id: string | null) => void }) {
  const { t } = useTranslation();
  const res = useApi(['jg', 'monthly-curve', sectionId, cid] as const, ([, , s, c]) => jahbadhOfficial.monthlyCurve(s, undefined, own(c)));
  const d = res.data;
  if (!d) return <Loading error={res.error} />;
  const picked = studentId ?? d.students[0]?.student.id ?? null;
  const s = d.students.find((x) => x.student.id === picked);
  const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
  return (
    <>
      <Picker value={picked} onChange={(v) => setStudentId(v)} options={d.students.map((x) => ({ value: x.student.id, label: x.student.name }))} placeholder={t('grades.allStudents')} />
      {s ? (
        <>
          <Panel className="p-3">
            <LineChart categories={d.months.map((m) => m.name)} series={[{ name: t('grades.overallPct'), values: s.overall.map(pct) }]} height={200} />
          </Panel>
          <Panel>
            {s.subjects.map((sub, i) => (
              <View key={sub.subject_id} className={cn('gap-1 px-4 py-3', i < s.subjects.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <Text className="text-sm font-semibold">{`${sub.name} ${sub.trend ?? ''}`}</Text>
                <Text variant="muted" className="text-xs">{sub.points.map((p, j) => `${d.months[j]?.name ?? ''} ${p === null ? '—' : `${pct(p)}%`}`).join(' · ')}</Text>
              </View>
            ))}
          </Panel>
        </>
      ) : null}
    </>
  );
}

/** «كشف رصد المعلم» (web: /admin/jahbadh-grades/marking-sheets). */
export function MarkingSheetsScreen() {
  const { t } = useTranslation();
  const [stage, setStage] = useState<string | null>(null);
  const [subject, setSubject] = useState('all');
  return (
    <OfficialScreen title={t('grades.markingSheets')}>
      {(sectionId, campusId, cid) => <MarkingBody sectionId={sectionId} campusId={campusId} cid={cid} stage={stage} setStage={setStage} subject={subject} setSubject={setSubject} />}
    </OfficialScreen>
  );
}

function MarkingBody(p: { sectionId: string; campusId: string | null; cid: string; stage: string | null; setStage: (s: string) => void; subject: string; setSubject: (s: string) => void }) {
  const { t } = useTranslation();
  const { share, busy } = useShare();
  const { overview, stages } = useStages(p.sectionId, p.cid);
  const current = p.stage ?? stages[0]?.value ?? null;
  const res = useApi(current ? (['jg', 'marking', p.sectionId, p.cid, current, p.subject] as const) : null, ([, , s, c, st, sub]) => jahbadhOfficial.markingSheets(s, Number(st), sub, own(c)));
  const d = res.data;
  return (
    <>
      <Picker value={current} onChange={p.setStage} options={stages} placeholder={t('grades.stageView')} />
      <Picker value={p.subject} onChange={p.setSubject} options={[{ value: 'all', label: t('grades.allSubjects') }, ...(overview.data?.subjects ?? []).map((s) => ({ value: s.id, label: s.short_name }))]} />
      {current ? (
        <Button disabled={busy} onPress={() => share(jgOfficialPdfPath.markingSheets(p.sectionId, Number(current), p.subject, p.campusId), 'marking-sheets.pdf')}>
          <Icon as={Printer} className="text-primary-foreground size-4" />
          <Text>{t('grades.printPdf')}</Text>
        </Button>
      ) : null}
      {!d ? (
        <Loading error={res.error ?? overview.error} />
      ) : (
        <>
          <Text variant="muted" className="text-xs">{t('grades.sheetsCount', { sheets: d.sheets.length, students: d.students.length })}</Text>
          {d.sheets.map((sh) => (
            <Panel key={`${sh.subject_id}-${sh.page}`} className="gap-2 p-4">
              <Text className="text-sm font-semibold">{`${sh.subject_name} — ${sh.stage_name}`}</Text>
              {sh.pages > 1 ? <Text variant="muted" className="text-xs">{t('grades.pageOf', { page: sh.page, pages: sh.pages })}</Text> : null}
              <View className="flex-row flex-wrap gap-1.5">
                {sh.columns.map((c, i) => (
                  <StatusChip key={i} label={`${c.label}${c.max !== null ? ` (${fmtMark(c.max)})` : ''}`} tone={c.kind === 'exam' ? 'info' : 'muted'} />
                ))}
              </View>
            </Panel>
          ))}
        </>
      )}
    </>
  );
}

/** Second round extras (web: second-round page): timetable (admin edits), entry sheet, notices + in-app send. */
export function Round2OfficialPanel({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useJg();
  const { share, busy: sharing } = useShare();
  const cid = campusId ?? 'own';
  const tt = useApi(['jg', 'r2-timetable', sectionId, cid] as const, ([, , s, c]) => jahbadhOfficial.round2Timetable(s, own(c)));
  const [edit, setEdit] = useState<Record<string, Partial<JgRound2TimetableRow>>>({});
  const [busy, setBusy] = useState(false);
  const rows = tt.data ?? [];
  const val = (r: JgRound2TimetableRow, k: 'exam_date' | 'exam_time' | 'place') => (edit[r.jg_subject_id]?.[k] ?? r[k] ?? '') as string;
  const set = (id: string, k: 'exam_date' | 'exam_time' | 'place', v: string) => setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));

  const save = async () => {
    setBusy(true);
    const entries = rows.map((r) => ({ jg_subject_id: r.jg_subject_id, exam_date: val(r, 'exam_date') || null, exam_time: val(r, 'exam_time') || null, place: val(r, 'place') || null }));
    const res = await jahbadhOfficial.saveRound2Timetable(sectionId, entries, campusId);
    setBusy(false);
    if (!res.success) return toast.error(res.code === 'not_migrated' ? t('grades.notMigratedBody') : (res.error ?? t('app.error_title')));
    setEdit({});
    await tt.mutate(res.data, { revalidate: false });
    toast.success(t('grades.saved'));
  };
  const send = async () => {
    setBusy(true);
    const res = await jahbadhOfficial.sendRound2Notices(sectionId, campusId);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    toast.success(t('grades.noticesSent', { sent: res.data?.sent ?? 0, recipients: res.data?.recipients ?? 0 }));
  };

  return (
    <FormSection title={t('grades.round2Official')}>
      <Button variant="outline" disabled={sharing} onPress={() => share(jgOfficialPdfPath.round2EntrySheet(sectionId, campusId), 'second-round-entry.pdf')}>
        <Icon as={Printer} className="text-foreground size-4" />
        <Text>{t('grades.round2EntrySheet')}</Text>
      </Button>
      <Button variant="outline" disabled={sharing} onPress={() => share(jgOfficialPdfPath.round2Notices(sectionId, campusId), 'second-round-notices.pdf')}>
        <Icon as={Printer} className="text-foreground size-4" />
        <Text>{t('grades.round2Notices')}</Text>
      </Button>
      {isAdmin ? (
        <Button disabled={busy} onPress={send}>
          <Icon as={Send} className="text-primary-foreground size-4" />
          <Text>{t('grades.sendNotices')}</Text>
        </Button>
      ) : null}
      <Text className="text-sm font-semibold">{t('grades.round2Timetable')}</Text>
      {tt.error ? (
        <JgBlocked error={tt.error} isAdmin={isAdmin} />
      ) : !tt.data ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (
        <>
          {rows.map((r) => (
            <View key={r.jg_subject_id} className="border-info-soft dark:border-border gap-2 rounded-2xl border p-3">
              <Text className="text-sm font-semibold">{`${r.subject_name}${r.day ? ` · ${r.day}` : ''}`}</Text>
              {isAdmin ? (
                <>
                  <DateField value={val(r, 'exam_date') || null} onChange={(v) => set(r.jg_subject_id, 'exam_date', v)} label={t('grades.date')} clearable />
                  <TimeField value={val(r, 'exam_time')} onChange={(v) => set(r.jg_subject_id, 'exam_time', v)} label={t('grades.time')} />
                  <Input value={val(r, 'place')} onChangeText={(v) => set(r.jg_subject_id, 'place', v)} placeholder={t('grades.place')} />
                </>
              ) : (
                <Text variant="muted" className="text-xs">{[r.exam_date, r.exam_time, r.place].filter(Boolean).join(' · ') || '—'}</Text>
              )}
            </View>
          ))}
          {isAdmin && rows.length ? (
            <Button disabled={busy} onPress={save}>
              <Text>{t('grades.save')}</Text>
            </Button>
          ) : null}
        </>
      )}
    </FormSection>
  );
}
