import { jgPdfPath, type JgResultStudent } from '@studently/api-client';
import { decisionTone, fmtMark, fmtPct } from '@studently/shared-utils';
import { Stack } from 'expo-router';
import { Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Initials } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { chipTone, JgBlocked, useJg, SectionHeader, useJgSection } from '@/features/jahbadh/shared';
import { jahbadhGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { shareApiFile } from '@/lib/share-file';

/** Final results sheet (web: /admin/jahbadh-grades/results): overall total, %, estimate, rank and decision per student. */
export default function JahbadhResults() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin, campusId } = useJg();
  const { sections, sectionId, setSection } = useJgSection(campusId);
  const res = useApi(sectionId ? ['jg', 'results', sectionId, campusId ?? 'own'] : null, ([, , s, c]) =>
    jahbadhGrades.results(s as string, c === 'own' ? null : (c as string)),
  );
  const r = res.data;
  const subjects = r?.subjects ?? [];
  const grandMax = r?.grand_max ?? 0;

  const print = async () => {
    if (!sectionId) return;
    try {
      await shareApiFile(jgPdfPath.results(sectionId, campusId), 'results.pdf', 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t('grades.results'),
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
          header={
            r ? (
              <View className="gap-1 p-4">
                <Text className="font-semibold">{t('grades.resultsTitle', { grade: r.section.grade_level_name, section: r.section.name, year: r.academic_year.name ?? '' })}</Text>
                <Text variant="muted" className="text-xs">{`${t('grades.maxRow')}: ${fmtMark(grandMax)}`}</Text>
              </View>
            ) : undefined
          }
          items={r?.students}
          error={res.error}
          isLoading={res.isLoading}
          isRefreshing={res.isValidating && !res.isLoading}
          onRefresh={() => res.mutate()}
          emptyTitle={t('grades.noStudents')}
          keyExtractor={(s: JgResultStudent) => s.student.id}
          renderItem={(s: JgResultStudent) => (
            <View className="gap-2 px-4 py-3">
              <View className="flex-row items-center gap-3">
                <Initials name={s.student.name} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {s.student.name}
                  </Text>
                  <Text variant="muted" className="text-[11px]">
                    {`${fmtMark(s.total) || '—'} / ${fmtMark(s.max || grandMax)} · ${fmtPct(s.pct, 1) || '—'}${s.estimate ? ` · ${s.estimate}` : ''}${s.rank ? ` · ${t('grades.rank')} ${s.rank}` : ''}`}
                  </Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {subjects.map((sub) => {
                  const x = s.subjects[sub.id]?.result;
                  if (!x || x.final === null) return null;
                  const tone = x.result === 'fail' ? 'destructive' : x.result === 'round2' ? 'warning' : 'muted';
                  return <StatusChip key={sub.id} label={`${sub.short_name} ${fmtMark(x.final)}`} tone={tone} />;
                })}
              </View>
              <StatusChip label={s.decision} tone={chipTone(decisionTone(s.decision))} className="self-start" />
            </View>
          )}
        />
      )}
    </>
  );
}
