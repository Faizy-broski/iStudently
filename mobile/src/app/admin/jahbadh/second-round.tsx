import { jgPdfPath, type JgSecondRound } from '@studently/api-client';
import { decisionTone, fmtMark, fmtPct } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { chipTone, JgBlocked, needText, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

type Referred = JgSecondRound['students'][number];

/** Failing & second round (web: /admin/jahbadh-grades/second-round): tiles, per-subject summary, needed scores. */
export default function JahbadhSecondRound() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const res = useApi(sectionId ? ['jg', 'second-round', sectionId, campusId ?? 'own'] : null, ([, , s, c]) =>
    jahbadhGrades.secondRound(s as string, c === 'own' ? null : (c as string)),
  );
  const r = res.data;
  const subjects = r?.subjects ?? [];

  const print = async () => {
    if (!sectionId) return;
    try {
      await shareApiFile(jgPdfPath.secondRound(sectionId, campusId), 'second-round.pdf', 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };

  const header = r ? (
    r.no_fail ? (
      <Panel className="m-4 p-4">
        <Text className="text-sm leading-6">{t('grades.noFailMessage', { grade: r.section.grade_level_name })}</Text>
      </Panel>
    ) : (
      <View className="gap-3 p-4">
        <StatTiles>
          <StatTile label={t('grades.referred')} value={String(r.tiles.referred)} tone="warning" />
          <StatTile label={t('grades.awaiting')} value={String(r.tiles.awaiting)} />
        </StatTiles>
        <StatTiles>
          <StatTile label={t('grades.passedAfter')} value={String(r.tiles.passed_after)} tone="success" />
          <StatTile label={t('grades.failed')} value={String(r.tiles.failed)} tone="destructive" />
        </StatTiles>
        <StatTiles>
          <StatTile label={t('grades.passRate')} value={r.tiles.pass_rate === null ? '—' : fmtPct(r.tiles.pass_rate)} />
          <StatTile label={t('grades.topSubject')} value={r.tiles.top_subject ?? '—'} />
        </StatTiles>
        <Panel>
          {r.per_subject
            .filter((p) => p.referred)
            .map((p, i, list) => (
              <View key={p.subject_id} className={i < list.length - 1 ? 'border-info-soft dark:border-border border-b px-4 py-3' : 'px-4 py-3'}>
                <Text className="text-sm font-semibold">{subjects.find((s) => s.id === p.subject_id)?.short_name}</Text>
                <Text variant="muted" className="text-[11px]">
                  {`${t('grades.referred')}: ${p.referred} · ${t('grades.awaiting')}: ${p.awaiting} · ${t('grades.passedAfter')}: ${p.passed_after} · ${t('grades.failed')}: ${p.failed}`}
                </Text>
              </View>
            ))}
        </Panel>
        <Text variant="muted" className="text-xs">
          {t('grades.needLegend')}
        </Text>
      </View>
    )
  ) : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          title: t('grades.secondRound'),
          headerRight: () => (
            <Pressable onPress={print} accessibilityRole="button" accessibilityLabel={t('grades.printPdf')} className="p-2">
              <Icon as={Printer} className="text-brand dark:text-brand-secondary size-5" />
            </Pressable>
          ),
        }}
      />
      <View className="bg-background px-4 pt-3">
        <SectionHeader sections={sections} sectionId={sectionId} onChange={setSection} isAdmin={isAdmin} />
      </View>
      {res.error ? (
        <View className="bg-background flex-1 p-4">
          <JgBlocked error={res.error} isAdmin={isAdmin} />
        </View>
      ) : (
        <DataList
          className="bg-background"
          header={header}
          items={r ? (r.no_fail ? [] : r.students) : undefined}
          error={res.error}
          isLoading={res.isLoading}
          isRefreshing={res.isValidating && !res.isLoading}
          onRefresh={() => res.mutate()}
          emptyTitle={r?.no_fail ? '' : t('grades.noReferred')}
          keyExtractor={(s: Referred) => s.student.id}
          renderItem={(s: Referred) => (
            <View className="gap-2 px-4 py-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
                  {s.student.name}
                </Text>
                <StatusChip label={s.decision} tone={chipTone(decisionTone(s.decision))} />
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {subjects.map((sub) => {
                  const n = needText(s.cells[sub.id] ?? null, fmtMark, t('grades.impossible'));
                  return n ? <StatusChip key={sub.id} label={`${sub.short_name} ${n.text}`} tone={n.tone} /> : null;
                })}
              </View>
            </View>
          )}
        />
      )}
    </>
  );
}
