import { jgPdfPath } from '@studently/api-client';
import { fmtMark } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BarChart3, BookOpen, FileText, Palette, ScrollText, Lock, Repeat2, Settings2, TableProperties, Unlock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile, RowItem, Section } from '@/components/app/layout';
import { ActionRow, Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { JgBlocked, SectionPicker, useJg, useJgSections } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Class home (web: /admin/jahbadh-grades, /teacher/jahbadh-grades): section, rule text, taught subjects, reports, stage locks. */
export default function JahbadhHome() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId, href } = useJg();
  const params = useLocalSearchParams<{ section?: string }>();
  const sections = useJgSections(campusId);
  const [picked, setPicked] = useState<string | null>(params.section ?? null);
  const firstId = sections.data?.[0]?.id ?? null;
  const sectionId = picked ?? firstId;

  const overview = useApi(sectionId ? ['jg', 'overview', sectionId, campusId ?? 'own'] : null, ([, , s, c]) =>
    jahbadhGrades.sectionSubjects(s as string, c === 'own' ? null : (c as string)),
  );
  const locks = useApi(isAdmin && sectionId ? ['jg', 'locks', sectionId, campusId ?? 'own'] : null, ([, , s, c]) =>
    jahbadhGrades.locks(s as string, c === 'own' ? null : (c as string)),
  );
  const [busy, setBusy] = useState(false);
  const ov = overview.data;
  const stages = (ov?.rule.stage_names ?? []).map((n, i) => (n ? { stage: i + 1, name: n } : null)).filter((x): x is { stage: number; name: string } => !!x);

  const toggleLock = async (stage: number) => {
    const sid = sectionId;
    if (!sid) return;
    const existing = locks.data?.find((l) => !l.jg_subject_id && l.stage === stage);
    setBusy(true);
    const res = existing ? await jahbadhGrades.removeLock(sid, existing.id, campusId) : await jahbadhGrades.addLock(sid, stage, null, campusId);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? t('app.error_title'));
    await locks.mutate(res.data, { revalidate: false });
    toast.success(existing ? t('grades.unlocked') : t('grades.locked'));
  };

  const printResults = async () => {
    const sid = sectionId;
    if (!sid) return;
    try {
      await shareApiFile(jgPdfPath.results(sid, campusId), 'results.pdf', 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t('grades.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">
          {t('grades.subtitle')}
        </Text>
        {sections.isLoading ? (
          <Skeleton className="h-12 rounded-full" />
        ) : sections.error ? (
          <JgBlocked error={sections.error} isAdmin={isAdmin} />
        ) : !sections.data?.length ? (
          <JgBlocked code={isAdmin ? 'not_mapped' : undefined} message={t('grades.noSectionsTeacher')} isAdmin={isAdmin} />
        ) : (
          <SectionPicker sections={sections.data} value={sectionId} onChange={setPicked} />
        )}

        {overview.error ? (
          <JgBlocked error={overview.error} isAdmin={isAdmin} />
        ) : sectionId && !ov ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : ov ? (
          <>
            <Panel className="gap-2 p-4">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-base font-bold">{`${ov.rule.name} — ${ov.section.name}`}</Text>
                <StatusChip label={ov.rule.system_name} tone="info" />
              </View>
              <Text variant="muted" className="text-xs">
                {`${t('grades.academicYear')}: ${ov.academic_year.name ?? '—'}`}
              </Text>
              <Text className="bg-muted rounded-xl p-3 text-xs leading-5">{ov.rule.rule_text}</Text>
            </Panel>

            <Section title={t('grades.subjects')}>
              <Panel>
                {ov.subjects.map((s, i) => (
                  <RowItem
                    key={s.id}
                    title={s.short_name}
                    meta={t('grades.subjectMeta', { max: fmtMark(s.subject_max), periods: s.weekly_periods })}
                    leading={<IconTile icon={BookOpen} />}
                    trailing={s.can_enter ? null : <StatusChip label={t('grades.viewOnly')} tone="muted" />}
                    onPress={() => router.push(href('/jahbadh/grid', { section: sectionId ?? '', subject: s.id }))}
                    last={i === ov.subjects.length - 1}
                  />
                ))}
              </Panel>
            </Section>

            <Section title={t('grades.reports')}>
              <Panel>
                <ActionRow icon={TableProperties} title={t('grades.results')} onPress={() => router.push(href('/jahbadh/results', { section: sectionId ?? '' }))} />
                <ActionRow icon={Repeat2} title={t('grades.secondRound')} onPress={() => router.push(href('/jahbadh/second-round', { section: sectionId ?? '' }))} />
                <ActionRow icon={ScrollText} title={t('grades.reportCards')} onPress={() => router.push(href('/jahbadh/report-cards', { section: sectionId ?? '' }))} />
                <ActionRow icon={Palette} title={t('grades.activities')} onPress={() => router.push(href('/jahbadh/activities', { section: sectionId ?? '' }))} />
                <ActionRow icon={FileText} title={t('grades.printResults')} onPress={printResults} />
                <ActionRow icon={BookOpen} title={t('grades.distribution')} onPress={() => router.push(href('/jahbadh/distribution'))} last={!isAdmin} />
                {isAdmin ? <ActionRow icon={Settings2} title={t('grades.setup')} onPress={() => router.push('/admin/jahbadh/setup')} last /> : null}
              </Panel>
            </Section>

            <Section title={t('grades.analytics')}>
              <Panel>
                {(
                  [
                    ['/jahbadh/dashboard', 'dashboard', {}],
                    ['/jahbadh/insights', 'studentProfile', { view: 'profile' }],
                    ['/jahbadh/insights', 'earlyWarning', { view: 'warning' }],
                    ['/jahbadh/insights', 'learningGroups', { view: 'groups' }],
                    ['/jahbadh/insights', 'subjectAnalysis', { view: 'analysis' }],
                    ['/jahbadh/test-analysis', 'testAnalysis', {}],
                    ['/jahbadh/rubrics', 'rubrics', {}],
                    ['/jahbadh/ideas', 'ideas', {}],
                  ] as const
                ).map(([path, key, extra], i, all) => (
                  <ActionRow
                    key={key}
                    icon={BarChart3}
                    title={t(`grades.${key}`)}
                    onPress={() => router.push(href(path, { section: sectionId ?? '', ...extra }))}
                    last={i === all.length - 1}
                  />
                ))}
              </Panel>
            </Section>

            {isAdmin ? (
              <Section title={t('grades.stageLocks')}>
                <Panel>
                  <Text variant="muted" className="px-4 pt-3 text-xs">
                    {t('grades.stageLocksHint')}
                  </Text>
                  {stages.map(({ stage, name }, i) => {
                    const locked = !!locks.data?.some((l) => !l.jg_subject_id && l.stage === stage);
                    return (
                      <RowItem
                        key={stage}
                        title={name}
                        leading={<IconTile icon={locked ? Lock : Unlock} tone={locked ? 'warning' : 'muted'} />}
                        trailing={<StatusChip label={locked ? t('grades.locked') : t('grades.unlocked')} tone={locked ? 'warning' : 'muted'} />}
                        onPress={busy ? undefined : () => toggleLock(stage)}
                        chevron={false}
                        last={i === stages.length - 1}
                      />
                    );
                  })}
                </Panel>
              </Section>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
