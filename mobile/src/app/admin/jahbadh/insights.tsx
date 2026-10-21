import { jgPdfPath, type JgStudent } from '@studently/api-client';
import {
  decisionTone, fmtMark, fmtPct, JG_GROUP_STRATEGIES_AR, JG_INTERVENTIONS_AR, JG_RESULT_LABELS, type JgGroup,
} from '@studently/shared-utils';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FormSection, HeroCard, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { chipTone, JgBlocked, resultChipTone, ShareBar, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/**
 * Section analytics on the phone (web: /admin/jahbadh-grades/{student-profile,early-warning,groups,subject-analysis}).
 * One route with `view=` keeps the four lists together; the menu and the class home open the right one.
 */
export default function JahbadhInsights() {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { view = 'profile' } = useLocalSearchParams<{ view?: string }>();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const title = { profile: t('grades.studentProfile'), warning: t('grades.earlyWarning'), groups: t('grades.learningGroups'), analysis: t('grades.subjectAnalysis') }[view] ?? t('grades.analytics');
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {!sectionId ? null : view === 'warning' ? (
          <EarlyWarning sectionId={sectionId} />
        ) : view === 'groups' ? (
          <Groups sectionId={sectionId} />
        ) : view === 'analysis' ? (
          <Analysis sectionId={sectionId} />
        ) : (
          <Profile sectionId={sectionId} />
        )}
      </ScrollView>
    </>
  );
}

const pct = (p: number | null | undefined, d: 0 | 1 = 0) => (p === null || p === undefined ? '—' : fmtPct(p, d));
const pts = (x: number | null) => (x === null ? '—' : `${x > 0 ? '+' : ''}${Math.round(x * 10) / 10}%`);
const cidOf = (c: string | null) => c ?? 'own';
const fromKey = (c: string) => (c === 'own' ? null : c);

