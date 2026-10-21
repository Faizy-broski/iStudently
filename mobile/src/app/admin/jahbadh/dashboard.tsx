import { fmtMark, fmtPct } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, ShareBar, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const pct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : fmtPct(p));

/** Performance dashboard (web: /admin/jahbadh-grades/dashboard). */
export default function JahbadhDashboard() {
  const { t } = useTranslation();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const d = useApi(sectionId ? (['jg', 'dash', sectionId, campusId ?? 'own'] as const) : null, ([, , s, c]) => jahbadhGrades.dashboard(s, c === 'own' ? null : c));
  const x = d.data;
  const levelNames = x ? Object.keys(x.levels) : [];

  return (
    <>
      <Stack.Screen options={{ title: t('grades.dashboard') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
        {d.error ? (
          <JgBlocked error={d.error} isAdmin={isAdmin} />
        ) : !x ? (
          sectionId ? <Skeleton className="h-96 rounded-2xl" /> : null
        ) : (
          <>
            <StatTiles>
              <StatTile label={t('grades.students')} value={String(x.tiles.students)} note={`${t('grades.recordedStudents')}: ${x.tiles.recorded}`} />
              <StatTile label={t('grades.overallAverage')} value={pct(x.tiles.average)} />
            </StatTiles>
            <StatTiles>
              <StatTile label={x.rule.no_fail ? t('grades.promotionRate') : t('grades.passRateLabel')} value={pct(x.tiles.passRate)} tone="success" />
              <StatTile label={t('grades.excellentCount')} value={String(x.tiles.excellent)} tone="success" />
              <StatTile label={t('grades.needSupportCount')} value={String(x.tiles.needSupport)} tone="destructive" />
            </StatTiles>
            <Panel className="gap-2 p-4">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm">{t('grades.strongest')}</Text>
                <StatusChip label={x.strongest ?? '—'} tone="success" />
              </View>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm">{t('grades.weakest')}</Text>
                <StatusChip label={x.weakest ?? '—'} tone="destructive" />
              </View>
            </Panel>
            <Section title={t('grades.subjectIndicators')}>
              <Panel>
                {x.subjects.map((s, i) => (
                  <View key={s.id} className={i < x.subjects.length - 1 ? 'border-info-soft dark:border-border gap-1.5 border-b px-4 py-3' : 'gap-1.5 px-4 py-3'}>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold">{s.name}</Text>
                      <Text className="text-sm font-bold">{pct(s.meanPct)}</Text>
                    </View>
                    <ShareBar value={s.meanPct} />
                    <Text variant="muted" className="text-[11px] leading-4">
                      {[
                        `${t('grades.recorded')} ${s.recorded}`,
                        `${t('grades.mean')} ${s.mean === null ? '—' : fmtMark(Math.round(s.mean * 10) / 10)}/${fmtMark(s.max)}`,
                        `${x.rule.no_fail ? t('grades.reachedSupport') : t('grades.passRateLabel')} ${pct(s.passRate)}`,
                        `${t('grades.stdev')} ${s.stdev === null ? '—' : fmtMark(Math.round(s.stdev * 10) / 10)}`,
                        `${t('grades.highest')} ${fmtMark(s.highest) || '—'} · ${t('grades.lowest')} ${fmtMark(s.lowest) || '—'}`,
                        `${t('grades.worksMastery')} ${pct(s.worksMastery)} · ${t('grades.examMastery')} ${pct(s.examMastery)}`,
                        `${t('grades.boys')} ${pct(s.boysPct)} · ${t('grades.girls')} ${pct(s.girlsPct)}`,
                      ].join(' · ')}
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {levelNames.map((l) => (s.levels[l] ? <StatusChip key={l} label={`${l} ${s.levels[l]}`} tone="muted" /> : null))}
                      {s.gap !== null && s.gap > 15 ? <StatusChip label={`${t('grades.gapLabel')} +${Math.round(s.gap)}%`} tone="warning" /> : null}
                    </View>
                  </View>
                ))}
              </Panel>
            </Section>
            <Section title={t('grades.overallLevels')}>
              <Panel className="gap-2 p-4">
                {levelNames.map((l) => (
                  <View key={l} className="gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-sm">{l}</Text>
                      <Text className="text-sm">{x.levels[l]}</Text>
                    </View>
                    <ShareBar value={x.tiles.recorded ? x.levels[l] / x.tiles.recorded : 0} />
                  </View>
                ))}
              </Panel>
            </Section>
            <Text variant="muted" className="text-xs">{t('grades.dashboardHint')}</Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
