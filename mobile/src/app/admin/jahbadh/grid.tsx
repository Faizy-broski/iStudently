import { jgPdfPath, type JgGridRow } from '@studently/api-client';
import { fmtMark, fmtPct, JG_RESULT_LABELS, learnerWord } from '@studently/shared-utils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarRange, Lock, Printer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Initials, StatTile, StatTiles } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { JgBlocked, needText, resultChipTone, useJg, useJgGrid } from '@/features/jahbadh/shared';
import { shareApiFile } from '@/lib/share-file';

/**
 * One subject of a section (web: the subject grid). On a phone the grid becomes a student list with
 * total, % and result; a student opens the entry form with every component of every stage.
 */
export default function JahbadhSubject() {
  const { t } = useTranslation();
  const { isAdmin, campusId, href } = useJg();
  const toast = useToast();
  const { section, subject, stage } = useLocalSearchParams<{ section: string; subject: string; stage?: string }>();
  const grid = useJgGrid(section ?? null, subject ?? null, campusId);
  const g = grid.data;
  // ?stage= (1–3 or 'all'); else the school default the server returned (null = «كل الكشف»).
  const serverStage = g?.stage ?? null;
  const viewStage = stage === 'all' ? null : stage ? Number(stage) : serverStage;
  const stageKey = viewStage ? String(viewStage) : 'all';
  const hasMonthly = !!g?.subject.components.some((c) => c.monthly_kind);
  const print = async () => {
    const sid = section ?? null;
    const sub = subject ?? null;
    if (!sid || !sub) return;
    try {
      await shareApiFile(jgPdfPath.grid(sid, sub, campusId, viewStage ? (viewStage as 1 | 2 | 3) : 'all'), 'subject-sheet.pdf', 'application/pdf');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('app.error_title'));
    }
  };
  const s = g?.summary;
  const subjectMax = g?.subject.meta.subjectMax ?? 0;
  const word = g ? t('grades.studentName', { word: learnerWord(g.rule.grade_code) }) : '';

  return (
    <>
      <Stack.Screen options={{ title: g ? `${g.subject.short_name} — ${g.section.name}` : t('grades.title') }} />
      {grid.error ? (
        <View className="bg-background flex-1 p-4">
          <JgBlocked error={grid.error} isAdmin={isAdmin} />
        </View>
      ) : (
        <DataList
          className="bg-background"
          header={
            g && s ? (
              <View className="gap-3 p-4">
                <Text variant="muted" className="text-xs">
                  {`${g.rule.name} · ${g.rule.system_name} · ${t('grades.subjectMeta', { max: fmtMark(g.subject.meta.subjectMax), periods: g.subject.weekly_periods })} · ${t('grades.memoYear', { version: g.version })}`}
                </Text>
                <FilterChips
                  value={stageKey}
                  onChange={(v) => router.setParams({ stage: v })}
                  options={[
                    { value: 'all', label: t('grades.allStages') },
                    ...[...new Set(g.subject.components.map((c) => c.stage))].sort((a, b) => a - b).map((n) => ({ value: String(n), label: g.rule.stage_names[n - 1] ?? String(n) })),
                  ]}
                />
                <View className="flex-row flex-wrap gap-2">
                  <Button variant="outline" size="sm" onPress={print}>
                    <Icon as={Printer} className="text-foreground size-4" />
                    <Text>{t('grades.printSheet')}</Text>
                  </Button>
                  {hasMonthly ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onPress={() => router.push(href('/jahbadh/monthly', { section: section ?? '', subject: subject ?? '', ...(viewStage ? { stage: String(viewStage) } : {}) }))}>
                      <Icon as={CalendarRange} className="text-foreground size-4" />
                      <Text>{t('grades.monthlyLog')}</Text>
                    </Button>
                  ) : null}
                </View>
                {g.locked_stages.length ? (
                  <View className="bg-warning-soft flex-row items-center gap-2 rounded-xl p-2.5">
                    <Icon as={Lock} className="text-warning size-4" />
                    <Text className="text-warning flex-1 text-xs">
                      {g.locked_stages.map((n) => g.rule.stage_names[n - 1]).join('، ')}
                    </Text>
                  </View>
                ) : null}
                {!g.can_enter ? <Text className="bg-muted rounded-xl p-2.5 text-xs">{t('grades.viewOnlyHint')}</Text> : null}
                <StatTiles>
                  <StatTile label={JG_RESULT_LABELS.pass} value={String(s.pass + s.passRound2 + s.promoted)} tone="success" />
                  <StatTile label={JG_RESULT_LABELS.round2} value={String(s.round2)} tone="warning" />
                  <StatTile label={t('grades.classAverage')} value={fmtPct(s.avgPct) || '—'} />
                </StatTiles>
                <Text variant="muted" className="text-xs">
                  {s.recorded
                    ? t('grades.summaryLine', {
                        recorded: s.recorded, pass: s.pass + s.passRound2, promoted: s.promoted, round2: s.round2, fail: s.fail,
                        incomplete: s.incomplete, avg: fmtPct(s.avgPct), follow: fmtPct(g.settings.follow_rate), support: s.needSupport,
                      })
                    : t('grades.noMarksYet')}
                </Text>
                <Text className="text-sm font-semibold">{word}</Text>
              </View>
            ) : undefined
          }
          items={g?.rows}
          error={grid.error}
          isLoading={grid.isLoading}
          isRefreshing={grid.isValidating && !grid.isLoading}
          onRefresh={() => grid.mutate()}
          emptyTitle={t('grades.noStudents')}
          keyExtractor={(r: JgGridRow) => r.student.id}
          renderItem={(r: JgGridRow, i) => {
            const need = needText(r.need, fmtMark, t('grades.impossible'));
            return (
              <Pressable
                className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
                accessibilityRole="button"
                onPress={() => router.push(href('/jahbadh/student', { section: section ?? '', subject: subject ?? '', index: String(i), stage: stageKey }))}>
                <Initials name={r.student.name} tone={r.result.result === 'fail' ? 'destructive' : r.result.result === 'round2' ? 'warning' : 'brand'} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold" numberOfLines={1}>
                    {r.student.name}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {r.result.total === null
                      ? t('grades.noMarksYet')
                      : `${fmtMark(r.result.final)} / ${fmtMark(subjectMax)} · ${fmtPct(r.result.pct)}${r.result.estimate ? ` · ${r.result.estimate}` : ''}`}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  {r.result.result ? <StatusChip label={JG_RESULT_LABELS[r.result.result]} tone={resultChipTone(r.result.result)} /> : null}
                  {need && r.result.result === 'round2' ? <Text className="text-warning text-xs font-semibold">{need.text}</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </>
  );
}