function useShare() {
  const { t } = useTranslation();
  const toast = useToast();
  return async (path: string, name: string) => {
    try {
      await shareApiFile(path, name, 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };
}

function Profile({ sectionId }: { sectionId: string }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const share = useShare();
  const results = useApi(['jg', 'results', sectionId, cidOf(campusId)] as const, ([, , s, c]) => jahbadhGrades.results(s, fromKey(c)));
  const students: JgStudent[] = results.data?.students.map((s) => s.student) ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const studentId = picked ?? students[0]?.id ?? null;
  const p = useApi(studentId ? (['jg', 'profile', sectionId, studentId, cidOf(campusId)] as const) : null, ([, , s, st, c]) => jahbadhGrades.studentProfile(s, st, fromKey(c)));
  if (results.error) return <JgBlocked error={results.error} isAdmin={isAdmin} />;
  if (!results.data) return <Skeleton className="h-64 rounded-2xl" />;
  const x = p.data;
  return (
    <>
      <Picker value={studentId} onChange={setPicked} options={students.map((s, i) => ({ value: s.id, label: `${i + 1}. ${s.name}` }))} />
      {p.error ? (
        <JgBlocked error={p.error} isAdmin={isAdmin} />
      ) : !x ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          <HeroCard>
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-lg font-bold text-white">{x.student.name}</Text>
              <Pressable
                onPress={() => share(jgPdfPath.studentProfile(sectionId, x.student.id, campusId), 'student-profile.pdf')}
                accessibilityRole="button"
                accessibilityLabel={t('grades.printPdf')}
                className="rounded-full bg-white/20 p-2">
                <Icon as={Printer} className="size-4 text-white" />
              </Pressable>
            </View>
            <Text className="text-3xl font-bold text-white">{pct(x.pct, 1)}</Text>
            <Text className="text-xs text-white opacity-80">
              {`${fmtMark(x.total) || '—'} / ${fmtMark(x.max)}${x.estimate ? ` · ${x.estimate}` : ''}${x.rank ? ` · ${t('grades.rank')} ${x.rank}/${x.class_size}` : ''}`}
            </Text>
          </HeroCard>
          <StatusChip label={x.decision} tone={chipTone(decisionTone(x.decision))} className="self-start" />
          <Panel>
            {x.subjects.map((s, i) => (
              <View key={s.id} className={i < x.subjects.length - 1 ? 'border-info-soft dark:border-border gap-1.5 border-b px-4 py-3' : 'gap-1.5 px-4 py-3'}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold">{s.name}</Text>
                  {s.result ? <StatusChip label={JG_RESULT_LABELS[s.result]} tone={resultChipTone(s.result)} /> : null}
                </View>
                <ShareBar value={s.pct} />
                <ShareBar value={s.classAvgPct} tone="warning" />
                <Text variant="muted" className="text-[11px]">
                  {`${fmtMark(s.final) || '—'}/${fmtMark(s.max)} · ${pct(s.pct)}${s.estimate ? ` · ${s.estimate}` : ''} · ${t('grades.classAverage')} ${pct(s.classAvgPct)}`}
                </Text>
              </View>
            ))}
          </Panel>
          <FormSection title={`✦ ${t('grades.feedback')}`}>
            <Text className="text-sm leading-6">{x.feedback}</Text>
          </FormSection>
        </>
      )}
    </>
  );
}

const LEVEL_TONE = { high: 'destructive', medium: 'warning', low: 'success' } as const;

function EarlyWarning({ sectionId }: { sectionId: string }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const d = useApi(['jg', 'ew', sectionId, cidOf(campusId)] as const, ([, , s, c]) => jahbadhGrades.earlyWarning(s, fromKey(c)));
  if (d.error) return <JgBlocked error={d.error} isAdmin={isAdmin} />;
  if (!d.data) return <Skeleton className="h-64 rounded-2xl" />;
  const x = d.data;
  const rows = [...x.rows].sort((a, b) => (b.risk?.score ?? -1) - (a.risk?.score ?? -1));
  return (
    <>
      <StatTiles>
        <StatTile label={t('grades.riskHigh')} value={String(x.tiles.high)} tone="destructive" />
        <StatTile label={t('grades.riskMedium')} value={String(x.tiles.medium)} tone="warning" />
        <StatTile label={t('grades.riskLow')} value={String(x.tiles.low)} tone="success" />
      </StatTiles>
      <Text variant="muted" className="text-xs">{`${t('grades.averageChange')}: ${pts(x.tiles.averageChange)}`}</Text>
      <Panel>
        {rows.map((r, i) => (
          <View key={r.student.id} className={i < rows.length - 1 ? 'border-info-soft dark:border-border gap-1.5 border-b px-4 py-3' : 'gap-1.5 px-4 py-3'}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{r.student.name}</Text>
              {r.risk ? <StatusChip label={`${t(`grades.risk_${r.risk.level}`)} ${r.risk.score}`} tone={LEVEL_TONE[r.risk.level]} /> : null}
            </View>
            {r.risk ? <ShareBar value={r.risk.score / 100} tone={LEVEL_TONE[r.risk.level]} /> : null}
            <Text variant="muted" className="text-[11px]">
              {`${t('grades.overallPct')} ${pct(r.pct)} · ${t('grades.strugglingSubjects')} ${r.struggling} · ${t('grades.change')} ${pts(r.change)} · ${t('grades.gapLabel')} ${pts(r.gap)}`}
            </Text>
            {r.risk ? (
              <Text className="text-xs leading-5">
                <Text className="text-xs font-semibold">{`${JG_INTERVENTIONS_AR[r.risk.indicator].indicator}: `}</Text>
                {JG_INTERVENTIONS_AR[r.risk.indicator].intervention}
              </Text>
            ) : null}
          </View>
        ))}
      </Panel>
      <Section title={`🎉 ${t('grades.mostImproved')}`}>
        <Panel className="gap-1 p-4">
          {x.mostImproved.length ? x.mostImproved.map((r) => (
            <View key={r.student.id} className="flex-row justify-between"><Text className="text-sm">{r.student.name}</Text><Text className="text-success text-sm">{pts(r.change)}</Text></View>
          )) : <Text variant="muted">—</Text>}
        </Panel>
      </Section>
      <Section title={`🎯 ${t('grades.priority')}`}>
        <Panel className="gap-1 p-4">
          {x.priority.length ? x.priority.map((r) => (
            <View key={r.student.id} className="flex-row justify-between"><Text className="text-sm">{r.student.name}</Text><Text className="text-destructive text-sm">{r.risk?.score}</Text></View>
          )) : <Text variant="muted">—</Text>}
        </Panel>
      </Section>
      <Text variant="muted" className="text-xs">{t('grades.riskFormula')}</Text>
    </>
  );
}

const GROUPS: { key: JgGroup; tone: 'success' | 'muted' | 'destructive'; icon: string }[] = [
  { key: 'enrichment', tone: 'success', icon: '★' },
  { key: 'reinforcement', tone: 'muted', icon: '◆' },
  { key: 'remedial', tone: 'destructive', icon: '●' },
];

function Groups({ sectionId }: { sectionId: string }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const [subject, setSubject] = useState<string | null>(null);
  const d = useApi(['jg', 'groups', sectionId, subject ?? 'first', cidOf(campusId)] as const, ([, , s, sub, c]) =>
    jahbadhGrades.learningGroups(s, sub === 'first' ? null : sub, fromKey(c)),
  );
  if (d.error) return <JgBlocked error={d.error} isAdmin={isAdmin} />;
  if (!d.data) return <Skeleton className="h-64 rounded-2xl" />;
  const x = d.data;
  const range = (k: JgGroup) =>
    k === 'enrichment'
      ? t('grades.rangeFrom', { from: pct(x.excel_rate) })
      : k === 'reinforcement'
        ? t('grades.rangeBetween', { from: pct(x.follow_rate), to: pct(x.excel_rate) })
        : t('grades.rangeBelow', { to: pct(x.follow_rate) });
  return (
    <>
      <Picker value={x.subject.id} onChange={setSubject} options={x.subjects.map((s) => ({ value: s.id, label: s.name }))} />
      {GROUPS.map((g) => (
        <FormSection
          key={g.key}
          title={`${g.icon} ${t(`grades.group_${g.key}`)}`}
          description={range(g.key)}
          action={<StatusChip label={t('grades.countN', { count: x.groups[g.key].length })} tone={g.tone} />}>
          <Text variant="muted" className="text-xs leading-5">{JG_GROUP_STRATEGIES_AR[g.key]}</Text>
          {x.groups[g.key].map((m) => (
            <View key={m.student.id} className="flex-row justify-between">
              <Text className="text-sm">{m.student.name}</Text>
              <Text className="text-sm">{pct(m.pct)}</Text>
            </View>
          ))}
        </FormSection>
      ))}
      <Text variant="muted" className="text-xs">{t('grades.groupsHint')}</Text>
    </>
  );
}

function Analysis({ sectionId }: { sectionId: string }) {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const share = useShare();
  const [q, setQ] = useState<{ subject?: string; measure?: string; compare?: string; pass?: number }>({});
  const d = useApi(['jg', 'sa', sectionId, JSON.stringify(q), cidOf(campusId)] as const, ([, , s, qq, c]) => jahbadhGrades.subjectAnalysis(s, JSON.parse(qq), fromKey(c)));
  const [passText, setPassText] = useState('');
  if (d.error) return <JgBlocked error={d.error} isAdmin={isAdmin} />;
  if (!d.data) return <Skeleton className="h-64 rounded-2xl" />;
  const x = d.data;
  const a = x.analysis;
  const m = (v: number | null) => (v === null ? '—' : fmtMark(Math.round(v * 100) / 100));
  return (
    <>
      <FormSection title={t('grades.subjectAnalysis')}>
        <Picker value={x.subject.id} onChange={(v) => setQ({ subject: v })} options={x.subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <Text variant="muted" className="text-xs">{t('grades.measure')}</Text>
        <Picker value={x.measure.value} onChange={(v) => setQ({ ...q, subject: x.subject.id, measure: v })} options={x.measures} />
        <Text variant="muted" className="text-xs">{t('grades.compareWith')}</Text>
        <Picker
          value={x.compare?.value ?? '__none__'}
          onChange={(v) => setQ({ ...q, subject: x.subject.id, compare: v === '__none__' ? undefined : v })}
          options={[{ value: '__none__', label: '—' }, ...x.measures.filter((o) => o.value !== x.measure.value)]}
        />
        <Text variant="muted" className="text-xs">{t('grades.passThreshold')}</Text>
        <Input
          keyboardType="number-pad"
          placeholder={String(Math.round(x.pass_rate * 100))}
          value={passText}
          onChangeText={setPassText}
          onEndEditing={() => setQ({ ...q, subject: x.subject.id, pass: Number(passText) / 100 || undefined })}
        />
        <Pressable
          onPress={() => share(jgPdfPath.subjectAnalysis(sectionId, { ...q, subject: x.subject.id }, campusId), 'subject-analysis.pdf')}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-2 rounded-full border border-border py-3 active:opacity-70">
          <Icon as={Printer} className="text-foreground size-4" />
          <Text>{t('grades.printPdf')}</Text>
        </Pressable>
      </FormSection>
      <StatTiles>
        <StatTile label={t('grades.recorded')} value={`${a.recorded}/${a.count}`} />
        <StatTile label={t('grades.meanPct')} value={pct(a.meanPct)} note={`${t('grades.mean')} ${m(a.mean)}/${fmtMark(x.measure.max)}`} />
      </StatTiles>
      <StatTiles>
        <StatTile label={t('grades.passRateLabel')} value={pct(a.passRate)} tone="success" />
        <StatTile label={t('grades.needSupportCount')} value={String(a.needSupport)} tone="destructive" />
      </StatTiles>
      <Section title={t('grades.levelBands', { max: fmtMark(x.measure.max) })}>
        <Panel className="gap-2 p-4">
          {a.bands.map((b) => (
            <View key={b.label} className="gap-1">
              <View className="flex-row justify-between">
                <Text className="text-sm font-semibold">{b.label}</Text>
                <Text className="text-sm">{`${b.count} · ${pct(b.share)}`}</Text>
              </View>
              <ShareBar value={b.share} />
            </View>
          ))}
          <Text variant="muted" className="text-[11px]">
            {`${t('grades.highest')} ${m(a.highest)} · ${t('grades.lowest')} ${m(a.lowest)} · ${t('grades.median')} ${m(a.median)} · ${t('grades.stdev')} ${m(a.stdev)} · ${t('grades.boys')} ${m(a.boys)} · ${t('grades.girls')} ${m(a.girls)}`}
          </Text>
        </Panel>
      </Section>
      <FormSection title={t('grades.autoReading')}>
        {x.reading.map((line, i) => (
          <Text key={i} className="text-sm leading-6">{`• ${line}`}</Text>
        ))}
      </FormSection>
      {a.remedial.length ? (
        <FormSection title={t('grades.remedialList', { count: a.remedial.length })}>
          {a.remedial.map((s, i) => (
            <View key={i} className="flex-row justify-between"><Text className="text-sm">{s.name}</Text><Text className="text-destructive text-sm">{fmtMark(s.value)}</Text></View>
          ))}
        </FormSection>
      ) : null}
    </>
  );
}
